'use strict';

const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidator');
const { productSchema, updateProductSchema } = require('../utils/validators');

// All product routes require authentication
router.use(authenticate);

// Special routes (must be before /:id to avoid conflicts)
router.get('/low-stock', productController.getLowStockProducts);
router.get('/stock-value', productController.getStockValue);
router.get('/categories', productController.getCategories);

// CRUD routes
router.get('/', productController.getAllProducts);
router.post('/', validate(productSchema), productController.createProduct);
router.get('/:id', productController.getProduct);
router.put('/:id', validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
