import { words as defaultWords, sentences, stories } from './data.js?v=2';
import { loadSRS, saveSRS, dueItems } from './srs.js';
import { renderCard, renderBlitzCard, renderReadCard, renderToneCard } from './screens/card.js?v=55';
import { renderPhraseChoice, renderStoryCard } from './screens/segment.js?v=12';
import { speak, stopAudio, mountAudioControl, playFeedback } from './audio.js?v=10';
const VOCAB_KEY = 'hsk_vocab_v13';
let allWords = loadVocab();
window.__ALL_WORDS = allWords;
let selectedLevel = localStorage.getItem('hsk_lvl') || 'all';
let selectedLesson = +(localStorage.getItem('hsk_les') || 0);
let lastMode = localStorage.getItem('hsk_mode') || 'words';
const app = document.getElementById('app');
const srs = loadSRS();
if (!localStorage.getItem('hsk_start_date')) {
  localStorage.setItem('hsk_start_date', new Date().toISOString());
}
function getEffectiveDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const base = `${y}-${m}-${day}`;
  if (localStorage.getItem('hsk_morning_reset') === '1' && now.getHours() < 6) {
    return `${base}_night`;
  }
  return base;
}

function getNotifyGooseIcon() {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return './goose_morning.jpg';
  if (h >= 12 && h < 14) return './goose_lunch.jpg';
  if (h >= 10 && h < 21) return './goose_bonsai.jpg';
  return './goose_mood.jpg';
}

function getTodayKey() {
  return `hsk_daily_${getEffectiveDateStr()}`;
}

function getDaily() {
  try {
    const raw = JSON.parse(localStorage.getItem(getTodayKey())) || {};
    return {
      words: raw.words || 0,
      blitz: raw.blitz || 0,
      phrases: raw.phrases || 0,
      stories: raw.stories || 0
    };
  } catch {
    return { words: 0, blitz: 0, phrases: 0, stories: 0 };
  }
}
function addDaily(mode, count) {
  const d = getDaily();
  d[mode] = (d[mode] || 0) + count;
  localStorage.setItem(getTodayKey(), JSON.stringify(d));
}
function getTodayMoodKey() {
  return `hsk_mood_${getEffectiveDateStr()}`;
}

function getTodayMood() {
  return localStorage.getItem(getTodayMoodKey()) || '';
}
function setTodayMood(mood) {
  localStorage.setItem(getTodayMoodKey(), mood);
  const prev = Number(localStorage.getItem('hsk_tired_streak') || '0');
  const next = mood === 'tired' ? prev + 1 : 0;
  localStorage.setItem('hsk_tired_streak', String(next));
}
function getMainWeakness() {
  try {
    const data = JSON.parse(localStorage.getItem('hsk_weakness_v1') || '{}');
    let audio = 0, tone = 0, read = 0;
    for (const v of Object.values(data)) {
      audio += v.audioErr || 0;
      tone += v.toneErr || 0;
      read += v.readErr || 0;
    }
    const max = Math.max(audio, tone, read);
    if (max === 0) return 'balance';
    if (tone === max) return 'tone';
    if (read === max) return 'read';
    return 'audio';
  } catch {
    return 'balance';
  }
}

function getDynamicPlan() {
  const mood = getTodayMood() || 'normal';
  const weak = getMainWeakness();
  const dayNum = new Date().getDate();

  const weakLabels = {
    tone: 'Фокус дня: закрепляем тоны и пиньинь',
    read: 'Фокус дня: узнавание иероглифов глазами',
    audio: 'Фокус дня: тренируем слух и темп речи',
    balance: 'Фокус дня: сбалансированная тренировка'
  };

  if (mood === 'high') {
    return {
      focusText: weakLabels[weak],
      tasks: Array.of(
        { id: 'words', title: '1. Слова на слух (усиленный)', goal: 20 },
        { id: 'blitz', title: '2. Молния на скорость', goal: 15 },
        { id: 'phrases', title: '3. Фразы в потоке', goal: 6 },
        { id: 'stories', title: '4. Диалоги и тексты', goal: 3 }
      )
    };
  }
  if (mood === 'tired') {
    const tiredDays = Number(localStorage.getItem('hsk_tired_streak') || '1');
    const stepUp = tiredDays >= 3;
    const thirdTask = dayNum % 2 === 0
      ? { id: 'stories', title: '3. Лёгкие диалоги', goal: 2 }
      : { id: 'phrases', title: '3. Короткие фразы', goal: stepUp ? 4 : 3 };
    return {
     focusText: stepUp
      ? 'Антистресс-режим (3+ дн. подряд — мягко держим темп)'
      : 'Антистресс-режим: закрепляем знакомое без перегруза',
      tasks: Array.of(
        { id: 'words', title: '1. Слова на слух (повторение)', goal: stepUp ? 12 : 10 },
        { id: 'blitz', title: '2. Молния', goal: stepUp ? 10 : 8 },
        thirdTask
      )
    };
  }
  const rotateTask = dayNum % 2 === 0
    ? { id: 'stories', title: '3. Диалоги и тексты', goal: 2 }
    : { id: 'phrases', title: '3. Фразы', goal: 5 };

  return {
    focusText: weakLabels[weak],
    tasks: Array.of(
      { id: 'words', title: '1. Слова на слух', goal: 15 },
      { id: 'blitz', title: '2. Молния', goal: 12 },
      rotateTask
    )
  };
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
let lastSfxTime = 0;
new MutationObserver(mutations => {
  if (Date.now() - lastSfxTime < 150) return;
  let hasBad = false;
  let hasOk = false;
  for (const m of mutations) {
    const el = m.target;
    if (el.classList && el.classList.contains('answer')) {
      if (el.classList.contains('bad')) hasBad = true;
      else if (el.classList.contains('ok')) hasOk = true;
    }
  }
  if (hasBad) {
    lastSfxTime = Date.now();
    playFeedback(false);
  } else if (hasOk) {
    lastSfxTime = Date.now();
    playFeedback(true);
  }
}).observe(app, { subtree: true, attributes: true, attributeFilter: ['class'] });
window.addEventListener('hashchange', router);
window.addEventListener('pagehide', stopAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAudio();
});
router();
function router() {
  stopAudio();
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'session') startMode(lastMode);
  else if (h === 'words') startMode('words');
  else if (h === 'blitz') startMode('blitz');
  else if (h === 'phrases') startMode('phrases');
  else if (h === 'stories') startMode('stories');
  else if (h === 'placement') startPlacementTest();
  else if (h === 'levelup') startLevelUpTest();
  else if (h === 'stats') stats();
  else if (h === 'settings') settings();
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
function getLevelProgress(lvl) {
  const lvlWords = allWords.filter(w => Number(w.level) === lvl);
  if (!lvlWords.length) return 0;
  const known = lvlWords.filter(w => srs[w.id] && srs[w.id].reps >= 1).length;
  return Math.round((known / lvlWords.length) * 100);
}
function home() {
  const userStartLvl = Number(localStorage.getItem('hsk_start_lvl') || 0);
  if (allWords.length <= 25 || !userStartLvl) {
    app.innerHTML = `
      <section class="hero" style="max-width:420px;margin:0 auto;padding:20px 16px 14px;">
        <h1 style="margin:0 0 6px;font-size:28px;">Привет!</h1>
        <p style="font-size:16px;line-height:1.4;color:var(--fg);margin:0;">
          Это тренажёр аудирования<br>
          по новому <b>HSK 3.0 (1–4 уровни)</b>
        </p>
              <div style="margin:10px auto 0;padding:8px 12px;border-radius:10px;background:#EDF5F0;border:1px solid var(--jade);font-size:13px;line-height:1.4;color:var(--fg);">
        💡 Перед началом загляни в <a href="#/settings" style="color:var(--jade);font-weight:700;text-decoration:underline;">Настройки</a> — там можно настроить сайт под себя
      </div>
        <div class="box" style="text-align:left;margin:14px 0 6px;padding:12px;">
          <div style="font-weight:700;font-size:15px;margin-bottom:10px;text-align:center;">Выбери свой текущий уровень:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
            <button class="ans" data-pick-lvl="1" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌱 HSK 1</button>
            <button class="ans" data-pick-lvl="2" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌿 HSK 2</button>
            <button class="ans" data-pick-lvl="3" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌳 HSK 3</button>
            <button class="ans" data-pick-lvl="4" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🐉 HSK 4</button>
          </div>
<button class="cta" id="startPlacementBtn" style="width:100%;border:none;cursor:pointer;margin-top:10px;padding:13px;font-size:16px;"> Я не знаю (пройти тест)</button>
        </div>
        <p id="welcomeLoadStatus" style="font-size:13px;color:var(--accent);font-weight:600;margin:0;"></p>
        <div style="margin:12px 0 8px;font-size:13px;color:var(--muted);text-align:center;line-height:1.5;">
          <div style="margin-bottom:3px;">💡 <b>Этот сайт можно добавить<br>на главный экран телефона для быстрого доступа:</b></div>
          <div><b>На iPhone:</b> «Поделиться» → «На экран Домой»</div>
          <div><b>На Android:</b> «⋮» → «Добавить на гл. экран»</div>
        </div>
<div style="width:100%;max-width:270px;margin:-14px auto 0;text-align:center;">
          <img src="./goose_welcome.jpg" alt="Приветственный гусь" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;user-select:none;display:block;">
        </div>
      </section>`;

    app.querySelectorAll('[data-pick-lvl]').forEach(btn => {
      btn.onclick = async () => {
        const picked = Number(btn.dataset.pickLvl);
        const st = app.querySelector('#welcomeLoadStatus');
        app.querySelectorAll('button').forEach(b => (b.disabled = true));
        await downloadLevelsUpTo(picked, st);
        localStorage.setItem('hsk_start_lvl', String(picked));
        selectedLevel = String(picked);
        selectedLesson = 0;
        localStorage.setItem('hsk_lvl', selectedLevel);
        localStorage.setItem('hsk_les', '0');
        home();
      };
    });
    app.querySelector('#startPlacementBtn').onclick = () => {
      location.hash = '#/placement';
    };
    return;
  }
  const p1 = getLevelProgress(1);
  const p2 = getLevelProgress(2);
  const p3 = getLevelProgress(3);
  const p4 = getLevelProgress(4);

  const unlocked2 = p1 >= 95 || userStartLvl >= 2;
  const unlocked3 = (unlocked2 && p2 >= 95) || userStartLvl >= 3;
  const unlocked4 = (unlocked3 && p3 >= 95) || userStartLvl >= 4;

  if (selectedLevel === 'all' || (selectedLevel === '2' && !unlocked2) || (selectedLevel === '3' && !unlocked3) || (selectedLevel === '4' && !unlocked4)) {
    selectedLevel = String(userStartLvl || 1);
    localStorage.setItem('hsk_lvl', selectedLevel);
  }
const filtered = getFilteredWords();
  const lessonCount = Math.max(1, Math.ceil(filtered.length / 50));
  if (selectedLesson >= lessonCount) selectedLesson = 0;

  const getLessonPct = idx => {
    const slice = filtered.slice(idx * 50, (idx + 1) * 50);
    if (!slice.length) return 0;
    const known = slice.filter(w => srs[w.id] && srs[w.id].reps >= 1).length;
    return Math.round((known / slice.length) * 100);
  };
  if (getLessonPct(selectedLesson) >= 85) {
    const nextUnfinished = Array.from({ length: lessonCount }, (_, i) => i).find(i => getLessonPct(i) < 85);
    if (nextUnfinished !== undefined && nextUnfinished !== selectedLesson) {
      selectedLesson = nextUnfinished;
      localStorage.setItem('hsk_les', String(selectedLesson));
    }
  }
  const lessonOptions = Array.from({ length: lessonCount }, (_, idx) => {
    const pct = getLessonPct(idx);
    const sel = idx === selectedLesson ? 'selected' : '';
    return `<option value="${idx}" ${sel}>Урок ${idx + 1} — ${pct}%</option>`;
  }).join('');
  const d = getDaily();
  const curMood = getTodayMood();
  const curLvlNum = Number(selectedLevel) || 1;
  const plan = getDynamicPlan();

  const knownSet = new Set(
    allWords.filter(w => srs[w.id] && srs[w.id].reps >= 1).map(w => w.hanzi)
  );
  const knowsAll = wordsList => wordsList.every(w => knownSet.has(w));

   const MOODS = Array.of(
    {
      id: 'high',
      img: './goose_mood_high.jpg',
      ru: 'Готова изучать китайский язык!',
      zh: '我准备好学习汉语了！',
      py: 'Wǒ zhǔnbèi hǎo xuéxí Hànyǔ le!',
      hideHelper: curLvlNum >= 2 || knowsAll(Array.of('我', '准备', '好', '学习', '汉语', '了'))
    },
    {
      id: 'normal',
      img: './goose_mood_normal.jpg',
      ru: 'Могу уделить немного времени',
      zh: '我能抽出一点儿时间',
      py: 'Wǒ néng chōuchū yīdiǎnr shíjiān',
      hideHelper: curLvlNum >= 4 || knowsAll(Array.of('我', '能', '抽出', '一点儿', '时间'))
    },
    {
      id: 'tired',
      img: './goose_mood_tired.jpg',
      ru: 'Совсем без сил',
      zh: '我好累啊',
      py: 'Wǒ hǎo lèi a',
      hideHelper: curLvlNum >= 3 || knowsAll(Array.of('我', '好', '累', '啊'))
    }
  );

  if (!curMood) {
    const moodButtonsHtml = MOODS.map(m => {
      const textHtml = m.hideHelper
        ? `<div style="font-size:19px;font-weight:700;color:var(--fg);line-height:24px;">${m.zh}</div>`
        : `<div style="font-size:18px;font-weight:700;color:var(--fg);line-height:24px;">${m.zh}</div>
           <div style="font-size:13px;color:var(--jade);font-weight:600;margin-top:2px;">${m.py}</div>
           <div style="font-size:14px;color:var(--muted);margin-top:3px;">${m.ru}</div>`;
      return `<button class="ans" data-mood="${m.id}" data-mood-img="${m.img}" data-say-zh="${m.zh.trim()}" style="width:100%;text-align:center;padding:12px 14px;border-radius:14px;">${textHtml}</button>`;
    }).join('');

    app.innerHTML = `
      <section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px 12px;">
        <h2 style="margin:0 0 14px;font-size:22px;line-height:24px;text-align:center;">Какой ты сегодня?</h2>
        <div class="box" style="margin:0;padding:12px;">
          <div style="display:flex;flex-direction:column;gap:9px;">
            ${moodButtonsHtml}
          </div>
        </div>
      <div id="moodGooseBox" style="width:100%;max-width:260px;margin:14px auto 0;text-align:center;">
       <img id="moodGooseImg" src="./goose_mood.jpg" alt="Гусь настроения" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;user-select:none;display:block;">
     </div>
      </section>`;

    let moodLocked = false;
    app.querySelectorAll('[data-mood]').forEach(btn => {
      btn.onclick = async () => {
        if (moodLocked) return;
        moodLocked = true;
        setTodayMood(btn.dataset.mood);
        btn.classList.add('ok');
        btn.style.borderColor = 'var(--jade)';
        btn.style.background = '#EDF5F0';

        const gooseBox = app.querySelector('#moodGooseBox');
        const gooseImgEl = app.querySelector('#moodGooseImg');
        gooseImgEl.src = btn.dataset.moodImg;
        gooseBox.style.display = 'block';

        const playRes = speak(btn.dataset.sayZh, { rate: 0.95 });
        if (playRes && typeof playRes.then === 'function') {
          await playRes;
        } else {
          await new Promise(r => setTimeout(r, 2500));
        }
        setTimeout(() => home(), 1400);
      };
    });
    return;
  }
  const examDateStr = localStorage.getItem('hsk_exam_date') || '';
  let examBannerHtml = '';
  if (examDateStr) {
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);
    const examZero = new Date(examDateStr + 'T00:00:00');
    const daysLeft = Math.ceil((examZero - todayZero) / 86400000);
    if (daysLeft > 0) {
      const lvlPool = allWords.filter(w => String(w.level) === String(selectedLevel));
      const remWords = lvlPool.filter(w => (srs[w.id]?.reps || 0) < 1).length;
      const neededPerDay = Math.max(5, Math.ceil(remWords / daysLeft));
      const moodFactor = curMood === 'tired' ? 0.65 : (curMood === 'high' ? 1.15 : 1);
      const targetWords = Math.min(80, Math.max(8, Math.round(neededPerDay * moodFactor)));
      const ratio = targetWords / 12;
      plan.tasks.forEach(t => {
        if (t.id === 'words') {
          t.goal = targetWords;
          t.sub = `Пройти ${targetWords} слов (темп к экзамену)`;
        } else if (t.id === 'blitz') {
          t.goal = Math.min(60, Math.max(10, Math.round(10 * ratio)));
          t.sub = `Ответить на ${t.goal} слов на время`;
        } else if (t.id === 'phrases') {
          t.goal = Math.min(20, Math.max(4, Math.round(4 * ratio)));
          t.sub = `Разобрать ${t.goal} фраз на слух`;
        }
      });
      examBannerHtml = `<div style="margin:6px auto 0;padding:6px 12px;border-radius:10px;background:#FFF4E6;border:1px solid #F3D19E;color:#8A4B08;font-size:13px;font-weight:700;display:inline-block;">🎯 До экзамена: ${daysLeft} дн. · цель ~${targetWords} слов/день</div>`;
    } else if (daysLeft === 0) {
      examBannerHtml = `<div style="margin:6px auto 0;padding:6px 12px;border-radius:10px;background:#EDF5F0;border:1px solid var(--jade);color:var(--jade);font-size:13px;font-weight:700;display:inline-block;">🎉 Экзамен уже сегодня! Удачи, ты справишься!</div>`;
    }
  }
const taskButtons = plan.tasks.map((t, idx) => {
  const doneCount = d[t.id] || 0;
  const isDone = doneCount >= t.goal;
  const cleanTitle = t.title.replace(/^\d+\.\s*/, '');
  const numBadge = isDone
    ? `<span style="width:26px;height:26px;border-radius:50%;background:var(--jade);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">✓</span>`
    : `<span style="width:26px;height:26px;border-radius:50%;background:#EDF5F0;color:var(--jade);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${idx + 1}</span>`;
  const todayColor = isDone ? 'var(--jade)' : (doneCount > 0 ? 'var(--beak)' : 'var(--fg)');
  return `
    <button class="ans" data-mode="${t.id}" style="display:grid;grid-template-columns:1fr 56px 56px;align-items:center;gap:6px;padding:12px 14px;border-color:${isDone ? 'var(--jade)' : ''};background:${isDone ? '#F4FAF6' : ''};">
      <span style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:var(--fg);text-align:left;line-height:1.25;">
        ${numBadge}
        <span>${cleanTitle}</span>
      </span>
      <span style="text-align:center;font-size:16px;font-weight:700;color:${todayColor};">${doneCount}</span>
      <span style="text-align:center;font-size:15px;font-weight:600;color:var(--muted);">${t.goal}</span>
    </button>`;
}).join('');

  const hr = new Date().getHours();
  const isPlanDoneToday = plan.tasks.every(t => (d[t.id] || 0) >= t.goal);
  const surpriseKey = `hsk_surprise_hr_${getEffectiveDateStr()}`;
  let surpriseHr = Number(localStorage.getItem(surpriseKey));
  if (!surpriseHr) {
    const daySlots =;
    surpriseHr = daySlots[Math.floor(Math.random() * daySlots.length)];
    localStorage.setItem(surpriseKey, String(surpriseHr));
  }

  let gooseImg = './goose.jpg';
  if (isPlanDoneToday) {
    gooseImg = './goose_plan_done.gif';
  } else if (hr >= 6 && hr < 10) {
    gooseImg = './goose_morning.jpg';
  } else if (hr >= 12 && hr < 14) {
    gooseImg = './goose_lunch.jpg';
  } else if (hr >= 21 || hr < 6) {
    gooseImg = './goose_night.jpg';
  } else if (hr === surpriseHr || curMood === 'tired') {
    gooseImg = './goose_bonsai.jpg';
  }
  const streak = Number(localStorage.getItem('hsk_streak') || 0);
  const nextLvl = curLvlNum + 1;
  const canLevelUp = streak >= 10 && curLvlNum < 4;
  const levelUpBanner = canLevelUp
    ? `<div class="box" style="width:100%;max-width:420px;margin:12px auto 0;background:#FFF8E7;border-color:#F59E0B;text-align:left;padding:12px;">
         <div style="font-weight:700;font-size:14px;color:#B45309;">🔥 Отличная серия: ${streak} верных ответов подряд!</div>
         <div style="font-size:13px;color:var(--fg);margin:4px 0 8px;">Хочешь пройти быстрый тест из 10 слов, чтобы досрочно открыть <b>HSK ${nextLvl}</b>?</div>
         <a href="#/levelup" class="cta" style="padding:8px 14px;font-size:13px;display:inline-block;">🚀 Проверить и открыть HSK ${nextLvl}</a>
       </div>`
    : '';
  app.innerHTML = `
    <section class="hero">
    <h1 style="margin-bottom:4px;">HSK 3.0 听力训练</h1>
      ${knowsAll(['听力', '训练']) ? '' : '<div style="color:var(--jade);font-weight:500;font-size:14px;margin:0;">(Tīnglì xùnliàn)</div>'}
      <p style="color:var(--muted);opacity:0.95;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;line-height:24px;margin:12px 0;">ТРЕНИРОВКА АУДИРОВАНИЯ</p>
      ${examBannerHtml || `<div style="margin:6px auto 0;padding:6px 12px;border-radius:10px;background:#EDF5F0;border:1px solid var(--jade);font-size:12px;line-height:1.4;color:var(--fg);display:inline-block;">💡 Перед началом загляни в <a href="#/settings" style="color:var(--jade);font-weight:700;text-decoration:underline;">Настройки</a> — там можно настроить сайт под себя</div>`}
      <div class="controls" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:4px auto 6px;">
     <select id="lvlSel" style="width:auto;min-width:128px;max-width:162px;padding:8px 10px;font-size:14px;text-align:center;">
       <option value="1" ${selectedLevel === '1' ? 'selected' : ''}>HSK 1 (${p1}%)</option>
       <option value="2" ${selectedLevel === '2' ? 'selected' : ''} ${unlocked2 ? '' : 'disabled'}>${unlocked2 ? `HSK 2 (${p2}%)` : 'HSK 2 🔒'}</option>
       <option value="3" ${selectedLevel === '3' ? 'selected' : ''} ${unlocked3 ? '' : 'disabled'}>${unlocked3 ? `HSK 3 (${p3}%)` : 'HSK 3 🔒'}</option>
       <option value="4" ${selectedLevel === '4' ? 'selected' : ''} ${unlocked4 ? '' : 'disabled'}>${unlocked4 ? `HSK 4 (${p4}%)` : 'HSK 4 🔒'}</option>
     </select>
        <select id="lesSel" style="width:auto;min-width:128px;max-width:162px;padding:8px 10px;font-size:14px;text-align:center;">${lessonOptions}</select>
      </div>
      ${levelUpBanner}
      <div style="width:100%;max-width:420px;margin:20px auto 0;display:flex;flex-direction:column;gap:8px;">
        <div style="text-align:center;font-size:14px;color:var(--jade);font-weight:800;text-transform:uppercase;letter-spacing:0.4px;line-height:24px;padding:0 6px;">${plan.focusText}</div>
        <div style="display:grid;grid-template-columns:1fr 56px 56px;align-items:baseline;gap:6px;margin-top:12px;padding:0 14px;">
          <span style="font-size:14px;font-weight:700;color:var(--fg);text-align:left;">План на сегодня:</span>
          <span style="font-size:11px;font-weight:600;color:var(--muted);text-align:center;">Сегодня</span>
          <span style="font-size:11px;font-weight:600;color:var(--muted);text-align:center;">Норма</span>
        </div>
        ${taskButtons}
      </div>

      <div style="width:100%;max-width:260px;margin:6px auto 0;text-align:center;overflow:hidden;">
        <img src="${gooseImg}" alt="Гусь-помощник" style="width:100%;height:auto;margin-top:-18px;clip-path:inset(0 8% 0 0);mix-blend-mode:multiply;pointer-events:none;user-select:none;">
      </div>
    <div style="max-width:340px;margin:12px auto 0;text-align:center;">
      <button id="shareAppBtn" class="ghost" style="width:100%;padding:11px 16px;font-size:14px;font-weight:700;border-color:var(--jade);color:var(--jade);background:#F4F9F6;">🦆 Поделиться тренажёром с другом</button>
    </div>
  </section>`;

  app.querySelector('#lvlSel').onchange = e => {
    selectedLevel = e.target.value;
    selectedLesson = 0;
    localStorage.setItem('hsk_lvl', selectedLevel);
    localStorage.setItem('hsk_les', '0');
    history.replaceState(null, '', '#/');
    home();
  };
  app.querySelector('#lesSel').onchange = e => {
    selectedLesson = +e.target.value;
    localStorage.setItem('hsk_les', String(selectedLesson));
    history.replaceState(null, '', '#/');
  };
  const shareBtn = app.querySelector('#shareAppBtn');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const shareUrl = location.origin + location.pathname;
      const shareData = {
        title: 'HSK 3.0 听力训练',
        text: 'Тренирую свой китайский на слух в тренажёре HSK 3.0 с гусем 🦆',
        url: shareUrl
      };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        const orig = shareBtn.textContent;
        shareBtn.textContent = '✓ Ссылка скопирована в буфер!';
        setTimeout(() => { shareBtn.textContent = orig; }, 2200);
      }
    };
  }
  app.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      location.hash = '#/' + btn.dataset.mode;
    };
  });
}
function startMode(mode) {
  lastMode = mode;
  localStorage.setItem('hsk_mode', mode);
  const knownHanzi = new Set(
    allWords.filter(w => srs[w.id] && srs[w.id].reps >= 1).map(w => w.hanzi)
  );
  const scoreByKnownWords = text => {
    let hits = 0;
    for (const h of knownHanzi) {
      if (h && text.includes(h)) hits += 1;
    }
    return hits;
  };
  let steps = [];
  if (mode === 'words') {
    const filtered = getFilteredWords();
    const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
    const curLvl = Number(selectedLevel) || 1;
    let pool = Array.from(slice);

    if (curLvl > 1) {
      const prevWords = allWords.filter(w => Number(w.level) < curLvl);
      if (prevWords.length) {
        const mixCount = Math.min(3, Math.max(2, Math.round(pool.length * 0.2)));
        const prevSample = Array.from(prevWords)
          .sort((a, b) => ((srs[a.id] && srs[a.id].reps) || 0) - ((srs[b.id] && srs[b.id].reps) || 0) + (Math.random() - 0.5))
          .slice(0, mixCount);
        pool = pool.slice(0, Math.max(4, pool.length - prevSample.length)).concat(prevSample);
      }
    }
    const weakMap = JSON.parse(localStorage.getItem('hsk_weakness_v1') || '{}');
    pool.sort((a, b) => {
      const wa = weakMap[a.id] ? (weakMap[a.id].audioErr + weakMap[a.id].toneErr + weakMap[a.id].readErr) : 0;
      const wb = weakMap[b.id] ? (weakMap[b.id].audioErr + weakMap[b.id].toneErr + weakMap[b.id].readErr) : 0;
      return wb - wa;
    });
    const ramp = buildRampQueue(pool).slice(0, 12);
    const typesPool = Array.of('tone', 'tone', 'read', 'read', 'card', 'card', 'card', 'card', 'card', 'card', 'card', 'card')
      .slice(0, ramp.length)
      .sort(() => Math.random() - 0.5);

    steps = ramp.map((item, idx) => ({
      type: typesPool[idx] || 'card',
      word: item.word,
      meta: { tier: item.tier, label: `${idx + 1}/${ramp.length}` }
    }));
  } else if (mode === 'blitz') {
    const filtered = getFilteredWords();
    if (selectedLesson * 50 >= filtered.length) selectedLesson = 0;
    const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
    const ruOnly = slice.filter(w => /[а-яё]/i.test(w.ru) && !w.ru.includes('MYMEMORY'));
    const mainPool = ruOnly.length >= 4 ? ruOnly : slice;

    const curLvl = Number(selectedLevel) || 1;
    let mixedPool = Array.from(mainPool).sort(() => Math.random() - 0.5).slice(0, 10);
    if (curLvl > 1 && mixedPool.length >= 4) {
      const prevWords = allWords.filter(w => Number(w.level) < curLvl && /[а-яё]/i.test(w.ru));
      if (prevWords.length) {
        const prevPick = Array.from(prevWords).sort(() => Math.random() - 0.5).slice(0, 2);
        mixedPool = mixedPool.slice(0, 8).concat(prevPick).sort(() => Math.random() - 0.5);
      }
    }
    steps = mixedPool.map((w, idx) => ({
      type: 'blitz',
      word: w,
      meta: { label: `${idx + 1}/${mixedPool.length}` }
    }));
  } else if (mode === 'stories') {
    const curLvl = Number(selectedLevel) || 1;
    const lvlStories = stories.filter(st => {
      const firstLvl = Number(String(st.level).split('-').at(0)) || 1;
      return firstLvl <= curLvl;
    });
    const sourceStories = lvlStories.length ? lvlStories : stories;
    const rankedStories = Array.from(sourceStories)
      .map(st => {
        const fullText = st.lines.map(l => l.hanzi).join(' ');
        return { st, score: scoreByKnownWords(fullText) + Math.random() * 0.5 };
      })
      .sort((a, b) => b.score - a.score);
    const pickedStories = rankedStories.slice(0, 2).map(x => x.st);
    steps = pickedStories.map(st => ({ type: 'story', story: st }));
  } else {
    const curLvl = Number(selectedLevel) || 1;
    const lvlSentences = sentences.filter(s => !s.level || Number(s.level) <= curLvl);
    const sourceSentences = lvlSentences.length >= 4 ? lvlSentences : sentences;
    const rankedSentences = Array.from(sourceSentences)
      .map(s => ({ s, score: scoreByKnownWords(s.hanzi) + Math.random() * 0.5 }))
      .sort((a, b) => b.score - a.score);
    const queue = rankedSentences.slice(0, 4).map(x => x.s);
    steps = queue.map(s => ({ type: 'phrase', sentence: s }));
  }
  let i = 0;
  let goalShown = false;

  function showAllPlanDone() {
    app.innerHTML = `<section class="hero" style="padding:28px 16px;">
      <div style="width:100%;max-width:260px;margin:0 auto;">
        <img src="./goose_plan_done.gif" alt="План на сегодня выполнен" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;display:block;">
      </div>
      <h1 style="margin-top:12px;color:var(--jade);font-size:24px;">План на сегодня выполнен!!! 🎉</h1>
      <p style="color:var(--muted);margin-top:6px;">Все 4 задания на сегодня закрыты!</p>
      <div class="row" style="justify-content:center;gap:12px;margin-top:18px;">
        <a href="#/" class="cta">На главную</a>
      </div>
    </section>`;
  }
  function next() {
    if (i > 0) {
      addDaily(mode, 1);
      saveSRS(srs);
    }
    const dNow = getDaily();
    const allFourDone = dNow.words >= 12 && dNow.blitz >= 10 && dNow.phrases >= 4 && dNow.stories >= 2;
    if (mode === 'words' && i > 0 && dNow.words >= 12 && !goalShown) {
      goalShown = true;
      if (allFourDone) {
        showAllPlanDone();
        return;
      }
      app.innerHTML = `<section class="hero" style="padding:28px 16px;">
        <h1>На сегодня план выполнен! ✓</h1>
        <p style="font-size:16px;margin-top:8px;">Желаешь продолжить?</p>
        <div class="row" style="justify-content:center;gap:12px;margin-top:18px;">
          <button id="contBtn" class="cta" style="border:none;cursor:pointer;">Продолжить</button>
          <a href="#/" class="ghost">К списку заданий</a>
        </div>
      </section>`;
      app.querySelector('#contBtn').onclick = () => {
        if (i >= steps.length) startMode(mode);
        else next();
      };
      return;
    }
    if (i >= steps.length) {
      const curLvl = Number(selectedLevel) || 1;
      const lvlDone = getLevelProgress(curLvl) >= 95;
      if (lvlDone) {
        const allLevelsDone =
          getLevelProgress(1) >= 95 &&
          getLevelProgress(2) >= 95 &&
          getLevelProgress(3) >= 95 &&
          getLevelProgress(4) >= 95;
        if (allLevelsDone) {
          const startIso = localStorage.getItem('hsk_start_date') || new Date().toISOString();
          const daysSpent = Math.max(1, Math.ceil((Date.now() - new Date(startIso).getTime()) / 86400000));
          const learnedTotal = Object.values(srs).filter(s => s.reps >= 1).length;
          const confidentTotal = Object.values(srs).filter(s => s.reps >= 3).length;
          app.innerHTML = `<section class="hero" style="max-width:440px;margin:0 auto;padding:24px 16px;">
            <div style="position:relative;width:100%;max-width:340px;margin:0 auto;">
              <img src="./goose_all_done.jpg" alt="Все уровни пройдены" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;display:block;">
              <div style="position:absolute;left:32%;top:6%;width:38%;height:19%;background:#FBF7EF;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px 8px;font-family:'Inter',sans-serif;font-weight:800;font-size:13px;line-height:1.25;color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,0.06);border:2px solid #F4C430;">
                Поздравляем! 🎉
              </div>
              <svg viewBox="0 0 100 100" style="position:absolute;right:0;bottom:23%;width:14%;height:14%;pointer-events:none;">
                <path d="M 0 38 Q 22 48 34 66" fill="none" stroke="#181818" stroke-width="6" stroke-linecap="round"/>
                <path d="M 32 62 C 44 64 52 74 46 84 C 38 88 28 80 30 68 Z" fill="#181818"/>
              </svg>
            </div>
            <h1 style="margin-top:14px;color:var(--jade);font-size:23px;">Поздравляю! 🎉</h1>
            <p style="font-size:15px;line-height:1.5;color:var(--fg);margin-top:8px;">
              Этот сайт больше ничему не сможет тебя научить! Желаю удачи в изучении китайского языка! Я тобой горжусь! ❤️
            </p>
            <div class="box" style="text-align:left;margin:16px 0;font-size:14px;line-height:1.7;">
              <h3 style="margin-top:0;margin-bottom:6px;font-size:16px;">🏆 Твои итоги пути:</h3>
              <div>⏱ Времени в обучении: <b>${daysSpent} дн.</b></div>
              <div>🎧 Освоено слов HSK 1–4 на слух: <b>${learnedTotal}</b> из ${allWords.length}</div>
              <div>⭐ Узнаёшь мгновенно без подсказок: <b>${confidentTotal} слов</b></div>
              <div>🎓 Уровень восприятия на слух: <b>Уверенный HSK 4</b></div>
            </div>
            <div class="box" style="text-align:left;margin:16px 0;">
              <h3 style="margin-top:0;margin-bottom:6px;font-size:16px;">💌 Обратная связь автору</h3>
              <p style="color:var(--muted);font-size:13px;margin-top:0;">Напиши, что понравилось или чего не хватило — это поможет сделать тренажёр ещё лучше:</p>
              <textarea id="fbText" rows="3" placeholder="Твои впечатления, идеи или пожелания..." style="width:100%;box-sizing:border-box;padding:10px;border-radius:12px;border:1.5px solid var(--border);font-family:inherit;font-size:14px;resize:vertical;"></textarea>
              <button id="sendFb" class="cta" style="width:100%;border:none;cursor:pointer;margin-top:10px;">Отправить отзыв</button>
              <p id="fbStatus" style="margin-top:8px;font-size:13px;color:var(--jade);font-weight:600;"></p>
            </div>
            <div class="row" style="justify-content:center;gap:12px;margin-top:14px;">
              <a href="#/" class="ghost">На главную</a>
            </div>
          </section>`;
          app.querySelector('#sendFb').onclick = () => {
            const text = app.querySelector('#fbText').value.trim();
            const fbStatus = app.querySelector('#fbStatus');
            if (!text) {
              fbStatus.textContent = 'Напиши пару слов перед отправкой 😊';
              return;
            }
            const savedFb = JSON.parse(localStorage.getItem('hsk_feedbacks') || '[]');
            savedFb.push({ date: new Date().toISOString(), text, daysSpent, learnedTotal });
            localStorage.setItem('hsk_feedbacks', JSON.stringify(savedFb));
            app.querySelector('#fbText').value = '';
            fbStatus.textContent = 'Спасибо за тёплые слова! Отзыв сохранён ❤️';
          };
          return;
        }
        const curPct = getLevelProgress(curLvl);
        const nextLvlNum = Math.min(4, curLvl + 1);
        app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
          <div style="position:relative;width:100%;max-width:310px;margin:0 auto;">
            <img src="./goose_win.jpg" alt="Успешно пройден HSK ${curLvl}" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;display:block;">
            <div style="position:absolute;left:46%;right:0;top:28%;text-align:center;font-family:'Inter',sans-serif;font-weight:800;font-size:14px;line-height:1.3;color:var(--jade);letter-spacing:0.2px;pointer-events:none;">
              <div>УСПЕШНО ПРОЙДЕН</div>
              <div style="color:var(--accent);font-size:19px;margin-top:2px;">HSK ${curLvl} 🎉</div>
            </div>
          </div>
          <p style="font-size:15px;line-height:1.45;color:var(--fg);margin:14px 0 4px;font-weight:600;">
            Ты освоила ${curPct}% уровня! Хочешь добить до 100% или перейти на HSK ${nextLvlNum}?
          </p>
          <p style="font-size:12px;line-height:1.4;color:var(--muted);opacity:0.75;margin:0 0 16px;">
            (не переживай, эти оставшиеся ${100 - curPct}% всё равно будут появляться на следующем уровне)
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="goNextLvlBtn" class="cta" style="width:100%;border:none;cursor:pointer;margin:0;padding:13px;font-size:15px;">🚀 Перейти на HSK ${nextLvlNum}</button>
            <button id="stayFinishBtn" class="ghost" style="width:100%;padding:12px;font-size:14px;">🎯 Добить текущий уровень до 100%</button>
          </div>
        </section>`;
        app.querySelector('#goNextLvlBtn').onclick = async () => {
          const btn = app.querySelector('#goNextLvlBtn');
          btn.disabled = true;
          btn.textContent = `Загружаем HSK ${nextLvlNum}...`;
          await downloadLevelsUpTo(nextLvlNum);
          selectedLevel = String(nextLvlNum);
          selectedLesson = 0;
          localStorage.setItem('hsk_lvl', selectedLevel);
          localStorage.setItem('hsk_les', '0');
          location.hash = '#/';
        };
        app.querySelector('#stayFinishBtn').onclick = () => {
          location.hash = '#/';
        };
        return;
      }
      if (allFourDone) {
        showAllPlanDone();
        return;
      }
      const totalLearnedNow = Object.values(srs).filter(s => s.reps >= 1).length;
      const totalConfidentNow = Object.values(srs).filter(s => s.reps >= 3).length;
  const lvlWordsAll = allWords.filter(w => String(w.level) === String(selectedLevel));
  const lesList = lvlWordsAll.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
  const lesDone = lesList.length > 0 && lesList.every(w => (srs[w.id]?.reps || 0) >= 1);
  const lesBadgeKey = `hsk_les_badge_${selectedLevel}_${selectedLesson}`;
  const showLessonGoose = lesDone && !localStorage.getItem(lesBadgeKey);
  if (showLessonGoose) localStorage.setItem(lesBadgeKey, '1');
    const planNow = getDailyPlan(getTodayMood());
    const dNow = getDaily();
    const nextUnfinished = planNow.tasks.find(t => (dNow[t.id] || 0) < t.goal);
    const nextTaskBtn = nextUnfinished
      ? `<button id="nextTaskBtn" class="cta" style="margin:0;border:none;cursor:pointer;">Дальше: ${nextUnfinished.title.replace(/^\d+\.\s*/, '')} →</button>`
      : '';

    app.innerHTML = `<section class="hero">
      ${showLessonGoose ? `<div style="max-width:230px;margin:0 auto 10px;"><img src="./goose_lesson_done.jpg" alt="Урок пройден!" style="width:100%;height:auto;mix-blend-mode:multiply;display:block;"></div><h1 style="margin-bottom:6px;">Урок пройден! 🏆</h1>` : `<h1>Задание выполнено! ✓</h1>`}
      <div class="box" style="text-align:left;max-width:340px;margin:12px auto;font-size:14px;line-height:1.7;">
        <div>✅ Выполнено упражнений: <b>${steps.length}</b></div>
        <div>📚 Всего слов в твоей памяти: <b>${totalLearnedNow}</b></div>
        <div>⭐ Уверенно узнаёшь сразу: <b>${totalConfidentNow}</b></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:340px;margin:12px auto 0;">
        ${nextTaskBtn}
        <div class="row" style="justify-content:center;gap:10px;">
          <button id="againBtn" class="ghost" style="flex:1;">Ещё раз</button>
          <button id="backHomeBtn" class="ghost" style="flex:1;font-weight:700;">К списку заданий</button>
        </div>
      </div></section>`;
    if (nextUnfinished) {
      app.querySelector('#nextTaskBtn').onclick = () => {
        stopAudio();
        startMode(nextUnfinished.id);
      };
    }
    app.querySelector('#againBtn').onclick = () => {
      stopAudio();
      startMode(mode);
    };
    app.querySelector('#backHomeBtn').onclick = () => {
      stopAudio();
      if (location.hash === '#/' || !location.hash) home();
      else location.hash = '#/';
    };
    return;
  }
    }
    const st = steps[i++];
    if (st.type === 'card') renderCard(app, st.word, srs, next, st.meta);
    else if (st.type === 'read') renderReadCard(app, st.word, srs, next, st.meta);
    else if (st.type === 'tone') renderToneCard(app, st.word, srs, next, st.meta);
    else if (st.type === 'blitz') renderBlitzCard(app, st.word, srs, next, st.meta);
    else if (st.type === 'story') renderStoryCard(app, stories, { p1: getLevelProgress(1), p2: getLevelProgress(2), p3: getLevelProgress(3) }, srs, next);
    else renderPhraseChoice(app, st.sentence, sentences, srs, next);
  }
  next();
}
async function downloadLevelsUpTo(maxLvl, stEl) {
  const levels = Array.from({ length: maxLvl }, (_, idx) => idx + 1);
  if (stEl) stEl.textContent = `Загрузка словаря HSK 1–${maxLvl}...`;
  const host = 'raw.' + 'github' + 'usercontent.com';
  const ruUrl = 'https://' + host + '/LiudmilaLV/json_hsk/master/hsk.json';
  const [resNew, resRu] = await Promise.all([
    fetch('./hsk.json?v=' + Date.now()),
    fetch(ruUrl).catch(() => null)
  ]);
  if (!resNew.ok) throw new Error('HTTP ' + resNew.status);
  const raw = await resNew.json();
  const shortRu = str => {
    const firstMeaning = String(str || '')
      .split(/[,;/(]/)
      .map(s => s.trim())
      .find(Boolean) || '';
    return firstMeaning.split(/\s+/).slice(0, 2).join(' ');
  };
  const ruMap = new Map();
  if (resRu && resRu.ok) {
    const ruList = await resRu.json();
    ruList.forEach(w => {
      if (w.hanzi && w.translations && Array.isArray(w.translations.rus)) {
        ruMap.set(w.hanzi, {
          ru: shortRu(w.translations.rus.at(0)),
          pinyin: w.pinyin || ''
        });
      }
    });
  }
  const parsed = [];
  const needTranslate = [];
  for (const item of raw) {
    if (item.hanzi && item.level) {
      const hanzi = String(item.hanzi).trim();
      const newLvl = Number(item.level);
      if (!hanzi || !levels.includes(newLvl)) continue;
      const found = ruMap.get(hanzi);
      const pinyin = String(item.pinyin || (found && found.pinyin) || '').trim();
      if (found && found.ru && /[а-яё]/i.test(found.ru)) {
        parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi, pinyin, ru: found.ru, level: newLvl });
      } else {
        const en = String(item.ru || '').replace(/\([^)]*\)/g, '').split(/[,;/]/).at(0).trim();
        if (en) needTranslate.push({ hanzi, pinyin, en, level: newLvl });
      }
      continue;
    }
    const lvls = item.l || item.level || Array.of();
    const newLvl = levels.find(n => lvls.includes('n' + n));
    if (!newLvl) continue;
    const forms = item.f || item.forms || Array.of();
    const form = forms.at(0) || {};
    const hanzi = item.s || item.simplified;
    if (!hanzi) continue;
    const found = ruMap.get(hanzi);
    const rawI = Array.isArray(form.i) ? form.i.at(0) : form.i;
    const pinyin =
      (typeof rawI === 'string' ? rawI : (rawI && (rawI.y || rawI.pinyin || rawI.p))) ||
      form.p ||
      (found && found.pinyin) ||
      '';
    if (found && found.ru && /[а-яё]/i.test(found.ru)) {
      parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi, pinyin, ru: found.ru, level: newLvl });
    } else {
      const meanings = form.m || form.meanings || Array.of();
      const en = String(meanings.at(0) || '').replace(/\([^)]*\)/g, '').split(/[,;/]/).at(0).trim();
      if (en) needTranslate.push({ hanzi, pinyin, en, level: newLvl });
    }
  }
  const BATCH = 40;
  for (let i = 0; i < needTranslate.length; i += BATCH) {
    const chunk = needTranslate.slice(i, i + BATCH);
    if (stEl) stEl.textContent = `Подготовка слов HSK 1–${maxLvl}: ${parsed.length} / ${parsed.length + needTranslate.length}...`;
    try {
      const q = encodeURIComponent(chunk.map(x => x.en).join('\n'));
      const trHost = 'translate.' + 'google' + 'apis.com';
      const trRes = await fetch(`https://${trHost}/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${q}`);
      if (trRes.ok) {
        const trData = await trRes.json();
        const fullText = (trData.at(0) || []).map(part => part.at(0)).join('');
        const lines = fullText.split('\n');
        chunk.forEach((item, idx) => {
          const ru = shortRu(lines[idx]);
          if (ru && /[а-яё]/i.test(ru)) {
            parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi: item.hanzi, pinyin: item.pinyin, ru, level: item.level });
          }
        });
      }
    } catch {}
  }
  saveVocab(parsed);
  if (stEl) stEl.textContent = `Готово! Загружено ${parsed.length} слов (HSK 1–${maxLvl}).`;
  return parsed;
}

 async function startPlacementTest() {
  app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:95px 16px 20px;text-align:center;">
    <h2 style="margin:0 0 6px;font-size:24px;">Подготовка теста...</h2>
    <p id="plLoad" style="color:var(--muted);margin:0;font-size:14px;"></p>
    <div style="width:310px;height:310px;margin:-45px auto 0;position:relative;mix-blend-mode:multiply;">
      <img src="./goose_test.jpg" alt="Подготовка теста" style="width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;display:block;">
      <div style="position:absolute;top:24%;left:26%;width:15%;height:34%;background:#ffffff;pointer-events:none;"></div>
    </div>
  </section>`;

  try {
    const host = 'raw.' + 'github' + 'usercontent.com';
    const ruUrl = 'https://' + host + '/LiudmilaLV/json_hsk/master/hsk.json';
    const [resNew, resRu] = await Promise.all([
      fetch('./hsk.json?v=' + Date.now()),
      fetch(ruUrl).catch(() => null)
    ]);
    if (!resNew.ok) throw new Error('HTTP ' + resNew.status);
    const raw = await resNew.json();

    const shortRu = str => {
      const firstMeaning = String(str || '')
        .split(/[,;/(]/)
        .map(s => s.trim())
        .find(Boolean) || '';
      return firstMeaning.split(/\s+/).slice(0, 2).join(' ');
    };

    const ruMap = new Map();
    if (resRu && resRu.ok) {
      const ruList = await resRu.json();
      ruList.forEach(w => {
        if (w.hanzi && w.translations && Array.isArray(w.translations.rus)) {
          ruMap.set(w.hanzi, {
            ru: shortRu(w.translations.rus.at(0)),
            pinyin: w.pinyin || ''
          });
        }
      });
    }

    const byLvl = { lvl1: [], lvl2: [], lvl3: [], lvl4: [] };
    for (const item of raw) {
      let hanzi = '';
      let lvl = 0;
      let pinyin = '';
      let en = '';

      if (item.hanzi && item.level) {
        hanzi = String(item.hanzi).trim();
        lvl = Number(item.level);
        pinyin = String(item.pinyin || '').trim();
        en = String(item.ru || '').replace(/\([^)]*\)/g, '').split(/[,;/]/).at(0).trim();
      } else {
        const lvls = item.l || item.level || Array.of();
        lvl = Array.of(1, 2, 3, 4).find(n => lvls.includes('n' + n)) || 0;
        const forms = item.f || item.forms || Array.of();
        const form = forms.at(0) || {};
        hanzi = item.s || item.simplified || '';
        const rawI = Array.isArray(form.i) ? form.i.at(0) : form.i;
        pinyin = (typeof rawI === 'string' ? rawI : (rawI && (rawI.y || rawI.pinyin || rawI.p))) || form.p || '';
        const meanings = form.m || form.meanings || Array.of();
        en = String(meanings.at(0) || '').replace(/\([^)]*\)/g, '').split(/[,;/]/).at(0).trim();
      }

      const key = 'lvl' + lvl;
      if (!hanzi || !byLvl[key]) continue;
      const found = ruMap.get(hanzi);
      const ru = found && found.ru && /[а-яё]/i.test(found.ru) ? found.ru : '';
      byLvl[key].push({ hanzi, pinyin: pinyin || (found && found.pinyin) || '', ru, en, level: lvl });
    }

    const testQueue = [];
    const pickTwo = arr => arr.sort(() => Math.random() - 0.5).slice(0, 2);

    for (const lvl of Array.of(1, 2, 3, 4)) {
      const list = byLvl['lvl' + lvl];
      const third = Math.max(2, Math.floor(list.length / 3));
      const easy = pickTwo(list.slice(0, third)).map(w => ({ ...w, diff: 'easy' }));
      const mid = pickTwo(list.slice(third, third * 2)).map(w => ({ ...w, diff: 'medium' }));
      const hard = pickTwo(list.slice(third * 2)).map(w => ({ ...w, diff: 'hard' }));
      testQueue.push(...easy, ...mid, ...hard);
    }

    const needTr = testQueue.filter(w => !w.ru && w.en);
    if (needTr.length) {
      try {
        const q = encodeURIComponent(needTr.map(x => x.en).join('\n'));
        const trHost = 'translate.' + 'google' + 'apis.com';
        const trRes = await fetch(`https://${trHost}/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${q}`);
        if (trRes.ok) {
          const trData = await trRes.json();
          const lines = (trData.at(0) || []).map(part => part.at(0)).join('').split('\n');
          needTr.forEach((item, i) => {
            const ru = shortRu(lines[i]);
            if (ru && /[а-яё]/i.test(ru)) item.ru = ru;
          });
        }
      } catch {}
    }

    const validQueue = testQueue.filter(w => w.ru);
    const allRuPool = Array.from(new Set(validQueue.map(w => w.ru)));

    let idx = 0;
    const statsByLvl = {
      lvl1: { ok: 0, hardOk: 0 },
      lvl2: { ok: 0, hardOk: 0 },
      lvl3: { ok: 0, hardOk: 0 },
      lvl4: { ok: 0, hardOk: 0 }
    };

    function renderQuestion() {
      if (idx >= validQueue.length) {
        let detected = 1;
        for (const lvl of Array.of(1, 2, 3)) {
          const st = statsByLvl['lvl' + lvl];
          if (st.ok >= 5 && st.hardOk >= 1) {
            detected = lvl + 1;
          } else {
            break;
          }
        }

        app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
          <h1>Тест завершён! 🎯</h1>
          <div class="box" style="text-align:left;margin:14px 0;font-size:14px;line-height:1.7;">
            <div>HSK 1: <b>${statsByLvl.lvl1.ok}/6</b> верно</div>
            <div>HSK 2: <b>${statsByLvl.lvl2.ok}/6</b> верно</div>
            <div>HSK 3: <b>${statsByLvl.lvl3.ok}/6</b> верно</div>
            <div>HSK 4: <b>${statsByLvl.lvl4.ok}/6</b> верно</div>
          </div>
          <p style="font-size:16px;font-weight:700;color:var(--jade);">Рекомендуемый старт: HSK ${detected}</p>
          <p id="plSaveStatus" style="font-size:14px;color:var(--accent);font-weight:600;margin-top:8px;">Загружаем словарь HSK 1–${detected}...</p>
        </section>`;

        downloadLevelsUpTo(detected, app.querySelector('#plSaveStatus')).then(() => {
          localStorage.setItem('hsk_start_lvl', String(detected));
          selectedLevel = String(detected);
          selectedLesson = 0;
          localStorage.setItem('hsk_lvl', selectedLevel);
          localStorage.setItem('hsk_les', '0');
          history.replaceState(null, '', '#/');
          home();
        });
        return;
      }

      const cur = validQueue[idx];
      const distractors = allRuPool
        .filter(r => r !== cur.ru)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const options = Array.of(cur.ru, ...distractors).sort(() => Math.random() - 0.5);

        app.innerHTML = `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="color:var(--accent);font-weight:800;font-size:15px;letter-spacing:0.5px;text-transform:uppercase;">ОПРЕДЕЛЕНИЕ УРОВНЯ</span>
            <span style="color:var(--muted);font-size:13px;font-weight:600;">${idx + 1} / ${validQueue.length}</span>
          </div>
          <div id="plAudioBox" class="card-audio"></div>
          <p class="prompt">Выбери перевод услышанного слова</p>
          <div id="plAnswers" class="answers" style="grid-template-columns:1fr 1fr;"></div>
          <button id="plSkip" class="ghost" style="width:100%;margin-top:12px;font-size:15px;font-weight:600;background:#FBF4EA;border-color:#E5CFAF;color:#8A5A1E;">Не знаю</button>
        </div>`;
        mountAudioControl(
          app.querySelector('#plAudioBox'),
          r => speak(cur.hanzi, { rate: r }),
          { autoPlay: true }
        );
      const ansBox = app.querySelector('#plAnswers');
      let locked = false;
      const showCorrect = () => {
        Array.from(ansBox.children).forEach(x => {
          if (x.textContent === cur.ru) x.classList.add('ok');
        });
      };
      options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'answer';
        b.style.fontSize = '16px';
        b.style.padding = '13px';
        b.textContent = opt;
        b.onclick = () => {
          if (locked) return;
          locked = true;
          const ok = opt === cur.ru;
          b.classList.add(ok ? 'ok' : 'bad');
          if (!ok) {
            showCorrect();
          } else {
            const st = statsByLvl['lvl' + cur.level];
            st.ok += 1;
            if (cur.diff === 'hard') st.hardOk += 1;
          }
          idx += 1;
          setTimeout(renderQuestion, 600);
        };
        ansBox.appendChild(b);
      });

      app.querySelector('#plSkip').onclick = () => {
        if (locked) return;
        locked = true;
        showCorrect();
        idx += 1;
        setTimeout(renderQuestion, 750);
      };
    }

    renderQuestion();
  } catch (e) {
    app.innerHTML = `<section class="hero"><h2>Не удалось загрузить тест</h2>
      <p style="color:var(--accent);">${e.message}</p>
      <a href="#/" class="cta">Назад</a></section>`;
  }
   }
async function startLevelUpTest() {
  const curLvl = Number(selectedLevel) || 1;
  const targetLvl = Math.min(4, curLvl + 1);

  app.innerHTML = `<section class="hero" style="padding:32px 16px;">
    <h2>Экспресс-проверка на HSK ${targetLvl} 🚀</h2>
    <p id="luStatus" style="color:var(--muted);">Готовим 10 проверочных слов...</p>
  </section>`;

  try {
    await downloadLevelsUpTo(targetLvl, app.querySelector('#luStatus'));
    const curPool = allWords.filter(w => Number(w.level) === curLvl && /[а-яё]/i.test(w.ru));
    const nextPool = allWords.filter(w => Number(w.level) === targetLvl && /[а-яё]/i.test(w.ru));

    const pick = (arr, n) => Array.from(arr).sort(() => Math.random() - 0.5).slice(0, n);
    const queue = pick(curPool, 5).concat(pick(nextPool, 5)).sort(() => Math.random() - 0.5);
    const ruPool = Array.from(new Set(allWords.filter(w => /[а-яё]/i.test(w.ru)).map(w => w.ru)));

    let idx = 0;
    let score = 0;

    function renderStep() {
      if (idx >= queue.length) {
        const passed = score >= 8;
        if (passed) {
          localStorage.setItem('hsk_start_lvl', String(targetLvl));
          selectedLevel = String(targetLvl);
          selectedLesson = 0;
          localStorage.setItem('hsk_lvl', selectedLevel);
          localStorage.setItem('hsk_les', '0');
        }
        localStorage.setItem('hsk_streak', '0');

        app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
          <h1>${passed ? `Уровень HSK ${targetLvl} открыт! 🎉` : 'Почти получилось! 💪'}</h1>
          <p style="font-size:16px;margin:10px 0;">Верных ответов: <b>${score} из ${queue.length}</b> (нужно минимум 8)</p>
          <p style="font-size:14px;color:var(--muted);">${passed ? 'Словарь нового уровня уже загружен, можно приступать к занятиям.' : 'Ещё немного практики на текущем уровне, и следующая попытка точно удастся!'}</p>
          <a href="#/" class="cta" style="margin-top:14px;display:inline-block;">Перейти к занятиям</a>
        </section>`;
        return;
      }

      const cur = queue[idx];
      const distractors = ruPool.filter(r => r !== cur.ru).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = Array.of(cur.ru, ...distractors).sort(() => Math.random() - 0.5);
      let playCount = 0;

      app.innerHTML = `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
          <span style="color:var(--accent);font-weight:700;">🚀 Проверка на HSK ${targetLvl}</span>
          <span style="color:var(--muted);">${idx + 1} / ${queue.length}</span>
        </div>
        <div class="card-audio" style="flex-direction:column;align-items:center;gap:8px;">
          <button id="luPlay" class="big-play" style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;padding:0;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#FFFDF9" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <span style="font-size:12px;color:var(--muted);">Нажми для повтора медленнее</span>
        </div>
        <p class="prompt">Выбери перевод услышанного слова</p>
        <div id="luAns" class="answers" style="grid-template-columns:1fr;"></div>
      </div>`;

      const play = () => {
        speak(cur.hanzi, { rate: playCount % 2 === 1 ? 0.72 : 1.0 });
        playCount += 1;
      };
      app.querySelector('#luPlay').onclick = play;
      play();

      const box = app.querySelector('#luAns');
      let locked = false;
      opts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'answer';
        b.style.fontSize = '16px';
        b.style.padding = '13px';
        b.textContent = opt;
        b.onclick = () => {
          if (locked) return;
          locked = true;
          const ok = opt === cur.ru;
          b.classList.add(ok ? 'ok' : 'bad');
          if (ok) score += 1;
          else Array.from(box.children).forEach(x => { if (x.textContent === cur.ru) x.classList.add('ok'); });
          idx += 1;
          setTimeout(renderStep, 600);
        };
        box.appendChild(b);
      });
    }

    renderStep();
  } catch (e) {
    app.innerHTML = `<section class="hero"><h2>Ошибка теста</h2><p>${e.message}</p><a href="#/" class="cta">Назад</a></section>`;
  }
}
function stats() {
  const inProgress = Object.values(srs).filter(s => s.reps >= 1).length;
  const confident = Object.values(srs).filter(s => s.reps >= 3).length;
  let dictFilter = 'learned';
  let dictQuery = '';

  app.innerHTML = `<section style="max-width:440px;margin:0 auto;">
    <h2 style="margin-top:0;text-align:center;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;">СЛОВАРЬ И ПРОГРЕСС</h2>
    <div class="box" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;padding:12px;">
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--fg);">${allWords.length}</div>
        <div style="font-size:12px;color:var(--muted);">В базе</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--beak);">${inProgress}</div>
        <div style="font-size:12px;color:var(--muted);">В повторении</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--jade);">${confident}</div>
        <div style="font-size:12px;color:var(--muted);">Уверенно</div>
      </div>
    </div>

    <div class="box" style="margin-top:14px;">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button data-dfilter="learned" class="ghost" style="flex:1;padding:7px 6px;font-size:13px;border-color:var(--jade);background:#EDF5F0;font-weight:600;">Изученные (${inProgress})</button>
        <button data-dfilter="all" class="ghost" style="flex:1;padding:7px 6px;font-size:13px;">Все слова (${allWords.length})</button>
      </div>
      <input type="search" id="dictSearch" placeholder="Поиск по иероглифу, пиньиню или переводу..." style="width:100%;padding:9px 12px;border-radius:12px;border:1.5px solid var(--border);font-size:14px;margin-bottom:10px;">
    <div id="dictList" style="display:flex;flex-direction:column;gap:6px;max-height:210px;overflow-y:auto;"></div>
    </div>

    <div class="box" style="margin-top:14px;">
    <h3 style="margin-top:0;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">ОФЛАЙН-БАЗА СЛОВ</h3>
      <p style="color:var(--muted);font-size:13px;">Скачай полный словарь HSK 1–4 в память или добавь свой список слов из файла <b>.txt</b> / <b>.csv</b>.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        <button id="fetchHsk" class="cta" style="border:none;cursor:pointer;margin:0;text-align:center;">Скачать полный словарь HSK 1–4</button>

        <details style="background:#FAFBF9;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:13px;">
          <summary style="cursor:pointer;font-weight:600;color:var(--jade);">Как подготовить и загрузить свой файл?</summary>
          <div style="margin-top:8px;line-height:1.5;color:var(--fg);">
            <div><b>1.</b> Создай файл в «Блокноте», «Заметках» или Excel и сохрани его в формате <b>.txt</b> или <b>.csv</b> (кодировка UTF-8).</div>
            <div style="margin-top:4px;"><b>2.</b> Запиши каждое слово с новой строки через точку с запятой:</div>
            <pre style="background:#F0F4F1;padding:8px;border-radius:8px;margin:6px 0;font-size:12px;overflow-x:auto;">你好;nǐ hǎo;привет;1
谢谢;xièxie;спасибо;1
学习;xuéxí;учиться;2</pre>
            <div><b>3.</b> Пиньинь и цифру уровня (1–4) можно не указывать (например: <code>苹果;;яблоко</code> — по умолчанию поставится 4 уровень).</div>
            <div style="margin-top:4px;color:var(--beak);">⚠️ Загрузка своего файла заменит текущий словарь в памяти устройства.</div>
          </div>
        </details>

        <label class="ghost" style="text-align:center;cursor:pointer;font-size:14px;font-weight:600;">
          📂 Выбрать файл (.txt / .csv)
          <input type="file" id="csvFile" accept=".txt,.csv" style="display:none;">
        </label>
      </div>
      <p id="fetchStatus" style="margin-top:8px;font-size:13px;color:var(--jade);"></p>
    </div>
  </section>`;
  const listEl = app.querySelector('#dictList');
  const renderDict = () => {
    const q = dictQuery.trim().toLowerCase();
    let items = dictFilter === 'learned'
      ? allWords.filter(w => srs[w.id] && srs[w.id].reps >= 1)
      : allWords;
    if (q) {
      items = items.filter(w =>
        (w.hanzi && w.hanzi.toLowerCase().includes(q)) ||
        (w.pinyin && w.pinyin.toLowerCase().includes(q)) ||
        (w.ru && w.ru.toLowerCase().includes(q))
      );
    }
    if (!items.length) {
      listEl.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0;">Пока пусто — пройди несколько слов в «Заданиях» или переключись на «Все слова»</div>`;
      return;
    }
    const shown = items.slice(0, 80);
    listEl.innerHTML = shown.map(w => {
      const reps = (srs[w.id] && srs[w.id].reps) || 0;
      const mark = reps >= 3 ? '★' : (reps >= 1 ? '✓' : '');
      return `<button data-say="${w.hanzi}" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#FAFBF9;border:1px solid var(--border);border-radius:12px;cursor:pointer;text-align:left;gap:8px;">
        <div>
          <span style="font-size:17px;font-weight:700;color:var(--fg);">${w.hanzi}</span>
          <span style="font-size:13px;color:var(--jade);margin-left:6px;">${w.pinyin || ''}</span>
          <div style="font-size:13px;color:var(--muted);margin-top:2px;">${w.ru}</div>
        </div>
        <span style="font-size:13px;color:var(--jade);font-weight:700;flex-shrink:0;">${mark} 🔊</span>
      </button>`;
    }).join('') + (items.length > 80 ? `<div style="text-align:center;font-size:12px;color:var(--muted);padding:6px;">Показаны первые 80 из ${items.length} слов — уточни поиск</div>` : '');

    listEl.querySelectorAll('[data-say]').forEach(b => {
      b.onclick = () => speak(b.dataset.say, { rate: 0.95, instant: true });
    });
  };

  app.querySelectorAll('[data-dfilter]').forEach(btn => {
    btn.onclick = () => {
      dictFilter = btn.dataset.dfilter;
      app.querySelectorAll('[data-dfilter]').forEach(x => {
        const active = x.dataset.dfilter === dictFilter;
        x.style.borderColor = active ? 'var(--jade)' : '';
        x.style.background = active ? '#EDF5F0' : '';
        x.style.fontWeight = active ? '600' : '500';
      });
      renderDict();
    };
  });

  app.querySelector('#dictSearch').oninput = e => {
    dictQuery = e.target.value;
    renderDict();
  };

  renderDict();

  app.querySelector('#fetchHsk').onclick = async () => {
    const st = app.querySelector('#fetchStatus');
    try {
      await downloadLevelsUpTo(4, st);
      renderDict();
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
function settings() {
  const remOn = localStorage.getItem('hsk_rem_on') === '1';
  const remTime = localStorage.getItem('hsk_rem_time') || '19:00';
  const sfxOn = localStorage.getItem('hsk_sfx_off') !== '1';
  const sfxTheme = localStorage.getItem('hsk_sfx_theme') || 'jade';
  const morningResetOn = localStorage.getItem('hsk_morning_reset') === '1';
  const examDateVal = localStorage.getItem('hsk_exam_date') || '';
  app.innerHTML = `<section style="max-width:440px;margin:0 auto;">
    <h2 style="margin-top:0;text-align:center;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;">НАСТРОЙКИ</h2>

    <div class="box" style="padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">МОЙ УРОВЕНЬ HSK</h3>
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Переключись на другой уровень<br>или пройди входной тест заново:</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        <button data-set-lvl="1" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '1' ? 'border-color:var(--jade);background:#EDF5F0;font-weight:700;' : ''}">HSK 1</button>
        <button data-set-lvl="2" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '2' ? 'border-color:var(--jade);background:#EDF5F0;font-weight:700;' : ''}">HSK 2</button>
        <button data-set-lvl="3" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '3' ? 'border-color:var(--jade);background:#EDF5F0;font-weight:700;' : ''}">HSK 3</button>
        <button data-set-lvl="4" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '4' ? 'border-color:var(--jade);background:#EDF5F0;font-weight:700;' : ''}">HSK 4</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <a href="#/placement" class="ghost" style="flex:1;text-align:center;font-size:13px;padding:9px 8px;">🎯 Входной тест заново</a>
        <button id="resetMoodBtn" class="ghost" style="flex:1;font-size:13px;padding:9px 8px;">🎭 Сменить настроение</button>
      </div>
      <p id="lvlSwitchStatus" style="margin:8px 0 0;font-size:13px;color:var(--jade);text-align:center;"></p>
    </div>

    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 10px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">ЗВУК ОТВЕТОВ</h3>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" id="sfxToggle" ${sfxOn ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--jade);">
          <div style="position:relative;display:inline-flex;align-items:center;">
            <select id="sfxThemeSelect" style="appearance:none;-webkit-appearance:none;background:#EDF5F0;border:1.5px solid var(--jade);border-radius:10px;padding:6px 26px 6px 10px;font-size:13px;font-weight:700;color:var(--fg);cursor:pointer;">
              <option value="jade" ${sfxTheme === 'jade' ? 'selected' : ''}>Нефритовая капля</option>
              <option value="guzheng" ${sfxTheme === 'guzheng' ? 'selected' : ''}>Шорох бамбука</option>
              <option value="bell" ${sfxTheme === 'bell' ? 'selected' : ''}>Горное эхо</option>
            </select>
            <span style="position:absolute;right:9px;pointer-events:none;font-size:10px;color:var(--jade);">▼</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="testSfxOk" class="ghost" style="font-size:13px;padding:6px 10px;">Верно</button>
          <button id="testSfxBad" class="ghost" style="font-size:13px;padding:6px 10px;">Ошибка</button>
        </div>
      </div>
    </div>
    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">НОЧНЫЕ ЗАНЯТИЯ (ПОСЛЕ 00:00)</h3>
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Если выполнила план ночью после 12,<br>обновлять ли задание снова утром (с 06:00)?</p>
      <div style="display:flex;align-items:center;justify-content:center;">
        <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;cursor:pointer;">
          <input type="checkbox" id="morningResetToggle" ${morningResetOn ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--jade);cursor:pointer;">
          Обновлять задание утром заново
        </label>
      </div>
    </div>
    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">ПОДГОТОВКА К ЭКЗАМЕНУ HSK</h3>
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Укажи дату экзамена или запусти спринт —<br>программа сама рассчитает норму слов на день.</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
        <input type="date" id="examDateInput" value="${examDateVal}" style="padding:7px 10px;border-radius:10px;border:1.5px solid var(--border);font-size:14px;font-weight:600;">
        <button id="sprint30Btn" class="ghost" style="font-size:13px;padding:7px 10px;border-color:#F3D19E;background:#FFF4E6;color:#8A4B08;font-weight:700;">🔥 Спринт 30 дн.</button>
        <button id="clearExamBtn" class="ghost" style="font-size:13px;padding:7px 10px;">Сброс</button>
      </div>
      <p id="examStatus" style="margin:8px 0 0;font-size:13px;color:var(--jade);text-align:center;font-weight:600;"></p>
    </div>
    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">ЕЖЕДНЕВНАЯ НАПОМИНАЛКА</h3>
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Напомнит о занятиях,<br>если план на сегодня ещё не выполнен.</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px;cursor:pointer;">
          <input type="checkbox" id="remToggle" ${remOn ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--jade);">
          Включить
        </label>
        <input type="time" id="remTime" value="${remTime}" style="padding:6px 10px;border-radius:10px;border:1.5px solid var(--border);font-size:14px;">
        <button id="testNotify" class="ghost" style="font-size:13px;padding:6px 10px;">Проверить</button>
      </div>
      <p id="remStatus" style="margin:8px 0 0;font-size:13px;color:var(--jade);text-align:center;"></p>
    </div>

    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 8px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">КАК ДОБАВИТЬ НА ГЛАВНЫЙ ЭКРАН</h3>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;text-align:center;">
        <p style="margin:0 0 4px;"><b>iPhone:</b> «Поделиться» → «На экран „Домой“»</p>
        <p style="margin:0;"><b>Android:</b> Меню (⋮) → «На главный экран»</p>
      </div>
    </div>

    <div class="box" style="margin-top:14px;padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">ПОДДЕРЖКА</h3>
      <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Нашла опечатку в переводе, баг со звуком<br>или есть идея для тренажёра?</p>
      <a href="https://t.me" target="_blank" rel="noopener" class="cta" style="margin:0;display:block;text-align:center;font-size:14px;">Написать в поддержку (@alinaLinka20)</a>
    </div>
  </section>`;

  const lvlStEl = app.querySelector('#lvlSwitchStatus');
  lvlStEl.style.display = 'none';
  const remStatus = app.querySelector('#remStatus');
  remStatus.style.display = 'none';

  app.querySelectorAll('[data-set-lvl]').forEach(btn => {
    btn.onclick = async () => {
      const target = Number(btn.dataset.setLvl);
      lvlStEl.style.display = 'block';
      await downloadLevelsUpTo(target, lvlStEl);
      localStorage.setItem('hsk_start_lvl', String(target));
      selectedLevel = String(target);
      selectedLesson = 0;
      localStorage.setItem('hsk_lvl', selectedLevel);
      localStorage.setItem('hsk_les', '0');
      location.hash = '#/';
    };
  });

  app.querySelector('#resetMoodBtn').onclick = () => {
    localStorage.removeItem(getTodayMoodKey());
    location.hash = '#/';
  };

  app.querySelector('#sfxToggle').onchange = e => {
    localStorage.setItem('hsk_sfx_off', e.target.checked ? '0' : '1');
    if (e.target.checked) playFeedback(true);
  };
  app.querySelector('#sfxThemeSelect').onchange = e => {
    localStorage.setItem('hsk_sfx_theme', e.target.value);
    localStorage.setItem('hsk_sfx_off', '0');
    app.querySelector('#sfxToggle').checked = true;
    playFeedback(true);
  };
  app.querySelector('#testSfxOk').onclick = () => playFeedback(true);
  app.querySelector('#testSfxBad').onclick = () => playFeedback(false);
  app.querySelector('#morningResetToggle').onchange = e => {
    localStorage.setItem('hsk_morning_reset', e.target.checked ? '1' : '0');
  };
    const examStatusEl = app.querySelector('#examStatus');
  if (!examDateVal) examStatusEl.style.display = 'none';
  else examStatusEl.textContent = 'Дата экзамена сохранена: ' + examDateVal;

  app.querySelector('#examDateInput').onchange = e => {
    const val = e.target.value;
    examStatusEl.style.display = 'block';
    if (val) {
      localStorage.setItem('hsk_exam_date', val);
      examStatusEl.textContent = 'Цель установлена на ' + val + ' — план пересчитан!';
    } else {
      localStorage.removeItem('hsk_exam_date');
      examStatusEl.textContent = 'Дата сброшена — включён обычный ритм.';
    }
  };

  app.querySelector('#sprint30Btn').onclick = () => {
    const d30 = new Date(Date.now() + 30 * 86400000);
    const iso = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
    localStorage.setItem('hsk_exam_date', iso);
    app.querySelector('#examDateInput').value = iso;
    examStatusEl.style.display = 'block';
    examStatusEl.textContent = '🔥 Спринт 30 дней запущен (экзамен ' + iso + ')!';
  };

  app.querySelector('#clearExamBtn').onclick = () => {
    localStorage.removeItem('hsk_exam_date');
    app.querySelector('#examDateInput').value = '';
    examStatusEl.style.display = 'block';
    examStatusEl.textContent = 'Включён обычный ритм подготовки.';
  };
  app.querySelector('#remToggle').onchange = async e => {
    remStatus.style.display = 'block';
    if (e.target.checked) {
      if (!('Notification' in window)) {
        remStatus.textContent = 'Браузер не поддерживает уведомления (добавь сайт на экран «Домой»).';
        e.target.checked = false;
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        remStatus.textContent = 'Разрешение на уведомления не выдано в настройках браузера.';
        e.target.checked = false;
        return;
      }
      localStorage.setItem('hsk_rem_on', '1');
      remStatus.textContent = 'Напоминание включено на ' + app.querySelector('#remTime').value;
    } else {
      localStorage.setItem('hsk_rem_on', '0');
      remStatus.textContent = 'Напоминания отключены.';
    }
  };

  app.querySelector('#remTime').onchange = e => {
    localStorage.setItem('hsk_rem_time', e.target.value);
    if (localStorage.getItem('hsk_rem_on') === '1') {
      remStatus.style.display = 'block';
      remStatus.textContent = 'Время напоминания обновлено: ' + e.target.value;
    }
  };

  app.querySelector('#testNotify').onclick = async () => {
    remStatus.style.display = 'block';
    if (!('Notification' in window)) {
      remStatus.textContent = 'Уведомления недоступны в этом режиме.';
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('HSK 3.0 听力训练 🦆', {
        body: 'Пора размять слух! Загляни выполнить план на сегодня.',
        icon: getNotifyGooseIcon()
      });
      remStatus.textContent = 'Тестовое уведомление отправлено!';
    } else {
      remStatus.textContent = 'Разреши уведомления в настройках браузера.';
    }
  };
}

let lastKnownDay = getTodayMoodKey();
setInterval(() => {
  const curDay = getTodayMoodKey();
  if (curDay !== lastKnownDay) {
    lastKnownDay = curDay;
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) home();
  }
  if (localStorage.getItem('hsk_rem_on') !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const target = localStorage.getItem('hsk_rem_time') || '19:00';
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const todaySentKey = 'hsk_rem_sent_' + now.toISOString().slice(0, 10);
  if (hhmm === target && !localStorage.getItem(todaySentKey)) {
    const d = getDaily();
    const doneAll = d.words >= 12 && d.blitz >= 10 && d.phrases >= 4 && d.stories >= 2;
    localStorage.setItem(todaySentKey, '1');
    if (!doneAll) {
new Notification('HSK 3.0 听力训练 🦆', {
        body: 'Пора размять слух! План на сегодня ещё ждёт тебя.',
          icon: getNotifyGooseIcon()
      });
    }
  }
}, 30000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  }).catch(() => {});
}
