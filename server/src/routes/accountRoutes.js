const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { authMiddleware } = require('../middleware/auth');
const { idempotencyMiddleware } = require('../middleware/idempotency');

router.use(authMiddleware);

router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccountById);
router.post('/', idempotencyMiddleware, accountController.createAccount);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);
router.put('/:id/default', accountController.setDefaultAccount);
router.get('/:accountId/stats', accountController.getAccountStats);

module.exports = router;
