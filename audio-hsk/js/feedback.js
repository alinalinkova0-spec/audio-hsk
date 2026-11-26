import { safeStorage, getSavedEmail, getSavedName } from './storage.js?v=4';

const SB_URL = 'https://' + 'srtoxpakayozfeqxjqdd.supabase.co';
const SB_KEY = 'sb_publishable_EvXS1QB5OMOKnK8poiXCTQ_VXMcefQ2';
const PENDING_REPORTS_KEY = 'hsk_pending_reports_v1';
const WORD_FIXES_KEY = 'hsk_word_fixes_v1';

export function isAdmin007() {
  const code = String(getSavedEmail() || '').trim().toUpperCase();
  const name = String(getSavedName() || '').trim().toUpperCase();
  return code === 'GOOSE-007' || name === 'GOOSE-007';
}

function getUserMeta() {
  const name = getSavedName() || 'Без имени';
  const email = getSavedEmail() || 'гость';
  const lvl = safeStorage.getItem('hsk_lvl') || '?';
  const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '📱 Телефон' : '💻 Компьютер';
  return `${name} (${email}) · HSK ${lvl} · ${device}`;
}

function readPendingReports() {
  try {
    const arr = JSON.parse(safeStorage.getItem(PENDING_REPORTS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePendingReports(arr) {
  safeStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(arr));
}

async function uploadReportRecord(rec) {
  const res = await fetch(`${SB_URL}/rest/v1/cloud_state?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      email: rec.id,
      state: rec,
      updated_at: new Date().toISOString()
    })
  });
  return res.ok;
}

export async function flushPendingReports() {
  if (!navigator.onLine) return 0;
  const list = readPendingReports();
  if (!list.length) return 0;
  const rest = [];
  let sent = 0;
  for (const item of list) {
    try {
      const ok = await uploadReportRecord(item);
      if (ok) sent++;
      else rest.push(item);
    } catch {
      rest.push(item);
    }
  }
  writePendingReports(rest);
  return sent;
}

window.addEventListener('online', () => {
  flushPendingReports().catch(() => {});
});

export async function sendWordErrorReport({ word = null, reason = '', text = '' } = {}) {
  const id = `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const rec = {
    id,
    kind: word ? 'word_error' : 'feedback',
    createdAt: new Date().toISOString(),
    user: getUserMeta(),
    reason: String(reason || '').trim(),
    text: String(text || '').trim().slice(0, 600),
    word: word ? {
      id: word.id,
      level: word.level || 1,
      hanzi: word.hanzi || '',
      pinyin: word.pinyin || '',
      ru: word.ru || '',
      example: word.example || ''
    } : null
  };
  if (!navigator.onLine) {
    const q = readPendingReports();
    q.push(rec);
    writePendingReports(q);
    return { ok: true, message: 'Сохранено офлайн ✓ Отправится в профиль GOOSE-007, как только появится интернет.' };
  }

  try {
    const ok = await uploadReportRecord(rec);
    if (!ok) throw new Error('Ошибка сервера');
    return { ok: true, message: 'Отбивка отправлена в профиль GOOSE-007 ✓' };
  } catch {
    const q = readPendingReports();
    q.push(rec);
    writePendingReports(q);
    return { ok: true, message: 'Сохранено в очередь ✓ Отправится при восстановлении связи.' };
  }
}

export async function sendTelegramReport({ text = '', isAutoCrash = false } = {}) {
  return sendWordErrorReport({
    reason: isAutoCrash ? 'Авто-сбой' : 'Сообщение',
    text
  });
}

const sentAutoErrors = new Set();
export function reportAutoCrash(details) {
  const clean = String(details || 'Неизвестная ошибка').trim().slice(0, 400);
  if (sentAutoErrors.has(clean)) return;
  sentAutoErrors.add(clean);
  sendWordErrorReport({ reason: 'Авто-сбой', text: clean }).catch(() => {});
}

export function applyCachedWordFixes(wordsList) {
  if (!Array.isArray(wordsList)) return;
  try {
    const fixes = JSON.parse(safeStorage.getItem(WORD_FIXES_KEY) || '{}');
    if (!fixes || typeof fixes !== 'object') return;
    wordsList.forEach(w => {
      const f = fixes[w.id];
      if (f) {
        if (f.hanzi) w.hanzi = f.hanzi;
        if (f.pinyin !== undefined) w.pinyin = f.pinyin;
        if (f.ru) w.ru = f.ru;
        if (f.example !== undefined) w.example = f.example;
      }
    });
  } catch {}
}

export async function syncRemoteWordFixes(wordsList) {
  if (!navigator.onLine) {
    applyCachedWordFixes(wordsList);
    return;
  }
  try {
    const res = await fetch(`${SB_URL}/rest/v1/cloud_state?select=email,state&email=like.word_fix_%25&limit=500`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    if (!res.ok) return;
    const rows = await res.json();
    const fixes = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r && r.state && r.state.id) fixes[r.state.id] = r.state;
      });
    }
    safeStorage.setItem(WORD_FIXES_KEY, JSON.stringify(fixes));
    applyCachedWordFixes(wordsList);
  } catch {
    applyCachedWordFixes(wordsList);
  }
}

export function openWordReportModal(word) {
  const backdrop = document.createElement('div');
  backdrop.className = 'hsk-modal-backdrop';
  backdrop.innerHTML = `
    <div class="hsk-modal-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:16px;font-weight:700;color:var(--fg);">⚠️ Сообщить об ошибке в слове</div>
        <button type="button" data-close class="ghost" style="min-height:34px;padding:4px 10px;">✕</button>
      </div>
      <div style="padding:10px 12px;border-radius:12px;background:#F7F9F7;border:1px solid var(--border);margin-bottom:12px;">
        <div style="font-size:22px;font-weight:700;color:var(--fg);">${word.hanzi} <span style="font-size:14px;color:var(--jade);font-weight:500;">${word.pinyin || ''}</span></div>
        <div style="font-size:14px;color:var(--muted);margin-top:2px;">${word.ru}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <button type="button" class="ans" data-reason="Неверный перевод" style="padding:10px;font-size:13px;text-align:center;">Неверный перевод</button>
        <button type="button" class="ans" data-reason="Ошибка в пиньине / тоне" style="padding:10px;font-size:13px;text-align:center;">Ошибка в пиньине</button>
        <button type="button" class="ans" data-reason="Не та озвучка" style="padding:10px;font-size:13px;text-align:center;">Не та озвучка</button>
        <button type="button" class="ans" data-reason="Другая ошибка" style="padding:10px;font-size:13px;text-align:center;">Другое</button>
      </div>
      <textarea data-note rows="2" placeholder="Уточни, как должно быть (необязательно)..." style="width:100%;box-sizing:border-box;margin-bottom:10px;"></textarea>
      <button type="button" data-submit class="primary" style="width:100%;">Отправить отбивку</button>
      <div data-status style="font-size:13px;font-weight:600;margin-top:8px;text-align:center;"></div>
    </div>`;
  let selectedReason = 'Неверный перевод';
  const reasonBtns = backdrop.querySelectorAll('[data-reason]');
  reasonBtns.forEach((btn, idx) => {
    if (idx === 0) btn.style.borderColor = 'var(--accent)';
    btn.onclick = () => {
      selectedReason = btn.dataset.reason;
      reasonBtns.forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = '#FAFBF9'; });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = '#EDF5F0';
    };
  });

  backdrop.querySelector('[data-close]').onclick = () => backdrop.remove();
  backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };

  const submitBtn = backdrop.querySelector('[data-submit]');
  const statusEl = backdrop.querySelector('[data-status]');
  submitBtn.onclick = async () => {
    submitBtn.disabled = true;
    statusEl.style.color = 'var(--jade)';
    statusEl.textContent = 'Отправляем...';
    const note = backdrop.querySelector('[data-note]').value;
    const res = await sendWordErrorReport({ word, reason: selectedReason, text: note });
    statusEl.textContent = res.message;
    setTimeout(() => backdrop.remove(), 1100);
  };

  document.body.appendChild(backdrop);
}

export async function renderAdminReportsPanel(container, { getAllWords = () => [] } = {}) {
  if (!container || !isAdmin007()) return;
  container.innerHTML = `<div style="padding:14px;border-radius:16px;border:1.5px solid #F3D19E;background:#FFF8EB;text-align:left;">
    <div style="font-weight:700;color:#92400E;font-size:15px;">🔔 Загружаем отбивки об ошибках для GOOSE-007...</div>
  </div>`;

  try {
    const res = await fetch(`${SB_URL}/rest/v1/cloud_state?select=email,state,updated_at&email=like.report_%25&order=updated_at.desc&limit=100`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const rows = res.ok ? await res.json() : [];
    const reports = Array.isArray(rows) ? rows.map(r => ({ rowKey: r.email, ...(r.state || {}) })) : [];

    if (!reports.length) {
      container.innerHTML = `<div style="padding:14px;border-radius:16px;border:1px solid #B7DEC6;background:#EDF5F0;text-align:left;">
        <div style="font-weight:700;color:var(--jade);font-size:15px;">🔔 Профиль GOOSE-007: новых ошибок в словах нет ✓</div>
      </div>`;
      return;
    }

    container.innerHTML = `
      <div style="padding:16px;border-radius:18px;border:1.5px solid #F3D19E;background:#FFF8EB;text-align:left;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;color:#92400E;font-size:16px;">🔔 Ошибки в словах (${reports.length})</div>
          <span style="font-size:12px;color:#B45309;font-weight:600;">GOOSE-007</span>
        </div>
        <div data-list style="display:flex;flex-direction:column;gap:12px;"></div>
      </div>`;

    const listEl = container.querySelector('[data-list]');
    reports.forEach(rep => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid var(--border);border-radius:14px;padding:12px;';
      const w = rep.word;
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#FCEEEA;color:#C84B31;font-size:12px;font-weight:700;">${rep.reason || 'Ошибка'}</span>
            <div style="font-size:12px;color:var(--muted);margin-top:4px;">${rep.user || ''}</div>
          </div>
          <button type="button" data-dismiss class="ghost" style="min-height:34px;padding:4px 10px;font-size:12px;">✓ Закрыть</button>
        </div>
        ${rep.text ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#FAFBF9;font-size:13px;color:var(--fg);">💬 ${rep.text}</div>` : ''}
        ${w ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);display:grid;gap:6px;">
            <div style="font-size:12px;font-weight:700;color:var(--jade);">Быстрое исправление (HSK ${w.level || '?'}, ID: ${w.id}):</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <input type="text" data-f="hanzi" value="${(w.hanzi || '').replace(/"/g, '&quot;')}" placeholder="Иероглиф">
              <input type="text" data-f="pinyin" value="${(w.pinyin || '').replace(/"/g, '&quot;')}" placeholder="Пиньинь">
            </div>
            <input type="text" data-f="ru" value="${(w.ru || '').replace(/"/g, '&quot;')}" placeholder="Перевод">
            <button type="button" data-save-fix class="primary" style="min-height:40px;padding:9px 12px !important;font-size:14px !important;">💾 Сохранить исправление для всех</button>
            <div data-fix-st style="font-size:12px;font-weight:600;color:var(--jade);text-align:center;"></div>
          </div>
        ` : ''}`;

      const dismissReport = async () => {
        await fetch(`${SB_URL}/rest/v1/cloud_state?email=eq.${encodeURIComponent(rep.rowKey)}`, {
          method: 'DELETE',
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
        }).catch(() => {});
        card.remove();
      };

      card.querySelector('[data-dismiss]').onclick = dismissReport;

      const saveFixBtn = card.querySelector('[data-save-fix]');
      if (saveFixBtn && w) {
        saveFixBtn.onclick = async () => {
          saveFixBtn.disabled = true;
          const st = card.querySelector('[data-fix-st]');
          st.textContent = 'Сохраняем правку...';
          const updated = {
            id: w.id,
            hanzi: card.querySelector('[data-f="hanzi"]').value.trim(),
            pinyin: card.querySelector('[data-f="pinyin"]').value.trim(),
            ru: card.querySelector('[data-f="ru"]').value.trim()
          };
          await fetch(`${SB_URL}/rest/v1/cloud_state?on_conflict=email`, {
            method: 'POST',
            headers: {
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify({
              email: `word_fix_${w.id}`,
              state: updated,
              updated_at: new Date().toISOString()
            })
          });
          applyCachedWordFixes(getAllWords());
          await syncRemoteWordFixes(getAllWords());
          st.textContent = '✓ Исправлено у всех учеников!';
          setTimeout(() => dismissReport(), 900);
        };
      }

      listEl.appendChild(card);
    });
  } catch {
    container.innerHTML = '';
  }
}

export function renderFeedbackBox(container, { title = 'Написать разработчику (GOOSE-007)', placeholder = 'Опиши проблему, опечатку или идею...' } = {}) {
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:left;">
      <div style="font-size:13px;font-weight:700;color:var(--fg);margin-bottom:6px;">${title}</div>
      <textarea data-fb="text" rows="3" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;"></textarea>
      <button data-fb="send" type="button" class="primary" style="width:100%;margin-top:8px;">Отправить сообщение</button>
      <div data-fb="status" style="font-size:13px;font-weight:600;margin-top:8px;text-align:center;"></div>
    </div>`;

  const textEl = container.querySelector('[data-fb="text"]');
  const sendBtn = container.querySelector('[data-fb="send"]');
  const statusEl = container.querySelector('[data-fb="status"]');

  sendBtn.onclick = async () => {
    const msg = (textEl.value || '').trim();
    if (!msg) {
      statusEl.style.color = '#B42318';
      statusEl.textContent = 'Напиши текст сообщения';
      return;
    }
    sendBtn.disabled = true;
    statusEl.style.color = 'var(--jade)';
    statusEl.textContent = 'Отправляем...';
    const res = await sendWordErrorReport({ reason: 'Сообщение из настроек', text: msg });
    sendBtn.disabled = false;
    statusEl.style.color = 'var(--jade)';
    statusEl.textContent = res.message;
    if (res.ok) textEl.value = '';
  };
}
