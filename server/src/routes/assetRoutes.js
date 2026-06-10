const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', assetController.getAssets);
router.get('/stats', assetController.getAssetStats);
router.get('/:id', assetController.getAssetById);
router.post('/', assetController.createAsset);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);
router.post('/:id/lock', assetController.lockAsset);
router.post('/:id/unlock', assetController.unlockAsset);

module.exports = router;
