const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');

const jwksClients = new Map();

function getSupabaseJwksClient(issuer) {
  const jwksUri = `${issuer}/.well-known/jwks.json`;
  if (!jwksClients.has(jwksUri)) {
    jwksClients.set(jwksUri, jwks({
      jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
    }));
  }
  return jwksClients.get(jwksUri);
}

function verifyWithJwks(token, issuer) {
  const client = getSupabaseJwksClient(issuer);
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, cb) => {
        client.getSigningKey(header.kid, (err, key) => cb(err, key?.getPublicKey()));
      },
      { algorithms: ['ES256', 'RS256'], issuer, audience: 'authenticated' },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

/**
 * Verify a Supabase Auth access token (supports modern JWKS and legacy HS256).
 * @param {string} token
 * @returns {Promise<import('jsonwebtoken').JwtPayload>}
 */
async function verifySupabaseAccessToken(token) {
  const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('SUPABASE_URL must be set');
  }
  const issuer = `${baseUrl}/auth/v1`;

  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;

  if (alg === 'HS256') {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET must be set for HS256 Supabase tokens');
    }
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer,
      audience: 'authenticated',
    });
  }

  return verifyWithJwks(token, issuer);
}

module.exports = { verifySupabaseAccessToken };
