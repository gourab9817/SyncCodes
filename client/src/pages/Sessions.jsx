import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRooms, createRoom, deleteRoom } from '../services/roomService';
import Nav from '../components/layout/Nav';

const LANGS = ['javascript', 'python', 'java', 'c', 'cpp', 'go', 'rust'];

const Sessions = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', language: 'javascript' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listRooms().then(setRooms).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const room = await createRoom(form);
      setRooms((prev) => [room, ...prev]);
      setShowCreate(false);
      setForm({ name: '', language: 'javascript' });
      navigate(`/room/${room.joinCode}`);
    } catch {
      alert('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    await deleteRoom(id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = rooms.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.joinCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }} className="animate-fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{ fontSize: 26 }}>Sessions</h1>
          <button className="sc-btn sc-btn-primary" onClick={() => setShowCreate(true)}>+ Create Session</button>
        </div>

        {/* Search */}
        <input
          className="sc-input"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 24, maxWidth: 360 }}
        />

        {/* Create modal */}
        {showCreate && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
          }}>
            <div className="sc-card animate-fade-in" style={{ padding: 32, width: '100%', maxWidth: 400 }}>
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>New Session</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Session name</label>
                  <input
                    className="sc-input"
                    placeholder="e.g. Backend Review"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Language</label>
                  <select
                    className="sc-input"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                  >
                    {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button type="button" className="sc-btn sc-btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="sc-btn sc-btn-primary" style={{ flex: 1 }} disabled={creating}>
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map((i) => <div key={i} className="sc-card" style={{ height: 80, animation: 'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="sc-card" style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: 'var(--text3)' }}>{search ? 'No sessions match your search.' : 'No sessions yet.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((room) => (
              <div key={room.id} className="sc-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'var(--coral)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {room.name?.[0]?.toUpperCase() || '#'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{room.name || 'Unnamed'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>Code: <strong style={{ color: 'var(--coral)', letterSpacing: 1 }}>{room.joinCode}</strong></span>
                    <span>{room.language}</span>
                    <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    className="sc-btn sc-btn-primary"
                    onClick={() => navigate(`/room/${room.joinCode}`)}
                    style={{ padding: '6px 14px', fontSize: 13 }}
                  >
                    Join
                  </button>
                  <button
                    className="sc-btn sc-btn-ghost"
                    onClick={() => handleDelete(room.id)}
                    style={{ padding: '6px 10px', fontSize: 13, color: 'var(--coral)' }}
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
