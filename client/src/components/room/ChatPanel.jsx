import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../utils/SocketProvider.js';
import { getRoomByCode, getRoomMessages } from '../../services/roomService';

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

const ChatPanel = ({ roomId, currentUser, darkMode }) => {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load history
  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      try {
        // roomId from URL is always the joinCode — look up by code to get internal id
        const room = await getRoomByCode(roomId);
        if (room?.id) {
          const history = await getRoomMessages(room.id);
          setMessages(history);
        }
      } catch {
        // Not authenticated or room not found — start with empty history
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roomId]);

  // Socket listener
  useEffect(() => {
    const handler = (msg) => {
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content) return;

    // Optimistic UI
    const optimistic = {
      id: `opt-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      user: { name: currentUser?.name || 'You', avatar: currentUser?.avatar || null },
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    socket.emit('message:send', { roomId, content });
    inputRef.current?.focus();
  }, [input, socket, roomId, currentUser]);

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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: bg, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: text }}>Chat</span>
        {messages.length > 0 && (
          <span style={{
            marginLeft: 'auto', background: 'var(--coral)', color: '#fff',
            borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px',
          }}>
            {messages.length}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${border}`, borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: text3 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 13 }}>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user?.name === currentUser?.name;
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                  opacity: msg.optimistic ? 0.7 : 1,
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
                  <div style={{ fontSize: 10, color: text3, marginTop: 3, textAlign: isMe ? 'right' : 'left', marginRight: isMe ? 2 : 0, marginLeft: isMe ? 0 : 2 }}>
                    {fmt(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: `1px solid ${border}`,
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          style={{
            flex: 1, background: inputBg, border: `1.5px solid ${border}`,
            borderRadius: 20, padding: '8px 14px', color: text,
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--coral)'; }}
          onBlur={(e) => { e.target.style.borderColor = border; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: input.trim() ? 'var(--coral)' : (darkMode ? '#334155' : '#e2e8f0'),
            color: input.trim() ? '#fff' : text3,
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .15s',
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
