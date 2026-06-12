import { useState, useEffect, useCallback } from 'react';
import { purchaseService } from '../../services/purchaseService';
import { supplierService } from '../../services/supplierService';
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatDate, todayISO } from '../../utils/dateUtils';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { MdAdd, MdDelete, MdSearch, MdRefresh, MdVisibility } from 'react-icons/md';

function PurchaseForm({ onSuccess, onClose }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm({
    defaultValues: {
      supplier_id: '',
      purchase_date: todayISO(),
      payment_status: 'Pending',
      payment_method: 'Cash',
      reference_number: '',
      notes: '',
      items: [{ product_id: '', quantity_purchased: 1, purchase_price_per_unit: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items') || [];
  const total = items.reduce((sum, item) => sum + ((item.quantity_purchased || 0) * (item.purchase_price_per_unit || 0)), 0);

  useEffect(() => {
    Promise.all([supplierService.getAll({ limit: 100 }), productService.getAll({ limit: 200 })])
      .then(([suppRes, prodRes]) => {
        setSuppliers(suppRes.data.data.suppliers || []);
        setProducts(prodRes.data.data.products || []);
      });
  }, []);

  const onSubmit = async (data) => {
    if (data.items.some((i) => !i.product_id)) {
      toast.error('Please select a product for each item');
      return;
    }
    setLoading(true);
    try {
      await purchaseService.create({
        ...data,
        items: data.items.map((i) => ({
          product_id: i.product_id,
          quantity_purchased: parseInt(i.quantity_purchased),
          purchase_price_per_unit: parseFloat(i.purchase_price_per_unit),
        })),
      });
      toast.success('Purchase order created! Stock updated.');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div className="modal-header">
          <h3 className="modal-title">Create Purchase Order</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(95vh - 160px)' }}>
          <form id="purchase-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Supplier <span className="required">*</span></label>
                <select {...register('supplier_id', { required: 'Supplier is required' })} className={`form-control ${errors.supplier_id ? 'error' : ''}`}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                </select>
                {errors.supplier_id && <p className="form-error">{errors.supplier_id.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Date <span className="required">*</span></label>
                <input {...register('purchase_date', { required: true })} type="date" className="form-control" max={todayISO()} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select {...register('payment_status')} className="form-control">
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select {...register('payment_method')} className="form-control">
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit">Credit</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference No.</label>
                <input {...register('reference_number')} className="form-control" placeholder="Auto-generated if blank" />
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Purchase Items <span className="required">*</span></label>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => append({ product_id: '', quantity_purchased: 1, purchase_price_per_unit: 0 })}>
                  <MdAdd /> Add Item
                </button>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: 100 }}>Qty</th>
                      <th style={{ width: 140 }}>Price/Unit (₹)</th>
                      <th style={{ width: 120 }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const item = items[index] || {};
                      const lineTotal = (item.quantity_purchased || 0) * (item.purchase_price_per_unit || 0);
                      return (
                        <tr key={field.id}>
                          <td>
                            <select
                              {...register(`items.${index}.product_id`)}
                              className="form-control"
                              style={{ fontSize: '0.8125rem' }}
                              onChange={(e) => {
                                const prod = products.find((p) => p.product_id === e.target.value);
                                if (prod) {
                                  // Auto-fill purchase price
                                }
                              }}
                            >
                              <option value="">Select product...</option>
                              {products.map((p) => (
                                <option key={p.product_id} value={p.product_id}>
                                  {p.product_name} ({p.unit_type})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              {...register(`items.${index}.quantity_purchased`)}
                              type="number"
                              min="1"
                              className="form-control"
                              style={{ fontSize: '0.8125rem' }}
                            />
                          </td>
                          <td>
                            <input
                              {...register(`items.${index}.purchase_price_per_unit`)}
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              style={{ fontSize: '0.8125rem' }}
                            />
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {formatCurrency(lineTotal)}
                          </td>
                          <td>
                            {fields.length > 1 && (
                              <button type="button" className="action-btn danger" onClick={() => remove(index)}>
                                <MdDelete />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px' }}>Total Amount:</td>
                      <td style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)', padding: '12px 16px' }}>
                        {formatCurrency(total)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount Paid (₹)</label>
                <input {...register('amount_paid')} type="number" step="0.01" min="0" className="form-control" placeholder={total} />
                <p className="form-hint" style={{ marginTop: 4 }}>Difference applied to supplier balance</p>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea {...register('notes')} className="form-control" rows={2} placeholder="Optional notes..." />
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="purchase-form" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Creating...' : `Create Order (${formatCurrency(total)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseList() {
  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewDetail, setViewDetail] = useState(null);

  const fetchPurchases = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await purchaseService.getAll({ page, limit: 25, search, payment_status: paymentStatus, from, to });
      setPurchases(res.data.data.purchases);
      setPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  }, [search, paymentStatus, from, to]);

  useEffect(() => {
    const t = setTimeout(() => fetchPurchases(1), 300);
    return () => clearTimeout(t);
  }, [fetchPurchases]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Purchase Orders</h2>
          <p>{pagination.total} total orders</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => fetchPurchases(1)}><MdRefresh /></button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><MdAdd /> New Purchase</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <MdSearch className="search-icon" />
          <input className="form-control" placeholder="Search by supplier or reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="form-control filter-select" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From date" />
        <input type="date" className="form-control filter-select" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To date" />
        <select className="form-control filter-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Partial">Partial</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div className="page-loader"><div className="spinner"></div></div>
          ) : purchases.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon">🛒</div>
              <h3>No purchase orders yet</h3>
              <p>Create your first purchase order to track stock received from suppliers</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
                <MdAdd /> New Purchase Order
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Payment</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((po) => (
                  <tr key={po.purchase_id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>{po.reference_number}</td>
                    <td style={{ fontWeight: 600 }}>{po.supplier_name}</td>
                    <td>{formatDate(po.purchase_date)}</td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }} title={po.item_names}>
                        {po.item_names || <span className="badge badge-gray">{po.item_count} items</span>}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(po.total_amount)}</td>
                    <td>
                      <span className={`badge ${po.payment_status === 'Paid' ? 'badge-success' : po.payment_status === 'Partial' ? 'badge-primary' : 'badge-warning'}`}>
                        {po.payment_status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{po.payment_method || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" title="View" onClick={() => setViewDetail(po.purchase_id)}>
                          <MdVisibility />
                        </button>
                      </div>
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
              <button className="page-btn" disabled={pagination.page === 1} onClick={() => fetchPurchases(pagination.page - 1)}>‹</button>
              <button className="page-btn" disabled={pagination.page === pagination.total_pages} onClick={() => fetchPurchases(pagination.page + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {showForm && <PurchaseForm onSuccess={() => { setShowForm(false); fetchPurchases(1); }} onClose={() => setShowForm(false)} />}
      {viewDetail && (
        <PurchaseDetailModal purchaseId={viewDetail} onClose={() => setViewDetail(null)} onSuccess={() => { setViewDetail(null); fetchPurchases(1); }} />
      )}
    </div>
  );
}

function PurchaseDetailModal({ purchaseId, onClose, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleMarkAsPaid = async () => {
    setLoading(true);
    try {
      await purchaseService.update(purchaseId, { payment_status: 'Paid' });
      toast.success('Payment status updated to Paid');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update payment status');
      setLoading(false);
    }
  };

  useEffect(() => {
    purchaseService.getOne(purchaseId).then((res) => setData(res.data.data)).finally(() => setLoading(false));
  }, [purchaseId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Purchase Order Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="page-loader"><div className="spinner"></div></div> : !data ? <p>Not found</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reference</p>
                  <p style={{ fontWeight: 700, fontFamily: 'monospace' }}>{data.purchase.reference_number}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date</p>
                  <p style={{ fontWeight: 600 }}>{formatDate(data.purchase.purchase_date)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier</p>
                  <p style={{ fontWeight: 600 }}>{data.purchase.supplier_name}</p>
                  {data.purchase.supplier_mobile && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{data.purchase.supplier_mobile}</p>}
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment</p>
                  <span className={`badge ${data.purchase.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                    {data.purchase.payment_status}
                  </span>
                  {data.purchase.payment_method && <span style={{ marginLeft: 8, fontSize: '0.8125rem' }}>via {data.purchase.payment_method}</span>}
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Price/Unit</th><th>Total</th></tr></thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.purchase_item_id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td><span className="badge badge-gray">{item.category}</span></td>
                        <td>{item.quantity_purchased} {item.unit_type}</td>
                        <td>{formatCurrency(item.purchase_price_per_unit)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(item.total_item_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px' }}>Total:</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)', padding: '12px 16px', fontSize: '1rem' }}>
                        {formatCurrency(data.purchase.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {data.purchase.notes && (
                <p style={{ marginTop: 16, padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  📝 {data.purchase.notes}
                </p>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {data && (data.purchase.payment_status === 'Pending' || data.purchase.payment_status === 'Partial') && (
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
