import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (supabase) {
        const { error: supaErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (supaErr) throw new Error(supaErr.message);
      }
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--coral)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 24 }}>S</span>
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reset your password</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>We'll send a reset link to your email</p>
        </div>

        <div className="sc-card" style={{ padding: 28 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>Reset link sent!</p>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Check your inbox (and spam folder) for a link to set a new password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  className="sc-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button
                type="submit"
                className="sc-btn sc-btn-primary"
                style={{ width: '100%' }}
                disabled={loading || !email}
              >
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
