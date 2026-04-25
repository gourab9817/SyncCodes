const DB_NAME = 'synccodes-e2e';
const STORE = 'keys';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      })
  );
}

function dbGet(key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

// Load existing key pair for a user or generate a new one.
// Returns { privateKey: CryptoKey, publicKeyJwk: string }
export async function getOrCreateKeyPair(userId) {
  const privId = `ecdh-priv-${userId}`;
  const pubId = `ecdh-pub-${userId}`;

  const [existingPrivJwk, existingPubJwk] = await Promise.all([dbGet(privId), dbGet(pubId)]);

  if (existingPrivJwk && existingPubJwk) {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      existingPrivJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits']
    );
    return { privateKey, publicKeyJwk: JSON.stringify(existingPubJwk) };
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const [privJwk, pubJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
  ]);

  await Promise.all([dbPut(privId, privJwk), dbPut(pubId, pubJwk)]);

  return { privateKey: keyPair.privateKey, publicKeyJwk: JSON.stringify(pubJwk) };
}
