'use strict';

const { query, withTransaction } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data, error: null, timestamp: new Date().toISOString() });
}

function generatePurchaseNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${date}-${rand}`;
}

async function getAllPurchases(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { page = 1, limit = 25, from, to, supplier_id, payment_status, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let params = [user_id];
    let where = 'po.user_id = $1';
    let p = 1;

    if (from) { p++; where += ` AND po.purchase_date >= $${p}`; params.push(from); }
    if (to) { p++; where += ` AND po.purchase_date <= $${p}`; params.push(to); }
    if (supplier_id) { p++; where += ` AND po.supplier_id = $${p}`; params.push(supplier_id); }
    if (payment_status) { p++; where += ` AND po.payment_status = $${p}`; params.push(payment_status); }
    if (search) { p++; where += ` AND (s.supplier_name ILIKE $${p} OR po.reference_number ILIKE $${p})`; params.push(`%${search}%`); }

    const countResult = await query(
      `SELECT COUNT(*) FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id WHERE ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    p++; params.push(parseInt(limit));
    p++; params.push(offset);

    const result = await query(
      `SELECT po.*, s.supplier_name, s.mobile_number as supplier_mobile,
         (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = po.purchase_id) AS item_count,
         (SELECT group_concat(p.product_name, ', ') FROM purchase_items pi JOIN products p ON pi.product_id = p.product_id WHERE pi.purchase_id = po.purchase_id) AS item_names
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.supplier_id
       WHERE ${where}
       ORDER BY po.purchase_date DESC, po.created_at DESC
       LIMIT $${p - 1} OFFSET $${p}`,
      params
    );

    return successResponse(res, {
      purchases: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

async function getPurchase(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const poResult = await query(
      `SELECT po.*, s.supplier_name, s.mobile_number as supplier_mobile, s.address as supplier_address,
              s.gst_number as supplier_gst, s.email as supplier_email
       FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id
       WHERE po.purchase_id = $1 AND po.user_id = $2`,
      [id, user_id]
    );
    if (poResult.rows.length === 0) throw createError('Purchase order not found', 404, 'PO_NOT_FOUND');

    const itemsResult = await query(
      `SELECT pi.*, p.product_name, p.category, p.unit_type, p.sku
       FROM purchase_items pi JOIN products p ON pi.product_id = p.product_id
       WHERE pi.purchase_id = $1`,
      [id]
    );

    return successResponse(res, { purchase: poResult.rows[0], items: itemsResult.rows });
  } catch (err) { next(err); }
}

async function createPurchase(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { supplier_id, purchase_date, payment_status, payment_method, reference_number, notes, items, amount_paid } = req.body;

    // Verify supplier belongs to user
    const supplier = await query('SELECT supplier_id FROM suppliers WHERE supplier_id = $1 AND user_id = $2', [supplier_id, user_id]);
    if (supplier.rows.length === 0) throw createError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');

    // Verify all products belong to user
    const productIds = items.map((i) => i.product_id);
    const placeholders = productIds.map((_, i) => `$${i + 2}`).join(', ');
    const productCheck = await query(
      `SELECT product_id FROM products WHERE user_id = $1 AND product_id IN (${placeholders}) AND is_active = 1`,
      [user_id, ...productIds]
    );
    if (productCheck.rows.length !== productIds.length) {
      throw createError('One or more products are invalid', 400, 'INVALID_PRODUCTS');
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity_purchased * item.purchase_price_per_unit), 0);
    const purchaseNumber = reference_number || generatePurchaseNumber();

    const result = await withTransaction(async (client) => {
      // Insert purchase order
      const poResult = await client.query(
        `INSERT INTO purchase_orders 
          (user_id, supplier_id, purchase_date, total_amount, payment_status, payment_method, reference_number, notes, amount_paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [user_id, supplier_id, purchase_date, totalAmount, payment_status || 'Pending', payment_method || null, purchaseNumber, notes || null, amount_paid || 0]
      );
      const purchase = poResult.rows[0];

      // Insert items and update stock
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity_purchased, purchase_price_per_unit)
           VALUES ($1, $2, $3, $4)`,
          [purchase.purchase_id, item.product_id, item.quantity_purchased, item.purchase_price_per_unit]
        );

        // Get old stock
        const stockResult = await client.query(
          'SELECT current_stock FROM products WHERE product_id = $1', [item.product_id]
        );
        const oldStock = stockResult.rows[0].current_stock;
        const newStock = oldStock + item.quantity_purchased;

        // Update stock and purchase_price
        await client.query(
          'UPDATE products SET current_stock = $1, purchase_price = $2, updated_at = CURRENT_TIMESTAMP WHERE product_id = $3',
          [newStock, item.purchase_price_per_unit, item.product_id]
        );

        // Log stock change
        await client.query(
          `INSERT INTO stock_history 
            (user_id, product_id, transaction_type, reference_id, quantity_change, old_stock, new_stock)
           VALUES ($1, $2, 'Purchase', $3, $4, $5, $6)`,
          [user_id, item.product_id, purchase.purchase_id, item.quantity_purchased, oldStock, newStock]
        );
      }

      // Update supplier balance
      if (supplier_id) {
        const balanceChange = parseFloat(amount_paid || 0) - totalAmount;
        await client.query(
          'UPDATE suppliers SET balance = balance + $1 WHERE supplier_id = $2',
          [balanceChange, supplier_id]
        );
      }

      return purchase;
    });

    return successResponse(res, result, 'Purchase order created successfully', 201);
  } catch (err) { next(err); }
}

async function updatePurchase(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    const { payment_status, payment_method, notes } = req.body;

    const result = await withTransaction(async (client) => {
      const existing = await client.query('SELECT * FROM purchase_orders WHERE purchase_id = $1 AND user_id = $2', [id, user_id]);
      if (existing.rows.length === 0) throw createError('Purchase order not found', 404, 'PO_NOT_FOUND');
      
      const purchase = existing.rows[0];
      let newAmountPaid = purchase.amount_paid;
      
      if (payment_status === 'Paid' && purchase.payment_status !== 'Paid') {
        newAmountPaid = purchase.total_amount;
        if (purchase.supplier_id) {
          const balanceChange = newAmountPaid - purchase.amount_paid;
          await client.query('UPDATE suppliers SET balance = balance + $1 WHERE supplier_id = $2', [balanceChange, purchase.supplier_id]);
        }
      }

      const updated = await client.query(
        `UPDATE purchase_orders SET 
           payment_status = COALESCE($1, payment_status),
           payment_method = COALESCE($2, payment_method),
           notes = COALESCE($3, notes),
           amount_paid = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE purchase_id = $5 RETURNING *`,
        [payment_status || null, payment_method || null, notes || null, newAmountPaid, id]
      );
      return updated.rows[0];
    });
    return successResponse(res, result, 'Purchase order updated');
  } catch (err) { next(err); }
}

async function deletePurchase(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const existing = await query(
      'SELECT * FROM purchase_orders WHERE purchase_id = $1 AND user_id = $2', [id, user_id]
    );
    if (existing.rows.length === 0) throw createError('Purchase order not found', 404, 'PO_NOT_FOUND');

    if (existing.rows[0].payment_status === 'Paid') {
      throw createError('Cannot delete a fully paid purchase order', 400, 'CANNOT_DELETE_PAID_PO');
    }

    await withTransaction(async (client) => {
      const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
      
      for (const item of items.rows) {
        const stockResult = await client.query('SELECT current_stock FROM products WHERE product_id = $1', [item.product_id]);
        const oldStock = stockResult.rows[0].current_stock;
        const newStock = Math.max(0, oldStock - item.quantity_purchased);
        
        await client.query('UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2', [newStock, item.product_id]);
        await client.query(
          `INSERT INTO stock_history (user_id, product_id, transaction_type, reference_id, quantity_change, old_stock, new_stock, notes)
           VALUES ($1, $2, 'Adjustment', $3, $4, $5, $6, 'Purchase order deleted')`,
          [user_id, item.product_id, id, -item.quantity_purchased, oldStock, newStock]
        );
      }

      await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
      await client.query('DELETE FROM purchase_orders WHERE purchase_id = $1', [id]);
    });

    return successResponse(res, null, 'Purchase order deleted and stock reversed');
  } catch (err) { next(err); }
}

module.exports = { getAllPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase };
