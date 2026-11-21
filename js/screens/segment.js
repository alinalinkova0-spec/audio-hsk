import { speak, speakDialog } from '../audio.js?v=4';
import { review, saveSRS } from '../srs.js';
function makeClickableHanzi(text) {
  const words = window.__ALL_WORDS || [];
  if (!words.length) return text;
  const dict = new Map();
  for (const w of words) {
    if (w.hanzi && !dict.has(w.hanzi)) dict.set(w.hanzi, w);
  }
  const keys = Array.from(dict.keys()).sort((a, b) => [...b].length - [...a].length);
  const chars = [...String(text || '')];
  let out = '';
  let idx = 0;

  while (idx < chars.length) {
    let matched = null;
    for (const k of keys) {
      const kLen = [...k].length;
      if (chars.slice(idx, idx + kLen).join('') === k) {
        matched = dict.get(k);
        idx += kLen;
        break;
      }
    }
    if (matched) {
      const safePinyin = String(matched.pinyin || '').replace(/"/g, '&quot;');
      const safeRu = String(matched.ru || '').replace(/"/g, '&quot;');
      out += `<span class="hz-tap" data-hz="${matched.hanzi}" data-py="${safePinyin}" data-ru="${safeRu}" style="border-bottom:1.5px dashed #1E7E5E;cursor:pointer;padding:0 1px;border-radius:4px;">${matched.hanzi}</span>`;
    } else {
      out += chars[idx];
      idx += 1;
    }
  }
  return out;
}

function bindHanziTaps(container) {
  let popup = container.querySelector('#hzPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'hzPopup';
    popup.style.cssText = 'display:none;margin-top:8px;padding:8px 12px;background:#FFFDF9;border:1.5px solid var(--jade);border-radius:12px;font-size:14px;color:var(--fg);box-shadow:0 2px 8px rgba(0,0,0,0.06);';
    container.appendChild(popup);
  }
  container.querySelectorAll('.hz-tap').forEach(el => {
    el.onclick = () => {
      const hz = el.dataset.hz;
      const py = el.dataset.py;
      const ru = el.dataset.ru;
      speak(hz, { rate: 0.9 });
      popup.style.display = 'block';
      popup.innerHTML = `🔊 <b style="font-size:17px;">${hz}</b> <span style="color:#1E7E5E;font-weight:600;">${py}</span> — <b>${ru}</b>`;
    };
  });
}
export function renderPhraseChoice(root, s, allSentences, srsState, onDone) {
  const distractors = allSentences
    .filter(x => x.id !== s.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = Array.of(s, ...distractors).sort(() => Math.random() - 0.5);

  const MODES = Array.of(
    { rate: 1.0, label: 'Обычно' },
    { rate: 0.75, label: 'Помедленнее' }
  );
  let rate = Number(localStorage.getItem('hsk_phrase_speed'));
  if (rate !== 1.0 && rate !== 0.75) rate = 1.0;

  root.innerHTML = `
    <div class="card">
      <div class="card-audio" style="flex-direction:row;align-items:center;justify-content:center;gap:18px;">
        <button id="play" class="big-play" aria-label="Прослушать" style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;padding:0;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="#FFFDF9" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div id="phraseSpeedWrap" style="position:relative;display:inline-flex;flex-direction:column;align-items:center;background:#EFE8D8;border:1.5px solid var(--border);border-radius:20px;padding:4px;user-select:none;cursor:pointer;">
          <div id="phraseSpeedThumb" style="position:absolute;left:4px;right:4px;top:4px;height:36px;background:var(--accent);border-radius:15px;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(200,62,55,0.28);"></div>
          ${MODES.map(m => `<button type="button" data-rate="${m.rate}" style="position:relative;z-index:1;width:118px;height:36px;padding:0 8px;border:none;background:transparent;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:color 0.2s;color:${m.rate === rate ? '#FFFDF9' : 'var(--fg)'};">${m.label}</button>`).join('')}
        </div>
      </div>
      <p class="prompt">Прослушай фразу и выбери перевод</p>
      <div id="answers" class="answers" style="grid-template-columns:1fr;"></div>
      <div id="reveal" class="reveal" hidden>
        <div id="phraseText" style="font-size:20px;font-weight:600;"></div>
        <button id="again" class="ghost" style="margin-top:10px;">↻ Прослушать ещё раз</button>
        <div class="grades">
          <button data-grade="0">Забыл</button>
          <button data-grade="1">Сложно</button>
          <button data-grade="2">Норм</button>
          <button data-grade="3">Легко</button>
        </div>
      </div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const reveal = root.querySelector('#reveal');
  const speedWrap = root.querySelector('#phraseSpeedWrap');
  const speedThumb = root.querySelector('#phraseSpeedThumb');
  const speedBtns = Array.from(speedWrap.querySelectorAll('button[data-rate]'));
  let done = false;

  function setRate(newRate, shouldSpeak = true) {
    rate = newRate;
    localStorage.setItem('hsk_phrase_speed', String(rate));
    const idx = MODES.findIndex(m => m.rate === rate);
    speedThumb.style.transform = `translateY(${Math.max(0, idx) * 36}px)`;
    speedBtns.forEach(b => {
      b.style.color = Number(b.dataset.rate) === rate ? '#FFFDF9' : 'var(--fg)';
    });
    if (shouldSpeak) speak(s.hanzi, { rate });
  }

  setRate(rate, false);
  speedBtns.forEach(b => {
    b.onclick = () => setRate(Number(b.dataset.rate), true);
  });

  options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'answer';
    btn.style.fontSize = '16px';
    btn.style.padding = '14px';
    btn.textContent = o.ru;
    btn.onclick = () => choose(o, btn);
    answerEl.appendChild(btn);
  });

  root.querySelector('#play').onclick = () => speak(s.hanzi, { rate });
  speak(s.hanzi, { rate });

  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === s.id;
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) Array.from(answerEl.children).forEach(b => {
      if (b.textContent === s.ru) b.classList.add('ok');
    });

    speak(s.hanzi, { rate });

       reveal.hidden = false;
    const phraseBox = reveal.querySelector('#phraseText');
    phraseBox.innerHTML = `
      <div>${makeClickableHanzi(s.hanzi)}</div>
      <div style="font-size:17px;color:#1E7E5E;margin-top:6px;font-weight:500;">${s.pinyin}</div>
      <div style="font-size:16px;color:#231F20;margin-top:6px;font-weight:600;">${s.ru}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;">💡 Нажми на подчёркнутое слово, чтобы послушать отдельно</div>
    `;
    bindHanziTaps(phraseBox);
    reveal.querySelector('#again').onclick = () => speak(s.hanzi, { rate });
    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => {
        review(srsState, s.id, +g.dataset.grade);
        saveSRS(srsState);
        onDone();
      };
    });
  }
}
export function renderStoryCard(root, storiesList, progressMap, srsState, onDone) {
  const userLvl = Number(localStorage.getItem('hsk_lvl') || localStorage.getItem('hsk_start_lvl') || 1);
  let curKind = localStorage.getItem('hsk_story_kind') || 'all';
  if (!Array.of('all', 'dialogue', 'text').includes(curKind)) curKind = 'all';
  let rate = Number(localStorage.getItem('hsk_phrase_speed'));
  if (rate !== 1.0 && rate !== 0.75) rate = 1.0;

  function render() {
    let lvlPool = storiesList.filter(x => {
      const firstLvl = Number(String(x.level).split('-').at(0)) || 1;
      return firstLvl <= userLvl;
    });
    if (!lvlPool.length) lvlPool = storiesList;

    let pool = curKind === 'all' ? lvlPool : lvlPool.filter(x => x.kind === curKind);
    if (!pool.length) pool = lvlPool;

    const item = pool.at(Math.floor(Math.random() * pool.length));

    const MODES = Array.of(
      { rate: 1.0, label: 'Обычно' },
      { rate: 0.75, label: 'Помедленнее' }
    );

    root.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:13px;font-weight:700;color:var(--jade);">Уровень: HSK ${userLvl}</span>
          <select id="storyKind" style="padding:8px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);color:var(--fg);font-size:13px;font-weight:600;">
            <option value="all" ${curKind === 'all' ? 'selected' : ''}>📚 Всё вместе</option>
            <option value="dialogue" ${curKind === 'dialogue' ? 'selected' : ''}>💬 Диалоги</option>
            <option value="text" ${curKind === 'text' ? 'selected' : ''}>📖 Тексты</option>
          </select>
        </div>

        <div class="card-audio" style="flex-direction:row;align-items:center;justify-content:center;gap:18px;">
          <button id="play" class="big-play" aria-label="Прослушать" style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;padding:0;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#FFFDF9" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div id="storySpeedWrap" style="position:relative;display:inline-flex;flex-direction:column;align-items:center;background:#EFE8D8;border:1.5px solid var(--border);border-radius:20px;padding:4px;user-select:none;cursor:pointer;">
            <div id="storySpeedThumb" style="position:absolute;left:4px;right:4px;top:4px;height:36px;background:var(--accent);border-radius:15px;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(200,62,55,0.28);"></div>
            ${MODES.map(m => `<button type="button" data-rate="${m.rate}" style="position:relative;z-index:1;width:118px;height:36px;padding:0 8px;border:none;background:transparent;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:color 0.2s;color:${m.rate === rate ? '#FFFDF9' : 'var(--fg)'};">${m.label}</button>`).join('')}
          </div>
        </div>

        <p class="prompt" style="font-weight:700;font-size:17px;margin-top:14px;">${item.question}</p>
        <div id="answers" class="answers" style="grid-template-columns:1fr;"></div>

        <div id="reveal" class="reveal" hidden>
          <div id="storyTranscript" style="text-align:left;background:#F7F2E7;padding:12px;border-radius:14px;font-size:15px;line-height:1.55;"></div>
          <div style="font-size:12px;color:var(--muted);margin-top:6px;">💡 Нажми на подчёркнутое слово в тексте, чтобы увидеть перевод и послушать</div>
          <button id="again" class="ghost" style="margin-top:10px;">↻ Прослушать ещё раз</button>
          <button id="nextStory" class="cta" style="margin-top:10px;width:100%;border:none;cursor:pointer;">Дальше →</button>
        </div>
      </div>`;

    const playAudio = () => {
      const payload = item.lines.map(l => ({ speaker: l.speaker, text: l.hanzi }));
      speakDialog(payload, { rate });
    };

    root.querySelector('#storyKind').onchange = e => {
      curKind = e.target.value;
      localStorage.setItem('hsk_story_kind', curKind);
      render();
    };

    const speedWrap = root.querySelector('#storySpeedWrap');
    const speedThumb = root.querySelector('#storySpeedThumb');
    const speedBtns = Array.from(speedWrap.querySelectorAll('button[data-rate]'));

    function setRate(newRate, shouldSpeak = true) {
      rate = newRate;
      localStorage.setItem('hsk_phrase_speed', String(rate));
      const idx = MODES.findIndex(m => m.rate === rate);
      speedThumb.style.transform = `translateY(${Math.max(0, idx) * 36}px)`;
      speedBtns.forEach(b => {
        b.style.color = Number(b.dataset.rate) === rate ? '#FFFDF9' : 'var(--fg)';
      });
      if (shouldSpeak) playAudio();
    }

    setRate(rate, false);
    speedBtns.forEach(b => {
      b.onclick = () => setRate(Number(b.dataset.rate), true);
    });

    root.querySelector('#play').onclick = playAudio;
    playAudio();

    const answerEl = root.querySelector('#answers');
    const reveal = root.querySelector('#reveal');
    let done = false;

    item.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'answer';
      btn.style.fontSize = '16px';
      btn.style.padding = '14px';
      btn.textContent = optText;
      btn.onclick = () => {
        if (done) return;
        done = true;
        const ok = idx === item.correct;
        btn.classList.add(ok ? 'ok' : 'bad');
        if (!ok) {
          const rightBtn = Array.from(answerEl.children).at(item.correct);
          if (rightBtn) rightBtn.classList.add('ok');
        }

        const linesHtml = item.lines.map(l => {
          const prefix = item.kind === 'dialogue' ? `<b>${l.speaker}:</b> ` : '';
          return `<div style="margin-bottom:8px;">
            <div style="font-size:18px;font-weight:600;">${prefix}${makeClickableHanzi(l.hanzi)}</div>
            <div style="font-size:14px;color:#1E7E5E;">${l.pinyin}</div>
            <div style="font-size:14px;color:#4B5563;">${l.ru}</div>
          </div>`;
        }).join('');

        reveal.hidden = false;
        const transcriptBox = reveal.querySelector('#storyTranscript');
        transcriptBox.innerHTML = `
          ${linesHtml}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:14px;color:var(--accent);font-weight:600;">
            💡 ${item.note}
          </div>
        `;
        bindHanziTaps(transcriptBox);

        reveal.querySelector('#again').onclick = playAudio;
        reveal.querySelector('#nextStory').onclick = onDone;
      };
      answerEl.appendChild(btn);
    });
  }

  render();
}

