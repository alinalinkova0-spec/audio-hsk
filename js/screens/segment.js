import { speak } from '../audio.js?v=2';
import { review, saveSRS } from '../srs.js';

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
    reveal.querySelector('#phraseText').innerHTML = `
      <div>${s.hanzi}</div>
      <div style="font-size:17px;color:#1E7E5E;margin-top:6px;font-weight:500;">${s.pinyin}</div>
      <div style="font-size:16px;color:#231F20;margin-top:6px;font-weight:600;">${s.ru}</div>
    `;
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
