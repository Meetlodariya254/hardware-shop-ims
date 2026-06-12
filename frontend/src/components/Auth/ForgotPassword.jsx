import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { MdEmail, MdArrowBack } from 'react-icons/md';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: data.email });
      const responseData = response.data?.data;

      // Local/offline mode: backend returned a token directly → navigate straight to reset page
      if (responseData?.localMode && responseData?.resetToken) {
        toast.success('Redirecting to password reset page...');
        navigate(`/reset-password?token=${responseData.resetToken}`);
        return;
      }

      // SMTP configured: show "check your email" message
      setIsSuccess(true);
      toast.success('Password reset link sent to your email.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to process request. Please try again.';
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
        </div>

        {/* Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2>Forgot Password</h2>
            <p>Enter your email address and we'll send you a link to reset your password.</p>
          </div>

          {isSuccess ? (
            <div className="success-message" style={{ textAlign: 'center', margin: '2rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
              <h3>Check your email</h3>
              <p>We've sent a password reset link to your email address.</p>
              <Link to="/login" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' }}>
                Return to Login
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                className={`btn btn-primary w-full btn-lg ${isLoading ? 'btn-loading' : ''}`}
                disabled={isLoading}
                style={{ marginTop: '1rem' }}
              >
                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
              </button>

              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                  <MdArrowBack /> Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
