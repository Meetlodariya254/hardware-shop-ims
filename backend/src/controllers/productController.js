'use strict';

const { query, withTransaction } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  });
}

// ─── Get All Products ─────────────────────────────────────────────────────────

async function getAllProducts(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const {
      page = 1,
      limit = 25,
      search = '',
      category = '',
      stock_status = '', // 'in_stock', 'low_stock', 'out_of_stock'
      sort_by = 'product_name',
      sort_order = 'ASC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [user_id];
    let filterClauses = ['p.user_id = $1', 'p.is_active = 1'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      filterClauses.push(`(p.product_name ILIKE $${paramCount} OR p.brand ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      filterClauses.push(`p.category = $${paramCount}`);
      params.push(category);
    }

    if (stock_status === 'out_of_stock') {
      filterClauses.push('p.current_stock = 0');
    } else if (stock_status === 'low_stock') {
      filterClauses.push('p.current_stock > 0 AND p.current_stock <= p.minimum_stock_level');
    } else if (stock_status === 'in_stock') {
      filterClauses.push('p.current_stock > p.minimum_stock_level');
    }

    const allowedSortColumns = ['product_name', 'category', 'current_stock', 'selling_price', 'purchase_price', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'product_name';
    const sortDir = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = filterClauses.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    params.push(parseInt(limit));
    paramCount++;
    params.push(offset);

    const result = await query(
      `SELECT 
          p.product_id,
          p.product_name,
          p.category,
          p.brand,
          p.purchase_price,
          p.selling_price,
          p.current_stock,
          p.minimum_stock_level,
          p.unit_type,
          p.sku,
          p.product_code,
          p.description,
          p.created_at,
          p.updated_at,
          ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.purchase_price, 0)) * 100, 2) AS profit_margin_percent,
          CASE 
            WHEN p.current_stock = 0 THEN 'out_of_stock'
            WHEN p.current_stock <= p.minimum_stock_level THEN 'low_stock'
            ELSE 'in_stock'
          END AS stock_status,
          (p.current_stock * p.purchase_price) AS stock_value
       FROM products p
       WHERE ${whereClause}
       ORDER BY p.${sortColumn} ${sortDir}
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    return successResponse(res, {
      products: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get Single Product ───────────────────────────────────────────────────────

async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT p.*,
          ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.purchase_price, 0)) * 100, 2) AS profit_margin_percent,
          CASE 
            WHEN p.current_stock = 0 THEN 'out_of_stock'
            WHEN p.current_stock <= p.minimum_stock_level THEN 'low_stock'
            ELSE 'in_stock'
          END AS stock_status,
          (p.current_stock * p.purchase_price) AS stock_value
       FROM products p
       WHERE p.product_id = $1 AND p.user_id = $2`,
      [id, user_id]
    );

    if (result.rows.length === 0) {
      throw createError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // Get stock history
    const historyResult = await query(
      `SELECT sh.*, 
         CASE sh.transaction_type
           WHEN 'Purchase' THEN po.reference_number
           WHEN 'Sale' THEN so.invoice_number
           ELSE NULL
         END AS reference_doc
       FROM stock_history sh
       LEFT JOIN purchase_orders po ON sh.reference_id = po.purchase_id
       LEFT JOIN sales_orders so ON sh.reference_id = so.sale_id
       WHERE sh.product_id = $1 AND sh.user_id = $2
       ORDER BY sh.created_at DESC
       LIMIT 20`,
      [id, user_id]
    );

    return successResponse(res, {
      product: result.rows[0],
      stock_history: historyResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Create Product ───────────────────────────────────────────────────────────

async function createProduct(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const {
      product_name, category, brand, purchase_price, selling_price,
      current_stock, minimum_stock_level, unit_type, sku, product_code, description,
    } = req.body;

    // Check for duplicate product name for this user
    const existing = await query(
      'SELECT product_id FROM products WHERE product_name ILIKE $1 AND user_id = $2 AND is_active = 1',
      [product_name, user_id]
    );
    if (existing.rows.length > 0) {
      throw createError('A product with this name already exists', 409, 'DUPLICATE_PRODUCT');
    }

    // Check for duplicate SKU if provided
    if (sku) {
      const dupSku = await query(
        'SELECT product_id FROM products WHERE sku = $1 AND user_id = $2',
        [sku, user_id]
      );
      if (dupSku.rows.length > 0) {
        throw createError('A product with this SKU already exists', 409, 'DUPLICATE_SKU');
      }
    }

    const result = await query(
      `INSERT INTO products
        (user_id, product_name, category, brand, purchase_price, selling_price,
         current_stock, minimum_stock_level, unit_type, sku, product_code, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        user_id, product_name, category, brand || null, purchase_price, selling_price,
        current_stock || 0, minimum_stock_level || 10, unit_type,
        sku || null, product_code || null, description || null,
      ]
    );

    // Log initial stock if > 0
    if (current_stock > 0) {
      await query(
        `INSERT INTO stock_history 
          (user_id, product_id, transaction_type, quantity_change, old_stock, new_stock, notes)
         VALUES ($1, $2, 'Adjustment', $3, 0, $4, 'Initial stock on product creation')`,
        [user_id, result.rows[0].product_id, current_stock, current_stock]
      );
    }

    return successResponse(res, result.rows[0], 'Product created successfully', 201);
  } catch (err) {
    next(err);
  }
}

// ─── Update Product ───────────────────────────────────────────────────────────

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // Verify ownership
    const existing = await query(
      'SELECT * FROM products WHERE product_id = $1 AND user_id = $2',
      [id, user_id]
    );
    if (existing.rows.length === 0) {
      throw createError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const {
      product_name, category, brand, purchase_price, selling_price,
      minimum_stock_level, unit_type, sku, product_code, description,
    } = req.body;

    // Check duplicate name (excluding this product)
    if (product_name) {
      const dupName = await query(
        'SELECT product_id FROM products WHERE product_name ILIKE $1 AND user_id = $2 AND product_id != $3 AND is_active = 1',
        [product_name, user_id, id]
      );
      if (dupName.rows.length > 0) {
        throw createError('A product with this name already exists', 409, 'DUPLICATE_PRODUCT');
      }
    }

    const result = await query(
      `UPDATE products SET
        product_name = COALESCE($1, product_name),
        category = COALESCE($2, category),
        brand = COALESCE($3, brand),
        purchase_price = COALESCE($4, purchase_price),
        selling_price = COALESCE($5, selling_price),
        minimum_stock_level = COALESCE($6, minimum_stock_level),
        unit_type = COALESCE($7, unit_type),
        sku = COALESCE($8, sku),
        product_code = COALESCE($9, product_code),
        description = COALESCE($10, description),
        updated_at = NOW()
       WHERE product_id = $11 AND user_id = $12
       RETURNING *`,
      [
        product_name || null, category || null, brand,
        purchase_price || null, selling_price || null, minimum_stock_level || null,
        unit_type || null, sku, product_code, description,
        id, user_id,
      ]
    );

    return successResponse(res, result.rows[0], 'Product updated successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Delete Product (Soft) ────────────────────────────────────────────────────

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const result = await query(
      'UPDATE products SET is_active = 0, updated_at = NOW() WHERE product_id = $1 AND user_id = $2 RETURNING product_id',
      [id, user_id]
    );

    if (result.rows.length === 0) {
      throw createError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    return successResponse(res, null, 'Product deleted successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Get Low Stock Products ───────────────────────────────────────────────────

async function getLowStockProducts(req, res, next) {
  try {
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT product_id, product_name, category, brand, current_stock, 
              minimum_stock_level, unit_type,
              CASE 
                WHEN current_stock = 0 THEN 'out_of_stock'
                ELSE 'low_stock'
              END AS stock_status
       FROM products
       WHERE user_id = $1 AND is_active = 1 AND current_stock <= minimum_stock_level
       ORDER BY current_stock ASC`,
      [user_id]
    );

    return successResponse(res, result.rows);
  } catch (err) {
    next(err);
  }
}

// ─── Get Inventory Value ──────────────────────────────────────────────────────

async function getStockValue(req, res, next) {
  try {
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT 
          SUM(current_stock * purchase_price) AS total_inventory_value,
          SUM(current_stock * selling_price) AS total_retail_value,
          COUNT(*) AS total_products,
          SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
          SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock_level THEN 1 ELSE 0 END) AS low_stock_count,
          SUM(CASE WHEN current_stock > minimum_stock_level THEN 1 ELSE 0 END) AS in_stock_count
       FROM products
       WHERE user_id = $1 AND is_active = 1`,
      [user_id]
    );

    return successResponse(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ─── Get Categories ───────────────────────────────────────────────────────────

async function getCategories(req, res, next) {
  try {
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT DISTINCT category, COUNT(*) as product_count
       FROM products WHERE user_id = $1 AND is_active = 1
       GROUP BY category ORDER BY category`,
      [user_id]
    );

    return successResponse(res, result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllProducts, getProduct, createProduct, updateProduct,
  deleteProduct, getLowStockProducts, getStockValue, getCategories,
};
