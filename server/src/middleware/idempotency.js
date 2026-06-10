const db = require('../db');

const IDEMPOTENCY_TTL = 3600000;

function checkIdempotency(key, userId = null) {
  if (!key) return null;
  
  const record = db.prepare(`
    SELECT * FROM idempotency_keys 
    WHERE key = ? ${userId ? 'AND user_id = ?' : ''}
  `).get(key, userId ? [userId] : []);
  
  if (record) {
    const now = Date.now();
    if (record.expires_at > now) {
      try {
        return JSON.parse(record.data);
      } catch {
        return record.data;
      }
    }
    db.prepare('DELETE FROM idempotency_keys WHERE key = ?').run(key);
  }
  
  return null;
}

function setIdempotency(key, data, userId = null) {
  if (!key) return;
  
  const expiresAt = Date.now() + IDEMPOTENCY_TTL;
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  
  db.prepare(`
    INSERT OR REPLACE INTO idempotency_keys (key, user_id, data, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(key, userId, dataStr, expiresAt);
}

function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?.id;
  const cached = checkIdempotency(idempotencyKey, userId);
  
  if (cached) {
    return res.json(cached);
  }

  const originalJson = res.json.bind(res);
  res.json = function(body) {
    if (res.statusCode === 200 || body.code === 200) {
      setIdempotency(idempotencyKey, body, userId);
    }
    return originalJson(body);
  };

  next();
}

module.exports = {
  checkIdempotency,
  setIdempotency,
  idempotencyMiddleware
};
