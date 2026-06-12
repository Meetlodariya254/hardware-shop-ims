import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { formatCurrency, formatPercent } from '../../utils/currencyUtils';

import toast from 'react-hot-toast';
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdVisibility,
  MdRefresh,
} from 'react-icons/md';
import ProductForm from './ProductForm';
import ProductDetail from './ProductDetail';

const UNIT_TYPES = ['pcs', 'kg', 'bag', 'box', 'meter', 'liter', 'bundle', 'roll', 'sheet', 'set', 'pair', 'dozen', 'quintal', 'ton'];
const CATEGORIES = [
  'Cement & Concrete', 'Steel & Iron', 'Pipes & Fittings', 'Electrical',
  'Paint & Chemicals', 'Wood & Timber', 'Hardware & Fasteners', 'Tools & Equipment',
  'Tiles & Flooring', 'Sanitary & Plumbing', 'Roofing', 'Glass & Mirrors',
  'Adhesives & Sealants', 'Safety Equipment', 'Other'
];

function StockBadge({ status }) {
  const map = {
    in_stock: ['stock-badge stock-in', 'In Stock'],
    low_stock: ['stock-badge stock-low', 'Low Stock'],
    out_of_stock: ['stock-badge stock-out', 'Out of Stock'],
  };
  const [cls, label] = map[status] || ['stock-badge stock-in', 'In Stock'];
  return <span className={cls}>{label}</span>;
}

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchParams] = useSearchParams();

   
  useEffect(() => {
    const ss = searchParams.get('stock_status');
    if (ss) setStockStatus(ss);
  }, []);

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await productService.getAll({ page, limit: 25, search, category, stock_status: stockStatus });
      setProducts(res.data.data.products);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category, stockStatus]);

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(1), 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  const handleDelete = async (id) => {
    try {
      await productService.delete(id);
      toast.success('Product deleted');
      setDeleteConfirm(null);
      fetchProducts(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditProduct(null);
    fetchProducts(1);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Products</h2>
          <p>Manage your hardware shop inventory</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => fetchProducts(pagination.page)}>
            <MdRefresh /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>
            <MdAdd /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <MdSearch className="search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search products by name, brand, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-control filter-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="form-control filter-select"
          value={stockStatus}
          onChange={(e) => setStockStatus(e.target.value)}
        >
          <option value="">All Stock Status</option>
          <option value="in_stock">✅ In Stock</option>
          <option value="low_stock">⚠️ Low Stock</option>
          <option value="out_of_stock">❌ Out of Stock</option>
        </select>
        {(search || category || stockStatus) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCategory(''); setStockStatus(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span className="badge badge-gray">
          <strong>{pagination.total}</strong> products total
        </span>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          {loading ? (
            <div className="page-loader">
              <div className="spinner"></div>
              <span>Loading products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="table-empty">
              <div className="table-empty-icon">📦</div>
              <h3>No products found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                {search || category || stockStatus
                  ? 'Try adjusting your search filters'
                  : 'Add your first product to get started'}
              </p>
              {!search && !category && !stockStatus && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
                  <MdAdd /> Add First Product
                </button>
              )}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>Margin</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.product_name}</div>
                      {p.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand}</div>}
                      {p.sku && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>SKU: {p.sku}</div>}
                    </td>
                    <td>
                      <span className="badge badge-gray">{p.category}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{formatCurrency(p.purchase_price)}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(p.selling_price)}</span>
                    </td>
                    <td>
                      <span style={{
                        color: p.profit_margin_percent >= 20 ? 'var(--success)' :
                               p.profit_margin_percent >= 10 ? 'var(--warning)' : 'var(--danger)',
                        fontWeight: 600, fontSize: '0.875rem'
                      }}>
                        {formatPercent(p.profit_margin_percent)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{p.current_stock}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.75rem' }}>{p.unit_type}</span>
                    </td>
                    <td><StockBadge status={p.stock_status} /></td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          title="View details"
                          onClick={() => setViewProduct(p.product_id)}
                        >
                          <MdVisibility />
                        </button>
                        <button
                          className="action-btn"
                          title="Edit"
                          onClick={() => { setEditProduct(p); setShowForm(true); }}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="action-btn danger"
                          title="Delete"
                          onClick={() => setDeleteConfirm(p)}
                        >
                          <MdDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={pagination.page === 1} onClick={() => fetchProducts(pagination.page - 1)}>‹</button>
              {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`page-btn ${p === pagination.page ? 'active' : ''}`}
                  onClick={() => fetchProducts(p)}
                >
                  {p}
                </button>
              ))}
              <button className="page-btn" disabled={pagination.page === pagination.total_pages} onClick={() => fetchProducts(pagination.page + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onSuccess={handleFormSuccess}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          categories={CATEGORIES}
          unitTypes={UNIT_TYPES}
        />
      )}

      {/* Product Detail Modal */}
      {viewProduct && (
        <ProductDetail
          productId={viewProduct}
          onClose={() => setViewProduct(null)}
          onEdit={(p) => { setViewProduct(null); setEditProduct(p); setShowForm(true); }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Product</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                <span className="alert-icon">⚠️</span>
                <div>
                  Are you sure you want to delete <strong>{deleteConfirm.product_name}</strong>?
                  This will mark it as inactive. Existing sales and purchase records will be preserved.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.product_id)}>Delete Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
