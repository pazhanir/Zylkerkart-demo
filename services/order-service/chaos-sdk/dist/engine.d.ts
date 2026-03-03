/**
 * Site24x7 Labs Chaos SDK — ChaosEngine
 *
 * Central orchestrator that manages fault rules, config updates, and
 * coordinates all fault injectors. Equivalent to the Java ChaosEngine
 * and Python ChaosEngine classes.
 *
 * Thread-safety model (Node.js equivalent):
 * - activeRules is a plain array reference, swapped atomically.
 * - In Node.js single-threaded event loop, there's no true concurrency
 *   between request handlers and config updates (both run on the main thread).
 * - We still use copy-on-write pattern for consistency with Java/Python SDKs.
 */
import type { FaultRuleConfig, ChaosSDKOptions } from './models.js';
export type ConfigUpdateListener = (rules: ReadonlyArray<FaultRuleConfig>) => void;
export declare class ChaosEngine {
    private _enabled;
    private readonly _appName;
    private readonly _configDir;
    private readonly _pollIntervalMs;
    private readonly _framework;
    private readonly _frameworkVersion;
    /** Current active (enabled) fault rules — swapped atomically on config update. */
    private _activeRules;
    /** Listeners notified on config changes (used by ResourceFaultInjector). */
    private readonly _configListeners;
    private _configWatcher;
    private _heartbeatWriter;
    private _started;
    constructor(options?: ChaosSDKOptions);
    /**
     * Start the engine: begins config file polling and heartbeat writing.
     * Idempotent — calling start() multiple times is safe.
     */
    start(): void;
    /**
     * Stop the engine: stops config polling and heartbeat writing.
     * Cleans up the heartbeat file.
     */
    stop(): void;
    get enabled(): boolean;
    get appName(): string;
    /**
     * Called by ConfigFileWatcher when the config file changes.
     * Filters to only enabled rules and swaps the active rules reference.
     */
    private _onConfigUpdate;
    /**
     * Register a callback to be notified when active fault rules change.
     * Used by ResourceFaultInjector to trigger resource faults on config changes.
     */
    addConfigUpdateListener(listener: ConfigUpdateListener): void;
    /**
     * Find all active rules matching a fault type prefix and optional URL.
     *
     * @param faultTypePrefix - Prefix to match (e.g. 'http_', 'jdbc_', 'redis_')
     * @param requestUrl - The request URL path to match against rule url_pattern
     * @returns Matching rules (may be empty)
     */
    findMatchingRules(faultTypePrefix: string, requestUrl?: string): ReadonlyArray<FaultRuleConfig>;
    /**
     * Probability check — should this fault rule fire?
     * Uses Math.random() (equivalent to ThreadLocalRandom in Java).
     */
    shouldFire(rule: FaultRuleConfig): boolean;
}
//# sourceMappingURL=engine.d.ts.map