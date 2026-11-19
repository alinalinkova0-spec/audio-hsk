import { speak } from '../audio.js';

export function renderSegment(root, s, onDone) {
  const chars = [...s.hanzi.replace(/[。！？，、\s]/g, '')];
  root.innerHTML = `
    <div class="card">
      <div style="text-align:center"><button id="play" class="big-play">▶</button></div>
      <p class="prompt">Нажимайте между словами, затем «Проверить»</p>
      <div class="charbar" id="charbar"></div>
      <div style="text-align:center"><button id="check" class="ghost">Проверить</button></div>
      <div id="result" style="text-align:center; margin-top:16px;"></div>
    </div>`;

  const bar = root.querySelector('#charbar');
  const chosen = new Set();
  chars.forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.className = 'ch';
    sp.textContent = ch;
    bar.appendChild(sp);
    if (i < chars.length - 1) {
      const gap = document.createElement('span');
      gap.className = 'gap';
      gap.onclick = () => {
        if (chosen.has(i)) { chosen.delete(i); gap.classList.remove('active'); }
        else { chosen.add(i); gap.classList.add('active'); }
      };
      bar.appendChild(gap);
    }
  });

  root.querySelector('#play').onclick = () => speak(chars.join(''), { rate: 0.95 });

  root.querySelector('#check').onclick = () => {
    const correct = new Set(s.boundaries);
    let ok = 0, extra = 0;
    chosen.forEach(i => correct.has(i) ? ok++ : extra++);
    const missed = [...correct].filter(i => !chosen.has(i)).length;
    root.querySelector('#result').innerHTML = `
      <p>Верно: <b>${ok}</b>, лишних: <b>${extra}</b>, пропущено: <b>${missed}</b></p>
      <p>${s.hanzi}</p>
      <p style="color:var(--accent)">${s.pinyin}</p>
      <p style="color:var(--muted)">${s.ru}</p>
      <button id="next" class="ghost" style="margin-top:12px;">Дальше</button>`;
    root.querySelector('#check').disabled = true;
    root.querySelector('#next').onclick = onDone;
  };
}
