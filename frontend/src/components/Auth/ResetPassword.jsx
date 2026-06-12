import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

const resetSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string()
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing reset token');
      navigate('/login');
    }
  }, [token, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: data.new_password
      });
      toast.success('Password reset successfully. You can now log in.');
      navigate('/login');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to reset password. The token may be expired.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

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
        </div>

        {/* Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2>Reset Password</h2>
            <p>Please enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label">
                New Password <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdLock
                  style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                />
                <input
                  {...register('new_password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${errors.new_password ? 'error' : ''}`}
                  placeholder="Enter new password"
                  style={{ paddingLeft: '38px', paddingRight: '42px' }}
                  autoFocus
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
              {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Confirm Password <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MdLock
                  style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                />
                <input
                  {...register('confirm_password')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-control ${errors.confirm_password ? 'error' : ''}`}
                  placeholder="Confirm new password"
                  style={{ paddingLeft: '38px', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem'
                  }}
                >
                  {showConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
            </div>

            <button
              type="submit"
              className={`btn btn-primary w-full btn-lg ${isLoading ? 'btn-loading' : ''}`}
              disabled={isLoading}
              style={{ marginTop: '1rem' }}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}>
                Return to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
