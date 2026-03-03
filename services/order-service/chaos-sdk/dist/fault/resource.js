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
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getConfigInt, clamp } from '../models.js';
const RESOURCE_FAULT_TYPES = new Set([
    'thread_pool_exhaustion',
    'memory_pressure',
    'cpu_burn',
    'gc_pressure',
    'thread_deadlock',
    'disk_fill',
]);
// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------
export class ResourceFaultInjector {
    _engine;
    _active = false;
    constructor(engine) {
        this._engine = engine;
    }
    /**
     * Register as a config-update listener on the engine.
     * Call once after the engine is started.
     */
    install() {
        this._engine.addConfigUpdateListener(() => this._onConfigUpdate());
        console.log('[chaos-sdk] ResourceFaultInjector installed');
    }
    // ------------------------------------------------------------------
    // Listener
    // ------------------------------------------------------------------
    _onConfigUpdate() {
        this.evaluateAndApply();
    }
    evaluateAndApply() {
        if (!this._engine.enabled)
            return;
        if (this._active) {
            console.debug('[chaos-sdk] Resource fault already active, skipping');
            return;
        }
        // Find the first matching resource fault rule
        const rules = this._engine.findMatchingRules('');
        const match = rules.find((r) => RESOURCE_FAULT_TYPES.has(r.fault_type) && this._engine.shouldFire(r));
        if (!match)
            return;
        const ft = match.fault_type;
        if (ft === 'thread_pool_exhaustion')
            this._applyThreadPoolExhaustion(match);
        else if (ft === 'memory_pressure')
            this._applyMemoryPressure(match);
        else if (ft === 'cpu_burn')
            this._applyCpuBurn(match);
        else if (ft === 'gc_pressure')
            this._applyGcPressure(match);
        else if (ft === 'thread_deadlock')
            this._applyThreadDeadlock(match);
        else if (ft === 'disk_fill')
            this._applyDiskFill(match);
        else
            console.warn(`[chaos-sdk] Unknown resource fault type: ${ft}`);
    }
    // ------------------------------------------------------------------
    // 1. Thread pool exhaustion — starve the event loop
    // ------------------------------------------------------------------
    _applyThreadPoolExhaustion(rule) {
        const threadCount = clamp(getConfigInt(rule, 'thread_count', 10), 1, 50);
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting thread pool exhaustion: ${threadCount} intervals for ${durationMs}ms`);
        this._active = true;
        const timers = [];
        const endTime = Date.now() + durationMs;
        // Create multiple high-frequency intervals that do synchronous work,
        // effectively starving the event loop.
        for (let i = 0; i < threadCount; i++) {
            const timer = setInterval(() => {
                if (Date.now() >= endTime)
                    return;
                // Do ~5ms of synchronous CPU work per tick
                const stop = Date.now() + 5;
                let x = Math.random();
                while (Date.now() < stop) {
                    x = Math.sin(x) * Math.cos(x);
                }
            }, 1);
            timers.push(timer);
        }
        // Cleanup after duration
        setTimeout(() => {
            for (const t of timers)
                clearInterval(t);
            this._active = false;
            console.log('[chaos-sdk] Thread pool exhaustion fault completed');
        }, durationMs);
    }
    // ------------------------------------------------------------------
    // 2. Memory pressure — allocate and hold Buffers
    // ------------------------------------------------------------------
    _applyMemoryPressure(rule) {
        const allocationMb = clamp(getConfigInt(rule, 'allocation_mb', 64), 1, 512);
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting memory pressure: ${allocationMb}MB for ${durationMs}ms`);
        this._active = true;
        const blocks = [];
        try {
            for (let i = 0; i < allocationMb; i++) {
                const block = Buffer.alloc(1024 * 1024, i & 0xff); // 1MB, touch all pages
                blocks.push(block);
            }
            console.debug(`[chaos-sdk] Memory pressure: allocated ${allocationMb}MB`);
        }
        catch {
            console.warn('[chaos-sdk] Memory pressure: allocation error, holding partial');
        }
        // Hold for duration, then release
        setTimeout(() => {
            blocks.length = 0; // release references
            if (global.gc)
                global.gc(); // hint GC if --expose-gc
            this._active = false;
            console.log('[chaos-sdk] Memory pressure fault completed, memory released');
        }, durationMs);
    }
    // ------------------------------------------------------------------
    // 3. CPU burn — tight math loops
    // ------------------------------------------------------------------
    _applyCpuBurn(rule) {
        const threadCount = clamp(getConfigInt(rule, 'thread_count', 2), 1, 8);
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting CPU burn: ${threadCount} burners for ${durationMs}ms`);
        this._active = true;
        const endTime = Date.now() + durationMs;
        let completed = 0;
        // Use setInterval to simulate multiple CPU burners
        const timers = [];
        for (let i = 0; i < threadCount; i++) {
            const timer = setInterval(() => {
                if (Date.now() >= endTime)
                    return;
                // 10ms of tight math per tick
                const stop = Date.now() + 10;
                let x = Math.random();
                while (Date.now() < stop) {
                    x = Math.sin(x) * Math.cos(x) + Math.sqrt(Math.abs(x));
                }
            }, 0);
            timers.push(timer);
        }
        setTimeout(() => {
            for (const t of timers)
                clearInterval(t);
            completed = threadCount;
            this._active = false;
            console.log(`[chaos-sdk] CPU burn fault completed (${completed} burners)`);
        }, durationMs);
    }
    // ------------------------------------------------------------------
    // 4. GC pressure — rapid short-lived allocations
    // ------------------------------------------------------------------
    _applyGcPressure(rule) {
        const allocRate = clamp(getConfigInt(rule, 'allocation_rate_mb_per_sec', 10), 1, 100);
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting GC pressure: ${allocRate}MB/sec for ${durationMs}ms`);
        this._active = true;
        const endTime = Date.now() + durationMs;
        const intervalMs = Math.max(1, Math.floor(1000 / allocRate));
        const timer = setInterval(() => {
            if (Date.now() >= endTime) {
                clearInterval(timer);
                this._active = false;
                console.log('[chaos-sdk] GC pressure fault completed');
                return;
            }
            // Allocate 1MB — immediately discard so GC must collect
            const garbage = Buffer.alloc(1024 * 1024);
            garbage[0] = 1;
            garbage[garbage.length - 1] = 1;
            // garbage goes out of scope and becomes eligible for GC
        }, intervalMs);
    }
    // ------------------------------------------------------------------
    // 5. Thread deadlock — simulate with blocked promises
    // ------------------------------------------------------------------
    _applyThreadDeadlock(rule) {
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting simulated deadlock for ${durationMs}ms`);
        this._active = true;
        // In Node.js there are no true threads to deadlock.
        // Simulate by creating promises that never resolve and blocking
        // the event loop with periodic sync work.
        const endTime = Date.now() + durationMs;
        const timer = setInterval(() => {
            if (Date.now() >= endTime) {
                clearInterval(timer);
                this._active = false;
                console.log('[chaos-sdk] Simulated deadlock fault completed');
                return;
            }
            // Block event loop for ~20ms per tick to simulate thread starvation
            const stop = Date.now() + 20;
            while (Date.now() < stop) {
                // busy-wait
            }
        }, 50);
    }
    // ------------------------------------------------------------------
    // 6. Disk fill — write temp files
    // ------------------------------------------------------------------
    _applyDiskFill(rule) {
        const allocationMb = clamp(getConfigInt(rule, 'allocation_mb', 64), 1, 512);
        const durationMs = clamp(getConfigInt(rule, 'duration_ms', 30000), 1000, 60000);
        console.log(`[chaos-sdk] Injecting disk fill: ${allocationMb}MB for ${durationMs}ms`);
        this._active = true;
        const tempFiles = [];
        const block = Buffer.alloc(1024 * 1024, 0xaa); // 1 MB
        try {
            for (let i = 0; i < allocationMb; i++) {
                const filePath = join(tmpdir(), `chaos-disk-fill-${i}.tmp`);
                writeFileSync(filePath, block);
                tempFiles.push(filePath);
            }
            console.debug(`[chaos-sdk] Disk fill: wrote ${allocationMb}MB of temp files`);
        }
        catch (err) {
            console.warn('[chaos-sdk] Disk fill: error during writing:', err);
        }
        // Hold for duration, then clean up
        setTimeout(() => {
            for (const fp of tempFiles) {
                try {
                    unlinkSync(fp);
                }
                catch {
                    // ignore
                }
            }
            this._active = false;
            console.log(`[chaos-sdk] Disk fill fault completed, ${tempFiles.length} temp files cleaned up`);
        }, durationMs);
    }
}
//# sourceMappingURL=resource.js.map