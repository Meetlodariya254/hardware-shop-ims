import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  shop_owner_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  shop_name: z.string().optional(),
  phone_number: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number').optional().or(z.literal('')),
  city: z.string().optional(),
  gst_number: z.string().optional(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    const { confirm_password, ...submitData } = data;
    setIsLoading(true);
    try {
      await registerUser(submitData);
      toast.success('Account created! Welcome to Hardware Shop IMS 🎉');
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-logo">🔧</div>
          <h1>Set Up Your<br />Shop Dashboard</h1>
          <p>
            Create your account to start managing your hardware shop inventory
            with full product tracking, purchase orders, sales, and profit reports.
          </p>
          <div className="auth-features" style={{ marginTop: '32px' }}>
            <div className="auth-feature">
              <div className="auth-feature-icon">⚡</div>
              <span>Get started in under 2 minutes</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">🔐</div>
              <span>Your data is private and secure</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">📱</div>
              <span>Works on desktop, tablet, and mobile</span>
            </div>
          </div>
        </div>

        <div className="auth-form-panel" style={{ overflowY: 'auto' }}>
          <div className="auth-form-header">
            <h2>Create Account</h2>
            <p>Fill in your shop details to get started</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Your Name <span className="required">*</span></label>
                <input
                  {...register('shop_owner_name')}
                  className={`form-control ${errors.shop_owner_name ? 'error' : ''}`}
                  placeholder="Ramesh Kumar"
                  autoFocus
                />
                {errors.shop_owner_name && <p className="form-error">{errors.shop_owner_name.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Shop Name</label>
                <input
                  {...register('shop_name')}
                  className="form-control"
                  placeholder="Kumar Hardware Store"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address <span className="required">*</span></label>
              <input
                {...register('email')}
                type="email"
                className={`form-control ${errors.email ? 'error' : ''}`}
                placeholder="owner@hardwareshop.com"
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password <span className="required">*</span></label>
                <input
                  {...register('password')}
                  type="password"
                  className={`form-control ${errors.password ? 'error' : ''}`}
                  placeholder="Min 8 characters"
                />
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password <span className="required">*</span></label>
                <input
                  {...register('confirm_password')}
                  type="password"
                  className={`form-control ${errors.confirm_password ? 'error' : ''}`}
                  placeholder="Re-enter password"
                />
                {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  {...register('phone_number')}
                  className={`form-control ${errors.phone_number ? 'error' : ''}`}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {errors.phone_number && <p className="form-error">{errors.phone_number.message}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  {...register('city')}
                  className="form-control"
                  placeholder="Mumbai"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input
                {...register('gst_number')}
                className={`form-control ${errors.gst_number ? 'error' : ''}`}
                placeholder="22AAAAA0000A1Z5 (optional)"
                style={{ textTransform: 'uppercase' }}
              />
              <p className="form-hint">15-digit GST identification number</p>
              {errors.gst_number && <p className="form-error">{errors.gst_number.message}</p>}
            </div>

            <button
              type="submit"
              className={`btn btn-primary w-full btn-lg ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading}
              style={{ marginTop: '8px' }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>

          <p className="auth-link">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
