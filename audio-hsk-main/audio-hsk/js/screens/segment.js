import { safeStorage } from '../storage.js?v=6';
import { speak, speakDialog, mountAudioControl } from '../audio.js?v=13';
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

  root.innerHTML = `
    <div class="card">
      <div id="phraseAudioBox" class="card-audio"></div>
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
  let done = false;

  const audioCtrl = mountAudioControl(
    root.querySelector('#phraseAudioBox'),
    r => speak(s.hanzi, { rate: r }),
    { autoPlay: true }
  );

  options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'answer';
    btn.style.fontSize = '16px';
    btn.style.padding = '14px';
    btn.textContent = o.ru;
    btn.onclick = () => choose(o, btn);
    answerEl.appendChild(btn);
  });

  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === s.id;
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) Array.from(answerEl.children).forEach(b => {
      if (b.textContent === s.ru) b.classList.add('ok');
    });

    audioCtrl.replay();

    reveal.hidden = false;
    const phraseBox = reveal.querySelector('#phraseText');
    phraseBox.innerHTML = `
      <div>${makeClickableHanzi(s.hanzi)}</div>
      <div style="font-size:17px;color:#1E7E5E;margin-top:6px;font-weight:500;">${s.pinyin}</div>
      <div style="font-size:16px;color:#231F20;margin-top:6px;font-weight:600;">${s.ru}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;">💡 Нажми на подчёркнутое слово, чтобы послушать отдельно</div>
    `;
    bindHanziTaps(phraseBox);
    reveal.querySelector('#again').onclick = () => audioCtrl.replay();
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
  const userLvl = Number(safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl') || 1);
  let curKind = safeStorage.getItem('hsk_story_kind') || 'all';
  if (!Array.of('all', 'dialogue', 'text').includes(curKind)) curKind = 'all';

  function render() {
    let lvlPool = storiesList.filter(x => {
      const firstLvl = Number(String(x.level).split('-').at(0)) || 1;
      return firstLvl <= userLvl;
    });
    if (!lvlPool.length) lvlPool = storiesList;

    let pool = curKind === 'all' ? lvlPool : lvlPool.filter(x => x.kind === curKind);
    if (!pool.length) pool = lvlPool;

    const item = pool.at(Math.floor(Math.random() * pool.length));

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

        <div id="storyAudioBox" class="card-audio"></div>

        <p class="prompt" style="font-weight:700;font-size:17px;margin-top:14px;">${item.question}</p>
        <div id="answers" class="answers" style="grid-template-columns:1fr;"></div>

        <div id="reveal" class="reveal" hidden>
          <div id="storyTranscript" style="text-align:left;background:#F7F2E7;padding:12px;border-radius:14px;font-size:15px;line-height:1.55;"></div>
          <div style="font-size:12px;color:var(--muted);margin-top:6px;">💡 Нажми на подчёркнутое слово в тексте, чтобы увидеть перевод и послушать</div>
          <button id="again" class="ghost" style="margin-top:10px;">↻ Прослушать ещё раз</button>
          <button id="nextStory" class="cta" style="margin-top:10px;width:100%;border:none;cursor:pointer;">Дальше →</button>
        </div>
      </div>`;

    const audioCtrl = mountAudioControl(
      root.querySelector('#storyAudioBox'),
      r => {
        const payload = item.lines.map(l => ({ speaker: l.speaker, text: l.hanzi }));
        speakDialog(payload, { rate: r });
      },
      { autoPlay: true }
    );

    root.querySelector('#storyKind').onchange = e => {
      curKind = e.target.value;
      safeStorage.setItem('hsk_story_kind', curKind);
      render();
    };

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
               const linesHtml = item.lines.map((l, lineIdx) => {
          const prefix = item.kind === 'dialogue' ? `<b>${l.speaker}:</b> ` : '';
          return `<div style="margin-bottom:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:18px;font-weight:600;">${prefix}${makeClickableHanzi(l.hanzi)}</div>
              <div style="font-size:14px;color:#1E7E5E;">${l.pinyin}</div>
              <div style="font-size:14px;color:#4B5563;">${l.ru}</div>
            </div>
            <button type="button" class="ghost say-line-btn" data-line-idx="${lineIdx}" title="Прослушать фразу" style="padding:5px 9px;font-size:14px;flex-shrink:0;">🔊</button>
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
        transcriptBox.querySelectorAll('.say-line-btn').forEach(btnLine => {
          btnLine.onclick = () => {
            const lineObj = item.lines[Number(btnLine.dataset.lineIdx)];
            if (lineObj) speak(lineObj.hanzi, { rate: 0.9, instant: true });
          };
        });
        reveal.querySelector('#again').onclick = () => audioCtrl.replay();
        reveal.querySelector('#nextStory').onclick = onDone;
      };
      answerEl.appendChild(btn);
    });
  }

  render();
}
