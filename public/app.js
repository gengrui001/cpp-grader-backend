let currentProblem = null;

async function init() {
  document.getElementById('resultPanel').style.display = 'none';
  const resp = await fetch('/api/problems');
  const problems = await resp.json();
  const sel = document.getElementById('problemSelect');
  for (const p of problems) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = '[' + p.difficulty + '] ' + p.title;
    sel.appendChild(opt);
  }
  if (problems.length > 0) {
    sel.value = problems[0].id;
    loadProblem(problems[0].id);
  }
}

async function loadProblem(id) {
  if (!id) return;
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('resultPanel').classList.add('hidden');

  const resp = await fetch('/api/problems/' + id);
  currentProblem = await resp.json();

  document.getElementById('problemTitle').textContent = currentProblem.title;
  if (currentProblem.coverUrl) {
    document.getElementById('problemCover').src = currentProblem.coverUrl;
    document.getElementById('problemCover').style.display = 'block';
    document.getElementById('problemBody').innerHTML = '';
  } else {
    document.getElementById('problemCover').style.display = 'none';
  }
  document.getElementById("submitBtn").disabled = false; if (currentProblem.coverUrl) { return; }
  const body = document.getElementById('problemBody');
  body.innerHTML =
    '<div class="section"><span class="label">\u\u \u7f16\u8bd1\u9519\u8bef</span><p>' + esc(currentProblem.description) + '</p></div>' +
    '<div class="section"><span class="label">\u\u \u7f16\u8bd1\u9519\u8bef</span><p>' + esc(currentProblem.inputFormat) + '</p></div>' +
    '<div class="section"><span class="label">\u\u \u7f16\u8bd1\u9519\u8bef</span><p>' + esc(currentProblem.outputFormat) + '</p></div>' +
    '<div class="section"><span class="label">\u\u \u7f16\u8bd1\u9519\u8bef</span><pre>' + esc(currentProblem.sampleInput) + '</pre></div>' +
    '<div class="section"><span class="label">\u\u \u7f16\u8bd1\u9519\u8bef</span><pre>' + esc(currentProblem.sampleOutput) + '</pre></div>' +
    '<div class="section"><span class="label">\u\u \u6d4b\u8bd5\u70b9</span><p>' + currentProblem.testdataCount + ' ?</p></div>';
  document.getElementById('submitBtn').disabled = false;
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function submitCode() {
  const code = document.getElementById('codeEditor').value;
  if (!code.trim()) { alert('\u\u\u\u\u!'); return; }
  if (!currentProblem) { alert('\u\u\u\u\u\u!'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '\u \u6d4b\u8bd5\u70b9...';
  document.getElementById('resultPanel').classList.remove('hidden');
  document.getElementById('resultSummary').innerHTML = '\u7f16\u8bd1\u9519\u8bef\u9519\u8bef...';
  document.getElementById('resultDetails').innerHTML = '';

  try {
    const resp = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, problemId: currentProblem.id })
    });
    const result = await resp.json();

    if (result.status === 'compile_error') {
      document.getElementById('resultSummary').innerHTML =
        '<span class="summary-fail">\u \u7f16\u8bd1\u9519\u8bef</span>';
      document.getElementById('resultDetails').innerHTML =
        '<div class="compile-error">' + esc(result.message || '') + '</div>';
    } else if (result.status === 'error') {
      document.getElementById('resultSummary').innerHTML =
        '<span class="summary-fail">\u \u9519\u8bef</span>';
      document.getElementById('resultDetails').innerHTML =
        '<div class="compile-error">' + esc(result.message || '') + '</div>';
    } else {
      const allPassed = result.passed === result.total;
      document.getElementById('resultSummary').innerHTML =
        '<span class="' + (allPassed ? 'summary-pass' : 'summary-fail') + '">' +
        (allPassed ? '\u' : '\u') + ' \u9519\u8bef ' + result.passed + '/' + result.total + ' \u7f16\u8bd1\u9519\u8bef</span>';

      let html = '';
      result.results.forEach((r, i) => {
        const pass = r.passed;
        html += '<div class="testcase-row">' +
          '<span class="status ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '\u' : '\u') + '</span>' +
          '<span>\u6d4b\u8bd5\u70b9 #' + (i + 1) + '</span>' +
          '<span class="detail-toggle" onclick="toggleDetail(' + i + ')">' +
          (r.time >= 0 ? r.time + 'ms ' : '') + '\u \u9519\u8bef</span></div>' +
          '<div id="detail-' + i + '" class="testcase-detail">' +
          '<div class="label">\u7f16\u8bd1\u9519\u8bef:</div><div>' + esc(r.expected) + '</div>' +
          '<div class="label">\u7f16\u8bd1\u9519\u8bef:</div><div>' + esc(r.actual) + '</div></div>';
      });
      document.getElementById('resultDetails').innerHTML = html;
    }
  } catch (e) {
    document.getElementById('resultSummary').innerHTML =
      '<span class="summary-fail">\u \u7f16\u8bd1\u9519\u8bef</span>';
    document.getElementById('resultDetails').innerHTML =
      '<div class="compile-error">\u7f16\u8bd1\u9519\u8bef: ' + esc(e.message) + '</div>';
  }

  btn.disabled = false;
  btn.textContent = '\u\u \u7f16\u8bd1\u9519\u8bef';
}

function toggleDetail(i) {
  document.getElementById('detail-' + i).classList.toggle('show');
}

window.addEventListener('DOMContentLoaded', init);

// === Add Problem UI ===
let testCaseCount = 0;

function showAddProblem() {
  document.getElementById("addModal").style.display = "flex";
}

function hideAddProblem() {
  document.getElementById("addModal").style.display = "none";
}

function addTestCase(inputVal, outputVal) {
  testCaseCount++;
  const div = document.getElementById("testcases");
  const html = '<div class="testcase-item" id="tc-' + testCaseCount + '">' +
    '<span class="tc-remove" onclick="removeTestCase(' + testCaseCount + ')">&times;</span>' +
    '<div class="tc-label">\u\u\u #' + testCaseCount + ' \u\u</div>' +
    '<textarea id="tcin-' + testCaseCount + '" rows="2">' + (inputVal || "") + '</textarea>' +
    '<div class="tc-label" style="margin-top:6px">\u\u\u\u</div>' +
    '<textarea id="tcout-' + testCaseCount + '" rows="2">' + (outputVal || "") + '</textarea>' +
    "</div>";
  div.insertAdjacentHTML("beforeend", html);
}

function removeTestCase(id) {
  const el = document.getElementById("tc-" + id);
  if (el) el.remove();
}

async function createProblem() {
  const data = {
    id: document.getElementById("fid").value.trim(),
    title: document.getElementById("ftitle").value.trim(),
    difficulty: document.getElementById("fdiff").value,
    description: document.getElementById("fdesc").value.trim(),
    inputFormat: document.getElementById("finfmt").value.trim(),
    outputFormat: document.getElementById("foutfmt").value.trim(),
    sampleInput: document.getElementById("fsin").value,
    sampleOutput: document.getElementById("fsout").value,
    testCases: []
  };

  if (!data.id || !data.title) {
    alert('\u\u\u\u\uID\u\u\u');
    return;
  }

  // Collect test cases
  for (let i = 1; i <= testCaseCount; i++) {
    const inp = document.getElementById("tcin-" + i);
    const out = document.getElementById("tcout-" + i);
    if (inp && out) {
      data.testCases.push({ input: inp.value, output: out.value });
    }
  }

  try {
    const resp = await fetch("/api/problem/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await resp.json();
    if (result.success) {
      alert("\u\u " + data.title + " \u\u\u\u!");
      hideAddProblem();
      // Reload problems
      const sel = document.getElementById("problemSelect");
      const r = await fetch("/api/problems");
      const problems = await r.json();
      while (sel.options.length > 1) sel.remove(1);
      for (const p of problems) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = "[" + p.difficulty + "] " + p.title;
        sel.appendChild(opt);
      }
      sel.value = data.id;
      loadProblem(data.id);
    } else {
      alert("\u7f16\u8bd1\u9519\u8bef: " + (result.error || "\u\u\u\u"));
    }
  } catch (e) {
    alert("\u\u\u\u: " + e.message);
  }
}
