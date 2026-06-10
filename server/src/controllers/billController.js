const db = require('../db');
const logger = require('../utils/logger');
const { success, error, paginated } = require('../utils/response');
const { 
  isValidAmount, 
  isValidDate, 
  isValidDateRange,
  formatMoney, 
  sanitizeString,
  getMonthRange
} = require('../utils/validator');
const dayjs = require('dayjs');

function getBills(req, res) {
  const userId = req.user.id;
  let { 
    page = 1, 
    pageSize = 20, 
    type,
    accountId,
    categoryId,
    startDate,
    endDate,
    keyword,
    minAmount,
    maxAmount,
    sortBy = 'bill_time',
    sortOrder = 'desc'
  } = req.query;

  page = parseInt(page) || 1;
  pageSize = parseInt(pageSize) || 20;
  pageSize = Math.min(pageSize, 100);

  const whereClauses = ['b.user_id = ?', 'b.is_deleted = 0'];
  const params = [userId];

  if (type && ['income', 'expense'].includes(type)) {
    whereClauses.push('b.type = ?');
    params.push(type);
  }

  if (accountId) {
    whereClauses.push('b.account_id = ?');
    params.push(Number(accountId));
  }

  if (categoryId) {
    whereClauses.push('(b.category_id = ? OR c.parent_id = ?)');
    params.push(Number(categoryId), Number(categoryId));
  }

  if (startDate && isValidDate(startDate)) {
    whereClauses.push('b.bill_time >= ?');
    params.push(startDate);
  }

  if (endDate && isValidDate(endDate)) {
    whereClauses.push('b.bill_time <= ?');
    params.push(endDate + ' 23:59:59');
  }

  if (keyword) {
    const cleanKeyword = sanitizeString(keyword, 100);
    if (cleanKeyword) {
      whereClauses.push('(b.description LIKE ? OR c.name LIKE ?)');
      params.push(`%${cleanKeyword}%`, `%${cleanKeyword}%`);
    }
  }

  if (minAmount && !isNaN(Number(minAmount)) && Number(minAmount) > 0) {
    whereClauses.push('b.amount >= ?');
    params.push(Number(minAmount));
  }

  if (maxAmount && !isNaN(Number(maxAmount)) && Number(maxAmount) > 0) {
    whereClauses.push('b.amount <= ?');
    params.push(Number(maxAmount));
  }

  const validSortFields = ['bill_time', 'amount', 'created_at'];
  const validSortOrders = ['asc', 'desc'];
  if (!validSortFields.includes(sortBy)) sortBy = 'bill_time';
  if (!validSortOrders.includes(sortOrder)) sortOrder = 'desc';

  const whereSql = whereClauses.join(' AND ');
  const offset = (page - 1) * pageSize;

  const countResult = db.prepare(`
    SELECT COUNT(*) as total 
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE ${whereSql}
  `).get(...params);

  const bills = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, 
           c.parent_id as category_parent_id,
           a.name as account_name,
           pc.name as parent_category_name
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE ${whereSql}
    ORDER BY b.${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  bills.forEach(bill => {
    bill.amount = formatMoney(bill.amount);
  });

  res.json(paginated(bills, countResult.total, page, pageSize));
}

function getBillById(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const bill = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon,
           c.type as category_type, c.parent_id as category_parent_id,
           pc.name as parent_category_name,
           a.name as account_name
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE b.id = ? AND b.user_id = ? AND b.is_deleted = 0
  `).get(id, userId);

  if (!bill) {
    return res.status(404).json(error('账单不存在', 404));
  }

  bill.amount = formatMoney(bill.amount);

  res.json(success(bill));
}

function createBill(req, res) {
  const userId = req.user.id;
  const { 
    account_id, 
    category_id, 
    type, 
    amount, 
    description = '', 
    bill_time 
  } = req.body;

  if (!account_id) {
    return res.json(error('请选择账户'));
  }

  if (!category_id) {
    return res.json(error('请选择分类'));
  }

  if (!type || !['income', 'expense'].includes(type)) {
    return res.json(error('账单类型无效'));
  }

  const numAmount = Number(amount);
  if (!isValidAmount(numAmount)) {
    return res.json(error('金额不合法，请输入0-999999999.99之间的正数'));
  }

  if (!bill_time || !isValidDate(bill_time)) {
    return res.json(error('请选择有效的账单日期'));
  }

  const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ? AND user_id = ?')
    .get(account_id, userId);
  if (!account) {
    return res.json(error('账户不存在或无权访问'));
  }

  const category = db.prepare('SELECT id, user_id, type, level FROM categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
    .get(category_id, userId);
  if (!category) {
    return res.json(error('分类不存在'));
  }

  if (category.type !== type) {
    return res.json(error('分类类型与账单类型不匹配'));
  }

  if (category.level === 1) {
    const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(category_id).count;
    if (childCount > 0) {
      return res.json(error('请选择子分类，不能使用一级分类'));
    }
  }

  const cleanDesc = sanitizeString(description, 500);
  const formattedTime = dayjs(bill_time).format('YYYY-MM-DD HH:mm:ss');
  const finalAmount = formatMoney(numAmount);

  const result = db.prepare(`
    INSERT INTO bills (user_id, account_id, category_id, type, amount, description, bill_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, account_id, category_id, type, finalAmount, cleanDesc, formattedTime);

  const billId = result.lastInsertRowid;

  db.prepare(`
    INSERT INTO bill_history (bill_id, user_id, action, new_data)
    VALUES (?, ?, 'create', ?)
  `).run(billId, userId, JSON.stringify({
    account_id, category_id, type, amount: finalAmount, description: cleanDesc, bill_time: formattedTime
  }));

  updateAccountBalance(account_id);

  logger.info(`创建账单: userId=${userId}, billId=${billId}, amount=${finalAmount}`);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  bill.amount = formatMoney(bill.amount);

  const budgetCheck = checkBudgetWarning(userId, category_id, formattedTime);

  res.json(success({
    bill,
    budgetWarning: budgetCheck
  }, '账单创建成功'));
}

function updateBill(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const oldBill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ? AND is_deleted = 0')
    .get(id, userId);
  if (!oldBill) {
    return res.status(404).json(error('账单不存在', 404));
  }

  const { 
    account_id, 
    category_id, 
    type, 
    amount, 
    description, 
    bill_time 
  } = req.body;

  const updates = [];
  const params = [];
  const oldData = { ...oldBill };

  if (account_id !== undefined && account_id !== oldBill.account_id) {
    const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ? AND user_id = ?')
      .get(account_id, userId);
    if (!account) {
      return res.json(error('账户不存在或无权访问'));
    }
    updates.push('account_id = ?');
    params.push(Number(account_id));
  }

  if (category_id !== undefined && category_id !== oldBill.category_id) {
    const category = db.prepare('SELECT id, user_id, type, level FROM categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
      .get(category_id, userId);
    if (!category) {
      return res.json(error('分类不存在'));
    }
    if (category.level === 1) {
      const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(category_id).count;
      if (childCount > 0) {
        return res.json(error('请选择子分类，不能使用一级分类'));
      }
    }
    updates.push('category_id = ?');
    params.push(Number(category_id));
  }

  if (type !== undefined && type !== oldBill.type) {
    if (!['income', 'expense'].includes(type)) {
      return res.json(error('账单类型无效'));
    }
    updates.push('type = ?');
    params.push(type);
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (!isValidAmount(numAmount)) {
      return res.json(error('金额不合法'));
    }
    updates.push('amount = ?');
    params.push(formatMoney(numAmount));
  }

  if (description !== undefined) {
    updates.push('description = ?');
    params.push(sanitizeString(description, 500));
  }

  if (bill_time !== undefined) {
    if (!isValidDate(bill_time)) {
      return res.json(error('账单日期无效'));
    }
    updates.push('bill_time = ?');
    params.push(dayjs(bill_time).format('YYYY-MM-DD HH:mm:ss'));
  }

  if (updates.length === 0) {
    return res.json(success(oldBill, '无需更新'));
  }

  updates.push('updated_at = datetime(\'now\',\'localtime\')');
  params.push(id, userId);

  const oldAccountId = oldBill.account_id;

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE bills SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);

    db.prepare(`
      INSERT INTO bill_history (bill_id, user_id, action, old_data, new_data)
      VALUES (?, ?, 'update', ?, ?)
    `).run(id, userId, JSON.stringify(oldData), JSON.stringify(req.body));
  });
  transaction();

  const newAccountId = account_id || oldBill.account_id;
  if (oldAccountId !== newAccountId || amount !== undefined) {
    updateAccountBalance(oldAccountId);
    if (oldAccountId !== newAccountId) {
      updateAccountBalance(newAccountId);
    }
  }

  logger.info(`更新账单: userId=${userId}, billId=${id}`);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  bill.amount = formatMoney(bill.amount);

  const catId = category_id || oldBill.category_id;
  const bTime = bill_time || oldBill.bill_time;
  const budgetCheck = checkBudgetWarning(userId, catId, bTime);

  res.json(success({
    bill,
    budgetWarning: budgetCheck
  }, '更新成功'));
}

function deleteBill(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ? AND is_deleted = 0')
    .get(id, userId);
  if (!bill) {
    return res.status(404).json(error('账单不存在', 404));
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE bills SET is_deleted = 1, updated_at = datetime('now','localtime')
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    db.prepare(`
      INSERT INTO bill_history (bill_id, user_id, action, old_data)
      VALUES (?, ?, 'delete', ?)
    `).run(id, userId, JSON.stringify(bill));
  });
  transaction();

  updateAccountBalance(bill.account_id);

  logger.info(`删除账单: userId=${userId}, billId=${id}`);
  res.json(success(null, '删除成功'));
}

function batchDeleteBills(req, res) {
  const userId = req.user.id;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json(error('请选择要删除的账单'));
  }

  if (ids.length > 100) {
    return res.json(error('单次最多删除100条记录'));
  }

  const placeholders = ids.map(() => '?').join(',');
  const bills = db.prepare(`
    SELECT id, account_id FROM bills 
    WHERE id IN (${placeholders}) AND user_id = ? AND is_deleted = 0
  `).all(...ids, userId);

  if (bills.length === 0) {
    return res.json(error('没有找到可删除的账单'));
  }

  const accountIds = [...new Set(bills.map(b => b.account_id))];

  const transaction = db.transaction(() => {
    bills.forEach(bill => {
      db.prepare(`
        UPDATE bills SET is_deleted = 1, updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(bill.id);

      db.prepare(`
        INSERT INTO bill_history (bill_id, user_id, action)
        VALUES (?, ?, 'delete')
      `).run(bill.id, userId);
    });
  });
  transaction();

  accountIds.forEach(accId => updateAccountBalance(accId));

  logger.info(`批量删除账单: userId=${userId}, count=${bills.length}`);
  res.json(success({ deleted: bills.length }, `成功删除${bills.length}条记录`));
}

function updateAccountBalance(accountId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
    FROM bills
    WHERE account_id = ? AND is_deleted = 0
  `).get(accountId);

  const account = db.prepare('SELECT initial_balance FROM accounts WHERE id = ?').get(accountId);
  const totalBalance = formatMoney(result.balance + account.initial_balance);

  db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(totalBalance, accountId);
}

function checkBudgetWarning(userId, categoryId, billTime) {
  const category = db.prepare('SELECT id, parent_id, type FROM categories WHERE id = ?').get(categoryId);
  if (!category || category.type !== 'expense') {
    return null;
  }

  const date = dayjs(billTime);
  const year = date.year();
  const month = date.month() + 1;
  const { BUDGET_WARN_THRESHOLD } = require('../config');

  const budgetCategoryId = category.parent_id || category.id;

  const budget = db.prepare(`
    SELECT * FROM budgets 
    WHERE user_id = ? AND category_id = ? AND year = ? AND month = ?
  `).get(userId, budgetCategoryId, year, month);

  if (!budget) {
    return null;
  }

  const { start, end } = getMonthRange(year, month);
  
  const spent = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? 
      AND b.is_deleted = 0 
      AND b.type = 'expense'
      AND (c.parent_id = ? OR b.category_id = ?)
      AND b.bill_time >= ? AND b.bill_time <= ?
  `).get(userId, budgetCategoryId, budgetCategoryId, start, end).total;

  const ratio = spent / budget.amount;
  let level = 'normal';
  let message = '';

  if (ratio >= 1) {
    level = 'exceed';
    message = `该分类本月支出已超出预算${((ratio - 1) * 100).toFixed(1)}%`;
  } else if (ratio >= BUDGET_WARN_THRESHOLD) {
    level = 'warning';
    message = `该分类本月支出已达预算${(ratio * 100).toFixed(1)}%，请控制支出`;
  }

  return {
    categoryId: budgetCategoryId,
    budget: formatMoney(budget.amount),
    spent: formatMoney(spent),
    remaining: formatMoney(Math.max(0, budget.amount - spent)),
    ratio: Math.round(ratio * 100) / 100,
    level,
    message
  };
}

function getBillHistory(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { page = 1, pageSize = 20 } = req.query;

  const bill = db.prepare('SELECT id FROM bills WHERE id = ? AND user_id = ?').get(id, userId);
  if (!bill) {
    return res.status(404).json(error('账单不存在', 404));
  }

  const offset = (page - 1) * pageSize;

  const count = db.prepare('SELECT COUNT(*) as total FROM bill_history WHERE bill_id = ?').get(id).total;
  const history = db.prepare(`
    SELECT * FROM bill_history 
    WHERE bill_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(id, pageSize, offset);

  history.forEach(h => {
    if (h.old_data) {
      try { h.old_data = JSON.parse(h.old_data); } catch (e) {}
    }
    if (h.new_data) {
      try { h.new_data = JSON.parse(h.new_data); } catch (e) {}
    }
  });

  res.json(paginated(history, count, page, pageSize));
}

module.exports = {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  batchDeleteBills,
  getBillHistory,
  updateAccountBalance,
  checkBudgetWarning
};
