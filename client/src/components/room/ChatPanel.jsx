import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../utils/SocketProvider.js';
import { getRoom, getRoomByCode, getRoomMessages, registerPublicKey, getRoomMemberKeys } from '../../services/roomService';
import { isLikelyCuid } from '../../utils/roomKeys.js';
import { getOrCreateKeyPair } from '../../utils/keyStore';
import { importPublicKey, encryptMessage, decryptMessage } from '../../utils/cryptoUtils';

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

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);

async function decryptMsg(msg, myPrivateKey) {
  if (!msg.encrypted || !msg.iv || !msg.recipientKeys) return msg;
  if (!myPrivateKey) return { ...msg, content: null };

  const senderPubKeyStr = msg.user?.publicKey;
  if (!senderPubKeyStr) return { ...msg, content: null };

  const myUserId = msg._myUserId;
  const wrappedKey = msg.recipientKeys[myUserId];
  if (!wrappedKey) return { ...msg, content: null };

  try {
    const senderPubKey = await importPublicKey(senderPubKeyStr);
    const plaintext = await decryptMessage(msg.content, msg.iv, wrappedKey, myPrivateKey, senderPubKey);
    return { ...msg, content: plaintext };
  } catch {
    return { ...msg, content: null };
  }
}

const ChatPanel = ({ roomId, roomCuid, currentUser, darkMode }) => {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [cryptoReady, setCryptoReady] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Crypto state stored in refs to avoid stale closures
  const privateKeyRef = useRef(null);
  const memberKeysRef = useRef({}); // { [userId]: CryptoKey }
  const roomDbIdRef = useRef(null);

  // Initialize crypto: generate/load key pair and register public key.
  // If any step fails, still enable the chat input (falls back to plaintext).
  useEffect(() => {
    if (!currentUser?.id) {
      setCryptoReady(true);
      return;
    }
    const init = async () => {
      try {
        const { privateKey, publicKeyJwk } = await getOrCreateKeyPair(currentUser.id);
        privateKeyRef.current = privateKey;
        try {
          await registerPublicKey(publicKeyJwk);
          // Tell peers in the room about our key. Without this, peers who
          // received our `user:joined` before we registered would never learn
          // our public key and couldn't wrap messages for us.
          if (socket) socket.emit('chat:publicKey:broadcast', { publicKey: publicKeyJwk });
        } catch (regErr) {
          console.warn('registerPublicKey failed — chat will fall back to plaintext', regErr);
        }
      } catch (err) {
        console.error('Crypto init failed', err);
      } finally {
        setCryptoReady(true);
      }
    };
    init();
  }, [currentUser?.id, socket]);

  // Load room ID, member keys, and message history
  useEffect(() => {
    if (!roomId || !cryptoReady) return;
    const load = async () => {
      try {
        let room = null;
        if (roomCuid) {
          try {
            room = await getRoom(roomCuid);
          } catch {
            room = null;
          }
        }
        if (!room) {
          if (isLikelyCuid(String(roomId))) {
            try {
              room = await getRoom(roomId);
            } catch {
              room = null;
            }
          } else {
            try {
              room = await getRoomByCode(roomId);
            } catch {
              room = null;
            }
          }
        }
        if (!room?.id) return;
        roomDbIdRef.current = room.id;

        const [memberKeysList, history] = await Promise.all([
          getRoomMemberKeys(room.id),
          getRoomMessages(room.id),
        ]);

        // Import all member public keys
        const imported = {};
        for (const { userId, publicKey } of memberKeysList) {
          try {
            imported[userId] = await importPublicKey(publicKey);
          } catch {}
        }
        memberKeysRef.current = imported;

        // Decrypt history
        const decrypted = await Promise.all(
          history.map((m) => decryptMsg({ ...m, _myUserId: currentUser.id }, privateKeyRef.current))
        );
        setMessages(decrypted);
      } catch {
        // Not authenticated or room not found
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roomId, roomCuid, cryptoReady, currentUser?.id]);

  // Handle new socket messages: decrypt before adding
  useEffect(() => {
    if (!socket) return;
    const handler = async (msg) => {
      const decrypted = await decryptMsg(
        { ...msg, _myUserId: currentUser?.id },
        privateKeyRef.current
      );
      setMessages((prev) => {
        if (prev.find((m) => m.id === decrypted.id)) return prev;
        return [...prev, decrypted];
      });
    };
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket, currentUser?.id]);

  // When a new user joins, import their public key
  useEffect(() => {
    if (!socket) return;
    const handler = async ({ userId, publicKey }) => {
      if (!userId || !publicKey) return;
      try {
        memberKeysRef.current[userId] = await importPublicKey(publicKey);
      } catch {}
    };
    socket.on('user:joined', handler);
    return () => socket.off('user:joined', handler);
  }, [socket]);

  // A peer may register their key AFTER joining (e.g. they opened the chat
  // panel lazily). Listen for the broadcast and update our memberKeysRef so
  // future outgoing messages are wrapped for them.
  useEffect(() => {
    if (!socket) return;
    const handler = async ({ userId, publicKey }) => {
      if (!userId || !publicKey) return;
      try {
        memberKeysRef.current[userId] = await importPublicKey(publicKey);
      } catch {}
    };
    socket.on('chat:publicKey:update', handler);
    return () => socket.off('chat:publicKey:update', handler);
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !cryptoReady || !socket) return;
    setInput('');

    try {
      // Refresh member keys just-in-time so newly joined peers/devices are
      // included even if we missed a socket key-update event during reconnect.
      try {
        const roomDbId =
          roomDbIdRef.current ||
          roomCuid ||
          (isLikelyCuid(String(roomId)) ? (await getRoom(roomId))?.id : (await getRoomByCode(roomId))?.id);
        if (roomDbId) {
          roomDbIdRef.current = roomDbId;
          const latest = await getRoomMemberKeys(roomDbId);
          for (const { userId, publicKey } of latest) {
            if (!publicKey) continue;
            try {
              memberKeysRef.current[userId] = await importPublicKey(publicKey);
            } catch {}
          }
        }
      } catch {}

      if (privateKeyRef.current && Object.keys(memberKeysRef.current).length > 0) {
        const { encryptedContent, iv, recipientKeys } = await encryptMessage(
          text,
          privateKeyRef.current,
          memberKeysRef.current
        );
        socket.emit('message:send', { roomId, encryptedContent, iv, recipientKeys });
      } else {
        socket.emit('message:send', { roomId, content: text });
      }
    } catch (err) {
      console.error('Encrypt/send failed', err);
      socket.emit('message:send', { roomId, content: text });
    }

    inputRef.current?.focus();
  }, [input, socket, roomId, roomCuid, cryptoReady]);

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
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: text3, marginLeft: 4 }}>
          <LockIcon /> E2E encrypted
        </span>
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
            const isMe = msg.user?.id === currentUser?.id;
            const displayContent = msg.content;
            const isUndecryptable = msg.encrypted && displayContent === null;

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
                    color: isMe ? '#fff' : (isUndecryptable ? text3 : text),
                    fontSize: 13,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    fontStyle: isUndecryptable ? 'italic' : 'normal',
                  }}>
                    {isUndecryptable ? '🔐 Encrypted message' : displayContent}
                  </div>
                  <div style={{
                    fontSize: 10, color: text3, marginTop: 3,
                    textAlign: isMe ? 'right' : 'left',
                    marginRight: isMe ? 2 : 0, marginLeft: isMe ? 0 : 2,
                    display: 'flex', gap: 4, justifyContent: isMe ? 'flex-end' : 'flex-start',
                    alignItems: 'center',
                  }}>
                    {msg.encrypted && <LockIcon />}
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
          placeholder={cryptoReady ? 'Type a message… (E2E encrypted)' : 'Initializing encryption…'}
          disabled={!cryptoReady}
          style={{
            flex: 1, background: inputBg, border: `1.5px solid ${border}`,
            borderRadius: 20, padding: '8px 14px', color: text,
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
            opacity: cryptoReady ? 1 : 0.5,
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--coral)'; }}
          onBlur={(e) => { e.target.style.borderColor = border; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !cryptoReady}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: (input.trim() && cryptoReady) ? 'var(--coral)' : (darkMode ? '#334155' : '#e2e8f0'),
            color: (input.trim() && cryptoReady) ? '#fff' : text3,
            cursor: (input.trim() && cryptoReady) ? 'pointer' : 'default',
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
