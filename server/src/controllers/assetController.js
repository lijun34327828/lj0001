const db = require('../db');
const logger = require('../utils/logger');
const { success, error, paginated } = require('../utils/response');
const { formatMoney, sanitizeString, isValidDate } = require('../utils/validator');
const dayjs = require('dayjs');

const LOCK_TIMEOUT = 30 * 60 * 1000;

function getAssets(req, res) {
  const userId = req.user.id;
  let { 
    page = 1, 
    pageSize = 20, 
    type,
    accountId,
    keyword,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  page = parseInt(page) || 1;
  pageSize = parseInt(pageSize) || 20;
  pageSize = Math.min(pageSize, 100);

  const whereClauses = ['a.user_id = ?'];
  const params = [userId];

  if (type) {
    whereClauses.push('a.type = ?');
    params.push(type);
  }

  if (accountId) {
    whereClauses.push('a.account_id = ?');
    params.push(Number(accountId));
  }

  if (keyword) {
    const cleanKeyword = sanitizeString(keyword, 100);
    if (cleanKeyword) {
      whereClauses.push('(a.name LIKE ? OR a.description LIKE ?)');
      params.push(`%${cleanKeyword}%`, `%${cleanKeyword}%`);
    }
  }

  const validSortFields = ['created_at', 'value', 'current_value', 'name'];
  const validSortOrders = ['asc', 'desc'];
  if (!validSortFields.includes(sortBy)) sortBy = 'created_at';
  if (!validSortOrders.includes(sortOrder)) sortOrder = 'desc';

  const whereSql = whereClauses.join(' AND ');
  const offset = (page - 1) * pageSize;

  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM assets a WHERE ${whereSql}
  `).get(...params);

  const assets = db.prepare(`
    SELECT a.*, acc.name as account_name,
           CASE 
             WHEN a.is_locked = 1 AND (a.locked_at IS NULL OR (strftime('%s', 'now') - strftime('%s', a.locked_at)) * 1000 < ?) THEN 1
             ELSE 0
           END as is_active_locked
    FROM assets a
    LEFT JOIN accounts acc ON a.account_id = acc.id
    WHERE ${whereSql}
    ORDER BY a.${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, LOCK_TIMEOUT, pageSize, offset);

  assets.forEach(asset => {
    asset.value = formatMoney(asset.value);
    asset.current_value = formatMoney(asset.current_value);
    asset.depreciation_rate = asset.depreciation_rate || 0;
  });

  res.json(paginated(assets, countResult.total, page, pageSize));
}

function getAssetById(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const asset = db.prepare(`
    SELECT a.*, acc.name as account_name,
           CASE 
             WHEN a.is_locked = 1 AND a.locked_by != ? 
                  AND (a.locked_at IS NULL OR (strftime('%s', 'now') - strftime('%s', a.locked_at)) * 1000 < ?) 
             THEN 1 ELSE 0
           END as is_locked_by_other,
           CASE 
             WHEN a.is_locked = 1 AND a.locked_by = ? THEN 1
             ELSE 0
           END as is_locked_by_self
    FROM assets a
    LEFT JOIN accounts acc ON a.account_id = acc.id
    WHERE a.id = ? AND a.user_id = ?
  `).get(userId, LOCK_TIMEOUT, userId, id, userId);

  if (!asset) {
    return res.status(404).json(error('资产不存在', 404));
  }

  asset.value = formatMoney(asset.value);
  asset.current_value = formatMoney(asset.current_value);

  res.json(success(asset));
}

function createAsset(req, res) {
  const userId = req.user.id;
  const { 
    account_id, 
    name, 
    type = 'fixed', 
    value, 
    purchase_date = null,
    depreciation_rate = 0,
    description = ''
  } = req.body;

  if (!account_id) {
    return res.json(error('请选择所属账户'));
  }

  if (!name || name.trim().length === 0) {
    return res.json(error('资产名称不能为空'));
  }

  const numValue = Number(value);
  if (isNaN(numValue) || numValue < 0 || numValue > 999999999.99) {
    return res.json(error('资产价值不合法'));
  }

  const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ? AND user_id = ?')
    .get(account_id, userId);
  if (!account) {
    return res.json(error('账户不存在或无权访问'));
  }

  const cleanName = sanitizeString(name, 100);
  const cleanDesc = sanitizeString(description, 500);
  const finalValue = formatMoney(numValue);
  const depRate = Math.min(100, Math.max(0, Number(depreciation_rate) || 0));

  let purchaseDate = null;
  if (purchase_date && isValidDate(purchase_date)) {
    purchaseDate = dayjs(purchase_date).format('YYYY-MM-DD');
  }

  const currentValue = calculateCurrentValue(finalValue, depRate, purchaseDate);

  const result = db.prepare(`
    INSERT INTO assets (user_id, account_id, name, type, value, purchase_date, 
                       depreciation_rate, current_value, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, account_id, cleanName, type, finalValue, purchaseDate, depRate, currentValue, cleanDesc);

  logger.info(`创建资产: userId=${userId}, assetId=${result.lastInsertRowid}, name=${cleanName}`);

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);
  asset.value = formatMoney(asset.value);
  asset.current_value = formatMoney(asset.current_value);

  res.json(success(asset, '资产创建成功'));
}

function calculateCurrentValue(originalValue, depreciationRate, purchaseDate) {
  if (!purchaseDate || depreciationRate <= 0) {
    return originalValue;
  }

  const years = dayjs().diff(dayjs(purchaseDate), 'year', true);
  if (years <= 0) return originalValue;

  const depreciated = originalValue * (1 - depreciationRate / 100) ** years;
  return formatMoney(Math.max(0, depreciated));
}

function updateAsset(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!asset) {
    return res.status(404).json(error('资产不存在', 404));
  }

  if (asset.is_locked && asset.locked_by !== userId) {
    const lockTime = asset.locked_at ? dayjs(asset.locked_at).valueOf() : 0;
    if (Date.now() - lockTime < LOCK_TIMEOUT) {
      return res.status(409).json(error('资产正在被其他用户编辑，请稍后再试', 409));
    }
  }

  const { 
    account_id, 
    name, 
    type, 
    value, 
    purchase_date,
    depreciation_rate,
    description
  } = req.body;

  const updates = [];
  const params = [];

  if (account_id !== undefined && account_id !== asset.account_id) {
    const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ? AND user_id = ?')
      .get(account_id, userId);
    if (!account) {
      return res.json(error('账户不存在或无权访问'));
    }
    updates.push('account_id = ?');
    params.push(Number(account_id));
  }

  if (name !== undefined) {
    const cleanName = sanitizeString(name, 100);
    if (!cleanName) return res.json(error('资产名称不能为空'));
    updates.push('name = ?');
    params.push(cleanName);
  }

  if (type !== undefined) {
    updates.push('type = ?');
    params.push(type);
  }

  if (value !== undefined) {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 999999999.99) {
      return res.json(error('资产价值不合法'));
    }
    updates.push('value = ?');
    params.push(formatMoney(numValue));
  }

  if (purchase_date !== undefined) {
    if (purchase_date && !isValidDate(purchase_date)) {
      return res.json(error('购买日期无效'));
    }
    updates.push('purchase_date = ?');
    params.push(purchase_date ? dayjs(purchase_date).format('YYYY-MM-DD') : null);
  }

  if (depreciation_rate !== undefined) {
    const depRate = Math.min(100, Math.max(0, Number(depreciation_rate) || 0));
    updates.push('depreciation_rate = ?');
    params.push(depRate);
  }

  if (description !== undefined) {
    updates.push('description = ?');
    params.push(sanitizeString(description, 500));
  }

  if (updates.length === 0) {
    return res.json(success(asset, '无需更新'));
  }

  updates.push('updated_at = datetime(\'now\',\'localtime\')');
  updates.push('is_locked = 0');
  updates.push('locked_by = NULL');
  updates.push('locked_at = NULL');
  params.push(id, userId);

  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...params);

  const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  
  const newCurrentValue = calculateCurrentValue(
    updated.value,
    updated.depreciation_rate,
    updated.purchase_date
  );
  
  if (newCurrentValue !== updated.current_value) {
    db.prepare('UPDATE assets SET current_value = ? WHERE id = ?').run(newCurrentValue, id);
    updated.current_value = newCurrentValue;
  }

  updated.value = formatMoney(updated.value);
  updated.current_value = formatMoney(updated.current_value);

  logger.info(`更新资产: userId=${userId}, assetId=${id}`);
  res.json(success(updated, '更新成功'));
}

function deleteAsset(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!asset) {
    return res.status(404).json(error('资产不存在', 404));
  }

  if (asset.is_locked && asset.locked_by !== userId) {
    const lockTime = asset.locked_at ? dayjs(asset.locked_at).valueOf() : 0;
    if (Date.now() - lockTime < LOCK_TIMEOUT) {
      return res.status(409).json(error('资产正在被其他用户编辑，请稍后再试', 409));
    }
  }

  db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(id, userId);

  logger.info(`删除资产: userId=${userId}, assetId=${id}`);
  res.json(success(null, '删除成功'));
}

function lockAsset(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!asset) {
    return res.status(404).json(error('资产不存在', 404));
  }

  if (asset.is_locked && asset.locked_by !== userId) {
    const lockTime = asset.locked_at ? dayjs(asset.locked_at).valueOf() : 0;
    const remaining = LOCK_TIMEOUT - (Date.now() - lockTime);
    
    if (remaining > 0) {
      return res.status(409).json({
        code: 409,
        message: '资产正在被其他用户编辑',
        data: {
          lockedBy: asset.locked_by,
          remainingSeconds: Math.ceil(remaining / 1000)
        }
      });
    }
  }

  db.prepare(`
    UPDATE assets 
    SET is_locked = 1, locked_by = ?, locked_at = datetime('now','localtime')
    WHERE id = ? AND user_id = ?
  `).run(userId, id, userId);

  logger.info(`锁定资产: userId=${userId}, assetId=${id}`);
  res.json(success({ locked: true, expiresIn: LOCK_TIMEOUT / 1000 }, '资产已锁定'));
}

function unlockAsset(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!asset) {
    return res.status(404).json(error('资产不存在', 404));
  }

  if (asset.is_locked && asset.locked_by !== userId) {
    return res.status(403).json(error('无权解除其他用户的锁定', 403));
  }

  db.prepare(`
    UPDATE assets 
    SET is_locked = 0, locked_by = NULL, locked_at = NULL
    WHERE id = ? AND user_id = ?
  `).run(id, userId);

  logger.info(`解锁资产: userId=${userId}, assetId=${id}`);
  res.json(success(null, '资产已解锁'));
}

function getAssetStats(req, res) {
  const userId = req.user.id;

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(value), 0) as total_value,
      COALESCE(SUM(current_value), 0) as total_current_value,
      COUNT(*) as total_count,
      COALESCE(SUM(CASE WHEN type = 'fixed' THEN value ELSE 0 END), 0) as fixed_value,
      COALESCE(SUM(CASE WHEN type = 'liquid' THEN value ELSE 0 END), 0) as liquid_value,
      COALESCE(SUM(CASE WHEN type = 'intangible' THEN value ELSE 0 END), 0) as intangible_value
    FROM assets
    WHERE user_id = ?
  `).get(userId);

  stats.total_value = formatMoney(stats.total_value);
  stats.total_current_value = formatMoney(stats.total_current_value);
  stats.total_depreciation = formatMoney(stats.total_value - stats.total_current_value);
  stats.depreciation_ratio = stats.total_value > 0 
    ? Math.round((1 - stats.total_current_value / stats.total_value) * 10000) / 10000
    : 0;

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count, COALESCE(SUM(value), 0) as value, COALESCE(SUM(current_value), 0) as current_value
    FROM assets
    WHERE user_id = ?
    GROUP BY type
    ORDER BY value DESC
  `).all(userId);

  byType.forEach(item => {
    item.value = formatMoney(item.value);
    item.current_value = formatMoney(item.current_value);
  });

  const byAccount = db.prepare(`
    SELECT a.id as account_id, a.name as account_name, 
           COUNT(ast.id) as count, 
           COALESCE(SUM(ast.value), 0) as value,
           COALESCE(SUM(ast.current_value), 0) as current_value
    FROM accounts a
    LEFT JOIN assets ast ON a.id = ast.account_id AND ast.user_id = a.user_id
    WHERE a.user_id = ?
    GROUP BY a.id
    ORDER BY value DESC
  `).all(userId);

  byAccount.forEach(item => {
    item.value = formatMoney(item.value);
    item.current_value = formatMoney(item.current_value);
  });

  res.json(success({
    overview: stats,
    byType,
    byAccount
  }));
}

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  lockAsset,
  unlockAsset,
  getAssetStats
};
