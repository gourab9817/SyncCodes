/**
 * Live diagnostic: two users join the same room and we verify
 * socket events, signaling flow, and chat message delivery.
 *
 * Run from the SyncCodes root: node test_room_flow.cjs
 * Backend must already be running on localhost:8000.
 */

'use strict';
const { io } = require('./client/node_modules/socket.io-client');
const https = require('https');
const http = require('http');

const BASE = 'http://localhost:8000';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m→\x1b[0m';

let failures = 0;
function ok(label)   { console.log(`${PASS} ${label}`); }
function fail(label) { console.log(`${FAIL} ${label}`); failures++; }
function info(label) { console.log(`${INFO} ${label}`); }

// Simple HTTP helper
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 8000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, {
      transports: ['websocket'],
      auth: { token },
      timeout: 6000,
      reconnection: false,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
    setTimeout(() => reject(new Error('Socket connect timeout')), 7000);
  });
}

// ──────────────────────────────────────────────
async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log(' SyncCodes — Live Room Flow Diagnostic');
  console.log('══════════════════════════════════════════\n');

  // ── 1. Register two test users ──────────────
  info('Registering user A …');
  const ts = Date.now();
  const emailA = `testA_${ts}@synccodes.test`;
  const emailB = `testB_${ts}@synccodes.test`;

  const regA = await req('POST', '/api/auth/register', { name: 'Alice', email: emailA, password: 'Test1234!' });
  if (regA.status === 201 || regA.status === 200) ok(`User A registered (${emailA})`);
  else { fail(`User A register failed: ${JSON.stringify(regA.body)}`); }

  const regB = await req('POST', '/api/auth/register', { name: 'Bob', email: emailB, password: 'Test1234!' });
  if (regB.status === 201 || regB.status === 200) ok(`User B registered (${emailB})`);
  else { fail(`User B register failed: ${JSON.stringify(regB.body)}`); }

  // ── 2. Log in ───────────────────────────────
  info('Logging in …');
  const loginA = await req('POST', '/api/auth/login', { email: emailA, password: 'Test1234!' });
  const loginB = await req('POST', '/api/auth/login', { email: emailB, password: 'Test1234!' });

  const tokenA = loginA.body?.access_token;
  const tokenB = loginB.body?.access_token;
  const userAId = loginA.body?.user?.id;
  const userBId = loginB.body?.user?.id;

  if (tokenA) ok('User A logged in'); else { fail(`User A login failed: ${JSON.stringify(loginA.body)}`); process.exit(1); }
  if (tokenB) ok('User B logged in'); else { fail(`User B login failed: ${JSON.stringify(loginB.body)}`); process.exit(1); }

  // ── 3. User A creates a room ─────────────────
  info('User A creating a room …');
  const createRoom = await req('POST', '/api/rooms', { name: 'Test Room' }, tokenA);
  const room = createRoom.body;
  if (createRoom.status === 201 && room.joinCode) {
    ok(`Room created — joinCode: ${room.joinCode}  id: ${room.id}`);
  } else { 
    fail(`Room creation failed: ${JSON.stringify(room)}`);
    process.exit(1);
  }

  // ── 4. Resolve room by joinCode ───────────────
  info(`Resolving room by joinCode "${room.joinCode}" …`);
  const resolveRes = await req('GET', `/api/rooms/code/${room.joinCode}`, null, tokenA);
  if (resolveRes.status === 200 && resolveRes.body.id === room.id) ok('Room resolved correctly by joinCode');
  else fail(`Room resolution failed: ${JSON.stringify(resolveRes.body)}`);

  // ── 5. Connect sockets ────────────────────────
  info('Connecting socket A …');
  let sockA, sockB;
  try { sockA = await connectSocket(tokenA); ok(`Socket A connected (id: ${sockA.id})`); }
  catch (e) { fail(`Socket A connect failed: ${e.message}`); process.exit(1); }

  info('Connecting socket B …');
  try { sockB = await connectSocket(tokenB); ok(`Socket B connected (id: ${sockB.id})`); }
  catch (e) { fail(`Socket B connect failed: ${e.message}`); process.exit(1); }

  // ── 6. A joins room ───────────────────────────
  info(`Socket A joining room "${room.joinCode}" …`);
  const aJoinP = new Promise(res => sockA.once('room:join', res));
  sockA.emit('room:join', { email: emailA, room: room.joinCode });
  const aJoinEvt = await Promise.race([aJoinP, delay(4000)]);
  if (aJoinEvt?.room) ok(`Socket A joined room (ownerId matches: ${aJoinEvt.ownerId === userAId})`);
  else fail('Socket A did NOT receive room:join confirmation');

  // ── 7. B joins room — A should see user:joined ─
  info(`Socket B joining room "${room.joinCode}" …`);
  const userJoinedP = new Promise(res => sockA.once('user:joined', res));
  const bJoinP = new Promise(res => sockB.once('room:join', res));
  sockB.emit('room:join', { email: emailB, room: room.joinCode });

  const [bJoinEvt, userJoinedEvt] = await Promise.race([
    Promise.all([bJoinP, userJoinedP]),
    delay(5000).then(() => [null, null]),
  ]);

  if (bJoinEvt?.room) ok('Socket B joined room');
  else fail('Socket B did NOT receive room:join confirmation');

  if (userJoinedEvt?.id === sockB.id && userJoinedEvt?.email === emailB) {
    ok(`A received user:joined for B (socketId match: ${userJoinedEvt.id === sockB.id})`);
  } else {
    fail(`A did NOT receive correct user:joined — got: ${JSON.stringify(userJoinedEvt)}`);
  }

  // ── 8. Simulate WebRTC signaling ──────────────
  info('Testing WebRTC signaling relay (offer → answer → ICE) …');

  // A sends offer, B should receive incomming:call
  const incommingCallP = new Promise(res => sockB.once('incomming:call', res));
  sockA.emit('user:call', { to: sockB.id, offer: { type: 'offer', sdp: 'v=0\r\no=test' }, email: emailA });
  const callEvt = await Promise.race([incommingCallP, delay(3000)]);
  if (callEvt?.from === sockA.id) ok('B received incomming:call from A');
  else fail(`B did NOT receive incomming:call — got: ${JSON.stringify(callEvt)}`);

  // B sends answer, A should receive call:accepted
  const callAcceptedP = new Promise(res => sockA.once('call:accepted', res));
  sockB.emit('call:accepted', { to: sockA.id, ans: { type: 'answer', sdp: 'v=0\r\no=test' } });
  const acceptEvt = await Promise.race([callAcceptedP, delay(3000)]);
  if (acceptEvt?.from === sockB.id) ok('A received call:accepted from B');
  else fail(`A did NOT receive call:accepted — got: ${JSON.stringify(acceptEvt)}`);

  // ICE candidate relay A → B
  const iceBP = new Promise(res => sockB.once('ice:candidate', res));
  sockA.emit('ice:candidate', { to: sockB.id, candidate: { candidate: 'candidate:1 1 UDP 1234 1.2.3.4 5678 typ srflx' } });
  const iceBEvt = await Promise.race([iceBP, delay(3000)]);
  if (iceBEvt?.candidate?.candidate?.startsWith('candidate:')) ok('ICE candidate relayed A → B');
  else fail(`ICE candidate NOT relayed A → B — got: ${JSON.stringify(iceBEvt)}`);

  // ICE candidate relay B → A
  const iceAP = new Promise(res => sockA.once('ice:candidate', res));
  sockB.emit('ice:candidate', { to: sockA.id, candidate: { candidate: 'candidate:2 1 UDP 5678 5.6.7.8 1234 typ srflx' } });
  const iceAEvt = await Promise.race([iceAP, delay(3000)]);
  if (iceAEvt?.candidate?.candidate?.startsWith('candidate:')) ok('ICE candidate relayed B → A');
  else fail(`ICE candidate NOT relayed B → A — got: ${JSON.stringify(iceAEvt)}`);

  // ── 9. Chat message delivery ──────────────────
  info('Testing chat message delivery (plaintext fallback) …');
  const msgP = new Promise(res => sockB.once('message:new', res));
  sockA.emit('message:send', { roomId: room.joinCode, content: 'hello from A' });
  const msgEvt = await Promise.race([msgP, delay(5000)]);
  if (msgEvt?.content === 'hello from A') ok('Chat message delivered to B');
  else fail(`Chat message NOT delivered — got: ${JSON.stringify(msgEvt)}`);

  // ── 10. Yjs update relay ──────────────────────
  info('Testing Yjs code update relay …');
  const fakeUpdate = [1, 2, 3, 4, 5];
  const yjsP = new Promise(res => sockB.once('yjs:update', res));
  sockA.emit('yjs:update', { roomId: room.joinCode, update: fakeUpdate });
  const yjsEvt = await Promise.race([yjsP, delay(3000)]);
  if (JSON.stringify(yjsEvt?.update) === JSON.stringify(fakeUpdate)) ok('Yjs update relayed A → B');
  else fail(`Yjs update NOT relayed — got: ${JSON.stringify(yjsEvt)}`);

  // ── 11. User left ─────────────────────────────
  info('Testing user:left when socket disconnects …');
  const userLeftP = new Promise(res => sockA.once('user:left', res));
  sockB.disconnect();
  const leftEvt = await Promise.race([userLeftP, delay(4000)]);
  if (leftEvt?.email === emailB || leftEvt?.id === sockB.id) ok('A received user:left when B disconnected');
  else fail(`A did NOT receive user:left — got: ${JSON.stringify(leftEvt)}`);

  // ── Summary ───────────────────────────────────
  sockA.disconnect();
  console.log('\n══════════════════════════════════════════');
  if (failures === 0) {
    console.log('\x1b[32m ALL TESTS PASSED — backend signaling is correct\x1b[0m');
  } else {
    console.log(`\x1b[31m ${failures} TEST(S) FAILED — see above\x1b[0m`);
  }
  console.log('══════════════════════════════════════════\n');
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
