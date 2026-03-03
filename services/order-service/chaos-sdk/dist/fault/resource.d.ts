/**
 * Site24x7 Labs Chaos SDK — Resource Fault Injector
 *
 * Unlike HTTP/DB/Redis faults (triggered per-request), resource faults are
 * triggered when the config changes. The injector registers as a
 * config-update listener on the ChaosEngine.
 *
 * 6 fault types:
 * 1. thread_pool_exhaustion — Starve the event loop with setInterval + sync work.
 * 2. memory_pressure        — Allocate Buffers and hold them.
 * 3. cpu_burn               — Tight math loops (via worker_threads if available).
 * 4. gc_pressure            — Rapid short-lived Buffer allocations.
 * 5. thread_deadlock        — Simulate with blocked promises / setTimeout chains.
 * 6. disk_fill              — Write temp files to consume disk space.
 */
import type { ChaosEngine } from '../engine.js';
export declare class ResourceFaultInjector {
    private readonly _engine;
    private _active;
    constructor(engine: ChaosEngine);
    /**
     * Register as a config-update listener on the engine.
     * Call once after the engine is started.
     */
    install(): void;
    private _onConfigUpdate;
    evaluateAndApply(): void;
    private _applyThreadPoolExhaustion;
    private _applyMemoryPressure;
    private _applyCpuBurn;
    private _applyGcPressure;
    private _applyThreadDeadlock;
    private _applyDiskFill;
}
//# sourceMappingURL=resource.d.ts.map