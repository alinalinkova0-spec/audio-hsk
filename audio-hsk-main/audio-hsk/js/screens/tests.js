 import { safeStorage } from '../storage.js?v=7';
import { speak, mountAudioControl } from '../audio.js?v=13';

export async function renderPlacementTest(app, ctx) {
  const { downloadLevelsUpTo, setSelectedLevel, setSelectedLesson, home } = ctx;

  app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:95px 16px 20px;text-align:center;">
    <h2 style="margin:0 0 6px;font-size:24px;">Подготовка теста...</h2>
    <p id="plLoad" style="color:var(--muted);margin:0;font-size:14px;"></p>
    <div style="width:310px;height:310px;margin:-45px auto 0;position:relative;mix-blend-mode:multiply;">
      <img src="./js/geese/goose_test.jpg" alt="Подготовка теста" style="width:100%;height:100%;object-fit:contain;display:block;">
      <div style="position:absolute;top:24%;left:26%;width:15%;height:34%;background:#ffffff;pointer-events:none;"></div>
    </div>
  </section>`;

  try {
    const host = 'raw.' + 'github' + 'usercontent.com';
    const ruUrl = 'https://' + host + '/LiudmilaLV/json_hsk/master/hsk.json';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const [resNew, resRu] = await Promise.all([
      fetch('./hsk.json?v=3'),
      fetch(ruUrl, { signal: ctrl.signal }).catch(() => null)
    ]).finally(() => clearTimeout(timer));
    if (!resNew.ok) throw new Error('HTTP ' + resNew.status);
    const raw = await resNew.json();
    const shortRu = str => {
      const firstMeaning = String(str || '')
        .split(/[,;/()]/)
        .map(s => s.trim())
        .find(Boolean) || '';
      return firstMeaning.split(/\s+/).slice(0, 2).join(' ');
    };
    const ruMap = new Map();
    if (resRu && resRu.ok) {
      try {
        const ruList = await resRu.json();
        ruList.forEach(w => {
          if (w.hanzi && w.translations && Array.isArray(w.translations.rus)) {
            ruMap.set(w.hanzi, {
              ru: shortRu(w.translations.rus.at(0)),
              pinyin: w.pinyin || ''
            });
          }
        });
      } catch {}
    }
    const byLvl = { lvl1: [], lvl2: [], lvl3: [], lvl4: [], lvl5: [], lvl6: [] };
    for (const item of raw) {
      let hanzi = '';
      let lvl = 0;
      let pinyin = '';
      if (item.hanzi && item.level) {
        hanzi = String(item.hanzi).trim();
        lvl = Number(item.level);
        pinyin = String(item.pinyin || '').trim();
      } else {
        const lvls = item.l || item.level || Array.of();
        lvl = Array.of(1, 2, 3, 4, 5, 6).find(n => lvls.includes('n' + n)) || 0;
        const forms = item.f || item.forms || Array.of();
        const form = forms.at(0) || {};
        hanzi = item.s || item.simplified || '';
        const rawI = Array.isArray(form.i) ? form.i.at(0) : form.i;
        pinyin = (typeof rawI === 'string' ? rawI : (rawI && (rawI.y || rawI.pinyin || rawI.p))) || form.p || '';
      }

      const key = 'lvl' + lvl;
      if (!hanzi || !byLvl[key]) continue;
      const found = ruMap.get(hanzi);
      const ru = (found && found.ru && /[а-яё]/i.test(found.ru)) ? found.ru : shortRu(item.ru || '');
      if (ru && /[а-яё]/i.test(ru)) {
        byLvl[key].push({ hanzi, pinyin: pinyin || (found && found.pinyin) || '', ru, level: lvl });
      }
    }

    const testQueue = [];
    const pickOne = arr => arr.sort(() => Math.random() - 0.5).slice(0, 1);

    for (const lvl of Array.of(1, 2, 3, 4, 5, 6)) {
      const list = byLvl['lvl' + lvl];
      const third = Math.max(1, Math.floor(list.length / 3));
      const easy = pickOne(list.slice(0, third)).map(w => ({ ...w, diff: 'easy' }));
      const mid = pickOne(list.slice(third, third * 2)).map(w => ({ ...w, diff: 'medium' }));
      const hard = pickOne(list.slice(third * 2)).map(w => ({ ...w, diff: 'hard' }));
      testQueue.push(...easy, ...mid, ...hard);
    }

    const validQueue = testQueue.filter(w => w.ru);
    const allRuPool = Array.from(new Set(
      [...byLvl.lvl1, ...byLvl.lvl2, ...byLvl.lvl3, ...byLvl.lvl4, ...byLvl.lvl5, ...byLvl.lvl6]
        .map(w => w.ru)
        .filter(Boolean)
    ));
    const recentRuShown = [];

    let idx = 0;
    const statsByLvl = {
      lvl1: { ok: 0, hardOk: 0 },
      lvl2: { ok: 0, hardOk: 0 },
      lvl3: { ok: 0, hardOk: 0 },
      lvl4: { ok: 0, hardOk: 0 },
      lvl5: { ok: 0, hardOk: 0 },
      lvl6: { ok: 0, hardOk: 0 }
    };

    function renderQuestion() {
      if (idx >= validQueue.length) {
        let detected = 1;
        for (const lvl of Array.of(1, 2, 3, 4, 5)) {
          const st = statsByLvl['lvl' + lvl];
          if (st.ok >= 2 && (st.hardOk >= 1 || st.ok === 3)) {
            detected = lvl + 1;
          } else {
            break;
          }
        }

        app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;text-align:center;">
          <h1>Тест завершён! 🎯</h1>
          <div class="box" style="text-align:left;margin:14px 0;font-size:14px;line-height:1.7;">
            <div>HSK 1: <b>${statsByLvl.lvl1.ok}/3</b> верно</div>
            <div>HSK 2: <b>${statsByLvl.lvl2.ok}/3</b> верно</div>
            <div>HSK 3: <b>${statsByLvl.lvl3.ok}/3</b> верно</div>
            <div>HSK 4: <b>${statsByLvl.lvl4.ok}/3</b> верно</div>
            <div>HSK 5: <b>${statsByLvl.lvl5.ok}/3</b> верно</div>
            <div>HSK 6: <b>${statsByLvl.lvl6.ok}/3</b> верно</div>
          </div>
          <p style="font-size:16px;font-weight:700;color:var(--jade);">Рекомендуемый старт: HSK ${detected}</p>
          <p id="plSaveStatus" style="font-size:14px;color:var(--accent);font-weight:600;margin-top:8px;"></p>
        </section>`;

        downloadLevelsUpTo(detected, app.querySelector('#plSaveStatus')).then(() => {
          safeStorage.setItem('hsk_start_lvl', String(detected));
          setSelectedLevel(String(detected));
          setSelectedLesson(0);
          safeStorage.setItem('hsk_lvl', String(detected));
          safeStorage.setItem('hsk_les', '0');
          history.replaceState(null, '', '#/');
          home();
        });
        return;
      }
      if (recentRuShown.includes(validQueue[idx].ru)) {
        const swapIdx = validQueue.findIndex((item, i) => i > idx && !recentRuShown.includes(item.ru));
        if (swapIdx !== -1) {
          const [picked] = validQueue.splice(swapIdx, 1);
          validQueue.splice(idx, 0, picked);
        }
      }

      const cur = validQueue[idx];
      const freshPool = allRuPool.filter(r => r !== cur.ru && !recentRuShown.includes(r));
      const fallbackPool = allRuPool.filter(r => r !== cur.ru && recentRuShown.includes(r));
      const distractors = [
        ...freshPool.sort(() => Math.random() - 0.5),
        ...fallbackPool.sort(() => Math.random() - 0.5)
      ].slice(0, 3);
      const options = Array.of(cur.ru, ...distractors).sort(() => Math.random() - 0.5);

      options.forEach(r => {
        const pos = recentRuShown.indexOf(r);
        if (pos !== -1) recentRuShown.splice(pos, 1);
        recentRuShown.push(r);
      });
      while (recentRuShown.length > 8) recentRuShown.shift();

      app.innerHTML = `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="color:var(--accent);font-weight:800;font-size:15px;letter-spacing:0.5px;text-transform:uppercase;">ОПРЕДЕЛЕНИЕ УРОВНЯ</span>
          <span style="color:var(--muted);font-size:13px;font-weight:600;">${idx + 1} / ${validQueue.length}</span>
        </div>
        <div id="plAudioBox" class="card-audio"></div>
        <p class="prompt">Выбери перевод услышанного слова</p>
        <div id="plAnswers" class="answers" style="grid-template-columns:1fr 1fr;"></div>
        <button id="plSkip" class="ghost" style="width:100%;margin-top:12px;font-size:15px;font-weight:600;background:#FBF4EA;border-color:#E5CFAF;color:#8A5A1E;">Не знаю</button>
      </div>`;

      mountAudioControl(
        app.querySelector('#plAudioBox'),
        r => speak(cur.hanzi, { rate: r }),
        { autoPlay: true }
      );

      const ansBox = app.querySelector('#plAnswers');
      let locked = false;
      const showCorrect = () => {
        Array.from(ansBox.children).forEach(x => {
          if (x.textContent === cur.ru) x.classList.add('ok');
        });
      };
      options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'answer';
        b.style.fontSize = '16px';
        b.style.padding = '13px';
        b.textContent = opt;
        b.onclick = () => {
          if (locked) return;
          locked = true;
          const ok = opt === cur.ru;
          b.classList.add(ok ? 'ok' : 'bad');
          if (!ok) {
            showCorrect();
          } else {
            const st = statsByLvl['lvl' + cur.level];
            st.ok += 1;
            if (cur.diff === 'hard') st.hardOk += 1;
          }
          idx += 1;
          setTimeout(renderQuestion, 600);
        };
        ansBox.appendChild(b);
      });

      app.querySelector('#plSkip').onclick = () => {
        if (locked) return;
        locked = true;
        showCorrect();
        idx += 1;
        setTimeout(renderQuestion, 750);
      };
    }

    renderQuestion();
  } catch (e) {
    app.innerHTML = `<section class="hero"><h2>Не удалось загрузить тест</h2>
      <p style="color:var(--accent);">${e.message}</p>
      <a href="#/" class="cta">Назад</a></section>`;
  }
}

export async function renderLevelUpTest(app, ctx) {
  const { getSelectedLevel, setSelectedLevel, setSelectedLesson, downloadLevelsUpTo, getAllWords } = ctx;
  const curLvl = Number(getSelectedLevel()) || 1;
  const targetLvl = Math.min(4, curLvl + 1);

  app.innerHTML = `<section class="hero" style="padding:32px 16px;">
    <h2>Экспресс-проверка на HSK ${targetLvl} 🚀</h2>
    <p id="luStatus" style="color:var(--muted);">Готовим 10 проверочных слов...</p>
  </section>`;

  try {
    await downloadLevelsUpTo(targetLvl, app.querySelector('#luStatus'));
    const allWords = getAllWords();
    const curPool = allWords.filter(w => Number(w.level) === curLvl && /[а-яё]/i.test(w.ru));
    const nextPool = allWords.filter(w => Number(w.level) === targetLvl && /[а-яё]/i.test(w.ru));
    const pick = (arr, n) => Array.from(arr).sort(() => Math.random() - 0.5).slice(0, n);
    const queue = pick(curPool, 5).concat(pick(nextPool, 5)).sort(() => Math.random() - 0.5);
    const ruPool = Array.from(new Set(allWords.filter(w => /[а-яё]/i.test(w.ru)).map(w => w.ru)));
    let idx = 0;
    let score = 0;

    function renderStep() {
      if (idx >= queue.length) {
        const passed = score >= 8;
        if (passed) {
          safeStorage.setItem('hsk_start_lvl', String(targetLvl));
          setSelectedLevel(String(targetLvl));
          setSelectedLesson(0);
          safeStorage.setItem('hsk_lvl', String(targetLvl));
          safeStorage.setItem('hsk_les', '0');
        }
        safeStorage.setItem('hsk_streak', '0');
        app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:24px 16px;">
          <h1>${passed ? `Уровень HSK ${targetLvl} открыт! 🎉` : 'Почти получилось! 💪'}</h1>
          <p style="font-size:16px;margin:10px 0;">Верных ответов: <b>${score} из ${queue.length}</b> (нужно минимум 8)</p>
          <p style="font-size:14px;color:var(--muted);">${passed ? 'Словарь нового уровня уже загружен, можно приступать к занятиям.' : 'Ещё немного практики на текущем уровне, и следующая попытка точно удастся!'}</p>
          <a href="#/" class="cta" style="margin-top:14px;display:inline-block;">Перейти к занятиям</a>
        </section>`;
        return;
      }

      const cur = queue[idx];
      const distractors = ruPool.filter(r => r !== cur.ru).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = Array.of(cur.ru, ...distractors).sort(() => Math.random() - 0.5);
      let playCount = 0;

      app.innerHTML = `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
          <span style="color:var(--accent);font-weight:700;">🚀 Проверка на HSK ${targetLvl}</span>
          <span style="color:var(--muted);">${idx + 1} / ${queue.length}</span>
        </div>
        <div class="card-audio" style="flex-direction:column;align-items:center;gap:8px;">
          <button id="luPlay" class="big-play" style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;padding:0;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#FFFDF9" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <span style="font-size:12px;color:var(--muted);">Нажми для повтора медленнее</span>
        </div>
        <p class="prompt">Выбери перевод услышанного слова</p>
        <div id="luAns" class="answers" style="grid-template-columns:1fr;"></div>
      </div>`;

      const play = () => {
        speak(cur.hanzi, { rate: playCount % 2 === 1 ? 0.72 : 1.0 });
        playCount += 1;
      };
      app.querySelector('#luPlay').onclick = play;
      play();

      const box = app.querySelector('#luAns');
      let locked = false;
      opts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'answer';
        b.style.fontSize = '16px';
        b.style.padding = '13px';
        b.textContent = opt;
        b.onclick = () => {
          if (locked) return;
          locked = true;
          const ok = opt === cur.ru;
          b.classList.add(ok ? 'ok' : 'bad');
          if (ok) score += 1;
          else Array.from(box.children).forEach(x => { if (x.textContent === cur.ru) x.classList.add('ok'); });
          idx += 1;
          setTimeout(renderStep, 600);
        };
        box.appendChild(b);
      });
    }

    renderStep();
  } catch (e) {
    app.innerHTML = `<section class="hero"><h2>Не удалось загрузить тест</h2>
      <p style="color:var(--accent);">${e.message}</p>
      <a href="#/" class="cta">Назад</a></section>`;
  }
}
