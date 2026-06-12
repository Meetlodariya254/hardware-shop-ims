'use strict';

const Joi = require('joi');

// ─── Auth Schemas ──────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
  shop_owner_name: Joi.string().min(2).max(255).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'any.required': 'Shop owner name is required',
  }),
  shop_name: Joi.string().max(255).optional().allow(''),
  phone_number: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit Indian number' }),
  address: Joi.string().max(500).optional().allow(''),
  city: Joi.string().max(100).optional().allow(''),
  gst_number: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Please provide a valid GST number' }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  new_password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
  }),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
  }),
});

const updateProfileSchema = Joi.object({
  shop_owner_name: Joi.string().min(2).max(255).optional(),
  shop_name: Joi.string().max(255).optional().allow(''),
  phone_number: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit Indian number' }),
  address: Joi.string().max(500).optional().allow(''),
  city: Joi.string().max(100).optional().allow(''),
  gst_number: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Please provide a valid GST number' }),
});

// ─── Product Schemas ───────────────────────────────────────────────────────────

const UNIT_TYPES = ['pcs', 'kg', 'bag', 'box', 'meter', 'liter', 'bundle', 'roll', 'sheet', 'set', 'pair', 'dozen', 'quintal', 'ton'];
const PRODUCT_CATEGORIES = [
  'Cement & Concrete', 'Steel & Iron', 'Pipes & Fittings', 'Electrical',
  'Paint & Chemicals', 'Wood & Timber', 'Hardware & Fasteners', 'Tools & Equipment',
  'Tiles & Flooring', 'Sanitary & Plumbing', 'Roofing', 'Glass & Mirrors',
  'Adhesives & Sealants', 'Safety Equipment', 'Other'
];

const productSchema = Joi.object({
  product_name: Joi.string().min(3).max(255).required().messages({
    'string.min': 'Product name must be at least 3 characters',
    'any.required': 'Product name is required',
  }),
  category: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Category is required',
  }),
  brand: Joi.string().max(100).optional().allow(null, ''),
  purchase_price: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Purchase price must be greater than 0',
    'any.required': 'Purchase price is required',
  }),
  selling_price: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Selling price must be greater than 0',
    'any.required': 'Selling price is required',
  }),
  current_stock: Joi.number().integer().min(0).default(0),
  minimum_stock_level: Joi.number().integer().min(0).default(10),
  unit_type: Joi.string().valid(...UNIT_TYPES).required().messages({
    'any.only': `Unit type must be one of: ${UNIT_TYPES.join(', ')}`,
    'any.required': 'Unit type is required',
  }),
  sku: Joi.string().max(100).optional().allow(null, ''),
  product_code: Joi.string().max(100).optional().allow(null, ''),
  description: Joi.string().max(1000).optional().allow(null, ''),
});

const updateProductSchema = productSchema.fork(
  ['product_name', 'category', 'purchase_price', 'selling_price', 'unit_type'],
  (schema) => schema.optional()
);

// ─── Supplier Schemas ─────────────────────────────────────────────────────────

const supplierSchema = Joi.object({
  supplier_name: Joi.string().min(3).max(255).required().messages({
    'string.min': 'Supplier name must be at least 3 characters',
    'any.required': 'Supplier name is required',
  }),
  mobile_number: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number' }),
  email: Joi.string().email().optional().allow(''),
  address: Joi.string().max(500).optional().allow(''),
  city: Joi.string().max(100).optional().allow(''),
  gst_number: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Please provide a valid GST number' }),
  bank_account: Joi.string().max(50).optional().allow(''),
});

// ─── Purchase Schemas ──────────────────────────────────────────────────────────

const purchaseItemSchema = Joi.object({
  product_id: Joi.string().min(1).required(),
  quantity_purchased: Joi.number().integer().positive().required(),
  purchase_price_per_unit: Joi.number().positive().required(),
});

const purchaseOrderSchema = Joi.object({
  supplier_id: Joi.string().min(1).required().messages({
    'any.required': 'Supplier is required',
  }),
  purchase_date: Joi.date().required().messages({
    'any.required': 'Purchase date is required',
  }),
  payment_status: Joi.string().valid('Paid', 'Pending', 'Partial').default('Pending'),
  payment_method: Joi.string().valid('Cash', 'Cheque', 'Bank Transfer', 'Credit', 'UPI').optional().allow(null, ''),
  amount_paid: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().allow('').empty('').default(null)
  ).optional().default(null),
  reference_number: Joi.string().max(100).optional().allow(null, ''),
  notes: Joi.string().max(1000).optional().allow(null, ''),
  items: Joi.array().items(purchaseItemSchema).min(1).required().messages({
    'array.min': 'At least one product must be added',
    'any.required': 'Purchase items are required',
  }),
});

// ─── Customer Schemas ──────────────────────────────────────────────────────────

const customerSchema = Joi.object({
  customer_name: Joi.string().min(2).max(255).required().messages({
    'any.required': 'Customer name is required',
  }),
  mobile_number: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow('')
    .messages({ 'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number' }),
  email: Joi.string().email().optional().allow(''),
  address: Joi.string().max(500).optional().allow(''),
  city: Joi.string().max(100).optional().allow(''),
  balance: Joi.number().precision(2).optional().allow(null).default(0),
  is_regular: Joi.boolean().default(false),
});

// ─── Sales Schemas ─────────────────────────────────────────────────────────────

const saleItemSchema = Joi.object({
  product_id: Joi.string().min(1).required(),
  quantity_sold: Joi.number().integer().positive().required(),
  selling_price_per_unit: Joi.number().positive().required(),
});

const salesOrderSchema = Joi.object({
  customer_id: Joi.string().min(1).optional().allow(null, ''),
  walkin_customer_name: Joi.string().max(255).optional().allow(null, ''),
  sale_date: Joi.date().required().messages({
    'any.required': 'Sale date is required',
  }),
  sale_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .allow(null, ''),
  discount_amount: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().allow('').empty('').default(0)
  ).optional().default(0),
  payment_method: Joi.string()
    .valid('Cash', 'Card', 'Cheque', 'Credit', 'UPI')
    .required()
    .messages({ 'any.required': 'Payment method is required' }),
  payment_status: Joi.string().valid('Paid', 'Pending').default('Paid'),
  amount_paid: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().allow('').empty('').default(null)
  ).optional().default(null),
  notes: Joi.string().max(1000).optional().allow(null, ''),
  items: Joi.array().items(saleItemSchema).min(1).required().messages({
    'array.min': 'At least one product must be added',
    'any.required': 'Sale items are required',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  productSchema,
  updateProductSchema,
  supplierSchema,
  purchaseOrderSchema,
  customerSchema,
  salesOrderSchema,
  UNIT_TYPES,
  PRODUCT_CATEGORIES,
};
