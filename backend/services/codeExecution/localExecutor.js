const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

// Safety guard: refuse to execute user code in production.
// The local executor runs arbitrary user code on the same host as the API server.
// In production always use EXECUTION_BACKEND=piston with an isolated Piston container.
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'localExecutor loaded in production — this is a critical misconfiguration. ' +
    'Set EXECUTION_BACKEND=piston and configure PISTON_API_URL.'
  );
}

function extractJavaClassName(source) {
  const pub = source.match(/public\s+class\s+(\w+)/);
  if (pub) return pub[1];
  const cls = source.match(/(?:^|\n)\s*class\s+(\w+)/);
  if (cls) return cls[1];
  return 'Main';
}

function stripJavaPackage(source) {
  return source.replace(/^\s*package\s+[\w.]+\s*;\s*\n?/m, '');
}

function formatRun(stdout, stderr, error, timeoutMs) {
  if (error && error.killed) {
    return {
      run: {
        output: '',
        stderr: `Execution timeout (${timeoutMs / 1000}s)`,
        code: 1,
      },
    };
  }
  const out = (stdout || '').trimEnd();
  const err = (stderr || '').trimEnd();
  const combined =
    err && out ? `${out}\n--- stderr ---\n${err}` : err || out || 'No output';
  return {
    run: {
      output: combined,
      stderr: err,
      code: error ? 1 : 0,
    },
  };
}

/**
 * Runs code on the same host as Node (dev / small deploy).
 * For production at scale, prefer pistonExecutor + isolated Piston service.
 */
async function execute({ language, sourceCode, timeoutMs = 15000 }) {
  const workDir = path.join(
    os.tmpdir(),
    `sc_exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  await fs.mkdir(workDir, { recursive: true });

  const lang = String(language).toLowerCase();
  let cmd;

  try {
    if (lang === 'javascript') {
      await fs.writeFile(path.join(workDir, 'main.js'), sourceCode);
      cmd = `cd "${workDir}" && node main.js`;
    } else if (lang === 'python') {
      await fs.writeFile(path.join(workDir, 'main.py'), sourceCode);
      cmd = `cd "${workDir}" && python3 main.py`;
    } else if (lang === 'java') {
      const className = extractJavaClassName(sourceCode);
      const body = stripJavaPackage(sourceCode);
      await fs.writeFile(path.join(workDir, `${className}.java`), body);
      cmd = `cd "${workDir}" && javac "${className}.java" && java "${className}"`;
    } else if (lang === 'c') {
      await fs.writeFile(path.join(workDir, 'main.c'), sourceCode);
      cmd = `cd "${workDir}" && gcc -o main_c_out main.c && ./main_c_out`;
    } else if (lang === 'cpp') {
      await fs.writeFile(path.join(workDir, 'main.cpp'), sourceCode);
      cmd = `cd "${workDir}" && g++ -std=c++17 -o main_cpp_out main.cpp && ./main_cpp_out`;
    } else if (lang === 'go') {
      await fs.writeFile(path.join(workDir, 'main.go'), sourceCode);
      cmd = `cd "${workDir}" && go run main.go`;
    } else if (lang === 'rust') {
      await fs.writeFile(path.join(workDir, 'main.rs'), sourceCode);
      cmd = `cd "${workDir}" && rustc -o main_rs_out main.rs && ./main_rs_out`;
    } else {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      return {
        status: 400,
        body: {
          error: `Unsupported language: ${language}. Supported: javascript, python, java, c, cpp, go, rust`,
        },
      };
    }

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return { status: 200, body: formatRun(stdout, stderr, null, timeoutMs) };
  } catch (error) {
    return {
      status: 200,
      body: formatRun(
        error.stdout,
        error.stderr,
        error,
        timeoutMs
      ),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { execute };
