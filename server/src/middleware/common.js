const logger = require('../utils/logger');
const { REQUEST_TIMEOUT } = require('../config');

function requestTimeout(req, res, next) {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn(`请求超时: ${req.method} ${req.originalUrl}`);
      res.status(408).json({ code: 408, message: '请求超时' });
    }
  }, REQUEST_TIMEOUT);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}

function errorHandler(err, req, res, next) {
  logger.error(`全局错误: ${req.method} ${req.originalUrl}`, err);
  
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    code: statusCode,
    message,
    data: null
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null
  });
}

function validateAccountAccess(req, res, next) {
  const userId = req.user.id;
  const accountId = req.body.account_id || req.query.account_id || req.params.accountId;
  
  if (!accountId) {
    return next();
  }

  const db = require('../db');
  const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ?').get(accountId);
  
  if (!account) {
    return res.status(404).json({ code: 404, message: '账户不存在' });
  }
  
  if (account.user_id !== userId) {
    logger.warn(`越权访问账户: userId=${userId}, accountId=${accountId}`);
    return res.status(403).json({ code: 403, message: '无权访问该账户' });
  }

  req.account = account;
  next();
}

module.exports = {
  requestTimeout,
  errorHandler,
  notFoundHandler,
  validateAccountAccess
};
