import { speak } from '../audio.js?v=13';

export function renderMonthVisitCalendarHtml(markTodayVisit) {
  const daysList = markTodayVisit();
  const visitedSet = new Set(daysList);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let monthVisitsCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (visitedSet.has(key)) monthVisitsCount++;
  }

  let cells = '';
  for (let i = 0; i < startOffset; i++) {
    cells += `<div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isVisited = visitedSet.has(key);
    const isToday = d === todayDate;
    const bg = isVisited ? '#EDF5F0' : 'transparent';
    const border = isToday ? '1.5px solid var(--jade)' : (isVisited ? '1px solid #C6E2D4' : '1px solid transparent');
    cells += `
      <div style="height:36px;border-radius:10px;background:${bg};border:${border};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;">
        <span style="font-size:10px;color:${isVisited ? 'var(--jade)' : 'var(--muted)'};font-weight:${isToday ? '800' : '600'};">${d}</span>
        <span style="font-size:13px;margin-top:1px;">${isVisited ? '🐾' : '·'}</span>
      </div>`;
  }

  return `
    <div class="box" style="padding:12px;margin-bottom:12px;text-align:left;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:800;color:var(--fg);">📅 ${monthNames[month]} ${year}</div>
        <div style="font-size:12px;font-weight:700;color:var(--jade);background:#EDF5F0;padding:3px 9px;border-radius:999px;">🐾 ${monthVisitsCount} дн. в этом месяце</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:4px;">
        ${weekLabels.map(w => `<div style="font-size:11px;font-weight:700;color:var(--muted);">${w}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">
        ${cells}
      </div>
    </div>`;
}

export function renderStats(app, ctx) {
  const { srs, getAllWords, saveVocab, markTodayVisit } = ctx;
  const allWords = getAllWords();
  const inProgress = Object.values(srs).filter(s => s.reps >= 1).length;
  const confident = Object.values(srs).filter(s => s.reps >= 3).length;
  let dictFilter = 'learned';
  let dictQuery = '';

  app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:10px 16px 16px;">
    <h1 style="margin:0 0 4px;font-size:28px;">Словарь и прогресс</h1>
    <p style="font-size:15px;line-height:1.4;color:var(--muted);margin:0 0 12px;">Здесь все слова, которые ты уже послушал и повторяешь. Заглядывай сюда освежить память!</p>
    ${renderMonthVisitCalendarHtml(markTodayVisit)}
    <div class="box" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;padding:12px;">
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--fg);">${allWords.length}</div>
        <div style="font-size:12px;color:var(--muted);">В базе</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--beak);">${inProgress}</div>
        <div style="font-size:12px;color:var(--muted);">В повторении</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--jade);">${confident}</div>
        <div style="font-size:12px;color:var(--muted);">Уверенно</div>
      </div>
    </div>

    <div class="box" style="margin-top:14px;">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button data-dfilter="learned" class="ghost" style="flex:1;padding:7px 6px;font-size:13px;border-color:var(--jade);background:#EDF5F0;font-weight:600;">Изученные (${inProgress})</button>
        <button data-dfilter="all" class="ghost" style="flex:1;padding:7px 6px;font-size:13px;">Все слова (${allWords.length})</button>
      </div>
      <input type="search" id="dictSearch" placeholder="Поиск по иероглифу, пиньиню или переводу..." style="width:100%;padding:9px 12px;border-radius:12px;border:1.5px solid var(--border);font-size:14px;margin-bottom:10px;">
      <div id="dictList" style="display:flex;flex-direction:column;gap:6px;max-height:210px;overflow-y:auto;"></div>
    </div>
    <div class="box" style="margin-top:14px;">
      <h3 style="margin-top:0;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Свой список слов</h3>
      <p style="color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Нужны слова из твоего учебника или с курсов? Загрузи свой файл <b>.txt</b> или <b>.csv</b> — и тренируй их на слух!</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        <details style="background:#FAFBF9;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:13px;">
          <summary style="cursor:pointer;font-weight:600;color:var(--jade);">Как подготовить и загрузить свой файл?</summary>
          <div style="margin-top:8px;line-height:1.5;color:var(--fg);">
            <div><b>1.</b> Создай файл в «Блокноте», «Заметках» или Excel и сохрани его в формате <b>.txt</b> или <b>.csv</b> (кодировка UTF-8).</div>
            <div style="margin-top:4px;"><b>2.</b> Запиши каждое слово с новой строки через точку с запятой:</div>
            <pre style="background:#F0F4F1;padding:8px;border-radius:8px;margin:6px 0;font-size:12px;overflow-x:auto;">你好;nǐ hǎo;привет;1
谢谢;xièxie;спасибо;1
学习;xuéxí;учиться;2</pre>
            <div><b>3.</b> Пиньинь и цифру уровня (1–4) можно не указывать (например: <code>苹果;;яблоко</code> — по умолчанию поставится 4 уровень).</div>
            <div style="margin-top:4px;color:var(--beak);">⚠️ Загрузка своего файла заменит текущий словарь в памяти устройства.</div>
          </div>
        </details>

        <label class="ghost" style="text-align:center;cursor:pointer;font-size:14px;font-weight:600;">
          📂 Выбрать файл (.txt / .csv)
          <input type="file" id="csvFile" accept=".txt,.csv" style="display:none;">
        </label>
      </div>
      <p id="fetchStatus" style="margin-top:8px;font-size:13px;color:var(--jade);"></p>
    </div>
  </section>`;

  const listEl = app.querySelector('#dictList');
  const renderDict = () => {
    const q = dictQuery.trim().toLowerCase();
    let items = dictFilter === 'learned'
      ? allWords.filter(w => srs[w.id] && srs[w.id].reps >= 1)
      : allWords;
    if (q) {
      items = items.filter(w =>
        (w.hanzi && w.hanzi.toLowerCase().includes(q)) ||
        (w.pinyin && w.pinyin.toLowerCase().includes(q)) ||
        (w.ru && w.ru.toLowerCase().includes(q))
      );
    }
    if (!items.length) {
      listEl.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0;">Пока пусто — пройди несколько слов в «Заданиях» или переключись на «Все слова»</div>`;
      return;
    }
    const shown = items.slice(0, 80);
    listEl.innerHTML = shown.map(w => {
      const reps = (srs[w.id] && srs[w.id].reps) || 0;
      const mark = reps >= 3 ? '★' : (reps >= 1 ? '✓' : '');
      return `<button data-say="${w.hanzi}" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#FAFBF9;border:1px solid var(--border);border-radius:12px;cursor:pointer;text-align:left;gap:8px;">
        <div>
          <span style="font-size:17px;font-weight:700;color:var(--fg);">${w.hanzi}</span>
          <span style="font-size:13px;color:var(--jade);margin-left:6px;">${w.pinyin || ''}</span>
          <div style="font-size:13px;color:var(--muted);margin-top:2px;">${w.ru}</div>
        </div>
        <span style="font-size:13px;color:var(--jade);font-weight:700;flex-shrink:0;">${mark} 🔊</span>
      </button>`;
    }).join('') + (items.length > 80 ? `<div style="text-align:center;font-size:12px;color:var(--muted);padding:6px;">Показаны первые 80 из ${items.length} слов — уточни поиск</div>` : '');

    listEl.querySelectorAll('[data-say]').forEach(b => {
      b.onclick = () => speak(b.dataset.say, { rate: 0.95, instant: true });
    });
  };

  app.querySelectorAll('[data-dfilter]').forEach(btn => {
    btn.onclick = () => {
      dictFilter = btn.dataset.dfilter;
      app.querySelectorAll('[data-dfilter]').forEach(x => {
        const active = x.dataset.dfilter === dictFilter;
        x.style.borderColor = active ? 'var(--jade)' : '';
        x.style.background = active ? '#EDF5F0' : '';
        x.style.fontWeight = active ? '600' : '500';
      });
      renderDict();
    };
  });

  app.querySelector('#dictSearch').oninput = e => {
    dictQuery = e.target.value;
    renderDict();
  };

  renderDict();

  app.querySelector('#csvFile').onchange = e => {
    const file = e.target.files && e.target.files.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      const custom = lines.map((line, idx) => {
        const parts = line.split(/[;\t]/);
        const hanzi = (parts.at(0) || '').trim();
        const pinyin = (parts.at(1) || '').trim();
        const ru = (parts.at(2) || '').trim();
        const lvl = Number(parts.at(3)) || 4;
        return { id: 'c_' + (idx + 1), hanzi, pinyin, ru, level: lvl };
      }).filter(w => w.hanzi && w.ru);
      if (custom.length) {
        saveVocab(custom);
        alert('Загружено ' + custom.length + ' слов в офлайн-память!');
        renderStats(app, ctx);
      }
    };
    reader.readAsText(file, 'utf-8');
  };
}
