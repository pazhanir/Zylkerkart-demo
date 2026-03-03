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
import type { AppFaultConfig } from './models.js';
export type ConfigUpdateCallback = (config: AppFaultConfig) => void;
export declare class ConfigFileWatcher {
    private readonly _configPath;
    private readonly _pollIntervalMs;
    private readonly _listener;
    private _lastMtime;
    private _timer;
    constructor(configDir: string, appName: string, pollIntervalMs: number, listener: ConfigUpdateCallback);
    start(): void;
    stop(): void;
    private _checkForChanges;
}
export declare class HeartbeatWriter {
    private readonly _heartbeatPath;
    private readonly _tmpPath;
    private readonly _appName;
    private readonly _framework;
    private readonly _frameworkVersion;
    private _timer;
    constructor(configDir: string, appName: string, framework: string, frameworkVersion: string);
    start(): void;
    stop(): void;
    private _writeHeartbeat;
}
//# sourceMappingURL=config.d.ts.map