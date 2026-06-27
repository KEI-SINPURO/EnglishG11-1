// js/app.js — メインアプリケーションロジック
// ================================================================
// 期末テスト配分
//   英単語      15問 × 1点 = 15点
//   四択問題    10問 × 2点 = 20点
//   穴埋め問題  10問 × 2点 = 20点
//   並び替え問題  5問 × 3点 = 15点
//   ライティング  5問 × 3点 = 15点
//   ひねり問題    5問 × 3点 = 15点
//   合計                    100点
// ================================================================

// ── STATE ────────────────────────────────────────────────────────
let totalXP   = 0;
let quizState = {};
let examState = null;
let vqState   = { idx:0, score:0, answered:false, finished:false };
let vqBank    = [];

// ── UTILS ─────────────────────────────────────────────────────────
const shuffle    = arr => [...arr].sort(() => Math.random() - .5);
const pickRandom = (arr, n) => shuffle(arr).slice(0, n);
const addXP      = n => { totalXP += n; document.getElementById('xpBadge').textContent = totalXP + ' XP'; };

// ── ページ切替 ────────────────────────────────────────────────────
function switchPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('act'));
  document.getElementById('page-' + name).classList.add('act');
  document.querySelectorAll('.ntb').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  if (name === 'vocab') renderVocab();
  if (name === 'exam')  renderExamHome();
}

// ================================================================
// 文法レッスン
// ================================================================
function showLesson(id, btn) {
  document.querySelectorAll('.lb').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderLesson(id);
}

function renderLesson(id) {
  const L = LESSONS_DATA[id];
  if (!quizState[id]) quizState[id] = { idx:0, score:0, answered:false, finished:false };

  const secHtml = L.sections.map(sec => {
    const pts = sec.pts.map(p => {
      const note = p.note ? `<div class="ex-note">${p.note}</div>` : '';
      return `<div class="ex">
        <div class="ex-en">${p.en}</div>
        <div class="ex-jp">🇯🇵 ${p.jp}</div>
        ${note}
      </div>`;
    }).join('');
    const tips = (sec.tips && sec.tips.length)
      ? `<div class="tips-box">${sec.tips.map(t => `<p>${t}</p>`).join('')}</div>` : '';
    const form = sec.formula ? `<div class="formula">${sec.formula}</div>` : '';
    return `<div class="gsec">
      <div class="gsec-title"><span class="gbadge">${sec.badge}</span>${sec.title}</div>
      ${form}${pts}${tips}
    </div>`;
  }).join('');

  document.getElementById('grammarMain').innerHTML = `
    <div class="lcard">
      <div class="lhdr" style="background:linear-gradient(135deg,${L.color},${L.color}cc)">
        <div class="lhdr-label">Lesson ${L.num}</div>
        <div class="lhdr-title">${L.title}<span class="jp">${L.jp}</span></div>
        <div class="lhdr-desc">${L.desc}</div>
      </div>
      <div class="tab-bar">
        <button class="tbtn act" onclick="switchTab(this,'st-${id}')">📖 解説</button>
        <button class="tbtn"     onclick="switchTab(this,'qz-${id}')">✏️ 確認テスト</button>
        <button class="tbtn"     onclick="switchTab(this,'ai-${id}')">🤖 AI質問</button>
      </div>
      <div class="tc act" id="st-${id}">${secHtml}</div>
      <div class="tc"     id="qz-${id}">${renderQuiz(id)}</div>
      <div class="tc"     id="ai-${id}">${renderAI(id)}</div>
    </div>`;
}

function switchTab(btn, tabId) {
  const card = btn.closest('.lcard');
  card.querySelectorAll('.tbtn').forEach(b => b.classList.remove('act'));
  card.querySelectorAll('.tc').forEach(c   => c.classList.remove('act'));
  btn.classList.add('act');
  document.getElementById(tabId).classList.add('act');
}

// ================================================================
// クイズ
// ================================================================
const TYPE_LABEL = { mc:'四択問題', fill:'穴埋め問題', sort:'並び替え問題', write:'ライティング問題', twist:'ひねり問題' };
const TYPE_CLS   = { mc:'tb-mc', fill:'tb-fill', sort:'tb-sort', write:'tb-write', twist:'tb-twist' };

function renderQuiz(id) {
  const qs = QUIZ_BANK[id] || [];
  const st = quizState[id];
  if (!st || st.finished) return renderQuizResult(id);

  const q   = qs[st.idx];
  const pct = Math.round(st.idx / qs.length * 100);
  const star = '⭐'.repeat(q.diff);

  let ansHtml = '';
  if (q.type === 'mc') {
    // 選択肢を毎回シャッフル
    const indexed        = q.opts.map((o, i) => ({ o, i }));
    const shuffledIdx    = shuffle(indexed);
    const correctShuffled = shuffledIdx.findIndex(x => x.i === q.ans);
    ansHtml = `<div class="qopts">${shuffledIdx.map((item, si) => `
      <button class="qopt" onclick="answerMC('${id}',${si},${correctShuffled})">
        <span class="opt-ind">${String.fromCharCode(65 + si)}</span>${item.o}
      </button>`).join('')}</div>`;

  } else if (q.type === 'fill') {
    const blanks = (q.blank.match(/_+/g) || []).length;
    let inp = '';
    for (let i = 0; i < blanks; i++)
      inp += `<input class="fill-input" id="fi-${id}-${i}" placeholder="答えを入力..." />`;
    ansHtml = `${inp}<button class="submit-btn" onclick="answerFill('${id}')">確認</button>`;

  } else if (q.type === 'sort') {
    const sw = shuffle([...q.words]);
    ansHtml = `
      <div class="slot-lbl">単語バンク（クリックで追加）</div>
      <div class="sort-bank" id="bank-${id}">
        ${sw.map(w => `<button class="chip" onclick="moveChip('${id}',this,'slot')" data-word="${w}">${w}</button>`).join('')}
      </div>
      <div class="slot-lbl">回答欄（クリックで戻す）</div>
      <div class="sort-slot" id="slot-${id}"></div>
      <button class="submit-btn" onclick="answerSort('${id}')">確認</button>`;

  } else {
    ansHtml = `
      <textarea class="write-area" id="wa-${id}" placeholder="英文を入力してください..."></textarea>
      <button class="submit-btn" onclick="answerWrite('${id}')">確認する</button>`;
  }

  return `
    <div class="qprog">
      <span class="qcnt">問 ${st.idx + 1} / ${qs.length}</span>
      <div class="pbar-wrap"><div class="pbar" style="width:${pct}%"></div></div>
      <span class="score-bdg">${st.score} 正解</span>
    </div>
    <div class="qcard">
      <div class="qlbl">Q${st.idx + 1} ${star}</div>
      <span class="qtbadge ${TYPE_CLS[q.type]}">${TYPE_LABEL[q.type]}</span>
      <div class="qtext">${q.q}</div>
      ${q.blank ? `<div class="qsub">${q.blank}</div>` : ''}
      ${ansHtml}
      <div class="qfb" id="qfb-${id}"></div>
    </div>
    <div class="qnav"><button class="btn-next" id="qnext-${id}" onclick="nextQ('${id}')">次の問題 →</button></div>`;
}

function renderQuizResult(id) {
  const qs = QUIZ_BANK[id] || [];
  const st = quizState[id];
  if (!st || !st.finished) return '<div style="text-align:center;color:var(--muted);padding:20px;">読み込み中...</div>';
  const pct   = Math.round(st.score / qs.length * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪';
  const msg   = pct >= 80 ? '素晴らしい！完璧に理解しています！'
              : pct >= 60 ? 'よくできました！苦手な箇所を復習しよう。'
              : '解説を読んでもう一度チャレンジしてみよう！';
  return `<div class="result vis">
    <div class="result-emoji">${emoji}</div>
    <div class="result-score">${st.score} / ${qs.length}</div>
    <div class="result-msg">${msg}（正解率 ${pct}%）</div>
    <button class="btn-retry"     onclick="retryQuiz('${id}')">🔄 もう一度</button>
    <button class="btn-retry sec" onclick="switchTabForId('st-${id}')">📖 解説を見る</button>
  </div>`;
}

function renderAI(id) {
  const L = LESSONS_DATA[id];
  return `<div class="ai-area">
    <div class="ai-title">🤖 AIに質問する</div>
    <div class="ai-desc">「${L.title}」について何でも質問してください。英作文の添削・例文の説明・応用問題などOK！</div>
    <div class="ai-row">
      <textarea class="ai-input" id="aii-${id}" rows="2" placeholder="例：「as if の後ろはなぜ過去形？」「この英文を添削して」など"></textarea>
      <button class="ai-btn" onclick="askAI('${id}')">送信 →</button>
    </div>
    <div class="ai-loading" id="ail-${id}">
      <div class="dp"><span></span><span></span><span></span></div>AIが回答中...
    </div>
    <div class="ai-resp" id="air-${id}"></div>
  </div>`;
}

// ── クイズ回答ハンドラ ────────────────────────────────────────────
function showFeedback(id, correct, exp, model) {
  const fb  = document.getElementById(`qfb-${id}`);
  const btn = document.getElementById(`qnext-${id}`);
  if (!fb || !btn) return;
  fb.className = `qfb ${correct ? 'ok' : 'ng'} vis`;
  const modelTxt = model ? `<br><br>📝 <strong>模範解答：</strong>${model}` : '';
  fb.innerHTML = `<strong>${correct ? '✅ 正解！' : '❌ 不正解'}</strong>${exp}${modelTxt}`;
  btn.classList.add('vis');
  const st = quizState[id];
  if (correct) { st.score++; addXP(10); }
  st.answered = true;
}

function answerMC(id, selectedIdx, correctIdx) {
  if (quizState[id].answered) return;
  const q = QUIZ_BANK[id][quizState[id].idx];
  document.querySelectorAll(`#qz-${id} .qopt`).forEach((b, i) => {
    b.disabled = true;
    if (i === correctIdx)                         b.classList.add('ok');
    else if (i === selectedIdx && i !== correctIdx) b.classList.add('ng');
  });
  showFeedback(id, selectedIdx === correctIdx, q.exp, null);
}

function answerFill(id) {
  if (quizState[id].answered) return;
  const q       = QUIZ_BANK[id][quizState[id].idx];
  const answers = Array.isArray(q.ans) ? q.ans : [q.ans];
  const blanks  = (q.blank.match(/_+/g) || []).length;
  let allOk = true;
  for (let i = 0; i < blanks; i++) {
    const el  = document.getElementById(`fi-${id}-${i}`);
    if (!el) continue;
    const val = el.value.trim().toLowerCase();
    const ca  = answers[i] ? (Array.isArray(answers[i]) ? answers[i] : [answers[i]]) : [answers[0]];
    const ok  = ca.some(a => val === a.toLowerCase());
    el.classList.add(ok ? 'ok' : 'ng');
    el.disabled = true;
    if (!ok) allOk = false;
  }
  showFeedback(id, allOk, q.exp, null);
}

function moveChip(id, btn, dir) {
  if (dir === 'slot') {
    document.getElementById(`slot-${id}`).appendChild(btn);
    btn.onclick = () => moveChip(id, btn, 'bank');
    btn.classList.add('placed');
  } else {
    document.getElementById(`bank-${id}`).appendChild(btn);
    btn.onclick = () => moveChip(id, btn, 'slot');
    btn.classList.remove('placed');
  }
}

function answerSort(id) {
  if (quizState[id].answered) return;
  const q     = QUIZ_BANK[id][quizState[id].idx];
  const chips = document.getElementById(`slot-${id}`).querySelectorAll('.chip');
  const ans   = Array.from(chips).map(c => c.dataset.word).join(' ');
  const ok    = ans.toLowerCase() === q.ans.toLowerCase();
  chips.forEach(c => { c.disabled = true; });
  showFeedback(id, ok, q.exp, ok ? null : q.ans);
}

function answerWrite(id) {
  if (quizState[id].answered) return;
  const q   = QUIZ_BANK[id][quizState[id].idx];
  const val = (document.getElementById(`wa-${id}`)?.value || '').trim();
  addXP(5);
  quizState[id].answered = true;
  const fb  = document.getElementById(`qfb-${id}`);
  const btn = document.getElementById(`qnext-${id}`);
  if (fb) {
    fb.className = 'qfb ok vis';
    fb.innerHTML = `<strong>📝 あなたの回答：</strong>${val}<br><br>` +
                   `<strong>✅ 模範解答：</strong>${q.model}<br><br>` +
                   `<strong>💡 解説：</strong>${q.exp}`;
  }
  if (btn) btn.classList.add('vis');
}

function nextQ(id) {
  const qs = QUIZ_BANK[id];
  const st = quizState[id];
  if (st.idx < qs.length - 1) { st.idx++; st.answered = false; }
  else st.finished = true;
  const tab = document.getElementById(`qz-${id}`);
  if (tab) tab.innerHTML = renderQuiz(id);
}

function retryQuiz(id) {
  quizState[id] = { idx:0, score:0, answered:false, finished:false };
  const tab = document.getElementById(`qz-${id}`);
  if (tab) tab.innerHTML = renderQuiz(id);
}

function switchTabForId(tabId) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  const card = tab.closest('.lcard');
  card.querySelectorAll('.tbtn').forEach(b => b.classList.remove('act'));
  card.querySelectorAll('.tc').forEach(c   => c.classList.remove('act'));
  card.querySelectorAll('.tbtn')[0].classList.add('act');
  tab.classList.add('act');
}

// ================================================================
// AI質問
// ================================================================
async function askAI(id) {
  const L      = LESSONS_DATA[id];
  const input  = document.getElementById(`aii-${id}`);
  const loading= document.getElementById(`ail-${id}`);
  const resp   = document.getElementById(`air-${id}`);
  const btn    = input?.closest('.ai-area')?.querySelector('.ai-btn');
  const q      = input?.value.trim();
  if (!q) { input?.focus(); return; }

  if (btn) btn.disabled = true;
  if (loading) loading.classList.add('vis');
  if (resp)  { resp.classList.remove('vis'); resp.textContent = ''; }

  const sys = `あなたは日本人高校生向けの英文法専門の先生です。` +
    `今学習中のレッスン：Lesson ${L.num}「${L.title}（${L.jp}）」。` +
    `日本語でわかりやすく、具体的な例文を使い、なぜその形になるかの理由も説明してください。` +
    `英作文の添削の場合は誤りを指摘し正しい形と理由を説明してください。回答は簡潔にまとめてください。`;

  try {
    const res  = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1000,
        system: sys,
        messages: [{ role: "user", content: q }]
      })
    });
    const data = await res.json();
    const text = data.content?.map(c => c.text || '').join('') || '回答を取得できませんでした。';
    if (resp) { resp.textContent = text; resp.classList.add('vis'); }
    addXP(5);
  } catch (e) {
    if (resp) { resp.textContent = '⚠️ 通信エラーが発生しました。もう一度お試しください。'; resp.classList.add('vis'); }
  }
  if (loading) loading.classList.remove('vis');
  if (btn) btn.disabled = false;
}

// ================================================================
// 単語ページ
// ================================================================
let vocabFilter = '';
let vocabSort   = 'num';

function renderVocab() {
  const grid = buildVocabGrid(getFilteredVocab());
  document.getElementById('vocabContent').innerHTML = `
    <div class="vocab-notice">
      ⚠️ <strong>登録範囲：</strong>システム英単語5訂版 <strong>1001〜1300</strong>（300語）。
      「新」マークは5訂版で新たに追加された単語です。
    </div>
    <div class="vocab-header">
      <h2>📝 システム英単語 5訂版（1001–1300）</h2>
      <p>全300語収録。検索・絞り込みで効率よく学習しましょう。</p>
    </div>
    <div class="vocab-search">
      <input type="text" placeholder="英単語・日本語で検索..." oninput="filterVocab(this.value)" />
      <select onchange="sortVocab(this.value)">
        <option value="num">番号順</option>
        <option value="en">英語順 (A–Z)</option>
        <option value="jp">日本語順</option>
        <option value="new">新単語のみ</option>
      </select>
    </div>
    <div id="vocabGrid" class="vocab-grid">${grid}</div>
    <div class="vocab-quiz-area">
      <div class="qlbl" style="margin-bottom:10px;">🎯 単語確認クイズ（全 ${VOCAB.length} 問）</div>
      <div id="vocabQuizContent">${renderVocabQuiz()}</div>
    </div>`;
}

function buildVocabGrid(arr) {
  return arr.map(v => `
    <div class="vc">
      <div class="vc-num">No. ${v.id}${v.isNew ? '<span class="vc-new">新</span>' : ''}</div>
      <div class="vc-en">${v.en}</div>
      <div class="vc-jp">${v.jp}</div>
    </div>`).join('');
}

function getFilteredVocab() {
  let arr = [...VOCAB];
  if (vocabFilter) arr = arr.filter(v =>
    v.en.toLowerCase().includes(vocabFilter.toLowerCase()) || v.jp.includes(vocabFilter));
  if      (vocabSort === 'en')  arr.sort((a, b) => a.en.localeCompare(b.en));
  else if (vocabSort === 'jp')  arr.sort((a, b) => a.jp.localeCompare(b.jp));
  else if (vocabSort === 'new') arr = arr.filter(v => v.isNew);
  else arr.sort((a, b) => a.id - b.id);
  return arr;
}

function filterVocab(val) {
  vocabFilter = val;
  const grid = document.getElementById('vocabGrid');
  if (grid) grid.innerHTML = buildVocabGrid(getFilteredVocab());
}

function sortVocab(val) {
  vocabSort = val;
  filterVocab(vocabFilter);
}

// ── 単語クイズ ─────────────────────────────────────────────────────
function buildVQBank() {
  return shuffle(VOCAB).map(v => {
    const wrongs = VOCAB.filter(x => x.id !== v.id).sort(() => Math.random() - .5).slice(0, 3).map(x => x.jp);
    const opts   = shuffle([v.jp, ...wrongs]);
    return { q: `次の英単語の意味は？\n「${v.en}」`, opts, ans: v.jp, exp: `${v.en}：${v.jp}` };
  });
}

function renderVocabQuiz() {
  if (!vqBank.length) vqBank = buildVQBank();
  if (vqState.finished) {
    const pct = Math.round(vqState.score / vqBank.length * 100);
    return `<div class="result vis">
      <div class="result-emoji">${pct >= 80 ? '🏆' : '💪'}</div>
      <div class="result-score">${vqState.score} / ${vqBank.length}</div>
      <div class="result-msg">正解率 ${pct}%</div>
      <button class="btn-retry" onclick="retryVQ()">🔄 もう一度</button>
    </div>`;
  }
  const q   = vqBank[vqState.idx];
  const pct = Math.round(vqState.idx / vqBank.length * 100);
  return `
    <div class="qprog">
      <span class="qcnt">問 ${vqState.idx + 1} / ${vqBank.length}</span>
      <div class="pbar-wrap"><div class="pbar" style="width:${pct}%"></div></div>
      <span class="score-bdg">${vqState.score} 正解</span>
    </div>
    <div class="qcard">
      <div class="qlbl">単語クイズ</div>
      <div class="qtext">${q.q}</div>
      <div class="qopts">${q.opts.map((o, i) => `
        <button class="qopt" onclick="answerVQ(${i})">
          <span class="opt-ind">${String.fromCharCode(65 + i)}</span>${o}
        </button>`).join('')}</div>
      <div class="qfb" id="vqfb"></div>
    </div>
    <div class="qnav"><button class="btn-next" id="vqnext" onclick="nextVQ()">次の問題 →</button></div>`;
}

function answerVQ(idx) {
  if (vqState.answered) return;
  vqState.answered = true;
  const q       = vqBank[vqState.idx];
  const correct = q.opts[idx] === q.ans;
  document.querySelectorAll('#vocabQuizContent .qopt').forEach((b, i) => {
    b.disabled = true;
    if (q.opts[i] === q.ans) b.classList.add('ok');
    else if (i === idx && !correct) b.classList.add('ng');
  });
  const fb  = document.getElementById('vqfb');
  const btn = document.getElementById('vqnext');
  if (fb)  { fb.className = `qfb ${correct ? 'ok' : 'ng'} vis`; fb.innerHTML = `<strong>${correct ? '✅ 正解！' : '❌ 不正解'}</strong>${q.exp}`; }
  if (btn) btn.classList.add('vis');
  if (correct) { vqState.score++; addXP(10); }
}

function nextVQ() {
  if (vqState.idx < vqBank.length - 1) { vqState.idx++; vqState.answered = false; }
  else vqState.finished = true;
  document.getElementById('vocabQuizContent').innerHTML = renderVocabQuiz();
}

function retryVQ() {
  vqBank  = buildVQBank();
  vqState = { idx:0, score:0, answered:false, finished:false };
  document.getElementById('vocabQuizContent').innerHTML = renderVocabQuiz();
}

// ================================================================
// 期末テスト
// ================================================================
const EXAM_CFG = {
  vocab: { count:15, pts:1 },  // 15問×1点=15点
  mc:    { count:10, pts:2 },  // 10問×2点=20点
  fill:  { count:10, pts:2 },  // 10問×2点=20点
  sort:  { count:5,  pts:3 },  //  5問×3点=15点
  write: { count:5,  pts:3 },  //  5問×3点=15点
  twist: { count:5,  pts:3 },  //  5問×3点=15点
  total: 100
};

function renderExamHome() {
  document.getElementById('examContent').innerHTML = `
    <div class="exam-home">
      <h2>📋 期末テスト（ランダム生成）</h2>
      <p>毎回ランダムに問題・選択肢が変わります。全10レッスン＋単語から出題。満点100点！</p>
      <div class="exam-stats">
        <div class="estat"><div class="estat-num">15問</div><div class="estat-pts">×1点</div><div class="estat-lbl">英単語</div></div>
        <div class="estat"><div class="estat-num">10問</div><div class="estat-pts">×2点</div><div class="estat-lbl">四択問題</div></div>
        <div class="estat"><div class="estat-num">10問</div><div class="estat-pts">×2点</div><div class="estat-lbl">穴埋め問題</div></div>
        <div class="estat"><div class="estat-num">5問</div><div class="estat-pts">×3点</div><div class="estat-lbl">並び替え</div></div>
        <div class="estat"><div class="estat-num">5問</div><div class="estat-pts">×3点</div><div class="estat-lbl">ライティング</div></div>
        <div class="estat"><div class="estat-num">5問</div><div class="estat-pts">×3点</div><div class="estat-lbl">ひねり問題</div></div>
      </div>
      <button class="start-btn" onclick="startExam()">🎯 テストを開始する</button>
    </div>`;
}

function startExam() {
  const allQ = { mc:[], fill:[], sort:[], write:[], twist:[] };
  Object.values(QUIZ_BANK).forEach(qs => qs.forEach(q => { if (allQ[q.type]) allQ[q.type].push(q); }));

  // 単語問題（毎回シャッフルした選択肢）
  const vqAll = VOCAB.map(v => {
    const wrongs = VOCAB.filter(x => x.id !== v.id).sort(() => Math.random() - .5).slice(0, 3).map(x => x.jp);
    const opts   = shuffle([v.jp, ...wrongs]);
    return { q:`次の英単語の意味は？\n「${v.en}」`, opts, ans:v.jp, exp:`${v.en}：${v.jp}` };
  });

  examState = {
    vocabQs: pickRandom(vqAll,    EXAM_CFG.vocab.count),
    mcQs:    pickRandom(allQ.mc,  EXAM_CFG.mc.count),
    fillQs:  pickRandom(allQ.fill,EXAM_CFG.fill.count),
    sortQs:  pickRandom(allQ.sort,EXAM_CFG.sort.count),
    writeQs: pickRandom(allQ.write,EXAM_CFG.write.count),
    twistQs: pickRandom(allQ.twist,EXAM_CFG.twist.count),
    answers: {},
    submitted: false
  };
  renderExamPaper();
}

function renderExamPaper() {
  const es = examState;
  const SC = { vocab:'#3d52a0', mc:'#5563a8', fill:'#28a745', sort:'#fd7e14', write:'#dc3545', twist:'#6b4c9e' };

  // 英単語セクション（選択肢シャッフル済み）
  const vocabItems = es.vocabQs.map((q, i) => `
    <div class="eqi" id="eq-vocab-${i}">
      <div class="eqi-lbl">英単語 第${i+1}問（1点）</div>
      <div class="eqi-txt">${q.q}</div>
      <div class="exam-opts">${q.opts.map((o, oi) => `
        <button class="exam-opt" onclick="selExamOpt('vocab',${i},${oi},this)">
          <span class="eoi">${String.fromCharCode(65+oi)}</span>${o}
        </button>`).join('')}</div>
      <div class="efb" id="efb-vocab-${i}"></div>
    </div>`).join('');

  // 四択セクション（選択肢を毎回シャッフル・正解インデックスをdata属性に保存）
  const mcItems = es.mcQs.map((q, i) => {
    const indexed = q.opts.map((o, oi) => ({ o, oi }));
    const sh      = shuffle(indexed);
    const corrSh  = sh.findIndex(x => x.oi === q.ans);
    return `
      <div class="eqi" id="eq-mc-${i}">
        <div class="eqi-lbl">四択問題 第${i+1}問（2点）</div>
        <div class="eqi-txt">${q.q}${q.blank ? '\n' + q.blank : ''}</div>
        <div class="exam-opts" data-correct="${corrSh}">
          ${sh.map((item, si) => `
            <button class="exam-opt" onclick="selExamOpt('mc',${i},${si},this)">
              <span class="eoi">${String.fromCharCode(65+si)}</span>${item.o}
            </button>`).join('')}
        </div>
        <div class="efb" id="efb-mc-${i}"></div>
      </div>`;
  }).join('');

  // 穴埋めセクション
  const fillItems = es.fillQs.map((q, i) => {
    const blanks = (q.blank.match(/_+/g) || []).length;
    let inp = '';
    for (let b = 0; b < blanks; b++)
      inp += `<input class="exam-input" id="efi-fill-${i}-${b}" placeholder="答えを入力..." />`;
    return `
      <div class="eqi" id="eq-fill-${i}">
        <div class="eqi-lbl">穴埋め問題 第${i+1}問（2点）</div>
        <div class="eqi-txt">${q.q}\n${q.blank}</div>
        ${inp}
        <div class="efb" id="efb-fill-${i}"></div>
      </div>`;
  }).join('');

  // 並び替えセクション（単語をシャッフル）
  const sortItems = es.sortQs.map((q, i) => {
    const sw = shuffle([...q.words]);
    return `
      <div class="eqi" id="eq-sort-${i}">
        <div class="eqi-lbl">並び替え問題 第${i+1}問（3点）</div>
        <div class="eqi-txt">${q.q}</div>
        <div class="slot-lbl">単語バンク</div>
        <div class="esb" id="esb-sort-${i}">
          ${sw.map(w => `<button class="ec" onclick="moveEC('sort',${i},this,'slot')" data-word="${w}">${w}</button>`).join('')}
        </div>
        <div class="slot-lbl">回答欄</div>
        <div class="ess" id="ess-sort-${i}"></div>
        <div class="efb" id="efb-sort-${i}"></div>
      </div>`;
  }).join('');

  // ライティング・ひねりセクション
  const writeItems = es.writeQs.map((q, i) => `
    <div class="eqi" id="eq-write-${i}">
      <div class="eqi-lbl">ライティング問題 第${i+1}問（3点）</div>
      <div class="eqi-txt">${q.q}</div>
      <textarea class="exam-textarea" id="eta-write-${i}" placeholder="英文を入力..."></textarea>
      <div class="efb" id="efb-write-${i}"></div>
    </div>`).join('');

  const twistItems = es.twistQs.map((q, i) => `
    <div class="eqi" id="eq-twist-${i}">
      <div class="eqi-lbl">ひねり問題 第${i+1}問（3点）</div>
      <div class="eqi-txt">${q.q}</div>
      <textarea class="exam-textarea" id="eta-twist-${i}" placeholder="英文を入力..."></textarea>
      <div class="efb" id="efb-twist-${i}"></div>
    </div>`).join('');

  document.getElementById('examContent').innerHTML = `
    <div class="ep-bar-row">
      <span class="ep-lbl">進行状況</span>
      <div class="ep-bw"><div class="ep-b" id="examPB" style="width:0%"></div></div>
      <span class="ep-n" id="examPN">採点前</span>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.vocab}">📝 第1問 英単語（15問 × 1点 ＝ 15点）</div>
      <div class="exam-sec-body">${vocabItems}</div>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.mc}">📋 第2問 四択問題（10問 × 2点 ＝ 20点）</div>
      <div class="exam-sec-body">${mcItems}</div>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.fill}">✏️ 第3問 穴埋め問題（10問 × 2点 ＝ 20点）</div>
      <div class="exam-sec-body">${fillItems}</div>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.sort}">🔀 第4問 並び替え問題（5問 × 3点 ＝ 15点）</div>
      <div class="exam-sec-body">${sortItems}</div>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.write}">📝 第5問 ライティング問題（5問 × 3点 ＝ 15点）</div>
      <div class="exam-sec-body">${writeItems}</div>
    </div>
    <div class="exam-sec-card">
      <div class="exam-sec-hdr" style="background:${SC.twist}">🌀 第6問 ひねり問題（5問 × 3点 ＝ 15点）</div>
      <div class="exam-sec-body">${twistItems}</div>
    </div>
    <div class="exam-submit-wrap">
      <button class="exam-submit-btn" onclick="submitExam()">📊 採点する</button>
    </div>`;
}

function selExamOpt(cat, idx, optIdx, btn) {
  if (examState.submitted) return;
  document.getElementById(`eq-${cat}-${idx}`).querySelectorAll('.exam-opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  if (!examState.answers[cat]) examState.answers[cat] = {};
  examState.answers[cat][idx] = optIdx;
}

function moveEC(cat, idx, btn, dir) {
  if (examState.submitted) return;
  if (dir === 'slot') {
    document.getElementById(`ess-${cat}-${idx}`).appendChild(btn);
    btn.onclick = () => moveEC(cat, idx, btn, 'bank');
    btn.classList.add('placed');
  } else {
    document.getElementById(`esb-${cat}-${idx}`).appendChild(btn);
    btn.onclick = () => moveEC(cat, idx, btn, 'slot');
    btn.classList.remove('placed');
  }
}

function submitExam() {
  const es = examState;
  if (es.submitted) return;
  es.submitted = true;
  let total = 0;
  const bd  = { vocab:0, mc:0, fill:0, sort:0, write:0, twist:0 };

  // ── 英単語採点 ──────────────────────────────────────────────
  es.vocabQs.forEach((q, i) => {
    const sel = es.answers.vocab?.[i] ?? -1;
    const ok  = sel >= 0 && q.opts[sel] === q.ans;
    document.getElementById(`eq-vocab-${i}`)?.querySelectorAll('.exam-opt').forEach((b, bi) => {
      b.disabled = true;
      if (q.opts[bi] === q.ans)   b.classList.add('ex-ok');
      else if (bi === sel && !ok) b.classList.add('ex-ng');
    });
    const fb = document.getElementById(`efb-vocab-${i}`);
    if (fb) { fb.className = `efb ${ok?'ok':'ng'} vis`; fb.innerHTML = `${ok?'✅ 正解':'❌ 不正解'}：${q.exp}`; }
    if (ok) { total += EXAM_CFG.vocab.pts; bd.vocab += EXAM_CFG.vocab.pts; }
  });

  // ── 四択採点 ────────────────────────────────────────────────
  es.mcQs.forEach((q, i) => {
    const wrap    = document.getElementById(`eq-mc-${i}`);
    const optsEl  = wrap?.querySelector('.exam-opts');
    const corrSh  = optsEl ? parseInt(optsEl.dataset.correct) : -1;
    const sel     = es.answers.mc?.[i] ?? -1;
    const ok      = sel === corrSh;
    wrap?.querySelectorAll('.exam-opt').forEach((b, bi) => {
      b.disabled = true;
      if (bi === corrSh)          b.classList.add('ex-ok');
      else if (bi === sel && !ok) b.classList.add('ex-ng');
    });
    const fb = document.getElementById(`efb-mc-${i}`);
    if (fb) { fb.className = `efb ${ok?'ok':'ng'} vis`; fb.innerHTML = `${ok?'✅ 正解':'❌ 不正解'}：${q.exp}`; }
    if (ok) { total += EXAM_CFG.mc.pts; bd.mc += EXAM_CFG.mc.pts; }
  });

  // ── 穴埋め採点 ──────────────────────────────────────────────
  es.fillQs.forEach((q, i) => {
    const answers = Array.isArray(q.ans) ? q.ans : [q.ans];
    const blanks  = (q.blank.match(/_+/g) || []).length;
    let allOk = true;
    for (let b = 0; b < blanks; b++) {
      const el  = document.getElementById(`efi-fill-${i}-${b}`);
      if (!el) continue;
      const val = el.value.trim().toLowerCase();
      const ca  = answers[b] ? (Array.isArray(answers[b]) ? answers[b] : [answers[b]]) : [answers[0]];
      const ok  = ca.some(a => val === a.toLowerCase());
      el.classList.add(ok ? 'ex-ok' : 'ex-ng');
      el.disabled = true;
      if (!ok) allOk = false;
    }
    const fb = document.getElementById(`efb-fill-${i}`);
    if (fb) { fb.className = `efb ${allOk?'ok':'ng'} vis`; fb.innerHTML = `${allOk?'✅ 正解':'❌ 不正解'}：${q.exp}${!allOk?'<br>正解：'+q.ans:''}`; }
    if (allOk) { total += EXAM_CFG.fill.pts; bd.fill += EXAM_CFG.fill.pts; }
  });

  // ── 並び替え採点 ────────────────────────────────────────────
  es.sortQs.forEach((q, i) => {
    const chips = document.getElementById(`ess-sort-${i}`)?.querySelectorAll('.ec') || [];
    const ans   = Array.from(chips).map(c => c.dataset.word).join(' ');
    const ok    = ans.toLowerCase() === q.ans.toLowerCase();
    chips.forEach(c => { c.disabled = true; });
    const fb = document.getElementById(`efb-sort-${i}`);
    if (fb) { fb.className = `efb ${ok?'ok':'ng'} vis`; fb.innerHTML = `${ok?'✅ 正解':'❌ 不正解'}：${q.exp}${!ok?'<br>正解：'+q.ans:''}`; }
    if (ok) { total += EXAM_CFG.sort.pts; bd.sort += EXAM_CFG.sort.pts; }
  });

  // ── ライティング（自己採点・模範解答提示） ──────────────────
  es.writeQs.forEach((q, i) => {
    const ta  = document.getElementById(`eta-write-${i}`);
    const val = ta?.value?.trim() || '（未回答）';
    const fb  = document.getElementById(`efb-write-${i}`);
    if (fb) fb.className = 'efb ok vis',
            fb.innerHTML = `📝 <b>あなたの回答：</b>${val}<br><br>` +
                           `✅ <b>模範解答：</b>${q.model}<br><br>` +
                           `💡 <b>解説：</b>${q.exp}<br>` +
                           `<span style="font-size:10px;color:#155724;">※模範解答と照らし合わせて自己採点してください</span>`;
    if (ta) ta.disabled = true;
    total += EXAM_CFG.write.pts; bd.write += EXAM_CFG.write.pts;
  });

  // ── ひねり問題（自己採点・模範解答提示） ────────────────────
  es.twistQs.forEach((q, i) => {
    const ta  = document.getElementById(`eta-twist-${i}`);
    const val = ta?.value?.trim() || '（未回答）';
    const fb  = document.getElementById(`efb-twist-${i}`);
    if (fb) fb.className = 'efb ok vis',
            fb.innerHTML = `📝 <b>あなたの回答：</b>${val}<br><br>` +
                           `✅ <b>模範解答：</b>${q.model}<br><br>` +
                           `💡 <b>解説：</b>${q.exp}<br>` +
                           `<span style="font-size:10px;color:#155724;">※模範解答と照らし合わせて自己採点してください</span>`;
    if (ta) ta.disabled = true;
    total += EXAM_CFG.twist.pts; bd.twist += EXAM_CFG.twist.pts;
  });

  document.getElementById('examPB').style.width = '100%';
  document.getElementById('examPN').textContent = `${total}点 / 100点`;
  addXP(50);

  const emoji = total >= 90 ? '🏆' : total >= 70 ? '😊' : total >= 50 ? '💪' : '📚';
  const msg   = total >= 90 ? '優秀！素晴らしい成績です！'
              : total >= 70 ? 'よくできました！苦手箇所を復習しよう。'
              : total >= 50 ? 'もう少し！解説をしっかり読んで再チャレンジ。'
              : '解説をしっかり読んで基礎から復習しよう。';

  const summary = document.createElement('div');
  summary.className = 'exam-result';
  summary.innerHTML = `
    <div class="er-emoji">${emoji}</div>
    <div class="er-score">${total}</div>
    <div class="er-total">/ 100点　${msg}</div>
    <div class="er-bd">
      <div class="er-bdi"><div class="er-bdi-n" style="color:var(--indigo)">${bd.vocab}/15</div><div class="er-bdi-l">英単語</div></div>
      <div class="er-bdi"><div class="er-bdi-n" style="color:var(--indigo)">${bd.mc}/20</div><div class="er-bdi-l">四択</div></div>
      <div class="er-bdi"><div class="er-bdi-n" style="color:var(--green)">${bd.fill}/20</div><div class="er-bdi-l">穴埋め</div></div>
      <div class="er-bdi"><div class="er-bdi-n" style="color:#fd7e14">${bd.sort}/15</div><div class="er-bdi-l">並び替え</div></div>
      <div class="er-bdi"><div class="er-bdi-n" style="color:var(--red)">${bd.write}/15</div><div class="er-bdi-l">ライティング</div></div>
      <div class="er-bdi"><div class="er-bdi-n" style="color:#6b4c9e">${bd.twist}/15</div><div class="er-bdi-l">ひねり</div></div>
    </div>
    <p style="font-size:11px;color:var(--muted);">※ライティング・ひねり問題は模範解答と照らし合わせてご自身で採点ください。</p>
    <button class="start-btn" style="font-size:13px;padding:10px 24px;margin-top:12px;" onclick="renderExamHome()">
      🔄 もう一度テストを受ける
    </button>`;
  document.getElementById('examContent').prepend(summary);
  summary.scrollIntoView({ behavior: 'smooth' });
}

// ================================================================
// 初期化
// ================================================================
renderLesson('l21');
