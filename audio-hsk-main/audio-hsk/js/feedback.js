import { safeStorage, getSavedEmail, getSavedName } from './storage.js?v=4';

const TG_BOT_TOKEN = '9256581133:AAHZofz__-M1jf3QquNCZT8jCL31qtG7uU4';
const TG_CHAT_ID = '1623871822';

function isConfigured() {
  return TG_BOT_TOKEN && !TG_BOT_TOKEN.includes('ВСТАВЬ') && TG_CHAT_ID && !TG_CHAT_ID.includes('ВСТАВЬ');
}

function getUserMeta() {
  const name = getSavedName() || 'Без имени';
  const email = getSavedEmail() || 'без почты';
  const lvl = safeStorage.getItem('hsk_lvl') || '?';
  const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '📱 Телефон' : '💻 Компьютер';
  const hash = location.hash || '#/';
  return `${name} (${email}) · HSK ${lvl} · ${device} · ${hash}`;
}

export async function sendTelegramReport({ text = '', file = null, isAutoCrash = false } = {}) {
  if (!isConfigured()) {
    return { ok: false, message: 'Бот Telegram ещё не настроен (укажи токен и chat_id в js/feedback.js).' };
  }
  const header = isAutoCrash ? '🚨 <b>Авто-отбивка: сайт HSK сломался!</b>' : '📩 <b>Сообщение от пользователя HSK</b>';
  const fullCaption = `${header}\n👤 ${getUserMeta()}\n\n${String(text || '').trim()}`.slice(0, 1000);

  try {
    if (file) {
      const fd = new FormData();
      fd.append('chat_id', TG_CHAT_ID);
      fd.append('photo', file);
      fd.append('caption', fullCaption);
      const res = await fetch('https://api.' + 'telegram.org/bot' + TG_BOT_TOKEN + '/sendPhoto', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || 'Ошибка отправки фото');
    } else {
      const res = await fetch('https://api.' + 'telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text: fullCaption,
          parse_mode: 'HTML'
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || 'Ошибка отправки');
    }
    return { ok: true, message: 'Отправлено разработчику в Telegram ✓' };
  } catch (err) {
    return { ok: false, message: 'Не удалось отправить: ' + (err?.message || 'проверь сеть') };
  }
}
const sentAutoErrors = new Set();
export function reportAutoCrash(details) {
  const clean = String(details || 'Неизвестная ошибка').trim().slice(0, 500);
  if (sentAutoErrors.has(clean)) return;
  sentAutoErrors.add(clean);
  sendTelegramReport({ text: `<code>${clean.replace(/</g, '&lt;')}</code>`, isAutoCrash: true }).catch(() => {});
}

export function renderFeedbackBox(container, { title = 'Написать разработчику', placeholder = 'Опиши проблему, опечатку или идею...' } = {}) {
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:left;">
      <div style="font-size:13px;font-weight:700;color:var(--fg);margin-bottom:6px;">${title}</div>
      <textarea data-fb="text" rows="3" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--border);font-size:14px;font-family:inherit;background:#fff;color:var(--fg);resize:vertical;"></textarea>
      <label style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:9px 10px;border-radius:10px;border:1.5px dashed var(--border);background:#FAFBF9;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;">
        <span>📎 Прикрепить скриншот (по желанию)</span>
        <input data-fb="file" type="file" accept="image/*" style="display:none;">
      </label>
      <div data-fb="fileName" style="font-size:12px;color:var(--jade);font-weight:600;margin-top:4px;text-align:center;"></div>
      <button data-fb="send" type="button" class="cta" style="width:100%;margin-top:8px;padding:11px 14px;font-size:14px;border:none;cursor:pointer;">Отправить сообщение</button>
      <div data-fb="status" style="font-size:13px;font-weight:600;margin-top:8px;text-align:center;"></div>
    </div>`;

  const textEl = container.querySelector('[data-fb="text"]');
  const fileEl = container.querySelector('[data-fb="file"]');
  const fileNameEl = container.querySelector('[data-fb="fileName"]');
  const sendBtn = container.querySelector('[data-fb="send"]');
  const statusEl = container.querySelector('[data-fb="status"]');

  fileEl.onchange = () => {
 const f = fileEl.files && fileEl.files.item(0);
    fileNameEl.textContent = f ? `Выбрано: ${f.name}` : '';
  };

  sendBtn.onclick = async () => {
    const msg = (textEl.value || '').trim();
    const file = (fileEl.files && fileEl.files.item(0)) || null;
    if (!msg && !file) {
      statusEl.style.color = '#B42318';
      statusEl.textContent = 'Напиши текст или прикрепи картинку';
      return;
    }
    sendBtn.disabled = true;
    statusEl.style.color = 'var(--jade)';
    statusEl.textContent = 'Отправляем...';
    const res = await sendTelegramReport({ text: msg || '(Без текста, только скриншот)', file });
    sendBtn.disabled = false;
    statusEl.style.color = res.ok ? 'var(--jade)' : '#B42318';
    statusEl.textContent = res.message;
    if (res.ok) {
      textEl.value = '';
      fileEl.value = '';
      fileNameEl.textContent = '';
    }
  };
}
