import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV_LINKS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sessions', path: '/sessions' },
  { label: 'Metrics', path: '/metrics' },
];

const Nav = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav style={{
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 24 }}>
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div style={{ width: 32, height: 32, background: 'var(--coral)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 14 }}>S</span>
          </div>
          <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>SyncCodes</span>
        </button>

        {/* Links */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                background: location.pathname === link.path ? 'var(--input-bg)' : 'none',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                color: location.pathname === link.path ? 'var(--coral)' : 'var(--text2)',
                fontWeight: location.pathname === link.path ? 600 : 500,
                fontSize: 14,
                transition: 'all .15s',
              }}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* New session */}
          <button
            className="sc-btn sc-btn-primary"
            onClick={() => navigate('/join')}
            style={{ padding: '6px 16px', fontSize: 13 }}
          >
            + New Session
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--text2)',
              fontSize: 16,
            }}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Avatar menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'var(--coral)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                cursor: 'pointer',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user?.avatar
                ? <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                : user?.name?.[0]?.toUpperCase() || 'U'}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 44,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 8,
                  minWidth: 180,
                  boxShadow: 'var(--shadow-lg)',
                  animation: 'fadeIn .15s ease',
                  zIndex: 200,
                }}
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                    color: 'var(--text2)', fontWeight: 500, fontSize: 13, borderRadius: 8,
                  }}
                >
                  ⚙️ Profile & Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                    color: 'var(--coral)', fontWeight: 600, fontSize: 13, borderRadius: 8,
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Nav;
