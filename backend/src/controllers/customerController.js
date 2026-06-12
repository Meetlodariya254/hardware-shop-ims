'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data, error: null, timestamp: new Date().toISOString() });
}

async function getAllCustomers(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { page = 1, limit = 25, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let params = [user_id];
    let where = 'c.user_id = $1 AND c.is_active = 1';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.customer_name ILIKE $2 OR c.mobile_number ILIKE $2)`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM customers c WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const p = params.length;
    const result = await query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM sales_orders so WHERE so.customer_id = c.customer_id) AS total_purchases,
         (SELECT COALESCE(SUM(final_amount), 0) FROM sales_orders so WHERE so.customer_id = c.customer_id) AS total_spent
       FROM customers c
       WHERE ${where}
       ORDER BY c.customer_name ASC
       LIMIT $${p - 1} OFFSET $${p}`,
      params
    );

    return successResponse(res, {
      customers: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const result = await query('SELECT * FROM customers WHERE customer_id = $1 AND user_id = $2', [id, user_id]);
    if (result.rows.length === 0) throw createError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');

    const history = await query(
      `SELECT so.*, 
         (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = so.sale_id) AS item_count
       FROM sales_orders so WHERE so.customer_id = $1 ORDER BY so.sale_date DESC LIMIT 20`,
      [id]
    );

    const stats = await query(
      `SELECT 
         COUNT(*) AS total_orders,
         COALESCE(SUM(final_amount), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN final_amount ELSE 0 END), 0) AS pending_amount
       FROM sales_orders WHERE customer_id = $1`,
      [id]
    );

    return successResponse(res, { customer: result.rows[0], history: history.rows, stats: stats.rows[0] });
  } catch (err) { next(err); }
}

async function createCustomer(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { customer_name, mobile_number, email, address, city, balance, is_regular } = req.body;

    const result = await query(
      `INSERT INTO customers (user_id, customer_name, mobile_number, email, address, city, balance, is_regular)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user_id, customer_name, mobile_number || null, email || null, address || null, city || null, balance || 0, is_regular || false]
    );
    return successResponse(res, result.rows[0], 'Customer added successfully', 201);
  } catch (err) { next(err); }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    const { customer_name, mobile_number, email, address, city, balance, is_regular } = req.body;

    const result = await query(
      `UPDATE customers SET
         customer_name = COALESCE($1, customer_name), mobile_number = COALESCE($2, mobile_number),
         email = COALESCE($3, email), address = COALESCE($4, address), city = COALESCE($5, city),
         balance = COALESCE($6, balance), is_regular = COALESCE($7, is_regular), updated_at = NOW()
       WHERE customer_id = $8 AND user_id = $9 RETURNING *`,
      [customer_name || null, mobile_number, email, address, city, balance ?? null, is_regular ?? null, id, user_id]
    );
    if (result.rows.length === 0) throw createError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    return successResponse(res, result.rows[0], 'Customer updated');
  } catch (err) { next(err); }
}

async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    await query('UPDATE customers SET is_active = 0 WHERE customer_id = $1 AND user_id = $2', [id, user_id]);
    return successResponse(res, null, 'Customer removed');
  } catch (err) { next(err); }
}

module.exports = { getAllCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
