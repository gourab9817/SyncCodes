const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export async function importPublicKey(jwkString) {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwkString),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Derive AES-KW-256 from ECDH shared secret via HKDF
async function deriveWrapKey(myPrivateKey, theirPublicKey) {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    256
  );
  const ikm = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('SyncCodes-chat-v1'),
    },
    ikm,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

// Encrypt plaintext for all recipients.
// memberPublicKeys: { [userId]: CryptoKey }
// Returns { encryptedContent, iv, recipientKeys: { [userId]: base64 } }
export async function encryptMessage(plaintext, myPrivateKey, memberPublicKeys) {
  const messageKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    messageKey,
    new TextEncoder().encode(plaintext)
  );

  const recipientKeys = {};
  for (const [userId, publicKey] of Object.entries(memberPublicKeys)) {
    try {
      const wrapKey = await deriveWrapKey(myPrivateKey, publicKey);
      const wrapped = await crypto.subtle.wrapKey('raw', messageKey, wrapKey, 'AES-KW');
      recipientKeys[userId] = toBase64(wrapped);
    } catch {
      // Skip recipients whose key derivation fails
    }
  }

  return {
    encryptedContent: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
    recipientKeys,
  };
}

// Decrypt a single message. Returns plaintext string or null on failure.
export async function decryptMessage(encryptedContent, iv, wrappedKey, myPrivateKey, senderPublicKey) {
  try {
    const wrapKey = await deriveWrapKey(myPrivateKey, senderPublicKey);
    const messageKey = await crypto.subtle.unwrapKey(
      'raw',
      fromBase64(wrappedKey),
      wrapKey,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      messageKey,
      fromBase64(encryptedContent)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
