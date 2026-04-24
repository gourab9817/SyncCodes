const { assertSocketInRoom, assertAuthenticated, yjsUpdateLimiter } = require('../socketGuards');

const MAX_STROKES_JSON = parseInt(process.env.WHITEBOARD_MAX_STROKES_BYTES || '1048576', 10);

module.exports = (io, socket) => {
  socket.on('whiteboard:update', ({ roomId, strokes }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    const raw = strokes == null ? '' : typeof strokes === 'string' ? strokes : JSON.stringify(strokes);
    if (raw.length > MAX_STROKES_JSON) return;
    if (!yjsUpdateLimiter.allow(socket.id)) return;
    socket.to(roomId).emit('whiteboard:update', { strokes });
  });

  socket.on('whiteboard:clear', ({ roomId }) => {
    const authErr = assertAuthenticated(socket);
    if (authErr) return;
    if (assertSocketInRoom(socket, roomId)) return;
    socket.to(roomId).emit('whiteboard:clear');
  });
};
