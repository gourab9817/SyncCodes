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
  const [deleteTarget, setDeleteTarget] = useState(null); // AlertDialog state
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    listRooms().then(setRooms).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const room = await createRoom(form);
      setRooms((prev) => [room, ...prev]);
      setShowCreate(false);
      setForm({ name: '', language: 'javascript' });
      navigate(`/room/${room.joinCode}`);
    } catch {
      setCreateError('Failed to create session. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (room) => setDeleteTarget(room);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteRoom(deleteTarget.id);
    setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filtered = rooms.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.joinCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Nav />
      <div className="page-content animate-fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)' }}>Sessions</h1>
          <button className="sc-btn sc-btn-primary" onClick={() => setShowCreate(true)}>+ Create</button>
        </div>

        {/* Search */}
        <input
          className="sc-input"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 20, maxWidth: 400 }}
        />

        {/* Create modal */}
        {showCreate && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 500, padding: 16,
            }}
          >
            <div className="sc-card animate-fade-in" style={{ padding: 28, width: '100%', maxWidth: 400 }}>
              <h2 id="create-modal-title" style={{ fontSize: 18, marginBottom: 20 }}>New Session</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {createError && (
                  <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
                    {createError}
                  </div>
                )}
                <div>
                  <label htmlFor="session-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Session name</label>
                  <input
                    id="session-name"
                    className="sc-input"
                    placeholder="e.g. Backend Review"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="session-lang" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Language</label>
                  <select
                    id="session-lang"
                    className="sc-input"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                  >
                    {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button type="button" className="sc-btn sc-btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</button>
                  <button type="submit" className="sc-btn sc-btn-primary" style={{ flex: 1 }} disabled={creating}>
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete AlertDialog */}
        {deleteTarget && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 500, padding: 16,
            }}
          >
            <div className="sc-card animate-fade-in" style={{ padding: 28, width: '100%', maxWidth: 360 }}>
              <h2 id="delete-dialog-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete session?</h2>
              <p id="delete-dialog-desc" style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.5 }}>
                <strong>"{deleteTarget.name || 'Unnamed'}"</strong> will be permanently deleted. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="sc-btn sc-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDeleteTarget(null)}
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  className="sc-btn"
                  style={{ flex: 1, background: '#ef4444', color: '#fff' }}
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
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
              <div key={room.id} className="sc-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'var(--coral)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {room.name?.[0]?.toUpperCase() || '#'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.name || 'Unnamed'}
                  </div>
                  <div className="session-card-meta" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    <span>Code: <strong style={{ color: 'var(--coral)', letterSpacing: 0.5 }}>{room.joinCode}</strong></span>
                    <span>{room.language}</span>
                    <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="sc-btn sc-btn-primary"
                    onClick={() => navigate(`/room/${room.joinCode}`)}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    Join
                  </button>
                  <button
                    className="sc-btn sc-btn-ghost"
                    onClick={() => confirmDelete(room)}
                    style={{ padding: '6px 8px', fontSize: 13, color: 'var(--coral)' }}
                    aria-label={`Delete session "${room.name || 'Unnamed'}"`}
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
