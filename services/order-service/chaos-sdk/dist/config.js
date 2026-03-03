/**
 * Site24x7 Labs Chaos SDK — Config File Watcher & Heartbeat Writer
 *
 * ConfigFileWatcher: polls the fault config JSON file every N ms, re-parses
 * on mtime change, and notifies the engine via a callback.
 *
 * HeartbeatWriter: writes {app_name}.heartbeat.json every 30 s so the agent
 * can discover that this SDK is installed and running.
 *
 * Both use setInterval (Node.js has no daemon threads — timers on the event
 * loop serve the same purpose).
 */
import { readFileSync, statSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hostname } from 'node:os';
import { SDK_VERSION, SDK_LANGUAGE, HEARTBEAT_INTERVAL_MS } from './models.js';
export class ConfigFileWatcher {
    _configPath;
    _pollIntervalMs;
    _listener;
    _lastMtime = 0;
    _timer = null;
    constructor(configDir, appName, pollIntervalMs, listener) {
        this._configPath = join(configDir, `${appName}.json`);
        this._pollIntervalMs = pollIntervalMs;
        this._listener = listener;
    }
    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    start() {
        if (this._timer !== null)
            return;
        // Check immediately on start, then periodically
        this._checkForChanges();
        this._timer = setInterval(() => this._checkForChanges(), this._pollIntervalMs);
        // Unref so the timer doesn't keep the process alive
        this._timer.unref();
        console.log(`[chaos-sdk] ConfigFileWatcher started, watching: ${this._configPath}`);
    }
    stop() {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
        console.log('[chaos-sdk] ConfigFileWatcher stopped');
    }
    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------
    _checkForChanges() {
        // Check if the config file exists and has changed
        let currentMtime;
        try {
            const stat = statSync(this._configPath);
            currentMtime = stat.mtimeMs;
        }
        catch {
            // File doesn't exist — either agent hasn't written it yet,
            // or agent deleted it (all rules removed). If we had rules
            // before, clear them by sending an empty config.
            if (this._lastMtime > 0) {
                this._lastMtime = 0;
                console.log('[chaos-sdk] Config file removed, clearing all rules');
                try {
                    this._listener({
                        version: 0,
                        app_name: '',
                        environment_id: '',
                        updated_at: '',
                        rules: [],
                    });
                }
                catch (err) {
                    console.error('[chaos-sdk] Config update listener error on clear:', err);
                }
            }
            return;
        }
        if (currentMtime <= this._lastMtime)
            return;
        this._lastMtime = currentMtime;
        // Parse the config file
        let config;
        try {
            const content = readFileSync(this._configPath, 'utf-8');
            config = JSON.parse(content);
        }
        catch (err) {
            console.warn(`[chaos-sdk] Failed to parse config file ${this._configPath}:`, err);
            return;
        }
        // Validate minimal structure
        if (!config || !Array.isArray(config.rules)) {
            console.warn(`[chaos-sdk] Invalid config file structure in ${this._configPath}`);
            return;
        }
        console.log(`[chaos-sdk] Config file changed, loaded ${config.rules.length} rules`);
        try {
            this._listener(config);
        }
        catch (err) {
            console.error('[chaos-sdk] Config update listener error:', err);
        }
    }
}
// ---------------------------------------------------------------------------
// HeartbeatWriter
// ---------------------------------------------------------------------------
export class HeartbeatWriter {
    _heartbeatPath;
    _tmpPath;
    _appName;
    _framework;
    _frameworkVersion;
    _timer = null;
    constructor(configDir, appName, framework, frameworkVersion) {
        this._heartbeatPath = join(configDir, `${appName}.heartbeat.json`);
        this._tmpPath = join(configDir, `${appName}.heartbeat.tmp`);
        this._appName = appName;
        this._framework = framework;
        this._frameworkVersion = frameworkVersion;
    }
    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    start() {
        if (this._timer !== null)
            return;
        // Ensure directory exists
        try {
            mkdirSync(dirname(this._heartbeatPath), { recursive: true });
        }
        catch {
            // Directory may already exist or may not be writable — we'll log on first write failure
        }
        // Write immediately on start, then periodically
        this._writeHeartbeat();
        this._timer = setInterval(() => this._writeHeartbeat(), HEARTBEAT_INTERVAL_MS);
        // Unref so the timer doesn't keep the process alive
        this._timer.unref();
        console.log(`[chaos-sdk] HeartbeatWriter started, path: ${this._heartbeatPath}`);
    }
    stop() {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
        // Clean up heartbeat file on shutdown
        try {
            unlinkSync(this._heartbeatPath);
        }
        catch {
            // File may not exist
        }
        console.log('[chaos-sdk] HeartbeatWriter stopped');
    }
    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------
    _writeHeartbeat() {
        const data = {
            app_name: this._appName,
            sdk_version: SDK_VERSION,
            sdk_language: SDK_LANGUAGE,
            framework: this._framework,
            framework_version: this._frameworkVersion,
            pid: process.pid,
            hostname: hostname(),
            timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        };
        try {
            // Atomic write: write to tmp file, then rename
            writeFileSync(this._tmpPath, JSON.stringify(data, null, 2), 'utf-8');
            renameSync(this._tmpPath, this._heartbeatPath);
        }
        catch (err) {
            console.warn('[chaos-sdk] Failed to write heartbeat file:', err);
        }
    }
}
//# sourceMappingURL=config.js.map