const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_DIR = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

module.exports = {
  PORT: 8631,
  JWT_SECRET: 'asset-budget-system-secret-key-2024',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: path.join(DATA_DIR, 'system.db'),
  LOG_DIR,
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  BUDGET_WARN_THRESHOLD: 0.8,
  REQUEST_TIMEOUT: 30000,
  RATE_LIMIT_WINDOW: 60 * 1000,
  RATE_LIMIT_MAX: 100
};
