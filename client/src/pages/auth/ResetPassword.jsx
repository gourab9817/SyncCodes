import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../utils/supabaseClient';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (!supabase) {
      navigate('/login?error=Supabase+not+configured', { replace: true });
      return;
    }

    // Supabase fires PASSWORD_RECOVERY after parsing the token from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
      }
    });

    // In case the event already fired before this component mounted
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async ({ password }) => {
    setServerError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    } catch (err) {
      setServerError(err.message || 'Failed to update password. Try requesting a new reset link.');
    }
  };

  const wrapperStyle = {
    minHeight: '100dvh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  };

  const logo = (
    <div style={{
      width: 56, height: 56, background: 'var(--coral)', borderRadius: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
    }}>
      <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 24 }}>S</span>
    </div>
  );

  if (!ready) {
    return (
      <div style={wrapperStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid var(--border)',
            borderTopColor: 'var(--coral)', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logo}
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Set new password</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Choose a strong password for your account</p>
        </div>

        <div className="sc-card" style={{ padding: 32 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>Password updated successfully!</p>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Redirecting to dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {serverError && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                  {serverError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  New password
                </label>
                <input
                  className="sc-input"
                  type="password"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'At least 8 characters' },
                  })}
                />
                {errors.password && <p role="alert" style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  Confirm password
                </label>
                <input
                  className="sc-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('confirm', {
                    required: 'Please confirm your password',
                    validate: (v) => v === watch('password') || 'Passwords do not match',
                  })}
                />
                {errors.confirm && <p role="alert" style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.confirm.message}</p>}
              </div>

              <button
                type="submit"
                className="sc-btn sc-btn-primary"
                style={{ width: '100%', marginTop: 4 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
