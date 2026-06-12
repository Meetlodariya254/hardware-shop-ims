import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { reportService } from '../../services/reportService';
import { formatCurrency, formatCurrencyCompact } from '../../utils/currencyUtils';
import { formatDate } from '../../utils/dateUtils';
import { MdTrendingUp, MdInventory, MdPointOfSale, MdWarning } from 'react-icons/md';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function MetricCard({ label, value, icon: Icon, color = 'primary', change, trend }) {
  return (
    <div className={`metric-card ${color}`}>
      <div className={`metric-icon ${color}`}>
        <Icon />
      </div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {change && (
          <div className={`metric-change ${trend}`}>
            {trend === 'up' ? '↑' : '↓'} {change}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white', padding: '10px 14px', borderRadius: '8px',
        border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem'
      }}>
        <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>{label}</p>
        {payload.map((item, i) => (
          <p key={i} style={{ color: item.color }}>
            {item.name}: <strong>{formatCurrency(item.value)}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    reportService.getDashboard()
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-lg"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const salesTrend = data?.sales_trend || [];
  const topProducts = data?.top_products || [];
  const recentSales = data?.recent_sales || [];
  const recentPurchases = data?.recent_purchases || [];

  return (
    <div>
      {/* Low Stock Banner */}
      {metrics.low_stock_count > 0 && (
        <div className="low-stock-banner">
          <MdWarning className="icon" />
          <div>
            <strong>{metrics.low_stock_count} products</strong> are running low on stock.{' '}
            <button
              onClick={() => navigate('/products?stock_status=low_stock')}
              style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              View now →
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="metrics-grid">
        <MetricCard
          label="Today's Sales"
          value={formatCurrencyCompact(metrics.today_sales?.amount || 0)}
          icon={MdPointOfSale}
          color="primary"
          change={`${metrics.today_sales?.count || 0} transactions`}
          trend="up"
        />
        <MetricCard
          label="Monthly Revenue"
          value={formatCurrencyCompact(metrics.monthly_sales?.revenue || 0)}
          icon={MdTrendingUp}
          color="success"
          change={`Profit: ${formatCurrencyCompact(metrics.monthly_sales?.profit || 0)}`}
          trend="up"
        />
        <MetricCard
          label="Inventory Value"
          value={formatCurrencyCompact(metrics.stock_value?.value || 0)}
          icon={MdInventory}
          color="info"
          change={`${metrics.stock_value?.total_products || 0} products`}
          trend="up"
        />
        <MetricCard
          label="Low Stock Alerts"
          value={metrics.low_stock_count || 0}
          icon={MdWarning}
          color={metrics.low_stock_count > 0 ? 'warning' : 'success'}
          change={metrics.low_stock_count > 0 ? 'Needs attention' : 'All good!'}
          trend={metrics.low_stock_count > 0 ? 'down' : 'up'}
        />
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        {/* Sales Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Sales Trend (Last 7 Days)</div>
              <div className="card-subtitle">Daily revenue overview</div>
            </div>
          </div>
          <div className="card-body">
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDate(d, 'dd MMM')}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrencyCompact(v)}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563eb' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-icon">📈</div>
                <h3>No sales data yet</h3>
                <p>Start recording sales to see your trend chart here</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Products</div>
              <div className="card-subtitle">By quantity sold this month</div>
            </div>
          </div>
          <div className="card-body">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="product_name"
                    width={90}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                  />
                  <Tooltip />
                  <Bar dataKey="quantity" name="Qty Sold" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-icon">🏆</div>
                <h3>No products sold yet</h3>
                <p>Top selling products will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bottom-grid">
        {/* Recent Sales */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Sales</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sales')}>View all →</button>
          </div>
          <div className="card-body" style={{ padding: '12px 24px 24px' }}>
            {recentSales.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No sales yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {recentSales.map((sale) => (
                  <div
                    key={sale.sale_id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/sales`)}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {sale.invoice_number}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {sale.customer_name || 'Walk-in Customer'} · {formatDate(sale.sale_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--success)' }}>
                        {formatCurrency(sale.final_amount)}
                      </div>
                      <span className={`badge ${sale.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}`}
                        style={{ fontSize: '0.625rem' }}>
                        {sale.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Purchases</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/purchases')}>View all →</button>
          </div>
          <div className="card-body" style={{ padding: '12px 24px 24px' }}>
            {recentPurchases.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No purchases yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {recentPurchases.map((po) => (
                  <div
                    key={po.purchase_id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer'
                    }}
                    onClick={() => navigate('/purchases')}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {po.reference_number}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {po.supplier_name} · {formatDate(po.purchase_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                        {formatCurrency(po.total_amount)}
                      </div>
                      <span className={`badge ${po.payment_status === 'Paid' ? 'badge-success' : po.payment_status === 'Partial' ? 'badge-primary' : 'badge-warning'}`}
                        style={{ fontSize: '0.625rem' }}>
                        {po.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
