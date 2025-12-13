import { Preferences } from "@capacitor/preferences";

const HISTORY_KEY = "zenhydratation_history_v1";

/** dateKey = YYYY-MM-DD */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(k) {
  // k: YYYY-MM-DD
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, (m - 1), d);
}

function diffDays(a, b) {
  // a,b are Date (midnight local)
  const ms = 24 * 3600 * 1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aa - bb) / ms);
}

/**
 * Entry shape:
 * { dayKey, water, eyeBreaks, stretches, workTime }
 */
export async function loadHistory() {
  const { value } = await Preferences.get({ key: HISTORY_KEY });
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveHistory(entries) {
  await Preferences.set({ key: HISTORY_KEY, value: JSON.stringify(entries) });
}

export async function upsertTodayStats(todayStats, maxDays = 30) {
  const history = await loadHistory();
  const dk = todayStats.dayKey ?? dateKey();

  const idx = history.findIndex((e) => e.dayKey === dk);
  if (idx >= 0) history[idx] = { ...history[idx], ...todayStats, dayKey: dk };
  else history.push({ ...todayStats, dayKey: dk });

  history.sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));

  // garder seulement les N derniers jours
  const trimmed = history.slice(Math.max(0, history.length - maxDays));
  await saveHistory(trimmed);
  return trimmed;
}

export function getLastNDays(history, n) {
  const sorted = [...history].sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
  return sorted.slice(Math.max(0, sorted.length - n));
}

export function isActiveDay(entry) {
  return (entry.water ?? 0) > 0 || (entry.eyeBreaks ?? 0) > 0 || (entry.stretches ?? 0) > 0;
}

/** Streak = nb de jours consécutifs "actifs" en partant d’aujourd’hui */
export function computeStreak(history, today = new Date()) {
  const dkToday = dateKey(today);
  const map = new Map(history.map((e) => [e.dayKey, e]));

  let streak = 0;
  let cursor = parseDateKey(dkToday);

  while (true) {
    const dk = dateKey(cursor);
    const e = map.get(dk);
    if (!e || !isActiveDay(e)) break;
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return streak;
}
