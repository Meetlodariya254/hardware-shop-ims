import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)',
      padding: 24
    }}>
      <div style={{ fontSize: '6rem', marginBottom: 16 }}>🔧</div>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 360, textAlign: 'center', marginBottom: 24 }}>
        The page you're looking for doesn't exist. It might have been moved or the URL is incorrect.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-outline" onClick={() => window.history.back()}>← Go Back</button>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
      </div>
    </div>
  );
}
