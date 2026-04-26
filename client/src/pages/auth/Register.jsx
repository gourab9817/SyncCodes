import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const LOGO = (
  <div style={{
    width: 56, height: 56, background: 'var(--coral)',
    borderRadius: 16, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 16px',
  }}>
    <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 24 }}>S</span>
  </div>
);

// ── OTP input: 6 boxes ───────────────────────────────────────────────────────
const OtpInput = ({ value, onChange }) => {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.map((d, idx) => (idx === i ? '' : d)).join('');
        onChange(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => (idx === i ? char : d)).join('');
    onChange(next);
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, '').slice(0, 6));
      refs.current[Math.min(pasted.length, 5)]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
            border: '1.5px solid var(--border)', borderRadius: 10,
            background: 'var(--bg2)', color: 'var(--text)',
            outline: 'none', caretColor: 'var(--coral)',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--coral)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
        />
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const Register = () => {
  const { register: registerUser, loginWithGoogle, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const result = await registerUser({ name: data.name, email: data.email, password: data.password });
      if (result?.needsEmailVerification) {
        setPendingEmail(data.email);
        setStep('verify');
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setServerError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code from your email.');
      return;
    }
    setOtpError('');
    setOtpLoading(true);
    try {
      await verifyOtp({ email: pendingEmail, token: otp });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const onResend = async () => {
    if (!supabase || resendCooldown > 0) return;
    try {
      await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setOtpError(err.message || 'Failed to resend. Try again shortly.');
    }
  };

  // ── OTP step ────────────────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {LOGO}
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>Check your email</h1>
            <p style={{ color: 'var(--text3)', fontSize: 14 }}>
              We sent a 6-digit code to <strong style={{ color: 'var(--text2)' }}>{pendingEmail}</strong>
            </p>
          </div>

          <div className="sc-card" style={{ padding: 32 }}>
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {otpError && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                  {otpError}
                </div>
              )}

              <div>
                <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: 16 }}>
                  Enter the code below to verify your email
                </p>
                <OtpInput value={otp} onChange={setOtp} />
              </div>

              <button
                type="submit"
                className="sc-btn sc-btn-primary"
                style={{ width: '100%' }}
                disabled={otpLoading || otp.length !== 6}
              >
                {otpLoading ? 'Verifying…' : 'Verify email'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>Didn't receive it?{' '}</span>
              <button
                type="button"
                onClick={onResend}
                disabled={resendCooldown > 0}
                style={{ background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer', color: resendCooldown > 0 ? 'var(--text3)' : 'var(--coral)', fontWeight: 600, fontSize: 13, padding: 0 }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            <button
              type="button"
              onClick={() => setStep('form')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', fontWeight: 600, fontSize: 13 }}
            >
              ← Back to registration
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {LOGO}
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Create your account</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Start collaborating in minutes</p>
        </div>

        <div className="sc-card" style={{ padding: 32 }}>
          {supabase && (
            <>
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="sc-btn sc-btn-secondary"
                style={{ width: '100%', marginBottom: 20 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {' '}Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {serverError && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                {serverError}
              </div>
            )}

            <div>
              <label htmlFor="reg-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Full name</label>
              <input
                id="reg-name"
                className="sc-input"
                type="text"
                placeholder="Alex Kim"
                autoComplete="name"
                {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
              />
              {errors.name && <p role="alert" style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
              <input
                id="reg-email"
                className="sc-input"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p role="alert" style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
              <input
                id="reg-password"
                className="sc-input"
                type="password"
                placeholder="Min 8 characters"
                autoComplete="new-password"
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })}
              />
              {errors.password && <p role="alert" style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-confirm" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Confirm password</label>
              <input
                id="reg-confirm"
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
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text3)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
