import { speak } from '../audio.js?v=2';
import { review, saveSRS } from '../srs.js';

function stripTones(p) {
  return String(p || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function randomRate(tier) {
  if (tier === 'easy') return +(0.9 + Math.random() * 0.1).toFixed(2);
  if (tier === 'hard') return +(1.0 + Math.random() * 0.18).toFixed(2);
  return +(0.92 + Math.random() * 0.18).toFixed(2);
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
    // 1. Омонимы с разными тонами (одинаковый пиньинь без тонов)
    const homophones = others.filter(w => wBase && stripTones(w.pinyin) === wBase);
    // 2. Похожее звучание (совпадают первые 2 буквы пиньиня или общий иероглиф)
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

  // medium: та же длина иероглифов + схожее начало
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
   const SPEEDS = [0.8, 1.0, 1.5];
  let rate = Number(localStorage.getItem('hsk_speed'));
  if (!SPEEDS.includes(rate)) rate = 1.0;

  const tierColors = { easy: '#1E7E5E', medium: '#B45309', hard: '#C83E37' };
  const tierNames = { easy: 'Разминка', medium: 'Средний', hard: 'Сложный (тоны и ловушки)' };

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:${tierColors[tier]};font-weight:600;">${tierNames[tier]}</span>
        <span style="color:var(--muted);">${stepLabel}</span>
      </div>
      <div class="card-audio" style="flex-direction:column;gap:14px;">
        <button id="play" class="big-play">▶</button>
        <div id="speedWrap" style="position:relative;display:inline-flex;align-items:center;background:#EFE8D8;border:1px solid var(--border);border-radius:999px;padding:3px;user-select:none;touch-action:pan-y;cursor:pointer;">
          <div id="speedThumb" style="position:absolute;top:3px;bottom:3px;left:3px;width:58px;background:var(--accent);border-radius:999px;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(200,62,55,0.28);"></div>
          ${SPEEDS.map(s => `<button type="button" data-speed="${s}" style="position:relative;z-index:1;width:58px;padding:6px 0;border:none;background:transparent;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:color 0.2s;color:${s === rate ? '#FFFDF9' : 'var(--fg)'};">${s.toFixed(1)}x</button>`).join('')}
        </div>
      </div>
      <p class="prompt">Какое слово прозвучало?</p>
      <div class="answers" id="answers"></div>
      <div class="reveal" id="reveal" hidden>
        <div class="hanzi" id="hanzi"></div>
        <button id="again" class="ghost" style="margin-top:12px;">↻ Прослушать ещё раз</button>
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
  const speedWrap = root.querySelector('#speedWrap');
  const speedThumb = root.querySelector('#speedThumb');
  const speedBtns = Array.from(speedWrap.querySelectorAll('button[data-speed]'));

  function setSpeed(newRate, shouldSpeak = true) {
    rate = newRate;
    localStorage.setItem('hsk_speed', String(rate));
    const idx = SPEEDS.indexOf(rate);
    speedThumb.style.transform = `translateX(${idx * 58}px)`;
    speedBtns.forEach(b => {
      b.style.color = Number(b.dataset.speed) === rate ? '#FFFDF9' : 'var(--fg)';
    });
    if (shouldSpeak) speak(word.hanzi, { rate });
  }

  setSpeed(rate, false);

  speedBtns.forEach(b => {
    b.onclick = () => setSpeed(Number(b.dataset.speed), true);
  });

  let touchStartX = 0;
  speedWrap.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  speedWrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 18) return;
    const idx = SPEEDS.indexOf(rate);
    const nextIdx = dx > 0 ? Math.min(SPEEDS.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (nextIdx !== idx) setSpeed(SPEEDS[nextIdx], true);
  }, { passive: true });

  root.querySelector('#play').onclick = () => speak(word.hanzi, { rate });
  setTimeout(() => speak(word.hanzi, { rate }), 200);

  let done = false;
  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === word.id;
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) [...answerEl.children].forEach(b => {
      if (b.textContent === word.hanzi) b.classList.add('ok');
    });

    speak(o.hanzi, { rate: 0.95 });

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

    reveal.querySelector('#again').onclick = () => speak(word.hanzi, { rate: 0.95 });
    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => {
        review(srsState, word.id, +g.dataset.grade);
        saveSRS(srsState);
        onDone();
      };
    });
  }
}

export function renderBlitzCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const rate = +(0.95 + Math.random() * 0.15).toFixed(2);
  const LIMIT_MS = 3500;

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
  const opts = shuffle([word, ...others]);


  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px;">
        <span style="color:#fbbf24;font-weight:600;">⚡ Молния (3.5 сек)</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
      <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;margin-bottom:14px;">
        <div id="timerBar" style="width:100%;height:100%;background:#fbbf24;transition:width ${LIMIT_MS}ms linear;"></div>
      </div>
      <div class="card-audio">
        <button id="play" class="big-play">▶</button>
      </div>
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

  root.querySelector('#play').onclick = () => speak(word.hanzi, { rate });
  setTimeout(() => {
    speak(word.hanzi, { rate });
    requestAnimationFrame(() => { bar.style.width = '0%'; });
  }, 150);
  const timer = setTimeout(() => {
    if (!document.body.contains(answerEl)) return;
    finish(false, null, true);
  }, LIMIT_MS + 150);

  function finish(ok, btn, timeout) {
    if (done || !document.body.contains(answerEl)) return;
    
    done = true;
    clearTimeout(timer);
    if (btn) btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) {
      [...answerEl.children].forEach(b => {
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

