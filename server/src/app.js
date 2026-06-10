const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { PORT, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX } = require('./config');
const logger = require('./utils/logger');
const { requestTimeout, errorHandler, notFoundHandler } = require('./middleware/common');

const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const billRoutes = require('./routes/billRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const assetRoutes = require('./routes/assetRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  }
});

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestTimeout);

app.use('/api', limiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    code: 200,
    message: '资产与预算管理系统 API',
    data: {
      version: '1.0.0',
      status: 'running',
      port: PORT
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

app.use(notFoundHandler);
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});

app.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`数据目录: ${path.join(__dirname, '..', 'data')}`);
  logger.info(`日志目录: ${path.join(__dirname, '..', 'logs')}`);
});

module.exports = app;
