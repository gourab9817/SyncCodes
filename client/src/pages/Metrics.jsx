import React, { useEffect, useState } from 'react';
import { getStats } from '../services/roomService';
import Nav from '../components/layout/Nav';
import { useAuth } from '../context/AuthContext';

const MetricBar = ({ label, value, max, color }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
    </div>
    <div style={{ height: 8, background: 'var(--input-bg)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, max ? (value / max) * 100 : 0)}%`,
        background: color,
        borderRadius: 4,
        transition: 'width .6s ease',
      }} />
    </div>
  </div>
);

const Metrics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  const hours = stats ? Math.floor(stats.totalMinutes / 60) : 0;
  const mins = stats ? stats.totalMinutes % 60 : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }} className="animate-fade-in">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Your Metrics</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Track your collaboration activity</p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[1,2,3,4].map((i) => <div key={i} className="sc-card" style={{ height: 100, animation: 'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : (
          <>
            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total Sessions', value: stats?.totalSessions || 0, icon: '🖥️', bg: '#FF6B5B' },
                { label: 'Time Coded', value: `${hours}h ${mins}m`, icon: '⏱️', bg: '#1DB8A3' },
                { label: 'Rooms Created', value: stats?.ownedRooms || 0, icon: '🗂️', bg: '#A78BFA' },
                { label: 'Messages Sent', value: stats?.totalMessages || 0, icon: '💬', bg: '#FFD66B' },
              ].map(({ label, value, icon, bg }) => (
                <div key={label} className="sc-card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: bg }}>{value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Activity breakdown */}
            <div className="sc-card" style={{ padding: 28, marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, marginBottom: 24 }}>Activity Breakdown</h2>
              <MetricBar label="Sessions" value={stats?.totalSessions || 0} max={50} color="var(--coral)" />
              <MetricBar label="Messages" value={stats?.totalMessages || 0} max={500} color="var(--teal)" />
              <MetricBar label="Rooms" value={stats?.ownedRooms || 0} max={20} color="var(--purple)" />
            </div>

            {/* Profile summary */}
            <div className="sc-card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 16, marginBottom: 20 }}>Profile</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--coral)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Poppins', fontWeight: 700, fontSize: 22, flexShrink: 0,
                }}>
                  {user?.avatar
                    ? <img src={user.avatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                    : user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>{user?.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Member since {new Date(user?.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Metrics;
