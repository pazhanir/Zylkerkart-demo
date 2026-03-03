/**
 * Site24x7 Labs Chaos SDK — Inbound HTTP Fault Injector
 *
 * Evaluates HTTP fault rules against incoming requests and returns typed
 * result objects that the framework middleware (Express / Fastify) translates
 * into the appropriate HTTP response.
 *
 * 5 fault types:
 * 1. http_exception       — Throw a mapped Node.js error.
 * 2. http_latency         — Delay before the request is handled.
 * 3. http_error_response  — Return a static error status + body.
 * 4. http_connection_reset— Destroy the underlying socket.
 * 5. http_slow_body       — Stream a response body with inter-chunk delays.
 */
import { getConfigString, getConfigInt, resolveException } from '../models.js';
const FAULT_PREFIX = 'http_';
// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------
export class HttpFaultInjector {
    _engine;
    constructor(engine) {
        this._engine = engine;
    }
    /**
     * Evaluate all `http_*` rules for a request URL.
     * Returns the first matching fault result, or null if no fault fires.
     *
     * For `http_latency`, the returned result is a promise that resolves
     * after the delay — the middleware should `await` it.
     */
    evaluate(requestUrl) {
        if (!this._engine.enabled)
            return null;
        const rules = this._engine.findMatchingRules(FAULT_PREFIX, requestUrl);
        for (const rule of rules) {
            if (!this._engine.shouldFire(rule))
                continue;
            try {
                const faultType = rule.fault_type;
                if (faultType === 'http_exception')
                    return applyException(rule);
                if (faultType === 'http_latency')
                    return applyLatency(rule);
                if (faultType === 'http_error_response')
                    return applyErrorResponse(rule);
                if (faultType === 'http_connection_reset')
                    return applyConnectionReset(rule);
                if (faultType === 'http_slow_body')
                    return applySlowBody(rule);
                console.warn(`[chaos-sdk] Unknown HTTP fault type: ${faultType}`);
            }
            catch (err) {
                console.error(`[chaos-sdk] Failed to apply fault ${rule.id}:`, err);
            }
        }
        return null;
    }
}
// ---------------------------------------------------------------------------
// Fault implementations
// ---------------------------------------------------------------------------
function applyException(rule) {
    const javaClass = getConfigString(rule, 'exception_class', 'java.lang.RuntimeException');
    const message = getConfigString(rule, 'message', 'Injected fault');
    console.debug(`[chaos-sdk] Injecting HTTP exception: ${javaClass} - ${message}`);
    return {
        kind: 'exception',
        ruleId: rule.id,
        error: resolveException(javaClass, message),
    };
}
function applyLatency(rule) {
    const delayMs = getConfigInt(rule, 'delay_ms', 1000);
    console.debug(`[chaos-sdk] Injecting HTTP latency: ${delayMs}ms`);
    return {
        kind: 'latency',
        ruleId: rule.id,
        delayMs,
    };
}
function applyErrorResponse(rule) {
    const statusCode = getConfigInt(rule, 'status_code', 500);
    const body = getConfigString(rule, 'body', 'Internal Server Error');
    console.debug(`[chaos-sdk] Injecting HTTP error response: ${statusCode} - ${body}`);
    return {
        kind: 'error_response',
        ruleId: rule.id,
        statusCode,
        body,
    };
}
function applyConnectionReset(rule) {
    console.debug('[chaos-sdk] Injecting HTTP connection reset');
    return { kind: 'connection_reset', ruleId: rule.id };
}
function applySlowBody(rule) {
    const delayMs = getConfigInt(rule, 'delay_ms', 200);
    const chunkSize = getConfigInt(rule, 'chunk_size_bytes', 64);
    console.debug(`[chaos-sdk] Injecting HTTP slow body: ${delayMs}ms delay, ${chunkSize} byte chunks`);
    return {
        kind: 'slow_body',
        ruleId: rule.id,
        delayMs,
        chunkSize,
        totalChunks: 32,
    };
}
//# sourceMappingURL=http.js.map