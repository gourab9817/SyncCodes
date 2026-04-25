import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { getBackendBaseUrl } from "../config/backendUrl";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

/**
 * Must render inside AuthProvider so the socket reconnects when login state changes.
 */
export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("neon_access_token");
    const endpoint = getBackendBaseUrl();

    const newSocket = io(endpoint, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: token || null },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect_error", (err) => {
      if (err?.message === "auth_required" || err?.message === "auth_invalid") {
        console.warn("Socket auth failed:", err.message);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.close();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
