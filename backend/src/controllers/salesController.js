'use strict';

const { query, withTransaction } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data, error: null, timestamp: new Date().toISOString() });
}

function generateInvoiceNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${date}-${rand}`;
}

async function getAllSales(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { page = 1, limit = 25, from, to, customer_id, payment_status, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let params = [user_id];
    let where = 'so.user_id = $1';
    let p = 1;

    if (from) { p++; where += ` AND so.sale_date >= $${p}`; params.push(from); }
    if (to) { p++; where += ` AND so.sale_date <= $${p}`; params.push(to); }
    if (customer_id) { p++; where += ` AND so.customer_id = $${p}`; params.push(customer_id); }
    if (payment_status) { p++; where += ` AND so.payment_status = $${p}`; params.push(payment_status); }
    if (search) {
      p++; 
      where += ` AND (so.invoice_number ILIKE $${p} OR c.customer_name ILIKE $${p})`;
      params.push(`%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.customer_id WHERE ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    p++; params.push(parseInt(limit));
    p++; params.push(offset);

    const result = await query(
      `SELECT so.*, c.customer_name, c.mobile_number as customer_mobile,
         (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = so.sale_id) AS item_count,
         (SELECT group_concat(p.product_name, ', ') FROM sale_items si JOIN products p ON si.product_id = p.product_id WHERE si.sale_id = so.sale_id) AS item_names
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.customer_id
       WHERE ${where}
       ORDER BY so.sale_date DESC, so.created_at DESC
       LIMIT $${p - 1} OFFSET $${p}`,
      params
    );

    return successResponse(res, {
      sales: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

async function getSale(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const saleResult = await query(
      `SELECT so.*, c.customer_name, c.mobile_number as customer_mobile,
              c.address as customer_address, c.email as customer_email
       FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.customer_id
       WHERE so.sale_id = $1 AND so.user_id = $2`,
      [id, user_id]
    );
    if (saleResult.rows.length === 0) throw createError('Sale order not found', 404, 'SALE_NOT_FOUND');

    const itemsResult = await query(
      `SELECT si.*, p.product_name, p.category, p.unit_type, p.purchase_price,
         ROUND(((si.selling_price_per_unit - p.purchase_price) * si.quantity_sold), 2) AS item_profit
       FROM sale_items si JOIN products p ON si.product_id = p.product_id
       WHERE si.sale_id = $1`,
      [id]
    );

    return successResponse(res, { sale: saleResult.rows[0], items: itemsResult.rows });
  } catch (err) { next(err); }
}

async function createSale(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { customer_id, walkin_customer_name, sale_date, sale_time, discount_amount, payment_method, payment_status, notes, items, amount_paid } = req.body;

    // Validate all products and check stock
    const productIds = items.map((i) => i.product_id);
    const placeholders = productIds.map((_, i) => `$${i + 2}`).join(', ');
    const products = await query(
      `SELECT product_id, product_name, current_stock, minimum_stock_level FROM products WHERE user_id = $1 AND product_id IN (${placeholders}) AND is_active = 1`,
      [user_id, ...productIds]
    );
    if (products.rows.length !== productIds.length) {
      throw createError('One or more products are invalid', 400, 'INVALID_PRODUCTS');
    }

    const productMap = {};
    products.rows.forEach((p) => { productMap[p.product_id] = p; });

    // Check stock sufficiency
    const stockWarnings = [];
    for (const item of items) {
      const product = productMap[item.product_id];
      if (!product) throw createError(`Product not found`, 400, 'PRODUCT_NOT_FOUND');
      if (product.current_stock < item.quantity_sold) {
        throw createError(
          `Insufficient stock for "${product.product_name}". Available: ${product.current_stock} ${product.unit_type}`,
          400, 'INSUFFICIENT_STOCK'
        );
      }
      const remainingStock = product.current_stock - item.quantity_sold;
      if (remainingStock <= product.minimum_stock_level) {
        stockWarnings.push(`"${product.product_name}" will be low/out of stock after this sale`);
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity_sold * item.selling_price_per_unit), 0);
    const invoiceNumber = generateInvoiceNumber();
    const saleTimeValue = sale_time || new Date().toTimeString().slice(0, 5);

    const result = await withTransaction(async (client) => {
      // Insert sale
      const saleResult = await client.query(
        `INSERT INTO sales_orders
          (user_id, customer_id, sale_date, sale_time, total_amount, discount_amount, payment_method, payment_status, invoice_number, notes, amount_paid, walkin_customer_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          user_id, customer_id || null, sale_date, saleTimeValue,
          totalAmount, discount_amount || 0, payment_method,
          payment_status || 'Paid', invoiceNumber, notes || null, amount_paid || 0, walkin_customer_name || null
        ]
      );
      const sale = saleResult.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity_sold, selling_price_per_unit)
           VALUES ($1, $2, $3, $4)`,
          [sale.sale_id, item.product_id, item.quantity_sold, item.selling_price_per_unit]
        );

        const stockResult = await client.query('SELECT current_stock FROM products WHERE product_id = $1', [item.product_id]);
        const oldStock = stockResult.rows[0].current_stock;
        const newStock = oldStock - item.quantity_sold;

        await client.query(
          'UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2', [newStock, item.product_id]
        );

        await client.query(
          `INSERT INTO stock_history (user_id, product_id, transaction_type, reference_id, quantity_change, old_stock, new_stock)
           VALUES ($1, $2, 'Sale', $3, $4, $5, $6)`,
          [user_id, item.product_id, sale.sale_id, -item.quantity_sold, oldStock, newStock]
        );
      }

      // Update customer balance
      if (customer_id) {
        const finalAmount = totalAmount - (discount_amount || 0);
        const balanceChange = parseFloat(amount_paid || 0) - finalAmount;
        await client.query(
          'UPDATE customers SET balance = balance + $1 WHERE customer_id = $2',
          [balanceChange, customer_id]
        );
      }

      return sale;
    });

    return successResponse(res, { sale: result, stock_warnings: stockWarnings }, 'Sale created successfully', 201);
  } catch (err) { next(err); }
}

async function updateSale(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    const { payment_status, payment_method, notes } = req.body;

    const result = await withTransaction(async (client) => {
      const existing = await client.query('SELECT * FROM sales_orders WHERE sale_id = $1 AND user_id = $2', [id, user_id]);
      if (existing.rows.length === 0) throw createError('Sale order not found', 404, 'SALE_NOT_FOUND');
      
      const sale = existing.rows[0];
      let newAmountPaid = sale.amount_paid;
      
      if (payment_status === 'Paid' && sale.payment_status !== 'Paid') {
        newAmountPaid = sale.final_amount;
        if (sale.customer_id) {
          const balanceChange = newAmountPaid - sale.amount_paid;
          await client.query('UPDATE customers SET balance = balance + $1 WHERE customer_id = $2', [balanceChange, sale.customer_id]);
        }
      }

      const updated = await client.query(
        `UPDATE sales_orders SET
           payment_status = COALESCE($1, payment_status),
           payment_method = COALESCE($2, payment_method),
           notes = COALESCE($3, notes),
           amount_paid = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE sale_id = $5 RETURNING *`,
        [payment_status || null, payment_method || null, notes || null, newAmountPaid, id]
      );
      return updated.rows[0];
    });
    return successResponse(res, result, 'Sale updated');
  } catch (err) { next(err); }
}

async function deleteSale(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const existing = await query('SELECT * FROM sales_orders WHERE sale_id = $1 AND user_id = $2', [id, user_id]);
    if (existing.rows.length === 0) throw createError('Sale order not found', 404, 'SALE_NOT_FOUND');
    if (existing.rows[0].payment_status === 'Paid') {
      throw createError('Cannot delete a fully paid sale order', 400, 'CANNOT_DELETE_PAID_SALE');
    }

    await withTransaction(async (client) => {
      const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
      for (const item of items.rows) {
        const stockResult = await client.query('SELECT current_stock FROM products WHERE product_id = $1', [item.product_id]);
        const oldStock = stockResult.rows[0].current_stock;
        const newStock = oldStock + item.quantity_sold;
        await client.query('UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2', [newStock, item.product_id]);
        await client.query(
          `INSERT INTO stock_history (user_id, product_id, transaction_type, reference_id, quantity_change, old_stock, new_stock, notes)
           VALUES ($1, $2, 'Adjustment', $3, $4, $5, $6, 'Sale order deleted - stock restored')`,
          [user_id, item.product_id, id, item.quantity_sold, oldStock, newStock]
        );
      }
      await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
      await client.query('DELETE FROM sales_orders WHERE sale_id = $1', [id]);
    });

    return successResponse(res, null, 'Sale deleted and stock restored');
  } catch (err) { next(err); }
}

module.exports = { getAllSales, getSale, createSale, updateSale, deleteSale };
