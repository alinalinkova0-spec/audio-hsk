import { speak } from '../audio.js';
import { review, saveSRS } from '../srs.js';

export function renderCard(root, word, srsState, onDone) {
  const all = window.__ALL_WORDS || [];
  root.innerHTML = `
    <div class="card">
      <div class="card-audio">
        <button id="play" class="big-play">▶</button>
        <button id="slow" class="ghost">0.85x</button>
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

  const pool = all.length >= 4 ? all : [...all, { id:'x1', hanzi:'学习' }, { id:'x2', hanzi:'工作' }, { id:'x3', hanzi:'时间' }];
  const opts = shuffle([word, ...shuffle(pool.filter(w => w.id !== word.id)).slice(0, 3)]);
  const answersEl = root.querySelector('#answers');
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '28px';
    b.style.textAlign = 'center';
    b.textContent = o.hanzi;
    b.onclick = () => choose(o, b);
    answersEl.appendChild(b);
  });

  const reveal = root.querySelector('#reveal');
  root.querySelector('#play').onclick = () => speak(word.hanzi);
  root.querySelector('#slow').onclick = () => speak(word.hanzi, { rate: 0.85 });
  setTimeout(() => speak(word.hanzi), 200);

  let done = false;
  function choose(o, btn) {
    if (done) return;
    done = true;
    const ok = o.id === word.id;
    btn.classList.add(ok ? 'ok' : 'bad');
        if (!ok) [...answerEl.children].forEach(b => {
      if (b.textContent === word.hanzi) b.classList.add('ok');
    });
    speak(o.hanzi);
    reveal.hidden = false;
    reveal.querySelector('#hanzi').innerHTML = `
  <div>${word.hanzi}</div>
  ${word.pinyin ? `<div style="font-size: 20px; color: #94a3b8; margin-top: 6px; font-weight: 400;">${word.pinyin}</div>` : ''}
  ${word.ru ? `<div style="font-size: 18px; color: #e2e8f0; margin-top: 6px; font-weight: 400;">${word.ru}</div>` : ''}
`;
    reveal.querySelector('#again').onclick = () => speak(word.hanzi);
    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => {
        review(srsState, word.id, +g.dataset.grade);
        saveSRS(srsState);
        onDone();
      };
    });
  }
}

function shuffle(a) {
  return a.map(v => ({ r: Math.random(), v })).sort((x, y) => x.r - y.r).map(x => x.v);
}
