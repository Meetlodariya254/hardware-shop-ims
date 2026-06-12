'use strict';

const { query } = require('../config/database');

function successResponse(res, data, message = 'Success') {
  return res.status(200).json({ success: true, message, data, error: null, timestamp: new Date().toISOString() });
}

async function getDashboard(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [todaySales, monthlySales, stockValue, lowStock, recentSales, recentPurchases, salesTrend, topProducts] = await Promise.all([
      // Today's sales
      query(
        `SELECT COALESCE(SUM(final_amount), 0) as amount, COUNT(*) as count 
         FROM sales_orders WHERE user_id = $1 AND sale_date = $2`,
        [user_id, today]
      ),
      // Monthly sales + profit
      query(
        `SELECT 
           COALESCE(SUM(so.final_amount), 0) as revenue,
           COALESCE(SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)), 0) as profit
         FROM sales_orders so
         JOIN sale_items si ON so.sale_id = si.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date >= $2`,
        [user_id, monthStart]
      ),
      // Inventory value
      query(
        `SELECT COALESCE(SUM(current_stock * purchase_price), 0) as value,
                COUNT(*) as total_products
         FROM products WHERE user_id = $1 AND is_active = 1`,
        [user_id]
      ),
      // Low stock count
      query(
        `SELECT COUNT(*) as count FROM products 
         WHERE user_id = $1 AND is_active = 1 AND current_stock <= minimum_stock_level`,
        [user_id]
      ),
      // Recent 5 sales
      query(
        `SELECT so.invoice_number, so.sale_date, so.final_amount, so.payment_method, so.payment_status,
                c.customer_name
         FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.customer_id
         WHERE so.user_id = $1 ORDER BY so.created_at DESC LIMIT 5`,
        [user_id]
      ),
      // Recent 5 purchases
      query(
        `SELECT po.reference_number, po.purchase_date, po.total_amount, po.payment_status, s.supplier_name
         FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id
         WHERE po.user_id = $1 ORDER BY po.created_at DESC LIMIT 5`,
        [user_id]
      ),
      // Last 7 days sales trend
      query(
        `SELECT sale_date as date, 
                COALESCE(SUM(final_amount), 0) as revenue,
                COUNT(*) as transactions
         FROM sales_orders WHERE user_id = $1 AND sale_date >= date('now', '-6 days')
         GROUP BY sale_date ORDER BY sale_date ASC`,
        [user_id]
      ),
      // Top 5 products (by quantity sold this month)
      query(
        `SELECT p.product_name, p.category, SUM(si.quantity_sold) as quantity, 
                SUM(si.total_item_revenue) as revenue
         FROM sale_items si
         JOIN sales_orders so ON si.sale_id = so.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date >= $2
         GROUP BY p.product_id, p.product_name, p.category
         ORDER BY quantity DESC LIMIT 5`,
        [user_id, monthStart]
      ),
    ]);

    return successResponse(res, {
      metrics: {
        today_sales: todaySales.rows[0],
        monthly_sales: monthlySales.rows[0],
        stock_value: stockValue.rows[0],
        low_stock_count: parseInt(lowStock.rows[0].count),
      },
      recent_sales: recentSales.rows,
      recent_purchases: recentPurchases.rows,
      sales_trend: salesTrend.rows,
      top_products: topProducts.rows,
    });
  } catch (err) { next(err); }
}

async function getProfitReport(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const [summary, byProduct, monthlyTrend] = await Promise.all([
      query(
        `SELECT 
           COALESCE(SUM(si.total_item_revenue), 0) as total_revenue,
           COALESCE(SUM(si.quantity_sold * p.purchase_price), 0) as total_cost,
           COALESCE(SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)), 0) as total_profit,
           COUNT(DISTINCT so.sale_id) as total_transactions,
           SUM(si.quantity_sold) as total_items_sold
         FROM sale_items si
         JOIN sales_orders so ON si.sale_id = so.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT p.product_name, p.category, p.unit_type,
           SUM(si.quantity_sold) as quantity_sold,
           SUM(si.quantity_sold * p.purchase_price) as cost,
           SUM(si.total_item_revenue) as revenue,
           SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)) as profit,
           ROUND(
             (SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)) / 
             NULLIF(SUM(si.quantity_sold * p.purchase_price), 0)) * 100, 2
           ) as profit_margin_percent
         FROM sale_items si
         JOIN sales_orders so ON si.sale_id = so.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
         GROUP BY p.product_id, p.product_name, p.category, p.unit_type
         ORDER BY profit DESC`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT strftime('%Y-%m-01', so.sale_date) as month,
           COALESCE(SUM(si.total_item_revenue), 0) as revenue,
           COALESCE(SUM(si.quantity_sold * p.purchase_price), 0) as cost,
           COALESCE(SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)), 0) as profit
         FROM sale_items si
         JOIN sales_orders so ON si.sale_id = so.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1
         GROUP BY strftime('%Y-%m-01', so.sale_date)
         ORDER BY month DESC LIMIT 6`,
        [user_id]
      ),
    ]);

    const s = summary.rows[0];
    const overallMargin = s.total_revenue > 0
      ? ((s.total_profit / s.total_cost) * 100).toFixed(2)
      : 0;

    return successResponse(res, {
      period: { from: fromDate, to: toDate },
      summary: { ...s, overall_profit_margin_percent: overallMargin },
      by_product: byProduct.rows,
      monthly_trend: monthlyTrend.rows,
    });
  } catch (err) { next(err); }
}

async function getDailySalesReport(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().split('T')[0];
    const toDate = to || fromDate;

    const [summary, paymentBreakdown, topProducts, transactions] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(final_amount), 0) as total_amount, COUNT(*) as transaction_count,
                COALESCE(AVG(final_amount), 0) as avg_transaction,
                COALESCE(SUM(discount_amount), 0) as total_discount
         FROM sales_orders WHERE user_id = $1 AND sale_date BETWEEN $2 AND $3`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT payment_method, COUNT(*) as count, SUM(final_amount) as amount
         FROM sales_orders WHERE user_id = $1 AND sale_date BETWEEN $2 AND $3
         GROUP BY payment_method`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT p.product_name, SUM(si.quantity_sold) as qty, SUM(si.total_item_revenue) as revenue
         FROM sale_items si
         JOIN sales_orders so ON si.sale_id = so.sale_id
         JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
         GROUP BY p.product_id, p.product_name ORDER BY qty DESC LIMIT 5`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT so.invoice_number, so.sale_date, so.sale_time, so.final_amount, so.payment_method, c.customer_name
         FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.customer_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
         ORDER BY so.sale_date DESC, so.sale_time DESC`,
        [user_id, fromDate, toDate]
      ),
    ]);

    return successResponse(res, {
      period: { from: fromDate, to: toDate },
      summary: summary.rows[0],
      payment_breakdown: paymentBreakdown.rows,
      top_products: topProducts.rows,
      transactions: transactions.rows,
    });
  } catch (err) { next(err); }
}

async function getMonthlySalesReport(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { month } = req.query; // Format: YYYY-MM
    const monthStr = month || new Date().toISOString().slice(0, 7);
    const fromDate = `${monthStr}-01`;
    const toDate = new Date(new Date(fromDate).getFullYear(), new Date(fromDate).getMonth() + 1, 0).toISOString().split('T')[0];

    const [monthlySummary, dailyBreakdown, topCustomers, topProducts] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(final_amount), 0) as revenue, COUNT(*) as transactions
         FROM sales_orders WHERE user_id = $1 AND sale_date BETWEEN $2 AND $3`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT sale_date as date, SUM(final_amount) as revenue, COUNT(*) as transactions
         FROM sales_orders WHERE user_id = $1 AND sale_date BETWEEN $2 AND $3
         GROUP BY sale_date ORDER BY sale_date`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT c.customer_name, COUNT(*) as visits, SUM(so.final_amount) as spent
         FROM sales_orders so JOIN customers c ON so.customer_id = c.customer_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
         GROUP BY c.customer_id, c.customer_name ORDER BY spent DESC LIMIT 10`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT p.product_name, SUM(si.quantity_sold) as qty, SUM(si.total_item_revenue) as revenue
         FROM sale_items si JOIN sales_orders so ON si.sale_id = so.sale_id JOIN products p ON si.product_id = p.product_id
         WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
         GROUP BY p.product_id, p.product_name ORDER BY revenue DESC LIMIT 10`,
        [user_id, fromDate, toDate]
      ),
    ]);

    return successResponse(res, {
      month: monthStr,
      summary: monthlySummary.rows[0],
      daily_breakdown: dailyBreakdown.rows,
      top_customers: topCustomers.rows,
      top_products: topProducts.rows,
    });
  } catch (err) { next(err); }
}

async function getStockReport(req, res, next) {
  try {
    const user_id = req.user.user_id;

    const [overview, byCategory, lowStockItems] = await Promise.all([
      query(
        `SELECT 
           COUNT(*) as total_products,
           SUM(current_stock * purchase_price) as inventory_value,
           SUM(current_stock * selling_price) as retail_value,
           SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
           SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock_level THEN 1 ELSE 0 END) as low_stock,
           SUM(CASE WHEN current_stock > minimum_stock_level THEN 1 ELSE 0 END) as in_stock
         FROM products WHERE user_id = $1 AND is_active = 1`,
        [user_id]
      ),
      query(
        `SELECT category, COUNT(*) as products, SUM(current_stock) as total_units,
                SUM(current_stock * purchase_price) as value
         FROM products WHERE user_id = $1 AND is_active = 1
         GROUP BY category ORDER BY value DESC`,
        [user_id]
      ),
      query(
        `SELECT product_id, product_name, category, brand, current_stock, minimum_stock_level, unit_type,
                (current_stock * purchase_price) as stock_value,
                CASE WHEN current_stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END as status
         FROM products WHERE user_id = $1 AND is_active = 1 AND current_stock <= minimum_stock_level
         ORDER BY current_stock ASC`,
        [user_id]
      ),
    ]);

    return successResponse(res, {
      overview: overview.rows[0],
      by_category: byCategory.rows,
      low_stock_items: lowStockItems.rows,
    });
  } catch (err) { next(err); }
}

async function getPurchaseReport(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const [summary, bySupplier, paymentBreakdown] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total_amount), 0) as total_amount, COUNT(*) as total_orders,
                COALESCE(AVG(total_amount), 0) as avg_order
         FROM purchase_orders WHERE user_id = $1 AND purchase_date BETWEEN $2 AND $3`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT s.supplier_name, COUNT(*) as orders, SUM(po.total_amount) as total
         FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id
         WHERE po.user_id = $1 AND po.purchase_date BETWEEN $2 AND $3
         GROUP BY s.supplier_id, s.supplier_name ORDER BY total DESC LIMIT 10`,
        [user_id, fromDate, toDate]
      ),
      query(
        `SELECT payment_status, COUNT(*) as count, SUM(total_amount) as amount
         FROM purchase_orders WHERE user_id = $1 AND purchase_date BETWEEN $2 AND $3
         GROUP BY payment_status`,
        [user_id, fromDate, toDate]
      ),
    ]);

    return successResponse(res, {
      period: { from: fromDate, to: toDate },
      summary: summary.rows[0],
      by_supplier: bySupplier.rows,
      payment_breakdown: paymentBreakdown.rows,
    });
  } catch (err) { next(err); }
}

module.exports = { getDashboard, getProfitReport, getDailySalesReport, getMonthlySalesReport, getStockReport, getPurchaseReport };
