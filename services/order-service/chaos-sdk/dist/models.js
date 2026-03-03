/**
 * Site24x7 Labs Chaos SDK for Node.js — Models & Types
 *
 * Defines the config file schema, fault rule types, and exception class
 * mappings from canonical Java names to Node.js-native error types.
 */
// ---------------------------------------------------------------------------
// Config helpers — extract typed values from the opaque config map
// ---------------------------------------------------------------------------
export function getConfigString(rule, key, defaultValue = '') {
    const val = rule.config[key];
    return typeof val === 'string' ? val : defaultValue;
}
export function getConfigInt(rule, key, defaultValue = 0) {
    const val = rule.config[key];
    if (typeof val === 'number')
        return Math.floor(val);
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
}
export function getConfigFloat(rule, key, defaultValue = 0) {
    const val = rule.config[key];
    if (typeof val === 'number')
        return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
}
/**
 * Map from Java canonical exception class name to Node.js error factory.
 * Used by http, http_client, database, and redis fault injectors.
 */
export const EXCEPTION_CLASS_MAP = {
    // --- Inbound HTTP exceptions ---
    'java.lang.RuntimeException': {
        javaClass: 'java.lang.RuntimeException',
        nodeErrorName: 'Error',
        createError: (msg) => new Error(msg),
    },
    'java.lang.IllegalStateException': {
        javaClass: 'java.lang.IllegalStateException',
        nodeErrorName: 'Error',
        createError: (msg) => new Error(msg),
    },
    'java.lang.NullPointerException': {
        javaClass: 'java.lang.NullPointerException',
        nodeErrorName: 'TypeError',
        createError: (msg) => new TypeError(msg || 'Cannot read properties of null'),
    },
    'java.util.concurrent.TimeoutException': {
        javaClass: 'java.util.concurrent.TimeoutException',
        nodeErrorName: 'TimeoutError',
        createError: (msg) => {
            const err = new Error(msg || 'Operation timed out');
            err.name = 'TimeoutError';
            return err;
        },
    },
    'java.io.IOException': {
        javaClass: 'java.io.IOException',
        nodeErrorName: 'SystemError',
        createError: (msg) => {
            const err = new Error(msg || 'I/O error');
            err.name = 'SystemError';
            return err;
        },
    },
    // --- Outbound HTTP client exceptions ---
    'ResourceAccessException': {
        javaClass: 'ResourceAccessException',
        nodeErrorName: 'FetchError',
        createError: (msg) => {
            const err = new Error(msg || 'fetch failed');
            err.name = 'FetchError';
            return err;
        },
    },
    'HttpServerErrorException': {
        javaClass: 'HttpServerErrorException',
        nodeErrorName: 'HTTPError',
        createError: (msg) => {
            const err = new Error(msg || 'HTTP 5xx server error');
            err.name = 'HTTPError';
            return err;
        },
    },
    'HttpClientErrorException': {
        javaClass: 'HttpClientErrorException',
        nodeErrorName: 'HTTPError',
        createError: (msg) => {
            const err = new Error(msg || 'HTTP 4xx client error');
            err.name = 'HTTPError';
            return err;
        },
    },
    'java.net.ConnectException': {
        javaClass: 'java.net.ConnectException',
        nodeErrorName: 'ECONNREFUSED',
        createError: (msg) => {
            const err = new Error(msg || 'connect ECONNREFUSED');
            err.name = 'Error';
            err.code = 'ECONNREFUSED';
            return err;
        },
    },
    'java.net.SocketTimeoutException': {
        javaClass: 'java.net.SocketTimeoutException',
        nodeErrorName: 'TimeoutError',
        createError: (msg) => {
            const err = new Error(msg || 'Socket timeout');
            err.name = 'TimeoutError';
            err.code = 'ETIMEDOUT';
            return err;
        },
    },
    // --- Database / JDBC exceptions ---
    'java.sql.SQLException': {
        javaClass: 'java.sql.SQLException',
        nodeErrorName: 'DatabaseError',
        createError: (msg) => {
            const err = new Error(msg || 'Database error');
            err.name = 'DatabaseError';
            return err;
        },
    },
    'SQLTransientConnectionException': {
        javaClass: 'SQLTransientConnectionException',
        nodeErrorName: 'ConnectionError',
        createError: (msg) => {
            const err = new Error(msg || 'Database connection failed');
            err.name = 'ConnectionError';
            err.code = 'ECONNREFUSED';
            return err;
        },
    },
    'java.sql.SQLTimeoutException': {
        javaClass: 'java.sql.SQLTimeoutException',
        nodeErrorName: 'TimeoutError',
        createError: (msg) => {
            const err = new Error(msg || 'Query timeout');
            err.name = 'TimeoutError';
            return err;
        },
    },
    'java.sql.SQLNonTransientException': {
        javaClass: 'java.sql.SQLNonTransientException',
        nodeErrorName: 'DatabaseError',
        createError: (msg) => {
            const err = new Error(msg || 'Non-transient database error');
            err.name = 'DatabaseError';
            return err;
        },
    },
    // --- Redis exceptions ---
    'RedisConnectionFailureException': {
        javaClass: 'RedisConnectionFailureException',
        nodeErrorName: 'ConnectionError',
        createError: (msg) => {
            const err = new Error(msg || 'Redis connection failed');
            err.name = 'ConnectionError';
            err.code = 'ECONNREFUSED';
            return err;
        },
    },
    'RedisSystemException': {
        javaClass: 'RedisSystemException',
        nodeErrorName: 'ReplyError',
        createError: (msg) => {
            const err = new Error(msg || 'Redis system error');
            err.name = 'ReplyError';
            return err;
        },
    },
    'RedisCommandTimeoutException': {
        javaClass: 'RedisCommandTimeoutException',
        nodeErrorName: 'TimeoutError',
        createError: (msg) => {
            const err = new Error(msg || 'Redis command timeout');
            err.name = 'TimeoutError';
            return err;
        },
    },
    'JedisConnectionException': {
        javaClass: 'JedisConnectionException',
        nodeErrorName: 'ConnectionError',
        createError: (msg) => {
            const err = new Error(msg || 'Redis connection error');
            err.name = 'ConnectionError';
            err.code = 'ECONNREFUSED';
            return err;
        },
    },
};
/**
 * Resolve a Java exception class name to a Node.js Error factory.
 * Falls back to a generic Error if the class name isn't mapped.
 */
export function resolveException(javaClassName, message) {
    const mapping = EXCEPTION_CLASS_MAP[javaClassName];
    if (mapping) {
        return mapping.createError(message);
    }
    // Fallback: generic Error with the Java class name embedded
    const err = new Error(message || `${javaClassName}`);
    err.name = javaClassName.split('.').pop() ?? 'Error';
    return err;
}
/** Default config directory for the chaos SDK. */
export const DEFAULT_CONFIG_DIR = '/var/site24x7-labs/faults';
/** Default poll interval for config file changes (2 seconds). */
export const DEFAULT_POLL_INTERVAL_MS = 2000;
/** Heartbeat write interval (30 seconds). */
export const HEARTBEAT_INTERVAL_MS = 30_000;
/** SDK version — must match package.json. */
export const SDK_VERSION = '1.0.0';
/** SDK language identifier for heartbeat files. */
export const SDK_LANGUAGE = 'nodejs';
/**
 * Clamp a number between a min and max value (inclusive).
 * Used by resource fault injectors to enforce safety limits.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
//# sourceMappingURL=models.js.map