/**
 * Site24x7 Labs Chaos SDK for Node.js — Public API
 *
 * Single entry point for initializing the SDK. Detects the framework
 * (Express or Fastify), wires up all fault injectors, and starts the
 * engine.
 *
 * Usage:
 *   // Express
 *   import express from 'express';
 *   import { initChaos } from '@site24x7-labs/chaos-sdk';
 *   const app = express();
 *   initChaos(app);
 *
 *   // Fastify
 *   import Fastify from 'fastify';
 *   import { initChaos } from '@site24x7-labs/chaos-sdk';
 *   const app = Fastify();
 *   initChaos(app);
 *
 * Environment variables:
 *   CHAOS_SDK_ENABLED    — Enable/disable the SDK (default: true)
 *   CHAOS_SDK_APP_NAME   — Application name matching the server config
 *   CHAOS_SDK_CONFIG_DIR — Path to config directory (default: /var/site24x7-labs/faults)
 */
import { ChaosEngine } from './engine.js';
import { HttpClientFaultInjector } from './fault/httpClient.js';
import { DatabaseFaultInjector } from './fault/database.js';
import { RedisFaultInjector } from './fault/redis.js';
import { ResourceFaultInjector } from './fault/resource.js';
import { chaosMiddleware } from './express/middleware.js';
import { chaosPlugin } from './fastify/plugin.js';
// Re-export public types
export { ChaosEngine } from './engine.js';
export { HttpFaultInjector } from './fault/http.js';
export { chaosMiddleware } from './express/middleware.js';
export { chaosPlugin } from './fastify/plugin.js';
// ---------------------------------------------------------------------------
// Framework detection helpers
// ---------------------------------------------------------------------------
function isExpressApp(app) {
    // Express apps have .use(), .get(), .post(), .listen() and ._router
    const a = app;
    return (typeof a === 'function' &&
        typeof a['use'] === 'function' &&
        typeof a['get'] === 'function' &&
        typeof a['listen'] === 'function' &&
        // Express specific: has settings / mountpath
        (a['settings'] !== undefined || a['mountpath'] !== undefined));
}
function isFastifyInstance(app) {
    // Fastify instances have .register(), .addHook(), .listen()
    const a = app;
    return (typeof a === 'object' &&
        a !== null &&
        typeof a['register'] === 'function' &&
        typeof a['addHook'] === 'function' &&
        typeof a['listen'] === 'function');
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Initialize the Chaos SDK for a Node.js application.
 *
 * This single call:
 * 1. Detects whether `app` is Express or Fastify.
 * 2. Creates and starts a ChaosEngine (config file watcher + heartbeat).
 * 3. Registers inbound HTTP fault middleware/plugin.
 * 4. Monkey-patches `globalThis.fetch` and `axios` (outbound HTTP faults).
 * 5. Monkey-patches `pg` and `mysql2` (database faults).
 * 6. Monkey-patches `ioredis` and `redis` (Redis faults).
 * 7. Registers ResourceFaultInjector (resource faults on config change).
 * 8. Registers `process.on('exit')` for cleanup.
 *
 * @param app - Express application or Fastify instance
 * @param options - SDK configuration options
 * @returns The ChaosEngine instance (useful for testing or manual control)
 */
export function initChaos(app, options = {}) {
    // Detect framework
    let framework = options.framework || '';
    const frameworkVersion = options.frameworkVersion || '';
    if (!framework) {
        if (isExpressApp(app)) {
            framework = 'express';
        }
        else if (isFastifyInstance(app)) {
            framework = 'fastify';
        }
    }
    // Create & start engine
    const engine = new ChaosEngine({
        ...options,
        framework,
        frameworkVersion,
    });
    engine.start();
    // Stop engine on process exit
    const cleanup = () => engine.stop();
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        cleanup();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        cleanup();
        process.exit(0);
    });
    if (!engine.enabled) {
        console.log('[chaos-sdk] Chaos SDK disabled, skipping middleware registration');
        return engine;
    }
    // 1. Inbound HTTP middleware/plugin
    if (isExpressApp(app)) {
        const mw = chaosMiddleware(engine);
        app.use(mw);
        console.log('[chaos-sdk] Express chaos middleware registered');
    }
    else if (isFastifyInstance(app)) {
        app.register(chaosPlugin, {
            engine,
        });
        console.log('[chaos-sdk] Fastify chaos plugin registered');
    }
    // 2. Outbound HTTP (fetch + axios)
    new HttpClientFaultInjector(engine).install();
    // 3. Database (pg + mysql2)
    new DatabaseFaultInjector(engine).install();
    // 4. Redis (ioredis + node-redis)
    new RedisFaultInjector(engine).install();
    // 5. Resource faults (config-change listener)
    new ResourceFaultInjector(engine).install();
    console.log(`[chaos-sdk] Chaos SDK initialized for ${framework} app "${engine.appName}"`);
    return engine;
}
//# sourceMappingURL=index.js.map