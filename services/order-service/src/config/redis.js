const Redis = require('ioredis');

// Chaos flag: when true, connects to non-existent Redis host
let chaosRedisTimeout = false;

function createRedisClient() {
  const host = chaosRedisTimeout ? 'redis-nonexistent' : (process.env.REDIS_HOST || 'localhost');
  const port = parseInt(process.env.REDIS_PORT || '6379');

  const client = new Redis({
    host,
    port,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    connectTimeout: 5000,
    lazyConnect: false
  });

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  return client;
}

let redisClient = createRedisClient();

function getRedis() {
  return redisClient;
}

function setChaosRedisTimeout(enabled) {
  chaosRedisTimeout = enabled;
  if (enabled) {
    console.warn('[CHAOS] Redis timeout enabled - switching to non-existent host');
    redisClient.disconnect();
    redisClient = createRedisClient();
  } else {
    console.log('[CHAOS] Redis timeout disabled - reconnecting to real host');
    redisClient.disconnect();
    redisClient = createRedisClient();
  }
}

function isChaosRedisTimeout() {
  return chaosRedisTimeout;
}

module.exports = { getRedis, setChaosRedisTimeout, isChaosRedisTimeout };
