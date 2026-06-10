const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { formatMoney, getMonthRange } = require('../utils/validator');
const dayjs = require('dayjs');

function getOverviewStats(req, res) {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const now = dayjs();
  const end = endDate ? dayjs(endDate) : now;
  const start = startDate ? dayjs(startDate) : end.subtract(30, 'day');

  const prevStart = start.subtract(start.diff(end, 'day'), 'day');
  const prevEnd = start.subtract(1, 'day');

  const currentStats = calcPeriodStats(userId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  const prevStats = calcPeriodStats(userId, prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'));

  const incomeChange = calcChange(currentStats.total_income, prevStats.total_income);
  const expenseChange = calcChange(currentStats.total_expense, prevStats.total_expense);
  const balanceChange = calcChange(currentStats.net_balance, prevStats.net_balance);

  const accountBalances = db.prepare(`
    SELECT id, name, type, balance
    FROM accounts
    WHERE user_id = ?
    ORDER BY is_default DESC, balance DESC
  `).all(userId);

  accountBalances.forEach(acc => {
    acc.balance = formatMoney(acc.balance);
  });

  const totalAssets = accountBalances.reduce((sum, a) => sum + a.balance, 0);

  res.json(success({
    period: {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      prev_start: prevStart.format('YYYY-MM-DD'),
      prev_end: prevEnd.format('YYYY-MM-DD')
    },
    current: {
      total_income: formatMoney(currentStats.total_income),
      total_expense: formatMoney(currentStats.total_expense),
      net_balance: formatMoney(currentStats.net_balance),
      bill_count: currentStats.bill_count
    },
    previous: {
      total_income: formatMoney(prevStats.total_income),
      total_expense: formatMoney(prevStats.total_expense),
      net_balance: formatMoney(prevStats.net_balance),
      bill_count: prevStats.bill_count
    },
    changes: {
      income: incomeChange,
      expense: expenseChange,
      balance: balanceChange
    },
    total_assets: formatMoney(totalAssets),
    accounts: accountBalances
  }));
}

function calcPeriodStats(userId, startDate, endDate) {
  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COUNT(*) as bill_count
    FROM bills
    WHERE user_id = ? AND is_deleted = 0
      AND bill_time >= ? AND bill_time <= ?
  `).get(userId, startDate + ' 00:00:00', endDate + ' 23:59:59');

  stats.net_balance = stats.total_income - stats.total_expense;
  return stats;
}

function calcChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? { value: 100, is_up: true, is_infinite: true } : { value: 0, is_up: false, is_infinite: false };
  }
  
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return {
    value: Math.round(change * 100) / 100,
    is_up: change >= 0,
    is_infinite: false
  };
}

function getCategoryStats(req, res) {
  const userId = req.user.id;
  const { type = 'expense', year, month } = req.query;

  if (!['income', 'expense'].includes(type)) {
    return res.json(error('类型无效'));
  }

  const targetYear = parseInt(year) || dayjs().year();
  const targetMonth = parseInt(month);

  let startDate, endDate, prevStartDate, prevEndDate;

  if (targetMonth) {
    const range = getMonthRange(targetYear, targetMonth);
    startDate = range.start;
    endDate = range.end;

    const prevDate = dayjs(`${targetYear}-${targetMonth}-01`).subtract(1, 'month');
    const prevRange = getMonthRange(prevDate.year(), prevDate.month() + 1);
    prevStartDate = prevRange.start;
    prevEndDate = prevRange.end;
  } else {
    startDate = `${targetYear}-01-01 00:00:00`;
    endDate = `${targetYear}-12-31 23:59:59`;
    prevStartDate = `${targetYear - 1}-01-01 00:00:00`;
    prevEndDate = `${targetYear - 1}-12-31 23:59:59`;
  }

  const categories = db.prepare(`
    SELECT 
      c.id, c.name, c.icon, c.parent_id, c.level,
      COALESCE(SUM(b.amount), 0) as total,
      COUNT(b.id) as count
    FROM categories c
    LEFT JOIN bills b ON b.category_id = c.id 
      AND b.user_id = ? 
      AND b.is_deleted = 0 
      AND b.type = ?
      AND b.bill_time >= ? AND b.bill_time <= ?
    WHERE c.user_id = ? OR c.user_id IS NULL
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `).all(userId, type, startDate, endDate, userId);

  const prevCategories = db.prepare(`
    SELECT c.id, COALESCE(SUM(b.amount), 0) as total
    FROM categories c
    LEFT JOIN bills b ON b.category_id = c.id 
      AND b.user_id = ? 
      AND b.is_deleted = 0 
      AND b.type = ?
      AND b.bill_time >= ? AND b.bill_time <= ?
    WHERE c.user_id = ? OR c.user_id IS NULL
    GROUP BY c.id
  `).all(userId, type, prevStartDate, prevEndDate, userId);

  const prevMap = {};
  prevCategories.forEach(c => { prevMap[c.id] = c.total; });

  const total = categories.reduce((sum, c) => sum + c.total, 0);

  const result = categories.map(cat => {
    const prevTotal = prevMap[cat.id] || 0;
    const ratio = total > 0 ? cat.total / total : 0;
    const change = calcChange(cat.total, prevTotal);

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      parent_id: cat.parent_id,
      level: cat.level,
      total: formatMoney(cat.total),
      count: cat.count,
      ratio: Math.round(ratio * 10000) / 10000,
      percentage: (ratio * 100).toFixed(1) + '%',
      change
    };
  });

  const yoyStats = calcYoYStats(userId, type, targetYear, targetMonth);

  res.json(success({
    type,
    period: { year: targetYear, month: targetMonth || null },
    total: formatMoney(total),
    count: categories.reduce((sum, c) => sum + c.count, 0),
    categories: result,
    yoy: yoyStats
  }));
}

function calcYoYStats(userId, type, year, month) {
  const currentYear = year;
  const prevYear = year - 1;

  let currentTotal, prevTotal;

  if (month) {
    const currRange = getMonthRange(currentYear, month);
    const prevRange = getMonthRange(prevYear, month);

    currentTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM bills
      WHERE user_id = ? AND is_deleted = 0 AND type = ?
        AND bill_time >= ? AND bill_time <= ?
    `).get(userId, type, currRange.start, currRange.end).total;

    prevTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM bills
      WHERE user_id = ? AND is_deleted = 0 AND type = ?
        AND bill_time >= ? AND bill_time <= ?
    `).get(userId, type, prevRange.start, prevRange.end).total;
  } else {
    currentTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM bills
      WHERE user_id = ? AND is_deleted = 0 AND type = ?
        AND bill_time >= ? AND bill_time <= ?
    `).get(userId, type, `${currentYear}-01-01 00:00:00`, `${currentYear}-12-31 23:59:59`).total;

    prevTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM bills
      WHERE user_id = ? AND is_deleted = 0 AND type = ?
        AND bill_time >= ? AND bill_time <= ?
    `).get(userId, type, `${prevYear}-01-01 00:00:00`, `${prevYear}-12-31 23:59:59`).total;
  }

  const yoyChange = calcChange(currentTotal, prevTotal);

  return {
    current: formatMoney(currentTotal),
    previous: formatMoney(prevTotal),
    change: yoyChange
  };
}

function getTrendData(req, res) {
  const userId = req.user.id;
  const { type = 'month', range = '12', accountId } = req.query;

  if (!['day', 'week', 'month', 'year'].includes(type)) {
    return res.json(error('趋势类型无效'));
  }

  const dataPoints = [];
  const now = dayjs();
  const rangeNum = parseInt(range) || 12;

  let formatStr, stepUnit;
  switch (type) {
    case 'day':
      formatStr = 'YYYY-MM-DD';
      stepUnit = 'day';
      break;
    case 'week':
      formatStr = 'YYYY-wo';
      stepUnit = 'week';
      break;
    case 'month':
      formatStr = 'YYYY-MM';
      stepUnit = 'month';
      break;
    case 'year':
      formatStr = 'YYYY';
      stepUnit = 'year';
      break;
  }

  for (let i = rangeNum - 1; i >= 0; i--) {
    const date = now.subtract(i, stepUnit);
    const label = date.format(formatStr);
    
    let start, end;
    if (type === 'day') {
      start = date.startOf('day').format('YYYY-MM-DD HH:mm:ss');
      end = date.endOf('day').format('YYYY-MM-DD HH:mm:ss');
    } else if (type === 'week') {
      start = date.startOf('week').format('YYYY-MM-DD HH:mm:ss');
      end = date.endOf('week').format('YYYY-MM-DD HH:mm:ss');
    } else if (type === 'month') {
      start = date.startOf('month').format('YYYY-MM-DD HH:mm:ss');
      end = date.endOf('month').format('YYYY-MM-DD HH:mm:ss');
    } else {
      start = date.startOf('year').format('YYYY-MM-DD HH:mm:ss');
      end = date.endOf('year').format('YYYY-MM-DD HH:mm:ss');
    }

    let accountCondition = '';
    const params = [userId, start, end];
    if (accountId) {
      accountCondition = 'AND account_id = ?';
      params.push(accountId);
    }

    const stats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM bills
      WHERE user_id = ? AND is_deleted = 0
        AND bill_time >= ? AND bill_time <= ?
        ${accountCondition}
    `).get(...params);

    dataPoints.push({
      label,
      income: formatMoney(stats.income),
      expense: formatMoney(stats.expense),
      balance: formatMoney(stats.income - stats.expense)
    });
  }

  const totalIncome = dataPoints.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = dataPoints.reduce((sum, d) => sum + d.expense, 0);

  res.json(success({
    type,
    range: rangeNum,
    total_income: formatMoney(totalIncome),
    total_expense: formatMoney(totalExpense),
    net_balance: formatMoney(totalIncome - totalExpense),
    data: dataPoints
  }));
}

function getAssetTrend(req, res) {
  const userId = req.user.id;
  const { months = 12 } = req.query;
  const monthCount = parseInt(months) || 12;

  const data = [];
  const now = dayjs();

  for (let i = monthCount - 1; i >= 0; i--) {
    const targetMonth = now.subtract(i, 'month');
    const year = targetMonth.year();
    const month = targetMonth.month() + 1;
    const label = targetMonth.format('YYYY-MM');
    const { end } = getMonthRange(year, month);

    const accountBalances = db.prepare(`
      SELECT id, initial_balance
      FROM accounts
      WHERE user_id = ?
    `).all(userId);

    let totalBalance = 0;
    accountBalances.forEach(acc => {
      const billsTotal = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as total
        FROM bills
        WHERE account_id = ? AND is_deleted = 0
          AND bill_time <= ?
      `).get(acc.id, end).total;
      
      totalBalance += acc.initial_balance + billsTotal;
    });

    const assetValue = db.prepare(`
      SELECT COALESCE(SUM(value), 0) as total
      FROM assets
      WHERE user_id = ? AND created_at <= ?
    `).get(userId, end).total;

    data.push({
      label,
      cash_balance: formatMoney(totalBalance),
      asset_value: formatMoney(assetValue),
      total_assets: formatMoney(totalBalance + assetValue)
    });
  }

  res.json(success({
    months: monthCount,
    data
  }));
}

function getMonthlyReport(req, res) {
  const userId = req.user.id;
  const { year, month } = req.query;

  const targetYear = parseInt(year) || dayjs().year();
  const targetMonth = parseInt(month) || dayjs().month() + 1;

  const { start, end } = getMonthRange(targetYear, targetMonth);

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COUNT(*) as bill_count,
      COUNT(DISTINCT account_id) as account_count
    FROM bills
    WHERE user_id = ? AND is_deleted = 0
      AND bill_time >= ? AND bill_time <= ?
  `).get(userId, start, end);

  const prevMonth = dayjs(`${targetYear}-${targetMonth}-01`).subtract(1, 'month');
  const prevRange = getMonthRange(prevMonth.year(), prevMonth.month() + 1);

  const prevStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
    FROM bills
    WHERE user_id = ? AND is_deleted = 0
      AND bill_time >= ? AND bill_time <= ?
  `).get(userId, prevRange.start, prevRange.end);

  const lastYearSameMonth = dayjs(`${targetYear}-${targetMonth}-01`).subtract(1, 'year');
  const yoyRange = getMonthRange(lastYearSameMonth.year(), lastYearSameMonth.month() + 1);

  const yoyStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
    FROM bills
    WHERE user_id = ? AND is_deleted = 0
      AND bill_time >= ? AND bill_time <= ?
  `).get(userId, yoyRange.start, yoyRange.end);

  const topExpenseCategories = db.prepare(`
    SELECT c.id, c.name, c.icon, SUM(b.amount) as total, COUNT(b.id) as count
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_deleted = 0 AND b.type = 'expense'
      AND b.bill_time >= ? AND b.bill_time <= ?
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT 10
  `).all(userId, start, end);

  topExpenseCategories.forEach(cat => {
    cat.total = formatMoney(cat.total);
    cat.percentage = stats.total_expense > 0 
      ? ((cat.total / stats.total_expense) * 100).toFixed(1) + '%'
      : '0%';
  });

  const dailyData = [];
  const daysInMonth = dayjs(`${targetYear}-${targetMonth}-01`).daysInMonth();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStart = dayjs(`${targetYear}-${targetMonth}-${day}`).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const dayEnd = dayjs(`${targetYear}-${targetMonth}-${day}`).endOf('day').format('YYYY-MM-DD HH:mm:ss');

    const dayStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM bills
      WHERE user_id = ? AND is_deleted = 0
        AND bill_time >= ? AND bill_time <= ?
    `).get(userId, dayStart, dayEnd);

    dailyData.push({
      day,
      income: formatMoney(dayStats.income),
      expense: formatMoney(dayStats.expense)
    });
  }

  res.json(success({
    year: targetYear,
    month: targetMonth,
    summary: {
      total_income: formatMoney(stats.total_income),
      total_expense: formatMoney(stats.total_expense),
      net_balance: formatMoney(stats.total_income - stats.total_expense),
      bill_count: stats.bill_count,
      account_count: stats.account_count
    },
    mom: {
      income: calcChange(stats.total_income, prevStats.total_income),
      expense: calcChange(stats.total_expense, prevStats.total_expense),
      prev_income: formatMoney(prevStats.total_income),
      prev_expense: formatMoney(prevStats.total_expense)
    },
    yoy: {
      income: calcChange(stats.total_income, yoyStats.total_income),
      expense: calcChange(stats.total_expense, yoyStats.total_expense),
      prev_income: formatMoney(yoyStats.total_income),
      prev_expense: formatMoney(yoyStats.total_expense)
    },
    top_categories: topExpenseCategories,
    daily_data: dailyData
  }));
}

module.exports = {
  getOverviewStats,
  getCategoryStats,
  getTrendData,
  getAssetTrend,
  getMonthlyReport
};
