// src/context/SocketProvider.js
import React, { createContext, useContext, useMemo } from "react";
import { io } from "socket.io-client";

/*-------------------------------------------------------------------*/
/* 1️⃣  Decide which API endpoint to hit                              */
/*-------------------------------------------------------------------*/
/*
   Priority order
   ────────────────────────────────────────────────────────────────
   1.  Vite build       → import.meta.env.VITE_API_URL
   2.  CRA / Webpack    → process.env.REACT_APP_API_URL
   3.  Fallback local   → http://localhost:8000
*/
const ENDPOINT =
  // Vite ‑ guard against CRA where import.meta is undefined
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  // CRA / Webpack
  process.env.REACT_APP_API_URL ||
  // Default for local dev
  "http://localhost:8000";

/*-------------------------------------------------------------------*/
/* 2️⃣  Context boiler‑plate                                         */
/*-------------------------------------------------------------------*/
const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  // useMemo ensures the client is created only once
  const socket = useMemo(
    () =>
      io(ENDPOINT, {
        transports: ["websocket"], // keeps things lean
        withCredentials: true,     // CORS‑friendly if cookies ever matter
      }),
    [] // ←  no deps ⇒ runs exactly once
  );

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
