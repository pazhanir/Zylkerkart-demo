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
import type { ChaosEngine } from '../engine.js';
interface ExpressRequest {
    path: string;
    socket: {
        destroy: () => void;
    };
}
interface ExpressResponse {
    status: (code: number) => ExpressResponse;
    set: (headers: Record<string, string>) => ExpressResponse;
    send: (body: string) => void;
    write: (chunk: string | Buffer) => boolean;
    end: () => void;
    socket: {
        destroy: () => void;
    } | null;
}
type NextFunction = (err?: unknown) => void;
/**
 * Create Express middleware for chaos fault injection.
 *
 * @param engine - The ChaosEngine instance
 * @returns Express middleware function
 */
export declare function chaosMiddleware(engine: ChaosEngine): (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void;
export {};
//# sourceMappingURL=middleware.d.ts.map