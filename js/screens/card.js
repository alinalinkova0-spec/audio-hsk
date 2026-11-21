import { speak, mountAudioControl } from '../audio.js?v=5';
import { review, saveSRS } from '../srs.js';

function stripTones(p) {
  return String(p || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function recordWeakness(wordId, type) {
  try {
    const key = 'hsk_weakness_v1';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    if (!data[wordId]) data[wordId] = { audioErr: 0, toneErr: 0, readErr: 0 };
    data[wordId][type] = (data[wordId][type] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function generateToneVariants(pinyin) {
  const clean = String(pinyin || '').trim();
  if (!clean) return [];
  const TONE_MAP = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };
  const ALL_MARKED = Object.values(TONE_MAP).flat();
  const chars = [...clean];
  let targetIdx = -1;
  let baseVowel = '';

  for (let idx = chars.length - 1; idx >= 0; idx--) {
    const ch = chars[idx].toLowerCase();
    for (const [vowel, forms] of Object.entries(TONE_MAP)) {
      if (forms.includes(ch)) {
        targetIdx = idx;
        baseVowel = vowel;
        break;
      }
    }
    if (targetIdx !== -1) break;
  }

  if (targetIdx === -1) return [];
  const variants = new Set([clean]);
  for (const toneChar of TONE_MAP[baseVowel]) {
    const copy = [...chars];
    copy[targetIdx] = toneChar;
    variants.add(copy.join(''));
  }
  return Array.from(variants).filter(v => ALL_MARKED.some(m => v.toLowerCase().includes(m)));
}

function pickDistractors(word, all, tier) {
  const others = all.filter(w => w.id !== word.id && w.hanzi !== word.hanzi);
  const wLen = [...word.hanzi].length;
  const wBase = stripTones(word.pinyin);
  const wFirstChar = [...word.hanzi][0];
  const wLastChar = [...word.hanzi][wLen - 1];

  if (tier === 'easy') {
    const diff = others.filter(w => [...w.hanzi].length !== wLen && stripTones(w.pinyin) !== wBase);
    const pool = diff.length >= 3 ? diff : others;
    return shuffle(pool).slice(0, 3);
  }

  if (tier === 'hard') {
    const homophones = others.filter(w => wBase && stripTones(w.pinyin) === wBase);
    const similar = others.filter(w => {
      if (homophones.includes(w)) return false;
      const b = stripTones(w.pinyin);
      const samePrefix = wBase.length >= 2 && b.startsWith(wBase.slice(0, 2));
      const sameChar = w.hanzi.includes(wFirstChar) || w.hanzi.includes(wLastChar);
      return samePrefix || sameChar;
    });
    const combined = [...shuffle(homophones), ...shuffle(similar), ...shuffle(others)];
    const unique = [];
    const seen = new Set([word.hanzi]);
    for (const item of combined) {
      if (!seen.has(item.hanzi)) {
        seen.add(item.hanzi);
        unique.push(item);
      }
      if (unique.length === 3) break;
    }
    return unique;
  }

  const sameLen = others.filter(w => [...w.hanzi].length === wLen);
  const similarStart = sameLen.filter(w => {
    const b = stripTones(w.pinyin);
    return wBase && b && b[0] === wBase[0];
  });
  const pool = [...shuffle(similarStart), ...shuffle(sameLen), ...shuffle(others)];
  const unique = [];
  const seen = new Set([word.hanzi]);
  for (const item of pool) {
    if (!seen.has(item.hanzi)) {
      seen.add(item.hanzi);
      unique.push(item);
    }
    if (unique.length === 3) break;
  }
  return unique;
}

export function renderCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const tier = meta.tier || 'medium';
  const stepLabel = meta.label || '';

  const tierColors = { easy: '#1E7E5E', medium: '#B45309', hard: '#C83E37' };
  const tierNames = { easy: 'Разминка', medium: 'Средний', hard: 'Сложный (тоны и ловушки)' };

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:${tierColors[tier]};font-weight:600;">${tierNames[tier]}</span>
        <span style="color:var(--muted);">${stepLabel}</span>
      </div>
      <div id="wordAudioBox" class="card-audio"></div>
      <p class="prompt">Какое слово прозвучало?</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr 1fr;gap:10px;"></div>
      <div class="reveal" id="reveal" hidden>
        <div class="hanzi" id="hanzi"></div>
        <div class="grades">
          <button data-grade="0">Забыл</button>
          <button data-grade="1">Сложно</button>
          <button data-grade="2">Норм</button>
          <button data-grade="3">Легко</button>
        </div>
      </div>
    </div>`;

  const pool = all.length >= 4 ? all : [...all, { id:'x1', hanzi:'学习', pinyin:'xuéxí', ru:'учиться' }, { id:'x2', hanzi:'联系', pinyin:'liánxì', ru:'связываться' }, { id:'x3', hanzi:'练习', pinyin:'liànxí', ru:'тренироваться' }];
  const distractors = pickDistractors(word, pool, tier);
  const opts = shuffle([word, ...distractors]);
  const answerEl = root.querySelector('#answers');
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '28px';
    b.style.textAlign = 'center';
    b.textContent = o.hanzi;
    b.onclick = () => choose(o, b);
    answerEl.appendChild(b);
  });

  const reveal = root.querySelector('#reveal');
  const audioCtrl = mountAudioControl(
    root.querySelector('#wordAudioBox'),
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  let done = false;
  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === word.id;
    btn.classList.add(ok ? 'ok' : 'bad');
    const prevStreak = Number(localStorage.getItem('hsk_streak') || 0);
    localStorage.setItem('hsk_streak', ok ? String(prevStreak + 1) : '0');
    if (!ok) {
      recordWeakness(word.id, 'audioErr');
      [...answerEl.children].forEach(b => {
        if (b.textContent === word.hanzi) b.classList.add('ok');
      });
    }
    speak(o.hanzi, { rate: audioCtrl.getRate() });

    const wrongHint = (!ok && o.pinyin)
      ? `<div style="font-size:15px;color:#C83E37;margin-top:10px;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">Твой выбор: ${o.hanzi} (${o.pinyin}) — ${o.ru || ''}</div>`
      : '';

    reveal.hidden = false;
    reveal.querySelector('#hanzi').innerHTML = `
      <div>${word.hanzi}</div>
      ${word.pinyin ? `<div style="font-size:20px;color:#1E7E5E;margin-top:6px;font-weight:500;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">${word.pinyin}</div>` : ''}
      ${word.ru ? `<div style="font-size:19px;color:#231F20;margin-top:6px;font-weight:600;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">${word.ru}</div>` : ''}
      ${wrongHint}
    `;

    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => {
        review(srsState, word.id, +g.dataset.grade);
        saveSRS(srsState);
        onDone();
      };
    });
  }
}
export function renderReadCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const mainRu = str => String(str || '').split(/[,;/]/).at(0).trim();
  const isRu = str => /[а-яё]/i.test(str) && !String(str).includes('MYMEMORY');

  const validPool = all.filter(
    w => w.id !== word.id && isRu(w.ru) && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
  );
  const others = shuffle(validPool).slice(0, 3);
  const opts = shuffle(Array.of(word, ...others));

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:#1E7E5E;font-weight:700;">👀 Чтение без звука</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
      <div style="text-align:center;padding:18px 0 12px;">
        <div style="font-size:48px;font-weight:800;letter-spacing:2px;color:var(--fg);">${word.hanzi}</div>
        <div id="readPinyin" style="font-size:18px;color:var(--jade);margin-top:6px;min-height:24px;"></div>
      </div>
      <p class="prompt">Узнай иероглиф глазами и выбери перевод</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr;"></div>
      <div id="readFooter" style="text-align:center;margin-top:12px;"></div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const pinyinEl = root.querySelector('#readPinyin');
  const footerEl = root.querySelector('#readFooter');
  let done = false;

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '17px';
    b.style.padding = '13px';
    b.textContent = mainRu(o.ru);
    b.onclick = () => {
      if (done) return;
      done = true;
      const ok = o.id === word.id;
      b.classList.add(ok ? 'ok' : 'bad');
      if (!ok) {
        recordWeakness(word.id, 'readErr');
        Array.from(answerEl.children).forEach(x => {
          if (x.textContent === mainRu(word.ru)) x.classList.add('ok');
        });
      }
      pinyinEl.textContent = word.pinyin || '';
      speak(word.hanzi, { rate: 0.95 });
      review(srsState, word.id, ok ? 3 : 0);
      saveSRS(srsState);

      footerEl.innerHTML = `<button id="readNext" class="cta" style="border:none;cursor:pointer;padding:10px 24px;">Дальше →</button>`;
      footerEl.querySelector('#readNext').onclick = onDone;
    };
    answerEl.appendChild(b);
  });
}

export function renderToneCard(root, word, srsState, onDone, meta = {}) {
  const variants = generateToneVariants(word.pinyin);
  if (variants.length < 3) {
    renderCard(root, word, srsState, onDone, meta);
    return;
  }

  const opts = shuffle(variants).slice(0, 4);
  if (!opts.includes(word.pinyin.trim())) {
    opts[0] = word.pinyin.trim();
  }
  const finalOpts = shuffle(opts);

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:#B45309;font-weight:700;">🎵 Охота на тоны</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
      <div id="toneAudioBox" class="card-audio"></div>
      <div style="text-align:center;margin:6px 0 8px;">
        <div style="font-size:34px;font-weight:800;">${word.hanzi}</div>
        <div style="font-size:16px;color:var(--muted);">${word.ru}</div>
      </div>
      <p class="prompt">Выбери правильный тон пиньиня</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr 1fr;gap:10px;"></div>
      <div id="toneFooter" style="text-align:center;margin-top:12px;"></div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const footerEl = root.querySelector('#toneFooter');
  let done = false;

  const audioCtrl = mountAudioControl(
    root.querySelector('#toneAudioBox'),
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  finalOpts.forEach(pOpt => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '19px';
    b.style.fontWeight = '700';
    b.style.textAlign = 'center';
    b.style.padding = '14px';
    b.textContent = pOpt;
    b.onclick = () => {
      if (done) return;
      done = true;
      const ok = pOpt === word.pinyin.trim();
      b.classList.add(ok ? 'ok' : 'bad');
      if (!ok) {
        recordWeakness(word.id, 'toneErr');
        Array.from(answerEl.children).forEach(x => {
          if (x.textContent === word.pinyin.trim()) x.classList.add('ok');
        });
      }
      speak(word.hanzi, { rate: audioCtrl.getRate() });
      review(srsState, word.id, ok ? 3 : 0);
      saveSRS(srsState);

      footerEl.innerHTML = `<button id="toneNext" class="cta" style="border:none;cursor:pointer;padding:10px 24px;">Дальше →</button>`;
      footerEl.querySelector('#toneNext').onclick = onDone;
    };
    answerEl.appendChild(b);
  });
}

export function renderBlitzCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const LIMIT_MS = 5000;

  const mainRu = str => String(str || '').split(/[,;/]/).at(0).trim();
  const isRu = str => /[а-яё]/i.test(str) && !String(str).includes('MYMEMORY');

  let validPool = all.filter(
    w => w.id !== word.id && isRu(w.ru) && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
  );
  if (validPool.length < 3) {
    validPool = all.filter(
      w => w.id !== word.id && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
    );
  }
  const others = shuffle(validPool).slice(0, 3);
  const opts = shuffle(Array.of(word, ...others));

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px;">
        <span style="color:#fbbf24;font-weight:600;">⚡ Молния (5 сек)</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
      <div style="width:100%;height:6px;background:rgba(0,0,0,0.08);border-radius:4px;overflow:hidden;margin-bottom:14px;">
        <div id="timerBar" style="width:100%;height:100%;background:#fbbf24;transition:width ${LIMIT_MS}ms linear;"></div>
      </div>
      <div id="blitzAudioBox" class="card-audio"></div>
      <p class="prompt">Быстро нажми перевод!</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr;"></div>
      <div id="blitzInfo" style="text-align:center;margin-top:12px;min-height:24px;font-size:16px;"></div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const infoEl = root.querySelector('#blitzInfo');
  const bar = root.querySelector('#timerBar');
  let done = false;

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '17px';
    b.style.padding = '13px';
    b.textContent = mainRu(o.ru);
    b.onclick = () => finish(o.id === word.id, b, false);
    answerEl.appendChild(b);
  });

  mountAudioControl(
    root.querySelector('#blitzAudioBox'),
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  requestAnimationFrame(() => { bar.style.width = '0%'; });
  const timer = setTimeout(() => {
    if (!document.body.contains(answerEl)) return;
    finish(false, null, true);
  }, LIMIT_MS);

  function finish(ok, btn, timeout) {
    if (done || !document.body.contains(answerEl)) return;
    done = true;
    clearTimeout(timer);
    if (btn) btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) {
      Array.from(answerEl.children).forEach(b => {
        if (b.textContent === mainRu(word.ru)) b.classList.add('ok');
      });
    }
    infoEl.innerHTML = `${timeout ? '<span style="color:#f87171;">Время вышло! </span>' : ''}<b>${word.hanzi}</b> (${word.pinyin}) — ${word.ru}`;
    review(srsState, word.id, ok ? 3 : 0);
    saveSRS(srsState);
    setTimeout(onDone, ok ? 650 : 1400);
  }
}

function shuffle(a) {
  return a.map(v => ({ r: Math.random(), v })).sort((x, y) => x.r - y.r).map(x => x.v);
}
