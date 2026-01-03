const QUESTIONS_URL = './zoologia_questions_v2.json';
const LS_KEY = 'zoologia_results_db_v2';

let bank = [];
let current = []; // 20 questions
let answers = new Map(); // id -> option index
let submitted = false;

// DOM Elements
const elQuiz = document.getElementById('quiz');
const elGrid = document.getElementById('qGrid');
const elStatusText = document.getElementById('statusText');
const elDashboard = document.getElementById('result-dashboard');
const btnNew = document.getElementById('btnNew');
const btnSubmit = document.getElementById('btnSubmit');
const btnDownload = document.getElementById('btnDownload');
const btnClear = document.getElementById('btnClear');

// --- DATABASE & UTILS ---

function loadDb() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { attempts: [] };
    return JSON.parse(raw);
  } catch { return { attempts: [] }; }
}

function saveDb(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function pickRandom(arr, k) {
  if (!arr || arr.length === 0) return [];
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

// --- RENDER FUNCTIONS ---

function updateSidebar() {
  elGrid.innerHTML = '';
  
  current.forEach((q, idx) => {
    const dot = document.createElement('div');
    dot.className = 'q-dot';
    dot.textContent = idx + 1;
    
    // State logic
    if (submitted) {
      const isCorrect = answers.get(q.id) === q.answer_index;
      dot.classList.add(isCorrect ? 'correct' : 'wrong');
    } else {
      if (answers.has(q.id)) dot.classList.add('filled');
    }

    // Scroll to question on click
    dot.addEventListener('click', () => {
      const card = document.getElementById(`q-${q.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    elGrid.appendChild(dot);
  });

  elStatusText.textContent = `${answers.size} di 20 risposte completate`;
  btnSubmit.disabled = answers.size !== 20 || submitted;
  if(submitted) btnSubmit.textContent = "Esame Completato";
  else btnSubmit.textContent = "Consegna Esame";
}

function render() {
  elQuiz.innerHTML = '';
  elDashboard.style.display = 'none'; // Hide results on new run

  current.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `q-${q.id}`;

    // Header
    const header = document.createElement('div');
    header.className = 'q-header';
    header.innerHTML = `
      <div class="q-text">${idx + 1}. ${q.question}</div>
      <div class="q-badge">${q.topic}</div>
    `;
    card.appendChild(header);

    // Options
    const optContainer = document.createElement('div');
    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'opt-label';
      
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = q.id;
      input.value = optIdx;
      input.disabled = submitted;
      
      // Styling logic for visual selection
      if (answers.get(q.id) === optIdx) {
        input.checked = true;
        label.classList.add('selected');
      }

      input.addEventListener('change', () => {
        // Remove selected class from siblings
        optContainer.querySelectorAll('.opt-label').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
        
        answers.set(q.id, optIdx);
        updateSidebar();
      });

      // Custom Radio UI
      const circle = document.createElement('div');
      circle.className = 'radio-circle';

      const text = document.createElement('span');
      text.textContent = opt;

      label.appendChild(input);
      label.appendChild(circle);
      label.appendChild(text);
      optContainer.appendChild(label);
    });
    card.appendChild(optContainer);

    // Explanation (Hidden initially)
    const expl = document.createElement('div');
    expl.className = 'explanation-box';
    expl.innerHTML = `<strong>Spiegazione:</strong> ${q.explanation}`;
    card.appendChild(expl);

    elQuiz.appendChild(card);
  });

  updateSidebar();
}

function showResults(score) {
  // 1. Populate Dashboard
  const percentage = Math.round((score.correct / score.total) * 100);
  document.getElementById('scoreDisplay').textContent = `${score.correct}/${score.total}`;
  document.getElementById('percentageDisplay').textContent = `${percentage}%`;
  
  const bar = document.getElementById('scoreBar');
  bar.style.width = `${percentage}%`;
  bar.style.backgroundColor = percentage >= 60 ? 'var(--success)' : 'var(--error)';

  const msg = document.getElementById('scoreMsg');
  if(percentage >= 90) msg.textContent = "Eccellente! Ottimo lavoro.";
  else if(percentage >= 60) msg.textContent = "Esame superato.";
  else msg.textContent = "Esame non superato. Riprova.";

  elDashboard.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 2. Update Cards Style
  current.forEach(q => {
    const card = document.getElementById(`q-${q.id}`);
    const chosenIdx = answers.get(q.id);
    const correctIdx = q.answer_index;
    const labels = card.querySelectorAll('.opt-label');
    
    // Highlight Card Border
    if (chosenIdx === correctIdx) card.classList.add('correct-card');
    else card.classList.add('wrong-card');

    // Highlight Options
    labels.forEach((lbl, idx) => {
      const inp = lbl.querySelector('input');
      inp.disabled = true; // freeze inputs

      if (idx === correctIdx) {
        lbl.classList.add('g-correct');
      } else if (idx === chosenIdx && idx !== correctIdx) {
        lbl.classList.add('g-wrong');
      }
    });

    // Show explanation
    const expl = card.querySelector('.explanation-box');
    expl.style.display = 'block';
  });

  // 3. Update Sidebar Dots
  updateSidebar();
}

// --- CORE LOGIC ---

function grade() {
  let correct = 0;
  const details = current.map(q => {
    const chosen = answers.get(q.id);
    const ok = chosen === q.answer_index;
    if (ok) correct++;
    return { id: q.id, ok, chosen, correct: q.answer_index };
  });
  return { correct, total: 20, details };
}

async function init() {
  try {
    const res = await fetch(QUESTIONS_URL);
    if (!res.ok) throw new Error("Fetch failed");
    const data = await res.json();
    bank = Array.isArray(data) ? data : (data.questions || []);
    newAttempt();
  } catch (e) {
    elQuiz.innerHTML = `<div style="padding:20px; color:red">Errore caricamento ${QUESTIONS_URL}. Controlla console.</div>`;
    console.error(e);
  }
}

function newAttempt() {
  if(bank.length === 0) return;
  submitted = false;
  answers.clear();
  current = pickRandom(bank, 20);
  render();
}

// --- EVENTS ---

btnNew.addEventListener('click', () => {
  if(confirm("Iniziare un nuovo esame? I progressi correnti andranno persi.")) {
    newAttempt();
  }
});

btnSubmit.addEventListener('click', () => {
  if (submitted) return;
  if (answers.size !== 20) {
    alert("Rispondi a tutte le domande prima di consegnare.");
    return;
  }
  
  if(!confirm("Sei sicuro di voler consegnare?")) return;

  const score = grade();
  submitted = true;
  
  // Save to History
  const db = loadDb();
  db.attempts.push({
    timestamp: new Date().toISOString(),
    score: score.correct,
    total: score.total
  });
  saveDb(db);

  showResults(score);
});

btnDownload.addEventListener('click', () => {
  const db = loadDb();
  const blob = new Blob([JSON.stringify(db, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'risultati_esame.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

btnClear.addEventListener('click', () => {
  if(confirm("Cancellare tutto lo storico locale?")) {
    saveDb({ attempts: [] });
    alert("Storico cancellato.");
  }
});

// Start
init();
