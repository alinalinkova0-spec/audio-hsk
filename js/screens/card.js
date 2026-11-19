import { speak } from '../audio.js';
import { review } from '../srs.js';

export function renderCard(root, word, srsState, onDone) {
  const all = window.__ALL_WORDS || [];
  root.innerHTML = `
    <div class="card">
      <div class="card-audio">
        <button id="play" class="big-play">▶</button>
        <button id="slow" class="ghost">0.85x</button>
      </div>
      <p class="prompt">Что это значит?</p>
      <div class="answers" id="answers"></div>
      <div class="reveal" id="reveal" hidden>
        <div class="hanzi" id="hanzi"></div>
        <div class="pinyin" id="pinyin"></div>
        <div id="ru"></div>
        <button id="again" class="ghost" style="margin-top:12px;">↻ Прослушать ещё раз</button>
        <div class="grades">
          <button data-grade="0">Забыл</button>
          <button data-grade="1">Сложно</button>
          <button data-grade="2">Норм</button>
          <button data-grade="3">Легко</button>
        </div>
      </div>
    </div>`;

  const opts = shuffle([word, ...shuffle(all.filter(w => w.id !== word.id)).slice(0, 3)]);
  const answersEl = root.querySelector('#answers');
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.textContent = o.ru;
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
    if (!ok) [...answersEl.children].forEach(b => {
      if (b.textContent === word.ru) b.classList.add('ok');
    });
    reveal.hidden = false;
    reveal.querySelector('#hanzi').textContent = word.hanzi;
    reveal.querySelector('#pinyin').textContent = word.pinyin;
    reveal.querySelector('#ru').textContent = word.ru;
    reveal.querySelector('#again').onclick = () => speak(word.hanzi);
    reveal.querySelectorAll('[data-grade]').forEach(g => {
      g.onclick = () => { review(srsState, word.id, +g.dataset.grade); onDone(); };
    });
  }
}
function shuffle(a) {
  return a.map(v => [Math.random(), v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]);
}
