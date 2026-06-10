const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { sanitizeString, formatMoney } = require('../utils/validator');

function getAccounts(req, res) {
  const userId = req.user.id;

  const accounts = db.prepare(`
    SELECT a.*, 
      (SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) 
       FROM bills WHERE account_id = a.id AND is_deleted = 0) as calculated_balance
    FROM accounts a
    WHERE a.user_id = ?
    ORDER BY a.is_default DESC, a.created_at DESC
  `).all(userId);

  accounts.forEach(acc => {
    acc.balance = formatMoney(acc.balance);
    acc.calculated_balance = formatMoney(acc.calculated_balance);
    acc.initial_balance = formatMoney(acc.initial_balance);
  });

  res.json(success(accounts));
}

function getAccountById(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const account = db.prepare(`
    SELECT a.*,
      (SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) 
       FROM bills WHERE account_id = a.id AND is_deleted = 0) as calculated_balance,
      (SELECT COUNT(*) FROM bills WHERE account_id = a.id AND is_deleted = 0) as bill_count
    FROM accounts a
    WHERE a.id = ? AND a.user_id = ?
  `).get(id, userId);

  if (!account) {
    return res.status(404).json(error('账户不存在', 404));
  }

  account.balance = formatMoney(account.balance);
  account.calculated_balance = formatMoney(account.calculated_balance);
  account.initial_balance = formatMoney(account.initial_balance);

  res.json(success(account));
}

function createAccount(req, res) {
  const userId = req.user.id;
  const { name, type = 'general', initial_balance = 0, description = '' } = req.body;

  if (!name || name.trim().length === 0) {
    return res.json(error('账户名称不能为空'));
  }

  if (name.length > 50) {
    return res.json(error('账户名称不能超过50个字符'));
  }

  const cleanName = sanitizeString(name, 50);
  const cleanDesc = sanitizeString(description, 200);
  const initBalance = formatMoney(Math.max(0, Number(initial_balance) || 0));

  const result = db.prepare(`
    INSERT INTO accounts (user_id, name, type, balance, initial_balance, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, cleanName, type, initBalance, initBalance, cleanDesc);

  logger.info(`创建账户: userId=${userId}, accountId=${result.lastInsertRowid}`);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  account.balance = formatMoney(account.balance);
  account.initial_balance = formatMoney(account.initial_balance);

  res.json(success(account, '账户创建成功'));
}

function updateAccount(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, type, description } = req.body;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!account) {
    return res.status(404).json(error('账户不存在', 404));
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    const cleanName = sanitizeString(name, 50);
    if (!cleanName) return res.json(error('账户名称不能为空'));
    updates.push('name = ?');
    params.push(cleanName);
  }
  if (type !== undefined) {
    updates.push('type = ?');
    params.push(type);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(sanitizeString(description, 200));
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime(\'now\',\'localtime\')');
    params.push(id, userId);

    db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...params);
  }

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  updated.balance = formatMoney(updated.balance);
  updated.initial_balance = formatMoney(updated.initial_balance);

  logger.info(`更新账户: userId=${userId}, accountId=${id}`);
  res.json(success(updated, '更新成功'));
}

function deleteAccount(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!account) {
    return res.status(404).json(error('账户不存在', 404));
  }

  if (account.is_default) {
    return res.json(error('默认账户不能删除'));
  }

  const billCount = db.prepare('SELECT COUNT(*) as count FROM bills WHERE account_id = ? AND is_deleted = 0')
    .get(id).count;
  
  if (billCount > 0) {
    return res.json(error('该账户下有账单记录，无法删除'));
  }

  db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId);

  logger.info(`删除账户: userId=${userId}, accountId=${id}`);
  res.json(success(null, '删除成功'));
}

function setDefaultAccount(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!account) {
    return res.status(404).json(error('账户不存在', 404));
  }

  const transaction = db.transaction(() => {
    db.prepare('UPDATE accounts SET is_default = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE accounts SET is_default = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  });
  transaction();

  logger.info(`设置默认账户: userId=${userId}, accountId=${id}`);
  res.json(success(null, '设置成功'));
}

function getAccountStats(req, res) {
  const userId = req.user.id;
  const { accountId } = req.params;
  const { startDate, endDate } = req.query;

  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) {
    return res.status(403).json(error('无权访问该账户', 403));
  }

  let whereSql = 'account_id = ? AND is_deleted = 0';
  const params = [accountId];

  if (startDate) {
    whereSql += ' AND bill_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereSql += ' AND bill_time <= ?';
    params.push(endDate);
  }

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COUNT(*) as bill_count
    FROM bills
    WHERE ${whereSql}
  `).get(...params);

  stats.total_income = formatMoney(stats.total_income);
  stats.total_expense = formatMoney(stats.total_expense);
  stats.net_balance = formatMoney(stats.total_income - stats.total_expense);

  res.json(success(stats));
}

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  setDefaultAccount,
  getAccountStats
};
