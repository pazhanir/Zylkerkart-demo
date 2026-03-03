/**
 * Site24x7 Labs Chaos SDK — Database Fault Injector
 *
 * Monkey-patches popular Node.js database clients to inject faults:
 * - pg (node-postgres): Pool.query and Client.query
 * - mysql2: Connection.query and Pool.query
 *
 * 3 fault types:
 * 1. jdbc_exception          — Throw a mapped database error before the query.
 * 2. jdbc_latency            — Delay before the query executes.
 * 3. jdbc_connection_pool_drain — Acquire and hold pool connections.
 */
import { getConfigString, getConfigInt, resolveException, clamp } from '../models.js';
const FAULT_PREFIX = 'jdbc_';
let _patchedPg = false;
let _patchedMysql2 = false;
// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------
export class DatabaseFaultInjector {
    _engine;
    _drainActive = false;
    constructor(engine) {
        this._engine = engine;
    }
    /**
     * Monkey-patch `pg` and `mysql2` (if available).
     * Call once after the engine is started. Idempotent.
     */
    install() {
        this._patchPg();
        this._patchMysql2();
    }
    // ------------------------------------------------------------------
    // pg (node-postgres) monkey-patch
    // ------------------------------------------------------------------
    _patchPg() {
        if (_patchedPg)
            return;
        let pg;
        try {
            pg = require('pg');
        }
        catch {
            return;
        }
        const engine = this._engine;
        const self = this;
        // Patch Pool.query
        const originalPoolQuery = pg.Pool.prototype.query;
        pg.Pool.prototype.query = async function patchedPoolQuery(...args) {
            await applyFault(engine, self);
            return originalPoolQuery.apply(this, args);
        };
        // Patch Client.query
        const originalClientQuery = pg.Client.prototype.query;
        pg.Client.prototype.query = async function patchedClientQuery(...args) {
            await applyFault(engine, self);
            return originalClientQuery.apply(this, args);
        };
        _patchedPg = true;
        console.log('[chaos-sdk] Monkey-patched pg (Pool.query, Client.query)');
    }
    // ------------------------------------------------------------------
    // mysql2 monkey-patch
    // ------------------------------------------------------------------
    _patchMysql2() {
        if (_patchedMysql2)
            return;
        let mysql2;
        try {
            mysql2 = require('mysql2');
        }
        catch {
            return;
        }
        const engine = this._engine;
        const self = this;
        // Patch Connection.query
        if (mysql2.Connection?.prototype?.query) {
            const originalConnQuery = mysql2.Connection.prototype.query;
            mysql2.Connection.prototype.query = async function patchedConnQuery(...args) {
                await applyFault(engine, self);
                return originalConnQuery.apply(this, args);
            };
        }
        // Patch Pool.query
        if (mysql2.Pool?.prototype?.query) {
            const originalPoolQuery = mysql2.Pool.prototype.query;
            mysql2.Pool.prototype.query = async function patchedPoolQuery(...args) {
                await applyFault(engine, self);
                return originalPoolQuery.apply(this, args);
            };
        }
        _patchedMysql2 = true;
        console.log('[chaos-sdk] Monkey-patched mysql2 (Connection.query, Pool.query)');
    }
    // ------------------------------------------------------------------
    // Connection pool drain (called from applyFault)
    // ------------------------------------------------------------------
    _applyConnectionPoolDrain(holdCount, holdDurationMs) {
        if (this._drainActive) {
            console.debug('[chaos-sdk] Connection pool drain already active, skipping');
            return;
        }
        this._drainActive = true;
        console.log(`[chaos-sdk] Injecting connection pool drain: ${holdCount} connections held for ${holdDurationMs}ms`);
        // Try to drain pg Pool connections
        let pg;
        try {
            pg = require('pg');
        }
        catch {
            this._drainActive = false;
            return;
        }
        // Create a temporary pool and acquire connections
        const pool = new pg.Pool();
        const held = [];
        const acquireAndHold = async () => {
            try {
                for (let i = 0; i < holdCount; i++) {
                    try {
                        const client = await pool.connect();
                        held.push(client);
                        console.debug(`[chaos-sdk] Connection pool drain: acquired ${i + 1}/${holdCount}`);
                    }
                    catch (err) {
                        console.debug(`[chaos-sdk] Connection pool drain: failed to acquire ${i + 1}/${holdCount}:`, err);
                        break;
                    }
                }
                console.log(`[chaos-sdk] Connection pool drain: holding ${held.length} connections for ${holdDurationMs}ms`);
                await new Promise((resolve) => setTimeout(resolve, holdDurationMs));
            }
            finally {
                for (const client of held) {
                    try {
                        client.release();
                    }
                    catch {
                        // ignore
                    }
                }
                this._drainActive = false;
                console.log(`[chaos-sdk] Connection pool drain: released ${held.length} connections`);
            }
        };
        acquireAndHold().catch((err) => {
            console.error('[chaos-sdk] Connection pool drain error:', err);
            this._drainActive = false;
        });
    }
}
// ---------------------------------------------------------------------------
// Shared evaluation logic
// ---------------------------------------------------------------------------
async function applyFault(engine, injector) {
    if (!engine.enabled)
        return;
    const rules = engine.findMatchingRules(FAULT_PREFIX);
    for (const rule of rules) {
        if (!engine.shouldFire(rule))
            continue;
        const faultType = rule.fault_type;
        if (faultType === 'jdbc_exception') {
            const javaClass = getConfigString(rule, 'exception_class', 'java.sql.SQLException');
            const message = getConfigString(rule, 'message', 'Injected JDBC fault');
            const sqlState = getConfigString(rule, 'sql_state', '08001');
            console.debug(`[chaos-sdk] Injecting JDBC exception: ${message} (state: ${sqlState})`);
            const err = resolveException(javaClass, message);
            err.sqlState = sqlState;
            err.code = sqlState;
            throw err;
        }
        if (faultType === 'jdbc_latency') {
            const delayMs = getConfigInt(rule, 'delay_ms', 2000);
            console.debug(`[chaos-sdk] Injecting JDBC latency: ${delayMs}ms`);
            // Non-blocking async delay — does not block the event loop
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return;
        }
        if (faultType === 'jdbc_connection_pool_drain') {
            const holdCount = clamp(getConfigInt(rule, 'hold_count', 5), 1, 20);
            const holdDurationMs = clamp(getConfigInt(rule, 'hold_duration_ms', 30000), 1000, 60000);
            injector._applyConnectionPoolDrain(holdCount, holdDurationMs);
            return;
        }
        console.warn(`[chaos-sdk] Unknown JDBC fault type: ${faultType}`);
    }
}
//# sourceMappingURL=database.js.map