Zoologia Quiz (offline)

1) Apri un terminale nella cartella e avvia un server statico:
   python -m http.server 8000

2) Apri nel browser:
   http://localhost:8000/index.html

File:
- zoologia_questions.json : banco domande (1200)
- zoologia_results_db.json : export dello storico (inizialmente vuoto)
- index.html + app.js : interfaccia

Nota: lo storico viene salvato automaticamente in localStorage (chiave: zoologia_results_db).
Puoi scaricarlo in JSON con il pulsante "Scarica risultati (JSON)".
