const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { authenticate, optionalAuth } = require('../middleware/authenticate');
const { executeCode } = require('../services/codeExecution');

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.nodeEnv === 'production' ? 20 : 60,
  message: { error: 'Too many code runs, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authMiddleware = env.execution.requireAuth ? authenticate : optionalAuth;

router.post('/code', executeLimiter, authMiddleware, async (req, res) => {
  try {
    const { language, sourceCode } = req.body;

    if (!language || sourceCode === undefined || sourceCode === null) {
      return res.status(400).json({
        run: {
          output: '',
          stderr: 'Language and source code are required',
          code: 1,
        },
      });
    }

    const result = await executeCode({ language, sourceCode });

    if (result.status !== 200) {
      const b = result.body;
      if (b.run) return res.status(result.status).json(b);
      return res.status(result.status).json({
        run: {
          output: '',
          stderr: b.error || 'Execution request failed',
          code: 1,
        },
      });
    }

    return res.json(result.body);
  } catch (err) {
    return res.status(500).json({
      run: {
        output: '',
        stderr: err.message || 'Unexpected execution error',
        code: 1,
      },
    });
  }
});

module.exports = router;
