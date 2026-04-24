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
} = require('../controllers/roomController');

router.use(authenticate);

router.get('/', listRooms);
router.post('/', createRoom);
router.get('/code/:code', getRoomByCode);
router.post('/join/:code', joinRoom);
router.get('/:id', getRoom);
router.delete('/:id', deleteRoom);
router.get('/:id/messages', getRoomMessages);

module.exports = router;
