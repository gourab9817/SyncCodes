import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Neon auth reset flow can be wired here when endpoint/SDK is added.
    setSent(true);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--coral)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <span style={{ color: '#fff', fontSize: 24 }}>🔑</span>
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reset your password</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>We'll send a reset link to your email</p>
        </div>

        <div className="sc-card" style={{ padding: 28 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>If that email exists, a reset link has been sent.</p>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Check your inbox (and spam folder).</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Email address</label>
                <input
                  className="sc-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button type="submit" className="sc-btn sc-btn-primary" style={{ width: '100%' }} disabled={loading || !email}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text3)' }}>
          <Link to="/login" style={{ color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
