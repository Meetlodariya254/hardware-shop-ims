import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back! 👋');
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Brand Panel */}
        <div className="auth-brand">
          <div className="auth-brand-logo">🔧</div>
          <h1>Hardware Shop<br />Inventory System</h1>
          <p>
            Complete inventory management for your hardware shop.
            Track products, purchases, sales, and generate profit reports.
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">📦</div>
              <span>Real-time inventory tracking with low-stock alerts</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">💰</div>
              <span>Detailed profit analysis with ₹ INR reporting</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">📊</div>
              <span>5 comprehensive reports with PDF & Excel export</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">🔒</div>
              <span>Secure JWT authentication with 30-min session timeout</span>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your inventory dashboard</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdEmail
                  style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                />
                <input
                  {...register('email')}
                  type="email"
                  className={`form-control ${errors.email ? 'error' : ''}`}
                  placeholder="owner@hardwareshop.com"
                  style={{ paddingLeft: '38px' }}
                  autoFocus
                />
              </div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Password <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdLock
                  style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  style={{ paddingLeft: '38px', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className={`btn btn-primary w-full btn-lg ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="auth-link">
            Don't have an account? <Link to="/register">Create one here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
