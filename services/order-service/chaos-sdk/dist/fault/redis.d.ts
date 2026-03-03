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
import type { ChaosEngine } from '../engine.js';
export declare class RedisFaultInjector {
    private readonly _engine;
    constructor(engine: ChaosEngine);
    /**
     * Monkey-patch ioredis and/or node-redis (if available).
     * Call once after the engine is started. Idempotent.
     */
    install(): void;
    private _patchIoredis;
    private _patchNodeRedis;
}
//# sourceMappingURL=redis.d.ts.map