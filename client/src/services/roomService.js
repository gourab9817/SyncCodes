import api from './api';

export const createRoom = (data) => api.post('/api/rooms', data).then((r) => r.data);
export const listRooms = () => api.get('/api/rooms').then((r) => r.data);
export const getRoom = (id) => api.get(`/api/rooms/${id}`).then((r) => r.data);
export const getRoomByCode = (code) => api.get(`/api/rooms/code/${code}`).then((r) => r.data);
export const deleteRoom = (id) => api.delete(`/api/rooms/${id}`).then((r) => r.data);

/**
 * @param {string} roomId
 * @param {{ cursor?: string, limit?: number, scope?: 'ROOM'|'PRIVATE', threadKey?: string, threadId?: string }} [params]
 */
export const getRoomMessages = (roomId, params = {}) =>
  api.get(`/api/rooms/${roomId}/messages`, { params: { limit: 80, ...params } }).then((r) => r.data);

export const listRoomChatThreads = (roomId) =>
  api.get(`/api/rooms/${roomId}/chat-threads`).then((r) => r.data);

export const createChatThread = (roomId, body) =>
  api.post(`/api/rooms/${roomId}/chat-threads`, body).then((r) => r.data);

export const leaveChatThread = (roomId, threadId) =>
  api.post(`/api/rooms/${roomId}/chat-threads/${threadId}/leave`).then((r) => r.data);

export const deleteChatThread = (roomId, threadId) =>
  api.delete(`/api/rooms/${roomId}/chat-threads/${threadId}`).then((r) => r.data);

export const getStats = () => api.get('/api/users/me/stats').then((r) => r.data);

export const getRoomParticipants = (roomId) =>
  api.get(`/api/rooms/${roomId}/participants`).then((r) => r.data);
