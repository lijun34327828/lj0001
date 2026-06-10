const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { formatMoney, getMonthRange } = require('../utils/validator');
const { BUDGET_WARN_THRESHOLD } = require('../config');
const dayjs = require('dayjs');

function getBudgets(req, res) {
  const userId = req.user.id;
  const { year, month } = req.query;

  const currentYear = parseInt(year) || dayjs().year();
  const currentMonth = parseInt(month) || dayjs().month() + 1;

  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.year = ? AND b.month = ?
    ORDER BY b.id DESC
  `).all(userId, currentYear, currentMonth);

  const { start, end } = getMonthRange(currentYear, currentMonth);

  const budgetsWithSpent = budgets.map(budget => {
    const spent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? 
        AND b.is_deleted = 0 
        AND b.type = 'expense'
        AND (c.parent_id = ? OR b.category_id = ?)
        AND b.bill_time >= ? AND b.bill_time <= ?
    `).get(userId, budget.category_id, budget.category_id, start, end).total;

    const ratio = budget.amount > 0 ? spent / budget.amount : 0;
    let level = 'normal';
    if (ratio >= 1) level = 'exceed';
    else if (ratio >= BUDGET_WARN_THRESHOLD) level = 'warning';

    return {
      ...budget,
      amount: formatMoney(budget.amount),
      spent: formatMoney(spent),
      remaining: formatMoney(Math.max(0, budget.amount - spent)),
      ratio: Math.round(ratio * 10000) / 10000,
      level
    };
  });

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetsWithSpent.reduce((sum, b) => sum + b.spent, 0);

  res.json(success({
    list: budgetsWithSpent,
    total: {
      budget: formatMoney(totalBudget),
      spent: formatMoney(totalSpent),
      remaining: formatMoney(Math.max(0, totalBudget - totalSpent)),
      ratio: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 10000 : 0
    },
    year: currentYear,
    month: currentMonth
  }));
}

function setBudget(req, res) {
  const userId = req.user.id;
  const { category_id, amount, year, month } = req.body;

  if (!category_id) {
    return res.json(error('请选择分类'));
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 0 || numAmount > 999999999.99) {
    return res.json(error('预算金额不合法'));
  }

  const category = db.prepare('SELECT id, user_id, type, level FROM categories WHERE id = ? AND user_id = ?')
    .get(category_id, userId);
  
  if (!category) {
    return res.json(error('分类不存在'));
  }

  if (category.type !== 'expense') {
    return res.json(error('只能为支出分类设置预算'));
  }

  const currentYear = parseInt(year) || dayjs().year();
  const currentMonth = parseInt(month) || dayjs().month() + 1;

  if (currentMonth < 1 || currentMonth > 12) {
    return res.json(error('月份无效'));
  }

  const finalAmount = formatMoney(numAmount);

  const existing = db.prepare(`
    SELECT id FROM budgets 
    WHERE user_id = ? AND category_id = ? AND year = ? AND month = ?
  `).get(userId, category_id, currentYear, currentMonth);

  if (existing) {
    db.prepare(`
      UPDATE budgets 
      SET amount = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(finalAmount, existing.id);
  } else {
    db.prepare(`
      INSERT INTO budgets (user_id, category_id, amount, year, month)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, category_id, finalAmount, currentYear, currentMonth);
  }

  logger.info(`设置预算: userId=${userId}, categoryId=${category_id}, amount=${finalAmount}`);

  const budget = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.category_id = ? AND b.year = ? AND b.month = ?
  `).get(userId, category_id, currentYear, currentMonth);

  budget.amount = formatMoney(budget.amount);

  res.json(success(budget, '预算设置成功'));
}

function deleteBudget(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const budget = db.prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!budget) {
    return res.status(404).json(error('预算不存在', 404));
  }

  db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(id, userId);

  logger.info(`删除预算: userId=${userId}, budgetId=${id}`);
  res.json(success(null, '删除成功'));
}

function getBudgetOverview(req, res) {
  const userId = req.user.id;
  const { year, month } = req.query;

  const currentYear = parseInt(year) || dayjs().year();
  const currentMonth = parseInt(month) || dayjs().month() + 1;
  const { start, end } = getMonthRange(currentYear, currentMonth);

  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.year = ? AND b.month = ?
  `).all(userId, currentYear, currentMonth);

  const warnings = [];

  budgets.forEach(budget => {
    const spent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? 
        AND b.is_deleted = 0 
        AND b.type = 'expense'
        AND (c.parent_id = ? OR b.category_id = ?)
        AND b.bill_time >= ? AND b.bill_time <= ?
    `).get(userId, budget.category_id, budget.category_id, start, end).total;

    const ratio = budget.amount > 0 ? spent / budget.amount : 0;

    if (ratio >= BUDGET_WARN_THRESHOLD) {
      let level = 'warning';
      let message = `已使用${(ratio * 100).toFixed(1)}%`;
      
      if (ratio >= 1) {
        level = 'exceed';
        message = `已超出${((ratio - 1) * 100).toFixed(1)}%`;
      }

      warnings.push({
        category_id: budget.category_id,
        category_name: budget.category_name,
        category_icon: budget.category_icon,
        budget: formatMoney(budget.amount),
        spent: formatMoney(spent),
        remaining: formatMoney(Math.max(0, budget.amount - spent)),
        ratio: Math.round(ratio * 10000) / 10000,
        level,
        message
      });
    }
  });

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalExpense = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM bills
    WHERE user_id = ? AND is_deleted = 0 AND type = 'expense'
      AND bill_time >= ? AND bill_time <= ?
  `).get(userId, start, end).total;

  res.json(success({
    totalBudget: formatMoney(totalBudget),
    totalExpense: formatMoney(totalExpense),
    overallRatio: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 10000) / 10000 : 0,
    warnings,
    warningCount: warnings.length,
    year: currentYear,
    month: currentMonth
  }));
}

function copyBudget(req, res) {
  const userId = req.user.id;
  const { from_year, from_month, to_year, to_month } = req.body;

  if (!from_year || !from_month || !to_year || !to_month) {
    return res.json(error('请选择源月份和目标月份'));
  }

  const sourceBudgets = db.prepare(`
    SELECT * FROM budgets WHERE user_id = ? AND year = ? AND month = ?
  `).all(userId, from_year, from_month);

  if (sourceBudgets.length === 0) {
    return res.json(error('源月份没有预算设置'));
  }

  let copied = 0;
  const transaction = db.transaction(() => {
    sourceBudgets.forEach(budget => {
      const existing = db.prepare(`
        SELECT id FROM budgets 
        WHERE user_id = ? AND category_id = ? AND year = ? AND month = ?
      `).get(userId, budget.category_id, to_year, to_month);

      if (existing) {
        db.prepare(`
          UPDATE budgets SET amount = ?, updated_at = datetime('now','localtime')
          WHERE id = ?
        `).run(budget.amount, existing.id);
      } else {
        db.prepare(`
          INSERT INTO budgets (user_id, category_id, amount, year, month)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, budget.category_id, budget.amount, to_year, to_month);
      }
      copied++;
    });
  });
  transaction();

  logger.info(`复制预算: userId=${userId}, from=${from_year}-${from_month}, to=${to_year}-${to_month}, count=${copied}`);
  res.json(success({ copied }, `成功复制${copied}条预算`));
}

function canAddExpense(req, res) {
  const userId = req.user.id;
  const { category_id, amount } = req.query;

  if (!category_id || !amount) {
    return res.json(success({ canAdd: true }));
  }

  const category = db.prepare('SELECT id, parent_id, type FROM categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
    .get(category_id, userId);
  
  if (!category || category.type !== 'expense') {
    return res.json(success({ canAdd: true }));
  }

  const now = dayjs();
  const { start, end } = getMonthRange(now.year(), now.month() + 1);
  const budgetCategoryId = category.parent_id || category.id;

  const budget = db.prepare(`
    SELECT * FROM budgets 
    WHERE user_id = ? AND category_id = ? AND year = ? AND month = ?
  `).get(userId, budgetCategoryId, now.year(), now.month() + 1);

  if (!budget) {
    return res.json(success({ canAdd: true }));
  }

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

  const newSpent = spent + Number(amount);
  const newRatio = budget.amount > 0 ? newSpent / budget.amount : 0;

  let canAdd = true;
  let reason = '';

  if (newRatio > 1) {
    canAdd = true;
    reason = `添加后将超出预算${((newRatio - 1) * 100).toFixed(1)}%`;
  } else if (newRatio >= BUDGET_WARN_THRESHOLD) {
    reason = `添加后将使用预算的${(newRatio * 100).toFixed(1)}%`;
  }

  res.json(success({
    canAdd,
    reason,
    budget: formatMoney(budget.amount),
    currentSpent: formatMoney(spent),
    newSpent: formatMoney(newSpent),
    ratio: Math.round(newRatio * 10000) / 10000
  }));
}

module.exports = {
  getBudgets,
  setBudget,
  deleteBudget,
  getBudgetOverview,
  copyBudget,
  canAddExpense
};
