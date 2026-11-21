import { speak, speakDialog } from '../audio.js?v=3';
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

export function renderStoryCard(root, storiesList, progressMap, srsState, onDone) {
  const LEVELS = Array.of(
    { id: '1', label: 'HSK 1', needText: '' },
    { id: '1-2', label: 'HSK 1–2', needText: 'нужно 67% в HSK 1' },
    { id: '2', label: 'HSK 2', needText: 'нужно 95% в HSK 1' },
    { id: '2-3', label: 'HSK 2–3', needText: 'нужно 67% в HSK 2' },
    { id: '3', label: 'HSK 3', needText: 'нужно 95% в HSK 2' },
    { id: '3-4', label: 'HSK 3–4', needText: 'нужно 67% в HSK 3' },
    { id: '4', label: 'HSK 4', needText: 'нужно 95% в HSK 3' }
  );

  const isUnlocked = id => {
    if (id === '1') return true;
    if (id === '1-2') return progressMap.p1 >= 67;
    if (id === '2') return progressMap.p1 >= 95;
    if (id === '2-3') return progressMap.p1 >= 95 && progressMap.p2 >= 67;
    if (id === '3') return progressMap.p1 >= 95 && progressMap.p2 >= 95;
    if (id === '3-4') return progressMap.p1 >= 95 && progressMap.p2 >= 95 && progressMap.p3 >= 67;
    if (id === '4') return progressMap.p1 >= 95 && progressMap.p2 >= 95 && progressMap.p3 >= 95;
    return false;
  };

  let curLvl = localStorage.getItem('hsk_story_lvl') || '1';
  if (!isUnlocked(curLvl)) curLvl = '1';
  let curKind = localStorage.getItem('hsk_story_kind') || 'dialogue';
  let rate = Number(localStorage.getItem('hsk_phrase_speed'));
  if (rate !== 1.0 && rate !== 0.75) rate = 1.0;

  function render() {
    let pool = storiesList.filter(x => x.level === curLvl && x.kind === curKind);
    if (!pool.length) pool = storiesList.filter(x => x.kind === curKind);
    if (!pool.length) pool = storiesList;
    const item = pool.at(Math.floor(Math.random() * pool.length));

    const lvlOptions = LEVELS.map(l => {
      const ok = isUnlocked(l.id);
      const sel = l.id === curLvl ? 'selected' : '';
      return `<option value="${l.id}" ${sel} ${ok ? '' : 'disabled'}>${ok ? '' : '🔒 '}${l.label}${ok ? '' : ' (' + l.needText + ')'}</option>`;
    }).join('');

    const MODES = Array.of(
      { rate: 1.0, label: 'Обычно' },
      { rate: 0.75, label: 'Помедленнее' }
    );

    root.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <select id="storyLvl" style="flex:1;padding:8px 10px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);color:var(--fg);font-size:13px;font-weight:600;">
            ${lvlOptions}
          </select>
          <select id="storyKind" style="flex:1;padding:8px 10px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);color:var(--fg);font-size:13px;font-weight:600;">
            <option value="dialogue" ${curKind === 'dialogue' ? 'selected' : ''}>💬 Диалог</option>
            <option value="text" ${curKind === 'text' ? 'selected' : ''}>📖 Текст</option>
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
          <button id="again" class="ghost" style="margin-top:10px;">↻ Прослушать ещё раз</button>
          <button id="nextStory" class="cta" style="margin-top:10px;width:100%;border:none;cursor:pointer;">Дальше →</button>
        </div>
      </div>`;

    const playAudio = () => {
      const payload = item.lines.map(l => ({ speaker: l.speaker, text: l.hanzi }));
      speakDialog(payload, { rate });
    };

    root.querySelector('#storyLvl').onchange = e => {
      curLvl = e.target.value;
      localStorage.setItem('hsk_story_lvl', curLvl);
      render();
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
            <div style="font-size:18px;font-weight:600;">${prefix}${l.hanzi}</div>
            <div style="font-size:14px;color:#1E7E5E;">${l.pinyin}</div>
            <div style="font-size:14px;color:#4B5563;">${l.ru}</div>
          </div>`;
        }).join('');

        reveal.hidden = false;
        reveal.querySelector('#storyTranscript').innerHTML = `
          ${linesHtml}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:14px;color:var(--accent);font-weight:600;">
            💡 ${item.note}
          </div>
        `;
        reveal.querySelector('#again').onclick = playAudio;
        reveal.querySelector('#nextStory').onclick = onDone;
      };
      answerEl.appendChild(btn);
    });
  }

  render();
}
