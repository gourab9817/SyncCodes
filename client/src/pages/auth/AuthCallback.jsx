import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getBackendBaseUrl } from '../../config/backendUrl';

const API_URL = getBackendBaseUrl();

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        navigate('/login?error=' + error);
        return;
      }

      if (!token) {
        navigate('/login?error=no_token');
        return;
      }

      try {
        // Store token
        localStorage.setItem('neon_access_token', token);

        // Fetch user profile
        const res = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        localStorage.setItem('sc_user', JSON.stringify(res.data));
        navigate('/dashboard');
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login?error=fetch_failed');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

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
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
