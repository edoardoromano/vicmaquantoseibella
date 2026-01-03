const QUESTIONS_URL = './zoologia_questions_v2.json';
const LS_KEY = 'zoologia_results_db';

let bank = [];
let current = []; // 20 questions
let answers = new Map(); // id -> option index
let submitted = false;

const elQuiz = document.getElementById('quiz');
const elMeta = document.getElementById('meta');
const badgeTopic = document.getElementById('badgeTopic');
const badgeProgress = document.getElementById('badgeProgress');
const badgeScore = document.getElementById('badgeScore');

const btnNew = document.getElementById('btnNew');
const btnSubmit = document.getElementById('btnSubmit');
const btnDownload = document.getElementById('btnDownload');
const btnClear = document.getElementById('btnClear');

function loadDb() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { attempts: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.attempts)) return { attempts: [] };
    return parsed;
  } catch {
    return { attempts: [] };
  }
}

function saveDb(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickRandom(arr, k) {
  const copy = arr.slice();
  // Fisher–Yates partial shuffle
  for (let i = copy.length - 1; i > copy.length - 1 - k; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(copy.length - k);
}

function updateBadges(scoreObj = null) {
  badgeProgress.textContent = `${answers.size}/20 risposte`;
  if (scoreObj) {
    badgeScore.textContent = `Punteggio: ${scoreObj.correct}/20`;
  } else {
    badgeScore.textContent = 'Punteggio: —';
  }
  const topics = [...new Set(current.map(q => q.topic))];
  badgeTopic.textContent = topics.length === 1 ? topics[0] : `Misto (${topics.length} argomenti)`;
}

function render() {
  elQuiz.innerHTML = '';
  current.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.qid = q.id;

    const title = document.createElement('div');
    title.className = 'qtitle';
    title.textContent = `${idx + 1}. ${q.question}`;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.style.marginBottom = '10px';
    meta.textContent = `${q.topic} • ${q.type} • ${q.id}`;
    card.appendChild(meta);

    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'opt';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = q.id;
      input.value = String(optIdx);
      input.disabled = submitted;
      input.checked = answers.get(q.id) === optIdx;

      input.addEventListener('change', () => {
        answers.set(q.id, optIdx);
        btnSubmit.disabled = answers.size !== 20;
        updateBadges();
      });

      label.appendChild(input);
      const span = document.createElement('span');
      span.textContent = opt;
      label.appendChild(span);

      card.appendChild(label);
    });

    const expl = document.createElement('div');
    expl.className = 'muted';
    expl.style.marginTop = '10px';
    expl.style.display = submitted ? 'block' : 'none';
    expl.textContent = `Spiegazione (breve): ${q.explanation}`;
    card.appendChild(expl);

    elQuiz.appendChild(card);
  });

  btnSubmit.disabled = answers.size !== 20;
  updateBadges();
}

function grade() {
  let correct = 0;
  const details = current.map(q => {
    const chosen = answers.get(q.id);
    const ok = chosen === q.answer_index;
    if (ok) correct += 1;
    return {
      id: q.id,
      topic: q.topic,
      chosen_index: chosen ?? null,
      chosen: chosen != null ? q.options[chosen] : null,
      correct_index: q.answer_index,
      correct: q.options[q.answer_index],
      ok
    };
  });
  return { correct, total: 20, details };
}

function applyGradingUI(score) {
  current.forEach(q => {
    const card = document.querySelector(`[data-qid="${q.id}"]`);
    if (!card) return;

    const chosen = answers.get(q.id);
    const ok = chosen === q.answer_index;
    card.classList.remove('good', 'bad');
    card.classList.add(ok ? 'good' : 'bad');

    // show explanations
    const expl = card.querySelector('.muted:last-child');
    if (expl) expl.style.display = 'block';

    // disable inputs
    card.querySelectorAll('input[type="radio"]').forEach(inp => inp.disabled = true);
  });

  updateBadges(score);
}

async function init() {
  const res = await fetch(QUESTIONS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossibile caricare il banco domande');
  const data = await res.json();

  const list = Array.isArray(data) ? data : (data.questions || []);
  bank = list;
  elMeta.textContent = `Banco: ${bank.length} domande`;

  newAttempt();
}

function newAttempt() {
  submitted = false;
  answers = new Map();
  current = pickRandom(bank, 20);
  render();
}

btnNew.addEventListener('click', newAttempt);

btnSubmit.addEventListener('click', () => {
  if (submitted) return;
  if (answers.size !== 20) return;

  const score = grade();
  submitted = true;
  applyGradingUI(score);

  const db = loadDb();
  db.attempts.push({
    timestamp: new Date().toISOString(),
    score: score.correct,
    total: score.total,
    questions: current.map(q => q.id),
    details: score.details
  });
  saveDb(db);
});

btnDownload.addEventListener('click', () => {
  const db = loadDb();
  downloadJson('zoologia_results_db.json', db);
});

btnClear.addEventListener('click', () => {
  if (confirm('Vuoi cancellare lo storico dei risultati salvati su questo browser?')) {
    saveDb({ attempts: [] });
    alert('Storico resettato.');
  }
});

init().catch(err => {
  elMeta.textContent = 'Errore caricamento. Se sei in locale, prova con un piccolo server o carica su GitHub Pages.';
  console.error(err);
});
