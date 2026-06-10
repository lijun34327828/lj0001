const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const logger = require('../utils/logger');

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    logger.warn('Token验证失败:', err.message);
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }

  req.user = decoded;
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware
};
