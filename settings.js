import { safeStorage, getSavedEmail, getSavedName, setSavedName, loginByEmail, logoutEmail, pushCloudState, normalizeGooseCode, generateGooseCode } from '../storage.js?v=7';
import { playFeedback } from '../audio.js?v=13';
import { loadSRS } from '../srs.js?v=2';
import { renderFeedbackBox } from '../feedback.js?v=1';
export function renderSettings(app, ctx) {
  const {
    srs,
    getSelectedLevel,
    setSelectedLevel,
    setSelectedLesson,
    downloadLevelsUpTo,
    getTodayMoodKey,
    getInstallBoxHtml,
    bindInstallActions,
    getNotifyGooseIcon,
    home
  } = ctx;

  function draw() {
    safeStorage.setItem('hsk_settings_visited', '1');
        let activeCode = getSavedEmail();
    if (!activeCode) {
      activeCode = generateGooseCode();
      safeStorage.setItem('hsk_user_email', activeCode);
      pushCloudState(activeCode).catch(() => {});
    }
    const selectedLevel = getSelectedLevel();
    const remOn = safeStorage.getItem('hsk_rem_on') === '1';
    const remTime = safeStorage.getItem('hsk_rem_time') || '19:00';
    const remFreq = safeStorage.getItem('hsk_rem_freq') || 'daily';
    const sfxOn = safeStorage.getItem('hsk_sfx_off') !== '1';
    const sfxTheme = safeStorage.getItem('hsk_sfx_theme') || 'jade';
    const morningResetOn = safeStorage.getItem('hsk_morning_reset') !== '0';
    const examDateVal = safeStorage.getItem('hsk_exam_date') || '';
    const showProgressChecked = safeStorage.getItem('hsk_show_progress') !== '0' ? 'checked' : '';
    app.innerHTML = `<section class="hero" style="max-width:420px;margin:0 auto;padding:10px 16px 16px;">
      <h1 style="margin:0 0 4px;font-size:28px;">Настройки</h1>
      <p style="font-size:15px;line-height:1.4;color:var(--muted);margin:0 0 12px;">Настрой всё под себя: свой уровень, цель по экзамену, напоминания и оформление</p>
      <div class="box" style="padding:14px;margin-bottom:10px;text-align:left;">
        <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">🦆 Никнейм и Гусиный код</h3>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">
          Твой гусиный код закреплён за этим устройством — скопируй его и вставь на втором устройстве, чтобы объединить слова и уровень
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div>
            <label for="settingsNameInput" style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;">Никнейм (для тебя)</label>
            <input id="settingsNameInput" type="text" placeholder="Например: Мистер Гусь" value="${getSavedName()}" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--border);font-size:15px;background:#fff;color:var(--fg);">
          </div>
          <div>
            <label for="settingsEmailInput" style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;">🔒 Твой гусиный код (только копирование)</label>
            <div style="display:flex;gap:6px;">
              <input id="settingsEmailInput" type="text" readonly value="${activeCode}" style="flex:1;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1.5px solid var(--jade);font-size:15px;font-weight:800;letter-spacing:0.5px;background:#EDF5F0;color:var(--fg);text-transform:uppercase;cursor:default;">
              <button id="copyGooseCodeBtn" type="button" class="ghost" style="padding:0 12px;font-size:13px;font-weight:700;white-space:nowrap;">Скопировать</button>
            </div>
          </div>
          <button id="settingsEmailSaveBtn" class="cta" style="width:100%;padding:11px 14px;font-size:14px;border:none;cursor:pointer;margin-top:2px;">Сохранить никнейм</button>
        </div>
        <div id="settingsEmailStatus" style="font-size:13px;color:var(--jade);font-weight:600;margin-top:8px;text-align:center;">
          ${safeStorage.getItem('hsk_last_cloud_sync') ? `Синхронизировано в ${safeStorage.getItem('hsk_last_cloud_sync')} ✓` : ''}
        </div>
      </div>
      <div class="box" style="padding:14px;">
        <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Твой уровень и темп</h3>
        <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Переключи уровень HSK 3.0 вручную, пройди короткий тест или смени настроение на сегодня</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          <button data-set-lvl="1" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '1' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 1</button>
          <button data-set-lvl="2" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '2' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 2</button>
          <button data-set-lvl="3" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '3' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 3</button>
          <button data-set-lvl="4" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '4' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 4</button>
          <button data-set-lvl="5" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '5' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 5</button>
          <button data-set-lvl="6" class="ghost" style="font-size:14px;padding:8px 4px;${selectedLevel === '6' ? 'background:#EDF5F0;border-color:var(--jade);font-weight:700;' : ''}">HSK 6</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <a href="#/placement" class="ghost" style="flex:1;text-align:center;font-size:13px;padding:9px 8px;text-decoration:none;font-weight:600;"> 🎯 Пройти тест</a>
          <button id="resetMoodBtn" class="ghost" style="flex:1;font-size:13px;padding:9px 8px;font-weight:600;">🎭 Сменить настроение</button>
        </div>
        <div id="lvlSwitchStatus" style="display:none;margin-top:8px;font-size:13px;color:var(--jade);text-align:center;font-weight:600;"></div>
      </div>

      <div class="box" style="margin-top:14px;padding:14px;">
        <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Подготовка к экзамену HSK</h3>
        <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Укажи дату экзамена или запусти спринт — я сам рассчитаю норму слов на каждый день</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input type="date" id="examDateInput" value="${examDateVal}" style="width:100%;padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);font-size:13px;background:#fff;color:var(--fg);">
          <button id="sprint30Btn" class="ghost" style="width:100%;font-size:13px;padding:8px 10px;border-color:#F3D19E;background:#FFFBF0;font-weight:700;">🔥 Спринт 30 дн.</button>
        </div>
        <p id="examStatus" style="margin:8px 0 0;font-size:13px;color:var(--jade);text-align:center;font-weight:600;"></p>
      </div>

      <div class="box" style="margin-top:14px;padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
          <h3 style="margin:0;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;text-align:left;">Напоминания</h3>
          <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer;flex-shrink:0;">
            <input type="checkbox" id="remToggle" ${remOn ? 'checked' : ''} style="position:absolute;opacity:0;width:0;height:0;">
            <span style="width:46px;height:26px;border-radius:999px;background:${remOn ? 'var(--jade)' : '#D5D0C3'};transition:background .2s;display:inline-flex;align-items:center;padding:3px;box-sizing:border-box;">
              <span style="width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:transform .2s;transform:${remOn ? 'translateX(20px)' : 'translateX(0)'};"></span>
            </span>
          </label>
        </div>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;text-align:left;line-height:1.45;">Выбери удобное время и частоту — я мягко позову позаниматься</p>
        <div style="display:grid;grid-template-columns:112px 1fr;gap:8px;margin-bottom:8px;">
          <input type="time" id="remTime" value="${remTime}" style="width:100%;height:40px;padding:0 10px;border-radius:10px;border:1.5px solid var(--jade);font-size:14px;font-weight:600;background:#fff;color:var(--fg);">
          <select id="remFreqSelect" style="width:100%;height:40px;padding:0 10px;border-radius:10px;border:1.5px solid var(--border);font-size:13px;font-weight:600;background:#EDF5F0;color:var(--fg);">
            <option value="daily" ${remFreq === 'daily' ? 'selected' : ''}>Каждый день</option>
            <option value="weekdays" ${remFreq === 'weekdays' ? 'selected' : ''}>По будням</option>
            <option value="every2" ${remFreq === 'every2' ? 'selected' : ''}>Раз в 2 дня</option>
          </select>
        </div>
        <button id="testNotify" class="ghost" style="width:100%;height:38px;font-size:13px;font-weight:600;">Проверить уведомление</button>
        <p id="remStatus" style="margin:8px 0 0;font-size:13px;color:var(--jade);text-align:left;"></p>
      </div>
      <div class="box" style="margin-top:14px;padding:16px;">
        <h3 style="margin:0 0 10px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Оформление и звуки</h3>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;cursor:pointer;margin-bottom:10px;">
          <span>Показывать «Мой прогресс» в заданиях</span>
          <input type="checkbox" id="showProgressToggle" ${showProgressChecked} style="width:20px;height:20px;accent-color:var(--jade);flex-shrink:0;">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;cursor:pointer;margin-bottom:10px;">
          <span>Сбрасывать настроение каждое утро</span>
          <input type="checkbox" id="morningResetToggle" ${morningResetOn ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--jade);flex-shrink:0;">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;cursor:pointer;margin-bottom:10px;">
          <span>Звуковые эффекты при ответах</span>
          <input type="checkbox" id="sfxToggle" ${sfxOn ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--jade);flex-shrink:0;">
        </label>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="position:relative;flex:1;">
            <select id="sfxThemeSelect" style="width:100%;appearance:none;-webkit-appearance:none;background:#EDF5F0;border:1.5px solid var(--border);border-radius:10px;padding:8px 28px 8px 10px;font-size:13px;font-weight:600;color:var(--fg);">
              <option value="jade" ${sfxTheme === 'jade' ? 'selected' : ''}>Нефритовая капля</option>
              <option value="guzheng" ${sfxTheme === 'guzheng' ? 'selected' : ''}>Шорох бамбука</option>
              <option value="bell" ${sfxTheme === 'bell' ? 'selected' : ''}>Горное эхо</option>
            </select>
            <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:10px;color:var(--jade);">▼</span>
          </div>
          <button id="testSfxOk" class="ghost" style="font-size:13px;padding:8px 10px;white-space:nowrap;">Верно</button>
          <button id="testSfxBad" class="ghost" style="font-size:13px;padding:8px 10px;white-space:nowrap;">Ошибка</button>
        </div>
      </div>

      ${getInstallBoxHtml() ? `<div class="box" style="margin-top:14px;padding:14px;">
        <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Установить как приложение</h3>
        <p style="margin:0 0 8px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Открой тренажёр в один тап с экрана телефона — как настоящее приложение</p>
        ${getInstallBoxHtml()}
      </div>` : ''}

      <button id="saveAllSettingsBtn" class="cta" style="width:100%;border:none;cursor:pointer;margin-top:14px;padding:12px 16px;font-size:15px;">Сохранить изменения</button>
      <div id="settingsSavedNote" style="margin-top:8px;font-size:13px;font-weight:600;color:var(--jade);text-align:center;"></div>

            <div class="box" style="margin-top:14px;padding:14px;">
        <h3 style="margin:0 0 6px;font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;">Поддержка</h3>
        <p style="margin:0 0 10px;color:var(--muted);font-size:13px;text-align:center;line-height:1.45;">Нашёл опечатку, баг со звуком или придумал крутую фишку? Опиши здесь и приложи скриншот — сообщение сразу прилетит разработчику</p>
        <div id="settingsFeedbackSlot"></div>
      </div>
    </section>`;
    renderFeedbackBox(app.querySelector('#settingsFeedbackSlot'));
        app.querySelector('#saveAllSettingsBtn').onclick = async () => {
      const nameInp = app.querySelector('#settingsNameInput');
      if (nameInp && nameInp.value.trim()) setSavedName(nameInp.value.trim());
      const mailInp = app.querySelector('#settingsEmailInput');
      if (mailInp && mailInp.value.trim()) safeStorage.setItem('hsk_user_email', normalizeGooseCode(mailInp.value.trim()));
      const progBox = app.querySelector('#showProgressToggle');
      if (progBox) safeStorage.setItem('hsk_show_progress', progBox.checked ? '1' : '0');
      const morningBox = app.querySelector('#morningResetToggle');
      if (morningBox) safeStorage.setItem('hsk_morning_reset', morningBox.checked ? '1' : '0');
      const freqSel = app.querySelector('#remFreqSelect');
      if (freqSel) safeStorage.setItem('hsk_rem_freq', freqSel.value);
      const examInp = app.querySelector('#examDateInput');
      if (examInp) {
        if (examInp.value) safeStorage.setItem('hsk_exam_date', examInp.value);
        else safeStorage.removeItem('hsk_exam_date');
      }
      const note = app.querySelector('#settingsSavedNote');
      if (note) note.textContent = 'Сохраняем в облако...';
      if (getSavedEmail()) {
        await pushCloudState().catch(() => {});
      }
      if (note) note.textContent = 'Настройки сохранены ✓';
      setTimeout(() => {
        if (location.hash === '#/' || !location.hash) home();
        else location.hash = '#/';
      }, 650);
    };

    const lvlStEl = app.querySelector('#lvlSwitchStatus');
    lvlStEl.style.display = 'none';
    const remStatus = app.querySelector('#remStatus');
    remStatus.style.display = 'none';

    app.querySelectorAll('[data-set-lvl]').forEach(btn => {
      btn.onclick = async () => {
        const target = Number(btn.dataset.setLvl);
        lvlStEl.style.display = 'block';
        await downloadLevelsUpTo(target, lvlStEl);
        safeStorage.setItem('hsk_start_lvl', String(target));
        setSelectedLevel(String(target));
        setSelectedLesson(0);
        safeStorage.setItem('hsk_lvl', String(target));
        safeStorage.setItem('hsk_les', '0');
        location.hash = '#/';
      };
    });

    app.querySelector('#resetMoodBtn').onclick = () => {
      safeStorage.removeItem(getTodayMoodKey());
      location.hash = '#/';
    };

    app.querySelector('#sfxToggle').onchange = e => {
      safeStorage.setItem('hsk_sfx_off', e.target.checked ? '0' : '1');
      if (e.target.checked) playFeedback(true);
    };
    app.querySelector('#sfxThemeSelect').onchange = e => {
      safeStorage.setItem('hsk_sfx_theme', e.target.value);
      safeStorage.setItem('hsk_sfx_off', '0');
      app.querySelector('#sfxToggle').checked = true;
      playFeedback(true);
    };
    app.querySelector('#testSfxOk').onclick = () => playFeedback(true);
    app.querySelector('#testSfxBad').onclick = () => playFeedback(false);
    app.querySelector('#morningResetToggle').onchange = e => {
      safeStorage.setItem('hsk_morning_reset', e.target.checked ? '1' : '0');
    };

    const examStatusEl = app.querySelector('#examStatus');
    if (!examDateVal) examStatusEl.style.display = 'none';
    else examStatusEl.textContent = 'Дата экзамена сохранена: ' + examDateVal;

    app.querySelector('#examDateInput').onchange = e => {
      const val = e.target.value;
      examStatusEl.style.display = 'block';
      if (val) {
        safeStorage.setItem('hsk_exam_date', val);
        examStatusEl.textContent = 'Цель установлена на ' + val + ' — план пересчитан!';
      } else {
        safeStorage.removeItem('hsk_exam_date');
        examStatusEl.textContent = 'Дата сброшена — включён обычный ритм.';
      }
    };

    app.querySelector('#sprint30Btn').onclick = () => {
      const d30 = new Date(Date.now() + 30 * 86400000);
      const iso = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
      safeStorage.setItem('hsk_exam_date', iso);
      app.querySelector('#examDateInput').value = iso;
      examStatusEl.style.display = 'block';
      examStatusEl.textContent = '🔥 Спринт 30 дней запущен (экзамен ' + iso + ')!';
    };

      const copyCodeBtn = app.querySelector('#copyGooseCodeBtn');
    if (copyCodeBtn) {
      copyCodeBtn.onclick = async () => {
        const curCode = (app.querySelector('#settingsEmailInput')?.value || '').trim().toUpperCase();
        const st = app.querySelector('#settingsEmailStatus');
        try {
          await navigator.clipboard.writeText(curCode);
          if (st) st.textContent = `Код ${curCode} скопирован ✓`;
        } catch {
          if (st) st.textContent = `Выдели и скопируй код: ${curCode}`;
        }
      };
    }

    const sEmailSave = app.querySelector('#settingsEmailSaveBtn');
    if (sEmailSave) {
      sEmailSave.onclick = async () => {
        const nameVal = (app.querySelector('#settingsNameInput')?.value || '').trim();
        if (nameVal) setSavedName(nameVal);
        const rawCode = (app.querySelector('#settingsEmailInput')?.value || '').trim();
        const normCode = normalizeGooseCode(rawCode);
        const st = app.querySelector('#settingsEmailStatus');
        sEmailSave.disabled = true;
        if (st) st.textContent = 'Объединяем прогресс с облаком...';
        const res = await loginByEmail(normCode);
        sEmailSave.disabled = false;
        if (st) st.textContent = res.message;
        if (res.ok) {
          const freshSrs = loadSRS();
          Object.keys(srs).forEach(k => { delete srs[k]; });
          Object.assign(srs, freshSrs);
          const nextLvl = safeStorage.getItem('hsk_lvl') || safeStorage.getItem('hsk_start_lvl') || '1';
          setSelectedLevel(nextLvl);
          setSelectedLesson(+(safeStorage.getItem('hsk_les') || 0));
           await downloadLevelsUpTo(Number(nextLvl) || 1, st).catch(() => {});
          draw();
        }
      };
    }

    app.querySelector('#remToggle').onchange = async e => {
      const syncSwitch = on => {
        const track = e.target.nextElementSibling;
        if (track) {
          track.style.background = on ? 'var(--jade)' : '#D5D0C3';
          if (track.firstElementChild) track.firstElementChild.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
        }
      };
      syncSwitch(e.target.checked);
      remStatus.style.display = 'block';
      if (e.target.checked) {
        if (!('Notification' in window)) {
          remStatus.textContent = 'Браузер не поддерживает уведомления (добавь сайт на экран «Домой»).';
          e.target.checked = false;
          syncSwitch(false);
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          remStatus.textContent = 'Разрешение на уведомления не выдано в настройках браузера.';
          e.target.checked = false;
          syncSwitch(false);
          return;
        }
        safeStorage.setItem('hsk_rem_on', '1');
        remStatus.textContent = 'Напоминание включено на ' + app.querySelector('#remTime').value;
      } else {
        safeStorage.setItem('hsk_rem_on', '0');
        remStatus.textContent = 'Напоминания отключены.';
      }
    };

    bindInstallActions(app);
    app.querySelector('#remTime').onchange = e => {
      safeStorage.setItem('hsk_rem_time', e.target.value);
      if (safeStorage.getItem('hsk_rem_on') === '1') {
        remStatus.style.display = 'block';
        remStatus.textContent = 'Время напоминания обновлено: ' + e.target.value;
      }
    };

    app.querySelector('#testNotify').onclick = async () => {
      remStatus.style.display = 'block';
      if (!('Notification' in window)) {
        remStatus.textContent = 'Уведомления недоступны в этом режиме.';
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('HSK 3.0 听力训练 🦆', {
          body: 'Пора размять слух! Загляни выполнить план на сегодня.',
          icon: getNotifyGooseIcon()
        });
        remStatus.textContent = 'Тестовое уведомление отправлено!';
      } else {
        remStatus.textContent = 'Разреши уведомления в настройках браузера.';
      }
    };
  }

  draw();
}
