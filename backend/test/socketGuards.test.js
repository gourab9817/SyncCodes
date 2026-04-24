'use strict';

process.env.DATABASE_URL ||= 'postgresql://localhost:5432/postgres';
process.env.NEON_JWKS ||= 'https://example.com/.well-known/jwks.json';

const { test } = require('node:test');
const assert = require('node:assert');

test('sliding window rate limiter allows burst then blocks', () => {
  const { createSlidingWindowLimiter } = require('../socket/socketGuards');
  const limiter = createSlidingWindowLimiter(3, 1000);
  const id = 'sock-test-1';
  assert.strictEqual(limiter.allow(id), true);
  assert.strictEqual(limiter.allow(id), true);
  assert.strictEqual(limiter.allow(id), true);
  assert.strictEqual(limiter.allow(id), false);
  limiter.remove(id);
  assert.strictEqual(limiter.allow(id), true);
});

test('validateYjsUpdate rejects oversized payloads', () => {
  process.env.YJS_MAX_UPDATE_BYTES = '5';
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('../socket/socketGuards')];
  const { validateYjsUpdate } = require('../socket/socketGuards');
  assert.strictEqual(validateYjsUpdate([]), 'empty');
  assert.strictEqual(validateYjsUpdate([1, 2, 3, 4, 5, 6]), 'too_large');
  assert.strictEqual(validateYjsUpdate([1, 2, 3]), null);
  delete process.env.YJS_MAX_UPDATE_BYTES;
});
