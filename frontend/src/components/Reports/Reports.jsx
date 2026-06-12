import { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../../utils/currencyUtils';
import { formatDate, todayISO, currentMonthISO } from '../../utils/dateUtils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const TABS = [
  { id: 'profit', label: '💰 Profit Report' },
  { id: 'daily', label: '📅 Daily Sales' },
  { id: 'monthly', label: '📆 Monthly Sales' },
  { id: 'stock', label: '📦 Stock Report' },
  { id: 'purchase', label: '🛒 Purchase Report' },
];

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--gray-50)', borderRadius: 'var(--radius-md)',
      padding: '16px', border: '1px solid var(--border-color)',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function ProfitReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const today = todayISO();
  const monthStart = today.slice(0, 7) + '-01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const fetch = () => {
    setLoading(true);
    reportService.getProfit({ from, to }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  };

  // eslint-disable-next-line
  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} max={today} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} max={today} />
        </div>
        <button className="btn btn-primary" onClick={fetch} disabled={loading}>
          {loading ? <><div className="spinner spinner-sm"></div> Loading...</> : '🔍 Generate Report'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Revenue" value={formatCurrency(data.summary.total_revenue)} color="var(--primary)" />
            <StatCard label="Total Cost" value={formatCurrency(data.summary.total_cost)} color="var(--danger)" />
            <StatCard label="Total Profit" value={formatCurrency(data.summary.total_profit)} color="var(--success)" />
            <StatCard label="Profit Margin" value={formatPercent(data.summary.overall_profit_margin_percent)} color="var(--success)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
            <StatCard label="Total Transactions" value={data.summary.total_transactions} />
            <StatCard label="Total Items Sold" value={data.summary.total_items_sold} />
          </div>

          {/* Monthly Trend */}
          {data.monthly_trend.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div className="card-title">Monthly Profit Trend</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...data.monthly_trend].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 7)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Product Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Product-wise Profit Breakdown</div>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Product</th><th>Category</th><th>Qty Sold</th><th>Cost</th><th>Revenue</th><th>Profit</th><th>Margin %</th></tr></thead>
                <tbody>
                  {data.by_product.map((p, i) => (
                    <tr key={i} style={{ background: i === 0 ? 'linear-gradient(90deg, rgba(16,185,129,0.05), transparent)' : undefined }}>
                      <td style={{ fontWeight: 600 }}>{p.product_name}{i === 0 && <span className="badge badge-success" style={{ marginLeft: 8, fontSize: '0.625rem' }}>🏆 Top</span>}</td>
                      <td><span className="badge badge-gray">{p.category}</span></td>
                      <td>{p.quantity_sold} {p.unit_type}</td>
                      <td>{formatCurrency(p.cost)}</td>
                      <td>{formatCurrency(p.revenue)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.profit)}</td>
                      <td>
                        <span style={{ color: p.profit_margin_percent >= 20 ? 'var(--success)' : p.profit_margin_percent >= 10 ? 'var(--warning)' : 'var(--danger)', fontWeight: 700 }}>
                          {formatPercent(p.profit_margin_percent)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.by_product.length === 0 && (
                <div className="table-empty"><p>No sales in this period</p></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StockReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportService.getStock().then((r) => setData(r.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Products" value={data.overview.total_products} />
        <StatCard label="Inventory Value" value={formatCurrency(data.overview.inventory_value)} color="var(--primary)" />
        <StatCard label="Retail Value" value={formatCurrency(data.overview.retail_value)} color="var(--success)" />
        <StatCard label="Low / Out of Stock" value={`${data.overview.low_stock} / ${data.overview.out_of_stock}`} color="var(--warning)" />
      </div>

      {data.low_stock_items.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title" style={{ color: 'var(--warning)' }}>⚠️ Low Stock & Out of Stock Items</div>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Min. Level</th><th>Status</th><th>Stock Value</th></tr></thead>
              <tbody>
                {data.low_stock_items.map((item) => (
                  <tr key={item.product_id} style={{ background: item.status === 'out_of_stock' ? 'var(--danger-bg)' : 'var(--warning-bg)' }}>
                    <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                    <td><span className="badge badge-gray">{item.category}</span></td>
                    <td style={{ fontWeight: 700, color: item.current_stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                      {item.current_stock} {item.unit_type}
                    </td>
                    <td>{item.minimum_stock_level} {item.unit_type}</td>
                    <td>
                      <span className={`badge ${item.status === 'out_of_stock' ? 'badge-danger' : 'badge-warning'}`}>
                        {item.status === 'out_of_stock' ? '❌ Out of Stock' : '⚠️ Low Stock'}
                      </span>
                    </td>
                    <td>{formatCurrency(item.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">Category-wise Stock</div></div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead><tr><th>Category</th><th>Products</th><th>Total Units</th><th>Inventory Value</th></tr></thead>
            <tbody>
              {data.by_category.map((c) => (
                <tr key={c.category}>
                  <td style={{ fontWeight: 600 }}>{c.category}</td>
                  <td>{c.products}</td>
                  <td>{c.total_units}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('profit');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Reports & Analytics</h2>
          <p>Detailed business insights for your hardware shop</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--gray-100)', padding: 4,
        borderRadius: 'var(--radius-md)', marginBottom: 24, flexWrap: 'wrap'
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn"
            style={{
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
              boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: activeTab === tab.id ? 700 : 500,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'profit' && <ProfitReport />}
      {activeTab === 'stock' && <StockReport />}
      {activeTab === 'daily' && <DailySalesReport />}
      {activeTab === 'monthly' && <MonthlySalesReport />}
      {activeTab === 'purchase' && <PurchaseReportTab />}
    </div>
  );
}

function DailySalesReport() {
  const today = todayISO();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    reportService.getDailySales({ from, to }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  };

  // eslint-disable-next-line
  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} max={today} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} max={today} />
        </div>
        <button className="btn btn-primary" onClick={fetch} disabled={loading}>
          {loading ? 'Loading...' : '🔍 Generate'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard label="Total Sales" value={formatCurrency(data.summary.total_amount)} color="var(--primary)" />
            <StatCard label="Transactions" value={data.summary.transaction_count} />
            <StatCard label="Avg. Transaction" value={formatCurrency(data.summary.avg_transaction)} />
            <StatCard label="Discounts Given" value={formatCurrency(data.summary.total_discount)} color="var(--danger)" />
          </div>

          {data.payment_breakdown.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div className="card-title">Payment Method Breakdown</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {data.payment_breakdown.map((p) => (
                    <div key={p.payment_method} style={{ flex: 1, minWidth: 120, background: 'var(--gray-50)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.payment_method}</div>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(p.amount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.count} transactions</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><div className="card-title">Transactions</div></div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Invoice</th><th>Date</th><th>Time</th><th>Customer</th><th>Amount</th><th>Payment</th></tr></thead>
                <tbody>
                  {data.transactions.map((t) => (
                    <tr key={t.invoice_number}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{t.invoice_number}</td>
                      <td>{formatDate(t.sale_date)}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{t.sale_time}</td>
                      <td>{t.customer_name || 'Walk-in'}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(t.final_amount)}</td>
                      <td>{t.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.transactions.length === 0 && <div className="table-empty"><p>No sales in this period</p></div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MonthlySalesReport() {
  const [month, setMonth] = useState(currentMonthISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    reportService.getMonthlySales({ month }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  };

  // eslint-disable-next-line
  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} max={currentMonthISO()} />
        </div>
        <button className="btn btn-primary" onClick={fetch} disabled={loading}>{loading ? 'Loading...' : '🔍 Generate'}</button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <StatCard label="Monthly Revenue" value={formatCurrency(data.summary.revenue)} color="var(--primary)" />
            <StatCard label="Transactions" value={data.summary.transactions} />
          </div>

          {data.daily_breakdown.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div className="card-title">Daily Revenue for {month}</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.daily_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'dd')} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {data.top_customers.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">Top Customers</div></div>
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead><tr><th>Customer</th><th>Visits</th><th>Total Spent</th></tr></thead>
                  <tbody>
                    {data.top_customers.map((c) => (
                      <tr key={c.customer_name}>
                        <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                        <td>{c.visits}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(c.spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PurchaseReportTab() {
  const today = todayISO();
  const monthStart = today.slice(0, 7) + '-01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    reportService.getPurchase({ from, to }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  };

  // eslint-disable-next-line
  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} max={today} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} max={today} />
        </div>
        <button className="btn btn-primary" onClick={fetch} disabled={loading}>{loading ? 'Loading...' : '🔍 Generate'}</button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard label="Total Purchased" value={formatCurrency(data.summary.total_amount)} color="var(--primary)" />
            <StatCard label="Total Orders" value={data.summary.total_orders} />
            <StatCard label="Avg. Order Value" value={formatCurrency(data.summary.avg_order)} />
          </div>

          {data.by_supplier.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div className="card-title">Top Suppliers</div></div>
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead><tr><th>Supplier</th><th>Orders</th><th>Total</th></tr></thead>
                  <tbody>
                    {data.by_supplier.map((s) => (
                      <tr key={s.supplier_name}>
                        <td style={{ fontWeight: 600 }}>{s.supplier_name}</td>
                        <td>{s.orders}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.payment_breakdown.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">Payment Status</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12 }}>
                  {data.payment_breakdown.map((p) => (
                    <div key={p.payment_status} style={{ flex: 1, background: 'var(--gray-50)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.payment_status}</div>
                      <div style={{ fontWeight: 700, color: p.payment_status === 'Pending' ? 'var(--warning)' : p.payment_status === 'Paid' ? 'var(--success)' : 'var(--primary)' }}>{formatCurrency(p.amount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.count} orders</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
