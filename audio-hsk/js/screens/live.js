import { safeStorage } from '../storage.js?v=7';
import { speak, stopAudio } from '../audio.js?v=13';

function analyzeChineseText(rawText, allWords) {
  const clean = rawText.replace(/[^\u4e00-\u9fff]/g, '');
  const totalChars = clean.length;
  if (!totalChars) return { ratio: 0, level: 1, matched: [] };

  const sortedVocab = allWords.slice().sort((a, b) => b.hanzi.length - a.hanzi.length);
  const matchedMap = new Map();
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let coveredChars = 0;

  let i = 0;
  while (i < clean.length) {
    let found = null;
    for (const w of sortedVocab) {
      if (w.hanzi.length > 1 && clean.startsWith(w.hanzi, i)) {
        found = w;
        break;
      }
    }
    if (!found) {
      const ch = clean[i];
      found = sortedVocab.find(w => w.hanzi === ch) || null;
    }
    if (found) {
      coveredChars += found.hanzi.length;
      matchedMap.set(found.hanzi, found);
      const lvl = Number(found.level) || 1;
      if (levelCounts[lvl] !== undefined) levelCounts[lvl] += found.hanzi.length;
      i += found.hanzi.length;
    } else {
      i += 1;
    }
  }
  const ratio = Math.round((coveredChars / totalChars) * 100);
  let bestLvl = 1;
  let maxScore = -1;
  for (const lvl of Array.of(1, 2, 3, 4, 5, 6)) {
    if (levelCounts[lvl] > maxScore) {
      maxScore = levelCounts[lvl];
      bestLvl = lvl;
    }
  }
  return { ratio, level: bestLvl, matched: Array.from(matchedMap.values()) };
}

export async function renderLiveChinese(app, ctx) {
  const { getAllWords, SB_URL, SB_KEY } = ctx;
  const allWords = getAllWords();
  stopAudio();

  app.innerHTML = `
    <section class="hero" style="max-width:420px;margin:0 auto;padding:8px 16px 16px;">
      <h1 style="margin:0 0 4px;font-size:28px;">Живой китайский</h1>
      <p style="font-size:15px;line-height:1.4;color:var(--muted);margin:0 0 12px;">
        Тренируй слух <b>на том, что тебе по-настоящему интересно</b> — так китайский запоминается в разы быстрее!
      </p>
      <div class="box" style="text-align:left;margin:0 0 12px;padding:14px;">
        <div style="font-weight:700;font-size:16px;margin-bottom:6px;text-align:center;color:var(--fg);">Разберём твою песню или текст?</div>
        <p style="margin:0 0 10px;font-size:13px;color:var(--muted);text-align:center;line-height:1.4;">Вставь сюда отрывок на китайском — <b>я сам озвучу каждую фразу и соберу тренировку</b>.</p>
        <input id="liveTitleInput" type="text" placeholder="Название и исполнитель (например: 周杰伦 - 晴天)" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:#FFFDF9;color:var(--fg);">
        <textarea id="liveBodyInput" rows="4" placeholder="Вставь сюда китайский текст (минимум 15 символов)..." style="width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:#FFFDF9;color:var(--fg);margin-top:8px;resize:vertical;"></textarea>
        <button id="analyzeLiveBtn" class="cta" style="width:100%;border:none;cursor:pointer;margin-top:10px;padding:13px;font-size:16px;">✨ Собрать тренировку</button>
        <div id="liveResultArea" style="margin-top:12px;"></div>
      </div>

      <div class="box" style="text-align:left;margin:12px 0 8px;padding:14px;">
        <div style="font-weight:700;font-size:16px;margin-bottom:10px;text-align:center;color:var(--fg);">Сборник сообщества</div>
        <div id="communityList" style="display:flex;flex-direction:column;gap:10px;">
          <p style="margin:0;font-size:13px;color:var(--muted);text-align:center;">Загружаем тексты сообщества...</p>
        </div>
      </div>
    </section>
  `;
  const renderLessonFromText = (title, body, stats) => {
    const lines = body.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const resEl = app.querySelector('#liveResultArea');
    const badgeColor = stats.ratio >= 70 ? '#EDF5F0' : '#FFF4E6';
    const badgeBorder = stats.ratio >= 70 ? 'var(--jade)' : '#F3D19E';
    const badgeText = stats.ratio >= 70
      ? `✅ Индекс HSK: ${stats.ratio}% (уровень ~HSK ${stats.level}) — добавлено в сборник сообщества!`
      : `ℹ️ Индекс HSK: ${stats.ratio}% (для общей базы нужно ≥ 70%, но тренироваться можно прямо сейчас!)`;

    resEl.innerHTML = `
      <div style="padding:10px 12px;border-radius:10px;background:${badgeColor};border:1px solid ${badgeBorder};font-size:13px;line-height:1.4;margin-bottom:10px;">
        <b>${title || 'Мой разбор'}</b> · <span style="color:var(--jade);font-weight:600;">🔊 Озвучка диктором</span><br>${badgeText}
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:var(--fg);">🎧 Построчное аудирование (нажми, чтобы прослушать):</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
        ${lines.map(ln => `
          <button class="ghost live-line-btn" data-line="${encodeURIComponent(ln)}" style="text-align:left;padding:9px 11px;font-size:16px;line-height:1.45;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span>${ln}</span>
            <span style="font-size:14px;color:var(--jade);flex-shrink:0;">🔊</span>
          </button>
        `).join('')}
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:var(--fg);">📚 Слова HSK из этого текста (${stats.matched.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${stats.matched.slice(0, 40).map(w => `
          <button class="ghost live-word-btn" data-word="${encodeURIComponent(w.hanzi)}" style="padding:6px 9px;font-size:13px;text-align:left;">
            <b>${w.hanzi}</b> <span style="color:var(--muted);">${w.pinyin}</span> — ${w.ru}
          </button>
        `).join('')}
      </div>
    `;
    resEl.querySelectorAll('.live-line-btn').forEach(btn => {
      btn.onclick = () => speak(decodeURIComponent(btn.dataset.line));
    });
    resEl.querySelectorAll('.live-word-btn').forEach(btn => {
      btn.onclick = () => speak(decodeURIComponent(btn.dataset.word));
    });
  };

  app.querySelector('#analyzeLiveBtn').onclick = async () => {
    const title = (app.querySelector('#liveTitleInput').value || '').trim() || 'Песня / текст ученика';
    const body = (app.querySelector('#liveBodyInput').value || '').trim();
    const resEl = app.querySelector('#liveResultArea');
    if (body.length < 15) {
      resEl.innerHTML = `<p style="color:#B42318;font-size:13px;margin:0;">Вставь текст длиной хотя бы 15 символов.</p>`;
      return;
    }
    const stats = analyzeChineseText(body, allWords);
    renderLessonFromText(title, body, stats);
    if (stats.ratio >= 70 && body.length <= 1500) {
      try {
        await fetch(`${SB_URL}/rest/v1/community_texts`, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ title, body: body.slice(0, 1500), level: stats.level, hsk_ratio: stats.ratio })
        });
        loadCommunityList();
      } catch (e) {}
    }
  };

  async function loadCommunityList() {
    const listEl = app.querySelector('#communityList');
    try {
      const r = await fetch(`${SB_URL}/rest/v1/community_texts?select=id,title,body,level,hsk_ratio&title=not.like.__HSK_PROFILE__*&order=created_at.desc&limit=30`, {
        headers: { 'apikey': SB_KEY }
      });
      const items = await r.json();
      if (!Array.isArray(items) || !items.length) {
        listEl.innerHTML = `<p style="margin:0;font-size:13px;color:var(--muted);">Пока здесь пусто — стань первым, кто добавит классную песню или текст!</p>`;
        return;
      }
      const hidden = JSON.parse(safeStorage.getItem('hsk_reported_texts') || '[]');
      const visible = items.filter(it => !hidden.includes(it.id) && !String(it.title || '').startsWith('__HSK_PROFILE__:'));
      if (!visible.length) {
        listEl.innerHTML = `<p style="margin:0;font-size:13px;color:var(--muted);">Новых текстов пока нет.</p>`;
        return;
      }
      listEl.innerHTML = visible.map(it => `
        <div style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:#FAFAFA;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
            <b style="font-size:14px;color:var(--fg);">${it.title}</b>
            <div style="display:flex;gap:4px;align-items:center;">
              <span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:8px;background:#F2F4F7;color:var(--muted);">🔊 Диктор</span>
              <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:8px;background:#EDF5F0;color:var(--jade);">HSK ${it.level} · ${it.hsk_ratio}%</span>
            </div>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:var(--muted);line-height:1.4;max-height:40px;overflow:hidden;">${it.body}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <button class="ghost open-comm-btn" data-id="${it.id}" style="padding:6px 10px;font-size:13px;font-weight:700;border-color:var(--jade);color:var(--jade);">🎧 Тренировать</button>
            <button class="ghost report-comm-btn" data-id="${it.id}" style="padding:5px 8px;font-size:11px;color:var(--muted);">🚩 Пожаловаться</button>
          </div>
        </div>
      `).join('');
      listEl.querySelectorAll('.open-comm-btn').forEach(btn => {
        btn.onclick = () => {
          const item = visible.find(x => x.id === btn.dataset.id);
          if (!item) return;
          const st = analyzeChineseText(item.body, allWords);
          st.ratio = item.hsk_ratio;
          st.level = item.level;
          renderLessonFromText(item.title, item.body, st);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };
      });
      listEl.querySelectorAll('.report-comm-btn').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const arr = JSON.parse(safeStorage.getItem('hsk_reported_texts') || '[]');
          if (!arr.includes(id)) {
            arr.push(id);
            safeStorage.setItem('hsk_reported_texts', JSON.stringify(arr));
          }
          try {
            await fetch(`${SB_URL}/rest/v1/rpc/report_community_text`, {
              method: 'POST',
              headers: {
                'apikey': SB_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ text_id: id })
            });
          } catch (e) {}
          loadCommunityList();
        };
      });
    } catch (e) {
      listEl.innerHTML = `<p style="margin:0;font-size:13px;color:var(--muted);">Не удалось загрузить подборку — проверь интернет.</p>`;
    }
  }
  loadCommunityList();
}
