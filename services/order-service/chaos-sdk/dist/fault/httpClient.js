/**
 * Site24x7 Labs Chaos SDK — Outbound HTTP Client Fault Injector
 *
 * Monkey-patches `globalThis.fetch` (Node 18+ native fetch) and `axios`
 * (if installed) to inject faults on outbound HTTP calls.
 *
 * 4 fault types:
 * 1. http_client_latency            — Delay before the outbound call proceeds.
 * 2. http_client_exception          — Throw a mapped error instead of making the call.
 * 3. http_client_error_response     — Return a fake error Response without hitting the server.
 * 4. http_client_partial_response   — Return a truncated body (simulates TCP reset mid-transfer).
 */
import { getConfigString, getConfigInt, resolveException } from '../models.js';
const FAULT_PREFIX = 'http_client_';
let _patchedFetch = false;
let _patchedAxios = false;
// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------
export class HttpClientFaultInjector {
    _engine;
    constructor(engine) {
        this._engine = engine;
    }
    /**
     * Monkey-patch `globalThis.fetch` and `axios` (if available).
     * Call once after the engine is started. Idempotent.
     */
    install() {
        this._patchFetch();
        this._patchAxios();
    }
    // ------------------------------------------------------------------
    // globalThis.fetch monkey-patch
    // ------------------------------------------------------------------
    _patchFetch() {
        if (_patchedFetch)
            return;
        if (typeof globalThis.fetch !== 'function')
            return;
        const originalFetch = globalThis.fetch;
        const engine = this._engine;
        globalThis.fetch = async function patchedFetch(input, init) {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const result = evaluate(engine, url);
            if (result !== null) {
                if (result.kind === 'exception') {
                    throw result.error;
                }
                if (result.kind === 'error_response') {
                    return new Response(result.body, {
                        status: result.statusCode,
                        headers: { 'Content-Type': 'text/plain' },
                    });
                }
                if (result.kind === 'partial_response') {
                    const truncatedBody = result.body.slice(0, Math.max(1, Math.floor(result.body.length * result.truncatePercentage / 100)));
                    return new Response(truncatedBody, {
                        status: result.statusCode,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                if (result.kind === 'latency') {
                    await new Promise((resolve) => setTimeout(resolve, result.delayMs));
                    // Fall through to real fetch after delay
                }
            }
            return originalFetch.call(globalThis, input, init);
        };
        _patchedFetch = true;
        console.log('[chaos-sdk] Monkey-patched globalThis.fetch');
    }
    // ------------------------------------------------------------------
    // axios monkey-patch
    // ------------------------------------------------------------------
    _patchAxios() {
        if (_patchedAxios)
            return;
        let axios;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            axios = require('axios');
        }
        catch {
            // axios not installed — skip
            return;
        }
        const engine = this._engine;
        // Use axios request interceptor — runs before every request.
        // Axios v1+ supports async interceptors, so we return a Promise for latency.
        axios.interceptors.request.use(async (config) => {
            const cfg = config;
            const url = cfg['url'] || '';
            const baseURL = cfg['baseURL'] || '';
            const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
            const result = evaluate(engine, fullUrl);
            if (result !== null) {
                if (result.kind === 'exception') {
                    throw result.error;
                }
                if (result.kind === 'error_response') {
                    // Throw an axios-style error with response data
                    const err = new Error(`Request failed with status code ${result.statusCode}`);
                    err.name = 'AxiosError';
                    err.response = {
                        status: result.statusCode,
                        data: result.body,
                        headers: { 'content-type': 'text/plain' },
                    };
                    err.isAxiosError = true;
                    throw err;
                }
                if (result.kind === 'partial_response') {
                    // Return a "successful" response with truncated body — simulates TCP reset mid-transfer
                    const truncatedBody = result.body.slice(0, Math.max(1, Math.floor(result.body.length * result.truncatePercentage / 100)));
                    const err = new Error('Request completed with partial data');
                    err.name = 'AxiosError';
                    err.response = {
                        status: result.statusCode,
                        data: truncatedBody,
                        headers: { 'content-type': 'application/json' },
                    };
                    err.isAxiosError = true;
                    throw err;
                }
                // latency: non-blocking async delay
                if (result.kind === 'latency') {
                    await new Promise((resolve) => setTimeout(resolve, result.delayMs));
                }
            }
            return config;
        });
        _patchedAxios = true;
        console.log('[chaos-sdk] Monkey-patched axios via request interceptor');
    }
}
// ---------------------------------------------------------------------------
// Shared evaluation logic
// ---------------------------------------------------------------------------
function evaluate(engine, url) {
    if (!engine.enabled)
        return null;
    const rules = engine.findMatchingRules(FAULT_PREFIX, url);
    for (const rule of rules) {
        if (!engine.shouldFire(rule))
            continue;
        const faultType = rule.fault_type;
        if (faultType === 'http_client_latency') {
            const delayMs = getConfigInt(rule, 'delay_ms', 3000);
            console.debug(`[chaos-sdk] Injecting HTTP client latency: ${delayMs}ms on ${url}`);
            return { kind: 'latency', delayMs };
        }
        if (faultType === 'http_client_exception') {
            const javaClass = getConfigString(rule, 'exception_class', 'ResourceAccessException');
            const message = getConfigString(rule, 'message', 'Injected outbound fault');
            console.debug(`[chaos-sdk] Injecting HTTP client exception: ${javaClass} - ${message} on ${url}`);
            return { kind: 'exception', error: resolveException(javaClass, message) };
        }
        if (faultType === 'http_client_error_response') {
            const statusCode = getConfigInt(rule, 'status_code', 503);
            const body = getConfigString(rule, 'body', 'Service Unavailable');
            console.debug(`[chaos-sdk] Injecting HTTP client error response: ${statusCode} on ${url}`);
            return { kind: 'error_response', statusCode, body };
        }
        if (faultType === 'http_client_partial_response') {
            const statusCode = getConfigInt(rule, 'status_code', 200);
            const body = getConfigString(rule, 'body', '{"data":[{"id":1,"name":"item"');
            const truncatePercentage = Math.min(90, Math.max(10, getConfigInt(rule, 'truncate_percentage', 50)));
            console.debug(`[chaos-sdk] Injecting HTTP client partial response: ${truncatePercentage}% of body on ${url}`);
            return { kind: 'partial_response', statusCode, body, truncatePercentage };
        }
        console.warn(`[chaos-sdk] Unknown HTTP client fault type: ${faultType}`);
    }
    return null;
}
//# sourceMappingURL=httpClient.js.map