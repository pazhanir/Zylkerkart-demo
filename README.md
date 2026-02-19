# 🛒 ZylkerKart — Polyglot Microservices E-Commerce & Chaos Engineering Platform

ZylkerKart is a full-featured e-commerce platform built with **7 microservices across 6 programming languages**, designed for demonstrating **application performance monitoring (APM)**, **chaos engineering**, and **observability** in distributed systems.

---

## 📋 Table of Contents

- [Application Overview](#-application-overview)
- [Architecture Diagram](#-architecture-diagram)
- [Microservices](#-microservices)
- [Tech Stack](#-tech-stack)
- [Database Schema](#-database-schema)
- [Backend API Contracts](#-backend-api-contracts)
- [Chaos Simulation](#-chaos-simulation)
- [Deployment](#-deployment)
  - [Docker Compose](#-docker-compose)
  - [Kubernetes](#-kubernetes)
- [Site24x7 APM Integration](#-site24x7-apm-integration)
- [TODO](#-todo)

---

## 🏗 Application Overview

ZylkerKart simulates a real-world e-commerce platform where customers can browse products, search with autocomplete, manage a shopping cart, authenticate, place orders, and process payments. It includes a **Chaos Dashboard** with **41 chaos experiments** to test system resilience across application, database, infrastructure, and Kubernetes layers.

### Key Features

- **Product Catalog** — Paginated browsing with categories, filters, and sorting
- **Full-Text Search** — Autocomplete suggestions, trending & recent searches
- **Shopping Cart** — Session-based cart with Redis caching
- **Authentication** — JWT-based auth with refresh tokens, brute-force protection
- **Order Management** — Order creation, tracking, and history
- **Payment Processing** — Mock payment with fraud scoring, refunds
- **Chaos Engineering** — 41 pre-built experiments to simulate real failures
- **APM Monitoring** — Site24x7 APM integration for all services

---

## 🏛 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                        │
│                         (Browser / Mobile)                                  │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STOREFRONT (PHP 8.2 / Laravel 10)                        │
│                          Port: 8080                                         │
│         SSR Pages + API Proxy to Backend Microservices                       │
└───┬──────────┬───────────┬───────────┬───────────┬──────────────────────────┘
    │          │           │           │           │
    ▼          ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Product │ │ Order  │ │Search  │ │Payment │ │  Auth  │
│Service │ │Service │ │Service │ │Service │ │Service │
│        │ │        │ │        │ │        │ │        │
│Java 17 │ │Node 18 │ │Go 1.21 │ │Py 3.11 │ │.NET 8  │
│Spring  │ │Express │ │  Gin   │ │FastAPI │ │ASP.NET │
│ Boot   │ │        │ │        │ │        │ │  Core  │
│:8081   │ │:8082   │ │:8083   │ │:8084   │ │:8085   │
└───┬────┘ └──┬──┬──┘ └──┬──┬──┘ └───┬────┘ └───┬────┘
    │         │  │       │  │        │           │
    │         │  │       │  │        │           │
    ▼         ▼  ▼       ▼  ▼        ▼           ▼
┌─────────────────────┐  ┌──────────────────────────┐
│     MySQL 8.0       │  │       Redis 7.0           │
│     Port: 3306      │  │       Port: 6379          │
│                     │  │                            │
│  ┌─db_product───┐   │  │  • Cart session cache     │
│  ├─db_order─────┤   │  │  • Search suggestions     │
│  ├─db_search────┤   │  │  • Rate limiting          │
│  ├─db_payment───┤   │  │  • Chaos state store      │
│  └─db_auth──────┘   │  │                            │
└─────────────────────┘  └──────────────────────────┘

                    ┌──────────────────────┐
                    │   Chaos Dashboard    │
                    │  Python 3.11 / Flask │
                    │      Port: 8086      │
                    │                      │
                    │  41 Chaos Experiments │
                    │  Real-Time Controls  │
                    └──────────────────────┘
```

---

## 🔧 Microservices

| Service | Language / Framework | Port | Database | Description |
|---------|---------------------|------|----------|-------------|
| **Storefront** | PHP 8.2 / Laravel 10 | 8080 | — | Server-side rendered frontend, proxies API calls to backend services |
| **Product Service** | Java 17 / Spring Boot 3 | 8081 | `db_product` (9 tables) | Product catalog, categories, search, pagination |
| **Order Service** | Node.js 18 / Express | 8082 | `db_order` (3 tables) | Shopping cart (Redis-backed), order creation & tracking |
| **Search Service** | Go 1.21 / Gin | 8083 | `db_search` (1 table) | Autocomplete, trending searches, search logging |
| **Payment Service** | Python 3.11 / FastAPI | 8084 | `db_payment` (1 table) | Payment processing, fraud scoring, refunds |
| **Auth Service** | C# / .NET 8 (ASP.NET Core) | 8085 | `db_auth` (3 tables) | JWT authentication, user registration, token refresh |
| **Chaos Dashboard** | Python 3.11 / Flask 3 | 8086 | Redis | Web UI to trigger and manage 41 chaos experiments |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Laravel Blade (SSR), Bootstrap 5, JavaScript |
| **Backend** | Java (Spring Boot), Node.js (Express), Go (Gin), Python (FastAPI), C# (ASP.NET Core), Python (Flask) |
| **Database** | MySQL 8.0 (5 databases, 17 tables) |
| **Cache** | Redis 7.0 (cart sessions, search cache, chaos state) |
| **Containerization** | Docker, Docker Compose v3.9 |
| **Orchestration** | Kubernetes (Deployments, Services, DaemonSets, Ingress) |
| **APM** | Site24x7 APM Insight (Java, Node.js, Go, Python, .NET, PHP agents) |
| **Monitoring** | Site24x7 Server Agent, MySQL monitoring, Kube State Metrics |

---

## 🗄 Database Schema

### `db_product` — Product Catalog (9 tables)

| Table | Key Columns |
|-------|-------------|
| `category_groups` | id, name |
| `subcategories` | id, name, category_group_id |
| `products` | product_id, title, description, rating, initial_price, discount, final_price, subcategory_id, delivery_options (JSON), product_details (JSON) |
| `product_images` | id, product_id, image_url, image_order |
| `product_specifications` | id, product_id, spec_name, spec_value |
| `product_sizes` | id, product_id, size |
| `product_offers` | id, product_id, offer_name, offer_value |
| `star_ratings` | product_id, star_1 … star_5 |
| `breadcrumbs` | id, product_id, breadcrumb_order, name, url |

### `db_order` — Order Management (3 tables)

| Table | Key Columns |
|-------|-------------|
| `customers` | id, user_id, session_id, name, email, phone |
| `orders` | id, customer_id, user_id, total_amount, status, shipping_address |
| `order_items` | id, order_id, product_id, product_title, quantity, unit_price, size, image_url |

### `db_search` — Search & Autocomplete (1 table)

| Table | Key Columns |
|-------|-------------|
| `search_logs` | id, query, session_id, results_count, created_at |

### `db_payment` — Payment Transactions (1 table)

| Table | Key Columns |
|-------|-------------|
| `transactions` | id, order_id, user_id, amount, currency, method, status, transaction_ref, fraud_score |

### `db_auth` — Authentication (3 tables)

| Table | Key Columns |
|-------|-------------|
| `users` | id, email, password_hash, full_name, phone, is_locked, failed_attempts |
| `refresh_tokens` | id, user_id, token, expires_at, is_revoked |
| `user_activity` | id, user_id, activity_type (login/logout/register/order_placed/payment_success), metadata (JSON) |

---

## 📡 Backend API Contracts

### Product Service — `:8081`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | Paginated product listing (params: `category`, `subcategory`, `search`, `page`, `size`, `sort`) |
| `GET` | `/products/categories` | List all category groups with subcategories |
| `GET` | `/products/{id}` | Get single product detail |
| `GET` | `/products/inefficient` | N+1 query chaos endpoint |
| `GET` | `/health` | Health check |

### Order Service — `:8082`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/cart/add` | Add item to cart (`sessionId`, `productId`, `title`, `price`, `quantity`, `size`, `image`) |
| `GET` | `/cart/:sessionId` | Get cart contents |
| `PUT` | `/cart/:sessionId/item/:productId` | Update item quantity |
| `DELETE` | `/cart/:sessionId/item/:productId` | Remove item from cart |
| `DELETE` | `/cart/:sessionId` | Clear entire cart |
| `POST` | `/orders` | Create order from cart (`sessionId`, `customer`) |
| `GET` | `/orders/user/:userId` | Get orders by user ID |
| `GET` | `/orders/session/:sessionId` | Get orders by session ID |
| `GET` | `/orders/:id` | Get order details |

### Search Service — `:8083`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search/suggestions` | Autocomplete suggestions (params: `q`, `limit=8`) |
| `GET` | `/search/trending` | Trending searches (param: `limit=10`) |
| `GET` | `/search/recent` | Recent searches (params: `session_id`, `limit=5`) |
| `POST` | `/search/log` | Log a search query (`query`, `sessionId`, `resultsCount`) |

### Payment Service — `:8084`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/process` | Process a payment (`order_id`, `user_id`, `amount`, `currency`, `method`) |
| `GET` | `/payments/{transaction_ref}` | Get transaction by reference |
| `GET` | `/payments/order/{order_id}` | Get transactions for an order |
| `POST` | `/payments/refund` | Process a refund (`transaction_ref`, `reason`) |

### Auth Service — `:8085`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new user (`email`, `password`, `fullName`, `phone`, `address`) |
| `POST` | `/auth/login` | Login (`email`, `password`) → returns JWT + refresh token |
| `POST` | `/auth/refresh` | Refresh JWT (`refreshToken`) |
| `GET` | `/auth/validate` | Validate bearer token (Authorization header) |
| `POST` | `/auth/logout` | Logout / revoke refresh token (`refreshToken`) |

### Storefront — `:8080`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Home page |
| `GET` | `/products` | Product listing page |
| `GET` | `/products/{id}` | Product detail page |
| `GET` | `/cart` | Cart page |
| `GET` | `/login` | Login page |
| `POST` | `/login` | Submit login |
| `GET` | `/register` | Registration page |
| `POST` | `/register` | Submit registration |
| `POST` | `/logout` | Logout |
| `GET` | `/checkout` | Checkout page |
| `POST` | `/checkout` | Place order |
| `GET` | `/orders` | Order history page |
| `GET` | `/health` | Health check |

### Chaos Dashboard — `:8086`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard UI |
| `GET` | `/api/experiments` | List all 41 experiments + current state |
| `POST` | `/api/experiments/{id}/execute` | Execute a chaos experiment |
| `POST` | `/api/experiments/{id}/stop` | Stop a chaos experiment |
| `POST` | `/api/experiments/reset` | Reset all experiments to idle |

---

## 💥 Chaos Simulation

ZylkerKart includes **41 chaos experiments** organized across 4 layers, all controllable from the Chaos Dashboard UI at port `8086`.

### Application Layer (Experiments 1–10)

| # | Experiment | Target | Effect |
|---|-----------|--------|--------|
| 1 | N+1 Query Storm | Product Service | Fetches each product individually — hundreds of DB queries |
| 2 | CPU Spike (Prime Sieve) | Order Service | Compute-intensive prime sieve saturates Node.js event loop |
| 3 | Random 500 Errors | Payment Service | ~50% of payment requests return HTTP 500 |
| 4 | Brute-Force Login | Auth Service | 200 rapid-fire login attempts at 50ms intervals |
| 5 | Thread Pool Exhaustion | Product Service | Long-running threads exhaust Tomcat thread pool |
| 6 | Exception Storm | Auth Service | 60% of auth requests throw unhandled exceptions |
| 7 | Payload Bloat (10MB) | Product Service | Returns ~10MB response with embedded base64 data |
| 8 | Queue Backup | Order Service | 10s artificial delay on all order processing |
| 9 | Infinite Retry Loop | Storefront | Storefront enters infinite retry loop, exhausts PHP-FPM pool |
| 10 | Large Upload DoS | Payment Service | Generates/processes 100MB payload blob |

### Database Layer (Experiments 11–20, 31)

| # | Experiment | Target | Effect |
|---|-----------|--------|--------|
| 11 | Slow Query (SLEEP 10s) | Product Service | MySQL SLEEP(10) holding a DB connection |
| 12 | MySQL Deadlock | Search Service | Two goroutines lock rows in opposite order |
| 13 | Connection Pool Exhaust | Order Service | 20 connections × SLEEP(60), exhausts pool |
| 14 | Full Table Scan | Product Service | SELECT * without WHERE/index on all products |
| 15 | Lock Timeout (30s) | Search Service | SELECT FOR UPDATE held, second TX times out |
| 16 | Bulk Insert Storm | Payment Service | Inserts 5,000 dummy transactions rapidly |
| 17 | Connection Leak | Auth Service | Opens 50 raw DB connections without closing |
| 18 | Charset Mismatch | Product Service | Latin1 data into UTF-8 column causing mojibake |
| 19 | Long-Running Transaction | Order Service | Holds row locks for 30s, blocking order writes |
| 20 | Redis Memory Exhaustion | Chaos Dashboard | Floods Redis with 100,000 keys (~100 bytes each) |
| 31 | Temp Tables Storm | Search Service | Creates 50 temp tables with cross-join queries |

### Infrastructure Layer (Experiments 21–30)

| # | Experiment | Target | Effect |
|---|-----------|--------|--------|
| 21 | Out of Memory (OOM) | Storefront | Allocates 256MB in PHP, triggers OOM kill |
| 22 | Redis Timeout | Order Service | Switches Redis to 1ms timeout, all cache ops fail |
| 23 | Log Flood (1000 lines/sec) | Payment Service | Floods stdout/stderr at ~1,000 lines/sec |
| 24 | DNS Resolution Failure | Storefront | HTTP to 3 non-existent hostnames |
| 25 | File Descriptor Exhaustion | Search Service | Opens 500 file descriptors without closing |
| 26 | Goroutine Leak | Search Service | 100 goroutines blocked on channel forever |
| 27 | Network Latency Injection | Auth Service | Configurable artificial delay on all auth responses |
| 28 | SSL/TLS Handshake Error | Storefront | HTTPS to badssl.com with strict cert verification |
| 29 | Zombie Threads | Product Service | Threads acquire locks then sleep indefinitely |
| 30 | CrashLoopBackOff | Order Service | `process.exit(1)` crashes Node.js process |

### Kubernetes Layer (Experiments 32–41)

| # | Experiment | Target | Effect |
|---|-----------|--------|--------|
| 32 | Pod Kill Loop | All Services | Deletes random pods every 15s |
| 33 | Scale-to-Zero | Product Service | Scales deployment to 0 replicas |
| 34 | Network Policy Blackhole | Payment Service | deny-all NetworkPolicy blocks all traffic |
| 35 | ConfigMap Corruption | Shared Config | Overwrites DB_HOST with non-existent hostname |
| 36 | Resource Limit Squeeze | Search Service | Sets 10Mi memory limit → OOMKilled |
| 37 | Service Selector Mismatch | Auth Service | Patches service to non-matching label selector |
| 38 | Rolling Restart Storm | Order Service | Continuous rolling restarts every 20s |
| 39 | Liveness Probe Sabotage | Storefront | Points liveness probe to non-existent path |
| 40 | Namespace ResourceQuota | Namespace | Restrictive quota (100Mi memory, 5 pods max) |
| 41 | Image Tag Corruption | Order Service | Sets non-existent image tag → ImagePullBackOff |

---

## 🚀 Deployment

### Prerequisites

- **Docker** & **Docker Compose** (v2+)
- **kubectl** & a Kubernetes cluster (for K8s deployment)
- **Site24x7 license key** (optional, for APM monitoring)

---

### 🐳 Docker Compose

#### Quick Start (without APM)

```bash
docker compose up --build
```

#### With Site24x7 APM Monitoring

```bash
S247_APM_ENABLED=true S247_LICENSE_KEY=<your_key> docker compose up --build
```

Or create a `.env` file:

```env
S247_APM_ENABLED=true
S247_LICENSE_KEY=your_license_key_here
```

Then run:

```bash
docker compose up --build
```

#### Service URLs (Docker Compose)

| Service | URL |
|---------|-----|
| Storefront | http://localhost:8080 |
| Product Service | http://localhost:8081 |
| Order Service | http://localhost:8082 |
| Search Service | http://localhost:8083 |
| Payment Service | http://localhost:8084 |
| Auth Service | http://localhost:8085 |
| Chaos Dashboard | http://localhost:8086 |
| MySQL | localhost:3306 |
| Redis | localhost:6379 |

#### APM Toggle

The `S247_APM_ENABLED` environment variable controls APM instrumentation:

- **`false` (default)** — Services run normally with zero APM overhead
- **`true`** — APM agents are downloaded, installed, and attached at container startup

Each service is instrumented using language-specific Site24x7 APM agents:

| Service | APM Agent Method |
|---------|-----------------|
| Product Service (Java) | `-javaagent` flag with `apminsight-javaagent.jar` |
| Order Service (Node.js) | `node -r apminsight` preload flag |
| Search Service (Go) | eBPF sidecar container (`s247-go-apm-agent`) |
| Payment Service (Python) | `apminsight-run` wrapper + S247DataExporter |
| Auth Service (.NET) | CoreCLR profiler environment variables |
| Storefront (PHP) | PHP agent extension + S247DataExporter |

---

### ☸ Kubernetes

#### Deploy

Run the deploy script — it will interactively prompt for your Site24x7 license key:

```bash
./scripts/deploy-k8s.sh
```

The script performs 10 sequential steps:

1. **Build Docker images** (prompts: local-only or push to Docker Hub)
2. **Create namespace** (`zylkerkart`)
3. **Apply ConfigMap** (injects Site24x7 key if provided)
4. **Deploy MySQL** (waits for ready)
5. **Deploy Redis** (waits for ready)
6. **Deploy application services** (all 7 microservices, waits for ready)
7. **Apply Ingress** rules
8. **Deploy Site24x7 Go APM DaemonSet** (if key provided)
9. **Deploy Site24x7 Server Agent** DaemonSet (if key provided)
10. **Configure MySQL monitoring** in Site24x7 agent (auto-runs `AgentManager.sh mysql --add_instance`)

#### Access (Kubernetes)

Add to `/etc/hosts`:

```
127.0.0.1  zylkerkart.local chaos.zylkerkart.local
```

| Service | URL |
|---------|-----|
| Storefront | http://zylkerkart.local |
| Chaos Dashboard | http://chaos.zylkerkart.local |

Or port-forward individual services:

```bash
kubectl -n zylkerkart port-forward svc/storefront 8080:80
kubectl -n zylkerkart port-forward svc/product-service 8081:8081
kubectl -n zylkerkart port-forward svc/chaos-dashboard 8086:8086
```

#### K8s Manifests

```
k8s/
├── namespace.yaml         # zylkerkart namespace
├── configmap.yaml         # Shared config (DB, Redis, JWT, S247 key)
├── mysql.yaml             # MySQL Deployment + PVC + Service
├── redis.yaml             # Redis Deployment + Service
├── services.yaml          # All 7 microservice Deployments + Services
├── ingress.yaml           # Ingress rules for storefront & chaos dashboard
├── go-apm-daemonset.yaml  # Site24x7 Go APM eBPF DaemonSet
└── site24x7-agent.yaml    # Site24x7 Server Agent DaemonSet + RBAC + KSM
```

---

## 📊 Site24x7 APM Integration

ZylkerKart integrates with **Site24x7 APM Insight** for application performance monitoring across all microservices.

### Docker Compose

Enable via environment variables:

```bash
S247_APM_ENABLED=true S247_LICENSE_KEY=<your_key> docker compose up
```

### Kubernetes

The deploy script (`deploy-k8s.sh`) handles everything:
- Prompts for the license key at runtime
- Injects it into the ConfigMap and Kubernetes Secret
- Deploys Go APM eBPF DaemonSet for search-service
- Deploys Site24x7 Server Agent DaemonSet with auto MySQL monitoring
- APM agents for Java, Node.js, Python, .NET, and PHP are configured via init containers and environment variables in `services.yaml`

---

## 📝 TODO

### ⏳ In Progress

- [ ] **Chaos Simulation** — Partially completed
  - [x] Application Layer experiments (1–10) — Implemented
  - [x] Database Layer experiments (11–20, 31) — Implemented
  - [x] Infrastructure Layer experiments (21–30) — Implemented
  - [ ] Kubernetes Layer experiments (32–41) — UI defined, backend orchestration in progress

### 🔲 Planned

- [ ] **MySQL Monitoring in Docker Compose** — Add Site24x7 MySQL monitoring for Docker Compose deployment (currently only available in K8s via `AgentManager.sh mysql --add_instance`)
- [ ] **Redis Monitoring in Docker Compose** — Add Site24x7 Redis monitoring plugin for Docker Compose deployment
- [ ] **Redis Monitoring in Kubernetes** — Add Site24x7 Redis monitoring in K8s deployment
- [ ] Load testing scripts (k6)
- [ ] CI/CD pipeline (GitHub Actions)


---

## 📁 Project Structure

```
ZylkerKart/
├── docker-compose.yml          # Docker Compose orchestration (9 services + APM sidecar)
├── README.md
├── db/                         # MySQL initialization
│   ├── Dockerfile
│   ├── 01-schema.sql           # Database schema (5 databases, 17 tables)
│   ├── 02-seed.sh              # Data seeding script
│   ├── product_datasets.csv    # Product seed data
│   └── seed/                   # Python seed loader
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── mysql.yaml
│   ├── redis.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   ├── go-apm-daemonset.yaml
│   └── site24x7-agent.yaml
├── scripts/                    # Deployment scripts
│   ├── build-all.sh            # Build all Docker images (local or push to Hub)
│   ├── deploy-compose.sh       # Docker Compose deployment
│   └── deploy-k8s.sh           # Kubernetes deployment (interactive)
└── services/                   # Microservices source code
    ├── product-service/        # Java 17 / Spring Boot 3
    ├── order-service/          # Node.js 18 / Express
    ├── search-service/         # Go 1.21 / Gin
    ├── payment-service/        # Python 3.11 / FastAPI
    ├── auth-service/           # C# / .NET 8
    ├── storefront/             # PHP 8.2 / Laravel 10
    └── chaos-dashboard/        # Python 3.11 / Flask 3
```

---

## 📄 License

This project is for demonstration and educational purposes.
