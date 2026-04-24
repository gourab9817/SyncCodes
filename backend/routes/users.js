const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const { getMe, updateMe, getStats } = require('../controllers/userController');

router.use(authenticate);

router.get('/me', getMe);
router.put('/me', updateMe);
router.get('/me/stats', getStats);

module.exports = router;
