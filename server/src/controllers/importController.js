const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { UPLOAD_DIR } = require('../config');
const { 
  isValidAmount, 
  isValidDate, 
  formatMoney, 
  sanitizeString 
} = require('../utils/validator');
const dayjs = require('dayjs');
const { updateAccountBalance } = require('./billController');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function importBills(req, res) {
  const userId = req.user.id;
  const { account_id } = req.body;

  if (!req.file) {
    return res.json(error('请上传CSV文件'));
  }

  if (!account_id) {
    return res.json(error('请选择导入账户'));
  }

  const account = db.prepare('SELECT id, user_id FROM accounts WHERE id = ? AND user_id = ?')
    .get(account_id, userId);
  if (!account) {
    fs.unlinkSync(req.file.path);
    return res.json(error('账户不存在或无权访问'));
  }

  const results = [];
  const errors = [];
  const categoryMap = buildCategoryMap(userId);
  let rowNumber = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      const cleanRow = cleanRowData(row);
      const validation = validateRow(cleanRow, categoryMap, rowNumber);
      
      if (validation.valid) {
        results.push({
          ...cleanRow,
          category_id: validation.categoryId,
          rowNumber
        });
      } else {
        errors.push({
          row: rowNumber,
          ...cleanRow,
          error: validation.error
        });
      }
    })
    .on('end', () => {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}

      if (results.length === 0) {
        return res.json(error('没有可导入的有效数据', 400));
      }

      const importResult = performImport(results, userId, account_id, errors);

      logger.info(`账单导入: userId=${userId}, total=${rowNumber}, success=${importResult.success}, failed=${errors.length}`);

      res.json(success({
        total: rowNumber,
        success: importResult.success,
        failed: errors.length,
        errors: errors.slice(0, 50),
        preview: importResult.preview
      }, `导入完成，成功${importResult.success}条，失败${errors.length}条`));
    })
    .on('error', (err) => {
      logger.error('CSV解析错误:', err);
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      res.status(500).json(error('文件解析失败'));
    });
}

function cleanRowData(row) {
  const cleaned = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      cleaned[key.trim()] = String(row[key]).trim();
    }
  }
  return cleaned;
}

function validateRow(row, categoryMap, rowNumber) {
  const type = (row.type || row['类型'] || row['收支类型'] || '').toLowerCase();
  const category = row.category || row['分类'] || row['类别'] || '';
  const amountStr = row.amount || row['金额'] || '';
  const dateStr = row.date || row['日期'] || row['时间'] || '';
  const description = row.description || row['描述'] || row['备注'] || '';

  if (!type || !['income', 'expense', '收入', '支出'].includes(type)) {
    return { valid: false, error: '收支类型无效' };
  }

  const billType = ['income', '收入'].includes(type) ? 'income' : 'expense';

  const amount = parseFloat(amountStr);
  if (!isValidAmount(amount)) {
    return { valid: false, error: '金额不合法' };
  }

  if (!dateStr || !isValidDate(dateStr)) {
    return { valid: false, error: '日期格式无效' };
  }

  let categoryId = null;
  if (category) {
    const matchedCategory = findCategoryByName(category, categoryMap, billType);
    if (matchedCategory) {
      categoryId = matchedCategory.id;
    }
  }

  if (!categoryId) {
    return { valid: false, error: `分类"${category}"不存在` };
  }

  const categoryInfo = categoryMap.find(c => c.id === categoryId);
  if (categoryInfo && categoryInfo.level === 1) {
    const hasChildren = categoryMap.some(c => c.parent_id === categoryId);
    if (hasChildren) {
      return { valid: false, error: `分类"${category}"是一级分类，请使用子分类` };
    }
  }

  return { 
    valid: true, 
    categoryId,
    billType,
    amount: formatMoney(amount),
    date: dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss'),
    description: sanitizeString(description, 500)
  };
}

function findCategoryByName(name, categoryMap, type) {
  const exactMatch = categoryMap.find(c => 
    c.name === name && c.type === type
  );
  if (exactMatch) return exactMatch;

  const fuzzyMatch = categoryMap.find(c => 
    c.type === type && (c.name.includes(name) || name.includes(c.name))
  );
  return fuzzyMatch || null;
}

function buildCategoryMap(userId) {
  return db.prepare(`
    SELECT id, name, type, level, parent_id 
    FROM categories 
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY level ASC
  `).all(userId);
}

function performImport(results, userId, accountId, errors) {
  const insert = db.prepare(`
    INSERT INTO bills (user_id, account_id, category_id, type, amount, description, bill_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const history = db.prepare(`
    INSERT INTO bill_history (bill_id, user_id, action, new_data)
    VALUES (?, ?, 'import', ?)
  `);

  let successCount = 0;
  const preview = [];

  const transaction = db.transaction(() => {
    results.forEach((item, index) => {
      try {
        const result = insert.run(
          userId,
          accountId,
          item.category_id,
          item.billType || item.type,
          item.amount,
          item.description,
          item.date
        );

        history.run(result.lastInsertRowid, userId, JSON.stringify({
          account_id: accountId,
          category_id: item.category_id,
          type: item.billType || item.type,
          amount: item.amount,
          description: item.description,
          bill_time: item.date
        }));

        successCount++;

        if (index < 10) {
          preview.push({
            id: result.lastInsertRowid,
            type: item.billType || item.type,
            amount: item.amount,
            date: item.date,
            description: item.description
          });
        }
      } catch (err) {
        errors.push({
          row: item.rowNumber,
          error: err.message
        });
      }
    });
  });

  transaction();

  updateAccountBalance(accountId);

  return { success: successCount, preview };
}

function exportTemplate(req, res) {
  const userId = req.user.id;

  const categories = db.prepare(`
    SELECT name, type, level 
    FROM categories 
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY type, level, sort
  `).all(userId);

  const expenseCategories = categories.filter(c => c.type === 'expense' && c.level > 1)
    .map(c => c.name).join('/');
  const incomeCategories = categories.filter(c => c.type === 'income' && c.level > 1)
    .map(c => c.name).join('/');

  const template = `type,category,amount,date,description
支出,餐饮,50.00,2024-01-01 12:00:00,午餐
收入,工资,10000.00,2024-01-01 00:00:00,1月工资
`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=bill_template.csv');
  
  res.write('\uFEFF');
  res.write(template);
  res.end();
}

function getImportPreview(req, res) {
  const userId = req.user.id;

  if (!req.file) {
    return res.json(error('请上传CSV文件'));
  }

  const results = [];
  const errors = [];
  const categoryMap = buildCategoryMap(userId);
  let rowNumber = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      if (rowNumber > 50) return;
      
      const cleanRow = cleanRowData(row);
      const validation = validateRow(cleanRow, categoryMap, rowNumber);
      
      const rowData = {
        row: rowNumber,
        type: validation.billType || (cleanRow.type || cleanRow['类型'] || ''),
        category: cleanRow.category || cleanRow['分类'] || '',
        amount: cleanRow.amount || cleanRow['金额'] || '',
        date: cleanRow.date || cleanRow['日期'] || '',
        description: cleanRow.description || cleanRow['备注'] || ''
      };

      if (validation.valid) {
        results.push(rowData);
      } else {
        errors.push({
          ...rowData,
          error: validation.error
        });
      }
    })
    .on('end', () => {
      try { fs.unlinkSync(req.file.path); } catch (e) {}

      res.json(success({
        preview: results,
        errors: errors,
        totalPreview: results.length + errors.length,
        categoryHint: {
          expense: categoryMap.filter(c => c.type === 'expense').map(c => c.name),
          income: categoryMap.filter(c => c.type === 'income').map(c => c.name)
        }
      }));
    })
    .on('error', (err) => {
      logger.error('CSV预览解析错误:', err);
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      res.status(500).json(error('文件解析失败'));
    });
}

module.exports = {
  importBills,
  exportTemplate,
  getImportPreview
};
