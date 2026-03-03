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
import type { ChaosSDKOptions } from './models.js';
import { ChaosEngine } from './engine.js';
export { ChaosEngine } from './engine.js';
export type { ChaosSDKOptions, FaultType, FaultRuleConfig, AppFaultConfig } from './models.js';
export type { HttpFaultResult, ExceptionFault, LatencyFault, ErrorResponseFault, ConnectionResetFault, SlowBodyFault } from './fault/http.js';
export { HttpFaultInjector } from './fault/http.js';
export { chaosMiddleware } from './express/middleware.js';
export { chaosPlugin } from './fastify/plugin.js';
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
export declare function initChaos(app: unknown, options?: ChaosSDKOptions): ChaosEngine;
//# sourceMappingURL=index.d.ts.map