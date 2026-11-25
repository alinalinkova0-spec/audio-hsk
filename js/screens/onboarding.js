import { safeStorage, getSavedEmail, setSavedName, loginByEmail, pushCloudState } from '../storage.js?v=5';
import { speak } from '../audio.js?v=13';
import { loadSRS } from '../srs.js?v=2';

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

  const emailDone = !!getSavedEmail() || safeStorage.getItem('hsk_skip_email') === '1';

  if (!emailDone) {
    app.innerHTML = `
<section class="hero" style="max-width:420px;margin:0 auto;padding:12px 16px;">
  <div style="width:200px;height:200px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">
    <img src="./js/geese/goose_welcome.jpg" alt="Гусь" onerror="this.style.display='none'" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;">
  </div>
  <h1 style="margin:0 0 6px;font-size:26px;">Привет!</h1>
  <p style="font-size:15px;line-height:1.45;color:var(--fg);margin:0 0 14px;">
    Укажи своё имя и почту, чтобы весь твой прогресс, слова и уровень сохранялись и не пропадали
  </p>
  <div class="box" style="text-align:left;padding:14px;">
    <label for="step1NameInput" style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--fg);">Как тебя зовут?</label>
    <input id="step1NameInput" type="text" placeholder="Например: Алина" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border);font-size:15px;background:#fff;color:var(--fg);margin-bottom:10px;">
    <label for="step1EmailInput" style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--fg);">Твоя почта (email):</label>
    <input id="step1EmailInput" type="email" placeholder="example@mail.ru" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border);font-size:15px;background:#fff;color:var(--fg);margin-bottom:10px;">
    <button id="step1EmailBtn" class="cta" style="width:100%;padding:12px;font-size:15px;border:none;cursor:pointer;">Продолжить →</button>
    <div id="step1EmailStatus" style="font-size:13px;color:var(--jade);font-weight:600;margin-top:8px;text-align:center;"></div>
  </div>
  <button id="step1SkipBtn" class="ghost" style="margin-top:12px;width:100%;padding:9px;font-size:13px;color:var(--muted);">Продолжить без почты</button>
</section>`;
    const nameInput = app.querySelector('#step1NameInput');
    const emailInput = app.querySelector('#step1EmailInput');
    const emailBtn = app.querySelector('#step1EmailBtn');
    const skipBtn = app.querySelector('#step1SkipBtn');
    const statusEl = app.querySelector('#step1EmailStatus');

    const handleSubmitEmail = async () => {
      const nameVal = (nameInput?.value || '').trim();
      const val = (emailInput.value || '').trim().toLowerCase();
      emailInput.value = val;
      if (!val || !val.includes('@') || !val.includes('.')) {
        statusEl.style.color = '#B42318';
        statusEl.textContent = 'Введи корректный адрес почты (например, name@mail.ru)';
        emailInput.focus();
        return;
      }
      if (nameVal) setSavedName(nameVal);
      safeStorage.setItem('hsk_user_email', val);
      emailBtn.disabled = true;
      statusEl.style.color = 'var(--jade)';
      statusEl.textContent = 'Проверяем аккаунт в облаке...';
      try {
        const res = await loginByEmail(val);
        if (nameVal && (!res || !res.restored)) {
          setSavedName(nameVal);
          pushCloudState(val).catch(() => {});
        }
        if (res && res.ok && res.restored) {
          statusEl.textContent = 'Аккаунт найден! Восстанавливаем уровень и слова...';
          const freshSrs = loadSRS();
          Object.keys(srs).forEach(k => { delete srs[k]; });
          Object.assign(srs, freshSrs);
          const nextLvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl') || '1';
          setSelectedLevel(nextLvl);
          setSelectedLesson(+(safeStorage.getItem('hsk_les') || 0));
          await downloadLevelsUpTo(Number(nextLvl) || 1, statusEl).catch(() => {});
        }
      } catch (e) {}
      emailBtn.disabled = false;
      syncUrlState();
      home();
    };

    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        emailInput.focus();
      }
    });
    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitEmail();
      }
    });
    emailBtn.onclick = handleSubmitEmail;
    skipBtn.onclick = () => {
      safeStorage.setItem('hsk_skip_email', '1');
      home();
    };
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
<section class="hero" style="max-width:420px;margin:0 auto;padding:8px 16px;">
  <div style="width:200px;height:200px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">
    <img src="./js/geese/goose_test.jpg" alt="Гусь" onerror="this.style.display='none'" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;pointer-events:none;">
  </div>
  <h1 style="margin:0 0 4px;font-size:24px;">Выбери свой уровень</h1>
  <p style="font-size:14px;line-height:1.4;color:var(--muted);margin:0 0 10px;">
    Это тренажёр аудирования по новому <b>HSK 3.0 (1–6 уровни)</b>
  </p>
  <div class="box" style="text-align:left;margin:8px 0 4px;padding:12px;">
    <div style="font-weight:700;font-size:15px;margin-bottom:10px;text-align:center;">С какого уровня начнём?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
      <button class="ans" data-pick-lvl="1" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌱 HSK 1</button>
      <button class="ans" data-pick-lvl="2" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌿 HSK 2</button>
      <button class="ans" data-pick-lvl="3" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🌳 HSK 3</button>
      <button class="ans" data-pick-lvl="4" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🎋 HSK 4</button>
      <button class="ans" data-pick-lvl="5" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">⛰️ HSK 5</button>
      <button class="ans" data-pick-lvl="6" style="padding:13px 8px;font-size:17px;font-weight:700;text-align:center;">🐉 HSK 6</button>
    </div>
    <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">Не знаешь свой уровень?</div>
      <button id="startPlacementBtn" class="ghost" style="width:100%;padding:10px;font-size:14px;font-weight:700;border-color:var(--jade);color:var(--jade);">Пройти тест (18 вопросов)</button>
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
