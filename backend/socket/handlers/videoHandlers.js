/**
 * Checks whether socketA (the sender) and targetSocketId are members of at
 * least one common room. This prevents any connected socket from sending
 * arbitrary WebRTC signals to sockets outside their session.
 */
function shareARoom(io, senderSocket, targetSocketId) {
  for (const roomId of senderSocket.data.joinedRooms || []) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.has(targetSocketId)) return true;
  }
  return false;
}

module.exports = (io, socket) => {
  // Media-toggle events: sender must be in the same room as the target.
  socket.on('user:video:toggle', ({ to, isVideoOff, email }) => {
    if (!to || !shareARoom(io, socket, to)) return;
    io.to(to).emit('remote:video:toggle', { isVideoOff, email });
  });

  socket.on('user:audio:toggle', ({ to, isAudioOff, email }) => {
    if (!to || !shareARoom(io, socket, to)) return;
    io.to(to).emit('remote:audio:toggle', { isAudioOff, email });
  });

  // WebRTC: membership in a shared room is enforced by shareARoom; do not require
  // JWT (guest / token-without-email still needs to be able to signal in-room).
  socket.on('user:call', ({ to, offer, email }) => {
    if (!to || !offer) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('incomming:call', { from: socket.id, offer, fromEmail: email });
  });

  socket.on('call:accepted', ({ to, ans }) => {
    if (!to || !ans) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('call:accepted', { from: socket.id, ans });
  });

  socket.on('peer:nego:needed', ({ to, offer }) => {
    if (!to || !offer) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('peer:nego:needed', { from: socket.id, offer });
  });

  socket.on('peer:nego:done', ({ to, ans }) => {
    if (!to || !ans) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('peer:nego:final', { from: socket.id, ans });
  });

  socket.on('wait:for:call', ({ to, email }) => {
    if (!to) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('wait:for:call', { from: socket.id, email });
  });

  socket.on('call:left', ({ to }) => {
    if (!to || !shareARoom(io, socket, to)) return;
    io.to(to).emit('call:left', { from: socket.id });
  });

  // Trickle-ICE relay. Without forwarding per-peer candidates the WebRTC
  // connection can't traverse different NATs (e.g. phone cellular ↔ PC WiFi).
  socket.on('ice:candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    if (!shareARoom(io, socket, to)) return;
    io.to(to).emit('ice:candidate', { from: socket.id, candidate });
  });
};
