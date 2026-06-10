const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/overview', statsController.getOverviewStats);
router.get('/category', statsController.getCategoryStats);
router.get('/trend', statsController.getTrendData);
router.get('/asset-trend', statsController.getAssetTrend);
router.get('/monthly-report', statsController.getMonthlyReport);

module.exports = router;
