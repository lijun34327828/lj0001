const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');
const { generateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/validator');

function register(req, res) {
  const { username, password, nickname } = req.body;

  if (!username || !password) {
    return res.json(error('用户名和密码不能为空'));
  }

  if (username.length < 3 || username.length > 20) {
    return res.json(error('用户名长度需在3-20个字符之间'));
  }

  if (password.length < 6 || password.length > 32) {
    return res.json(error('密码长度需在6-32个字符之间'));
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.json(error('用户名已存在'));
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const cleanNickname = nickname ? sanitizeString(nickname, 50) : username;

  const result = db.prepare(`
    INSERT INTO users (username, password, nickname)
    VALUES (?, ?, ?)
  `).run(username, hashedPassword, cleanNickname);

  const userId = result.lastInsertRowid;

  db.prepare(`
    INSERT INTO accounts (user_id, name, type, balance, initial_balance, is_default, description)
    VALUES (?, ?, 'general', 0, 0, 1, '默认账户')
  `).run(userId, '默认账户');

  initDefaultCategories(userId);

  logger.info(`用户注册成功: ${username}`);

  const token = generateToken({ id: userId, username });
  res.json(success({
    token,
    user: {
      id: userId,
      username,
      nickname: cleanNickname,
      role: 'user'
    }
  }, '注册成功'));
}

function initDefaultCategories(userId) {
  const defaultCategories = [
    { name: '餐饮', type: 'expense', parent_id: 0, icon: '🍜' },
    { name: '交通', type: 'expense', parent_id: 0, icon: '🚗' },
    { name: '购物', type: 'expense', parent_id: 0, icon: '🛒' },
    { name: '娱乐', type: 'expense', parent_id: 0, icon: '🎮' },
    { name: '居住', type: 'expense', parent_id: 0, icon: '🏠' },
    { name: '医疗', type: 'expense', parent_id: 0, icon: '💊' },
    { name: '教育', type: 'expense', parent_id: 0, icon: '📚' },
    { name: '其他支出', type: 'expense', parent_id: 0, icon: '📦' },
    { name: '工资', type: 'income', parent_id: 0, icon: '💰' },
    { name: '奖金', type: 'income', parent_id: 0, icon: '🎁' },
    { name: '投资收益', type: 'income', parent_id: 0, icon: '📈' },
    { name: '其他收入', type: 'income', parent_id: 0, icon: '💎' }
  ];

  const insert = db.prepare(`
    INSERT INTO categories (user_id, parent_id, name, type, level, sort, icon)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  const transaction = db.transaction(() => {
    defaultCategories.forEach((cat, index) => {
      insert.run(userId, cat.parent_id, cat.name, cat.type, index, cat.icon);
    });
  });

  transaction();
}

function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json(error('用户名和密码不能为空'));
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.json(error('用户名或密码错误'));
  }

  const isValidPassword = bcrypt.compareSync(password, user.password);
  if (!isValidPassword) {
    return res.json(error('用户名或密码错误'));
  }

  const token = generateToken({ id: user.id, username: user.username });

  logger.info(`用户登录: ${username}`);

  res.json(success({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role
    }
  }, '登录成功'));
}

function getCurrentUser(req, res) {
  const userId = req.user.id;

  const user = db.prepare('SELECT id, username, nickname, role, created_at FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  res.json(success(user));
}

function updateProfile(req, res) {
  const userId = req.user.id;
  const { nickname } = req.body;

  if (nickname) {
    const cleanNickname = sanitizeString(nickname, 50);
    db.prepare('UPDATE users SET nickname = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(cleanNickname, userId);
  }

  const user = db.prepare('SELECT id, username, nickname, role FROM users WHERE id = ?').get(userId);
  res.json(success(user, '更新成功'));
}

function changePassword(req, res) {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.json(error('旧密码和新密码不能为空'));
  }

  if (newPassword.length < 6 || newPassword.length > 32) {
    return res.json(error('新密码长度需在6-32个字符之间'));
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.json(error('旧密码错误'));
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(hashedPassword, userId);

  logger.info(`用户修改密码: userId=${userId}`);
  res.json(success(null, '密码修改成功'));
}

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword
};
