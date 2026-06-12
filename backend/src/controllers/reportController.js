'use strict';

const PDFDocument = require('pdfkit');

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

// ─── PDF Report Generation ────────────────────────────────────────────────────

const COLORS = {
  primary:   '#2563eb',
  success:   '#10b981',
  danger:    '#ef4444',
  warning:   '#f59e0b',
  dark:      '#111827',
  gray:      '#6b7280',
  lightGray: '#f3f4f6',
  border:    '#e5e7eb',
  white:     '#ffffff',
};

function rupees(v) {
  const n = parseFloat(v || 0);
  return 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function pct(v) {
  return parseFloat(v || 0).toFixed(1) + '%';
}

function pdfHeader(doc, title, subtitle) {
  // Top banner
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(22).font('Helvetica-Bold').text('Hardware Shop IMS', 40, 18);
  doc.fontSize(11).font('Helvetica').text(title, 40, 46);

  // Date generated
  const now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
  doc.fontSize(9).text(`Generated: ${now}`, 0, 58, { align: 'right', width: doc.page.width - 40 });

  doc.moveDown(0);
  doc.y = 100;

  if (subtitle) {
    doc.fillColor(COLORS.gray).fontSize(10).font('Helvetica').text(subtitle, 40);
    doc.moveDown(0.5);
  }
}

function pdfSectionTitle(doc, text) {
  doc.moveDown(0.8);
  doc.fillColor(COLORS.dark).fontSize(12).font('Helvetica-Bold').text(text, 40);
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function pdfStatRow(doc, stats) {
  // stats = [{label, value, color?}, ...]
  const colWidth = (doc.page.width - 80) / stats.length;
  const startY = doc.y;
  stats.forEach((s, i) => {
    const x = 40 + i * colWidth;
    doc.rect(x + 2, startY, colWidth - 4, 56).fill(COLORS.lightGray);
    doc.fillColor(COLORS.gray).fontSize(8).font('Helvetica').text(s.label.toUpperCase(), x + 10, startY + 8, { width: colWidth - 20 });
    doc.fillColor(s.color || COLORS.dark).fontSize(14).font('Helvetica-Bold').text(String(s.value), x + 10, startY + 22, { width: colWidth - 20 });
  });
  doc.y = startY + 66;
}

function pdfTable(doc, headers, rows, colWidths) {
  const startX = 40;
  const usableWidth = doc.page.width - 80;
  const widths = colWidths || headers.map(() => usableWidth / headers.length);

  // Header row
  let x = startX;
  const headerY = doc.y;
  doc.rect(startX, headerY, usableWidth, 20).fill(COLORS.primary);
  headers.forEach((h, i) => {
    doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold').text(h, x + 6, headerY + 5, { width: widths[i] - 8, ellipsis: true });
    x += widths[i];
  });
  doc.y = headerY + 20;

  // Data rows
  rows.forEach((row, ri) => {
    const rowY = doc.y;

    // page break check
    if (rowY > doc.page.height - 80) {
      doc.addPage();
      doc.y = 40;
      // re-draw header on new page
      x = startX;
      const nhY = doc.y;
      doc.rect(startX, nhY, usableWidth, 20).fill(COLORS.primary);
      headers.forEach((h, i) => {
        doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold').text(h, x + 6, nhY + 5, { width: widths[i] - 8, ellipsis: true });
        x += widths[i];
      });
      doc.y = nhY + 20;
    }

    const finalRowY = doc.y;
    const bgColor = ri % 2 === 0 ? COLORS.white : COLORS.lightGray;
    doc.rect(startX, finalRowY, usableWidth, 18).fill(bgColor);

    x = startX;
    row.forEach((cell, ci) => {
      const cellOpts = { width: widths[ci] - 8, ellipsis: true, lineBreak: false };
      doc.fillColor(COLORS.dark).fontSize(8.5).font('Helvetica').text(String(cell ?? '—'), x + 6, finalRowY + 4, cellOpts);
      x += widths[ci];
    });
    doc.y = finalRowY + 18;
  });
  doc.moveDown(0.5);
}

async function generateReportPDF(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { type, from, to, month } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let pdfTitle = 'Report';
    let pdfSubtitle = '';
    let buildPDF;

    // ── PROFIT REPORT ────────────────────────────────────────────────
    if (type === 'profit') {
      const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const toDate = to || today;
      pdfTitle = 'Profit Report';
      pdfSubtitle = `Period: ${fromDate}  to  ${toDate}`;

      const [summary, byProduct, monthlyTrend] = await Promise.all([
        query(
          `SELECT COALESCE(SUM(si.total_item_revenue), 0) as total_revenue,
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
             ROUND((SUM(si.quantity_sold * (si.selling_price_per_unit - p.purchase_price)) / NULLIF(SUM(si.quantity_sold * p.purchase_price), 0)) * 100, 2) as profit_margin_percent
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
      const overallMargin = s.total_revenue > 0 ? ((s.total_profit / s.total_cost) * 100).toFixed(2) : 0;

      buildPDF = (doc) => {
        pdfHeader(doc, pdfTitle, pdfSubtitle);

        pdfSectionTitle(doc, 'Summary');
        pdfStatRow(doc, [
          { label: 'Total Revenue', value: rupees(s.total_revenue), color: COLORS.primary },
          { label: 'Total Cost',    value: rupees(s.total_cost),    color: COLORS.danger },
          { label: 'Total Profit',  value: rupees(s.total_profit),  color: COLORS.success },
          { label: 'Profit Margin', value: pct(overallMargin),      color: COLORS.success },
        ]);
        pdfStatRow(doc, [
          { label: 'Total Transactions', value: s.total_transactions },
          { label: 'Total Items Sold',   value: s.total_items_sold },
        ]);

        if (monthlyTrend.rows.length > 0) {
          pdfSectionTitle(doc, 'Monthly Trend (Last 6 Months)');
          pdfTable(doc,
            ['Month', 'Revenue', 'Cost', 'Profit'],
            [...monthlyTrend.rows].reverse().map(r => [r.month ? r.month.slice(0, 7) : '', rupees(r.revenue), rupees(r.cost), rupees(r.profit)]),
            [140, 130, 130, 130]
          );
        }

        pdfSectionTitle(doc, 'Product-wise Profit Breakdown');
        pdfTable(doc,
          ['Product', 'Category', 'Qty Sold', 'Cost', 'Revenue', 'Profit', 'Margin %'],
          byProduct.rows.map(p => [p.product_name, p.category, `${p.quantity_sold} ${p.unit_type}`, rupees(p.cost), rupees(p.revenue), rupees(p.profit), pct(p.profit_margin_percent)]),
          [130, 70, 60, 75, 75, 75, 55]
        );
      };
    }

    // ── DAILY SALES REPORT ───────────────────────────────────────────
    else if (type === 'daily') {
      const fromDate = from || today;
      const toDate   = to || fromDate;
      pdfTitle = 'Daily Sales Report';
      pdfSubtitle = fromDate === toDate ? `Date: ${fromDate}` : `Period: ${fromDate}  to  ${toDate}`;

      const [summary, paymentBreakdown, transactions] = await Promise.all([
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
          `SELECT so.invoice_number, so.sale_date, so.sale_time, so.final_amount, so.payment_method, c.customer_name
           FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.customer_id
           WHERE so.user_id = $1 AND so.sale_date BETWEEN $2 AND $3
           ORDER BY so.sale_date DESC, so.sale_time DESC`,
          [user_id, fromDate, toDate]
        ),
      ]);
      const sm = summary.rows[0];

      buildPDF = (doc) => {
        pdfHeader(doc, pdfTitle, pdfSubtitle);

        pdfSectionTitle(doc, 'Summary');
        pdfStatRow(doc, [
          { label: 'Total Sales',       value: rupees(sm.total_amount),    color: COLORS.primary },
          { label: 'Transactions',      value: sm.transaction_count },
          { label: 'Avg. Transaction',  value: rupees(sm.avg_transaction) },
          { label: 'Discounts Given',   value: rupees(sm.total_discount),  color: COLORS.danger },
        ]);

        if (paymentBreakdown.rows.length > 0) {
          pdfSectionTitle(doc, 'Payment Method Breakdown');
          pdfTable(doc,
            ['Payment Method', 'Transactions', 'Amount'],
            paymentBreakdown.rows.map(p => [p.payment_method, p.count, rupees(p.amount)]),
            [200, 150, 180]
          );
        }

        pdfSectionTitle(doc, 'Transactions');
        pdfTable(doc,
          ['Invoice #', 'Date', 'Time', 'Customer', 'Amount', 'Payment'],
          transactions.rows.map(t => [t.invoice_number, t.sale_date, t.sale_time || '', t.customer_name || 'Walk-in', rupees(t.final_amount), t.payment_method]),
          [100, 75, 50, 100, 90, 115]
        );
      };
    }

    // ── MONTHLY SALES REPORT ─────────────────────────────────────────
    else if (type === 'monthly') {
      const monthStr = month || new Date().toISOString().slice(0, 7);
      const fromDate = `${monthStr}-01`;
      const toDate   = new Date(new Date(fromDate).getFullYear(), new Date(fromDate).getMonth() + 1, 0).toISOString().split('T')[0];
      pdfTitle = 'Monthly Sales Report';
      pdfSubtitle = `Month: ${monthStr}`;

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
      const sm = monthlySummary.rows[0];

      buildPDF = (doc) => {
        pdfHeader(doc, pdfTitle, pdfSubtitle);

        pdfSectionTitle(doc, 'Summary');
        pdfStatRow(doc, [
          { label: 'Monthly Revenue', value: rupees(sm.revenue), color: COLORS.primary },
          { label: 'Transactions',    value: sm.transactions },
        ]);

        if (dailyBreakdown.rows.length > 0) {
          pdfSectionTitle(doc, 'Daily Revenue Breakdown');
          pdfTable(doc,
            ['Date', 'Revenue', 'Transactions'],
            dailyBreakdown.rows.map(d => [d.date, rupees(d.revenue), d.transactions]),
            [180, 180, 170]
          );
        }

        if (topProducts.rows.length > 0) {
          pdfSectionTitle(doc, 'Top Products by Revenue');
          pdfTable(doc,
            ['Product', 'Quantity Sold', 'Revenue'],
            topProducts.rows.map(p => [p.product_name, p.qty, rupees(p.revenue)]),
            [250, 150, 130]
          );
        }

        if (topCustomers.rows.length > 0) {
          pdfSectionTitle(doc, 'Top Customers');
          pdfTable(doc,
            ['Customer', 'Visits', 'Total Spent'],
            topCustomers.rows.map(c => [c.customer_name, c.visits, rupees(c.spent)]),
            [250, 150, 130]
          );
        }
      };
    }

    // ── STOCK REPORT ─────────────────────────────────────────────────
    else if (type === 'stock') {
      pdfTitle = 'Stock Report';
      pdfSubtitle = `As of: ${today}`;

      const [overview, byCategory, lowStockItems, allProducts] = await Promise.all([
        query(
          `SELECT COUNT(*) as total_products, SUM(current_stock * purchase_price) as inventory_value,
             SUM(current_stock * selling_price) as retail_value,
             SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
             SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock_level THEN 1 ELSE 0 END) as low_stock
           FROM products WHERE user_id = $1 AND is_active = 1`,
          [user_id]
        ),
        query(
          `SELECT category, COUNT(*) as products, SUM(current_stock) as total_units, SUM(current_stock * purchase_price) as value
           FROM products WHERE user_id = $1 AND is_active = 1
           GROUP BY category ORDER BY value DESC`,
          [user_id]
        ),
        query(
          `SELECT product_name, category, current_stock, minimum_stock_level, unit_type,
             (current_stock * purchase_price) as stock_value,
             CASE WHEN current_stock = 0 THEN 'Out of Stock' ELSE 'Low Stock' END as status
           FROM products WHERE user_id = $1 AND is_active = 1 AND current_stock <= minimum_stock_level
           ORDER BY current_stock ASC`,
          [user_id]
        ),
        query(
          `SELECT product_name, category, brand, current_stock, minimum_stock_level, unit_type,
             selling_price, purchase_price, (current_stock * purchase_price) as stock_value
           FROM products WHERE user_id = $1 AND is_active = 1
           ORDER BY category, product_name`,
          [user_id]
        ),
      ]);
      const ov = overview.rows[0];

      buildPDF = (doc) => {
        pdfHeader(doc, pdfTitle, pdfSubtitle);

        pdfSectionTitle(doc, 'Overview');
        pdfStatRow(doc, [
          { label: 'Total Products',    value: ov.total_products },
          { label: 'Inventory Value',   value: rupees(ov.inventory_value), color: COLORS.primary },
          { label: 'Retail Value',      value: rupees(ov.retail_value),    color: COLORS.success },
          { label: 'Low / Out of Stock',value: `${ov.low_stock} / ${ov.out_of_stock}`, color: COLORS.warning },
        ]);

        pdfSectionTitle(doc, 'Category-wise Stock');
        pdfTable(doc,
          ['Category', 'Products', 'Total Units', 'Inventory Value'],
          byCategory.rows.map(c => [c.category, c.products, c.total_units, rupees(c.value)]),
          [200, 100, 110, 120]
        );

        if (lowStockItems.rows.length > 0) {
          pdfSectionTitle(doc, 'Low Stock & Out of Stock Items');
          pdfTable(doc,
            ['Product', 'Category', 'Current Stock', 'Min. Level', 'Status', 'Stock Value'],
            lowStockItems.rows.map(i => [i.product_name, i.category, `${i.current_stock} ${i.unit_type}`, `${i.minimum_stock_level} ${i.unit_type}`, i.status, rupees(i.stock_value)]),
            [130, 80, 80, 70, 80, 90]
          );
        }

        pdfSectionTitle(doc, 'Full Product Inventory');
        pdfTable(doc,
          ['Product', 'Category', 'Brand', 'Stock', 'Purchase Price', 'Selling Price', 'Stock Value'],
          allProducts.rows.map(p => [p.product_name, p.category, p.brand || '—', `${p.current_stock} ${p.unit_type}`, rupees(p.purchase_price), rupees(p.selling_price), rupees(p.stock_value)]),
          [115, 70, 60, 55, 85, 85, 60]
        );
      };
    }

    // ── PURCHASE REPORT ──────────────────────────────────────────────
    else if (type === 'purchase') {
      const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const toDate   = to || today;
      pdfTitle = 'Purchase Report';
      pdfSubtitle = `Period: ${fromDate}  to  ${toDate}`;

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
           GROUP BY s.supplier_id, s.supplier_name ORDER BY total DESC LIMIT 20`,
          [user_id, fromDate, toDate]
        ),
        query(
          `SELECT payment_status, COUNT(*) as count, SUM(total_amount) as amount
           FROM purchase_orders WHERE user_id = $1 AND purchase_date BETWEEN $2 AND $3
           GROUP BY payment_status`,
          [user_id, fromDate, toDate]
        ),
      ]);
      const sm = summary.rows[0];

      buildPDF = (doc) => {
        pdfHeader(doc, pdfTitle, pdfSubtitle);

        pdfSectionTitle(doc, 'Summary');
        pdfStatRow(doc, [
          { label: 'Total Purchased', value: rupees(sm.total_amount), color: COLORS.primary },
          { label: 'Total Orders',    value: sm.total_orders },
          { label: 'Avg. Order Value', value: rupees(sm.avg_order) },
        ]);

        if (paymentBreakdown.rows.length > 0) {
          pdfSectionTitle(doc, 'Payment Status Breakdown');
          pdfTable(doc,
            ['Payment Status', 'Orders', 'Total Amount'],
            paymentBreakdown.rows.map(p => [p.payment_status, p.count, rupees(p.amount)]),
            [200, 150, 180]
          );
        }

        if (bySupplier.rows.length > 0) {
          pdfSectionTitle(doc, 'Top Suppliers');
          pdfTable(doc,
            ['Supplier', 'Orders', 'Total Amount'],
            bySupplier.rows.map(s => [s.supplier_name, s.orders, rupees(s.total)]),
            [250, 130, 150]
          );
        }
      };
    }
    else {
      return res.status(400).json({ success: false, message: 'Invalid report type. Use: profit, daily, monthly, stock, purchase' });
    }

    // Stream PDF to client
    const safeTitle = pdfTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${today}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);
    buildPDF(doc);
    doc.end();

  } catch (err) { next(err); }
}

module.exports = { getDashboard, getProfitReport, getDailySalesReport, getMonthlySalesReport, getStockReport, getPurchaseReport, generateReportPDF };