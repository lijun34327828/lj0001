const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { sanitizeString } = require('../utils/validator');

function getCategories(req, res) {
  const userId = req.user.id;
  const { type } = req.query;

  let sql = 'SELECT * FROM categories WHERE user_id = ?';
  const params = [userId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY sort ASC, id ASC';

  const categories = db.prepare(sql).all(...params);
  
  const tree = buildCategoryTree(categories);

  res.json(success(tree));
}

function buildCategoryTree(categories) {
  const map = {};
  const roots = [];

  categories.forEach(cat => {
    map[cat.id] = { ...cat, children: [] };
  });

  categories.forEach(cat => {
    if (cat.parent_id === 0 || !map[cat.parent_id]) {
      roots.push(map[cat.id]);
    } else {
      map[cat.parent_id].children.push(map[cat.id]);
    }
  });

  return roots;
}

function getCategoryList(req, res) {
  const userId = req.user.id;
  const { type, parentId } = req.query;

  let sql = 'SELECT * FROM categories WHERE user_id = ?';
  const params = [userId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  if (parentId !== undefined) {
    sql += ' AND parent_id = ?';
    params.push(Number(parentId));
  }

  sql += ' ORDER BY sort ASC, id ASC';

  const categories = db.prepare(sql).all(...params);

  res.json(success(categories));
}

function createCategory(req, res) {
  const userId = req.user.id;
  const { name, type, parent_id = 0, icon = '' } = req.body;

  if (!name || name.trim().length === 0) {
    return res.json(error('分类名称不能为空'));
  }

  if (!type || !['income', 'expense'].includes(type)) {
    return res.json(error('分类类型无效'));
  }

  const cleanName = sanitizeString(name, 30);
  const cleanIcon = sanitizeString(icon, 10);
  const parentId = Number(parent_id) || 0;

  let level = 1;
  if (parentId > 0) {
    const parent = db.prepare('SELECT id, level, type FROM categories WHERE id = ? AND user_id = ?')
      .get(parentId, userId);
    
    if (!parent) {
      return res.json(error('父级分类不存在'));
    }
    
    if (parent.type !== type) {
      return res.json(error('子分类类型必须与父分类一致'));
    }
    
    level = parent.level + 1;
    
    if (level > 3) {
      return res.json(error('分类最多支持三级'));
    }
  }

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) as max_sort FROM categories WHERE user_id = ? AND parent_id = ?')
    .get(userId, parentId).max_sort;

  const result = db.prepare(`
    INSERT INTO categories (user_id, parent_id, name, type, level, sort, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, parentId, cleanName, type, level, maxSort + 1, cleanIcon);

  logger.info(`创建分类: userId=${userId}, categoryId=${result.lastInsertRowid}`);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.json(success(category, '分类创建成功'));
}

function updateCategory(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, icon, sort } = req.body;

  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!category) {
    return res.status(404).json(error('分类不存在', 404));
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    const cleanName = sanitizeString(name, 30);
    if (!cleanName) return res.json(error('分类名称不能为空'));
    updates.push('name = ?');
    params.push(cleanName);
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push(sanitizeString(icon, 10));
  }
  if (sort !== undefined) {
    updates.push('sort = ?');
    params.push(Number(sort) || 0);
  }

  if (updates.length === 0) {
    return res.json(success(category));
  }

  params.push(id, userId);
  db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...params);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  logger.info(`更新分类: userId=${userId}, categoryId=${id}`);
  res.json(success(updated, '更新成功'));
}

function deleteCategory(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!category) {
    return res.status(404).json(error('分类不存在', 404));
  }

  const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(id).count;
  if (childCount > 0) {
    return res.json(error('该分类下有子分类，无法删除'));
  }

  const billCount = db.prepare('SELECT COUNT(*) as count FROM bills WHERE category_id = ? AND is_deleted = 0')
    .get(id).count;
  
  if (billCount > 0) {
    return res.json(error('该分类下有账单记录，无法删除'));
  }

  const budgetCount = db.prepare('SELECT COUNT(*) as count FROM budgets WHERE category_id = ?').get(id).count;
  if (budgetCount > 0) {
    return res.json(error('该分类下有预算设置，无法删除'));
  }

  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);

  logger.info(`删除分类: userId=${userId}, categoryId=${id}`);
  res.json(success(null, '删除成功'));
}

function getSubCategories(req, res) {
  const userId = req.user.id;
  const { parentId } = req.params;

  const categories = db.prepare(`
    SELECT * FROM categories 
    WHERE user_id = ? AND parent_id = ?
    ORDER BY sort ASC, id ASC
  `).all(userId, Number(parentId));

  res.json(success(categories));
}

function moveCategory(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { direction } = req.body;

  if (!['up', 'down'].includes(direction)) {
    return res.json(error('移动方向无效'));
  }

  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!category) {
    return res.status(404).json(error('分类不存在', 404));
  }

  const siblings = db.prepare(`
    SELECT * FROM categories 
    WHERE user_id = ? AND parent_id = ?
    ORDER BY sort ASC, id ASC
  `).all(userId, category.parent_id);

  const currentIndex = siblings.findIndex(c => c.id === category.id);
  if (currentIndex === -1) {
    return res.json(error('分类不存在'));
  }

  let targetIndex;
  if (direction === 'up' && currentIndex > 0) {
    targetIndex = currentIndex - 1;
  } else if (direction === 'down' && currentIndex < siblings.length - 1) {
    targetIndex = currentIndex + 1;
  } else {
    return res.json(success(null, '无需移动'));
  }

  const target = siblings[targetIndex];

  const transaction = db.transaction(() => {
    db.prepare('UPDATE categories SET sort = ? WHERE id = ?').run(target.sort, category.id);
    db.prepare('UPDATE categories SET sort = ? WHERE id = ?').run(category.sort, target.id);
  });
  transaction();

  logger.info(`移动分类: userId=${userId}, categoryId=${id}, direction=${direction}`);
  res.json(success(null, '移动成功'));
}

module.exports = {
  getCategories,
  getCategoryList,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubCategories,
  moveCategory
};
