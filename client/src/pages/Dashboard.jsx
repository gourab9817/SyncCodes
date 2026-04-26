import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listRooms, createRoom, getStats } from '../services/roomService';
import Nav from '../components/layout/Nav';

const StatCard = ({ label, value, icon, color }) => (
  <div className="sc-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{
      width: 44, height: 44, borderRadius: 11,
      background: `${color}20`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{label}</div>
    </div>
  </div>
);

const RoomCard = ({ room, onJoin }) => (
  <div className="sc-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow .15s' }}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = ''}
  >
    <div style={{
      width: 44, height: 44, borderRadius: 10,
      background: 'var(--coral)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Poppins', fontWeight: 700, fontSize: 16, flexShrink: 0,
    }}>
      {room.name?.[0]?.toUpperCase() || '#'}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
        {room.name || 'Unnamed session'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12 }}>
        <span>Code: <strong style={{ color: 'var(--coral)', letterSpacing: 1 }}>{room.joinCode}</strong></span>
        <span>{room.language}</span>
        <span>{room._count?.memberships || 0} sessions</span>
      </div>
    </div>
    <button
      className="sc-btn sc-btn-primary"
      onClick={() => onJoin(room)}
      style={{ padding: '7px 16px', fontSize: 13, flexShrink: 0 }}
    >
      Join
    </button>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRooms(), getStats()])
      .then(([r, s]) => { setRooms(r); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const room = await createRoom({ name: `Session ${new Date().toLocaleDateString()}` });
      setRooms((prev) => [room, ...prev]);
      navigate(`/room/${room.joinCode}`);
    } catch (err) {
      alert('Failed to create session. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (room) => navigate(`/room/${room.joinCode}`);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Nav />
      <div className="page-content animate-fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', marginBottom: 4 }}>
              {greeting}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p style={{ color: 'var(--text3)', fontSize: 14 }}>
              Ready to code together?
            </p>
          </div>
          <button
            className="sc-btn sc-btn-primary"
            onClick={handleCreate}
            disabled={creating}
            style={{ padding: '10px 22px', flexShrink: 0 }}
          >
            {creating ? 'Creating…' : '+ New Session'}
          </button>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <StatCard label="Total Sessions" value={stats?.totalSessions} icon="🖥️" color="#FF6B5B" />
          <StatCard label="Minutes Coded" value={stats?.totalMinutes} icon="⏱️" color="#1DB8A3" />
          <StatCard label="Rooms Owned" value={stats?.ownedRooms} icon="🗂️" color="#A78BFA" />
          <StatCard label="Messages Sent" value={stats?.totalMessages} icon="💬" color="#FFD66B" />
        </div>

        {/* Quick actions */}
        <div className="quick-actions-grid" style={{ marginBottom: 32 }}>
          {[
            { icon: '➕', label: 'New Session', action: handleCreate, color: 'var(--coral)' },
            { icon: '🔗', label: 'Join by Code', action: () => navigate('/join'), color: 'var(--teal)' },
            { icon: '📊', label: 'View Metrics', action: () => navigate('/metrics'), color: 'var(--purple)' },
            { icon: '📋', label: 'All Sessions', action: () => navigate('/sessions'), color: '#FFD66B' },
          ].map(({ icon, label, action, color }) => (
            <button
              key={label}
              onClick={action}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                textAlign: 'left',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Recent sessions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 17 }}>Your Sessions</h2>
            <button
              onClick={() => navigate('/sessions')}
              style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map((i) => (
                <div key={i} className="sc-card" style={{ padding: 20, height: 76, animation: 'pulse 1.5s ease infinite' }} />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="sc-card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
              <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 16 }}>No sessions yet — create one to get started!</p>
              <button className="sc-btn sc-btn-primary" onClick={handleCreate}>Create first session</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rooms.slice(0, 6).map((room) => (
                <RoomCard key={room.id} room={room} onJoin={handleJoin} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
