import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/axiosConfig';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { MdSave, MdLock, MdStore, MdEmail, MdSend, MdCheckCircle, MdInfo } from 'react-icons/md';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);

  // Profile form
  const { register: regProfile, handleSubmit: hsProfile } = useForm({
    defaultValues: {
      shop_owner_name: user?.shop_owner_name || '',
      shop_name: user?.shop_name || '',
      phone_number: user?.phone_number || '',
      address: user?.address || '',
      city: user?.city || '',
      gst_number: user?.gst_number || '',
    }
  });

  // Password form
  const { register: regPwd, handleSubmit: hsPwd, reset: resetPwd, formState: { errors: errPwd } } = useForm();

  // Email/SMTP form
  const { register: regEmail, handleSubmit: hsEmail, getValues, setValue } = useForm({
    defaultValues: {
      smtp_host: 'smtp.gmail.com',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      smtp_from_name: 'Hardware Shop IMS',
    }
  });

  // Load current email settings on mount
  useEffect(() => {
    if (activeTab === 'email') {
      api.get('/settings').then(res => {
        const s = res.data?.data || {};
        if (s.smtp_host?.value) setValue('smtp_host', s.smtp_host.value);
        if (s.smtp_port?.value) setValue('smtp_port', s.smtp_port.value);
        if (s.smtp_user?.value) setValue('smtp_user', s.smtp_user.value);
        if (s.smtp_pass?.value) setValue('smtp_pass', s.smtp_pass.value);
        if (s.smtp_from_name?.value) setValue('smtp_from_name', s.smtp_from_name.value);
        setEmailEnabled(s.smtp_enabled?.value === '1');
      }).catch(() => {});
    }
  }, [activeTab, setValue]);

  const saveProfile = async (data) => {
    setSaving(true);
    try {
      const res = await api.put('/auth/update-profile', data);
      updateUser(res.data.data);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const changePassword = async (data) => {
    if (data.new_password !== data.confirm_password) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: data.current_password, new_password: data.new_password });
      toast.success('Password changed successfully');
      resetPwd();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  const saveEmailSettings = async (data) => {
    setSaving(true);
    try {
      await api.put('/settings', data);
      toast.success('Email settings saved!');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const sendTestEmail = async () => {
    // Save current form values first
    const values = getValues();
    setTestingEmail(true);
    try {
      await api.put('/settings', values);
      const res = await api.post('/settings/test-email');
      toast.success(res.data.message || 'Test email sent! Check your inbox.');
      setEmailEnabled(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Test failed. Check your credentials.');
    } finally {
      setTestingEmail(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Shop Profile', icon: MdStore },
    { id: 'email',   label: 'Email Settings', icon: MdEmail },
    { id: 'security', label: 'Security', icon: MdLock },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Settings</h2>
          <p>Manage your shop profile, email notifications, and security</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar tabs */}
        <div className="card" style={{ padding: '12px' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="btn"
              style={{
                width: '100%', justifyContent: 'flex-start', gap: 10,
                background: activeTab === id ? 'var(--primary-50)' : 'transparent',
                color: activeTab === id ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none', marginBottom: 4, fontWeight: activeTab === id ? 700 : 500,
                padding: '10px 14px', position: 'relative',
              }}
            >
              <Icon /> {label}
              {id === 'email' && (
                <span style={{
                  marginLeft: 'auto',
                  width: 8, height: 8, borderRadius: '50%',
                  background: emailEnabled ? '#10b981' : '#f59e0b',
                  display: 'inline-block',
                }} title={emailEnabled ? 'Email configured' : 'Email not configured'} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">

          {/* ── Shop Profile ── */}
          {activeTab === 'profile' && (
            <>
              <div className="card-header"><div className="card-title">Shop Profile</div></div>
              <div className="card-body">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px',
                  background: 'linear-gradient(135deg, var(--primary-50), #eff6ff)', borderRadius: 'var(--radius-md)', marginBottom: 24
                }}>
                  <div style={{
                    width: 64, height: 64, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                    borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0
                  }}>
                    {user?.shop_owner_name?.slice(0, 2).toUpperCase() || 'SH'}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{user?.shop_owner_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
                    {user?.shop_name && <div style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600 }}>🏪 {user.shop_name}</div>}
                  </div>
                </div>

                <form onSubmit={hsProfile(saveProfile)} noValidate>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Owner Name <span className="required">*</span></label>
                      <input {...regProfile('shop_owner_name', { required: true })} className="form-control" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shop Name</label>
                      <input {...regProfile('shop_name')} className="form-control" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input {...regProfile('phone_number')} className="form-control" maxLength={10} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input {...regProfile('city')} className="form-control" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea {...regProfile('address')} className="form-control" rows={2} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input {...regProfile('gst_number')} className="form-control" placeholder="15-digit GST number" style={{ textTransform: 'uppercase' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input value={user?.email || ''} className="form-control" disabled />
                    <p className="form-hint">Email cannot be changed. Contact support if needed.</p>
                  </div>
                  <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                    <MdSave /> {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── Email Settings ── */}
          {activeTab === 'email' && (
            <>
              <div className="card-header"><div className="card-title">📧 Email / SMTP Configuration</div></div>
              <div className="card-body">

                {/* Info banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)',
                  padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 12
                }}>
                  <MdInfo style={{ color: '#1e40af', fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>Configure Gmail to send password reset emails</div>
                    <div style={{ color: '#1e40af', fontSize: '0.875rem', lineHeight: 1.5 }}>
                      <strong>Step 1:</strong> Enable 2-Step Verification on your Google Account<br />
                      <strong>Step 2:</strong> Go to <strong>myaccount.google.com/apppasswords</strong><br />
                      <strong>Step 3:</strong> Create an App Password → Select "Mail" → Copy the 16-character code<br />
                      <strong>Step 4:</strong> Paste your Gmail address and that 16-character code below
                    </div>
                  </div>
                </div>

                {emailEnabled && (
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #86efac',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: '#166534'
                  }}>
                    <MdCheckCircle style={{ fontSize: '1.3rem', color: '#22c55e' }} />
                    <span style={{ fontWeight: 600 }}>Email is configured and working! Password reset emails will be sent automatically.</span>
                  </div>
                )}

                <form onSubmit={hsEmail(saveEmailSettings)} noValidate>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gmail Address <span className="required">*</span></label>
                      <input
                        {...regEmail('smtp_user')}
                        type="email"
                        className="form-control"
                        placeholder="yourshop@gmail.com"
                      />
                      <p className="form-hint">The Gmail account that will send emails</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gmail App Password <span className="required">*</span></label>
                      <input
                        {...regEmail('smtp_pass')}
                        type="password"
                        className="form-control"
                        placeholder="xxxx xxxx xxxx xxxx"
                        autoComplete="new-password"
                      />
                      <p className="form-hint">16-character App Password from Google Account</p>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Display Name</label>
                      <input
                        {...regEmail('smtp_from_name')}
                        className="form-control"
                        placeholder="Hardware Shop IMS"
                      />
                      <p className="form-hint">Shown as sender name in emails</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">SMTP Host</label>
                      <input {...regEmail('smtp_host')} className="form-control" />
                      <p className="form-hint">Use smtp.gmail.com for Gmail</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving || testingEmail}>
                      <MdSave /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary ${testingEmail ? 'btn-loading' : ''}`}
                      onClick={sendTestEmail}
                      disabled={saving || testingEmail}
                    >
                      <MdSend /> {testingEmail ? 'Sending test...' : 'Save & Test Email'}
                    </button>
                  </div>
                  <p className="form-hint" style={{ marginTop: 12 }}>
                    "Save & Test Email" will send a test email to your Gmail address to confirm everything works.
                  </p>
                </form>
              </div>
            </>
          )}

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <>
              <div className="card-header"><div className="card-title">Change Password</div></div>
              <div className="card-body">
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                  <span className="alert-icon">🔒</span>
                  <div>Password must be at least 8 characters. Sessions expire after 30 minutes of inactivity.</div>
                </div>
                <form onSubmit={hsPwd(changePassword)} noValidate>
                  <div className="form-group">
                    <label className="form-label">Current Password <span className="required">*</span></label>
                    <input {...regPwd('current_password', { required: true })} type="password" className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password <span className="required">*</span></label>
                    <input {...regPwd('new_password', { required: true, minLength: 8 })} type="password" className="form-control" />
                    {errPwd.new_password && <p className="form-error">Min 8 characters required</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm New Password <span className="required">*</span></label>
                    <input {...regPwd('confirm_password', { required: true })} type="password" className="form-control" />
                  </div>
                  <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
                    <MdLock /> {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
