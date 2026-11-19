import { speak } from '../audio.js';
import { review, saveSRS } from '../srs.js';

function randomRate() {
  return +(0.9 + Math.random() * 0.25).toFixed(2);
}

export function renderPhraseChoice(root, s, allSentences, srsState, onDone) {
  const distractors = allSentences
    .filter(x => x.id !== s.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = [s, ...distractors].sort(() => Math.random() - 0.5);
  const currentRate = randomRate();

  root.innerHTML = `
    <div class="card">
      <div class="card-audio">
        <button id="play" class="big-play" aria-label="Прослушать">▶</button>
        <button id="slow" class="ghost">0.8x</button>
      </div>
      <p class="prompt">Прослушай фразу (темп: <b>${currentRate}x</b>) и выбери перевод</p>
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

  options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'answer';
    btn.style.fontSize = '16px';
    btn.style.padding = '14px';
    btn.textContent = o.ru;
    btn.onclick = () => choose(o, btn);
    answerEl.appendChild(btn);
  });

  root.querySelector('#play').onclick = () => speak(s.hanzi, { rate: currentRate });
  root.querySelector('#slow').onclick = () => speak(s.hanzi, { rate: 0.75 });
  setTimeout(() => speak(s.hanzi, { rate: currentRate }), 200);

  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === s.id;
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) [...answerEl.children].forEach(b => {
      if (b.textContent === s.ru) b.classList.add('ok');
    });

    speak(s.hanzi, { rate: 0.95 });

    reveal.hidden = false;
    reveal.querySelector('#phraseText').innerHTML = `
      <div>${s.hanzi}</div>
      <div style="font-size:17px;color:#94a3b8;margin-top:6px;font-weight:400;">${s.pinyin}</div>
      <div style="font-size:16px;color:#e2e8f0;margin-top:6px;font-weight:400;">${s.ru}</div>
    `;
    reveal.querySelector('#again').onclick = () => speak(s.hanzi, { rate: 0.95 });
    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => {
        review(srsState, s.id, +g.dataset.grade);
        saveSRS(srsState);
        onDone();
      };
    });
  }
}
