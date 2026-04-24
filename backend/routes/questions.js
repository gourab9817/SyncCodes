const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/authenticate');
const { generate } = require('../controllers/questionController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF and DOCX files allowed'));
  },
});

router.post('/generate', authenticate, upload.single('resume'), generate);

// Legacy alias kept for backwards compatibility with existing frontend
router.post('/generate-questions', authenticate, upload.single('resume'), generate);

module.exports = router;
