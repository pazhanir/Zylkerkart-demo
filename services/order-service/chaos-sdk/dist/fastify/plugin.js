/**
 * Site24x7 Labs Chaos SDK — Fastify Plugin
 *
 * Fastify plugin using the `onRequest` hook to evaluate inbound HTTP fault
 * rules before the request reaches the application handler.
 *
 * Usage:
 *   import { chaosPlugin } from '@site24x7-labs/chaos-sdk/fastify';
 *   fastify.register(chaosPlugin, { engine });
 */
import { HttpFaultInjector } from '../fault/http.js';
/**
 * Fastify plugin for chaos fault injection.
 *
 * Register with:
 *   fastify.register(chaosPlugin, { engine: chaosEngine });
 */
export function chaosPlugin(fastify, options, done) {
    const injector = new HttpFaultInjector(options.engine);
    console.log('[chaos-sdk] Fastify chaos plugin registered');
    fastify.addHook('onRequest', (request, reply, hookDone) => {
        // Extract path from URL (strip query string)
        const urlPath = request.url.split('?')[0] ?? request.url;
        const result = injector.evaluate(urlPath);
        if (result === null) {
            hookDone();
            return;
        }
        handleFault(result, request, reply, hookDone);
    });
    done();
}
// Mark as a Fastify plugin (fastify-plugin compatibility)
Object.defineProperty(chaosPlugin, Symbol.for('skip-override'), { value: true });
Object.defineProperty(chaosPlugin, Symbol.for('fastify.display-name'), { value: 'chaos-sdk' });
function handleFault(result, request, reply, done) {
    switch (result.kind) {
        case 'exception':
            // Pass error to Fastify error handler
            done(result.error);
            break;
        case 'latency':
            // Delay, then continue to normal handler
            setTimeout(() => done(), result.delayMs);
            break;
        case 'error_response':
            reply.code(result.statusCode).header('Content-Type', 'text/plain').send(result.body);
            break;
        case 'connection_reset':
            // Destroy the underlying socket
            try {
                if (reply.raw.socket) {
                    reply.raw.socket.destroy();
                }
                else {
                    request.raw.socket.destroy();
                }
            }
            catch {
                reply.code(502).send('');
            }
            break;
        case 'slow_body': {
            // Stream response body with inter-chunk delays using raw Node.js response
            reply.raw.write(''); // Start the response
            const chunk = '.'.repeat(result.chunkSize);
            let sent = 0;
            const sendNextChunk = () => {
                if (sent >= result.totalChunks) {
                    reply.raw.end();
                    return;
                }
                reply.raw.write(chunk);
                sent++;
                setTimeout(sendNextChunk, result.delayMs);
            };
            sendNextChunk();
            break;
        }
    }
}
//# sourceMappingURL=plugin.js.map