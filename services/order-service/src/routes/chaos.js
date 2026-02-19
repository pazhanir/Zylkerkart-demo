const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { setChaosRedisTimeout, isChaosRedisTimeout } = require('../config/redis');

// Chaos flags
const chaosFlags = {
  cpuSpikeActive: false,
  queueBackupActive: false
};

let cpuSpikeWorker = null;

// POST /simulate/cpu-spike - Heavy CPU computation
router.post('/cpu-spike', (req, res) => {
  if (chaosFlags.cpuSpikeActive) {
    return res.json({ chaos: 'cpu-spike', status: 'already-running' });
  }

  chaosFlags.cpuSpikeActive = true;
  console.warn('[CHAOS] CPU spike started!');

  cpuSpikeWorker = setImmediate(function cpuBurn() {
    if (!chaosFlags.cpuSpikeActive) return;

    const start = Date.now();
    // Burn CPU for 100ms blocks
    while (Date.now() - start < 100) {
      // Heavy math: calculate prime sieve
      const limit = 10000;
      const sieve = new Array(limit).fill(true);
      for (let i = 2; i * i < limit; i++) {
        if (sieve[i]) {
          for (let j = i * i; j < limit; j += i) {
            sieve[j] = false;
          }
        }
      }
    }

    if (chaosFlags.cpuSpikeActive) {
      cpuSpikeWorker = setImmediate(cpuBurn);
    }
  });

  res.json({
    chaos: 'cpu-spike',
    status: 'started',
    message: 'CPU spike simulation running. Call POST /simulate/cpu-spike/stop to end.'
  });
});

// POST /simulate/cpu-spike/stop
router.post('/cpu-spike/stop', (req, res) => {
  chaosFlags.cpuSpikeActive = false;
  if (cpuSpikeWorker) {
    clearImmediate(cpuSpikeWorker);
    cpuSpikeWorker = null;
  }
  console.log('[CHAOS] CPU spike stopped.');
  res.json({ chaos: 'cpu-spike', status: 'stopped' });
});

// POST /simulate/redis-timeout - Connect to non-existent Redis
router.post('/redis-timeout', (req, res) => {
  console.warn('[CHAOS] Redis timeout enabled!');
  setChaosRedisTimeout(true);
  res.json({
    chaos: 'redis-timeout',
    status: 'started',
    message: 'Redis client switched to non-existent host. All cache/session ops will fail.'
  });
});

// POST /simulate/redis-timeout/stop
router.post('/redis-timeout/stop', (req, res) => {
  setChaosRedisTimeout(false);
  console.log('[CHAOS] Redis timeout disabled.');
  res.json({ chaos: 'redis-timeout', status: 'stopped' });
});

// POST /simulate/db-pool-exhaust - Exhaust DB connection pool
router.post('/db-pool-exhaust', async (req, res) => {
  console.warn('[CHAOS] DB pool exhaustion started!');
  const connections = [];
  const startTime = Date.now();

  try {
    for (let i = 0; i < 20; i++) {
      const conn = await db.getConnection();
      connections.push(conn);
      // Hold each connection with a long sleep query
      conn.execute('SELECT SLEEP(60)').catch(() => {});
    }

    res.json({
      chaos: 'db-pool-exhaust',
      connectionsHeld: connections.length,
      message: 'All DB connections held for 60s. New requests will queue/timeout.'
    });
  } catch (err) {
    res.json({
      chaos: 'db-pool-exhaust',
      connectionsHeld: connections.length,
      error: err.message,
      message: 'Pool exhausted - could not acquire more connections'
    });
  }

  // Release after 60s
  setTimeout(() => {
    connections.forEach(c => { try { c.release(); } catch(e) {} });
    console.log('[CHAOS] DB pool connections released');
  }, 60000);
});

// POST /simulate/long-transaction - Hold transaction with locks for 30s
router.post('/long-transaction', async (req, res) => {
  console.warn('[CHAOS] Long-running transaction started!');
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Lock rows with FOR UPDATE
    await conn.execute('SELECT * FROM orders ORDER BY id DESC LIMIT 5 FOR UPDATE');

    const startTime = Date.now();

    // Hold transaction open for 30 seconds
    await conn.execute('SELECT SLEEP(30)');

    await conn.commit();

    res.json({
      chaos: 'long-transaction',
      duration: Date.now() - startTime,
      message: 'Held row locks for 30 seconds, blocking concurrent writes'
    });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ chaos: 'long-transaction', error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// POST /simulate/queue-backup - Artificial delay on order processing
router.post('/queue-backup', (req, res) => {
  chaosFlags.queueBackupActive = true;
  console.warn('[CHAOS] Queue backup enabled - 10s delay on all order processing!');
  res.json({
    chaos: 'queue-backup',
    status: 'started',
    message: 'All order processing callbacks will have 10s artificial delay'
  });
});

// POST /simulate/queue-backup/stop
router.post('/queue-backup/stop', (req, res) => {
  chaosFlags.queueBackupActive = false;
  console.log('[CHAOS] Queue backup disabled.');
  res.json({ chaos: 'queue-backup', status: 'stopped' });
});

// POST /simulate/crash-loop - Crash the process
router.post('/crash-loop', (req, res) => {
  console.error('[CHAOS] CRASH LOOP - Process will exit in 2 seconds!');
  res.json({
    chaos: 'crash-loop',
    message: 'Process will crash in 2 seconds. In K8s, this triggers CrashLoopBackOff.'
  });
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

// GET /simulate/status - Get current chaos state
router.get('/status', (req, res) => {
  res.json({
    cpuSpikeActive: chaosFlags.cpuSpikeActive,
    redisTimeoutActive: isChaosRedisTimeout(),
    queueBackupActive: chaosFlags.queueBackupActive
  });
});

// Export chaos flags for use by order service
module.exports = router;
module.exports.chaosFlags = chaosFlags;
