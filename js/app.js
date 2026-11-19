import { words, sentences } from './data.js';
import { loadSRS, saveSRS, dueItems } from './srs.js';
import { renderCard } from './screens/card.js';
import { renderSegment } from './screens/segment.js';

window.__ALL_WORDS = words;
const app = document.getElementById('app');
const srs = loadSRS();

window.addEventListener('hashchange', router);
router();

function router() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'session') session();
  else if (h === 'stats') stats();
  else home();
}

function home() {
  app.innerHTML = `
    <section class="hero">
      <h1>听 HSK 4 — аудирование</h1>
      <p>Сначала звук. Текст — после ответа.</p>
      <a class="cta" href="#/session">Начать сессию</a>
    </section>`;
}

function session() {
  const due = dueItems(srs, words.map(w => w.id));
  const ids = due.length ? due : words.map(w => w.id).slice(0, 10);
  const queue = ids.map(id => words.find(w => w.id === id)).filter(Boolean);
  const steps = [
    ...queue.map(w => ({ type: 'card', word: w })),
    ...sentences.slice(0, 3).map(s => ({ type: 'segment', sentence: s })),
  ];
  let i = 0;
  function next() {
    if (i >= steps.length) {
      saveSRS(srs);
      app.innerHTML = `<section class="hero"><h1>Готово!</h1>
        <p>Слов: ${queue.length}. Фраз: 3.</p>
        <a class="cta" href="#/session">Ещё раз</a></section>`;
      return;
    }
    const st = steps[i++];
    if (st.type === 'card') renderCard(app, st.word, srs, next);
    if (st.type === 'segment') renderSegment(app, st.sentence, next);
  }
  next();
}

function stats() {
  const total = Object.keys(srs).length;
  const learned = Object.values(srs).filter(s => s.reps >= 3).length;
  app.innerHTML = `<section><h2>Статистика</h2>
    <p>Слов в базе: ${words.length}</p>
    <p>В повторении: ${total}</p>
    <p>Уверенно на слух: ${learned}</p></section>`;
}
