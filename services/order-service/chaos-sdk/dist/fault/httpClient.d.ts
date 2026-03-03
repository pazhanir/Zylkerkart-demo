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
import type { ChaosEngine } from '../engine.js';
export declare class HttpClientFaultInjector {
    private readonly _engine;
    constructor(engine: ChaosEngine);
    /**
     * Monkey-patch `globalThis.fetch` and `axios` (if available).
     * Call once after the engine is started. Idempotent.
     */
    install(): void;
    private _patchFetch;
    private _patchAxios;
}
//# sourceMappingURL=httpClient.d.ts.map