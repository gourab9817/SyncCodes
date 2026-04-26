import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../utils/SocketProvider.js';
import {
  getRoom,
  getRoomByCode,
  getRoomMessages,
  getRoomParticipants,
  listRoomChatThreads,
  createChatThread,
  leaveChatThread,
  deleteChatThread,
} from '../../services/roomService';
import { isLikelyCuid } from '../../utils/roomKeys.js';

const Avatar = ({ name, avatar, size = 28 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: 'var(--coral)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700, overflow: 'hidden',
  }}>
    {avatar
      ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : name?.[0]?.toUpperCase() || '?'}
  </div>
);

const ChatPanel = ({ roomId, roomCuid, currentUser, darkMode, onUnreadChange }) => {
  const socket = useSocket();
  const [everyoneMessages, setEveryoneMessages] = useState([]);
  const [privateByThread, setPrivateByThread] = useState({});
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [draftMemberIds, setDraftMemberIds] = useState([]);
  const [input, setInput] = useState('');
  const [loadingEveryone, setLoadingEveryone] = useState(true);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState('everyone');
  const [canonicalRoomId, setCanonicalRoomId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const roomDbIdRef = useRef(null);
  const selectedThreadIdRef = useRef(null);
  const fetchedThreadsRef = useRef(new Set());

  const myId = currentUser?.id;

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    if (!roomId || !myId) return;
    let cancelled = false;
    (async () => {
      try {
        let room = null;
        if (roomCuid) {
          try { room = await getRoom(roomCuid); } catch { room = null; }
        }
        if (!room) {
          if (isLikelyCuid(String(roomId))) {
            try { room = await getRoom(roomId); } catch { room = null; }
          } else {
            try { room = await getRoomByCode(roomId); } catch { room = null; }
          }
        }
        if (cancelled) return;
        if (!room?.id) {
          setCanonicalRoomId(null);
          roomDbIdRef.current = null;
          setParticipants([]);
          return;
        }
        roomDbIdRef.current = room.id;
        setCanonicalRoomId(room.id);
        const { participants: plist } = await getRoomParticipants(room.id);
        if (!cancelled) setParticipants(Array.isArray(plist) ? plist : []);
      } catch {
        if (!cancelled) {
          setCanonicalRoomId(null);
          setParticipants([]);
        }
      }
    })();
    return () => { cancelled = true };
  }, [roomId, roomCuid, myId]);

  // Initial Everyone history fetch (once per room)
  useEffect(() => {
    if (!canonicalRoomId || !myId) return;
    let cancelled = false;
    (async () => {
      setLoadingEveryone(true);
      try {
        const history = await getRoomMessages(canonicalRoomId, { scope: 'ROOM' });
        if (!cancelled) {
          setEveryoneMessages((prev) => {
            // Merge: keep any already-arrived live messages not in history
            const byId = new Map(history.map((m) => [m.id, m]));
            for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
            return [...byId.values()].sort((a, b) =>
              new Date(a.createdAt) - new Date(b.createdAt));
          });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingEveryone(false);
      }
    })();
    return () => { cancelled = true };
  }, [canonicalRoomId, myId]);

  // Threads list fetch (whenever room or refresh)
  const refetchThreads = useCallback(async () => {
    if (!roomDbIdRef.current) return;
    try {
      setLoadingThreads(true);
      const data = await listRoomChatThreads(roomDbIdRef.current);
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch {
      /* ignore */
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    if (!canonicalRoomId || !myId) return;
    refetchThreads();
  }, [canonicalRoomId, myId, refetchThreads]);

  // Lazy fetch private history for the selected thread (only first time)
  useEffect(() => {
    if (!canonicalRoomId || !myId || !selectedThreadId) return;
    if (fetchedThreadsRef.current.has(selectedThreadId)) return;
    let cancelled = false;
    (async () => {
      setLoadingPrivate(true);
      try {
        const history = await getRoomMessages(canonicalRoomId, {
          scope: 'PRIVATE',
          threadId: selectedThreadId,
        });
        if (!cancelled) {
          fetchedThreadsRef.current.add(selectedThreadId);
          setPrivateByThread((prev) => {
            const live = prev[selectedThreadId] || [];
            const byId = new Map(history.map((m) => [m.id, m]));
            for (const m of live) if (!byId.has(m.id)) byId.set(m.id, m);
            return {
              ...prev,
              [selectedThreadId]: [...byId.values()].sort((a, b) =>
                new Date(a.createdAt) - new Date(b.createdAt)),
            };
          });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingPrivate(false);
      }
    })();
    return () => { cancelled = true };
  }, [canonicalRoomId, myId, selectedThreadId]);

  // Refresh participants on join
  useEffect(() => {
    if (!socket) return;
    const refetchParticipants = async () => {
      try {
        const rid = roomDbIdRef.current;
        if (!rid) return;
        const { participants: plist } = await getRoomParticipants(rid);
        setParticipants(Array.isArray(plist) ? plist : []);
      } catch { /* ignore */ }
    };
    socket.on('user:joined', refetchParticipants);
    return () => socket.off('user:joined', refetchParticipants);
  }, [socket]);

  // Server-driven thread refresh
  useEffect(() => {
    if (!socket || !myId) return;
    const onRefresh = ({ roomId: rid }) => {
      if (rid !== roomDbIdRef.current) return;
      refetchThreads();
    };
    socket.on('chat:threads:refresh', onRefresh);
    return () => socket.off('chat:threads:refresh', onRefresh);
  }, [socket, myId, refetchThreads]);

  // Live message receiver
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      const rid = roomDbIdRef.current;
      if (rid && msg.roomId && msg.roomId !== rid) return;

      if (msg.scope !== 'PRIVATE') {
        setEveryoneMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        return;
      }

      if (!msg.threadId) return;
      setPrivateByThread((prev) => {
        const cur = prev[msg.threadId] || [];
        if (cur.find((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.threadId]: [...cur, msg] };
      });
    };
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket]);

  const privateMessages = useMemo(
    () => (selectedThreadId ? (privateByThread[selectedThreadId] || []) : []),
    [privateByThread, selectedThreadId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [everyoneMessages, privateMessages, activeTab]);

  // Notify parent of unread (very simple: total messages count haven't viewed)
  useEffect(() => {
    if (!onUnreadChange) return;
    onUnreadChange({ everyone: everyoneMessages.length });
  }, [everyoneMessages.length, onUnreadChange]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const toggleDraftMember = useCallback((userId) => {
    if (userId === myId) return;
    setDraftMemberIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  }, [myId]);

  const startNewGroup = useCallback(() => {
    setSelectedThreadId(null);
    setCreatingGroup(true);
    setDraftMemberIds([]);
  }, []);

  const cancelNewGroup = useCallback(() => {
    setCreatingGroup(false);
    setDraftMemberIds([]);
  }, []);

  const submitNewGroup = useCallback(async () => {
    const rid = canonicalRoomId;
    if (!rid || draftMemberIds.length === 0) {
      toast.error('Select at least one person for the group.');
      return;
    }
    try {
      const thread = await createChatThread(rid, { memberUserIds: draftMemberIds });
      setThreads((prev) => [thread, ...prev.filter((t) => t.id !== thread.id)]);
      setSelectedThreadId(thread.id);
      setCreatingGroup(false);
      setDraftMemberIds([]);
      toast.success('Group created.');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Could not create group.');
    }
  }, [canonicalRoomId, draftMemberIds]);

  const leaveSelectedGroup = useCallback(async () => {
    const rid = canonicalRoomId;
    if (!rid || !selectedThreadId) return;
    if (!window.confirm('Leave this group? You will stop receiving messages here.')) return;
    try {
      await leaveChatThread(rid, selectedThreadId);
      setThreads((prev) => prev.filter((t) => t.id !== selectedThreadId));
      setPrivateByThread((prev) => {
        const next = { ...prev };
        delete next[selectedThreadId];
        return next;
      });
      fetchedThreadsRef.current.delete(selectedThreadId);
      setSelectedThreadId(null);
      toast.success('Left the group.');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Could not leave group.');
    }
  }, [canonicalRoomId, selectedThreadId]);

  const deleteSelectedGroup = useCallback(async () => {
    const rid = canonicalRoomId;
    if (!rid || !selectedThreadId) return;
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) return;
    try {
      await deleteChatThread(rid, selectedThreadId);
      setThreads((prev) => prev.filter((t) => t.id !== selectedThreadId));
      setPrivateByThread((prev) => {
        const next = { ...prev };
        delete next[selectedThreadId];
        return next;
      });
      fetchedThreadsRef.current.delete(selectedThreadId);
      setSelectedThreadId(null);
      toast.success('Group deleted.');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Could not delete group.');
    }
  }, [canonicalRoomId, selectedThreadId]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socket || !myId) return;
    setInput('');

    const rid = canonicalRoomId || roomDbIdRef.current;
    if (!rid) {
      inputRef.current?.focus();
      return;
    }

    if (activeTab === 'everyone') {
      socket.emit('message:send', {
        roomId: rid,
        content: text,
        scope: 'ROOM',
      });
      inputRef.current?.focus();
      return;
    }

    if (creatingGroup || !selectedThreadId) {
      inputRef.current?.focus();
      return;
    }

    socket.emit('message:send', {
      roomId: rid,
      content: text,
      scope: 'PRIVATE',
      threadId: selectedThreadId,
    });
    inputRef.current?.focus();
  }, [input, socket, myId, activeTab, selectedThreadId, creatingGroup, canonicalRoomId]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const bg = darkMode ? '#1e293b' : 'var(--card)';
  const border = darkMode ? '#334155' : 'var(--border)';
  const text = darkMode ? '#f1f5f9' : 'var(--text)';
  const text3 = darkMode ? '#64748b' : 'var(--text3)';
  const inputBg = darkMode ? '#2d3b4e' : 'var(--input-bg)';

  if (!myId) {
    return (
      <div style={{
        display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', background: bg,
        color: text3, fontSize: 13,
      }}>
        Sign in to use chat in this room.
      </div>
    );
  }

  const displayMessages = activeTab === 'everyone' ? everyoneMessages : privateMessages;
  const displayLoading = activeTab === 'everyone' ? loadingEveryone : loadingPrivate;
  const canSendEveryone = activeTab === 'everyone' && !!canonicalRoomId;
  const canSendPrivate = activeTab === 'private' && !!selectedThreadId && !creatingGroup && !!canonicalRoomId;

  const renderMessage = (msg) => {
    const isMe = msg.user?.id === currentUser?.id;
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          flexDirection: isMe ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        {!isMe && <Avatar name={msg.user?.name} avatar={msg.user?.avatar} size={28} />}
        <div style={{ maxWidth: '75%' }}>
          {!isMe && (
            <div style={{ fontSize: 11, color: text3, marginBottom: 3, marginLeft: 2 }}>
              {msg.user?.name}
            </div>
          )}
          <div style={{
            padding: '8px 12px',
            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
            background: isMe ? 'var(--coral)' : (darkMode ? '#334155' : '#f1f5f9'),
            color: isMe ? '#fff' : text,
            fontSize: 13,
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {msg.content}
          </div>
          <div style={{
            fontSize: 10, color: text3, marginTop: 3,
            textAlign: isMe ? 'right' : 'left',
            marginRight: isMe ? 2 : 0, marginLeft: isMe ? 0 : 2,
            display: 'flex', gap: 4, justifyContent: isMe ? 'flex-end' : 'flex-start',
            alignItems: 'center',
          }}>
            {msg.scope === 'PRIVATE' && <span style={{ opacity: 0.75 }}>Private</span>}
            {fmt(msg.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
      background: bg, borderTop: `1px solid ${border}`, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 12px 0', borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }} aria-hidden>💬</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: text }}>Chat</span>
          {displayMessages.length > 0 && (
            <span style={{
              marginLeft: 'auto', background: 'var(--coral)', color: '#fff',
              borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px',
            }}>
              {displayMessages.length}
            </span>
          )}
        </div>
        {/*
          Private groups UI is temporarily hidden — keep the tab strip code intact so we can
          re-enable it when the feature ships. Until then we render a single Everyone view.

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => { setActiveTab('everyone'); setCreatingGroup(false); }}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeTab === 'everyone' ? 'var(--coral)' : 'transparent',
              color: activeTab === 'everyone' ? '#fff' : text,
            }}
          >
            Everyone
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('private')}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeTab === 'private' ? 'var(--teal)' : 'transparent',
              color: activeTab === 'private' ? '#fff' : text,
            }}
          >
            Private groups
          </button>
        </div>
        */}
        <p style={{ fontSize: 11, color: text3, margin: '0 0 6px', lineHeight: 1.45 }}>
          Visible to everyone in this session (including people in the waiting lobby).
        </p>
        <p style={{
          fontSize: 11, color: text3, margin: '0 0 10px', lineHeight: 1.45,
          padding: '6px 10px', borderRadius: 8,
          background: darkMode ? 'rgba(45,184,163,0.08)' : 'rgba(45,184,163,0.10)',
          border: `1px dashed ${darkMode ? 'rgba(45,184,163,0.35)' : 'rgba(45,184,163,0.4)'}`,
        }}>
          <strong style={{ color: 'var(--teal)' }}>Private groups —</strong> cooking something good. Dropping in a future update, stay tuned.
        </p>
      </div>

      {/* Private groups panel — hidden until the feature is ready. Keep the JSX intact below.
      {activeTab === 'private' && (
        <div style={{
          display: 'flex', borderBottom: `1px solid ${border}`,
          flexShrink: 0, minHeight: 0, maxHeight: 160,
        }}>
          <div style={{
            width: 148, flexShrink: 0, overflowY: 'auto', padding: '8px 6px',
            borderRight: `1px solid ${border}`, background: darkMode ? '#172033' : '#f8fafc',
          }}>
            <button
              type="button"
              onClick={startNewGroup}
              style={{
                width: '100%', padding: '8px 6px', marginBottom: 6, borderRadius: 8,
                border: `1px dashed ${border}`, background: 'transparent', color: text,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + New group
            </button>
            {loadingThreads ? (
              <p style={{ fontSize: 10, color: text3, padding: 4 }}>Loading…</p>
            ) : threads.length === 0 ? (
              <p style={{ fontSize: 10, color: text3, padding: 4 }}>No groups yet.</p>
            ) : (
              threads.map((t) => {
                const others = (t.members || [])
                  .filter((m) => m.userId !== myId)
                  .map((m) => m.user?.name || 'Unknown');
                const subtitle = others.length === 0
                  ? 'Just you'
                  : others.length === 1
                    ? `You + ${others[0]}`
                    : `You + ${others.length} others`;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedThreadId(t.id); setCreatingGroup(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '6px 8px', marginBottom: 4,
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: selectedThreadId === t.id ? 'var(--teal)' : 'transparent',
                      color: selectedThreadId === t.id ? '#fff' : text,
                      fontSize: 11, fontWeight: selectedThreadId === t.id ? 700 : 500,
                    }}
                  >
                    {t.title || 'Group'}
                    <span style={{ opacity: 0.85, display: 'block', fontWeight: 400, fontSize: 10 }}>
                      {subtitle}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', minWidth: 0 }}>
            {creatingGroup ? (
              <>
                <p style={{ fontSize: 11, color: text3, margin: '0 0 8px' }}>
                  Choose who is in this group. Only selected members and the creator will see it.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 88, overflowY: 'auto' }}>
                  {participants.filter((p) => p.id !== myId).map((p) => (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: text, cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftMemberIds.includes(p.id)}
                        onChange={() => toggleDraftMember(p.id)}
                      />
                      <Avatar name={p.name} avatar={p.avatar} size={22} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={submitNewGroup}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                      background: 'var(--teal)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Create group
                  </button>
                  <button
                    type="button"
                    onClick={cancelNewGroup}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`,
                      background: 'transparent', color: text, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : !selectedThreadId ? (
              <p style={{ fontSize: 12, color: text3, margin: 0 }}>
                Select a group on the left or start a <strong style={{ color: text }}>new group</strong>.
              </p>
            ) : (() => {
                const isMember = !!selectedThread?.members?.some((m) => m.userId === myId);
                const others = selectedThread?.members
                  ?.filter((m) => m.userId !== myId)
                  .map((m) => m.user?.name || 'Unknown') || [];
                const isCreator = selectedThread?.createdById === myId;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 11, color: text3, margin: 0, lineHeight: 1.4 }}>
                      <strong style={{ color: text }}>{selectedThread?.title || 'Group'}</strong>
                      {' · '}
                      {isMember && <span style={{ color: 'var(--teal)', fontWeight: 600 }}>You</span>}
                      {isMember && others.length > 0 && ', '}
                      {others.join(', ')}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isMember && (
                        <button
                          type="button"
                          onClick={leaveSelectedGroup}
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: `1px solid ${border}`,
                            background: 'transparent', color: text3, fontSize: 10, cursor: 'pointer',
                          }}
                        >
                          Leave
                        </button>
                      )}
                      {isCreator && (
                        <button
                          type="button"
                          onClick={deleteSelectedGroup}
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: 'none',
                            background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10, cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      )}
      */}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Empty-state branch for the private flow is also hidden while the feature is off:
        {activeTab === 'private' && (creatingGroup || !selectedThreadId) ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: text3 }}>
            <p style={{ fontSize: 13 }}>Open or create a group to see messages here.</p>
          </div>
        ) : displayLoading && displayMessages.length === 0 ? (
        */}
        {displayLoading && displayMessages.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${border}`, borderTopColor: 'var(--coral)', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
        ) : displayMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: text3 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 13 }}>No messages yet. Say hello!</p>
          </div>
        ) : (
          displayMessages.map(renderMessage)
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="chat-panel-composer"
        style={{ borderTop: `1px solid ${border}`, background: bg }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            activeTab === 'everyone'
              ? 'Message everyone…'
              : canSendPrivate
                ? 'Message this group…'
                : 'Select or create a group…'
          }
          disabled={!canSendEveryone && !canSendPrivate}
          style={{
            flex: 1, background: inputBg, border: `1.5px solid ${border}`,
            borderRadius: 20, padding: '8px 14px', color: text,
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
            opacity: (canSendEveryone || canSendPrivate) ? 1 : 0.5,
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--coral)'; }}
          onBlur={(e) => { e.target.style.borderColor = border; }}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!input.trim() || (!canSendEveryone && !canSendPrivate)}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: (input.trim() && (canSendEveryone || canSendPrivate)) ? 'var(--coral)' : (darkMode ? '#334155' : '#e2e8f0'),
            color: (input.trim() && (canSendEveryone || canSendPrivate)) ? '#fff' : text3,
            cursor: (input.trim() && (canSendEveryone || canSendPrivate)) ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
