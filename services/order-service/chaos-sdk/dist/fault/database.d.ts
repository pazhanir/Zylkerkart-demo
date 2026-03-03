/**
 * Site24x7 Labs Chaos SDK — Database Fault Injector
 *
 * Monkey-patches popular Node.js database clients to inject faults:
 * - pg (node-postgres): Pool.query and Client.query
 * - mysql2: Connection.query and Pool.query
 *
 * 3 fault types:
 * 1. jdbc_exception          — Throw a mapped database error before the query.
 * 2. jdbc_latency            — Delay before the query executes.
 * 3. jdbc_connection_pool_drain — Acquire and hold pool connections.
 */
import type { ChaosEngine } from '../engine.js';
export declare class DatabaseFaultInjector {
    private readonly _engine;
    private _drainActive;
    constructor(engine: ChaosEngine);
    /**
     * Monkey-patch `pg` and `mysql2` (if available).
     * Call once after the engine is started. Idempotent.
     */
    install(): void;
    private _patchPg;
    private _patchMysql2;
    _applyConnectionPoolDrain(holdCount: number, holdDurationMs: number): void;
}
//# sourceMappingURL=database.d.ts.map