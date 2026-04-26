import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendBaseUrl } from '../../config/backendUrl';
import { supabase } from '../../utils/supabaseClient';

const API_URL = getBackendBaseUrl();

const AuthCallback = () => {
  const navigate = useNavigate();
  const doneRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      console.error('[AuthCallback] Supabase client not initialised — check REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY');
      navigate('/login?error=supabase_not_configured', { replace: true });
      return;
    }

    // Check for error params forwarded by Supabase or Google
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error') || params.get('error_description');
    if (oauthError) {
      console.error('[AuthCallback] OAuth error param:', oauthError);
      navigate(`/login?error=${encodeURIComponent(oauthError)}`, { replace: true });
      return;
    }

    const finish = async (session) => {
      if (doneRef.current) return;
      doneRef.current = true;

      console.log('[AuthCallback] session received, fetching profile…');
      try {
        const res = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        localStorage.setItem('sc_user', JSON.stringify(res.data));
        console.log('[AuthCallback] profile OK, navigating to dashboard');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.message;
        console.error(`[AuthCallback] /api/users/me failed (${status}):`, msg);
        navigate(`/login?error=${encodeURIComponent(msg || 'profile_fetch_failed')}`, { replace: true });
      }
    };

    // 1) Listen for SIGNED_IN — fires once the PKCE code exchange completes.
    //    With flowType:'pkce' + detectSessionInUrl:true the Supabase client picks
    //    up ?code= from the URL and exchanges it async; this event fires when done.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] onAuthStateChange event:', event, '| has session:', !!session);
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        finish(session);
      }
    });

    // 2) Fallback: exchange might have already completed before this component
    //    mounted (e.g. React StrictMode double-invocation or fast machines).
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('[AuthCallback] getSession result — session:', !!data?.session, '| error:', error?.message ?? 'none');
      if (data?.session) {
        finish(data.session);
      }
    });

    // 3) Hard timeout — if neither path resolves in 12 s something is broken.
    const timer = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        console.error('[AuthCallback] timed out waiting for Supabase session');
        navigate('/login?error=auth_timeout', { replace: true });
      }
    }, 12000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
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
