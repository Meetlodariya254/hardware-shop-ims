import { useState, useEffect } from 'react';
import { productService } from '../../services/productService';
import { formatCurrency, formatPercent } from '../../utils/currencyUtils';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { MdEdit } from 'react-icons/md';

function StockBadge({ status }) {
  const map = {
    in_stock: ['stock-badge stock-in', 'In Stock'],
    low_stock: ['stock-badge stock-low', 'Low Stock'],
    out_of_stock: ['stock-badge stock-out', 'Out of Stock'],
  };
  const [cls, label] = map[status] || ['stock-badge stock-in', 'In Stock'];
  return <span className={cls}>{label}</span>;
}

export default function ProductDetail({ productId, onClose, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getOne(productId)
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Product Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="page-loader"><div className="spinner"></div></div>
          ) : !data ? (
            <p>Product not found</p>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{data.product.product_name}</h2>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-primary">{data.product.category}</span>
                    {data.product.brand && <span className="badge badge-gray">{data.product.brand}</span>}
                    <StockBadge status={data.product.stock_status} />
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => onEdit(data.product)}>
                  <MdEdit /> Edit
                </button>
              </div>

              {/* Price & Stock Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Purchase Price', value: formatCurrency(data.product.purchase_price) },
                  { label: 'Selling Price', value: formatCurrency(data.product.selling_price), bold: true, color: 'var(--success)' },
                  { label: 'Profit Margin', value: formatPercent(data.product.profit_margin_percent), color: parseFloat(data.product.profit_margin_percent) >= 15 ? 'var(--success)' : 'var(--warning)' },
                  { label: 'Stock Value', value: formatCurrency(data.product.stock_value) },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: item.color || 'var(--text-primary)' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 24 }}>
                {[
                  ['Current Stock', `${data.product.current_stock} ${data.product.unit_type}`],
                  ['Min Stock Level', `${data.product.minimum_stock_level} ${data.product.unit_type}`],
                  ['Unit Type', data.product.unit_type],
                  ['SKU', data.product.sku || '-'],
                  ['Product Code', data.product.product_code || '-'],
                  ['Added On', formatDate(data.product.created_at)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Stock History */}
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9375rem' }}>Stock History (Last 20 entries)</h4>
                {data.stock_history.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No stock movements recorded yet</p>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Change</th>
                          <th>Old Stock</th>
                          <th>New Stock</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.stock_history.map((h) => (
                          <tr key={h.history_id}>
                            <td style={{ fontSize: '0.8125rem' }}>{formatDateTime(h.created_at)}</td>
                            <td>
                              <span className={`badge ${h.transaction_type === 'Purchase' ? 'badge-success' : h.transaction_type === 'Sale' ? 'badge-primary' : 'badge-gray'}`}>
                                {h.transaction_type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: h.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                            </td>
                            <td>{h.old_stock}</td>
                            <td style={{ fontWeight: 600 }}>{h.new_stock}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
