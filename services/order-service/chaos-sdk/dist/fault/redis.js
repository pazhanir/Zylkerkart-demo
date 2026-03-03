/**
 * Site24x7 Labs Chaos SDK — Redis Fault Injector
 *
 * Monkey-patches popular Node.js Redis clients:
 * - ioredis: Redis.prototype.sendCommand
 * - redis (node-redis): via command options interception
 *
 * 2 fault types:
 * 1. redis_exception — Throw a mapped connection/reply error.
 * 2. redis_latency   — Delay before the Redis command executes.
 */
import { getConfigString, getConfigInt, resolveException } from '../models.js';
const FAULT_PREFIX = 'redis_';
let _patchedIoredis = false;
let _patchedNodeRedis = false;
// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------
export class RedisFaultInjector {
    _engine;
    constructor(engine) {
        this._engine = engine;
    }
    /**
     * Monkey-patch ioredis and/or node-redis (if available).
     * Call once after the engine is started. Idempotent.
     */
    install() {
        this._patchIoredis();
        this._patchNodeRedis();
    }
    // ------------------------------------------------------------------
    // ioredis monkey-patch
    // ------------------------------------------------------------------
    _patchIoredis() {
        if (_patchedIoredis)
            return;
        let IoRedis;
        try {
            IoRedis = require('ioredis');
        }
        catch {
            return;
        }
        const engine = this._engine;
        const originalSendCommand = IoRedis.prototype.sendCommand;
        IoRedis.prototype.sendCommand = async function patchedSendCommand(...args) {
            await evaluateAndApply(engine);
            return originalSendCommand.apply(this, args);
        };
        _patchedIoredis = true;
        console.log('[chaos-sdk] Monkey-patched ioredis (Redis.prototype.sendCommand)');
    }
    // ------------------------------------------------------------------
    // node-redis monkey-patch
    // ------------------------------------------------------------------
    _patchNodeRedis() {
        if (_patchedNodeRedis)
            return;
        let nodeRedis;
        try {
            nodeRedis = require('redis');
        }
        catch {
            return;
        }
        const engine = this._engine;
        // node-redis v4 uses a builder pattern via createClient().
        // We wrap createClient to intercept the returned client's sendCommand.
        const originalCreateClient = nodeRedis.createClient;
        nodeRedis.createClient = function patchedCreateClient(...args) {
            const client = originalCreateClient.apply(this, args);
            if (typeof client?.sendCommand === 'function') {
                const originalSendCommand = client.sendCommand.bind(client);
                client.sendCommand = async function patchedSendCommand(...cmdArgs) {
                    await evaluateAndApply(engine);
                    return originalSendCommand(...cmdArgs);
                };
            }
            return client;
        };
        _patchedNodeRedis = true;
        console.log('[chaos-sdk] Monkey-patched node-redis (createClient wrapper)');
    }
}
// ---------------------------------------------------------------------------
// Shared evaluation logic
// ---------------------------------------------------------------------------
async function evaluateAndApply(engine) {
    if (!engine.enabled)
        return;
    const rules = engine.findMatchingRules(FAULT_PREFIX);
    for (const rule of rules) {
        if (!engine.shouldFire(rule))
            continue;
        const faultType = rule.fault_type;
        if (faultType === 'redis_exception') {
            const javaClass = getConfigString(rule, 'exception_class', 'RedisConnectionFailureException');
            const message = getConfigString(rule, 'message', 'Injected Redis fault');
            console.debug(`[chaos-sdk] Injecting Redis exception: ${javaClass} - ${message}`);
            throw resolveException(javaClass, message);
        }
        if (faultType === 'redis_latency') {
            const delayMs = getConfigInt(rule, 'delay_ms', 2000);
            console.debug(`[chaos-sdk] Injecting Redis latency: ${delayMs}ms`);
            // Non-blocking async delay — does not block the event loop
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return;
        }
        console.warn(`[chaos-sdk] Unknown Redis fault type: ${faultType}`);
    }
}
//# sourceMappingURL=redis.js.map