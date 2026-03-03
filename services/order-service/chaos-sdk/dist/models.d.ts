/**
 * Site24x7 Labs Chaos SDK for Node.js — Models & Types
 *
 * Defines the config file schema, fault rule types, and exception class
 * mappings from canonical Java names to Node.js-native error types.
 */
export type FaultType = 'http_exception' | 'http_latency' | 'http_error_response' | 'http_connection_reset' | 'http_slow_body' | 'http_client_latency' | 'http_client_exception' | 'http_client_error_response' | 'http_client_partial_response' | 'jdbc_exception' | 'jdbc_latency' | 'jdbc_connection_pool_drain' | 'redis_exception' | 'redis_latency' | 'thread_pool_exhaustion' | 'memory_pressure' | 'cpu_burn' | 'gc_pressure' | 'thread_deadlock' | 'disk_fill';
/**
 * A single fault rule from the config file.
 */
export interface FaultRuleConfig {
    id: string;
    fault_type: FaultType;
    enabled: boolean;
    probability: number;
    config: Record<string, unknown>;
    url_pattern: string;
}
/**
 * Top-level config file structure.
 * Path: /var/site24x7-labs/faults/{app_name}.json
 */
export interface AppFaultConfig {
    version: number;
    app_name: string;
    environment_id: string;
    updated_at: string;
    rules: FaultRuleConfig[];
}
export declare function getConfigString(rule: FaultRuleConfig, key: string, defaultValue?: string): string;
export declare function getConfigInt(rule: FaultRuleConfig, key: string, defaultValue?: number): number;
export declare function getConfigFloat(rule: FaultRuleConfig, key: string, defaultValue?: number): number;
export interface ExceptionMapping {
    javaClass: string;
    nodeErrorName: string;
    /** Factory that creates the actual Error to throw. */
    createError: (message: string) => Error;
}
/**
 * Map from Java canonical exception class name to Node.js error factory.
 * Used by http, http_client, database, and redis fault injectors.
 */
export declare const EXCEPTION_CLASS_MAP: Record<string, ExceptionMapping>;
/**
 * Resolve a Java exception class name to a Node.js Error factory.
 * Falls back to a generic Error if the class name isn't mapped.
 */
export declare function resolveException(javaClassName: string, message: string): Error;
export interface ChaosSDKOptions {
    /** Master kill-switch. Defaults to true. Also reads CHAOS_SDK_ENABLED env var. */
    enabled?: boolean;
    /** Application name. Falls back to CHAOS_SDK_APP_NAME env var. */
    appName?: string;
    /** Directory where the agent writes config files. Defaults to /var/site24x7-labs/faults. */
    configDir?: string;
    /** Config file poll interval in milliseconds. Defaults to 2000. */
    pollIntervalMs?: number;
    /** Framework name (e.g. 'express', 'fastify'). Auto-detected if not set. */
    framework?: string;
    /** Framework version. Auto-detected if not set. */
    frameworkVersion?: string;
}
/** Default config directory for the chaos SDK. */
export declare const DEFAULT_CONFIG_DIR = "/var/site24x7-labs/faults";
/** Default poll interval for config file changes (2 seconds). */
export declare const DEFAULT_POLL_INTERVAL_MS = 2000;
/** Heartbeat write interval (30 seconds). */
export declare const HEARTBEAT_INTERVAL_MS = 30000;
/** SDK version — must match package.json. */
export declare const SDK_VERSION = "1.0.0";
/** SDK language identifier for heartbeat files. */
export declare const SDK_LANGUAGE = "nodejs";
/**
 * Clamp a number between a min and max value (inclusive).
 * Used by resource fault injectors to enforce safety limits.
 */
export declare function clamp(value: number, min: number, max: number): number;
//# sourceMappingURL=models.d.ts.map