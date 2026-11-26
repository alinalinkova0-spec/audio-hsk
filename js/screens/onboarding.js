import { safeStorage, getSavedEmail, setSavedName, loginByEmail, pushCloudState, findProfilesByNickname } from '../storage.js?v=11';
import { speak } from '../audio.js?v=13';
import { loadSRS } from '../srs.js?v=2';

function makeRandomGooseCode() {
  const n1 = Math.floor(1000 + Math.random() * 9000);
  const n2 = Math.floor(10 + Math.random() * 90);
  return `GOOSE-${n1}-${n2}`;
}

function normalizeGooseCode(raw) {
  const clean = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return '';
  if (clean.startsWith('GOOSE-')) return clean;
  if (clean.startsWith('GOOSE')) return 'GOOSE-' + clean.slice(5).replace(/^-+/, '');
  return 'GOOSE-' + clean.replace(/^-+/, '');
}

export function renderOnboarding(app, ctx) {
  const {
    srs,
    allWords,
    uState,
    getSelectedLevel,
    setSelectedLevel,
    setSelectedLesson,
    downloadLevelsUpTo,
    syncUrlState,
    getTodayMood,
    setTodayMood,
    home
  } = ctx;

  const hasAccount = !!getSavedEmail() || safeStorage.getItem('hsk_skip_email') === '1';
  const CODENAMES = [
    'Агент Утка',
    'Мастер Пиньиня',
    'Дракон HSK',
    'Лорд Иероглиф',
    'Император Тонов',
    'Шифу Аудирования',
    'Гусь из Пекина',
    'Тайная Панда',
    'Хранитель Тонов',
    'Нефритовый Гусь',
    'Капитан Улун',
    'Мастер Цзяоцзы',
    'Шпион из Хутунов',
    'Укротитель Тонов',
    'Магистр Иероглифов',
    'Агент Поднебесной',
    'Нефритовый Лис',
    'Гусь-Полиглот'
  ];

  if (!hasAccount) {
    const initialRandomName = CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
    app.innerHTML = `
<section class="hero" style="max-width:420px;margin:0 auto;padding:0 14px 4px;">
    <div style="width:200px;height:200px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">
    <img src="./js/geese/goose.jpg?v=2" alt="Гусь" onerror="this.style.display='none'" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;user-select:none;">
  </div>
   <h1 id="step1SayNiHao" title="Нажми, чтобы послушать" style="margin:0 0 8px;font-size:34px;font-weight:800;line-height:1.15;color:var(--jade);cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding-left:40px;">
    <span>你好！</span>
    <button type="button" aria-label="Послушать" style="background:#EDF5F0;border:1px solid #CFE2D7;border-radius:999px;width:32px;height:32px;padding:0;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">🔊</button>
  </h1>
    <p style="font-size:16px;line-height:1.45;color:var(--fg);margin:0 0 12px;text-align:center;">
    Это тренажёр по аудированию <b>1–6 HSK 3.0</b>.<br>
    Выбери имя — и получи <b>код</b> для сохранения прогресса.
  </p>

  <div class="box" style="text-align:left;padding:14px;margin-bottom:10px;">
    <label for="step1NameInput" style="display:block;font-size:15px;font-weight:700;margin-bottom:6px;color:var(--fg);">Твоё имя или никнейм:</label>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <input id="step1NameInput" type="text" placeholder="Например: ${initialRandomName}" style="flex:1;min-width:0;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border);font-size:16px;background:#fff;color:var(--fg);">
      <button id="rollNameBtn" type="button" class="ghost" title="Придумать случайное имя" style="padding:0 13px;font-size:18px;font-weight:700;white-space:nowrap;">🎲</button>
    </div>
    <button id="step1StartBtn" class="cta" style="width:100%;padding:12px;font-size:16px;border:none;cursor:pointer;">Создать код и начать →</button>
    <button id="step1GuestBtn" type="button" class="ghost" style="width:100%;padding:9px;font-size:14px;font-weight:600;color:var(--muted);margin-top:8px;">Просто попробовать</button>
  </div>

  <details class="box" style="text-align:left;padding:12px 14px;margin:0;background:#F7FAF8;border-color:#CFE2D7;">
    <summary style="cursor:pointer;font-size:15px;font-weight:800;color:var(--jade);text-align:center;list-style:none;">🔑 Уже есть аккаунт? ▾</summary>
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #CFE2D7;">
      <p style="margin:0 0 8px;font-size:14px;color:var(--muted);">Укажи цифры кода из Настроек:</p>
      <div style="display:flex;align-items:stretch;gap:6px;">
        <div style="display:flex;align-items:center;flex:1;min-width:0;border:1px solid var(--border);border-radius:10px;background:#fff;overflow:hidden;">
          <span style="padding:8px 6px 8px 10px;font-size:13px;font-weight:800;color:var(--jade);background:#EDF5F0;border-right:1px solid var(--border);user-select:none;">GOOSE-</span>
          <input id="step1CodeInput" type="text" placeholder="1234-56" style="flex:1;min-width:0;border:none;outline:none;padding:8px 9px;font-size:13px;font-weight:700;text-transform:uppercase;background:#fff;color:var(--fg);">
        </div>
        <button id="step1RestoreBtn" class="ghost" style="padding:8px 12px;font-size:13px;font-weight:700;border-color:var(--jade);color:var(--jade);white-space:nowrap;">Войти →</button>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #CFE2D7;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">Забыл код? Найти по никнейму:</div>
        <div style="display:flex;gap:6px;">
          <input id="step1FindNickInput" type="text" placeholder="Введи имя или никнейм" style="flex:1;min-width:0;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--border);font-size:13px;background:#fff;color:var(--fg);">
          <button id="step1FindNickBtn" type="button" class="ghost" style="padding:8px 11px;font-size:13px;font-weight:700;white-space:nowrap;">Найти</button>
        </div>
        <div id="step1NickResults" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;"></div>
      </div>
    </div>
  </details>
  <div id="step1Status" style="font-size:12px;color:var(--jade);font-weight:600;margin-top:6px;text-align:center;"></div>
</section>`;

    const nameInput = app.querySelector('#step1NameInput');
    const rollBtn = app.querySelector('#rollNameBtn');
    const startBtn = app.querySelector('#step1StartBtn');
    const guestBtn = app.querySelector('#step1GuestBtn');
    const codeInput = app.querySelector('#step1CodeInput');
    const restoreBtn = app.querySelector('#step1RestoreBtn');
    const statusEl = app.querySelector('#step1Status');
    const sayHeading = app.querySelector('#step1SayNiHao');

    if (sayHeading) sayHeading.onclick = () => speak('你好！', { rate: 0.95 });

    rollBtn.onclick = () => {
      const pool = CODENAMES.filter(n => n !== nameInput.value.trim());
      nameInput.value = pool[Math.floor(Math.random() * pool.length)];
    };

    guestBtn.onclick = () => {
      const nameVal = (nameInput?.value || '').trim();
      if (nameVal) setSavedName(nameVal);
      safeStorage.setItem('hsk_skip_email', '1');
      syncUrlState();
      home();
    };

    const handleCreateNew = async () => {
      const nameVal = (nameInput?.value || '').trim();
      const autoCode = makeRandomGooseCode();
      if (nameVal) setSavedName(nameVal);
      safeStorage.setItem('hsk_user_email', autoCode);
      startBtn.disabled = true;
      statusEl.style.color = 'var(--jade)';
      statusEl.textContent = `Твой уникальный код ${autoCode} создан!`;
      try {
        await pushCloudState(autoCode);
      } catch (e) {}
      startBtn.disabled = false;
      syncUrlState();
      home();
    };

    const handleRestoreCode = async () => {
      const nameVal = (nameInput?.value || '').trim();
      const codeVal = normalizeGooseCode(codeInput?.value);
      if (!codeVal || codeVal.length < 7) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Укажи цифры своего гусиного кода (например, 1234-56)';
        codeInput.focus();
        return;
      }
      if (nameVal) setSavedName(nameVal);
      safeStorage.setItem('hsk_user_email', codeVal);
      restoreBtn.disabled = true;
      statusEl.style.color = 'var(--jade)';
      statusEl.textContent = `Проверяем код ${codeVal}...`;
      try {
        const res = await loginByEmail(codeVal);
        if (nameVal && (!res || !res.restored)) {
          setSavedName(nameVal);
          pushCloudState(codeVal).catch(() => {});
        }
        if (res && res.ok && res.restored) {
          statusEl.textContent = 'Прогресс найден! Восстанавливаем уровень и слова...';
          const freshSrs = loadSRS();
          Object.keys(srs).forEach(k => { delete srs[k]; });
          Object.assign(srs, freshSrs);
          const nextLvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl') || '1';
          setSelectedLevel(nextLvl);
          setSelectedLesson(+(safeStorage.getItem('hsk_les') || 0));
          await downloadLevelsUpTo(Number(nextLvl) || 1, statusEl).catch(() => {});
        }
      } catch (e) {}
      restoreBtn.disabled = false;
      syncUrlState();
      home();
    };

    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreateNew();
      }
    });
    codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRestoreCode();
      }
    });
    const findNickInput = app.querySelector('#step1FindNickInput');
    const findNickBtn = app.querySelector('#step1FindNickBtn');
    const nickResultsEl = app.querySelector('#step1NickResults');

    const handleFindByNick = async () => {
      const nick = (findNickInput?.value || '').trim();
      if (!nick) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Введи имя или никнейм, который указывал раньше';
        findNickInput?.focus();
        return;
      }
      findNickBtn.disabled = true;
      nickResultsEl.innerHTML = '';
      statusEl.style.color = 'var(--jade)';
      statusEl.textContent = `Ищем профиль «${nick}»...`;
      const found = await findProfilesByNickname(nick);
      findNickBtn.disabled = false;

      if (!found.ok) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Не удалось связаться с облаком, проверь интернет';
        return;
      }
      if (!found.items.length) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = `Профиль с именем «${nick}» не найден`;
        return;
      }

      statusEl.textContent = found.items.length === 1
        ? 'Нашли твой профиль! Нажми, чтобы войти:'
        : `Найдено профилей: ${found.items.length}. Выбери свой:`;

      nickResultsEl.innerHTML = found.items.map(item => `
        <button type="button" data-pick-code="${item.code}" class="ghost" style="width:100%;text-align:left;padding:9px 11px;border-radius:10px;background:#fff;border:1.5px solid var(--jade);display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;">
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:800;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name} · <span style="color:var(--jade);">${item.code}</span></div>
            <div style="font-size:11px;color:var(--muted);">HSK ${item.lvl} · слов в словаре: ${item.wordsCount}${item.dateStr ? ` · был(а) ${item.dateStr}` : ''}</div>
          </div>
          <span style="font-size:12px;font-weight:800;color:var(--jade);white-space:nowrap;">Войти →</span>
        </button>
      `).join('');

      nickResultsEl.querySelectorAll('[data-pick-code]').forEach(btn => {
        btn.onclick = () => {
          const pickedCode = btn.dataset.pickCode;
          codeInput.value = pickedCode.replace(/^GOOSE-/, '');
          handleRestoreCode();
        };
      });
    };

    if (findNickBtn) findNickBtn.onclick = handleFindByNick;
    if (findNickInput) {
      findNickInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleFindByNick();
        }
      });
    }

    startBtn.onclick = handleCreateNew;
    restoreBtn.onclick = handleRestoreCode;
    return true;
  }

  let userStartLvl = Number(safeStorage.getItem('hsk_start_lvl') || uState.l || 0);
  const savedLvl = Number(safeStorage.getItem('hsk_lvl') || uState.l || 0);
  const hasProgress = Object.keys(srs).length > 0
    || safeStorage.getItem('hsk_settings_visited') === '1'
    || !!safeStorage.getItem('hsk_daily_plan_v1')
    || !!getTodayMood();
  if (!userStartLvl && ((savedLvl >= 1 && savedLvl <= 6) || hasProgress)) {
    userStartLvl = (savedLvl >= 1 && savedLvl <= 6) ? savedLvl : 1;
  }
  if (userStartLvl >= 1 && userStartLvl <= 6) {
    safeStorage.setItem('hsk_start_lvl', String(userStartLvl));
    if (!safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_lvl') === 'all') {
      safeStorage.setItem('hsk_lvl', String(userStartLvl));
      setSelectedLevel(String(userStartLvl));
    }
  }
  syncUrlState();
  if (!userStartLvl) {
    app.innerHTML = `
  <div style="width:200px;height:200px;margin:0 auto;display:flex;align-items:center;justify-content:center;">
    <img src="./js/geese/goose_level.jpg" alt="Выбор уровня" onerror="this.style.display='none'" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;user-select:none;">
  </div>
  <h1 style="margin:14px 0 18px;font-size:26px;font-weight:800;line-height:1.2;text-align:center;">Выбери свой уровень</h1>
    <div class="box" style="text-align:left;margin:0;padding:14px;">
    <div style="font-weight:700;font-size:16px;margin-bottom:10px;text-align:center;">С какого уровня начнём?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
      <button class="ans" data-pick-lvl="1" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌱 HSK 1</button>
      <button class="ans" data-pick-lvl="2" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌿 HSK 2</button>
      <button class="ans" data-pick-lvl="3" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌳 HSK 3</button>
      <button class="ans" data-pick-lvl="4" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🎋 HSK 4</button>
      <button class="ans" data-pick-lvl="5" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">⛰️ HSK 5</button>
      <button class="ans" data-pick-lvl="6" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🐉 HSK 6</button>
    </div>
    <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:14px;color:var(--muted);margin-bottom:6px;">Не знаешь свой уровень?</div>
      <button id="startPlacementBtn" class="ghost" style="width:100%;padding:11px;font-size:15px;font-weight:700;border-color:var(--jade);color:var(--jade);">Пройти тест (18 вопросов)</button>
    </div>
  </div>
  <p id="welcomeLoadStatus" style="font-size:13px;color:var(--jade);font-weight:600;margin-top:8px;"></p>
</section>`;
    app.querySelectorAll('[data-pick-lvl]').forEach(btn => {
      btn.onclick = async () => {
        const picked = Number(btn.dataset.pickLvl);
        const st = app.querySelector('#welcomeLoadStatus');
        app.querySelectorAll('button').forEach(b => (b.disabled = true));
        await downloadLevelsUpTo(picked, st);
        safeStorage.setItem('hsk_start_lvl', String(picked));
        setSelectedLevel(String(picked));
        setSelectedLesson(0);
        safeStorage.setItem('hsk_lvl', String(picked));
        safeStorage.setItem('hsk_les', '0');
        syncUrlState();
        home();
      };
    });
    app.querySelector('#startPlacementBtn').onclick = () => {
      location.hash = '#/placement';
    };
    return true;
  }
  const curMood = getTodayMood();
  if (!curMood) {
    const curLvlNum = Number(getSelectedLevel()) || userStartLvl || 1;
    const knownSet = new Set(
      allWords.filter(w => srs[w.id] && srs[w.id].reps >= 1).map(w => w.hanzi)
    );
    const knowsAll = wordsList => wordsList.every(w => knownSet.has(w));

    const MOODS = Array.of(
      {
        id: 'high',
        img: './js/geese/goose_mood_high.jpg',
        ru: 'Готова изучать китайский язык!',
        zh: '我准备好学习汉语了！',
        py: 'Wǒ zhǔnbèi hǎo xuéxí Hànyǔ le!',
        hideHelper: curLvlNum >= 2 || knowsAll(Array.of('我', '准备', '好', '学习', '汉语', '了'))
      },
      {
        id: 'normal',
        img: './js/geese/goose_mood_normal.jpg',
        ru: 'Могу уделить немного времени',
        zh: '我能抽出一点儿时间',
        py: 'Wǒ néng chōuchū yīdiǎnr shíjiān',
        hideHelper: curLvlNum >= 4 || knowsAll(Array.of('我', '能', '抽出', '一点儿', '时间'))
      },
      {
        id: 'tired',
        img: './js/geese/goose_mood_tired.jpg',
        ru: 'Совсем без сил',
        zh: '我好累啊',
        py: 'Wǒ hǎo lèi a',
        hideHelper: curLvlNum >= 3 || knowsAll(Array.of('我', '好', '累', '啊'))
      }
    );

    const moodButtonsHtml = MOODS.map(m => {
      const textHtml = m.hideHelper
        ? `<div style="font-size:19px;font-weight:700;color:var(--fg);line-height:24px;">${m.zh}</div>`
        : `<div style="font-size:18px;font-weight:700;color:var(--fg);line-height:24px;">${m.zh}</div>
           <div style="font-size:13px;color:var(--jade);font-weight:600;margin-top:2px;">${m.py}</div>
           <div style="font-size:14px;color:var(--muted);margin-top:3px;">${m.ru}</div>`;
      return `<button class="ans" data-mood="${m.id}" data-mood-img="${m.img}" data-say-zh="${m.zh.trim()}" style="width:100%;text-align:center;padding:12px 14px;border-radius:14px;">${textHtml}</button>`;
    }).join('');

    app.innerHTML = `
      <section class="hero" style="max-width:420px;margin:0 auto;padding:10px 16px 12px;">
        <div id="moodGooseBox" style="width:200px;height:200px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">
          <img id="moodGooseImg" src="./js/geese/goose_mood.jpg" alt="Гусь настроения" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;user-select:none;">
        </div>
        <h2 style="margin:0 0 4px;font-size:24px;line-height:1.25;text-align:center;">Какой ты сегодня?</h2>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.4;color:var(--muted);text-align:center;">
          Выбирай настроение — так я смогу подобрать твой идеальный <b>план на сегодня</b> (А если оно изменилось? Ты всегда сможешь поменять его в Настройках)
        </p>
        <div class="box" style="margin:0;padding:12px;">
          <div style="display:flex;flex-direction:column;gap:9px;">
            ${moodButtonsHtml}
          </div>
        </div>
      </section>`;

    let moodLocked = false;
    app.querySelectorAll('[data-mood]').forEach(btn => {
      btn.onclick = async () => {
        if (moodLocked) return;
        moodLocked = true;
        setTodayMood(btn.dataset.mood);
        btn.classList.add('ok');
        btn.style.borderColor = 'var(--jade)';
        btn.style.background = '#EDF5F0';

        const gooseImgEl = app.querySelector('#moodGooseImg');
        if (gooseImgEl) gooseImgEl.src = btn.dataset.moodImg;

        const playRes = speak(btn.dataset.sayZh, { rate: 0.95 });
        if (playRes && typeof playRes.then === 'function') {
          await playRes;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
        setTimeout(() => home(), 900);
      };
    });
    return true;
  }

  return false;
}
