const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const { getMe, updateMe, getStats, registerPublicKey } = require('../controllers/userController');

router.use(authenticate);

router.get('/me', getMe);
router.put('/me', updateMe);
router.get('/me/stats', getStats);
router.put('/me/public-key', registerPublicKey);

module.exports = router;
