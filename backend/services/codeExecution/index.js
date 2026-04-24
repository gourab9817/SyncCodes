const env = require('../../config/env');

/**
 * Unified code-execution entry point.
 *
 * Executors are required lazily so that importing this module does NOT trigger
 * localExecutor.js in production (it throws on require when NODE_ENV=production).
 *
 * EXECUTION_BACKEND values:
 *   local    — run compilers on the API host (dev only, blocked in prod by env.js)
 *   piston   — forward to a self-hosted Piston container (production)
 *   disabled — always return a clear error to the client (safe fallback)
 */
async function executeCode({ language, sourceCode }) {
  const maxChars = env.execution.maxSourceChars;
  if (typeof sourceCode === 'string' && sourceCode.length > maxChars) {
    return {
      status: 400,
      body: { run: { output: '', stderr: `Source exceeds max length (${maxChars} characters)`, code: 1 } },
    };
  }

  if (env.execution.backend === 'disabled') {
    return {
      status: 503,
      body: { run: { output: '', stderr: 'Code execution is disabled on this server.', code: 1 } },
    };
  }

  if (env.execution.backend === 'piston') {
    const base = env.execution.pistonUrl;
    if (!base) {
      return {
        status: 503,
        body: {
          run: {
            output: '',
            stderr: 'EXECUTION_BACKEND=piston but PISTON_API_URL is not configured. Set it to your internal Piston URL (e.g. http://piston:2000).',
            code: 1,
          },
        },
      };
    }
    const pistonExecutor = require('./pistonExecutor');
    try {
      return await pistonExecutor.execute({ baseUrl: base, language, sourceCode });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Piston execution failed';
      return {
        status: 502,
        body: { run: { output: '', stderr: typeof msg === 'string' ? msg : JSON.stringify(msg), code: 1 } },
      };
    }
  }

  if (env.execution.backend === 'local') {
    // env.js already blocks startup with EXECUTION_BACKEND=local in production.
    // localExecutor itself has a second guard that throws on require in production.
    const localExecutor = require('./localExecutor');
    try {
      return await localExecutor.execute({ language, sourceCode });
    } catch (err) {
      return {
        status: 500,
        body: { run: { output: '', stderr: err.message || 'Local execution failed', code: 1 } },
      };
    }
  }

  return {
    status: 400,
    body: {
      run: {
        output: '',
        stderr: `Unknown EXECUTION_BACKEND: "${env.execution.backend}". Valid values: local, piston, disabled.`,
        code: 1,
      },
    },
  };
}

module.exports = { executeCode };
