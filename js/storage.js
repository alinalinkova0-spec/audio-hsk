const memoryStorage = {};
const DB_NAME = 'hsk_trainer_backup';
const STORE_NAME = 'kv';
const CACHE_BACKUP = 'hsk_state_cache_v1';
const CACHE_URL = '/__hsk_state_backup__.json';
const SB_URL = 'https://srtoxpakayozfeqxjqdd.supabase.co';
const SB_KEY = 'sb_publishable_EvXS1QB5OMOKnK8poiXCTQ_VXMcefQ2';
const EMAIL_KEY = 'hsk_user_email';
const SYNC_KEYS = [
  'hsk_user_name', 'hsk_start_lvl', 'hsk_lvl', 'hsk_les', 'hsk_mode', 'srs_hsk4_v1', 'hsk_visit_days_v1',
  'hsk_tired_streak', 'hsk_morning_reset', 'hsk_exam_date',
  'hsk_daily_goal', 'hsk_daily_plan_v1', 'hsk_streak', 'hsk_weakness_v1',
  'hsk_tone_ru', 'hsk_settings_visited', 'hsk_sfx_off', 'hsk_sfx_theme',
  'hsk_rem_on', 'hsk_rem_time', 'hsk_rem_freq', 'hsk_show_progress',
  'hsk_start_date', 'hsk_vocab_v13'
];

function fetchWithTimeout(url, options = {}, ms = 4000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function getCookie(key) {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)'));
    return match ? decodeURIComponent(match.at(1)) : null;
  } catch (e) {
    return null;
  }
}

function setCookie(key, value) {
  try {
    if (String(value).length > 1000) return;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
  } catch (e) {}
}

function removeCookie(key) {
  try {
    document.cookie = `${encodeURIComponent(key)}=; max-age=0; path=/; SameSite=Lax`;
  } catch (e) {}
}

let cacheWriteTimer = null;
function scheduleCacheBackup() {
  if (!('caches' in window)) return;
  if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
  cacheWriteTimer = setTimeout(() => {
    try {
      const snapshot = Object.assign({}, memoryStorage);
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) snapshot[k] = window.localStorage.getItem(k);
      }
      caches.open(CACHE_BACKUP).then(cache => {
        cache.put(CACHE_URL, new Response(JSON.stringify(snapshot), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }).catch(() => {});
    } catch (e) {}
  }, 50);
}

async function restoreFromCacheStorage() {
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_BACKUP);
    const resp = await cache.match(CACHE_URL);
    if (!resp) return;
    const data = await resp.json();
    if (!data || typeof data !== 'object') return;
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        const strV = String(v);
        memoryStorage[k] = strV;
        try {
          if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, strV);
        } catch (e) {}
      }
    });
  } catch (e) {}
}

let dbPromise = null;
function openBackupDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject();
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(); };
  });
  return dbPromise;
}

function writeBackupDB(key, value) {
  openBackupDB().then(db => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    if (value === null) tx.objectStore(STORE_NAME).delete(key);
    else tx.objectStore(STORE_NAME).put(String(value), key);
  }).catch(() => {});
}
function setLongCookie(name, val) {
  try {
    document.cookie = `${name}=${encodeURIComponent(val)}; max-age=31536000; path=/; SameSite=Lax`;
  } catch {}
}

function getLongCookie(name) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
}
export function normalizeGooseCode(raw) {
  let clean = String(raw || '').trim().toUpperCase();
  clean = clean.replace(/^ГУСЬ[-\s_]*/i, 'GOOSE-');
  clean = clean.replace(/[^A-Z0-9-]/g, '');
  if (!clean) return '';
  if (!clean.startsWith('GOOSE-') && !clean.includes('@')) {
    clean = 'GOOSE-' + clean;
  }
  return clean.slice(0, 24);
}

export function generateGooseCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const c1 = chars.charAt(Math.floor(Math.random() * chars.length));
  const c2 = chars.charAt(Math.floor(Math.random() * chars.length));
  return `GOOSE-${num}-${c1}${c2}`;
}

(() => {
  const cEmail = getLongCookie('hsk_uid_mail');
  const cName = getLongCookie('hsk_uid_name');
  if (cEmail) {
    memoryStorage[EMAIL_KEY] = cEmail;
    try { if (!window.localStorage.getItem(EMAIL_KEY)) window.localStorage.setItem(EMAIL_KEY, cEmail); } catch {}
  }
  if (cName) {
    memoryStorage['hsk_user_name'] = cName;
    try { if (!window.localStorage.getItem('hsk_user_name')) window.localStorage.setItem('hsk_user_name', cName); } catch {}
  }
})();

export const storageReady = Promise.race([
  Promise.all([
    restoreFromCacheStorage(),
    openBackupDB().then(db => new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result || Array.of();
        const vals = valsReq.result || Array.of();
        keys.forEach((rawKey, idx) => {
          const k = String(rawKey);
          const v = String(vals.at(idx));
          memoryStorage[k] = v;
          try {
            if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, v);
          } catch (err) {}
        });
        scheduleCacheBackup();
        resolve();
      };
      tx.onerror = () => resolve();
    })).catch(() => {})
  ]),
  new Promise(resolve => setTimeout(resolve, 1500))
]);
let cloudTimer = null;
let isApplyingRemote = false;

function scheduleCloudSync() {
  if (isApplyingRemote) return;
  const email = (safeStorage.getItem(EMAIL_KEY) || '').trim().toLowerCase();
  if (!email) return;
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    pushCloudState(email).catch(() => {});
  }, 1200);
}

export const safeStorage = {
  getItem(key) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {}
    if (Object.prototype.hasOwnProperty.call(memoryStorage, key)) {
      return memoryStorage[key];
    }
    const cVal = getCookie(key);
    if (cVal !== null) {
      memoryStorage[key] = cVal;
      return cVal;
    }
    return null;
  },

  setItem(key, value) {
    const strVal = String(value);
    memoryStorage[key] = strVal;
    try {
      window.localStorage.setItem(key, strVal);
    } catch (e) {}
    setCookie(key, strVal);
    writeBackupDB(key, strVal);
    scheduleCacheBackup();
    if (key !== 'hsk_last_cloud_sync') scheduleCloudSync();
  },

  removeItem(key) {
    delete memoryStorage[key];
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
    removeCookie(key);
    writeBackupDB(key, null);
    scheduleCacheBackup();
  }
};

export function getSavedEmail() {
  return (safeStorage.getItem(EMAIL_KEY) || '').trim().toLowerCase();
}
export function getSavedName() {
  return (safeStorage.getItem('hsk_user_name') || '').trim();
}
export function setSavedName(name) {
  const clean = String(name || '').trim();
  if (clean) {
    safeStorage.setItem('hsk_user_name', clean);
    setLongCookie('hsk_uid_name', clean);
  }
}

function collectLocalProfileState() {
  const state = {};
  for (const k of SYNC_KEYS) {
    const val = safeStorage.getItem(k);
    if (val !== null && val !== undefined) state[k] = val;
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('hsk_daily_') || k.startsWith('hsk_mood_'))) {
        state[k] = window.localStorage.getItem(k);
      }
    }
  } catch (e) {}
  return state;
}

function mergeProfileStates(localState, remoteState) {
  const merged = { ...(localState || {}), ...(remoteState || {}) };

  // 1. Умное слияние словарей SRS (ни одно выученное слово с телефона или ноутбука не пропадёт)
  try {
    const locSrs = JSON.parse(localState?.srs_hsk4_v1 || '{}');
    const remSrs = JSON.parse(remoteState?.srs_hsk4_v1 || '{}');
    const allIds = new Set([...Object.keys(locSrs), ...Object.keys(remSrs)]);
    const mergedSrs = {};
    allIds.forEach(id => {
      const a = locSrs[id];
      const b = remSrs[id];
      if (!a) { mergedSrs[id] = b; return; }
      if (!b) { mergedSrs[id] = a; return; }
      const repsA = Number(a.reps || 0);
      const repsB = Number(b.reps || 0);
      const dueA = Number(a.due || 0);
      const dueB = Number(b.due || 0);
      mergedSrs[id] = (repsA > repsB || (repsA === repsB && dueA >= dueB)) ? a : b;
    });
    if (Object.keys(mergedSrs).length > 0) {
      merged.srs_hsk4_v1 = JSON.stringify(mergedSrs);
    }
  } catch {}

  // 2. Умное слияние уровня HSK (берём более высокий из двух устройств)
  const locLvl = Number(localState?.hsk_lvl || localState?.hsk_start_lvl || 0);
  const remLvl = Number(remoteState?.hsk_lvl || remoteState?.hsk_start_lvl || 0);
  const bestLvl = Math.max(locLvl, remLvl);
  if (bestLvl >= 1 && bestLvl <= 6) {
    merged.hsk_lvl = String(bestLvl);
    merged.hsk_start_lvl = String(bestLvl);
  }

  // 3. Объединение календаря посещений с лапками (ноутбук + телефон без дублей)
  try {
    const locDays = JSON.parse(localState?.hsk_visit_days_v1 || '[]');
    const remDays = JSON.parse(remoteState?.hsk_visit_days_v1 || '[]');
    const unionDays = Array.from(new Set([
      ...(Array.isArray(locDays) ? locDays : []),
      ...(Array.isArray(remDays) ? remDays : [])
    ])).sort();
    if (unionDays.length > 0) {
      merged.hsk_visit_days_v1 = JSON.stringify(unionDays);
    }
  } catch {}

  return merged;
}

function applyRemoteProfileState(remoteState) {
  if (!remoteState || typeof remoteState !== 'object') return;
  const localState = collectLocalProfileState();
  const merged = mergeProfileStates(localState, remoteState);
  isApplyingRemote = true;
  try {
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        safeStorage.setItem(k, String(v));
      }
    });
  } finally {
    isApplyingRemote = false;
  }
}

export async function pushCloudState(emailInput) {
  const email = String(emailInput || getSavedEmail()).trim().toLowerCase();
  if (!email) return { ok: false };
  safeStorage.setItem(EMAIL_KEY, email);
    setLongCookie('hsk_uid_mail', email);
  const curName = getSavedName();
  if (curName) setLongCookie('hsk_uid_name', curName);
  scheduleCacheBackup();

  let stateObj = collectLocalProfileState();
  try {
    const prevRes = await fetchWithTimeout(
      `${SB_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=state`,
      { headers: { 'apikey': SB_KEY } },
      2500
    );
    if (prevRes.ok) {
      const rows = await prevRes.json().catch(() => []);
            if (Array.isArray(rows) && rows.length > 0 && rows.at(0).state) {
        stateObj = mergeProfileStates(stateObj, rows.at(0).state);
        applyRemoteProfileState(stateObj);
      }
            }
  } catch {}
    const baseHeaders = {
    'apikey': SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Пробуем обновить существующую запись через PATCH
    let res = await fetchWithTimeout(`${SB_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: baseHeaders,
      body: JSON.stringify({ state: stateObj, updated_at: new Date().toISOString() })
    }, 4500);

    if (!res.ok) {
      res = await fetchWithTimeout(`${SB_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: baseHeaders,
        body: JSON.stringify({ state: stateObj })
      }, 4500);
    }

    if (res.ok) {
      const updatedRows = await res.json().catch(() => []);
      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        safeStorage.setItem('hsk_last_cloud_sync', nowTime);
        return { ok: true };
      }
    }

    // 2. Если записи ещё нет в базе — создаём новую через POST
    let ins = await fetchWithTimeout(`${SB_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email, state: stateObj, updated_at: new Date().toISOString() })
    }, 4500);

    if (!ins.ok) {
      ins = await fetchWithTimeout(`${SB_URL}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ email, state: stateObj })
      }, 4500);
    }

    if (!ins.ok) {
      const errTxt = await ins.text().catch(() => '');
      return { ok: false, error: `HTTP ${ins.status}: ${errTxt}` };
    }

    const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    safeStorage.setItem('hsk_last_cloud_sync', nowTime);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

export async function pullCloudState(emailInput) {
  const email = String(emailInput || getSavedEmail()).trim().toLowerCase();
  if (!email) return { ok: false, found: false };

  try {
    const res = await fetchWithTimeout(
      `${SB_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=state`,
      {
        method: 'GET',
        headers: {
          'apikey': SB_KEY
        }
      },
      4000
    );
    if (!res.ok) return { ok: false, found: false };
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows.at(0).state) {
      applyRemoteProfileState(rows.at(0).state);
      safeStorage.setItem(EMAIL_KEY, email);
      safeStorage.setItem('hsk_last_cloud_sync', new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      return { ok: true, found: true };
    }
    return { ok: true, found: false };
  } catch (e) {
    return { ok: false, found: false };
  }
}

export async function loginByEmail(codeInput) {
  const code = normalizeGooseCode(codeInput);
  if (!code || code.length < 4) {
    return { ok: false, message: 'Введи гусиный код (например, GOOSE-007)' };
  }
  const enteredName = getSavedName();
  safeStorage.setItem(EMAIL_KEY, code);
  setLongCookie('hsk_uid_mail', code);

  const pulled = await pullCloudState(code);
  const pushed = await pushCloudState(code);

  if (enteredName && !getSavedName()) setSavedName(enteredName);

  if (pulled.ok && pulled.found) {
    return { ok: true, restored: true, message: `Код ${code} подключён! Словарь и уровень объединены ✓` };
  }
  if (pushed.ok) {
    return { ok: true, restored: false, message: `Код ${code} закреплён, прогресс сохранён в облаке ✓` };
  }
  return { ok: false, message: 'Не удалось связаться с облаком, проверь интернет' };
}

export function logoutEmail() {
  safeStorage.removeItem(EMAIL_KEY);
  safeStorage.removeItem('hsk_user_name');
  safeStorage.removeItem('hsk_last_cloud_sync');
    setLongCookie('hsk_uid_mail', '');
  setLongCookie('hsk_uid_name', '');

}
export async function findProfilesByNickname(nickname) {
  const clean = String(nickname || '').trim();
  if (!clean) return { ok: false, items: [] };

  try {
    const query = `${SB_URL}/rest/v1/user_profiles?state->>hsk_user_name=ilike.*${encodeURIComponent(clean)}*&select=email,state,updated_at&limit=10`;
    const res = await fetchWithTimeout(query, {
      method: 'GET',
      headers: { 'apikey': SB_KEY }
    }, 4500);

    if (!res.ok) return { ok: false, items: [] };
    const rows = await res.json();
    if (!Array.isArray(rows)) return { ok: true, items: [] };

    const items = rows
      .filter(r => r && r.email && String(r.email).toUpperCase().startsWith('GOOSE-'))
      .map(r => {
        const st = r.state || {};
        const name = st.hsk_user_name || 'Без имени';
        const lvl = st.hsk_lvl || st.hsk_start_lvl || '1';
        let wordsCount = 0;
        try {
          wordsCount = Object.keys(JSON.parse(st.srs_hsk4_v1 || '{}')).length;
        } catch {}
        const dateStr = r.updated_at
          ? new Date(r.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          : '';
        return {
          code: String(r.email).toUpperCase(),
          name,
          lvl,
          wordsCount,
          dateStr
        };
      });

    return { ok: true, items };
  } catch (e) {
    return { ok: false, items: [] };
  }
}
