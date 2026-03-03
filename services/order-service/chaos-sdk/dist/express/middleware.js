/**
 * Site24x7 Labs Chaos SDK — Express Middleware
 *
 * Returns standard Express middleware `(req, res, next)` that evaluates
 * inbound HTTP fault rules before the request reaches the application handler.
 *
 * Usage:
 *   import { chaosMiddleware } from '@site24x7-labs/chaos-sdk/express';
 *   app.use(chaosMiddleware(engine));
 */
import { HttpFaultInjector } from '../fault/http.js';
/**
 * Create Express middleware for chaos fault injection.
 *
 * @param engine - The ChaosEngine instance
 * @returns Express middleware function
 */
export function chaosMiddleware(engine) {
    const injector = new HttpFaultInjector(engine);
    console.log('[chaos-sdk] Express chaos middleware registered');
    return function chaosFaultMiddleware(req, res, next) {
        const result = injector.evaluate(req.path);
        if (result === null) {
            next();
            return;
        }
        handleFault(result, req, res, next);
    };
}
function handleFault(result, req, res, next) {
    switch (result.kind) {
        case 'exception':
            // Let Express error handlers catch it
            next(result.error);
            break;
        case 'latency':
            // Delay, then continue to normal handler
            setTimeout(() => next(), result.delayMs);
            break;
        case 'error_response':
            res.status(result.statusCode).set({ 'Content-Type': 'text/plain' }).send(result.body);
            break;
        case 'connection_reset':
            // Destroy the underlying socket
            try {
                if (res.socket) {
                    res.socket.destroy();
                }
                else {
                    req.socket.destroy();
                }
            }
            catch {
                // If socket destroy fails, send 502
                res.status(502).send('');
            }
            break;
        case 'slow_body': {
            // Stream response body with inter-chunk delays
            res.status(200).set({ 'Content-Type': 'text/plain' });
            const chunk = '.'.repeat(result.chunkSize);
            let sent = 0;
            const sendNextChunk = () => {
                if (sent >= result.totalChunks) {
                    res.end();
                    return;
                }
                res.write(chunk);
                sent++;
                setTimeout(sendNextChunk, result.delayMs);
            };
            sendNextChunk();
            break;
        }
    }
}
//# sourceMappingURL=middleware.js.map