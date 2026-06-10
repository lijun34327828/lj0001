const Database = require('better-sqlite3');
const { DB_PATH } = require('../config');
const logger = require('../utils/logger');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  const tables = [];

  tables.push(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'general',
      balance REAL DEFAULT 0,
      initial_balance REAL DEFAULT 0,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      parent_id INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      sort INTEGER DEFAULT 0,
      icon TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      bill_time TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(user_id, category_id, year, month)
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'fixed',
      value REAL NOT NULL,
      purchase_date TEXT,
      depreciation_rate REAL DEFAULT 0,
      current_value REAL NOT NULL,
      description TEXT,
      is_locked INTEGER DEFAULT 0,
      locked_by INTEGER,
      locked_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS bill_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS rate_limit_cache (
      key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      reset_time INTEGER NOT NULL
    )
  `);

  tables.push(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id INTEGER,
      data TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      expires_at INTEGER NOT NULL
    )
  `);

  tables.push(`CREATE INDEX IF NOT EXISTS idx_bills_user_time ON bills(user_id, bill_time)`);
  tables.push(`CREATE INDEX IF NOT EXISTS idx_bills_account ON bills(account_id)`);
  tables.push(`CREATE INDEX IF NOT EXISTS idx_bills_category ON bills(category_id)`);
  tables.push(`CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id)`);
  tables.push(`CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, year, month)`);
  tables.push(`CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)`);

  try {
    const transaction = db.transaction(() => {
      tables.forEach(sql => db.exec(sql));
    });
    transaction();
    logger.info('数据库初始化完成');
  } catch (err) {
    logger.error('数据库初始化失败:', err);
    throw err;
  }
}

initDatabase();

module.exports = db;
