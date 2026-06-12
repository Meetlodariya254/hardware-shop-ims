import { useState, useEffect, useCallback } from 'react';
import { salesService } from '../../services/salesService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatDate, formatTime, todayISO } from '../../utils/dateUtils';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { MdAdd, MdDelete, MdSearch, MdRefresh, MdVisibility } from 'react-icons/md';

function SaleForm({ onSuccess, onClose }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stockWarnings, setStockWarnings] = useState([]);

  const { register, handleSubmit, watch, control, setValue } = useForm({
    defaultValues: {
      customer_id: '',
      walkin_customer_name: '',
      sale_date: todayISO(),
      sale_time: new Date().toTimeString().slice(0, 5),
      discount_amount: 0,
      payment_method: 'Cash',
      payment_status: 'Paid',
      notes: '',
      items: [{ product_id: '', quantity_sold: 1, selling_price_per_unit: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items') || [];
  const total = items.reduce((sum, i) => sum + ((i.quantity_sold || 0) * (i.selling_price_per_unit || 0)), 0);
  const discount = parseFloat(watch('discount_amount') || 0);
  const selectedCustomerId = watch('customer_id');

  useEffect(() => {
    Promise.all([productService.getAll({ limit: 200 }), customerService.getAll({ limit: 100 })])
      .then(([pRes, cRes]) => {
        setProducts(pRes.data.data.products || []);
        setCustomers(cRes.data.data.customers || []);
      });
  }, []);

  const handleProductSelect = (index, productId) => {
    const prod = products.find((p) => p.product_id === productId);
    if (prod) {
      setValue(`items.${index}.selling_price_per_unit`, parseFloat(prod.selling_price));
      if (prod.current_stock <= prod.minimum_stock_level) {
        setStockWarnings((w) => [...w.filter((x) => x !== prod.product_name), `"${prod.product_name}" has low stock: ${prod.current_stock} ${prod.unit_type}`]);
      }
    }
  };

  const onSubmit = async (data) => {
    if (data.items.some((i) => !i.product_id)) { toast.error('Please select a product for each item'); return; }
    setLoading(true);
    try {
      const res = await salesService.create({
        ...data,
        customer_id: data.customer_id || null,
        walkin_customer_name: data.customer_id ? null : data.walkin_customer_name,
        amount_paid: data.amount_paid ? parseFloat(data.amount_paid) : null,
        discount_amount: parseFloat(data.discount_amount || 0),
        items: data.items.map((i) => ({
          product_id: i.product_id,
          quantity_sold: parseInt(i.quantity_sold),
          selling_price_per_unit: parseFloat(i.selling_price_per_unit),
        })),
      });
      const warnings = res.data.data.stock_warnings || [];
      if (warnings.length > 0) {
        warnings.forEach((w) => toast(`⚠️ ${w}`, { duration: 5000 }));
      }
      toast.success(`Sale recorded! Invoice: ${res.data.data.sale.invoice_number}`);
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create sale');
    } finally { setLoading(false); }
  };

  const finalAmount = total - discount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div className="modal-header">
          <h3 className="modal-title">New Sale</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(95vh - 160px)' }}>
          {stockWarnings.length > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <span className="alert-icon">⚠️</span>
              <div>
                {stockWarnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            </div>
          )}

          <form id="sale-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer (Optional)</label>
                <select {...register('customer_id')} className="form-control">
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}{c.mobile_number ? ` - ${c.mobile_number}` : ''}</option>)}
                </select>
              </div>
              {!selectedCustomerId && (
                <div className="form-group">
                  <label className="form-label">Walk-in Name</label>
                  <input {...register('walkin_customer_name')} className="form-control" placeholder="Optional name" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Sale Date <span className="required">*</span></label>
                <input {...register('sale_date')} type="date" className="form-control" max={todayISO()} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input {...register('sale_time')} type="time" className="form-control" />
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>Items <span className="required">*</span></label>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => append({ product_id: '', quantity_sold: 1, selling_price_per_unit: 0 })}>
                  <MdAdd /> Add Item
                </button>
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: 80 }}>Stock</th>
                      <th style={{ width: 90 }}>Qty</th>
                      <th style={{ width: 130 }}>Price/Unit (₹)</th>
                      <th style={{ width: 110 }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const item = items[index] || {};
                      const product = products.find((p) => p.product_id === item.product_id);
                      const lineTotal = (item.quantity_sold || 0) * (item.selling_price_per_unit || 0);
                      const overStock = product && parseInt(item.quantity_sold) > product.current_stock;

                      return (
                        <tr key={field.id} style={{ background: overStock ? 'var(--danger-bg)' : 'transparent' }}>
                          <td>
                            <select
                              {...register(`items.${index}.product_id`)}
                              className="form-control"
                              style={{ fontSize: '0.8125rem' }}
                              onChange={(e) => handleProductSelect(index, e.target.value)}
                            >
                              <option value="">Select product...</option>
                              {products.map((p) => (
                                <option key={p.product_id} value={p.product_id} disabled={p.current_stock === 0}>
                                  {p.product_name}{p.current_stock === 0 ? ' (OUT)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: overStock ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {product ? `${product.current_stock} ${product.unit_type}` : '-'}
                          </td>
                          <td>
                            <input {...register(`items.${index}.quantity_sold`)} type="number" min="1" max={product?.current_stock || 9999} className="form-control" style={{ fontSize: '0.8125rem' }} />
                            {overStock && <p style={{ fontSize: '0.625rem', color: 'var(--danger)', margin: '2px 0 0' }}>Exceeds stock!</p>}
                          </td>
                          <td>
                            <input {...register(`items.${index}.selling_price_per_unit`)} type="number" step="0.01" min="0" className="form-control" style={{ fontSize: '0.8125rem' }} />
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatCurrency(lineTotal)}</td>
                          <td>
                            {fields.length > 1 && (
                              <button type="button" className="action-btn danger" onClick={() => remove(index)}><MdDelete /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: 'var(--gray-50)' }}>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Subtotal:</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700 }}>{formatCurrency(total)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', padding: '4px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Discount (₹):</span>
                          <input {...register('discount_amount')} type="number" min="0" step="0.01" className="form-control" style={{ width: 100, fontSize: '0.875rem' }} />
                        </div>
                      </td>
                      <td style={{ padding: '4px 16px', color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(discount)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 800, fontSize: '1rem' }}>Final Amount:</td>
                      <td style={{ padding: '10px 16px', fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)' }}>{formatCurrency(finalAmount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method <span className="required">*</span></label>
                <select {...register('payment_method')} className="form-control">
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="Card">💳 Card</option>
                  <option value="Cheque">📄 Cheque</option>
                  <option value="Credit">📋 Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select {...register('payment_status')} className="form-control">
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount Paid (₹)</label>
                <input {...register('amount_paid')} type="number" step="0.01" min="0" className="form-control" placeholder={finalAmount} />
                <p className="form-hint" style={{ marginTop: 4 }}>Difference applied to customer balance</p>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea {...register('notes')} className="form-control" rows={2} placeholder="Optional..." />
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="sale-form" className={`btn btn-success ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Recording...' : `Record Sale (${formatCurrency(finalAmount)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesList() {
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewDetail, setViewDetail] = useState(null);

  const fetchSales = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await salesService.getAll({ page, limit: 25, search, payment_status: paymentStatus, from, to });
      setSales(res.data.data.sales);
      setPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  }, [search, paymentStatus, from, to]);

  useEffect(() => {
    const t = setTimeout(() => fetchSales(1), 300);
    return () => clearTimeout(t);
  }, [fetchSales]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Sales</h2>
          <p>{pagination.total} total transactions</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => fetchSales(1)}><MdRefresh /></button>
          <button className="btn btn-success" onClick={() => setShowForm(true)}><MdAdd /> New Sale</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <MdSearch className="search-icon" />
          <input className="form-control" placeholder="Search by invoice or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="form-control filter-select" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="form-control filter-select" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="form-control filter-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? <div className="page-loader"><div className="spinner"></div></div>
            : sales.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty-icon">🧾</div>
                <h3>No sales recorded yet</h3>
                <button className="btn btn-success" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}><MdAdd /> Record First Sale</button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.sale_id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>{s.invoice_number}</td>
                      <td>{s.customer_name || s.walkin_customer_name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                      <td>{formatDate(s.sale_date)}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{formatTime(s.sale_time)}</td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }} title={s.item_names}>
                          {s.item_names || <span className="badge badge-gray">{s.item_count} items</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(s.final_amount)}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{s.payment_method}</td>
                      <td><span className={`badge ${s.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{s.payment_status}</span></td>
                      <td>
                        <button className="action-btn" onClick={() => setViewDetail(s.sale_id)}><MdVisibility /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        {pagination.total_pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Page {pagination.page} of {pagination.total_pages}</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={pagination.page === 1} onClick={() => fetchSales(pagination.page - 1)}>‹</button>
              <button className="page-btn" disabled={pagination.page === pagination.total_pages} onClick={() => fetchSales(pagination.page + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {showForm && <SaleForm onSuccess={() => { setShowForm(false); fetchSales(1); }} onClose={() => setShowForm(false)} />}
      {viewDetail && <SaleDetailModal saleId={viewDetail} onClose={() => setViewDetail(null)} onSuccess={() => { setViewDetail(null); fetchSales(1); }} />}
    </div>
  );
}

function SaleDetailModal({ saleId, onClose, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleMarkAsPaid = async () => {
    setLoading(true);
    try {
      await salesService.update(saleId, { payment_status: 'Paid' });
      toast.success('Payment status updated to Paid');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update payment status');
      setLoading(false);
    }
  };

  useEffect(() => {
    salesService.getOne(saleId).then((res) => setData(res.data.data)).finally(() => setLoading(false));
  }, [saleId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Invoice Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="page-loader"><div className="spinner"></div></div> : !data ? <p>Not found</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invoice</p><p style={{ fontWeight: 700, fontFamily: 'monospace' }}>{data.sale.invoice_number}</p></div>
                <div><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date</p><p style={{ fontWeight: 600 }}>{formatDate(data.sale.sale_date)}</p></div>
                <div><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer</p><p style={{ fontWeight: 600 }}>{data.sale.customer_name || data.sale.walkin_customer_name || 'Walk-in'}</p></div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Profit</th></tr></thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.sale_item_id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td>{item.quantity_sold} {item.unit_type}</td>
                        <td>{formatCurrency(item.selling_price_per_unit)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(item.total_item_revenue)}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(item.item_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: 'var(--gray-50)' }}>
                    <tr><td colSpan={3} style={{ textAlign: 'right', padding: '8px 16px' }}>Subtotal:</td><td colSpan={2} style={{ padding: '8px 16px', fontWeight: 700 }}>{formatCurrency(data.sale.total_amount)}</td></tr>
                    {parseFloat(data.sale.discount_amount) > 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'right', padding: '8px 16px' }}>Discount:</td><td colSpan={2} style={{ padding: '8px 16px', color: 'var(--danger)' }}>-{formatCurrency(data.sale.discount_amount)}</td></tr>
                    )}
                    <tr><td colSpan={3} style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 800 }}>Final:</td><td colSpan={2} style={{ padding: '10px 16px', fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)' }}>{formatCurrency(data.sale.final_amount)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                <span className={`badge ${data.sale.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{data.sale.payment_status}</span>
                <span className="badge badge-gray">via {data.sale.payment_method}</span>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          {data && data.sale.payment_status === 'Pending' && (
            <button className="btn btn-success" onClick={handleMarkAsPaid} disabled={loading}>
              Mark as Paid
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
