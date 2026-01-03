// Simulatore Esame Zoologia
// - Carica zoologia_questions.json
// - Estrae 20 domande random senza ripetizioni
// - Salva ogni prova in localStorage come "db locale" (JSON)

const QUESTIONS_URL = "zoologia_questions.json";
const RESULTS_KEY = "zoologia_results_db";

let allQuestions = [];
let current = []; // 20 questions
let answers = new Map(); // qid -> choiceIndex
let submitted = false;

const el = (id) => document.getElementById(id);

function loadResultsDB() {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) return { attempts: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.attempts)) return { attempts: [] };
    return parsed;
  } catch {
    return { attempts: [] };
  }
}

function saveResultsDB(db) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(db));
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomQuestions(n) {
  const copy = allQuestions.slice();
  shuffle(copy);
  return copy.slice(0, n);
}

function setStatus(text) {
  el("status").textContent = text;
}

function updateProgress() {
  el("progress").textContent = `${answers.size}/20 risposte`;
  el("btnSubmit").disabled = submitted || current.length === 0 || answers.size < 1;
}

function renderAttempts() {
  const db = loadResultsDB();
  const wrap = el("attempts");
  wrap.innerHTML = "";

  if (db.attempts.length === 0) {
    wrap.innerHTML = '<div class="muted">Nessuna prova salvata ancora.</div>';
    el("btnExport").disabled = true;
    return;
  }

  el("btnExport").disabled = false;

  const list = document.createElement("div");
  list.className = "choices";

  db.attempts.slice().reverse().forEach((a, idx) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="qtitle">Prova #${db.attempts.length - idx} — ${formatDate(a.timestamp)}</div>
      <div class="muted">Punteggio: <span class="${a.score >= 14 ? "ok" : "bad"}">${a.score}/20</span> — Risposte date: ${a.answered}/20</div>
      <div class="muted">Seed: <code>${a.seed}</code></div>
    `;
    list.appendChild(div);
  });

  wrap.appendChild(list);
}

function renderQuiz() {
  const container = el("quiz");
  container.innerHTML = "";
  el("summary").style.display = "none";
  el("summary").innerHTML = "";

  current.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const qn = idx + 1;

    const source = q.source ? ` <span class="pill">p. ${q.source.page}</span>` : "";
    const qTitle = document.createElement("div");
    qTitle.className = "qtitle";
    qTitle.innerHTML = `Q${qn}. ${escapeHtml(q.question)}${source}`;

    const choices = document.createElement("div");
    choices.className = "choices";

    q.choices.forEach((c, ci) => {
      const label = document.createElement("label");
      label.className = "choice";
      label.innerHTML = `
        <input type="radio" name="${q.id}" value="${ci}" ${submitted ? "disabled" : ""}>
        <div>${escapeHtml(c)}</div>
      `;
      const input = label.querySelector("input");
      input.addEventListener("change", () => {
        answers.set(q.id, ci);
        updateProgress();
      });
      choices.appendChild(label);
    });

    card.appendChild(qTitle);
    card.appendChild(choices);

    container.appendChild(card);
  });

  updateProgress();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function grade() {
  let score = 0;
  const details = [];
  current.forEach((q) => {
    const chosen = answers.has(q.id) ? answers.get(q.id) : null;
    const correct = q.answer_index;
    const ok = chosen === correct;
    if (ok) score++;
    details.push({
      id: q.id,
      chosen_index: chosen,
      correct_index: correct,
      correct_choice: q.choices[correct],
      question: q.question
    });
  });
  return { score, details };
}

function showSummary(score) {
  const box = el("summary");
  box.style.display = "block";
  const cls = score >= 14 ? "ok" : "bad";
  box.innerHTML = `
    <div class="qtitle">Risultato</div>
    <div class="muted">Punteggio: <span class="${cls}">${score}/20</span></div>
    <div class="muted">La prova è stata salvata nel DB locale.</div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function lockAndReveal() {
  submitted = true;
  el("btnSubmit").disabled = true;

  // mark choices with correct/incorrect
  current.forEach((q) => {
    const radios = document.querySelectorAll(`input[name="${q.id}"]`);
    radios.forEach((r) => {
      r.disabled = true;
      const ci = Number(r.value);
      const label = r.closest("label");
      const chosen = answers.has(q.id) ? answers.get(q.id) : null;

      if (ci === q.answer_index) {
        label.style.borderColor = "#2aa76b";
      }
      if (chosen !== null && ci === chosen && ci !== q.answer_index) {
        label.style.borderColor = "#d14b4b";
      }
      if (chosen === null && ci === q.answer_index) {
        label.style.borderStyle = "dashed";
      }
    });
  });
}

function newAttempt() {
  submitted = false;
  answers = new Map();
  current = pickRandomQuestions(20);
  setStatus(`Pronte: ${allQuestions.length} domande totali`);
  el("btnSubmit").disabled = true;
  renderQuiz();
}

function exportResults() {
  const db = loadResultsDB();
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zoologia_results_db.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetResults() {
  if (!confirm("Sicuro di voler cancellare lo storico locale?")) return;
  localStorage.removeItem(RESULTS_KEY);
  renderAttempts();
}

async function main() {
  setStatus("Caricamento domande…");
  try {
    const res = await fetch(QUESTIONS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allQuestions = data.questions || [];
    if (allQuestions.length < 20) throw new Error("Poche domande nel JSON");
    setStatus(`Pronte: ${allQuestions.length} domande totali`);
  } catch (e) {
    setStatus("Errore nel caricamento");
    el("quiz").innerHTML = `
      <div class="card">
        <div class="qtitle">Errore</div>
        <div class="muted">Non riesco a caricare <code>${QUESTIONS_URL}</code>.</div>
        <div class="muted">Apri la pagina con un server locale (es. <code>python -m http.server</code>) e assicurati che i file siano nella stessa cartella.</div>
        <div class="muted">Dettagli: <code>${escapeHtml(e.message || String(e))}</code></div>
      </div>
    `;
    return;
  }

  renderAttempts();
  newAttempt();
}

el("btnNew").addEventListener("click", newAttempt);

el("btnSubmit").addEventListener("click", () => {
  if (submitted) return;

  const { score, details } = grade();
  lockAndReveal();

  // save attempt
  const db = loadResultsDB();
  const seed = Math.random().toString(36).slice(2, 10);
  db.attempts.push({
    timestamp: Date.now(),
    seed,
    score,
    answered: answers.size,
    question_ids: current.map((q) => q.id),
    answers: details
  });
  saveResultsDB(db);

  showSummary(score);
  renderAttempts();
  updateProgress();
});

el("btnExport").addEventListener("click", exportResults);
el("btnReset").addEventListener("click", resetResults);

main();
