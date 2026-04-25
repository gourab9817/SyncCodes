import api from './api';

export const createRoom = (data) => api.post('/api/rooms', data).then((r) => r.data);
export const listRooms = () => api.get('/api/rooms').then((r) => r.data);
export const getRoom = (id) => api.get(`/api/rooms/${id}`).then((r) => r.data);
export const getRoomByCode = (code) => api.get(`/api/rooms/code/${code}`).then((r) => r.data);
export const deleteRoom = (id) => api.delete(`/api/rooms/${id}`).then((r) => r.data);
export const getRoomMessages = (id, cursor) =>
  api.get(`/api/rooms/${id}/messages`, { params: { cursor } }).then((r) => r.data);
export const getStats = () => api.get('/api/users/me/stats').then((r) => r.data);
export const registerPublicKey = (publicKey) =>
  api.put('/api/users/me/public-key', { publicKey }).then((r) => r.data);
export const getRoomMemberKeys = (roomId) =>
  api.get(`/api/rooms/${roomId}/member-keys`).then((r) => r.data);
