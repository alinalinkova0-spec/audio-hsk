import { safeStorage } from './storage.js';
const KEY = 'srs_hsk4_v1';

export function loadSRS() {
  try { return JSON.parse(safeStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
export function saveSRS(s) {
  safeStorage.setItem(KEY, JSON.stringify(s));
}
export function review(state, id, grade) {
  const s = state[id] || { ef: 2.5, interval: 0, reps: 0, due: 0 };
  if (grade === 0) { s.reps = 0; s.interval = 1; }
  else {
    s.reps += 1;
    s.ef = Math.max(1.3, s.ef + (0.1 - (3 - grade) * 0.08));
    s.interval = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round(s.interval * s.ef);
  }
  s.due = Date.now() + s.interval * 86400000;
  state[id] = s;
  return state;
}
export function dueItems(state, allIds) {
  const now = Date.now();
  return allIds.filter(id => !state[id] || state[id].due <= now);
}
