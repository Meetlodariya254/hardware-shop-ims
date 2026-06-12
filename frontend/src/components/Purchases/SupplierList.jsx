import { useState, useEffect, useCallback } from 'react';
import { supplierService } from '../../services/supplierService';
import { formatCurrency } from '../../utils/currencyUtils';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdRefresh } from 'react-icons/md';

function SupplierForm({ supplier, onSuccess, onClose }) {
  const isEdit = !!supplier;
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: supplier || {} });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (isEdit) { await supplierService.update(supplier.supplier_id, data); toast.success('Supplier updated'); }
      else { await supplierService.create(data); toast.success('Supplier added'); }
      onSuccess();
    } catch (err) { toast.error(err?.response?.data?.message || 'Operation failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Supplier' : 'Add Supplier'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label">Supplier Name <span className="required">*</span></label>
              <input {...register('supplier_name', { required: true, minLength: 3 })} className={`form-control ${errors.supplier_name ? 'error' : ''}`} placeholder="ABC Wholesale Traders" autoFocus />
              {errors.supplier_name && <p className="form-error">Name is required (min 3 chars)</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input {...register('mobile_number')} className="form-control" placeholder="9876543210" maxLength={10} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input {...register('email')} type="email" className="form-control" placeholder="supplier@example.com" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input {...register('city')} className="form-control" placeholder="Mumbai" />
              </div>
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input {...register('gst_number')} className="form-control" placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea {...register('address')} className="form-control" rows={2} placeholder="Full address..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Bank Account</label>
                <input {...register('bank_account')} className="form-control" placeholder="Account number for payment tracking" />
              </div>
              <div className="form-group">
                <label className="form-label">Balance (₹)</label>
                <input {...register('balance')} type="number" step="0.01" className="form-control" placeholder="0" />
                <p className="form-hint">Negative if we owe them, Positive if advance</p>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="supplier-form" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchSuppliers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await supplierService.getAll({ page, limit: 25, search });
      setSuppliers(res.data.data.suppliers);
      setPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchSuppliers(1), 300);
    return () => clearTimeout(t);
  }, [fetchSuppliers]);

  const handleDelete = async (id) => {
    try {
      await supplierService.delete(id);
      toast.success('Supplier removed');
      setDeleteConfirm(null);
      fetchSuppliers(1);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>Suppliers</h2><p>{pagination.total} total suppliers</p></div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => fetchSuppliers(1)}><MdRefresh /></button>
          <button className="btn btn-primary" onClick={() => { setEditSupplier(null); setShowForm(true); }}><MdAdd /> Add Supplier</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <MdSearch className="search-icon" />
          <input className="form-control" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? <div className="page-loader"><div className="spinner"></div></div>
            : suppliers.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty-icon">🚚</div>
                <h3>No suppliers yet</h3>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}><MdAdd /> Add First Supplier</button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Supplier</th><th>Mobile</th><th>City</th><th>GST No.</th><th>Total Orders</th><th>Total Spent</th><th>Balance</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.supplier_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.supplier_name}</div>
                        {s.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</div>}
                      </td>
                      <td>{s.mobile_number || '-'}</td>
                      <td>{s.city || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{s.gst_number || '-'}</td>
                      <td><span className="badge badge-gray">{s.total_orders} orders</span></td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(s.total_spent || 0)}</td>
                      <td style={{ fontWeight: 700, color: parseFloat(s.balance) < 0 ? 'var(--danger)' : parseFloat(s.balance) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatCurrency(s.balance || 0)}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" title="Edit" onClick={() => { setEditSupplier(s); setShowForm(true); }}><MdEdit /></button>
                          <button className="action-btn danger" title="Delete" onClick={() => setDeleteConfirm(s)}><MdDelete /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {showForm && <SupplierForm supplier={editSupplier} onSuccess={() => { setShowForm(false); setEditSupplier(null); fetchSuppliers(1); }} onClose={() => { setShowForm(false); setEditSupplier(null); }} />}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Remove Supplier</h3><button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button></div>
            <div className="modal-body">
              <p>Remove <strong>{deleteConfirm.supplier_name}</strong>? If they have purchase history, they'll be deactivated instead of deleted.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.supplier_id)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
