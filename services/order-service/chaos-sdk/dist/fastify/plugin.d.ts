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
import type { ChaosEngine } from '../engine.js';
interface FastifyRequest {
    url: string;
    raw: {
        socket: {
            destroy: () => void;
        };
    };
}
interface FastifyReply {
    status: (code: number) => FastifyReply;
    code: (code: number) => FastifyReply;
    header: (name: string, value: string) => FastifyReply;
    send: (body: string | Buffer) => void;
    raw: {
        write: (chunk: string | Buffer) => boolean;
        end: () => void;
        socket: {
            destroy: () => void;
        } | null;
    };
}
interface FastifyInstance {
    addHook: (name: string, handler: (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => void) => void;
    decorate: (name: string, value: unknown) => void;
}
type PluginOptions = {
    engine: ChaosEngine;
};
/**
 * Fastify plugin for chaos fault injection.
 *
 * Register with:
 *   fastify.register(chaosPlugin, { engine: chaosEngine });
 */
export declare function chaosPlugin(fastify: FastifyInstance, options: PluginOptions, done: (err?: Error) => void): void;
export {};
//# sourceMappingURL=plugin.d.ts.map