import { words as defaultWords, sentences } from './data.js';
import { loadSRS, saveSRS, dueItems } from './srs.js';
import { renderCard } from './screens/card.js';
import { renderSegment } from './screens/segment.js';

const VOCAB_KEY = 'hsk_vocab_v1';
let allWords = loadVocab();
window.__ALL_WORDS = allWords;

let selectedLevel = 'all';
let selectedLesson = 0;

const app = document.getElementById('app');
const srs = loadSRS();

function loadVocab() {
  try {
    const saved = JSON.parse(localStorage.getItem(VOCAB_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return defaultWords.map(w => ({ ...w, level: 4 }));
}

function saveVocab(list) {
  allWords = list;
  window.__ALL_WORDS = list;
  localStorage.setItem(VOCAB_KEY, JSON.stringify(list));
}

window.addEventListener('hashchange', router);
router();

function router() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'session') session();
  else if (h === 'stats') stats();
  else home();
}

function getFilteredWords() {
  return selectedLevel === 'all'
    ? allWords
    : allWords.filter(w => String(w.level) === String(selectedLevel));
}

function home() {
  const filtered = getFilteredWords();
  const lessonCount = Math.max(1, Math.ceil(filtered.length / 50));
  if (selectedLesson >= lessonCount) selectedLesson = 0;

  const lessonOptions = Array.from({ length: lessonCount }, (_, idx) => {
    const from = idx * 50 + 1;
    const to = Math.min((idx + 1) * 50, filtered.length);
    return '<option value="' + idx + '" ' + (idx === selectedLesson ? 'selected' : '') + '>Урок ' + (idx + 1) + ' (' + from + '–' + to + ')</option>';
  }).join('');

  app.innerHTML = `
    <section class="hero">
      <h1>听 HSK 1–4 — аудирование</h1>
      <p>В офлайн-памяти: <b>${allWords.length}</b> слов</p>
      <div class="controls">
        <select id="lvlSel">
          <option value="all" ${selectedLevel === 'all' ? 'selected' : ''}>Все уровни HSK 1–4</option>
          <option value="1" ${selectedLevel === '1' ? 'selected' : ''}>HSK 1</option>
          <option value="2" ${selectedLevel === '2' ? 'selected' : ''}>HSK 2</option>
          <option value="3" ${selectedLevel === '3' ? 'selected' : ''}>HSK 3</option>
          <option value="4" ${selectedLevel === '4' ? 'selected' : ''}>HSK 4</option>
        </select>
        <select id="lesSel">${lessonOptions}</select>
      </div>
      <a class="cta" href="#/session">Начать сессию</a>
    </section>`;

  app.querySelector('#lvlSel').onchange = e => {
    selectedLevel = e.target.value;
    selectedLesson = 0;
    home();
  };
  app.querySelector('#lesSel').onchange = e => {
    selectedLesson = +e.target.value;
  };
}

function session() {
  const filtered = getFilteredWords();
  const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
  const due = dueItems(srs, slice.map(w => w.id));
  const ids = (due.length ? due : slice.map(w => w.id)).slice(0, 15);
  const queue = ids.map(id => slice.find(w => w.id === id)).filter(Boolean);

  const steps = [
    ...queue.map(w => ({ type: 'card', word: w })),
    ...sentences.slice(0, 3).map(s => ({ type: 'segment', sentence: s })),
  ];

  let i = 0;
  function next() {
    if (i >= steps.length) {
      saveSRS(srs);
      app.innerHTML = `<section class="hero"><h1>Готово!</h1>
        <p>Пройдено слов: ${queue.length}. Фраз: 3.</p>
        <button id="againBtn" class="cta" style="border:none;cursor:pointer;">Ещё раз</button></section>`;
      app.querySelector('#againBtn').onclick = session;
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
  app.innerHTML = `<section>
    <h2>Статистика и офлайн-база</h2>
    <p>Слов в базе устройства: <b>${allWords.length}</b></p>
    <p>В повторении: <b>${total}</b></p>
    <p>Уверенно на слух: <b>${learned}</b></p>

    <div class="box">
      <h3>1. Скачать полный словарь HSK 1–4 в память</h3>
      <p style="color:var(--muted);font-size:14px;">Требуется интернет один раз. После загрузки все слова сохранятся локально и будут работать без сети.</p>
      <button id="fetchHsk" class="cta" style="border:none;cursor:pointer;margin-top:8px;">Загрузить HSK 1–4</button>
      <p id="fetchStatus" style="margin-top:10px;color:var(--accent);"></p>
    </div>

    <div class="box">
      <h3>2. Загрузить свой словарь с русским переводом (.txt / .csv)</h3>
      <p style="color:var(--muted);font-size:14px;">Формат строк: <code>иероглиф;пиньинь;перевод;уровень</code></p>
      <input type="file" id="csvFile" accept=".txt,.csv" style="margin-top:8px;">
    </div>
  </section>`;

  app.querySelector('#fetchHsk').onclick = async () => {
    const st = app.querySelector('#fetchStatus');
    st.textContent = 'Загрузка базы HSK 1–4...';
    try {
      const res = await fetch('./hsk.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const parsed = Array.isArray(raw) && raw.at(0) && raw.at(0).ru
        ? raw
        : raw.reduce((acc, item) => {
            const lvls = item.l || item.level || Array.of();
            const newLvl = Array.of(1, 2, 3, 4).find(n => lvls.includes('n' + n) || lvls.includes('new-' + n));
            if (!newLvl) return acc;
            const forms = item.f || item.forms || Array.of();
            const form = forms.at(0) || {};
            const trans = form.i || form.transcriptions || {};
            const meanings = form.m || form.meanings || Array.of();
            const ru = meanings.slice(0, 3).join(', ');
            const hanzi = item.s || item.simplified;
            if (hanzi && ru) acc.push({ id: 'hsk_' + (acc.length + 1), hanzi, pinyin: trans.y || trans.pinyin || '', ru, level: newLvl });
            return acc;
          }, Array.of());
      saveVocab(parsed);
      st.textContent = 'Готово! Сохранено ' + parsed.length + ' слов HSK 1–4 в память устройства.';
    } catch (e) {
      st.textContent = 'Ошибка: ' + e.message;
    }
  };

  app.querySelector('#csvFile').onchange = e => {
    const file = e.target.files && e.target.files.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      const custom = lines.map((line, idx) => {
        const parts = line.split(/[;\t]/);
        const hanzi = (parts.at(0) || '').trim();
        const pinyin = (parts.at(1) || '').trim();
        const ru = (parts.at(2) || '').trim();
        const lvl = Number(parts.at(3)) || 4;
        return { id: 'c_' + (idx + 1), hanzi, pinyin, ru, level: lvl };
      }).filter(w => w.hanzi && w.ru);
      if (custom.length) {
        saveVocab(custom);
        alert('Загружено ' + custom.length + ' слов в офлайн-память!');
        stats();
      }
    };
    reader.readAsText(file, 'utf-8');
  };
}
