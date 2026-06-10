const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', categoryController.getCategories);
router.get('/list', categoryController.getCategoryList);
router.get('/sub/:parentId', categoryController.getSubCategories);
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.put('/:id/move', categoryController.moveCategory);

module.exports = router;
