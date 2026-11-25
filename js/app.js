import { storageReady, safeStorage, getSavedEmail, getSavedName, setSavedName, loginByEmail, logoutEmail, pushCloudState, pullCloudState } from './storage.js?v=7';
import { renderSettings } from './screens/settings.js?v=6';
import { renderOnboarding } from './screens/onboarding.js?v=2';
import { renderStats } from './screens/stats.js?v=1';
import { words as defaultWords, sentences, stories } from './data.js?v=2';
import { renderLiveChinese } from './screens/live.js?v=1';
import { renderPlacementTest, renderLevelUpTest } from './screens/tests.js?v=1';
import { loadSRS, saveSRS, dueItems } from './srs.js?v=2';
import { renderCard, renderBlitzCard, renderReadCard, renderToneCard } from './screens/card.js?v=58';
import { renderPhraseChoice, renderStoryCard } from './screens/segment.js?v=14';
import { speak, stopAudio, mountAudioControl, playFeedback } from './audio.js?v=13';
function readUrlState() {
  try {
    const h = String(location.hash || '');
    const qIdx = h.indexOf('?');
    if (qIdx === -1) return {};
    const params = new URLSearchParams(h.slice(qIdx + 1));
    return {
      l: params.get('l') || '',
      les: params.get('les') || '',
      m: params.get('m') || '',
      me: params.get('me') || '',
      mr: params.get('mr') || ''
    };
  } catch (e) {
    return {};
  }
}
function syncUrlState() {
  try {
    const h = String(location.hash || '#/');
    const base = h.split('?').at(0) || '#/';
    const params = new URLSearchParams();
    const lvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl');
    if (lvl && lvl !== 'all') params.set('l', lvl);
    const les = safeStorage.getItem('hsk_les');
    if (les) params.set('les', les);
       const mood = getTodayMood();
    if (mood) params.set('m', mood);
    if (safeStorage.getItem('hsk_morning_reset') === '1') {
      params.set('mr', '1');
    }
    const qs = params.toString();
    history.replaceState(null, '', qs ? `${base}?${qs}` : base);
  } catch (e) {}
}

const VOCAB_KEY = 'hsk_vocab_v13';
let allWords = loadVocab();
window.__ALL_WORDS = allWords;
let selectedLevel = safeStorage.getItem('hsk_lvl') || 'all';
let selectedLesson = +(safeStorage.getItem('hsk_les') || 0);
let lastMode = safeStorage.getItem('hsk_mode') || 'words';
const app = document.getElementById('app');
const srs = loadSRS();
storageReady.then(() => {
  const savedMail = getSavedEmail();
  if (!savedMail) return;
  pullCloudState(savedMail).then(async res => {
    if (res.ok && res.found) {
      const freshSrs = loadSRS();
      Object.keys(srs).forEach(k => { delete srs[k]; });
      Object.assign(srs, freshSrs);
      const newLvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl') || selectedLevel;
      const lvlChanged = String(newLvl) !== String(selectedLevel);
      selectedLevel = newLvl;
      selectedLesson = +(safeStorage.getItem('hsk_les') || selectedLesson);
      if (lvlChanged && typeof downloadLevelsUpTo === 'function') {
        await downloadLevelsUpTo(selectedLevel).catch(() => {});
      }
      router();
    }
  }).catch(() => {});
});
if (!safeStorage.getItem('hsk_start_date')) {
  safeStorage.setItem('hsk_start_date', new Date().toISOString());
}
const SB_URL = 'https://srtoxpakayozfeqxjqdd.supabase.co';

const SB_KEY = 'sb_publishable_EvXS1QB5OMOKnK8poiXCTQ_VXMcefQ2';

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-install-ready'));
});

function getInstallBoxHtml() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return '';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isRestricted = /YaBrowser|Telegram|VKClient|Instagram|FBAN|FBAV|OKApp/i.test(ua);

  const guideLines = `
    <div style="text-align:left;font-size:13px;line-height:1.45;color:var(--fg);margin-bottom:10px;display:flex;flex-direction:column;gap:6px;">
      <div><b>iPhone (только через Safari):</b> нажми «Поделиться» (квадрат со стрелкой вверх) → «На экран „Домой“».</div>
      <div><b>Android (только через Google Chrome):</b> нажми кнопку ниже или три точки (⋮) → «Установить приложение».</div>
      <div><b>Яндекс Браузер, Telegram или ВК:</b> скопируй ссылку и открой её в Safari или Chrome.</div>
    </div>`;

  if (isRestricted) {
    return `
      <div style="margin-top:8px;padding:12px;border-radius:12px;background:#FFF4E6;border:1px solid #F3D19E;">
        ${guideLines}
        <button class="ghost copy-app-link-btn" style="width:100%;font-size:13px;padding:9px 12px;border-color:#F3D19E;background:#fff;color:#8A4B08;font-weight:700;">Скопировать ссылку для Safari / Chrome</button>
      </div>`;
  }
  if (isIOS) {
    return `
      <div style="margin-top:8px;padding:12px;border-radius:12px;background:#EDF5F0;border:1px solid var(--jade);">
        ${guideLines}
      </div>`;
  }
  return `
    <div style="margin-top:8px;padding:12px;border-radius:12px;background:#EDF5F0;border:1px solid var(--jade);">
      ${guideLines}
      <button class="primary pwa-install-btn" style="width:100%;font-size:14px;padding:10px 14px;">Установить приложение</button>
    </div>`;
}

function bindInstallActions(root) {
  root.querySelectorAll('.copy-app-link-btn').forEach(btn => {
    btn.onclick = () => {
      const url = location.href.split('#')[0].split('?')[0];
      let copied = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, 99999);
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
      if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      btn.textContent = 'Ссылка скопирована! Вставь её в Chrome или Safari';
      if (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('raw-app-url')) {
        const box = document.createElement('div');
        box.className = 'raw-app-url';
        box.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:8px;background:#fff;border:1px solid #F3D19E;font-size:13px;font-weight:600;color:#8A4B08;word-break:break-all;user-select:all;text-align:center;';
        box.textContent = url;
        btn.after(box);
      }
    };
  });

  root.querySelectorAll('.pwa-install-btn').forEach(btn => {
    btn.onclick = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        btn.textContent = '✅ Приложение установлено!';
      } else {
        btn.textContent = 'Нажми три точки (⋮) справа сверху → «Установить приложение»';
      }
    };
  });
}
function getEffectiveDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const base = `${y}-${m}-${day}`;
  if (safeStorage.getItem('hsk_morning_reset') === '1' && now.getHours() < 6) {
    return `${base}_night`;
  }
  return base;
}

function getNotifyGooseIcon() {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return './js/geese/goose_morning.jpg';
  if (h >= 12 && h < 14) return './js/geese/goose_lunch.jpg';
  if (h >= 10 && h < 21) return './js/geese/goose_bonsai.jpg';
  return './js/geese/goose_mood.jpg';
}

function getTodayKey() {
  return `hsk_daily_${getEffectiveDateStr()}`;
}

function getDaily() {
  try {
    const raw = JSON.parse(safeStorage.getItem(getTodayKey())) || {};
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
  safeStorage.setItem(getTodayKey(), JSON.stringify(d));
}
function getTodayMoodKey() {
  return `hsk_mood_${getEffectiveDateStr()}`;
}

function getTodayMood() {
  return safeStorage.getItem(getTodayMoodKey()) || '';
}
function setTodayMood(mood) {
  safeStorage.setItem(getTodayMoodKey(), mood);
  const prev = Number(safeStorage.getItem('hsk_tired_streak') || '0');
  const next = mood === 'tired' ? prev + 1 : 0;
  safeStorage.setItem('hsk_tired_streak', String(next));
}
function getMainWeakness() {
  try {
    const data = JSON.parse(safeStorage.getItem('hsk_weakness_v1') || '{}');
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
    const tiredDays = Number(safeStorage.getItem('hsk_tired_streak') || '1');
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
    const saved = JSON.parse(safeStorage.getItem(VOCAB_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return defaultWords.map(w => ({ ...w, level: 4 }));
}
function saveVocab(list) {
  allWords = list;
  window.__ALL_WORDS = list;
  safeStorage.setItem(VOCAB_KEY, JSON.stringify(list));
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
document.querySelectorAll('#topMenu a').forEach(a => {
  a.addEventListener('click', () => {
    const menu = document.getElementById('topMenu');
    if (menu) menu.removeAttribute('open');
    if (a.getAttribute('href') === '#/') {
      location.hash = '#/';
      home();
    }
  });
});
function router() {
  stopAudio();
  const h = location.hash.replace(/^#\/?/, '').split('?').at(0);
  if (h === 'session') startMode(lastMode);
  else if (h === 'words') startMode('words');
  else if (h === 'blitz') startMode('blitz');
  else if (h === 'phrases') startMode('phrases');
  else if (h === 'stories') startMode('stories');
  else if (h === 'placement') renderPlacementTest(app, {
    downloadLevelsUpTo,
    setSelectedLevel: v => { selectedLevel = v; },
    setSelectedLesson: v => { selectedLesson = v; },
    home
  });
  else if (h === 'levelup') renderLevelUpTest(app, {
    getSelectedLevel: () => selectedLevel,
    setSelectedLevel: v => { selectedLevel = v; },
    setSelectedLesson: v => { selectedLesson = v; },
    downloadLevelsUpTo,
    getAllWords: () => allWords
  });
  else if (h === 'stats') renderStats(app, { srs, getAllWords: () => allWords, saveVocab, markTodayVisit });
  else if (h === 'settings') renderSettings(app, {
    srs,
    getSelectedLevel: () => selectedLevel,
    setSelectedLevel: v => { selectedLevel = v; },
    setSelectedLesson: v => { selectedLesson = v; },
    downloadLevelsUpTo,
    getTodayMoodKey,
    getInstallBoxHtml,
    bindInstallActions,
    getNotifyGooseIcon,
    home
  });

  else if (h === 'live') renderLiveChinese(app, { getAllWords: () => allWords, SB_URL, SB_KEY });
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
  const uState = readUrlState();
  const handled = renderOnboarding(app, {
    srs,
    allWords,
    uState,
    getSelectedLevel: () => selectedLevel,
    setSelectedLevel: v => { selectedLevel = v; },
    setSelectedLesson: v => { selectedLesson = v; },
    downloadLevelsUpTo,
    syncUrlState,
    getTodayMood,
    setTodayMood,
    home
  });
  if (handled) return;

  const userStartLvl = Number(safeStorage.getItem('hsk_start_lvl') || 1);
  const p1 = getLevelProgress(1);
  const p2 = getLevelProgress(2);
  const p3 = getLevelProgress(3);
  const p4 = getLevelProgress(4);
  const p5 = getLevelProgress(5);
  const p6 = getLevelProgress(6);

  const unlocked2 = p1 >= 95 || userStartLvl >= 2;
  const unlocked3 = (unlocked2 && p2 >= 95) || userStartLvl >= 3;
  const unlocked4 = (unlocked3 && p3 >= 95) || userStartLvl >= 4;
  const unlocked5 = (unlocked4 && p4 >= 95) || userStartLvl >= 5;
  const unlocked6 = (unlocked5 && p5 >= 95) || userStartLvl >= 6;

  if (
    selectedLevel === 'all' ||
    (selectedLevel === '2' && !unlocked2) ||
    (selectedLevel === '3' && !unlocked3) ||
    (selectedLevel === '4' && !unlocked4) ||
    (selectedLevel === '5' && !unlocked5) ||
    (selectedLevel === '6' && !unlocked6)
  ) {
    selectedLevel = String(userStartLvl || 1);
    safeStorage.setItem('hsk_lvl', selectedLevel);
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

  let lessonAutoBanner = '';
  if (getLessonPct(selectedLesson) >= 85) {
    const allIndices = Array.from({ length: lessonCount }, (_, i) => i);
    const nextAfter = allIndices.find(i => i > selectedLesson && getLessonPct(i) < 85);
    const nextUnfinished = nextAfter !== undefined ? nextAfter : allIndices.find(i => getLessonPct(i) < 85);
    if (nextUnfinished !== undefined && nextUnfinished !== selectedLesson) {
      const finishedNum = selectedLesson + 1;
      selectedLesson = nextUnfinished;
      safeStorage.setItem('hsk_les', String(selectedLesson));
      lessonAutoBanner = `<div style="margin:6px auto 0;padding:8px 12px;border-radius:10px;background:#EDF5F0;border:1px solid #B7DEC6;font-size:13px;font-weight:600;color:var(--jade);max-width:420px;">🎉 Урок ${finishedNum} освоен! Открыли следующий — <b>Урок ${selectedLesson + 1}</b></div>`;
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
  const examDateStr = safeStorage.getItem('hsk_exam_date') || '';
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
    const allDoneBannerHtml = isPlanDoneToday
    ? `<div class="box" style="margin:6px auto 10px;padding:12px;background:#EDF5F0;border:1.5px solid var(--jade);text-align:center;">
         <div style="font-size:16px;font-weight:800;color:var(--jade);margin-bottom:4px;">🎉 На сегодня всё выполнено!</div>
         <div style="font-size:13px;color:var(--fg);">Весь дневной план закрыт. Хочешь позаниматься ещё? Выбери любое задание ниже!</div>
       </div>`
    : '';
  const surpriseKey = `hsk_surprise_hr_${getEffectiveDateStr()}`;
  let surpriseHr = Number(safeStorage.getItem(surpriseKey));
  if (!surpriseHr) {
    const daySlots = new Array(10, 11, 14, 15, 16, 17, 18, 19, 20);
    surpriseHr = daySlots[Math.floor(Math.random() * daySlots.length)];
    safeStorage.setItem(surpriseKey, String(surpriseHr));
  }

let gooseImg = './js/geese/goose.jpg';
  if (isPlanDoneToday) {
    gooseImg = './js/geese/goose_plan_done.gif';
  } else if (hr >= 6 && hr < 10) {
    gooseImg = './js/geese/goose_morning.jpg';
  } else if (hr >= 12 && hr < 14) {
    gooseImg = './js/geese/goose_lunch.jpg';
  } else if (hr >= 21 || hr < 6) {
    gooseImg = './js/geese/goose_night.jpg';
  } else if (hr === surpriseHr || curMood === 'tired') {
    gooseImg = './js/geese/goose_bonsai.jpg';
  }
  const streak = Number(safeStorage.getItem('hsk_streak') || 0);
  const nextLvl = curLvlNum + 1;
  const canLevelUp = streak >= 10 && curLvlNum < 6;
  const levelUpBanner = canLevelUp
    ? `<div class="box" style="width:100%;max-width:420px;margin:12px auto 0;background:#FFF8E7;border-color:#F59E0B;text-align:left;padding:12px;">
         <div style="font-weight:700;font-size:14px;color:#B45309;">🔥 Отличная серия: ${streak} верных ответов подряд!</div>
         <div style="font-size:13px;color:var(--fg);margin:4px 0 8px;">Хочешь пройти быстрый тест из 10 слов, чтобы досрочно открыть <b>HSK ${nextLvl}</b>?</div>
         <a href="#/levelup" class="cta" style="padding:8px 14px;font-size:13px;display:inline-block;">🚀 Проверить и открыть HSK ${nextLvl}</a>
       </div>`
    : '';
    const showProgress = safeStorage.getItem('hsk_show_progress') !== '0';
const curLvlPct = getLevelProgress(curLvlNum);
const progressBarHtml = showProgress ? `
  <div class="box" style="width:100%;max-width:420px;margin:8px auto 0;padding:10px 12px;text-align:left;">
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--fg);margin-bottom:6px;">
      <span>Уровень HSK ${curLvlNum}</span>
      <span style="color:var(--jade);">${curLvlPct}% до финиша</span>
    </div>
    <div style="width:100%;height:8px;background:#EFE7D6;border-radius:999px;overflow:hidden;">
      <div style="width:${curLvlPct}%;height:100%;background:var(--jade);border-radius:999px;transition:width 0.3s;"></div>
    </div>
  </div>` : '';
    app.innerHTML = `
    <section class="hero">
          ${(getSavedName() || getSavedEmail()) ? `<div style="margin:0 auto 6px;padding:6px 12px;border-radius:999px;background:#EDF5F0;border:1px solid #B7DEC6;display:inline-block;font-size:13px;font-weight:700;color:var(--jade);">👋 Привет, ${getSavedName() || getSavedEmail().split('@').at(0)}! Рад снова тебя видеть</div>` : ''}
      <div class="controls" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:2px auto 4px;">
        <select id="lvlSel" style="width:auto;min-width:128px;max-width:162px;padding:8px 10px;font-size:14px;text-align:center;">
          <option value="1" ${selectedLevel === '1' ? 'selected' : ''}>HSK 1 (${p1}%)</option>
          <option value="2" ${selectedLevel === '2' ? 'selected' : ''} ${unlocked2 ? '' : 'disabled'}>${unlocked2 ? `HSK 2 (${p2}%)` : 'HSK 2 🔒'}</option>
          <option value="3" ${selectedLevel === '3' ? 'selected' : ''} ${unlocked3 ? '' : 'disabled'}>${unlocked3 ? `HSK 3 (${p3}%)` : 'HSK 3 🔒'}</option>
          <option value="4" ${selectedLevel === '4' ? 'selected' : ''} ${unlocked4 ? '' : 'disabled'}>${unlocked4 ? `HSK 4 (${p4}%)` : 'HSK 4 🔒'}</option>
          <option value="5" ${selectedLevel === '5' ? 'selected' : ''} ${unlocked5 ? '' : 'disabled'}>${unlocked5 ? `HSK 5 (${p5}%)` : 'HSK 5 🔒'}</option>
          <option value="6" ${selectedLevel === '6' ? 'selected' : ''} ${unlocked6 ? '' : 'disabled'}>${unlocked6 ? `HSK 6 (${p6}%)` : 'HSK 6 🔒'}</option>
        </select>
        <select id="lesSel" style="width:auto;min-width:128px;max-width:162px;padding:8px 10px;font-size:14px;text-align:center;">${lessonOptions}</select>
      </div>
      <div style="color:var(--muted);font-size:12px;font-weight:700;letter-spacing:0.4px;margin:2px 0 6px;text-transform:uppercase;">
        ${curMood === 'tired' ? 'Антистресс-режим' : (curMood === 'high' ? 'Усиленный темп' : 'Обычный ритм')} · Фокус дня: закрепляем знакомое
      </div>
   ${levelUpBanner}
   ${lessonAutoBanner}
      <div style="width:100%;max-width:420px;margin:6px auto 0;display:flex;flex-direction:column;gap:8px;">
      ${allDoneBannerHtml}
        <div style="display:grid;grid-template-columns:1fr 56px 56px;align-items:baseline;gap:6px;margin-top:4px;padding:0 14px;">
          <span style="font-size:14px;font-weight:700;color:var(--fg);text-align:left;">План на сегодня:</span>
          <span style="font-size:11px;font-weight:600;color:var(--muted);text-align:center;">Сегодня</span>
          <span style="font-size:11px;font-weight:600;color:var(--muted);text-align:center;">Норма</span>
        </div>
        ${taskButtons}
      </div>
      ${progressBarHtml}
   ${examBannerHtml ? examBannerHtml : (safeStorage.getItem('hsk_settings_visited') ? '' : `<div style="margin:8px auto 0;padding:7px 12px;border-radius:10px;background:#F3EFE4;font-size:12px;color:var(--muted);max-width:420px;">Хочешь поменять уровень, звук или напоминания? Загляни в <a href="#/settings" style="color:var(--jade);font-weight:700;">Настройки</a></div>`)}
            <div style="width:100%;max-width:250px;margin:10px auto 0;text-align:center;">
        <img src="${gooseImg}" alt="Гусь-помощник" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;user-select:none;display:block;">
      </div>
      <div style="max-width:340px;margin:10px auto 0;text-align:center;">
        <button id="shareAppBtn" class="ghost" style="width:100%;padding:11px 16px;font-size:14px;font-weight:700;border-color:var(--jade);color:var(--jade);">🦆 Поделиться тренажёром с другом</button>
      </div>
    </section>`;

  app.querySelector('#lvlSel').onchange = e => {
    selectedLevel = e.target.value;
    selectedLesson = 0;
    safeStorage.setItem('hsk_lvl', selectedLevel);
    safeStorage.setItem('hsk_les', '0');
    history.replaceState(null, '', '#/');
    home();
  };
  app.querySelector('#lesSel').onchange = e => {
    selectedLesson = +e.target.value;
    safeStorage.setItem('hsk_les', String(selectedLesson));
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
      }      }
    }
  app.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      location.hash = '#/' + btn.dataset.mode;
    };
  });
}
function startMode(mode, extraRun = false) {
  lastMode = mode;
  safeStorage.setItem('hsk_mode', mode);
  const planNow = getDynamicPlan();
  const dStart = getDaily();
  const taskObj = planNow.tasks.find(t => t.id === mode);
  const taskGoal = taskObj ? taskObj.goal : (mode === 'words' ? 15 : mode === 'blitz' ? 12 : mode === 'phrases' ? 5 : 2);
  const doneBefore = dStart[mode] || 0;
  const remainingForPlan = extraRun ? taskGoal : Math.max(1, taskGoal - doneBefore);

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
    const weakMap = JSON.parse(safeStorage.getItem('hsk_weakness_v1') || '{}');
    const nowTs = Date.now();
    pool.sort((a, b) => {
      const sa = srs[a.id];
      const sb = srs[b.id];
      const dueA = !sa || !sa.due || sa.due <= nowTs ? 20 : 0;
      const dueB = !sb || !sb.due || sb.due <= nowTs ? 20 : 0;
      const wa = weakMap[a.id] ? (weakMap[a.id].audioErr + weakMap[a.id].toneErr + weakMap[a.id].readErr) * 5 : 0;
      const wb = weakMap[b.id] ? (weakMap[b.id].audioErr + weakMap[b.id].toneErr + weakMap[b.id].readErr) * 5 : 0;
      const repA = sa ? (sa.reps || 0) * 3 : 0;
      const repB = sb ? (sb.reps || 0) * 3 : 0;
      return (dueB + wb - repB) - (dueA + wa - repA) + (Math.random() - 0.5);
    });
    const needCount = Math.max(1, remainingForPlan);
    const baseRamp = buildRampQueue(pool);
    const pickedItems = Array.from({ length: needCount }, (_, idx) => {
      if (idx < baseRamp.length) return baseRamp[idx];
      const w = pool[idx % pool.length];
      return { word: w, tier: 'hard' };
    });
    const typesBase = Array.of('tone', 'read', 'card', 'card', 'card');
    steps = pickedItems.map((item, idx) => ({
      type: typesBase[idx % typesBase.length],
      word: item.word,
      meta: { tier: item.tier, label: `${idx + 1}/${pickedItems.length}` }
    }));
  } else if (mode === 'blitz') {
    const filtered = getFilteredWords();
    if (selectedLesson * 50 >= filtered.length) selectedLesson = 0;
    const slice = filtered.slice(selectedLesson * 50, (selectedLesson + 1) * 50);
    const ruOnly = slice.filter(w => /[а-яё]/i.test(w.ru) && !w.ru.includes('MYMEMORY'));
    const mainPool = ruOnly.length >= 4 ? ruOnly : slice;

    const curLvl = Number(selectedLevel) || 1;
    const needCount = Math.max(1, remainingForPlan);
    let mixedPool = Array.from(mainPool).sort((a, b) => {
      const ra = srs[a.id] ? (srs[a.id].reps || 0) : 0;
      const rb = srs[b.id] ? (srs[b.id].reps || 0) : 0;
      return ra - rb + (Math.random() - 0.5);
    }).slice(0, needCount);
    if (curLvl > 1 && mixedPool.length >= 4) {
      const prevWords = allWords.filter(w => Number(w.level) < curLvl && /[а-яё]/i.test(w.ru));
      if (prevWords.length) {
        const prevPick = Array.from(prevWords).sort(() => Math.random() - 0.5).slice(0, 2);
        mixedPool = mixedPool.slice(0, Math.max(2, needCount - 2)).concat(prevPick).sort(() => Math.random() - 0.5);
      }
    }
    while (mixedPool.length < needCount && mainPool.length > 0) {
      mixedPool.push(mainPool[mixedPool.length % mainPool.length]);
    }
    steps = mixedPool.map((w, idx) => ({
      type: 'blitz',
      word: w,
      meta: { label: `${idx + 1}/${mixedPool.length}` }
    }));
  }
  else if (mode === 'stories') {
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
    const needCount = Math.max(1, remainingForPlan);
    const pickedStories = Array.from({ length: needCount }, (_, idx) => rankedStories[idx % rankedStories.length].st);
    steps = pickedStories.map(st => ({ type: 'story', story: st }));
  } else {
    const curLvl = Number(selectedLevel) || 1;
    const lvlSentences = sentences.filter(s => !s.level || Number(s.level) <= curLvl);
    const sourceSentences = lvlSentences.length >= 4 ? lvlSentences : sentences;
    const rankedSentences = Array.from(sourceSentences)
      .map(s => ({ s, score: scoreByKnownWords(s.hanzi) + Math.random() * 0.5 }))
      .sort((a, b) => b.score - a.score);
    const needCount = Math.max(1, remainingForPlan);
    const queue = Array.from({ length: needCount }, (_, idx) => rankedSentences[idx % rankedSentences.length].s);
    steps = queue.map(s => ({ type: 'phrase', sentence: s }));
  }

  let i = 0;

  function renderTaskFinishScreen() {
    const freshPlan = getDynamicPlan();
    const dNow = getDaily();
    const allTasksDone = freshPlan.tasks.every(t => (dNow[t.id] || 0) >= t.goal);
    const curIdx = freshPlan.tasks.findIndex(t => t.id === mode);
    const nextSequential = curIdx >= 0 && curIdx + 1 < freshPlan.tasks.length
      ? freshPlan.tasks[curIdx + 1]
      : freshPlan.tasks.find(t => t.id !== mode && (dNow[t.id] || 0) < t.goal);

    if (allTasksDone && !extraRun) {
      app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
        <div style="width:100%;max-width:240px;margin:0 auto;">
          <img src="./js/geese/goose_plan_done.gif" alt="План на сегодня выполнен" onerror="this.style.display='none'" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;display:block;">
        </div>
        <h1 style="margin-top:12px;color:var(--jade);font-size:24px;">На сегодня всё выполнено! 🎉</h1>
        <p style="color:var(--muted);margin-top:6px;font-size:15px;">Весь твой план на день закрыт! Хочешь позаниматься ещё?</p>
        <div style="display:flex;flex-direction:column;gap:10px;max-width:340px;margin:18px auto 0;">
          <button id="goMoreBtn" class="cta" style="width:100%;margin:0;border:none;cursor:pointer;padding:13px;">Идти дальше (ещё ${taskGoal})</button>
          ${nextSequential ? `<button id="goNextTaskBtn" class="ghost" style="width:100%;padding:12px;font-weight:700;border-color:var(--jade);color:var(--jade);">Перейти к следующему заданию →</button>` : ''}
          <button id="goMenuBtn" class="ghost" style="width:100%;padding:12px;">Вернуться в меню</button>
        </div>
      </section>`;
    } else {
      const nextLabel = nextSequential
        ? `Перейти к следующему заданию (${nextSequential.title.replace(/^\d+\.\s*/, '')}) →`
        : 'Перейти к следующему заданию →';
      app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
        <div style="width:100%;max-width:210px;margin:0 auto;">
          <img src="./js/geese/goose_win.jpg" alt="Задание выполнено" onerror="this.style.display='none'" style="width:100%;height:auto;mix-blend-mode:multiply;pointer-events:none;display:block;">
        </div>
        <h1 style="margin-top:10px;color:var(--jade);font-size:24px;">Норма задания выполнена! ✓</h1>
        <p style="color:var(--muted);margin-top:6px;font-size:15px;">Выполнено по плану: <b>${dNow[mode] || 0} / ${taskGoal}</b>. Что делаем дальше?</p>
        <div style="display:flex;flex-direction:column;gap:10px;max-width:340px;margin:18px auto 0;">
          <button id="goMoreBtn" class="cta" style="width:100%;margin:0;border:none;cursor:pointer;padding:13px;">Идти дальше (+${taskGoal})</button>
          ${nextSequential ? `<button id="goNextTaskBtn" class="ghost" style="width:100%;padding:12px;font-weight:700;border-color:var(--jade);color:var(--jade);">${nextLabel}</button>` : ''}
          <button id="goMenuBtn" class="ghost" style="width:100%;padding:12px;">Вернуться в меню</button>
        </div>
      </section>`;
    }

    app.querySelector('#goMoreBtn').onclick = () => {
      stopAudio();
      startMode(mode, true);
    };
    const nextBtn = app.querySelector('#goNextTaskBtn');
    if (nextBtn && nextSequential) {
      nextBtn.onclick = () => {
        stopAudio();
        startMode(nextSequential.id, false);
      };
    }
    app.querySelector('#goMenuBtn').onclick = () => {
      stopAudio();
      if (location.hash === '#/' || !location.hash) home();
      else location.hash = '#/';
    };
  }

  function next() {
    if (i > 0) {
      addDaily(mode, 1);
      saveSRS(srs);
    }
    if (i >= steps.length) {
      renderTaskFinishScreen();
      return;
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  const [resNew, resRu] = await Promise.all([
  fetch('./hsk.json?v=3').catch(() => null),
  fetch(ruUrl, { signal: ctrl.signal }).catch(() => null)
    ]).finally(() => clearTimeout(timer));
    let raw = null;
    if (resNew && resNew.ok) {
      const txt = await resNew.text();
      if (txt && !txt.trim().startsWith('<')) {
        raw = JSON.parse(txt);
      }
    }
    if (!raw) return;
    const shortRu = str => {
    const firstMeaning = String(str || '')
      .split(/[,;/()]/)
      .map(s => s.trim())
      .find(Boolean) || '';
    return firstMeaning.split(/\s+/).slice(0, 2).join(' ');
  };

  const ruMap = new Map();
  if (resRu && resRu.ok) {
    try {
      const ruList = await resRu.json();
      ruList.forEach(w => {
        if (w.hanzi && w.translations && Array.isArray(w.translations.rus)) {
          ruMap.set(w.hanzi, {
            ru: shortRu(w.translations.rus.at(0)),
            pinyin: w.pinyin || ''
          });
        }
      });
    } catch {}
  }

  const localFallbackMap = new Map();
  defaultWords.forEach(w => {
    if (w && w.hanzi && w.ru) localFallbackMap.set(w.hanzi, w.ru);
  });

  const parsed = [];
  for (const item of raw) {
    if (item.hanzi && item.level) {
      const hanzi = String(item.hanzi).trim();
      const newLvl = Number(item.level);
      if (!hanzi || !levels.includes(newLvl)) continue;
      const found = ruMap.get(hanzi);
      const pinyin = String(item.pinyin || (found && found.pinyin) || '').trim();
            const rawRu = (found && found.ru && /[а-яё]/i.test(found.ru))
        ? found.ru
        : (localFallbackMap.get(hanzi) || shortRu(item.ru || '') || shortRu(item.en || ''));
      if (rawRu) {
        parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi, pinyin, ru: rawRu, level: newLvl });
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
    const meanings = form.m || form.meanings || Array.of();
    const rawRu = (found && found.ru && /[а-яё]/i.test(found.ru))
      ? found.ru
      : (localFallbackMap.get(hanzi) || shortRu(meanings.at(0) || ''));
    if (rawRu) {
      parsed.push({ id: 'hsk_' + (parsed.length + 1), hanzi, pinyin, ru: rawRu, level: newLvl });
    }
  }
  if (parsed.length > 0) {
    saveVocab(parsed);
  }
if (stEl) stEl.textContent = `Готово! Загружено ${parsed.length} слов (HSK 1–${maxLvl}).`;
return parsed;
}
function markTodayVisit() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let days = [];
  try {
    days = JSON.parse(safeStorage.getItem('hsk_visit_days_v1') || '[]');
    if (!Array.isArray(days)) days = [];
  } catch {
    days = [];
  }
  if (!days.includes(todayStr)) {
    days.push(todayStr);
    days.sort();
    safeStorage.setItem('hsk_visit_days_v1', JSON.stringify(days));
  }
  return days;
}
let lastKnownDay = getTodayMoodKey();
setInterval(() => {
  const curDay = getTodayMoodKey();
  if (curDay !== lastKnownDay) {
    lastKnownDay = curDay;
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) home();
  }
  if (safeStorage.getItem('hsk_rem_on') !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const target = safeStorage.getItem('hsk_rem_time') || '19:00';
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const todaySentKey = 'hsk_rem_sent_' + now.toISOString().slice(0, 10);
  if (hhmm === target && !safeStorage.getItem(todaySentKey)) {
    const d = getDaily();
    const doneAll = d.words >= 12 && d.blitz >= 10 && d.phrases >= 4 && d.stories >= 2;
    safeStorage.setItem(todaySentKey, '1');
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
document.querySelectorAll('#topMenu a').forEach(a => a.addEventListener('click', () => { const m = document.getElementById('topMenu'); if (m) m.removeAttribute('open'); }));
function bootRouter() {
  try {
    const restoredLvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl');
    const restoredLes = safeStorage.getItem('hsk_les');
    const restoredMode = safeStorage.getItem('hsk_mode');
    if (restoredLvl) selectedLevel = restoredLvl;
    if (restoredLes !== null) selectedLesson = Number(restoredLes) || 0;
    if (restoredMode) lastMode = restoredMode;
    const freshSrs = loadSRS();
    if (freshSrs && typeof freshSrs === 'object') {
      Object.assign(srs, freshSrs);
    }
    markTodayVisit();
    router();
  } catch (err) {
    if (app) {
      app.innerHTML = `<section class="hero"><h2>Ошибка запуска</h2><p>${err && err.message ? err.message : err}</p><button class="btn primary" onclick="location.reload()">Обновить</button></section>`;
    }
  }
}
bootRouter();
Promise.race([
  storageReady.catch(() => {}),
  new Promise(r => setTimeout(r, 500))
]).then(() => {
  bootRouter();
});
