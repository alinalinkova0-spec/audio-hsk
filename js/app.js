import { words as defaultWords, sentences } from './data.js';
import { loadSRS, saveSRS, dueItems } from './srs.js';
import { renderCard, renderBlitzCard } from './screens/card.js?v=27';
import { renderPhraseChoice } from './screens/segment.js?v=5';

const VOCAB_KEY = 'hsk_vocab_v7';
let allWords = loadVocab();
window.__ALL_WORDS = allWords;

let selectedLevel = localStorage.getItem('hsk_lvl') || 'all';
let selectedLesson = +(localStorage.getItem('hsk_les') || 0);
let lastMode = localStorage.getItem('hsk_mode') || 'words';

const app = document.getElementById('app');
const srs = loadSRS();

function getTodayKey() {
  return 'hsk_daily_' + new Date().toISOString().slice(0, 10);
}

function getDaily() {
  try {
    return JSON.parse(localStorage.getItem(getTodayKey())) || { words: 0, blitz: 0, phrases: 0 };
  } catch {
    return { words: 0, blitz: 0, phrases: 0 };
  }
}

function addDaily(mode, count) {
  const d = getDaily();
  d[mode] = (d[mode] || 0) + count;
  localStorage.setItem(getTodayKey(), JSON.stringify(d));
}

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
  if (h === 'session') startMode(lastMode);
  else if (h === 'words') startMode('words');
  else if (h === 'blitz') startMode('blitz');
  else if (h === 'phrases') startMode('phrases');
  else if (h === 'stats') stats();
  else home();
}

function getFilteredWords() {
  return selectedLevel === 'all'
    ? allWords
    : allWords.filter(w => String(w.level) === String(selectedLevel));
}

function buildRampQueue(slice) {
  // Сортируем слова урока по освоенности: сначала хорошо знакомые, в конце — сложные/неизученные
  const scored = slice.map(w => {
    const st = srs[w.id];
    const reps = st ? (st.reps || 0) : 0;
    const ease = st ? (st.ease || 2.5) : 2.5;
    return { word: w, score: reps * 10 + ease + Math.random() * 0.5 };
  }).sort((a, b) => b.score - a.score);

  const easyPool = scored.slice(0, Math.max(5, Math.ceil(scored.length * 0.35))).map(x => x.word);
  const hardPool = scored.slice(-Math.max(5, Math.ceil(scored.length * 0.35))).map(x => x.word);
  const midPool = scored.map(x => x.word);

  const used = new Set();
  const pickFrom = (pool, count, tier) => {
    const res = [];
    for (const w of pool.sort(() => Math.random() - 0.5)) {
      if (!used.has(w.id)) {
        used.add(w.id);
        res.push({ word: w, tier });
      }
      if (res.length === count) break;
    }
    return res;
  };

  const part1 = pickFrom(easyPool, 5, 'easy');
  const part2 = pickFrom(midPool, 5, 'medium');
  const part3 = pickFrom(hardPool, 5, 'hard');
  const rest = pickFrom(midPool, 15 - (part1.length + part2.length + part3.length), 'hard');
  return [...part1, ...part2, ...part3, ...rest];
}

function home() {
  const filtered = getFilteredWords();
  const lessonCount = Math.max(1, Math.ceil(filtered.length / 50));
  if (selectedLesson >= lessonCount) selectedLesson = 0;

  const lessonOptions = Array.from({ length: lessonCount }, (_, idx) => {
    const from = idx * 50 + 1;
    const to = Math.min((idx + 1) * 50, filtered.length);
    const sel = idx === selectedLesson ? 'selected' : '';
    return `<option value="${idx}" ${sel}>Урок ${idx + 1} (${from}–${to})</option>`;
  }).join('');

  const d = getDaily();
  const tasks = [
    { id: 'words', title: '1. Слова на слух (разгон 5–5–5)', done: d.words, goal: 15 },
    { id: 'blitz', title: '2. Молния: перевод за 3.5 сек', done: d.blitz, goal: 15 },
    { id: 'phrases', title: '3. Фразы HSK 4: выбрать перевод', done: d.phrases, goal: 5 },
  ];

  const taskButtons = tasks.map(t => {
    const isDone = t.done >= t.goal;
    const badge = isDone
      ? `<span style="color:#4ade80;font-weight:700;font-size:18px;">✓ ${t.done}/${t.goal}</span>`
      : `<span style="color:var(--muted);font-size:14px;">${t.done}/${t.goal}</span>`;
    return `
      <button class="ans" data-mode="${t.id}" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;font-size:16px;border-color:${isDone ? '#4ade80' : ''};">
        <span>${t.title}</span>
        ${badge}
      </button>`;
  }).join('');

  app.innerHTML = `
    <section class="hero">
      <h1>听 HSK 1–4 — аудирование</h1>
      <p>В офлайн-памяти: <b>${allWords.length}</b> слов</p>
      <div class="controls">
        <select id="lvlSel">
          <option value="all" ${selectedLevel === 'all' ? 'selected' : ''}>Все уровни</option>
          <option value="1" ${selectedLevel === '1' ? 'selected' : ''}>HSK 1</option>
          <option value="2" ${selectedLevel === '2' ? 'selected' : ''}>HSK 2</option>
          <option value="3" ${selectedLevel === '3' ? 'selected' : ''}>HSK 3</option>
          <option value="4" ${selectedLevel === '4' ? 'selected' : ''}>HSK 4</option>
        </select>
        <select id="lesSel">${lessonOptions}</select>
      </div>
      <div style="width:100%;max-width:420px;margin:16px auto 0;display:flex;flex-direction:column;gap:10px;">
        <div style="text-align:left;font-size:14px;color:var(--muted);">План на сегодня (нажми на задание):</div>
        ${taskButtons}
      </div>
    </section>`;

  app.querySelector('#lvlSel').onchange = e => {
    selectedLevel = e.target.value;
    selectedLesson = 0;
    localStorage.setItem('hsk_lvl', selectedLevel);
    localStorage.setItem('hsk_les', '0');
    home();
  };
  app.querySelector('#lesSel').onchange = e => {
    selectedLesson = +e.target.value;
    localStorage.setItem('hsk_les', String(selectedLesson));
  };
  app.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      location.hash = '#/' + btn.dataset.mode;
    };
  });
}

function startMode(mode) {
  lastMode = mode;
  localStorage.setItem('hsk_mode', mode);

  let steps = [];
  if (mode === 'words') {
    const filtered = getFilteredWords();
    const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
    const ramp = buildRampQueue(slice);
    steps = ramp.map((item, idx) => ({
      type: 'card',
      word: item.word,
      meta: { tier: item.tier, label: `${idx + 1}/${ramp.length}` }
    }));
} else if (mode === 'blitz') {
  const filtered = getFilteredWords();
  if (selectedLesson * 50 >= filtered.length) selectedLesson = 0;
  const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
  const ruOnly = slice.filter(w => /[а-яё]/i.test(w.ru) && !w.ru.includes('MYMEMORY'));
  const pool = ruOnly.length >= 4 ? ruOnly : slice;
  const queue = [...pool].sort(() => Math.random() - 0.5).slice(0, 15);
    steps = queue.map((w, idx) => ({
      type: 'blitz',
      word: w,
      meta: { label: `${idx + 1}/${queue.length}` }
    }));
  } else {
    
    const due = dueItems(srs, sentences.map(s => s.id));
    const ids = (due.length ? due : sentences.map(s => s.id)).slice(0, 5);
    const queue = ids.map(id => sentences.find(s => s.id === id)).filter(Boolean);
    steps = queue.map(s => ({ type: 'phrase', sentence: s }));
  }

  let i = 0;
  function next() {
    if (i >= steps.length) {
      saveSRS(srs);
      addDaily(mode, steps.length);
      app.innerHTML = `<section class="hero"><h1>Задание выполнено! ✓</h1>
        <p>Пройдено упражнений: <b>${steps.length}</b></p>
        <div class="row" style="justify-content:center;gap:12px;margin-top:12px;">
          <button id="againBtn" class="ghost">Ещё раз</button>
          <a href="#/" class="cta">К списку заданий</a>
        </div></section>`;
      app.querySelector('#againBtn').onclick = () => startMode(mode);
      return;
    }
    const st = steps[i++];
    if (st.type === 'card') renderCard(app, st.word, srs, next, st.meta);
    else if (st.type === 'blitz') renderBlitzCard(app, st.word, srs, next, st.meta);
    else renderPhraseChoice(app, st.sentence, sentences, srs, next);
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
      <p style="color:var(--muted);font-size:14px;">Требуется интернет один раз. После загрузки словарь сохранится в браузере и будет работать офлайн.</p>
      <button id="fetchHsk" class="cta" style="border:none;cursor:pointer;margin-top:8px;">Скачать словарь</button>
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
      const ruUrl = 'https://raw.githubusercontent.com' + '/LiudmilaLV/json_hsk/master/hsk.json';
      const [resNew, resRu] = await Promise.all([
        fetch('./hsk.json?v=3'),
        fetch(ruUrl).catch(() => null)
      ]);
      if (!resNew.ok) throw new Error('HTTP ' + resNew.status);
      const raw = await resNew.json();

      const ruMap = new Map();
      if (resRu && resRu.ok) {
        const ruList = await resRu.json();
        ruList.forEach(w => {
          if (w.hanzi && w.translations && Array.isArray(w.translations.rus)) {
            ruMap.set(w.hanzi, {
              ru: w.translations.rus.slice(0, 3).join(', '),
              
              pinyin: w.pinyin || ''            });
          }
        });
      }

      const parsed = [];
      for (const item of raw) {
        const lvls = item.l || item.level || Array.of();
        const newLvl = Array.of(1, 2, 3, 4).find(n => lvls.includes('n' + n));
        if (!newLvl) continue;
        const forms = item.f || item.forms || Array.of();
        const form = forms.at(0) || {};
        const hanzi = item.s || item.simplified;
        const found = ruMap.get(hanzi);
        const tr0 = Array.isArray(form.i) ? form.i.at(0) : (form.i || form.t || {});
        const pinyin = (typeof tr0 === 'string' ? tr0 : tr0.pinyin) || (found && found.pinyin) || '';
        const meanings = form.m || form.meanings || Array.of();
        let ru = found ? found.ru : '';
        if (!ru && meanings.length) {
          const en = meanings.slice(0, 2).join(', ');
          try {
            const trUrl = 'https://api.mymemory.' + 'translated.net/get?q=' + encodeURIComponent(en) + '&langpair=en|ru';
            const tr = await fetch(trUrl).then(r => r.json());
            ru = (tr && tr.responseData && tr.responseData.translatedText) || en;
          } catch {
            ru = en;
          }
          st.textContent = 'Перевод новых слов: ' + parsed.length + '...';
        }
        if (hanzi && ru) {
          parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi, pinyin, ru, level: newLvl });
        }
      }

      saveVocab(parsed);
      st.textContent = 'Готово! Сохранено ' + parsed.length + ' слов нового HSK 1–4 в память.';
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
    
