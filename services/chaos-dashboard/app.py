import os
import json
import time
import random
import threading
import requests
import redis
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_TTL  = 3600  # 1 hour experiment state TTL
K8S_NAMESPACE = "zylkerkart"

SERVICE_URLS = {
    "product":   os.getenv("PRODUCT_SERVICE_URL",   "http://localhost:8081"),
    "order":     os.getenv("ORDER_SERVICE_URL",      "http://localhost:8082"),
    "search":    os.getenv("SEARCH_SERVICE_URL",     "http://localhost:8083"),
    "payment":   os.getenv("PAYMENT_SERVICE_URL",    "http://localhost:8084"),
    "auth":      os.getenv("AUTH_SERVICE_URL",        "http://localhost:8085"),
    "storefront":os.getenv("STOREFRONT_URL",          "http://localhost:8080"),
}

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# ---------------------------------------------------------------------------
# Kubernetes Client (lazy init - works both in-cluster and locally)
# ---------------------------------------------------------------------------
_k8s_ready = False

def _init_k8s():
    global _k8s_ready
    if not _k8s_ready:
        from kubernetes import config
        try:
            config.load_incluster_config()
        except Exception:
            config.load_kube_config()
        _k8s_ready = True

def _k8s_core():
    _init_k8s()
    from kubernetes import client
    return client.CoreV1Api()

def _k8s_apps():
    _init_k8s()
    from kubernetes import client
    return client.AppsV1Api()

def _k8s_networking():
    _init_k8s()
    from kubernetes import client
    return client.NetworkingV1Api()

# ---------------------------------------------------------------------------
# 41 Chaos Experiment Registry
# ---------------------------------------------------------------------------
EXPERIMENTS = [
    # -- Application Layer (1-10) --
    {
        "id": 1, "layer": "Application",
        "name": "N+1 Query Storm",
        "service": "product", "method": "GET",
        "endpoint": "/products/inefficient",
        "description": "Triggers N+1 queries by fetching each product individually instead of batch loading, overwhelming the DB with hundreds of queries.",
        "impact": "High CPU on DB, response time spike on Product Service."
    },
    {
        "id": 2, "layer": "Application",
        "name": "CPU Spike (Prime Sieve)",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/cpu-spike",
        "stop_endpoint": "/simulate/cpu-spike/stop",
        "description": "Runs a compute-intensive prime number sieve using setImmediate loop, saturating the Node.js event loop.",
        "impact": "Order Service becomes unresponsive, all requests queue up."
    },
    {
        "id": 3, "layer": "Application",
        "name": "Random 500 Errors",
        "service": "payment", "method": "POST",
        "endpoint": "/simulate/random-500",
        "stop_endpoint": "/simulate/random-500/stop",
        "description": "Enables a middleware that randomly returns HTTP 500 for ~50% of payment requests.",
        "impact": "Payment failures cascade to Order Service, partial order failures."
    },
    {
        "id": 4, "layer": "Application",
        "name": "Brute-Force Login",
        "service": "auth", "method": "POST",
        "endpoint": "/simulate/brute-force",
        "stop_endpoint": "/simulate/brute-force/stop",
        "description": "Fires 200 rapid-fire login attempts at 50ms intervals against the Auth Service.",
        "impact": "Account lockout triggers, Auth Service thread pool saturation."
    },
    {
        "id": 5, "layer": "Application",
        "name": "Thread Pool Exhaustion",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/thread-exhaustion",
        "stop_endpoint": "/simulate/thread-exhaustion/stop",
        "description": "Creates multiple long-running threads that hold resources, exhausting the Tomcat thread pool.",
        "impact": "Product Service stops accepting new requests, gateway timeouts."
    },
    {
        "id": 6, "layer": "Application",
        "name": "Exception Storm",
        "service": "auth", "method": "POST",
        "endpoint": "/simulate/exception-storm",
        "stop_endpoint": "/simulate/exception-storm/stop",
        "description": "Enables a flag causing 60% of Auth Service requests to throw unhandled exceptions.",
        "impact": "Auth validation failures, users randomly logged out, error log flood."
    },
    {
        "id": 7, "layer": "Application",
        "name": "Payload Bloat (10MB)",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/payload-bloat",
        "stop_endpoint": "/simulate/payload-bloat/stop",
        "description": "Returns a massively inflated product response (~10MB) with embedded base64 data.",
        "impact": "Network bandwidth saturation, client-side parsing failures, high memory on Storefront."
    },
    {
        "id": 8, "layer": "Application",
        "name": "Queue Backup",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/queue-backup",
        "stop_endpoint": "/simulate/queue-backup/stop",
        "description": "Adds a 10-second artificial delay to all order processing, simulating a message queue backup.",
        "impact": "All checkout flows slow to a crawl, user-visible latency."
    },
    {
        "id": 9, "layer": "Application",
        "name": "Infinite Retry Loop",
        "service": "storefront", "method": "POST",
        "endpoint": "/simulate/infinite-retry",
        "description": "Storefront enters an infinite retry loop against a failing downstream endpoint with configurable delay.",
        "impact": "Storefront worker processes consumed, PHP-FPM pool exhaustion."
    },
    {
        "id": 10, "layer": "Application",
        "name": "Large Upload DoS",
        "service": "payment", "method": "POST",
        "endpoint": "/simulate/large-upload",
        "description": "Generates and processes a 100MB payload blob, consuming memory and I/O.",
        "impact": "Payment Service memory spike, potential OOM, disk I/O saturation."
    },

    # -- Database Layer (11-20) --
    {
        "id": 11, "layer": "Database",
        "name": "Slow Query (SLEEP 10s)",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/slow-query",
        "description": "Executes MySQL SLEEP(10) wrapped in a product query, holding a DB connection for 10 seconds.",
        "impact": "Connection pool starvation, other queries queue, cascade to all product reads."
    },
    {
        "id": 12, "layer": "Database",
        "name": "MySQL Deadlock",
        "service": "search", "method": "POST",
        "endpoint": "/simulate/deadlock",
        "description": "Creates two goroutines that lock rows in opposite order (product 1->2 vs 2->1), guaranteed deadlock.",
        "impact": "Search queries fail, MySQL error logs spike, autocomplete breaks."
    },
    {
        "id": 13, "layer": "Database",
        "name": "Connection Pool Exhaust",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/db-pool-exhaust",
        "description": "Opens 20 connections each running SLEEP(60), exhausting the MySQL connection pool.",
        "impact": "All Order Service DB queries fail with no connections available."
    },
    {
        "id": 14, "layer": "Database",
        "name": "Full Table Scan",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/full-table-scan",
        "description": "Runs SELECT * without WHERE or indexes, forcing MySQL to scan all ~929 product rows repeatedly.",
        "impact": "High DB CPU, I/O spike, slow response times across Product Service."
    },
    {
        "id": 15, "layer": "Database",
        "name": "Lock Timeout (30s)",
        "service": "search", "method": "POST",
        "endpoint": "/simulate/lock-timeout",
        "description": "Acquires a SELECT FOR UPDATE lock and holds it for 30 seconds, blocking all search log writes.",
        "impact": "Search logging times out, trending searches stale, autocomplete degrades."
    },
    {
        "id": 16, "layer": "Database",
        "name": "Bulk Insert Storm",
        "service": "payment", "method": "POST",
        "endpoint": "/simulate/bulk-insert",
        "description": "Inserts 5,000 dummy transaction records in rapid succession, hammering db_payment.",
        "impact": "Write I/O spike, InnoDB buffer pool pressure, replication lag (if applicable)."
    },
    {
        "id": 17, "layer": "Database",
        "name": "Connection Leak",
        "service": "auth", "method": "POST",
        "endpoint": "/simulate/connection-leak",
        "stop_endpoint": "/simulate/connection-leak/stop",
        "description": "Opens 50 raw DB connections without closing them, leaking until MySQL max_connections is hit.",
        "impact": "Auth Service DB failures, cascading auth validation failures across all services."
    },
    {
        "id": 18, "layer": "Database",
        "name": "Charset Mismatch",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/charset-mismatch",
        "description": "Inserts data with Latin1 encoding into a UTF-8 column, causing mojibake and comparison failures.",
        "impact": "Search results broken, product names display garbled characters."
    },
    {
        "id": 19, "layer": "Database",
        "name": "Long-Running Transaction",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/long-transaction",
        "description": "Starts a transaction with SELECT FOR UPDATE, holds lock for 30 seconds, blocking all order writes.",
        "impact": "All new orders fail, InnoDB lock wait timeouts, cascading checkout failures."
    },
    {
        "id": 20, "layer": "Database",
        "name": "Redis Memory Exhaustion",
        "service": "self", "method": "POST",
        "endpoint": "/simulate/redis-memory-exhaust",
        "description": "Floods Redis with 100,000 large keys (~100 bytes each) to exhaust configured memory limits.",
        "impact": "Redis evictions, cache misses spike, product and cart data lost."
    },

    # -- Infrastructure Layer (21-31) --
    {
        "id": 21, "layer": "Infrastructure",
        "name": "Out of Memory (OOM)",
        "service": "storefront", "method": "POST",
        "endpoint": "/simulate/oom",
        "description": "Allocates 256MB of memory (str_repeat) in PHP, pushing the process past memory_limit.",
        "impact": "PHP worker killed by OOM, 502 errors, Apache worker respawn."
    },
    {
        "id": 22, "layer": "Infrastructure",
        "name": "Redis Timeout",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/redis-timeout",
        "stop_endpoint": "/simulate/redis-timeout/stop",
        "description": "Switches Redis client to use 1ms timeout, causing all Redis operations to timeout.",
        "impact": "Cart operations fail, session data unavailable, order flow broken."
    },
    {
        "id": 23, "layer": "Infrastructure",
        "name": "Log Flood (1000 lines/sec)",
        "service": "payment", "method": "POST",
        "endpoint": "/simulate/log-flood",
        "stop_endpoint": "/simulate/log-flood/stop",
        "description": "Spawns a daemon thread writing ~1,000 log lines per second with stack traces.",
        "impact": "Disk usage spike, log rotation failures, monitoring noise."
    },
    {
        "id": 24, "layer": "Infrastructure",
        "name": "DNS Resolution Failure",
        "service": "storefront", "method": "POST",
        "endpoint": "/simulate/dns-failure",
        "description": "Attempts HTTP connections to 3 non-existent hostnames, simulating DNS infrastructure failure.",
        "impact": "All downstream service calls fail, Storefront shows error pages."
    },
    {
        "id": 25, "layer": "Infrastructure",
        "name": "File Descriptor Exhaustion",
        "service": "search", "method": "POST",
        "endpoint": "/simulate/fd-exhaust",
        "stop_endpoint": "/simulate/fd-exhaust/stop",
        "description": "Opens 5,000 file descriptors to /dev/null without closing, hitting the process ulimit.",
        "impact": "Search Service cannot open new connections or files, cascading failures."
    },
    {
        "id": 26, "layer": "Infrastructure",
        "name": "Goroutine Leak",
        "service": "search", "method": "POST",
        "endpoint": "/simulate/goroutine-leak",
        "stop_endpoint": "/simulate/goroutine-leak/stop",
        "description": "Spawns 500 goroutines blocked on a channel that never receives, leaking memory and scheduler time.",
        "impact": "Go runtime overhead increases, GC pressure, eventual OOM."
    },
    {
        "id": 27, "layer": "Infrastructure",
        "name": "Network Latency Injection",
        "service": "auth", "method": "POST",
        "endpoint": "/simulate/network-latency",
        "stop_endpoint": "/simulate/network-latency/stop",
        "description": "Adds configurable milliseconds of artificial delay to every Auth Service response.",
        "impact": "All services calling auth/validate experience slowdown, timeout cascades."
    },
    {
        "id": 28, "layer": "Infrastructure",
        "name": "SSL/TLS Handshake Error",
        "service": "storefront", "method": "POST",
        "endpoint": "/simulate/ssl-error",
        "description": "Attempts HTTPS connections to badssl.com test endpoints with strict certificate verification.",
        "impact": "TLS handshake failures, connection refused errors, security alerts."
    },
    {
        "id": 29, "layer": "Infrastructure",
        "name": "Zombie Threads",
        "service": "product", "method": "POST",
        "endpoint": "/simulate/zombie-threads",
        "stop_endpoint": "/simulate/zombie-threads/stop",
        "description": "Creates threads that acquire locks and then sleep indefinitely, becoming zombies that hold resources.",
        "impact": "Thread count climbs, JVM resource leak, eventual thread pool starvation."
    },
    {
        "id": 30, "layer": "Infrastructure",
        "name": "CrashLoopBackOff",
        "service": "order", "method": "POST",
        "endpoint": "/simulate/crash-loop",
        "description": "Calls process.exit(1), crashing the Node.js process. Container orchestrator restarts it.",
        "impact": "Service unavailable during restart, in-flight requests lost, K8s restart counter climbs."
    },
    {
        "id": 31, "layer": "Database",
        "name": "Temp Tables Storm",
        "service": "search", "method": "POST",
        "endpoint": "/simulate/temp-tables",
        "description": "Creates 50 temporary tables with cross-join queries, stressing MySQL tmp_table_size and disk I/O.",
        "impact": "MySQL temp table space exhaustion, slow queries, disk I/O spikes on search DB."
    },

    # -- Kubernetes Layer (32-41) --
    {
        "id": 32, "layer": "Kubernetes",
        "name": "Pod Kill Loop",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/pod-kill-loop",
        "k8s_action": "pod_kill_loop",
        "description": "Continuously deletes random pods across all services every 15 seconds, triggering K8s self-healing restarts.",
        "impact": "Random service disruptions, CrashLoopBackOff events, request failures during pod restarts."
    },
    {
        "id": 33, "layer": "Kubernetes",
        "name": "Deployment Scale-to-Zero",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/scale-to-zero",
        "k8s_action": "scale_to_zero",
        "description": "Scales the Product Service deployment to 0 replicas, simulating a complete service outage.",
        "impact": "Product Service completely unavailable, Storefront product pages fail, cascading timeouts."
    },
    {
        "id": 34, "layer": "Kubernetes",
        "name": "Network Policy Blackhole",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/network-blackhole",
        "k8s_action": "network_blackhole",
        "description": "Applies a deny-all NetworkPolicy to Payment Service, blocking all ingress traffic at the network level.",
        "impact": "All payment requests fail, checkout flow broken, order confirmations stuck."
    },
    {
        "id": 35, "layer": "Kubernetes",
        "name": "ConfigMap Corruption",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/configmap-corrupt",
        "k8s_action": "configmap_corrupt",
        "description": "Overwrites the DB_HOST value in the shared ConfigMap with a non-existent hostname.",
        "impact": "Services that restart will fail to connect to MySQL. Existing pods unaffected until restart."
    },
    {
        "id": 36, "layer": "Kubernetes",
        "name": "Resource Limit Squeeze",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/resource-squeeze",
        "k8s_action": "resource_squeeze",
        "description": "Patches Search Service deployment with 10Mi memory limit, causing immediate OOMKilled restarts.",
        "impact": "Search Service in CrashLoopBackOff with OOMKilled status, autocomplete and search broken."
    },
    {
        "id": 37, "layer": "Kubernetes",
        "name": "Service Selector Mismatch",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/selector-mismatch",
        "k8s_action": "selector_mismatch",
        "description": "Patches the Auth Service K8s Service to use a non-matching label selector, orphaning all running pods.",
        "impact": "Auth endpoints unreachable, JWT validation fails everywhere, all authenticated requests fail."
    },
    {
        "id": 38, "layer": "Kubernetes",
        "name": "Rolling Restart Storm",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/restart-storm",
        "k8s_action": "restart_storm",
        "description": "Triggers continuous rolling restarts on Order Service every 20 seconds by patching pod annotations.",
        "impact": "Order Service perpetually restarting, in-flight orders lost, checkout permanently degraded."
    },
    {
        "id": 39, "layer": "Kubernetes",
        "name": "Liveness Probe Sabotage",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/liveness-sabotage",
        "k8s_action": "liveness_sabotage",
        "description": "Patches Storefront liveness probe to check a non-existent path, causing K8s to kill the container repeatedly.",
        "impact": "Storefront enters CrashLoopBackOff, frontend completely unavailable to users."
    },
    {
        "id": 40, "layer": "Kubernetes",
        "name": "Namespace ResourceQuota",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/resource-quota",
        "k8s_action": "resource_quota",
        "description": "Applies a very restrictive ResourceQuota (100Mi memory, 5 pods max) to the zylkerkart namespace.",
        "impact": "New pods cannot be scheduled, scaling and restarts fail, cluster self-healing blocked."
    },
    {
        "id": 41, "layer": "Kubernetes",
        "name": "Image Tag Corruption",
        "service": "kubernetes", "method": "POST",
        "endpoint": "/k8s/image-corrupt",
        "k8s_action": "image_corrupt",
        "description": "Patches Order Service deployment to use a non-existent image tag, triggering ImagePullBackOff.",
        "impact": "Order Service pods stuck in ImagePullBackOff, orders completely unavailable."
    },
]

# ---------------------------------------------------------------------------
# Redis State Helpers
# ---------------------------------------------------------------------------
def _state_key(exp_id):
    return f"chaos:experiment:{exp_id}"

def get_experiment_state(exp_id):
    raw = redis_client.get(_state_key(exp_id))
    if raw:
        return json.loads(raw)
    return {"status": "idle", "started_at": None, "result": None}

def set_experiment_state(exp_id, status, result=None):
    state = {
        "status": status,
        "started_at": time.time() if status == "running" else None,
        "result": result,
    }
    redis_client.setex(_state_key(exp_id), REDIS_TTL, json.dumps(state))

# ---------------------------------------------------------------------------
# Chaos Scenario #20 - Redis Memory Exhaustion (self-hosted)
# ---------------------------------------------------------------------------
_redis_flood_stop = threading.Event()

def _redis_flood_worker():
    count = 0
    try:
        pipe = redis_client.pipeline(transaction=False)
        for i in range(100_000):
            if _redis_flood_stop.is_set():
                break
            pipe.setex(f"chaos:flood:{i}", 300, "X" * 100)
            count += 1
            if count % 1000 == 0:
                pipe.execute()
                pipe = redis_client.pipeline(transaction=False)
        pipe.execute()
    except Exception as e:
        app.logger.error(f"Redis flood error: {e}")

# ---------------------------------------------------------------------------
# Kubernetes Chaos Handlers (32-41)
# ---------------------------------------------------------------------------
_k8s_stops   = {}
_k8s_restore = {}

def _start_pod_kill(exp_id):
    stop = threading.Event()
    _k8s_stops[exp_id] = stop
    def worker():
        targets = ["product-service", "order-service", "search-service",
                    "payment-service", "auth-service", "storefront"]
        while not stop.is_set():
            try:
                v1 = _k8s_core()
                target = random.choice(targets)
                pods = v1.list_namespaced_pod(K8S_NAMESPACE, label_selector=f"app={target}")
                if pods.items:
                    pod = random.choice(pods.items)
                    v1.delete_namespaced_pod(pod.metadata.name, K8S_NAMESPACE)
                    app.logger.info(f"[Chaos #32] Killed pod {pod.metadata.name}")
            except Exception as e:
                app.logger.error(f"[Chaos #32] {e}")
            stop.wait(15)
    threading.Thread(target=worker, daemon=True).start()

def _stop_pod_kill(exp_id):
    stop = _k8s_stops.pop(exp_id, None)
    if stop:
        stop.set()

def _start_scale_zero(exp_id):
    apps_api = _k8s_apps()
    target = "product-service"
    dep = apps_api.read_namespaced_deployment(target, K8S_NAMESPACE)
    _k8s_restore[exp_id] = {"target": target, "replicas": dep.spec.replicas or 1}
    apps_api.patch_namespaced_deployment(target, K8S_NAMESPACE, {"spec": {"replicas": 0}})

def _stop_scale_zero(exp_id):
    apps_api = _k8s_apps()
    data = _k8s_restore.pop(exp_id, {"target": "product-service", "replicas": 1})
    apps_api.patch_namespaced_deployment(data["target"], K8S_NAMESPACE,
                                         {"spec": {"replicas": data["replicas"]}})

def _start_network_blackhole(exp_id):
    net = _k8s_networking()
    body = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "chaos-deny-payment", "namespace": K8S_NAMESPACE},
        "spec": {
            "podSelector": {"matchLabels": {"app": "payment-service"}},
            "policyTypes": ["Ingress"],
            "ingress": []
        }
    }
    net.create_namespaced_network_policy(K8S_NAMESPACE, body)

def _stop_network_blackhole(exp_id):
    try:
        _k8s_networking().delete_namespaced_network_policy("chaos-deny-payment", K8S_NAMESPACE)
    except Exception:
        pass

def _start_configmap_corrupt(exp_id):
    v1 = _k8s_core()
    cm = v1.read_namespaced_config_map("zylkerkart-config", K8S_NAMESPACE)
    _k8s_restore[exp_id] = {"key": "DB_HOST", "value": cm.data.get("DB_HOST", "mysql")}
    v1.patch_namespaced_config_map("zylkerkart-config", K8S_NAMESPACE,
                                   {"data": {"DB_HOST": "chaos-corrupted-host"}})

def _stop_configmap_corrupt(exp_id):
    v1 = _k8s_core()
    data = _k8s_restore.pop(exp_id, {"key": "DB_HOST", "value": "mysql"})
    v1.patch_namespaced_config_map("zylkerkart-config", K8S_NAMESPACE,
                                   {"data": {data["key"]: data["value"]}})

def _start_resource_squeeze(exp_id):
    apps_api = _k8s_apps()
    target = "search-service"
    dep = apps_api.read_namespaced_deployment(target, K8S_NAMESPACE)
    c = dep.spec.template.spec.containers[0]
    _k8s_restore[exp_id] = {
        "target": target,
        "limits": dict(c.resources.limits) if c.resources and c.resources.limits else {},
        "requests": dict(c.resources.requests) if c.resources and c.resources.requests else {},
    }
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": target,
            "resources": {
                "limits": {"memory": "10Mi", "cpu": "10m"},
                "requests": {"memory": "5Mi", "cpu": "5m"}
            }
        }]}}}
    }
    apps_api.patch_namespaced_deployment(target, K8S_NAMESPACE, patch)

def _stop_resource_squeeze(exp_id):
    apps_api = _k8s_apps()
    data = _k8s_restore.pop(exp_id, {
        "target": "search-service",
        "limits": {"memory": "320Mi", "cpu": "200m"},
        "requests": {"memory": "96Mi", "cpu": "50m"}
    })
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": data["target"],
            "resources": {"limits": data["limits"], "requests": data["requests"]}
        }]}}}
    }
    apps_api.patch_namespaced_deployment(data["target"], K8S_NAMESPACE, patch)

def _start_selector_mismatch(exp_id):
    v1 = _k8s_core()
    svc = v1.read_namespaced_service("auth-service", K8S_NAMESPACE)
    _k8s_restore[exp_id] = {"selector": dict(svc.spec.selector)}
    v1.patch_namespaced_service("auth-service", K8S_NAMESPACE,
                                {"spec": {"selector": {"app": "chaos-orphaned-label"}}})

def _stop_selector_mismatch(exp_id):
    v1 = _k8s_core()
    data = _k8s_restore.pop(exp_id, {"selector": {"app": "auth-service"}})
    v1.patch_namespaced_service("auth-service", K8S_NAMESPACE,
                                {"spec": {"selector": data["selector"]}})

def _start_restart_storm(exp_id):
    stop = threading.Event()
    _k8s_stops[exp_id] = stop
    def worker():
        target = "order-service"
        while not stop.is_set():
            try:
                apps_api = _k8s_apps()
                patch = {
                    "spec": {"template": {"metadata": {"annotations": {
                        "chaos.zylkerkart.io/restartedAt": str(time.time())
                    }}}}
                }
                apps_api.patch_namespaced_deployment(target, K8S_NAMESPACE, patch)
            except Exception as e:
                app.logger.error(f"[Chaos #38] {e}")
            stop.wait(20)
    threading.Thread(target=worker, daemon=True).start()

def _stop_restart_storm(exp_id):
    stop = _k8s_stops.pop(exp_id, None)
    if stop:
        stop.set()

def _start_liveness_sabotage(exp_id):
    apps_api = _k8s_apps()
    target = "storefront"
    dep = apps_api.read_namespaced_deployment(target, K8S_NAMESPACE)
    c = dep.spec.template.spec.containers[0]
    original = None
    if c.liveness_probe and c.liveness_probe.http_get:
        original = {
            "path": c.liveness_probe.http_get.path,
            "port": c.liveness_probe.http_get.port,
            "initialDelaySeconds": c.liveness_probe.initial_delay_seconds or 5,
            "periodSeconds": c.liveness_probe.period_seconds or 20,
        }
    _k8s_restore[exp_id] = {"target": target, "probe": original}
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": target,
            "livenessProbe": {
                "httpGet": {"path": "/chaos-nonexistent-health", "port": 80},
                "initialDelaySeconds": 5, "periodSeconds": 5, "failureThreshold": 1
            }
        }]}}}
    }
    apps_api.patch_namespaced_deployment(target, K8S_NAMESPACE, patch)

def _stop_liveness_sabotage(exp_id):
    apps_api = _k8s_apps()
    data = _k8s_restore.pop(exp_id, {
        "target": "storefront",
        "probe": {"path": "/health", "port": 80, "initialDelaySeconds": 5, "periodSeconds": 20}
    })
    probe = data.get("probe") or {"path": "/health", "port": 80, "initialDelaySeconds": 5, "periodSeconds": 20}
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": data["target"],
            "livenessProbe": {
                "httpGet": {"path": probe["path"], "port": probe["port"]},
                "initialDelaySeconds": probe["initialDelaySeconds"],
                "periodSeconds": probe["periodSeconds"]
            }
        }]}}}
    }
    apps_api.patch_namespaced_deployment(data["target"], K8S_NAMESPACE, patch)

def _start_resource_quota(exp_id):
    v1 = _k8s_core()
    body = {
        "apiVersion": "v1",
        "kind": "ResourceQuota",
        "metadata": {"name": "chaos-restrictive-quota", "namespace": K8S_NAMESPACE},
        "spec": {"hard": {"requests.memory": "100Mi", "limits.memory": "200Mi", "pods": "5"}}
    }
    v1.create_namespaced_resource_quota(K8S_NAMESPACE, body)

def _stop_resource_quota(exp_id):
    try:
        _k8s_core().delete_namespaced_resource_quota("chaos-restrictive-quota", K8S_NAMESPACE)
    except Exception:
        pass

def _start_image_corrupt(exp_id):
    apps_api = _k8s_apps()
    target = "order-service"
    dep = apps_api.read_namespaced_deployment(target, K8S_NAMESPACE)
    _k8s_restore[exp_id] = {"target": target, "image": dep.spec.template.spec.containers[0].image}
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": target,
            "image": "zylkerkart/order-service:chaos-nonexistent-v999"
        }]}}}
    }
    apps_api.patch_namespaced_deployment(target, K8S_NAMESPACE, patch)

def _stop_image_corrupt(exp_id):
    apps_api = _k8s_apps()
    data = _k8s_restore.pop(exp_id, {"target": "order-service", "image": "zylkerkart/order-service:latest"})
    patch = {
        "spec": {"template": {"spec": {"containers": [{
            "name": data["target"],
            "image": data["image"]
        }]}}}
    }
    apps_api.patch_namespaced_deployment(data["target"], K8S_NAMESPACE, patch)

_K8S_START = {
    "pod_kill_loop": _start_pod_kill,
    "scale_to_zero": _start_scale_zero,
    "network_blackhole": _start_network_blackhole,
    "configmap_corrupt": _start_configmap_corrupt,
    "resource_squeeze": _start_resource_squeeze,
    "selector_mismatch": _start_selector_mismatch,
    "restart_storm": _start_restart_storm,
    "liveness_sabotage": _start_liveness_sabotage,
    "resource_quota": _start_resource_quota,
    "image_corrupt": _start_image_corrupt,
}
_K8S_STOP = {
    "pod_kill_loop": _stop_pod_kill,
    "scale_to_zero": _stop_scale_zero,
    "network_blackhole": _stop_network_blackhole,
    "configmap_corrupt": _stop_configmap_corrupt,
    "resource_squeeze": _stop_resource_squeeze,
    "selector_mismatch": _stop_selector_mismatch,
    "restart_storm": _stop_restart_storm,
    "liveness_sabotage": _stop_liveness_sabotage,
    "resource_quota": _stop_resource_quota,
    "image_corrupt": _stop_image_corrupt,
}

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    states = {}
    for exp in EXPERIMENTS:
        states[exp["id"]] = get_experiment_state(exp["id"])
    return render_template("index.html", experiments=EXPERIMENTS, states=states)

@app.route("/health")
def health():
    try:
        redis_client.ping()
        return jsonify({"status": "UP", "service": "chaos-dashboard"}), 200
    except Exception:
        return jsonify({"status": "DEGRADED", "service": "chaos-dashboard"}), 200

@app.route("/api/experiments")
def list_experiments():
    states = {}
    for exp in EXPERIMENTS:
        states[exp["id"]] = get_experiment_state(exp["id"])
    return jsonify({"experiments": EXPERIMENTS, "states": states})

@app.route("/api/experiments/<int:exp_id>/execute", methods=["POST"])
def execute_experiment(exp_id):
    exp = next((e for e in EXPERIMENTS if e["id"] == exp_id), None)
    if not exp:
        return jsonify({"error": "Experiment not found"}), 404

    set_experiment_state(exp_id, "running")

    # Kubernetes chaos
    if exp.get("k8s_action"):
        action = exp["k8s_action"]
        try:
            _K8S_START[action](exp_id)
            set_experiment_state(exp_id, "running", f"K8s chaos active: {exp['name']}")
            return jsonify({"status": "running", "message": f"{exp['name']} started"})
        except Exception as e:
            set_experiment_state(exp_id, "error", str(e)[:500])
            return jsonify({"status": "error", "message": str(e)}), 500

    # Self-hosted: Redis Memory Exhaustion (#20)
    if exp["service"] == "self":
        if exp_id == 20:
            _redis_flood_stop.clear()
            t = threading.Thread(target=_redis_flood_worker, daemon=True)
            t.start()
            set_experiment_state(exp_id, "running", "Flooding Redis with 100k keys...")
            return jsonify({"status": "running", "message": "Redis flood started"})
        return jsonify({"error": "Unknown self-hosted experiment"}), 400

    # Remote service call
    url = SERVICE_URLS.get(exp["service"], "") + exp["endpoint"]
    body = request.get_json(silent=True) or {}

    try:
        if exp["method"] == "POST":
            resp = requests.post(url, json=body, timeout=30)
        else:
            resp = requests.get(url, timeout=30)
        result = {"status_code": resp.status_code, "body": resp.text[:2000]}

        if exp.get("stop_endpoint") and resp.status_code < 500:
            final_status = "running"
        else:
            final_status = "completed" if resp.status_code < 500 else "error"

        set_experiment_state(exp_id, final_status, result)
        return jsonify({"status": final_status, "result": result})
    except requests.exceptions.Timeout:
        set_experiment_state(exp_id, "timeout", "Request timed out after 30s")
        return jsonify({"status": "timeout", "message": "Request timed out"}), 504
    except requests.exceptions.ConnectionError as e:
        set_experiment_state(exp_id, "error", str(e)[:500])
        return jsonify({"status": "error", "message": f"Connection failed: {e}"}), 502
    except Exception as e:
        set_experiment_state(exp_id, "error", str(e)[:500])
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/experiments/<int:exp_id>/stop", methods=["POST"])
def stop_experiment(exp_id):
    exp = next((e for e in EXPERIMENTS if e["id"] == exp_id), None)

    if exp_id == 20:
        _redis_flood_stop.set()
        try:
            keys = redis_client.keys("chaos:flood:*")
            if keys:
                redis_client.delete(*keys[:10000])
        except Exception:
            pass
    elif exp and exp.get("k8s_action"):
        try:
            _K8S_STOP[exp["k8s_action"]](exp_id)
        except Exception as e:
            app.logger.error(f"K8s stop error for #{exp_id}: {e}")
    elif exp and exp.get("stop_endpoint"):
        url = SERVICE_URLS.get(exp["service"], "") + exp["stop_endpoint"]
        try:
            requests.post(url, timeout=10)
        except Exception as e:
            app.logger.warning(f"Remote stop failed for #{exp_id}: {e}")

    set_experiment_state(exp_id, "idle")
    return jsonify({"status": "stopped"})

@app.route("/api/experiments/reset", methods=["POST"])
def reset_all():
    _redis_flood_stop.set()
    for exp in EXPERIMENTS:
        if exp.get("k8s_action"):
            try:
                _K8S_STOP[exp["k8s_action"]](exp["id"])
            except Exception:
                pass
        elif exp.get("stop_endpoint"):
            url = SERVICE_URLS.get(exp["service"], "") + exp["stop_endpoint"]
            try:
                requests.post(url, timeout=5)
            except Exception:
                pass
    for exp in EXPERIMENTS:
        set_experiment_state(exp["id"], "idle")
    try:
        keys = redis_client.keys("chaos:flood:*")
        if keys:
            redis_client.delete(*keys[:50000])
    except Exception:
        pass
    return jsonify({"status": "all_reset"})

@app.route("/simulate/redis-memory-exhaust", methods=["POST"])
def simulate_redis_exhaust():
    _redis_flood_stop.clear()
    t = threading.Thread(target=_redis_flood_worker, daemon=True)
    t.start()
    return jsonify({"status": "running", "message": "Flooding Redis with 100k keys"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8086"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
