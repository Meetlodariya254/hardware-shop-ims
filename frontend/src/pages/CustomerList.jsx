import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../services/customerService';
import { formatCurrency } from '../utils/currencyUtils';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdRefresh, MdStar } from 'react-icons/md';

function CustomerForm({ customer, onSuccess, onClose }) {
  const isEdit = !!customer;
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: customer ? { ...customer, balance: parseFloat(customer.balance || 0) } : {}
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (isEdit) { await customerService.update(customer.customer_id, data); toast.success('Customer updated'); }
      else { await customerService.create(data); toast.success('Customer added'); }
      onSuccess();
    } catch (err) { toast.error(err?.response?.data?.message || 'Operation failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Customer' : 'Add Customer'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form id="customer-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label">Customer Name <span className="required">*</span></label>
              <input {...register('customer_name', { required: true, minLength: 2 })} className={`form-control ${errors.customer_name ? 'error' : ''}`} placeholder="Suresh Kumar" autoFocus />
              {errors.customer_name && <p className="form-error">Name is required</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input {...register('mobile_number')} className="form-control" placeholder="9876543210" maxLength={10} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input {...register('email')} type="email" className="form-control" placeholder="customer@example.com" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input {...register('city')} className="form-control" placeholder="Mumbai" />
              </div>
              <div className="form-group">
                <label className="form-label">Balance (₹)</label>
                <input {...register('balance')} type="number" step="0.01" className="form-control" placeholder="0" />
                <p className="form-hint">Negative if they owe you, Positive if advance</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea {...register('address')} className="form-control" rows={2} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input {...register('is_regular')} type="checkbox" />
                <span className="form-label" style={{ margin: 0 }}>⭐ Mark as Regular Customer</span>
              </label>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="customer-form" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await customerService.getAll({ page, limit: 25, search });
      setCustomers(res.data.data.customers);
      setPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(1), 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id);
      toast.success('Customer removed');
      setDeleteConfirm(null);
      fetchCustomers(1);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>Customers</h2><p>{pagination.total} total customers</p></div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={() => fetchCustomers(1)}><MdRefresh /></button>
          <button className="btn btn-primary" onClick={() => { setEditCustomer(null); setShowForm(true); }}><MdAdd /> Add Customer</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <MdSearch className="search-icon" />
          <input className="form-control" placeholder="Search customers by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? <div className="page-loader"><div className="spinner"></div></div>
            : customers.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty-icon">👥</div>
                <h3>No customers yet</h3>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}><MdAdd /> Add First Customer</button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Customer</th><th>Mobile</th><th>City</th><th>Purchases</th><th>Total Spent</th><th>Balance</th><th>Type</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.customer_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.is_regular && <MdStar style={{ color: 'var(--warning)', fontSize: '1.1rem' }} />}
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                            {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{c.mobile_number || '-'}</td>
                      <td>{c.city || '-'}</td>
                      <td><span className="badge badge-gray">{c.total_purchases || 0} orders</span></td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(c.total_spent || 0)}</td>
                      <td style={{ fontWeight: 700, color: parseFloat(c.balance) < 0 ? 'var(--danger)' : parseFloat(c.balance) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatCurrency(c.balance || 0)}
                      </td>
                      <td>
                        {c.is_regular
                          ? <span className="badge badge-warning">⭐ Regular</span>
                          : <span className="badge badge-gray">Walk-in</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" title="Edit" onClick={() => { setEditCustomer(c); setShowForm(true); }}><MdEdit /></button>
                          <button className="action-btn danger" title="Delete" onClick={() => setDeleteConfirm(c)}><MdDelete /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {showForm && <CustomerForm customer={editCustomer} onSuccess={() => { setShowForm(false); setEditCustomer(null); fetchCustomers(1); }} onClose={() => { setShowForm(false); setEditCustomer(null); }} />}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Remove Customer</h3><button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button></div>
            <div className="modal-body">
              <p>Remove <strong>{deleteConfirm.customer_name}</strong>? Their purchase history will be preserved.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.customer_id)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
