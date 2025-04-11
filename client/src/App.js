// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home'; // Import the new landing page component
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />           {/* Landing page */}
        <Route path="/lobby" element={<Lobby />} />       {/* Lobby page, navigated from landing page */}
        <Route path="/room/:roomId/:email" element={<Room />} />
      </Routes>
    </div>
  );
}

export default App;
