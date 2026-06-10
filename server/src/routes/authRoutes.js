const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { idempotencyMiddleware } = require('../middleware/idempotency');

router.post('/register', idempotencyMiddleware, authController.register);
router.post('/login', idempotencyMiddleware, authController.login);
router.get('/profile', authMiddleware, authController.getCurrentUser);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/password', authMiddleware, authController.changePassword);

module.exports = router;
