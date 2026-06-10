const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', budgetController.getBudgets);
router.get('/overview', budgetController.getBudgetOverview);
router.get('/check', budgetController.canAddExpense);
router.post('/', budgetController.setBudget);
router.delete('/:id', budgetController.deleteBudget);
router.post('/copy', budgetController.copyBudget);

module.exports = router;
