'use strict';

const express = require('express');

// Route modules
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');

const supplierController = require('../controllers/supplierController');
const purchaseController = require('../controllers/purchaseController');
const customerController = require('../controllers/customerController');
const salesController = require('../controllers/salesController');
const reportController = require('../controllers/reportController');
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidator');
const { supplierSchema, purchaseOrderSchema, customerSchema, salesOrderSchema } = require('../utils/validators');

const router = express.Router();

// Auth
router.use('/auth', authRoutes);

// Products
router.use('/products', productRoutes);

// Suppliers
router.get('/suppliers', authenticate, supplierController.getAllSuppliers);
router.post('/suppliers', authenticate, validate(supplierSchema), supplierController.createSupplier);
router.get('/suppliers/:id', authenticate, supplierController.getSupplier);
router.put('/suppliers/:id', authenticate, supplierController.updateSupplier);
router.delete('/suppliers/:id', authenticate, supplierController.deleteSupplier);

// Purchases
router.get('/purchases', authenticate, purchaseController.getAllPurchases);
router.post('/purchases', authenticate, validate(purchaseOrderSchema), purchaseController.createPurchase);
router.get('/purchases/:id', authenticate, purchaseController.getPurchase);
router.put('/purchases/:id', authenticate, purchaseController.updatePurchase);
router.delete('/purchases/:id', authenticate, purchaseController.deletePurchase);

// Customers
router.get('/customers', authenticate, customerController.getAllCustomers);
router.post('/customers', authenticate, validate(customerSchema), customerController.createCustomer);
router.get('/customers/:id', authenticate, customerController.getCustomer);
router.put('/customers/:id', authenticate, customerController.updateCustomer);
router.delete('/customers/:id', authenticate, customerController.deleteCustomer);

// Sales
router.get('/sales', authenticate, salesController.getAllSales);
router.post('/sales', authenticate, validate(salesOrderSchema), salesController.createSale);
router.get('/sales/:id', authenticate, salesController.getSale);
router.put('/sales/:id', authenticate, salesController.updateSale);
router.delete('/sales/:id', authenticate, salesController.deleteSale);

// Reports
router.get('/reports/dashboard', authenticate, reportController.getDashboard);
router.get('/reports/profit', authenticate, reportController.getProfitReport);
router.get('/reports/daily-sales', authenticate, reportController.getDailySalesReport);
router.get('/reports/monthly-sales', authenticate, reportController.getMonthlySalesReport);
router.get('/reports/stock', authenticate, reportController.getStockReport);
router.get('/reports/purchases', authenticate, reportController.getPurchaseReport);
router.get('/reports/pdf', authenticate, reportController.generateReportPDF);

// App Settings (Email / SMTP configuration)
router.get('/settings', authenticate, settingsController.getSettings);
router.put('/settings', authenticate, settingsController.updateSettings);
router.post('/settings/test-email', authenticate, settingsController.testEmail);

module.exports = router;
