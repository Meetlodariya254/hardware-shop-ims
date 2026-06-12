import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { productService } from '../../services/productService';
import toast from 'react-hot-toast';
import { formatPercent } from '../../utils/currencyUtils';

const productSchema = z.object({
  product_name: z.string().min(3, 'Name must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional(),
  purchase_price: z.coerce.number().positive('Must be greater than 0'),
  selling_price: z.coerce.number().positive('Must be greater than 0'),
  current_stock: z.coerce.number().int().min(0, 'Cannot be negative').default(0),
  minimum_stock_level: z.coerce.number().int().min(0).default(10),
  unit_type: z.string().min(1, 'Unit type is required'),
  sku: z.string().optional(),
  product_code: z.string().optional(),
  description: z.string().optional(),
});

const UNIT_TYPES = ['pcs', 'kg', 'bag', 'box', 'meter', 'liter', 'bundle', 'roll', 'sheet', 'set', 'pair', 'dozen', 'quintal', 'ton'];
const CATEGORIES = [
  'Cement & Concrete', 'Steel & Iron', 'Pipes & Fittings', 'Electrical',
  'Paint & Chemicals', 'Wood & Timber', 'Hardware & Fasteners', 'Tools & Equipment',
  'Tiles & Flooring', 'Sanitary & Plumbing', 'Roofing', 'Glass & Mirrors',
  'Adhesives & Sealants', 'Safety Equipment', 'Other'
];

export default function ProductForm({ product, onSuccess, onClose }) {
  const isEdit = !!product;
  const [isLoading, setIsLoading] = useState(false);
  const [margin, setMargin] = useState(null);

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price),
      current_stock: parseInt(product.current_stock),
      minimum_stock_level: parseInt(product.minimum_stock_level),
    } : { current_stock: 0, minimum_stock_level: 10 },
  });

  const purchasePrice = watch('purchase_price');
  const sellingPrice = watch('selling_price');

  useEffect(() => {
    if (purchasePrice > 0 && sellingPrice > 0) {
      const m = ((sellingPrice - purchasePrice) / purchasePrice) * 100;
      setMargin(m);
    } else {
      setMargin(null);
    }
  }, [purchasePrice, sellingPrice]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      if (isEdit) {
        await productService.update(product.product_id, data);
        toast.success('Product updated successfully');
      } else {
        await productService.create(data);
        toast.success('Product added successfully');
      }
      onSuccess();
    } catch (err) {
      const details = err?.response?.data?.error?.details;
      if (details?.length) {
        details.forEach((d) => toast.error(d.message));
      } else {
        toast.error(err?.response?.data?.message || 'Operation failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-row">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Product Name <span className="required">*</span></label>
                <input
                  {...register('product_name')}
                  className={`form-control ${errors.product_name ? 'error' : ''}`}
                  placeholder="e.g. ACC 53 Grade Cement (50kg)"
                  autoFocus
                />
                {errors.product_name && <p className="form-error">{errors.product_name.message}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category <span className="required">*</span></label>
                <select {...register('category')} className={`form-control ${errors.category ? 'error' : ''}`}>
                  <option value="">Select category...</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="form-error">{errors.category.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input
                  {...register('brand')}
                  className="form-control"
                  placeholder="e.g. ACC, Tata, L&T"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Type <span className="required">*</span></label>
                <select {...register('unit_type')} className={`form-control ${errors.unit_type ? 'error' : ''}`}>
                  <option value="">Select unit...</option>
                  {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {errors.unit_type && <p className="form-error">{errors.unit_type.message}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Purchase Price (₹) <span className="required">*</span></label>
                <input
                  {...register('purchase_price')}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${errors.purchase_price ? 'error' : ''}`}
                  placeholder="0.00"
                />
                {errors.purchase_price && <p className="form-error">{errors.purchase_price.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price (₹) <span className="required">*</span></label>
                <input
                  {...register('selling_price')}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${errors.selling_price ? 'error' : ''}`}
                  placeholder="0.00"
                />
                {errors.selling_price && <p className="form-error">{errors.selling_price.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Profit Margin</label>
                <div className="form-control" style={{
                  background: 'var(--gray-50)',
                  cursor: 'default',
                  color: margin !== null
                    ? margin >= 0 ? 'var(--success)' : 'var(--danger)'
                    : 'var(--text-muted)',
                  fontWeight: 700,
                }}>
                  {margin !== null
                    ? `${margin >= 0 ? '+' : ''}${formatPercent(margin)}`
                    : 'Enter prices above'}
                </div>
                {margin !== null && margin < 0 && (
                  <p className="form-error">⚠️ Selling price is below purchase price!</p>
                )}
                {margin !== null && margin < 10 && margin >= 0 && (
                  <p className="form-hint">⚠️ Low margin ({formatPercent(margin)})</p>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input
                  {...register('current_stock')}
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="0"
                />
                {isEdit && <p className="form-hint">Note: Stock changes via purchases/sales, not here.</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Stock Level</label>
                <input
                  {...register('minimum_stock_level')}
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="10"
                />
                <p className="form-hint">Alert when stock falls below this</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">SKU</label>
                <input
                  {...register('sku')}
                  className="form-control"
                  placeholder="e.g. CEM-ACC-53-50"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Code</label>
                <input
                  {...register('product_code')}
                  className="form-control"
                  placeholder="Internal code"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                {...register('description')}
                className="form-control"
                placeholder="Optional product description..."
                rows={3}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="product-form"
            className={`btn btn-primary ${isLoading ? 'btn-loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
