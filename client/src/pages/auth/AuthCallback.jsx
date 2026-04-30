import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const navigatedRef = useRef(false);
  const timedOutRef = useRef(false);

  // Check for OAuth error params on mount
  useEffect(() => {
    if (!supabase) {
      navigate('/login?error=supabase_not_configured', { replace: true });
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    if (oauthError) {
      navigate(`/login?error=${encodeURIComponent(oauthError)}`, { replace: true });
    }
  }, [navigate]);

  // Navigate when AuthContext has finished setting the user
  useEffect(() => {
    if (navigatedRef.current || timedOutRef.current) return;
    if (!loading && user) {
      navigatedRef.current = true;
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // 15s safety timeout — if AuthContext never resolves, kick back to login
  useEffect(() => {
    const t = setTimeout(() => {
      if (!navigatedRef.current) {
        timedOutRef.current = true;
        navigate('/login?error=auth_timeout', { replace: true });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, border: '3px solid var(--coral)',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 1s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Completing sign in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
