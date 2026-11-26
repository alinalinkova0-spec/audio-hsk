import { safeStorage } from '../storage.js?v=10';
import { speak, mountAudioControl } from '../audio.js?v=13';
import { review, saveSRS } from '../srs.js';
import { openWordReportModal } from '../feedback.js?v=2';

const HARD_KEY = 'hsk_hard_words_v1';

export function getHardWordIds() {
  try {
    const arr = JSON.parse(safeStorage.getItem(HARD_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function markHardWord(wordId) {
  const list = getHardWordIds();
  if (!list.includes(wordId)) {
    list.push(wordId);
    safeStorage.setItem(HARD_KEY, JSON.stringify(list));
  }
}

export function unmarkHardWord(wordId) {
  const list = getHardWordIds().filter(id => id !== wordId);
  safeStorage.setItem(HARD_KEY, JSON.stringify(list));
}

function knowsWord(srsState, allWords, hanzi) {
  const found = allWords.find(w => w.hanzi === hanzi);
  return Boolean(found && srsState[found.id] && srsState[found.id].reps >= 1);
}

function renderInteractiveHanzi(hanzi, allWords) {
  const chars = [...String(hanzi || '')];
  if (chars.length < 2) return `<div style="line-height:1.25;">${hanzi}</div>`;
  return `
    <div style="display:inline-flex;gap:8px;justify-content:center;flex-wrap:wrap;line-height:1.25;">
      ${chars.map(ch => `<span class="char-part" data-char="${ch}" style="cursor:pointer;padding:2px 4px 4px;border-bottom:2px dashed rgba(30,126,94,0.5);">${ch}</span>`).join('')}
    </div>
  `;
}

function bindInteractiveHanzi(container, allWords, rate = 0.95) {
  const box = container.querySelector('#charBreakdownBox');
  container.querySelectorAll('.char-part').forEach(el => {
    el.onclick = () => {
      const ch = el.dataset.char;
      speak(ch, { rate, instant: true });
      const info = allWords.find(w => w.hanzi === ch);
      if (box) {
        box.style.color = 'var(--jade)';
        box.innerHTML = info
          ? `<b>${ch}</b> (${info.pinyin || '—'}) — ${info.ru || 'отдельный иероглиф'}`
          : `<b>${ch}</b> — озвучено (отдельный корень)`;
      }
    };
  });
}
function renderReportFlag(container, word) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid var(--border);text-align:center;';
  wrap.innerHTML = `<button type="button" id="flagWordBtn" class="ghost" style="min-height:36px;font-size:13px;padding:6px 12px;color:var(--muted);border-color:transparent;"><span style="color:#DC2626;font-size:15px;margin-right:5px;">⚑</span>Ошибка в переводе или пиньине?</button>`;
  container.appendChild(wrap);
  wrap.querySelector('#flagWordBtn').onclick = () => openWordReportModal(word);
}
const RECENT_SHOWN = [];
function markWordsShown(wordsList) {
  for (const w of wordsList) {
    if (!w) continue;
    const key = w.hanzi || String(w.id);
    const idx = RECENT_SHOWN.indexOf(key);
    if (idx !== -1) RECENT_SHOWN.splice(idx, 1);
    RECENT_SHOWN.push(key);
  }
  while (RECENT_SHOWN.length > 12) {
    RECENT_SHOWN.shift();
  }
}

function isRecentlyShown(word) {
  if (!word) return false;
  return RECENT_SHOWN.includes(word.hanzi || String(word.id));
}

export function pickNextNonRecentIndex(queue, startIdx = 0) {
  if (!Array.isArray(queue) || startIdx >= queue.length) return startIdx;
  const getWord = item => (item && item.word ? item.word : item);
  if (!isRecentlyShown(getWord(queue[startIdx]))) return startIdx;

  for (let i = startIdx + 1; i < queue.length; i++) {
    if (!isRecentlyShown(getWord(queue[i]))) {
      const [picked] = queue.splice(i, 1);
      queue.splice(startIdx, 0, picked);
      return startIdx;
    }
  }
  return startIdx;
}

function stripTones(p) {
  return String(p || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function recordWeakness(wordId, type) {
  try {
    const key = 'hsk_weakness_v1';
    const data = JSON.parse(safeStorage.getItem(key) || '{}');
    if (!data[wordId]) data[wordId] = { audioErr: 0, toneErr: 0, readErr: 0 };
    data[wordId][type] = (data[wordId][type] || 0) + 1;
    safeStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function generateToneVariants(pinyin) {
  const clean = String(pinyin || '').trim();
  if (!clean) return [];
  const TONE_MAP = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };
  const ALL_MARKED = Object.values(TONE_MAP).flat();
  const chars = [...clean];
  let targetIdx = -1;
  let baseVowel = '';

  for (let idx = chars.length - 1; idx >= 0; idx--) {
    const ch = chars[idx].toLowerCase();
    for (const [vowel, forms] of Object.entries(TONE_MAP)) {
      if (forms.includes(ch)) {
        targetIdx = idx;
        baseVowel = vowel;
        break;
      }
    }
    if (targetIdx !== -1) break;
  }

  if (targetIdx === -1) return [];
  const variants = new Set([clean]);
  for (const toneChar of TONE_MAP[baseVowel]) {
    const copy = [...chars];
    copy[targetIdx] = toneChar;
    variants.add(copy.join(''));
  }
  return Array.from(variants).filter(v => ALL_MARKED.some(m => v.toLowerCase().includes(m)));
}

function pickDistractors(word, all, tier) {
  const others = all.filter(w => w.id !== word.id && w.hanzi !== word.hanzi);
  const freshFirst = list => {
    const fresh = shuffle(list.filter(w => !isRecentlyShown(w)));
    const stale = shuffle(list.filter(w => isRecentlyShown(w)));
    return [...fresh, ...stale];
  };

  const wLen = [...word.hanzi].length;
  const wBase = stripTones(word.pinyin);
  const wFirstChar = [...word.hanzi].at(0);
  const wLastChar = [...word.hanzi].at(wLen - 1);

  if (tier === 'easy') {
    const diff = others.filter(w => [...w.hanzi].length !== wLen && stripTones(w.pinyin) !== wBase);
    const pool = diff.length >= 3 ? diff : others;
    return freshFirst(pool).slice(0, 3);
  }

  if (tier === 'hard') {
    const homophones = others.filter(w => wBase && stripTones(w.pinyin) === wBase);
    const similar = others.filter(w => {
      if (homophones.includes(w)) return false;
      const b = stripTones(w.pinyin);
      const samePrefix = wBase.length >= 2 && b.startsWith(wBase.slice(0, 2));
      const sameChar = w.hanzi.includes(wFirstChar) || w.hanzi.includes(wLastChar);
      return samePrefix || sameChar;
    });
    const combined = [...freshFirst(homophones), ...freshFirst(similar), ...freshFirst(others)];
    const unique = [];
    const seen = new Set([word.hanzi]);
    for (const item of combined) {
      if (!seen.has(item.hanzi)) {
        seen.add(item.hanzi);
        unique.push(item);
      }
      if (unique.length === 3) break;
    }
    return unique;
  }

  const sameLen = others.filter(w => [...w.hanzi].length === wLen);
  const similarStart = sameLen.filter(w => {
    const b = stripTones(w.pinyin);
    return wBase && b && b.at(0) === wBase.at(0);
  });
  const pool = [...freshFirst(similarStart), ...freshFirst(sameLen), ...freshFirst(others)];
  const unique = [];
  const seen = new Set([word.hanzi]);
  for (const item of pool) {
    if (!seen.has(item.hanzi)) {
      seen.add(item.hanzi);
      unique.push(item);
    }
    if (unique.length === 3) break;
  }
  return unique;
}
export function renderCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const tier = meta.tier || 'medium';
  const stepLabel = meta.label || '';
  const knowsFullIdk = knowsWord(srsState, all, '我')
    && (knowsWord(srsState, all, '不知道') || (knowsWord(srsState, all, '不') && knowsWord(srsState, all, '知道')))
    && knowsWord(srsState, all, '这个')
    && knowsWord(srsState, all, '词');
  const idkLabel = knowsFullIdk ? '我不知道这个词' : 'Я не знаю этого слова';

  const tierColors = { easy: '#1E7E5E', medium: '#B45309', hard: '#C83E37' };
  const tierNames = {
    easy: 'Разминка',
    medium: 'Средний',
    hard: 'Сложный (тоны и ловушки)'
  };

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:${tierColors[tier]};font-weight:600;">${tierNames[tier]}</span>
        <span style="color:var(--muted);">${stepLabel}</span>
      </div>
      <div style="min-height:110px;display:flex;align-items:center;justify-content:center;">
        <div id="wordAudioBox" class="card-audio" style="width:100%;"></div>
      </div>
      <p class="prompt">Какое слово прозвучало?</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr 1fr;gap:10px;"></div>
      <button id="idkBtn" type="button" class="ghost" style="width:100%;margin-top:8px;padding:10px;font-size:15px;font-weight:600;color:var(--muted);">${idkLabel}</button>
      <div class="reveal" id="reveal" hidden>
        <div class="hanzi" id="hanzi"></div>
        <div class="grades" style="margin-top:14px;"></div>
      </div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const idkBtn = root.querySelector('#idkBtn');
  const reveal = root.querySelector('#reveal');
  const audioCtrl = mountAudioControl(
    root.querySelector('#wordAudioBox'),
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  let done = false;

  function openReveal(ok, wrongOption = null, viaIdk = false) {
    done = true;
    if (idkBtn) idkBtn.style.display = 'none';
    if (viaIdk && answerEl) answerEl.style.display = 'none';

    const prevStreak = Number(safeStorage.getItem('hsk_streak') || 0);
    safeStorage.setItem('hsk_streak', ok ? String(prevStreak + 1) : '0');

    if (!ok) {
      recordWeakness(word.id, 'audioErr');
      markHardWord(word.id);
    } else if (meta.clearHardOnOk) {
      unmarkHardWord(word.id);
    }

    review(srsState, word.id, ok ? 2 : 0);
    saveSRS(srsState);
    speak(word.hanzi, { rate: audioCtrl.getRate() });

     const wrongHint = (!ok && !viaIdk && wrongOption)
      ? `<div style="font-size:15px;color:#C83E37;margin-top:10px;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">Твой выбор: ${wrongOption.hanzi} — ${wrongOption.ru || ''}</div>`
      : '';

    const charsLen = [...String(word.hanzi || '')].length;
    reveal.hidden = false;
    reveal.querySelector('#hanzi').innerHTML = `
      ${renderInteractiveHanzi(word.hanzi, all)}
      ${word.ru ? `<div style="margin-top:12px;"><span style="display:inline-block;padding:7px 16px;border-radius:12px;background:#FFF8EB;border:1px solid #F3D19E;font-size:18px;color:#1F2937;font-weight:700;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">${word.ru}</span></div>` : ''}
      ${charsLen >= 2 ? `<div id="charBreakdownBox" style="font-size:12px;color:var(--muted);margin-top:10px;min-height:18px;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;">💡 Нажми на иероглиф выше, чтобы узнать его значение</div>` : ''}
      ${wrongHint}
      <div id="optPreview" style="font-size:13px;color:var(--jade);margin-top:6px;font-family:'Inter',system-ui,sans-serif;letter-spacing:normal;"></div>
    `;
    bindInteractiveHanzi(reveal, all, audioCtrl.getRate());

     const gradesEl = reveal.querySelector('.grades');
    if (gradesEl) {
      gradesEl.style.display = 'block';
      gradesEl.innerHTML = `<button id="cardNextBtn" class="primary" style="width:100%;padding:13px;font-size:16px;">Дальше →</button>`;
      const nextBtn = gradesEl.querySelector('#cardNextBtn');
      if (nextBtn) nextBtn.onclick = onDone;
    }

    renderReportFlag(reveal, word);
  }

  if (idkBtn) {

    idkBtn.onclick = () => {
      if (done) return;
      Array.from(answerEl.children).forEach(b => {
        if (b.dataset.hanzi === word.hanzi) b.classList.add('ok');
      });
      openReveal(false, null, true);
    };
  }

  const pool = all.length >= 4 ? all : [...all, { id: 'x1', hanzi: '学习', pinyin: 'xuéxí', ru: 'учиться' }, { id: 'x2', hanzi: '联系', pinyin: 'liánxì', ru: 'связываться' }, { id: 'x3', hanzi: '练习', pinyin: 'liànxí', ru: 'тренироваться' }];
  const distractors = pickDistractors(word, pool, tier);
  const opts = shuffle([word, ...distractors]);
  markWordsShown(opts);

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '28px';
    b.style.textAlign = 'center';
    b.style.minHeight = '58px';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.textContent = o.hanzi;
    b.dataset.hanzi = o.hanzi;
    b.onclick = () => {
      if (done) {
        speak(o.hanzi, { rate: audioCtrl.getRate(), instant: true });
        const previewEl = reveal.querySelector('#optPreview');
        if (previewEl) {
          previewEl.textContent = `Прослушано: ${o.hanzi}${o.pinyin ? ` (${o.pinyin})` : ''}${o.ru ? ` — ${o.ru}` : ''}`;
        }
        return;
      }
      const ok = o.id === word.id;
      b.classList.add(ok ? 'ok' : 'bad');
      Array.from(answerEl.children).forEach(btnItem => {
        if (!ok && btnItem.dataset.hanzi === word.hanzi) btnItem.classList.add('ok');
        btnItem.innerHTML = `${btnItem.dataset.hanzi || btnItem.textContent} <span style="font-size:14px;opacity:0.75;">🔊</span>`;
      });
      openReveal(ok, o, false);
    };
    answerEl.appendChild(b);
  });
}

export function renderReadCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const mainRu = str => String(str || '').split(/[,;/]/).at(0).trim();
  const isRu = str => /[а-яё]/i.test(str) && !String(str).includes('MYMEMORY');

  const validPool = all.filter(
    w => w.id !== word.id && isRu(w.ru) && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
  );
  const freshPool = [...shuffle(validPool.filter(w => !isRecentlyShown(w))), ...shuffle(validPool.filter(w => isRecentlyShown(w)))];
  const others = freshPool.slice(0, 3);
  const opts = shuffle(Array.of(word, ...others));
  markWordsShown(opts);

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;">
        <span style="color:#1E7E5E;font-weight:700;">👀 Чтение без звука</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
        <div style="text-align:center;min-height:110px;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:52px;font-weight:800;line-height:1.25;letter-spacing:3px;color:var(--fg);">${word.hanzi}</div>
      </div>
      <p class="prompt">Узнай иероглиф глазами и выбери перевод</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr 1fr;gap:10px;"></div>
      <button id="readIdkBtn" type="button" class="ghost" style="width:100%;margin-top:8px;padding:10px;font-size:15px;font-weight:600;color:var(--muted);">Я не знаю этого слова</button>
      <div id="readFooter" style="text-align:center;margin-top:12px;"></div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const footerEl = root.querySelector('#readFooter');
  const idkBtn = root.querySelector('#readIdkBtn');
  let done = false;

  function finishRead(ok, clickedBtn = null) {
    if (done) return;
    done = true;
    if (idkBtn) idkBtn.style.display = 'none';
    if (clickedBtn) clickedBtn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) {
      recordWeakness(word.id, 'readErr');
      markHardWord(word.id);
      Array.from(answerEl.children).forEach(x => {
        if (x.textContent === mainRu(word.ru)) x.classList.add('ok');
      });
    }
    speak(word.hanzi, { rate: 0.95 });
    review(srsState, word.id, ok ? 2 : 0);
    saveSRS(srsState);

    footerEl.innerHTML = `<button id="readNext" class="primary" style="width:100%;padding:13px;font-size:16px;">Дальше →</button>`;
    footerEl.querySelector('#readNext').onclick = onDone;
    renderReportFlag(footerEl, word);
  }

  if (idkBtn) idkBtn.onclick = () => finishRead(false, null);

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '17px';
    b.style.padding = '13px';
    b.style.minHeight = '58px';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.style.textAlign = 'center';
    b.textContent = mainRu(o.ru);
    b.onclick = () => finishRead(o.id === word.id, b);
    answerEl.appendChild(b);
  });
}
const SYLLABLE_TONE_HANZI = {
  a: '啊,嗄,啊,à', ai: '哀,挨,矮,爱', an: '安,俺,俺,暗', ang: '肮,昂,盎,盎', ao: '熬,熬,袄,奥',
  ba: '八,拔,把,爸', bai: '掰,白,百,拜', ban: '班,版,板,半', bang: '帮,绑,绑,棒', bao: '包,薄,宝,抱',
  bei: '杯,北,北,背', ben: '奔,本,本,笨', beng: '崩,蹦,蹦,蹦', bi: '逼,鼻,比,币', bian: '边,扁,扁,变',
  biao: '标,表,表,表', bie: '憋,别,瘪,别', bin: '宾,鬓,鬓,鬓', bing: '冰,丙,饼,病', bo: '波,伯,跛,播',
  bu: '逋,勃,补,不', ca: '擦,擦,擦,擦', cai: '猜,才,采,菜', can: '餐,残,惨,灿', cang: '仓,藏,藏,藏',
  cao: '操,曹,草,草', ce: '测,侧,测,测', cen: '参,岑,岑,岑', ceng: '曾,层,层,蹭', cha: '叉,茶,茶,差',
  chai: '拆,柴,柴,差', chan: '搀,蝉,产,颤', chang: '昌,长,厂,唱', chao: '超,朝,吵,吵', che: '车,扯,扯,彻',
  chen: '抻,陈,沉,趁', cheng: '称,成,逞,秤', chi: '吃,迟,尺,翅', chong: '冲,虫,宠,冲', chou: '抽,愁,丑,臭',
  chu: '出,除,楚,处', chuan: '穿,船,喘,串', chuang: '窗,床,闯,创', chui: '吹,垂,锤,吹', chun: '春,纯,蠢,蠢',
  chuo: '戳,戳,戳,绰', ci: '疵,词,此,次', cong: '聪,从,从,凑', cou: '凑,凑,凑,凑', cu: '粗,粗,促,醋',
  cuan: '蹿,攒,攒,窜', cui: '催,脆,脆,脆', cun: '村,存,寸,寸', cuo: '搓,痤,错,错', da: '搭,答,打,大',
  dai: '呆,歹,歹,带', dan: '单,胆,胆,蛋', dang: '当,党,党,当', dao: '刀,倒,岛,到', de: '得,得,的,的',
  dei: '得,得,得,得', deng: '灯,等,等,邓', di: '低,敌,底,地', dian: '颠,点,点,电', diao: '雕,调,掉,掉',
  die: '爹,碟,碟,跌', ding: '丁,顶,顶,定', diu: '丢,丢,丢,丢', dong: '东,懂,懂,动', dou: '都,斗,斗,豆',
  du: '督,读,堵,度', duan: '端,短,短,段', dui: '堆,队,队,对', dun: '蹲,盾,盾,顿', duo: '多,夺,朵,剁',
  e: '阿,鹅,恶,饿', ei: '诶,诶,诶,诶', en: '恩,恩,摁,摁', er: '儿,儿,耳,二', fa: '发,乏,法,发',
  fan: '翻,烦,反,饭', fang: '方,房,访,放', fei: '飞,肥,匪,费', fen: '分,坟,粉,份', feng: '风,缝,讽,凤',
  fo: '佛,佛,佛,佛', fou: '否,否,否,否', fu: '夫,服,府,父', ga: '嘎,嘎,嘎,尬', gai: '该,改,改,盖',
  gan: '干,敢,感,干', gang: '刚,港,港,钢', gao: '高,搞,搞,告', ge: '哥,格,葛,个', gei: '给,给,给,给',
  gen: '根,跟,哏,艮', geng: '更,梗,梗,更', gong: '工,共,巩,共', gou: '沟,狗,狗,够', gu: '姑,骨,古,故',
  gua: '瓜,刮,寡,挂', guai: '乖,拐,拐,怪', guan: '关,馆,管,惯', guang: '光,广,广,逛', gui: '归,鬼,鬼,贵',
  gun: '滚,滚,滚,棍', guo: '锅,国,果,过', ha: '哈,蛤,哈,哈', hai: '嗨,还,海,害', han: '酣,寒,喊,汉',
  hang: '夯,行,航,巷', hao: '蒿,豪,好,号', he: '喝,河,喝,贺', hei: '黑,黑,黑,黑', hen: '痕,很,很,恨',
  heng: '哼,横,横,横', hong: '轰,红,哄,哄', hou: '侯,猴,吼,后', hu: '呼,湖,虎,护', hua: '花,滑,化,画',
  huai: '怀,怀,坏,坏', huan: '欢,还,缓,换', huang: '荒,黄,谎,晃', hui: '灰,回,毁,会', hun: '婚,魂,混,混',
  huo: '豁,活,火,或', ji: '机,急,几,记', jia: '家,夹,假,价', jian: '间,简,减,见', jiang: '江,讲,讲,酱',
  jiao: '交,嚼,脚,叫', jie: '街,节,姐,借', jin: '今,紧,紧,进', jing: '京,井,景,静', jiong: '窘,窘,窘,窘',
  jiu: '究,九,酒,就', ju: '居,局,举,句', juan: '捐,卷,卷,倦', jue: '撅,决,决,倔', jun: '军,均,菌,俊',
  ka: '咖,卡,卡,卡', kai: '开,凯,凯,概', kan: '刊,砍,砍,看', kang: '康,扛,抗,抗', kao: '考,烤,考,靠',
  ke: '科,咳,可,课', ken: '肯,肯,肯,啃', keng: '坑,坑,坑,坑', kong: '空,恐,恐,控', kou: '抠,口,口,扣',
  ku: '哭,苦,苦,裤', kua: '夸,垮,垮,跨', kuai: '快,块,块,快', kuan: '宽,款,款,款', kuang: '筐,狂,矿,况',
  kui: '亏,葵,傀,愧', kun: '昆,捆,捆,困', kuo: '扩,阔,阔,扩', la: '拉,啦,喇,辣', lai: '来,来,赖,赖',
  lan: '兰,蓝,懒,烂', lang: '狼,郎,朗,浪', lao: '捞,劳,老,闹', le: '乐,了,了,乐', lei: '勒,雷,累,类',
  leng: '棱,冷,冷,愣', li: '离,梨,里,力', lian: '连,连,脸,练', liang: '凉,良,两,亮', liao: '撩,聊,了,料',
  lie: '列,烈,裂,猎', lin: '林,邻,凛,吝', ling: '零,灵,领,另', liu: '溜,流,柳,六', long: '龙,龙,拢,弄',
  lou: '搂,楼,搂,漏', lu: '噜,炉,鲁,路', lv: '驴,驴,旅,绿', luan: '孪,卵,卵,乱', lue: '掠,略,略,略',
  lun: '抡,轮,论,论', luo: '罗,萝,裸,落', ma: '妈,麻,马,骂', mai: '埋,买,买,卖', man: '蛮,满,满,慢',
  mang: '忙,忙,莽,莽', mao: '猫,毛,卯,帽', me: '么,么,么,么', mei: '没,没,美,妹', men: '闷,门,们,闷',
  meng: '蒙,萌,猛,梦', mi: '咪,迷,米,密', mian: '棉,眠,免,面', miao: '喵,苗,秒,妙', mie: '灭,灭,灭,灭',
  min: '民,民,敏,敏', ming: '明,明,铭,命', miu: '谬,谬,谬,谬', mo: '摸,魔,抹,末', mou: '某,谋,某,某',
  mu: '模,模,母,木', na: '拿,拿,哪,那', nai: '乃,奶,奶,耐', nan: '南,男,难,难', nang: '囊,囊,囊,囊',
  nao: '挠,恼,脑,闹', ne: '呢,呢,呢,呢', nei: '内,内,哪,内', nen: '嫩,嫩,嫩,嫩', neng: '能,能,能,能',
  ni: '妮,泥,你,逆', nian: '粘,年,碾,念', niang: '娘,娘,酿,酿', niao: '鸟,鸟,鸟,尿', nie: '捏,捏,捏,聂',
  nin: '您,您,您,您', ning: '宁,凝,拧,宁', niu: '妞,牛,扭,拗', nong: '农,浓,弄,弄', nu: '奴,奴,努,怒',
  nv: '女,女,女,女', nuan: '暖,暖,暖,暖', nue: '虐,虐,虐,虐', nuo: '挪,挪,诺,诺', o: '哦,哦,哦,哦',
  ou: '欧,偶,偶,沤', pa: '趴,爬,怕,怕', pai: '拍,排,派,派', pan: '攀,盘,判,盼', pang: '胖,旁,胖,胖',
  pao: '抛,跑,跑,炮', pei: '胚,陪,配,配', pen: '喷,盆,盆,喷', peng: '烹,朋,捧,碰', pi: '批,皮,匹,屁',
  pian: '篇,便,片,骗', piao: '飘,瓢,票,票', pie: '瞥,撇,撇,撇', pin: '拼,贫,品,聘', ping: '乒,平,瓶,凭',
  po: '坡,婆,破,破', pou: '剖,剖,剖,剖', pu: '铺,葡,普,铺', qi: '七,其,起,气', qia: '掐,卡,卡,恰',
  qian: '千,前,浅,欠', qiang: '枪,强,抢,呛', qiao: '敲,桥,巧,翘', qie: '切,茄,且,切', qin: '亲,琴,寝,沁',
  qing: '青,晴,请,庆', qiong: '穷,穷,穷,穷', qiu: '秋,球,求,救', qu: '区,渠,取,去', quan: '圈,全,犬,劝',
  que: '缺,瘸,却,确', qun: '群,群,群,群', ran: '然,然,染,染', rang: '嚷,瓤,壤,让', rao: '饶,饶,扰,绕',
  re: '惹,惹,惹,热', ren: '人,人,忍,认', reng: '扔,仍,仍,仍', ri: '日,日,日,日', rong: '容,荣,冗,融',
  rou: '揉,柔,肉,肉', ru: '如,如,乳,入', ruan: '软,软,软,软', rui: '瑞,锐,瑞,瑞', run: '润,润,润,润',
  ruo: '若,弱,弱,若', sa: '撒,洒,洒,萨', sai: '腮,赛,赛,赛', san: '三,伞,伞,散', sang: '桑,嗓,嗓,丧',
  sao: '骚,扫,扫,嫂', se: '色,涩,色,色', sen: '森,森,森,森', seng: '僧,僧,僧,僧', sha: '沙,啥,傻,厦',
  shai: '筛,晒,晒,晒', shan: '山,闪,闪,善', shang: '商,赏,赏,上', shao: '烧,勺,少,哨', she: '奢,蛇,舍,社',
  shen: '身,神,审,肾', sheng: '生,绳,省,胜', shi: '师,十,使,是', shou: '收,熟,手,瘦', shu: '书,熟,数,树',
  shua: '刷,耍,耍,刷', shuai: '摔,甩,甩,帅', shuan: '栓,栓,涮,涮', shuang: '双,爽,爽,爽', shui: '谁,谁,水,睡',
  shun: '顺,顺,吮,顺', shuo: '说,说,硕,硕', si: '思,死,死,四', song: '松,耸,送,送', sou: '搜,搜,艘,嗽',
  su: '苏,俗,素,速', suan: '酸,算,算,算', sui: '虽,随,髓,岁', sun: '孙,损,损,损', suo: '缩,所,所,锁',
  ta: '他,塔,塔,踏', tai: '胎,台,太,太', tan: '贪,谈,坦,探', tang: '汤,糖,躺,烫', tao: '涛,逃,讨,套',
  te: '特,特,特,特', teng: '疼,疼,腾,腾', ti: '梯,题,体,替', tian: '天,田,舔,填', tiao: '挑,条,挑,跳',
  tie: '贴,铁,铁,贴', ting: '听,停,挺,艇', tong: '通,同,统,痛', tou: '偷,头,投,透', tu: '突,图,土,兔',
  tuan: '湍,团,团,团', tui: '推,颓,腿,退', tun: '吞,屯,吞,褪', tuo: '拖,驼,妥,拓', wa: '挖,娃,瓦,袜',
  wai: '歪,歪,崴,外', wan: '弯,完,晚,万', wang: '汪,王,网,忘', wei: '威,围,伟,位', wen: '温,文,稳,问',
  weng: '翁,翁,嗡,瓮', wo: '窝,我,我,握', wu: '屋,无,五,物', xi: '西,习,洗,细', xia: '虾,霞,下,夏',
  xian: '先,闲,显,现', xiang: '香,详,想,向', xiao: '消,学,小,笑', xie: '些,鞋,写,谢', xin: '心,寻,信,信',
  xing: '星,行,醒,姓', xiong: '兄,雄,熊,凶', xiu: '修,羞,朽,秀', xu: '需,徐,许,续', xuan: '宣,悬,选,炫',
  xue: '薛,学,雪,血', xun: '勋,寻,训,训', ya: '压,牙,哑,亚', yan: '烟,言,眼,验', yang: '央,羊,养,样',
  yao: '腰,摇,咬,要', ye: '耶,爷,也,夜', yi: '一,移,以,意', yin: '音,银,引,印', ying: '英,迎,影,硬',
  yong: '拥,永,永,用', you: '优,由,有,又', yu: '迂,鱼,雨,玉', yuan: '冤,元,远,愿', yue: '约,月,越,月',
  yun: '晕,云,允,运', za: '扎,杂,咋,杂', zai: '灾,载,宰,在', zan: '簪,咱,攒,赞', zang: '脏,藏,葬,葬',
  zao: '糟,凿,早,造', ze: '责,择,则,泽', zei: '贼,贼,贼,贼', zen: '怎,怎,怎,怎', zeng: '增,赠,赠,赠',
  zha: '渣,炸,眨,炸', zhai: '摘,宅,窄,债', zhan: '沾,展,展,站', zhang: '张,涨,长,丈', zhao: '招,着,找,照',
  zhe: '遮,折,者,这', zhen: '真,枕,枕,阵', zheng: '争,整,整,正', zhi: '知,直,只,志', zhong: '中,种,肿,重',
  zhou: '周,轴,肘,宙', zhu: '猪,竹,主,住', zhua: '抓,爪,爪,抓', zhuai: '拽,拽,拽,拽', zhuan: '专,转,转,赚',
  zhuang: '装,壮,撞,撞', zhui: '追,坠,缀,坠', zhun: '准,准,准,准', zhuo: '桌,着,拙,捉', zi: '资,子,紫,字',
  zong: '宗,总,总,纵', zou: '邹,走,走,奏', zu: '租,足,组,祖', zuan: '钻,纂,纂,赚', zui: '嘴,嘴,嘴,最',
  zun: '尊,遵,尊,俊', zuo: '作,昨,左,坐'
};
function pinyinToSpeakableHanzi(pyOption, allWords, fallbackWord) {
  const cleanOpt = String(pyOption || '').trim().toLowerCase();
  if (cleanOpt === String(fallbackWord.pinyin || '').trim().toLowerCase()) {
    return fallbackWord.hanzi;
  }
  const exactWord = allWords.find(w => String(w.pinyin || '').trim().toLowerCase() === cleanOpt);
  if (exactWord && exactWord.hanzi) return exactWord.hanzi;

  const toneGroups = { 1: 'āēīōūǖ', 2: 'áéíóúǘ', 3: 'ǎěǐǒǔǚ', 4: 'àèìòùǜ' };
  let detectedTone = 1;
  for (const ch of cleanOpt) {
    for (const [t, chars] of Object.entries(toneGroups)) {
      if (chars.includes(ch)) detectedTone = Number(t);
    }
  }
  const base = cleanOpt
    .replace(/ü/g, 'v')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zv]/g, '');

  const rowStr = SYLLABLE_TONE_HANZI[base];
  if (rowStr) {
    const arr = rowStr.split(',');
    const char = arr.at(detectedTone - 1);
    if (char) return char;
  }
  return fallbackWord.hanzi;
}

export function renderToneCard(root, word, srsState, onDone, meta = {}) {
  const variants = generateToneVariants(word.pinyin);
  if (variants.length < 3) {
    renderCard(root, word, srsState, onDone, meta);
    return;
  }

  const all = window.__ALL_WORDS || [];
  const opts = shuffle(variants).slice(0, 4);
  if (!opts.includes(word.pinyin.trim())) {
    opts.splice(0, 1, word.pinyin.trim());
  }
  const finalOpts = shuffle(opts);
  let showRu = safeStorage.getItem('hsk_tone_ru') !== '0';

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:8px;font-size:13px;">
        <span style="color:var(--muted);font-weight:600;">${meta.label || ''}</span>
      </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;min-height:110px;margin-bottom:6px;">
        <div id="toneAudioBox" class="card-audio" style="margin:0;"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <button id="toggleRuBtn" class="ghost" style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:999px;border-color:${showRu ? 'var(--jade)' : 'var(--border)'};background:${showRu ? '#EDF5F0' : '#FAFBF9'};color:${showRu ? 'var(--jade)' : 'var(--muted)'};white-space:nowrap;">
            Перевод: ${showRu ? 'Вкл' : 'Выкл'}
          </button>
          <div id="toneSpeedSlot"></div>
        </div>
      </div>
      <div style="text-align:center;margin:10px 0 14px;">
        <div style="font-size:38px;font-weight:800;line-height:1.15;color:var(--fg);">${word.hanzi}</div>
        <div id="toneRuText" style="font-size:16px;color:var(--muted);margin-top:10px;min-height:22px;display:${showRu ? 'block' : 'none'};">${word.ru}</div>
      </div>
      <p class="prompt">Выбери правильный тон пиньиня</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr 1fr;gap:10px;"></div>
      <button id="toneIdkBtn" type="button" class="ghost" style="width:100%;margin-top:8px;padding:10px;font-size:15px;font-weight:600;color:var(--muted);">Я не знаю</button>
      <div id="toneFooter" style="text-align:center;margin-top:12px;"></div>
    </div>`;
    const answerEl = root.querySelector('#answers');
  const footerEl = root.querySelector('#toneFooter');
  const ruTextEl = root.querySelector('#toneRuText');
  const toggleRuBtn = root.querySelector('#toggleRuBtn');
  const idkBtn = root.querySelector('#toneIdkBtn');
  let done = false;

  const audioBox = root.querySelector('#toneAudioBox');
  const audioCtrl = mountAudioControl(
    audioBox,
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  const speedEl = audioBox.children.item(1);
  if (speedEl) {
    root.querySelector('#toneSpeedSlot').appendChild(speedEl);
  }

  toggleRuBtn.onclick = () => {
    showRu = !showRu;
    safeStorage.setItem('hsk_tone_ru', showRu ? '1' : '0');
    toggleRuBtn.textContent = `Перевод: ${showRu ? 'Вкл' : 'Выкл'}`;
    toggleRuBtn.style.borderColor = showRu ? 'var(--jade)' : 'var(--border)';
    toggleRuBtn.style.background = showRu ? '#EDF5F0' : '#FAFBF9';
    toggleRuBtn.style.color = showRu ? 'var(--jade)' : 'var(--muted)';
    ruTextEl.style.display = showRu ? 'block' : 'none';
  };

  function finishTone(ok, clickedBtn = null) {
    if (done) return;
    done = true;
    if (idkBtn) idkBtn.style.display = 'none';
    if (clickedBtn) clickedBtn.classList.add(ok ? 'ok' : 'bad');
    ruTextEl.style.display = 'block';
    if (!ok) {
      recordWeakness(word.id, 'toneErr');
      markHardWord(word.id);
      Array.from(answerEl.children).forEach(x => {
        if (x.dataset.py === word.pinyin.trim()) x.classList.add('ok');
      });
    }
    Array.from(answerEl.children).forEach(x => {
      x.innerHTML = `<span>${x.dataset.py}</span> <span style="font-size:14px;opacity:0.85;margin-left:4px;">🔊</span>`;
    });
    speak(word.hanzi, { rate: audioCtrl.getRate() });
    review(srsState, word.id, ok ? 2 : 0);
    saveSRS(srsState);

    footerEl.innerHTML = `<button id="toneNext" class="primary" style="width:100%;padding:13px;font-size:16px;">Дальше →</button>`;
    footerEl.querySelector('#toneNext').onclick = onDone;
    renderReportFlag(footerEl, word);
  }

  if (idkBtn) idkBtn.onclick = () => finishTone(false, null);

  finalOpts.forEach(pOpt => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.dataset.py = pOpt;
    b.style.fontSize = '19px';
    b.style.fontWeight = '700';
    b.style.textAlign = 'center';
    b.style.padding = '14px';
    b.style.minHeight = '58px';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.textContent = pOpt;
    b.onclick = () => {
      if (!done) {
        finishTone(pOpt === word.pinyin.trim(), b);
        return;
      }
      const speakHanzi = pinyinToSpeakableHanzi(pOpt, all, word);
      speak(speakHanzi, { rate: audioCtrl.getRate(), instant: true });
    };
    answerEl.appendChild(b);
  });
}

export function renderBlitzCard(root, word, srsState, onDone, meta = {}) {
  const all = window.__ALL_WORDS || [];
  const LIMIT_MS = 5000;

  const mainRu = str => String(str || '').split(/[,;/]/).at(0).trim();
  const isRu = str => /[а-яё]/i.test(str) && !String(str).includes('MYMEMORY');

  let validPool = all.filter(
    w => w.id !== word.id && isRu(w.ru) && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
  );
  if (validPool.length < 3) {
    validPool = all.filter(
      w => w.id !== word.id && mainRu(w.ru) && mainRu(w.ru) !== mainRu(word.ru)
    );
  }
  const freshPool = [...shuffle(validPool.filter(w => !isRecentlyShown(w))), ...shuffle(validPool.filter(w => isRecentlyShown(w)))];
  const others = freshPool.slice(0, 3);
  const opts = shuffle(Array.of(word, ...others));
  markWordsShown(opts);

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px;">
        <span style="color:#fbbf24;font-weight:600;">⚡ Молния (5 сек)</span>
        <span style="color:var(--muted);">${meta.label || ''}</span>
      </div>
      <div style="width:100%;height:6px;background:rgba(0,0,0,0.08);border-radius:4px;overflow:hidden;margin-bottom:14px;">
        <div id="timerBar" style="width:100%;height:100%;background:#fbbf24;transition:width ${LIMIT_MS}ms linear;"></div>
      </div>
      <div id="blitzAudioBox" class="card-audio"></div>
      <p class="prompt">Быстро нажми перевод!</p>
      <div class="answers" id="answers" style="grid-template-columns:1fr;"></div>
      <button id="blitzIdkBtn" type="button" class="ghost" style="width:100%;margin-top:8px;padding:10px;font-size:15px;font-weight:600;color:var(--muted);">Я не знаю</button>
      <div id="blitzInfo" style="text-align:center;margin-top:12px;min-height:24px;font-size:16px;"></div>
    </div>`;

  const answerEl = root.querySelector('#answers');
  const infoEl = root.querySelector('#blitzInfo');
  const bar = root.querySelector('#timerBar');
  const idkBtn = root.querySelector('#blitzIdkBtn');
  let done = false;

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.style.fontSize = '17px';
    b.style.padding = '13px';
    b.textContent = mainRu(o.ru);
    b.onclick = () => finish(o.id === word.id, b, false);
    answerEl.appendChild(b);
  });

  if (idkBtn) idkBtn.onclick = () => finish(false, null, false);

  mountAudioControl(
    root.querySelector('#blitzAudioBox'),
    r => speak(word.hanzi, { rate: r }),
    { autoPlay: true }
  );

  const startTime = Date.now();
  const tick = setInterval(() => {
    if (done || !document.body.contains(answerEl)) {
      clearInterval(tick);
      return;
    }
    const left = Math.max(0, 1 - (Date.now() - startTime) / LIMIT_MS);
    bar.style.transition = 'none';
    bar.style.width = (left * 100) + '%';
    if (left <= 0) {
      clearInterval(tick);
      finish(false, null, true);
    }
  }, 40);

  function finish(ok, btn, timeout) {
    if (done || !document.body.contains(answerEl)) return;
    done = true;
    clearInterval(tick);
    if (idkBtn) idkBtn.style.display = 'none';
    if (btn) btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) {
      markHardWord(word.id);
      Array.from(answerEl.children).forEach(b => {
        if (b.textContent === mainRu(word.ru)) b.classList.add('ok');
      });
    }
    infoEl.innerHTML = `${timeout ? '<span style="color:#f87171;">Время вышло! </span>' : ''}<b>${word.hanzi}</b> (${word.pinyin}) — ${word.ru}`;
    review(srsState, word.id, ok ? 2 : 0);
    saveSRS(srsState);
    if (ok) {
      setTimeout(onDone, 650);
    } else {
      const nextWrap = document.createElement('div');
      nextWrap.style.marginTop = '12px';
      nextWrap.innerHTML = `<button id="blitzNext" class="primary" style="width:100%;">Дальше →</button>`;
      infoEl.appendChild(nextWrap);
      nextWrap.querySelector('#blitzNext').onclick = onDone;
      renderReportFlag(infoEl, word);
    }
  }
}
function shuffle(a) {
  return a.map(v => ({ r: Math.random(), v })).sort((x, y) => x.r - y.r).map(x => x.v);
}