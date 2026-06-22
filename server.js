const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROBLEMS_DIR = path.join(__dirname, 'problems');
const GPP_PATH = (() => {
  const envPath = process.env.GPP_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const os = require("os");
  const homeDir = os.homedir();
  const desktop = homeDir + "/Desktop";
  const candidates = ["g++", "C:/mingw64/bin/g++.exe"];
  try {
    const items = fs.readdirSync(desktop);
    for (const item of items) {
      const p = desktop + "/" + item + "/w64devkit/bin/g++.exe";
      if (fs.existsSync(p)) { candidates.unshift(p); break; }
    }
  } catch(_) {}
  for (const p of candidates) {
    try { require("child_process").execFileSync(p, ["--version"], {stdio:"pipe"}); return p; } catch(_) {}
  }
  return "g++";
})();
function loadProblems() {
  const idxPath = path.join(PROBLEMS_DIR, 'problems.json');
  if (!fs.existsSync(idxPath)) return [];
  return JSON.parse(fs.readFileSync(idxPath, 'utf-8'));
}

function loadProblem(id) {
  const pdir = path.join(PROBLEMS_DIR, id);
  const metaPath = path.join(pdir, 'problem.json');
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const testdata = [];
  const tdDir = path.join(pdir, 'testdata');
  if (fs.existsSync(tdDir)) {
    const inFiles = fs.readdirSync(tdDir).filter(f => f.endsWith('.in'));
    inFiles.sort();
    for (const f of inFiles) {
      const base = f.replace('.in', '');
      const outFile = base + '.out';
      if (fs.existsSync(path.join(tdDir, outFile))) {
        testdata.push({
          input: fs.readFileSync(path.join(tdDir, f), 'utf-8'),
          output: fs.readFileSync(path.join(tdDir, outFile), 'utf-8')
        });
      }
    }
  }
  let coverFile = 'cover.svg';
  if (!fs.existsSync(path.join(pdir, coverFile))) { coverFile = 'cover.png'; }
  if (fs.existsSync(path.join(pdir, coverFile))) meta.coverUrl = '/problem-files/' + id + '/' + coverFile;
  return { ...meta, id, testdata };
}

function gradeSubmission(code, problem) {
  if (!problem || !problem.testdata || problem.testdata.length === 0) {
    return { status: 'error', message: 'No test data' };
  }
  const tmpDir = fs.mkdtempSync(path.join(__dirname, 'tmp_'));
  const srcPath = path.join(tmpDir, 'solution.cpp');
  const exePath = path.join(tmpDir, 'solution.exe');
  fs.writeFileSync(srcPath, code);
  const gppDir = path.dirname(GPP_PATH);
  const compileEnv = Object.assign({}, process.env, { PATH: gppDir + path.delimiter + (process.env.PATH || '') });
  try {
    execFileSync(GPP_PATH, [srcPath, '-o', exePath, '-std=c++17', '-O2', '-lm'], {
      timeout: 15000, stdio: 'pipe', env: compileEnv
    });
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString()) || e.message || 'Compile error';
    cleanTmp(tmpDir);
    return { status: 'compile_error', message: stderr };
  }
  const results = [];
  for (const tc of problem.testdata) {
    try {
      const start = Date.now();
      const out = execFileSync(exePath, [], {
        input: tc.input,
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024,
        encoding: 'utf-8',
        env: compileEnv
      }).trim();
      const time = Date.now() - start;
      const expected = tc.output.trim();
      const passed = out === expected;
      results.push({ passed, actual: out, expected, time });
    } catch (e) {
      results.push({
        passed: false,
        actual: e.killed ? 'Timeout(>3s)' : (e.stdout || '').toString().trim() || 'Runtime error',
        expected: tc.output.trim(),
        time: -1
      });
    }
  }
  cleanTmp(tmpDir);
  const passed = results.filter(r => r.passed).length;
  return { status: 'done', total: results.length, passed, results };
}

function cleanTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (method === 'GET' && parsed.pathname === '/api/problems') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadProblems()));
    return;
  }
  const pm = parsed.pathname.match(/^\/api\/problems\/([^/]+)$/);
  if (method === 'GET' && pm) {
    const problem = loadProblem(pm[1]);
    if (!problem) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Problem not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: problem.id, title: problem.title,
      description: problem.description,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      sampleInput: problem.sampleInput,
      sampleOutput: problem.sampleOutput,
      testdataCount: problem.testdata.length,
      coverUrl: problem.coverUrl
    }));
    return;
  }
  if (method === 'POST' && parsed.pathname === '/api/submit') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { code, problemId } = JSON.parse(body);
        if (!code || !code.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Code cannot be empty' }));
          return;
        }
        const problem = loadProblem(problemId);
        if (!problem) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Problem not found' }));
          return;
        }
        const result = gradeSubmission(code, problem);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (method === 'POST' && parsed.pathname === '/api/problem/create') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.title || !data.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '\u6807\u9898\u548CID\u4E0D\u80FD\u4E3A\u7A7A' }));
          return;
        }
        const problemDir = path.join(PROBLEMS_DIR, data.id);
        if (fs.existsSync(problemDir)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '\u9898\u76EEID\u5DF2\u5B58\u5728' }));
          return;
        }
        fs.mkdirSync(problemDir, { recursive: true });
        fs.mkdirSync(path.join(problemDir, 'testdata'), { recursive: true });
        const meta = {
          title: data.title,
          description: data.description || '',
          inputFormat: data.inputFormat || '',
          outputFormat: data.outputFormat || '',
          sampleInput: data.sampleInput || '',
          sampleOutput: data.sampleOutput || ''
        };
        fs.writeFileSync(path.join(problemDir, 'problem.json'), JSON.stringify(meta, null, 2), 'utf-8');
        if (data.testCases && Array.isArray(data.testCases)) {
          data.testCases.forEach((tc, i) => {
            const num = i + 1;
            fs.writeFileSync(path.join(problemDir, 'testdata', num + '.in'), tc.input || '', 'utf-8');
            fs.writeFileSync(path.join(problemDir, 'testdata', num + '.out'), tc.output || '', 'utf-8');
          });
        }
        const problems = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, 'problems.json'), 'utf-8'));
        problems.push({ id: data.id, title: data.title, difficulty: data.difficulty || '\u672A\u5206\u7C7B' });
        fs.writeFileSync(path.join(PROBLEMS_DIR, 'problems.json'), JSON.stringify(problems, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: data.id }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  // Serve problem files (images)
  const pf = parsed.pathname.match(/^\/problem-files\/([^/]+)\/(.+)$/);
  if (method === 'GET' && pf) {
    const filePath = path.join(PROBLEMS_DIR, pf[1], pf[2]);
    serveStatic(res, filePath);
    return;
  }
  let filePath = path.join(PUBLIC_DIR, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('C++ Grader started at http://localhost:' + PORT);
});
