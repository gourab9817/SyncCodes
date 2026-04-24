const axios = require('axios');

const RUNTIME_CACHE_MS = 5 * 60 * 1000;
let runtimeCache = { at: 0, list: null };

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

/** Map app language key → Piston runtime.language (see GET /api/v2/runtimes) */
const LANGUAGE_HINTS = {
  javascript: ['javascript', 'node'],
  python: ['python'],
  java: ['java'],
  c: ['c'],
  cpp: ['c++', 'cpp'],
  go: ['go'],
  rust: ['rust'],
};

function pickRuntime(runtimes, lang) {
  const hints = LANGUAGE_HINTS[lang] || [lang];
  for (const hint of hints) {
    const found = runtimes.find(
      (r) =>
        r.language === hint ||
        (Array.isArray(r.aliases) && r.aliases.includes(hint))
    );
    if (found) return found;
  }
  return runtimes.find((r) => r.language === lang);
}

function buildFiles(lang, sourceCode) {
  if (lang === 'java') {
    const className = extractJavaClassName(sourceCode);
    return [
      {
        name: `${className}.java`,
        content: stripJavaPackage(sourceCode),
      },
    ];
  }
  const names = {
    javascript: 'main.js',
    python: 'main.py',
    c: 'main.c',
    cpp: 'main.cpp',
    go: 'main.go',
    rust: 'main.rs',
  };
  return [{ name: names[lang] || 'main.txt', content: sourceCode }];
}

function normalizePistonResponse(data) {
  const compile = data.compile || null;
  const run = data.run || {};
  const parts = [];

  if (compile) {
    if (compile.stderr) parts.push(`[compile]\n${compile.stderr}`);
    if (compile.stdout) parts.push(compile.stdout);
  }
  if (run.stdout) parts.push(run.stdout);
  if (run.stderr) parts.push(`[run]\n${run.stderr}`);

  const compileBad = compile && compile.code !== 0 && compile.code != null;
  const runBad = run.code !== 0 && run.code != null;
  const failed = compileBad || runBad;

  const stderr = [compile?.stderr, run?.stderr].filter(Boolean).join('\n');

  return {
    run: {
      output: parts.join('\n').trim() || (failed ? 'Execution failed' : 'No output'),
      stderr,
      code: failed ? 1 : 0,
    },
  };
}

async function fetchRuntimes(baseUrl) {
  const now = Date.now();
  if (runtimeCache.list && now - runtimeCache.at < RUNTIME_CACHE_MS) {
    return runtimeCache.list;
  }
  const { data } = await axios.get(`${baseUrl}/api/v2/runtimes`, { timeout: 10000 });
  const list = Array.isArray(data) ? data : [];
  runtimeCache = { at: now, list };
  return list;
}

/**
 * Self-hosted Piston (recommended for production).
 * Deploy: https://github.com/engineer-man/piston — never use public emkc API in prod.
 */
async function execute({ baseUrl, language, sourceCode, requestTimeoutMs = 25000 }) {
  const root = String(baseUrl).replace(/\/$/, '');
  const lang = String(language).toLowerCase();

  const runtimes = await fetchRuntimes(root);
  const rt = pickRuntime(runtimes, lang);
  if (!rt) {
    return {
      status: 400,
      body: {
        error: `No Piston runtime for "${language}". Install the language package on your Piston server (GET ${root}/api/v2/runtimes).`,
      },
    };
  }

  const payload = {
    language: rt.language,
    version: rt.version,
    files: buildFiles(lang, sourceCode),
  };

  const { data } = await axios.post(
    `${root}/api/v2/execute`,
    payload,
    { timeout: requestTimeoutMs }
  );

  return { status: 200, body: normalizePistonResponse(data) };
}

function clearRuntimeCache() {
  runtimeCache = { at: 0, list: null };
}

module.exports = { execute, clearRuntimeCache };
