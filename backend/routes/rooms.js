const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const {
  createRoom,
  listRooms,
  getRoom,
  getRoomByCode,
  deleteRoom,
  getRoomMessages,
  joinRoom,
  getRoomParticipants,
  listRoomChatThreads,
  createChatThread,
  leaveChatThread,
  deleteChatThread,
} = require('../controllers/roomController');

router.use(authenticate);

router.get('/', listRooms);
router.post('/', createRoom);
router.get('/code/:code', getRoomByCode);
router.post('/join/:code', joinRoom);
router.get('/:id/participants', getRoomParticipants);
router.get('/:id/chat-threads', listRoomChatThreads);
router.post('/:id/chat-threads', createChatThread);
router.delete('/:id/chat-threads/:threadId', deleteChatThread);
router.post('/:id/chat-threads/:threadId/leave', leaveChatThread);
router.get('/:id/messages', getRoomMessages);
router.get('/:id', getRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
