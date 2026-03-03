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
import type { ChaosEngine } from '../engine.js';
export interface HttpFaultResultBase {
    readonly kind: string;
    readonly ruleId: string;
}
export interface ExceptionFault extends HttpFaultResultBase {
    readonly kind: 'exception';
    readonly error: Error;
}
export interface LatencyFault extends HttpFaultResultBase {
    readonly kind: 'latency';
    readonly delayMs: number;
}
export interface ErrorResponseFault extends HttpFaultResultBase {
    readonly kind: 'error_response';
    readonly statusCode: number;
    readonly body: string;
}
export interface ConnectionResetFault extends HttpFaultResultBase {
    readonly kind: 'connection_reset';
}
export interface SlowBodyFault extends HttpFaultResultBase {
    readonly kind: 'slow_body';
    readonly delayMs: number;
    readonly chunkSize: number;
    readonly totalChunks: number;
}
export type HttpFaultResult = ExceptionFault | LatencyFault | ErrorResponseFault | ConnectionResetFault | SlowBodyFault;
export declare class HttpFaultInjector {
    private readonly _engine;
    constructor(engine: ChaosEngine);
    /**
     * Evaluate all `http_*` rules for a request URL.
     * Returns the first matching fault result, or null if no fault fires.
     *
     * For `http_latency`, the returned result is a promise that resolves
     * after the delay — the middleware should `await` it.
     */
    evaluate(requestUrl: string): HttpFaultResult | null;
}
//# sourceMappingURL=http.d.ts.map