const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'text/comma-separated-values',
      'application/x-csv',
      'text/x-csv',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV格式文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

function uploadErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.json({ code: 400, message: '文件大小不能超过10MB', data: null });
    }
    return res.json({ code: 400, message: '文件上传错误: ' + err.message, data: null });
  }
  if (err) {
    return res.json({ code: 400, message: err.message, data: null });
  }
  next();
}

router.use(authMiddleware);

router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.post('/', idempotencyMiddleware, billController.createBill);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);
router.post('/batch-delete', billController.batchDeleteBills);
router.get('/:id/history', billController.getBillHistory);

router.post('/import', upload.single('file'), uploadErrorHandler, importController.importBills);
router.post('/import/preview', upload.single('file'), uploadErrorHandler, importController.getImportPreview);
router.get('/export/template', importController.exportTemplate);

module.exports = router;
