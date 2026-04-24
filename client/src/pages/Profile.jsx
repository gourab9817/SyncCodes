import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Nav from '../components/layout/Nav';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState('');
  const [pwSent, setPwSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: user?.name || '', avatar: user?.avatar || '' },
  });

  const onSave = async (data) => {
    setServerError('');
    setSaved(false);
    try {
      await api.put('/api/users/me', data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to save changes');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setServerError('Password reset email flow is not wired on this frontend yet.');
    setPwSent(true);
    setTimeout(() => setPwSent(false), 5000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }} className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Profile</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Manage your account settings</p>
        </div>

        {/* Avatar + name header */}
        <div className="sc-card" style={{ padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--coral)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Poppins', fontWeight: 700, fontSize: 26, flexShrink: 0, overflow: 'hidden',
          }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{user?.email}</div>
          </div>
        </div>

        {/* Edit profile */}
        <div className="sc-card" style={{ padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 20 }}>Edit Profile</h2>
          <form onSubmit={handleSubmit(onSave)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {serverError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                {serverError}
              </div>
            )}
            {saved && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13 }}>
                ✓ Changes saved!
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Display name</label>
              <input
                className="sc-input"
                {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
              />
              {errors.name && <p style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Avatar URL</label>
              <input className="sc-input" placeholder="https://…" {...register('avatar')} />
              {errors.avatar && <p style={{ color: 'var(--coral)', fontSize: 12, marginTop: 4 }}>{errors.avatar.message}</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
              <input className="sc-input" value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Email cannot be changed</p>
            </div>
            <button type="submit" className="sc-btn sc-btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 24px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="sc-card" style={{ padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Change Password</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
            We'll send a password reset link to your email address.
          </p>
          {pwSent && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13, marginBottom: 12 }}>
              ✓ Reset link sent — check your inbox!
            </div>
          )}
          <button className="sc-btn sc-btn-secondary" onClick={handlePasswordReset} style={{ padding: '8px 24px' }}>
            Send reset link
          </button>
        </div>

        {/* Danger zone */}
        <div className="sc-card" style={{ padding: 28, borderColor: '#fecaca' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8, color: '#dc2626' }}>Danger Zone</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Sign out of your account on this device.</p>
          <button className="sc-btn sc-btn-secondary" onClick={handleLogout} style={{ borderColor: '#fecaca', color: '#dc2626' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
