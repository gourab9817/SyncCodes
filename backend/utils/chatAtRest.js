const crypto = require('crypto');

const PREFIX = 'sc1:';

function getKeyBuf() {
  const s = process.env.CHAT_AT_REST_SECRET;
  if (!s || !String(s).trim()) return null;
  return crypto.createHash('sha256').update(String(s), 'utf8').digest();
}

/** Encrypt message body for DB storage (optional). Wire/API always uses plaintext. */
function sealForDb(plaintext) {
  const keyBuf = getKeyBuf();
  if (!keyBuf || plaintext == null) return String(plaintext ?? '');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt DB-stored body for API/socket responses. */
function openFromDb(stored) {
  const keyBuf = getKeyBuf();
  if (!stored || typeof stored !== 'string') return '';
  if (!keyBuf || !stored.startsWith(PREFIX)) return stored;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '[Could not decrypt stored message]';
  }
}

/** Normalize Prisma message for clients: plaintext, no E2E fields. */
function toWireMessage(row) {
  if (!row) return row;
  let content = row.content;
  if (typeof content === 'string' && content.startsWith(PREFIX)) {
    content = openFromDb(content);
  } else if (row.encrypted && row.recipientKeys) {
    content = '[Older end-to-end message — not shown]';
  }
  return {
    ...row,
    content,
    encrypted: false,
    iv: null,
    recipientKeys: null,
  };
}

module.exports = { sealForDb, openFromDb, toWireMessage };
