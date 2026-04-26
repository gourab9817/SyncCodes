import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Menu, X } from 'lucide-react';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navTo = (path) => {
    navigate(path);
    setMobileOpen(false);
    setMenuOpen(false);
  };

  return (
    <nav style={{
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      paddingLeft: 'max(20px, env(safe-area-inset-left))',
      paddingRight: 'max(20px, env(safe-area-inset-right))',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>
        {/* Logo */}
        <button
          onClick={() => navTo('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <div style={{
            width: 32, height: 32, background: 'var(--coral)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontFamily: 'Poppins', fontWeight: 800, fontSize: 14 }}>S</span>
          </div>
          <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>SyncCodes</span>
        </button>

        {/* Desktop links */}
        <div className="nav-desktop-links" style={{ gap: 4, flex: 1 }}>
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navTo(link.path)}
              style={{
                background: location.pathname === link.path ? 'var(--input-bg)' : 'none',
                border: 'none', padding: '6px 14px', borderRadius: 8,
                cursor: 'pointer',
                color: location.pathname === link.path ? 'var(--coral)' : 'var(--text2)',
                fontWeight: location.pathname === link.path ? 600 : 500,
                fontSize: 14, transition: 'all .15s',
              }}
              onMouseEnter={(e) => { if (location.pathname !== link.path) e.currentTarget.style.background = 'var(--input-bg)'; }}
              onMouseLeave={(e) => { if (location.pathname !== link.path) e.currentTarget.style.background = 'none'; }}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {/* New session button — desktop */}
          <button
            className="sc-btn sc-btn-primary nav-new-session"
            onClick={() => navigate('/join')}
            style={{ padding: '6px 16px', fontSize: 13 }}
          >
            <span className="nav-new-session-label">+ New Session</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: 'var(--text2)', fontSize: 16, lineHeight: 1,
            }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Avatar dropdown */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open user menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              style={{
                background: 'var(--coral)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: 'pointer', color: '#fff',
                fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {user?.avatar
                ? <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                : user?.name?.[0]?.toUpperCase() || 'U'}
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 44,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 8, minWidth: 180,
                boxShadow: 'var(--shadow-lg)', animation: 'fadeIn .15s ease', zIndex: 200,
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text2)', fontWeight: 500, fontSize: 13, borderRadius: 8 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--input-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  ⚙️ Profile & Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--coral)', fontWeight: 600, fontSize: 13, borderRadius: 8 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--input-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="nav-hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text)', borderRadius: 6 }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="nav-mobile-drawer">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navTo(link.path)}
              style={{
                background: location.pathname === link.path ? 'var(--input-bg)' : 'none',
                border: 'none', borderRadius: 8, padding: '11px 14px', cursor: 'pointer',
                textAlign: 'left',
                color: location.pathname === link.path ? 'var(--coral)' : 'var(--text)',
                fontWeight: location.pathname === link.path ? 600 : 500,
                fontSize: 15,
              }}
            >
              {link.label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <button
            onClick={() => { navigate('/join'); setMobileOpen(false); }}
            className="sc-btn sc-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            + New Session
          </button>
        </div>
      )}
    </nav>
  );
};

export default Nav;
