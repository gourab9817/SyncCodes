import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getBackendBaseUrl } from '../config/backendUrl';
import { supabase } from './supabaseClient';
import { getStoredAccessToken } from './authToken';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

/**
 * Must render inside AuthProvider so the socket reconnects when login state changes.
 */
export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const endpoint = getBackendBaseUrl();

    (async () => {
      let token = null;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || null;
      }
      token = token || getStoredAccessToken();

      if (cancelled) return;

      const sock = io(endpoint, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token: token || null },
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
      });

      sock.on('connect_error', (err) => {
        if (err?.message === 'auth_required' || err?.message === 'auth_invalid') {
          console.warn('Socket auth failed:', err.message);
        }
      });

      if (cancelled) {
        sock.removeAllListeners();
        sock.close();
        return;
      }

      socketRef.current = sock;
      setSocket(sock);
    })();

    return () => {
      cancelled = true;
      const s = socketRef.current;
      socketRef.current = null;
      setSocket(null);
      if (s) {
        s.removeAllListeners();
        s.close();
      }
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
