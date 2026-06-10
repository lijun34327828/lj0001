const express = require('express');
const router = express.Router();
const multer = require('multer');
const billController = require('../controllers/billController');
const importController = require('../controllers/importController');
const { authMiddleware } = require('../middleware/auth');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { UPLOAD_DIR } = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.use(authMiddleware);

router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.post('/', idempotencyMiddleware, billController.createBill);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);
router.post('/batch-delete', billController.batchDeleteBills);
router.get('/:id/history', billController.getBillHistory);

router.post('/import', upload.single('file'), importController.importBills);
router.post('/import/preview', upload.single('file'), importController.getImportPreview);
router.get('/export/template', importController.exportTemplate);

module.exports = router;
