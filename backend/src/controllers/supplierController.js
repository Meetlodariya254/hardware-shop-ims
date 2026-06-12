'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data, error: null, timestamp: new Date().toISOString() });
}

async function getAllSuppliers(req, res, next) {
  try {
    const { page = 1, limit = 25, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user_id = req.user.user_id;

    let params = [user_id];
    let where = 'user_id = $1 AND is_active = 1';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (supplier_name ILIKE $2 OR mobile_number ILIKE $2 OR city ILIKE $2)`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM suppliers WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const pIdx = params.length;
    const result = await query(
      `SELECT s.*,
          (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.supplier_id) AS total_orders,
          (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders po WHERE po.supplier_id = s.supplier_id) AS total_spent
       FROM suppliers s
       WHERE ${where}
       ORDER BY s.supplier_name ASC
       LIMIT $${pIdx - 1} OFFSET $${pIdx}`,
      params
    );

    return successResponse(res, {
      suppliers: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

async function getSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const result = await query(`SELECT * FROM suppliers WHERE supplier_id = $1 AND user_id = $2`, [id, user_id]);
    if (result.rows.length === 0) throw createError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');

    const history = await query(
      `SELECT po.*, 
         (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = po.purchase_id) AS item_count
       FROM purchase_orders po
       WHERE po.supplier_id = $1 AND po.user_id = $2
       ORDER BY po.purchase_date DESC LIMIT 20`,
      [id, user_id]
    );

    const stats = await query(
      `SELECT 
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN total_amount ELSE 0 END), 0) AS pending_amount
       FROM purchase_orders WHERE supplier_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    return successResponse(res, { supplier: result.rows[0], history: history.rows, stats: stats.rows[0] });
  } catch (err) { next(err); }
}

async function createSupplier(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { supplier_name, mobile_number, email, address, city, gst_number, bank_account, balance } = req.body;

    const result = await query(
      `INSERT INTO suppliers (user_id, supplier_name, mobile_number, email, address, city, gst_number, bank_account, balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [user_id, supplier_name, mobile_number || null, email || null, address || null, city || null, gst_number || null, bank_account || null, balance || 0]
    );
    return successResponse(res, result.rows[0], 'Supplier added successfully', 201);
  } catch (err) { next(err); }
}

async function updateSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    const { supplier_name, mobile_number, email, address, city, gst_number, bank_account, balance } = req.body;

    const result = await query(
      `UPDATE suppliers SET
         supplier_name = COALESCE($1, supplier_name), mobile_number = COALESCE($2, mobile_number),
         email = COALESCE($3, email), address = COALESCE($4, address), city = COALESCE($5, city),
         gst_number = COALESCE($6, gst_number), bank_account = COALESCE($7, bank_account),
         balance = COALESCE($8, balance), updated_at = NOW()
       WHERE supplier_id = $9 AND user_id = $10 RETURNING *`,
      [supplier_name || null, mobile_number, email, address, city, gst_number, bank_account, balance ?? null, id, user_id]
    );
    if (result.rows.length === 0) throw createError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    return successResponse(res, result.rows[0], 'Supplier updated successfully');
  } catch (err) { next(err); }
}

async function deleteSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    // Check for existing purchases
    const purchases = await query(
      'SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = $1 AND user_id = $2', [id, user_id]
    );
    if (parseInt(purchases.rows[0].count) > 0) {
      // Soft delete instead of hard delete when there are purchase records
      await query('UPDATE suppliers SET is_active = 0 WHERE supplier_id = $1 AND user_id = $2', [id, user_id]);
      return successResponse(res, null, 'Supplier deactivated (has purchase history)');
    }
    const result = await query('DELETE FROM suppliers WHERE supplier_id = $1 AND user_id = $2 RETURNING supplier_id', [id, user_id]);
    if (result.rows.length === 0) throw createError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    return successResponse(res, null, 'Supplier deleted successfully');
  } catch (err) { next(err); }
}

module.exports = { getAllSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
