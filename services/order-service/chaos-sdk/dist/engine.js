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
import { DEFAULT_CONFIG_DIR, DEFAULT_POLL_INTERVAL_MS } from './models.js';
import { ConfigFileWatcher, HeartbeatWriter } from './config.js';
export class ChaosEngine {
    _enabled;
    _appName;
    _configDir;
    _pollIntervalMs;
    _framework;
    _frameworkVersion;
    /** Current active (enabled) fault rules — swapped atomically on config update. */
    _activeRules = [];
    /** Listeners notified on config changes (used by ResourceFaultInjector). */
    _configListeners = [];
    _configWatcher = null;
    _heartbeatWriter = null;
    _started = false;
    constructor(options = {}) {
        // Resolve enabled: explicit option > env var > default true
        if (options.enabled !== undefined) {
            this._enabled = options.enabled;
        }
        else {
            const envVal = process.env['CHAOS_SDK_ENABLED'];
            this._enabled = envVal !== 'false' && envVal !== '0';
        }
        this._appName = options.appName || process.env['CHAOS_SDK_APP_NAME'] || '';
        this._configDir = options.configDir || process.env['CHAOS_SDK_CONFIG_DIR'] || DEFAULT_CONFIG_DIR;
        this._pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
        this._framework = options.framework || '';
        this._frameworkVersion = options.frameworkVersion || '';
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    /**
     * Start the engine: begins config file polling and heartbeat writing.
     * Idempotent — calling start() multiple times is safe.
     */
    start() {
        if (this._started)
            return;
        if (!this._enabled) {
            console.log('[chaos-sdk] Chaos SDK is disabled');
            return;
        }
        if (!this._appName) {
            console.warn('[chaos-sdk] No app name configured — set appName option or CHAOS_SDK_APP_NAME env var');
            this._enabled = false;
            return;
        }
        console.log(`[chaos-sdk] Starting chaos SDK for "${this._appName}" (config: ${this._configDir})`);
        // Start config file watcher
        this._configWatcher = new ConfigFileWatcher(this._configDir, this._appName, this._pollIntervalMs, (config) => this._onConfigUpdate(config));
        this._configWatcher.start();
        // Start heartbeat writer
        this._heartbeatWriter = new HeartbeatWriter(this._configDir, this._appName, this._framework, this._frameworkVersion);
        this._heartbeatWriter.start();
        this._started = true;
        console.log('[chaos-sdk] Chaos SDK started successfully');
    }
    /**
     * Stop the engine: stops config polling and heartbeat writing.
     * Cleans up the heartbeat file.
     */
    stop() {
        if (!this._started)
            return;
        this._configWatcher?.stop();
        this._heartbeatWriter?.stop();
        this._activeRules = [];
        this._started = false;
        console.log('[chaos-sdk] Chaos SDK stopped');
    }
    get enabled() {
        return this._enabled;
    }
    get appName() {
        return this._appName;
    }
    // ---------------------------------------------------------------------------
    // Config update handling
    // ---------------------------------------------------------------------------
    /**
     * Called by ConfigFileWatcher when the config file changes.
     * Filters to only enabled rules and swaps the active rules reference.
     */
    _onConfigUpdate(config) {
        const enabledRules = config.rules.filter((r) => r.enabled);
        // Atomic reference swap (safe in single-threaded Node.js)
        this._activeRules = Object.freeze([...enabledRules]);
        console.log(`[chaos-sdk] Config updated: ${enabledRules.length} active rules ` +
            `(${config.rules.length} total)`);
        // Notify listeners (ResourceFaultInjector, etc.)
        for (const listener of this._configListeners) {
            try {
                listener(this._activeRules);
            }
            catch (err) {
                console.error('[chaos-sdk] Config listener error:', err);
            }
        }
    }
    /**
     * Register a callback to be notified when active fault rules change.
     * Used by ResourceFaultInjector to trigger resource faults on config changes.
     */
    addConfigUpdateListener(listener) {
        this._configListeners.push(listener);
    }
    // ---------------------------------------------------------------------------
    // Rule matching (used by fault injectors)
    // ---------------------------------------------------------------------------
    /**
     * Find all active rules matching a fault type prefix and optional URL.
     *
     * @param faultTypePrefix - Prefix to match (e.g. 'http_', 'jdbc_', 'redis_')
     * @param requestUrl - The request URL path to match against rule url_pattern
     * @returns Matching rules (may be empty)
     */
    findMatchingRules(faultTypePrefix, requestUrl = '') {
        const rules = this._activeRules;
        if (rules.length === 0)
            return [];
        return rules.filter((rule) => {
            // Must match fault type prefix
            if (!rule.fault_type.startsWith(faultTypePrefix))
                return false;
            // If rule has a URL pattern and we have a request URL, check match
            if (rule.url_pattern && requestUrl) {
                return matchesUrl(requestUrl, rule.url_pattern);
            }
            // No URL pattern means match everything
            return true;
        });
    }
    /**
     * Probability check — should this fault rule fire?
     * Uses Math.random() (equivalent to ThreadLocalRandom in Java).
     */
    shouldFire(rule) {
        if (rule.probability >= 1.0)
            return true;
        if (rule.probability <= 0.0)
            return false;
        return Math.random() < rule.probability;
    }
}
// ---------------------------------------------------------------------------
// URL pattern matching — converts simple glob patterns to regex
// ---------------------------------------------------------------------------
/** Cache compiled regex patterns to avoid re-compilation on every request. */
const _patternCache = new Map();
/**
 * Match a request URL against a glob pattern.
 * Supports:
 *   - `*`  → matches a single path segment (no slashes)
 *   - `**` → matches any number of path segments (including slashes)
 *   - Literal text matches exactly
 *
 * Examples:
 *   /api/products/*  → matches /api/products/123 but not /api/products/123/details
 *   /api/**          → matches /api/anything/at/any/depth
 */
function matchesUrl(url, pattern) {
    let regex = _patternCache.get(pattern);
    if (!regex) {
        // Escape regex special chars, then convert glob patterns
        let regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special chars (NOT * and ?)
            .replace(/\*\*/g, '{{GLOBSTAR}}') // preserve ** before converting *
            .replace(/\*/g, '[^/]*') // * = zero or more chars in one segment
            .replace(/{{GLOBSTAR}}/g, '.*'); // ** = any path segments
        // Ensure full match
        regexStr = `^${regexStr}$`;
        regex = new RegExp(regexStr);
        _patternCache.set(pattern, regex);
    }
    return regex.test(url);
}
//# sourceMappingURL=engine.js.map