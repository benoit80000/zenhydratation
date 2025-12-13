import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Droplets,
  Eye,
  Activity,
  Clock,
  Settings,
  Home,
  TrendingUp,
  X,
  Play,
  Pause,
  Check
} from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import {
  ensureNotificationPermission,
  cancelReminders,
  scheduleNextReminders
} from "./platform/notifications";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

/**
 * =========================
 * Storage keys
 * =========================
 */
const STATE_KEY = "zenhydratation_state_v2";
const HISTORY_KEY = "zenhydratation_history_v1";

/**
 * =========================
 * Date helpers
 * =========================
 */
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

function parseDateKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, delta) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function isSameDayKey(a, b) {
  return a === b;
}

function isActiveDay(entry) {
  return (
    (entry.water ?? 0) > 0 ||
    (entry.eyeBreaks ?? 0) > 0 ||
    (entry.stretches ?? 0) > 0
  );
}

/**
 * Streak = nombre de jours consécutifs "actifs" en partant d’aujourd’hui.
 */
function computeStreak(history, today = new Date()) {
  const dkToday = dateKey(today);
  const map = new Map(history.map((e) => [e.dayKey, e]));
  let streak = 0;
  let cursor = parseDateKey(dkToday);

  while (true) {
    const dk = dateKey(cursor);
    const e = map.get(dk);
    if (!e || !isActiveDay(e)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function clampInt(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

/**
 * =========================
 * History storage
 * =========================
 */
async function loadHistory() {
  const { value } = await Preferences.get({ key: HISTORY_KEY });
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveHistory(entries) {
  await Preferences.set({ key: HISTORY_KEY, value: JSON.stringify(entries) });
}

async function upsertHistoryDay(todayStats, maxDays = 30) {
  const history = await loadHistory();
  const dk = todayStats.dayKey;

  const idx = history.findIndex((e) => e.dayKey === dk);
  if (idx >= 0) history[idx] = { ...history[idx], ...todayStats };
  else history.push({ ...todayStats });

  history.sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
  const trimmed = history.slice(Math.max(0, history.length - maxDays));
  await saveHistory(trimmed);
  return trimmed;
}

function getLastNDays(history, n) {
  const sorted = [...history].sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
  return sorted.slice(Math.max(0, sorted.length - n));
}

/**
 * =========================
 * Local notifications
 * =========================
 */
async function ensureNotificationPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}

async function cancelReminders() {
  // Cancel by IDs (stable)
  await LocalNotifications.cancel({
    notifications: [{ id: 1001 }, { id: 1002 }]
  });
}

/**
 * Schedule next reminders based on remaining timers.
 * Notes:
 * - Android may delay notifications due to battery optimizations.
 * - This schedules only the next occurrence; when the app is opened,
 *   we will re-schedule again based on current timers.
 */
async function scheduleNextReminders({
  enabled,
  eyeSeconds,
  stretchSeconds
}) {
  await cancelReminders();
  if (!enabled) return;

  const now = Date.now();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title: "Zenhydratation",
        body: "Pause yeux : 20 secondes (règle 20-20-20).",
        schedule: { at: new Date(now + Math.max(5, eyeSeconds) * 1000) }
      },
      {
        id: 1002,
        title: "Zenhydratation",
        body: "Étirements : levez-vous et bougez 2 minutes.",
        schedule: { at: new Date(now + Math.max(5, stretchSeconds) * 1000) }
      }
    ]
  });
}

/**
 * =========================
 * Optional tiny beep (offline)
 * =========================
 */
function playBeep(type = "eye") {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = type === "eye" ? 880 : 660;
    g.gain.value = 0.02;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 200);
  } catch {
    // ignore
  }
}

/**
 * =========================
 * Main component
 * =========================
 */
export default function ZenhydratationApp() {
  const [activeTab, setActiveTab] = useState("home");

  // Settings (start from real defaults, not fictive stats)
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200);
  const [stretchInterval, setStretchInterval] = useState(3600);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // State
  const [waterCount, setWaterCount] = useState(0);
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);

  const [showNotif, setShowNotif] = useState(null); // 'eye' | 'stretch' | null
  const [showExercise, setShowExercise] = useState(null); // 'eye' | 'stretch' | null
  const [showSettings, setShowSettings] = useState(false);

  // Exercise session (when user clicks "Commencer", we actually run something)
  // { type, index, remaining }
  const [activeExercise, setActiveExercise] = useState(null);

  // History & computed streak
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);

  // Today stats (start from 0, always)
  const [todayStats, setTodayStats] = useState({
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    workTime: 0,
    dayKey: dateKey()
  });

  const saveDebounceRef = useRef(null);

  const exercises = useMemo(
    () => ({
      stretch: [
        { name: "Rotation du cou", durationSec: 30, desc: "Tournez lentement la tête de gauche à droite" },
        { name: "Étirement des épaules", durationSec: 30, desc: "Roulez vos épaules en arrière puis en avant" },
        { name: "Étirement des bras", durationSec: 30, desc: "Tendez les bras devant vous, entrelacez les doigts" },
        { name: "Flexion du dos", durationSec: 30, desc: "Debout, penchez-vous vers l'avant doucement" }
      ],
      eye: [
        { name: "Règle 20-20-20", durationSec: 20, desc: "Regardez un objet à 6 mètres pendant 20 secondes" },
        { name: "Clignements", durationSec: 20, desc: "Clignez des yeux 10 fois lentement" },
        { name: "Massage des yeux", durationSec: 20, desc: "Fermez les yeux et massez doucement les tempes" }
      ]
    }),
    []
  );

  /**
   * =========================
   * Load: app state + history
   * =========================
   */
  useEffect(() => {
    (async () => {
      // Load history first
      const h = await loadHistory();
      setHistory(h);
      setStreak(computeStreak(h, new Date()));

      // Load state (settings + timers)
      const { value } = await Preferences.get({ key: STATE_KEY });
      if (value) {
        try {
          const s = JSON.parse(value);

          // Settings
          if (typeof s.waterGoal === "number") setWaterGoal(clampInt(s.waterGoal, 6, 12));
          if (typeof s.eyeBreakInterval === "number") setEyeBreakInterval(clampInt(s.eyeBreakInterval, 600, 7200));
          if (typeof s.stretchInterval === "number") setStretchInterval(clampInt(s.stretchInterval, 900, 10800));
          if (typeof s.notificationsEnabled === "boolean") setNotificationsEnabled(s.notificationsEnabled);
          if (typeof s.soundEnabled === "boolean") setSoundEnabled(s.soundEnabled);
          if (typeof s.darkMode === "boolean") setDarkMode(s.darkMode);

          // Timers & pause state
          if (typeof s.eyeBreakTimer === "number") setEyeBreakTimer(clampInt(s.eyeBreakTimer, 1, 7200));
          if (typeof s.stretchTimer === "number") setStretchTimer(clampInt(s.stretchTimer, 1, 10800));
          if (typeof s.isPaused === "boolean") setIsPaused(s.isPaused);

          // Today stats: if same day, restore, else keep 0 for new day
          if (s.todayStats && typeof s.todayStats === "object") {
            const current = dateKey();
            if (isSameDayKey(s.todayStats.dayKey, current)) {
              setTodayStats({
                water: clampInt(s.todayStats.water ?? 0, 0, 200),
                eyeBreaks: clampInt(s.todayStats.eyeBreaks ?? 0, 0, 500),
                stretches: clampInt(s.todayStats.stretches ?? 0, 0, 500),
                workTime: clampInt(s.todayStats.workTime ?? 0, 0, 24 * 3600),
                dayKey: current
              });
              setWaterCount(clampInt(s.waterCount ?? 0, 0, 50));
            } else {
              // New day: keep everything at 0
              setTodayStats({ water: 0, eyeBreaks: 0, stretches: 0, workTime: 0, dayKey: current });
              setWaterCount(0);
              // reset timers to interval defaults
              setEyeBreakTimer(s.eyeBreakInterval ?? 1200);
              setStretchTimer(s.stretchInterval ?? 3600);
            }
          } else {
            // No stats saved: start from 0
            const current = dateKey();
            setTodayStats({ water: 0, eyeBreaks: 0, stretches: 0, workTime: 0, dayKey: current });
            setWaterCount(0);
          }
        } catch {
          // ignore parse errors, keep defaults
        }
      }

      // Notifications permission (best effort)
      try {
        await ensureNotificationPermission();
      } catch {
        // ignore
      }
    })();
  }, []);

  /**
   * =========================
   * Persist state (debounced)
   * =========================
   */
  useEffect(() => {
    const payload = {
      waterGoal,
      eyeBreakInterval,
      stretchInterval,
      notificationsEnabled,
      soundEnabled,
      darkMode,
      waterCount,
      eyeBreakTimer,
      stretchTimer,
      isPaused,
      todayStats
    };

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      await Preferences.set({ key: STATE_KEY, value: JSON.stringify(payload) });
    }, 250);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [
    waterGoal,
    eyeBreakInterval,
    stretchInterval,
    notificationsEnabled,
    soundEnabled,
    darkMode,
    waterCount,
    eyeBreakTimer,
    stretchTimer,
    isPaused,
    todayStats
  ]);

  /**
   * =========================
   * Update history + streak when todayStats changes
   * =========================
   */
  useEffect(() => {
    (async () => {
      const updated = await upsertHistoryDay(todayStats, 30);
      setHistory(updated);
      setStreak(computeStreak(updated, new Date()));
    })();
  }, [todayStats]);

  /**
   * =========================
   * Day rollover (if app stays open past midnight)
   * =========================
   */
  useEffect(() => {
    const id = setInterval(() => {
      setTodayStats((prev) => {
        const current = dateKey();
        if (prev.dayKey === current) return prev;
        // New day => reset daily stats & counters (start from 0)
        return { water: 0, eyeBreaks: 0, stretches: 0, workTime: 0, dayKey: current };
      });
      setWaterCount((prev) => {
        // If day rolled, todayStats effect will run; but we also reset waterCount here
        // only when dayKey changed, so we infer by comparing to stored dayKey in closure is hard.
        // We'll do a conservative reset if dateKey changed from last check using a ref.
        return prev; // handled below with a ref-based approach
      });
    }, 30_000);

    return () => clearInterval(id);
  }, []);

  // Ref-based day rollover to reset waterCount + timers
  const lastDayRef = useRef(dateKey());
  useEffect(() => {
    const id = setInterval(() => {
      const current = dateKey();
      if (lastDayRef.current !== current) {
        lastDayRef.current = current;
        setWaterCount(0);
        setEyeBreakTimer(eyeBreakInterval);
        setStretchTimer(stretchInterval);
        setShowNotif(null);
        setShowExercise(null);
        setActiveExercise(null);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [eyeBreakInterval, stretchInterval]);

  /**
   * =========================
   * Main timers (work time + reminders)
   * =========================
   */
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setEyeBreakTimer((prev) => {
        if (prev <= 1) {
          triggerNotification("eye");
          return eyeBreakInterval;
        }
        return prev - 1;
      });

      setStretchTimer((prev) => {
        if (prev <= 1) {
          triggerNotification("stretch");
          return stretchInterval;
        }
        return prev - 1;
      });

      setTodayStats((prev) => ({ ...prev, workTime: prev.workTime + 1 }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, eyeBreakInterval, stretchInterval]);

  const triggerNotification = (type) => {
    setShowNotif(type);
    if (soundEnabled) playBeep(type);
    setTimeout(() => setShowNotif(null), 5000);
  };

  /**
   * =========================
   * Background notifications scheduling
   * =========================
   */
  useEffect(() => {
    (async () => {
      try {
        await ensureNotificationPermission();
        await scheduleNextReminders({
          enabled: notificationsEnabled && !isPaused,
          eyeSeconds: eyeBreakTimer,
          stretchSeconds: stretchTimer
        });
      } catch {
        // ignore
      }
    })();
  }, [notificationsEnabled, isPaused, eyeBreakTimer, stretchTimer]);

  /**
   * =========================
   * Exercise session timer (when user clicked "Commencer")
   * =========================
   */
  useEffect(() => {
    if (!activeExercise) return;

    const id = setInterval(() => {
      setActiveExercise((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          const list = exercises[prev.type];
          const nextIndex = prev.index + 1;

          if (nextIndex < list.length) {
            return {
              type: prev.type,
              index: nextIndex,
              remaining: list[nextIndex].durationSec ?? 20
            };
          }

          // Finished all exercises
          if (prev.type === "eye") {
            setTodayStats((s) => ({ ...s, eyeBreaks: s.eyeBreaks + 1 }));
          } else {
            setTodayStats((s) => ({ ...s, stretches: s.stretches + 1 }));
          }

          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [activeExercise, exercises]);

  /**
   * =========================
   * UI helpers
   * =========================
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const addWater = () => {
    if (waterCount < waterGoal) {
      setWaterCount((c) => c + 1);
      setTodayStats((s) => ({ ...s, water: s.water + 1 }));
    }
  };

  const completeEyeBreak = () => {
    setTodayStats((s) => ({ ...s, eyeBreaks: s.eyeBreaks + 1 }));
    setShowNotif(null);
  };

  const completeStretch = () => {
    setTodayStats((s) => ({ ...s, stretches: s.stretches + 1 }));
    setShowNotif(null);
  };

  // Charts (7/30)
  const [historyWindow, setHistoryWindow] = useState(7);
  const chartData = useMemo(() => {
    const last = getLastNDays(history, historyWindow);
    return last.map((d) => ({
      day: d.dayKey.slice(5), // MM-DD
      water: d.water ?? 0,
      eye: d.eyeBreaks ?? 0,
      stretch: d.stretches ?? 0
    }));
  }, [history, historyWindow]);

  /**
   * =========================
   * Screens
   * =========================
   */
  const HomeScreen = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
            Zenhydratation
          </h1>
          <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            Hydratation, pauses yeux et étirements en télétravail
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className={`p-3 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"} transition-colors`}
          >
            <Settings size={20} className={darkMode ? "text-gray-200" : "text-gray-700"} />
          </button>
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`p-3 rounded-full ${isPaused ? "bg-green-500" : darkMode ? "bg-gray-600" : "bg-gray-300"} transition-colors`}
          >
            {isPaused ? (
              <Play size={20} className="text-white" />
            ) : (
              <Pause size={20} className={darkMode ? "text-gray-100" : "text-gray-700"} />
            )}
          </button>
        </div>
      </div>

      {/* Streak (auto, start from 0) */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div>
            <p className="text-sm opacity-90">Série en cours</p>
            <p className="text-2xl font-bold">{streak} jour{streak > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-90">Basé sur votre activité</p>
          <p className="text-sm font-semibold">Offline</p>
        </div>
      </div>

      {/* Hydratation */}
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Droplets size={24} />
            <h2 className="text-lg font-semibold">Hydratation</h2>
          </div>
          <span className="text-sm opacity-90">{waterCount}/{waterGoal} verres</span>
        </div>

        <div className="flex gap-2 mb-4">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div
              key={i}
              className={`h-10 flex-1 rounded-lg ${i < waterCount ? "bg-white" : "bg-white/20"} transition-all`}
            />
          ))}
        </div>

        <button
          onClick={addWater}
          className="w-full bg-white text-blue-600 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
        >
          + J'ai bu un verre
        </button>
      </div>

      {/* Timers */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowExercise("eye")}
          className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl p-5 text-white shadow-lg text-left hover:scale-105 transition-transform"
        >
          <Eye size={28} className="mb-3" />
          <p className="text-xs mb-2 opacity-90">Pause yeux dans</p>
          <p className="text-2xl font-bold mb-3">{formatTime(eyeBreakTimer)}</p>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${((eyeBreakInterval - eyeBreakTimer) / eyeBreakInterval) * 100}%` }}
            />
          </div>
        </button>

        <button
          onClick={() => setShowExercise("stretch")}
          className="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-5 text-white shadow-lg text-left hover:scale-105 transition-transform"
        >
          <Activity size={28} className="mb-3" />
          <p className="text-xs mb-2 opacity-90">Étirement dans</p>
          <p className="text-2xl font-bold mb-3">{formatTime(stretchTimer)}</p>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${((stretchInterval - stretchTimer) / stretchInterval) * 100}%` }}
            />
          </div>
        </button>
      </div>

      {/* Today stats */}
      <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Aujourd'hui</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Droplets size={20} className="text-blue-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Eau bue</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
              {todayStats.water} verre{todayStats.water > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Eye size={20} className="text-purple-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Pauses yeux</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
              {todayStats.eyeBreaks}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Activity size={20} className="text-green-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Étirements</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
              {todayStats.stretches}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const StatsScreen = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Statistiques</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setHistoryWindow(7)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold ${
              historyWindow === 7
                ? "bg-blue-600 text-white"
                : darkMode
                ? "bg-gray-700 text-gray-200"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setHistoryWindow(30)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold ${
              historyWindow === 30
                ? "bg-blue-600 text-white"
                : darkMode
                ? "bg-gray-700 text-gray-200"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            30 jours
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg">
        <Clock size={28} className="mb-3" />
        <p className="text-sm opacity-90 mb-1">Temps de travail aujourd'hui</p>
        <p className="text-3xl font-bold">
          {Math.floor(todayStats.workTime / 3600)}h{" "}
          {Math.floor((todayStats.workTime % 3600) / 60)}m
        </p>
      </div>

      <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
          Historique ({historyWindow} jours)
        </h3>

        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="water" name="Eau" />
              <Bar dataKey="eye" name="Pauses yeux" />
              <Bar dataKey="stretch" name="Étirements" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {chartData.length === 0 && (
          <p className={darkMode ? "text-gray-300 text-sm mt-3" : "text-gray-600 text-sm mt-3"}>
            Aucune donnée pour l’instant. Tout commence à 0.
          </p>
        )}
      </div>
    </div>
  );

  /**
   * =========================
   * Render
   * =========================
   */
  return (
    <div className={`${darkMode ? "bg-gray-900" : "bg-gray-50"} max-w-md mx-auto min-h-screen relative`}>
      {/* Notifications in-app */}
      {showNotif === "eye" && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-5 border-l-4 border-purple-500">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Eye size={24} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Temps de repos !</h3>
                <p className="text-sm text-gray-600">Reposez vos yeux 20 secondes</p>
              </div>
            </div>
            <button onClick={() => setShowNotif(null)}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Regardez au loin (6 mètres) pendant 20 secondes
          </p>

          <button
            onClick={completeEyeBreak}
            className="w-full bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={18} />
            C'est fait !
          </button>
        </div>
      )}

      {showNotif === "stretch" && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-5 border-l-4 border-green-500">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Activity size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Temps de bouger !</h3>
                <p className="text-sm text-gray-600">Faites des étirements</p>
              </div>
            </div>
            <button onClick={() => setShowNotif(null)}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Levez-vous et étirez-vous pendant 2 minutes
          </p>

          <button
            onClick={completeStretch}
            className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={18} />
            C'est fait !
          </button>
        </div>
      )}

      {/* Exercise picker modal */}
      {showExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowExercise(null)}>
          <div
            className={`${darkMode ? "bg-gray-900 text-gray-100" : "bg-white"} rounded-t-3xl w-full max-w-md mx-auto p-6 max-h-[80vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {showExercise === "eye" ? "Exercices pour les yeux" : "Exercices d'étirement"}
              </h3>
              <button onClick={() => setShowExercise(null)}>
                <X size={24} className={darkMode ? "text-gray-300" : "text-gray-400"} />
              </button>
            </div>

            <div className="space-y-3">
              {exercises[showExercise].map((exercise, i) => (
                <div key={i} className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"} rounded-xl p-4 border`}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{exercise.name}</h4>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                      {exercise.durationSec}s
                    </span>
                  </div>
                  <p className={darkMode ? "text-gray-300 text-sm" : "text-gray-600 text-sm"}>{exercise.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const list = exercises[showExercise];
                setActiveExercise({
                  type: showExercise,
                  index: 0,
                  remaining: list[0].durationSec ?? 20
                });
                setShowExercise(null);
              }}
              className={`w-full mt-4 py-3 rounded-xl font-semibold text-white ${
                showExercise === "eye" ? "bg-purple-500 hover:bg-purple-600" : "bg-green-500 hover:bg-green-600"
              } transition-colors`}
            >
              Commencer
            </button>
          </div>
        </div>
      )}

      {/* Active exercise fullscreen */}
      {activeExercise && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 text-center space-y-4">
            <h2 className="text-xl font-bold">
              {exercises[activeExercise.type][activeExercise.index].name}
            </h2>

            <p className="text-gray-600">
              {exercises[activeExercise.type][activeExercise.index].desc}
            </p>

            <div className="text-5xl font-bold text-blue-600">
              {activeExercise.remaining}s
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveExercise(null)}
                className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold"
              >
                Arrêter
              </button>

              <button
                onClick={() => {
                  // skip to next immediately
                  const list = exercises[activeExercise.type];
                  const nextIndex = activeExercise.index + 1;
                  if (nextIndex < list.length) {
                    setActiveExercise({
                      type: activeExercise.type,
                      index: nextIndex,
                      remaining: list[nextIndex].durationSec ?? 20
                    });
                  } else {
                    // finish
                    if (activeExercise.type === "eye") {
                      setTodayStats((s) => ({ ...s, eyeBreaks: s.eyeBreaks + 1 }));
                    } else {
                      setTodayStats((s) => ({ ...s, stretches: s.stretches + 1 }));
                    }
                    setActiveExercise(null);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowSettings(false)}>
          <div
            className={`${darkMode ? "bg-gray-900 text-gray-100" : "bg-white"} rounded-t-3xl w-full max-w-md mx-auto p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Paramètres</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={24} className={darkMode ? "text-gray-300" : "text-gray-400"} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Water goal */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4`}>
                <label className="block text-sm font-semibold mb-2">Objectif d'hydratation</label>
                <input
                  type="range"
                  min="6"
                  max="12"
                  value={waterGoal}
                  onChange={(e) => setWaterGoal(Number(e.target.value))}
                  className="w-full"
                />
                <p className={darkMode ? "text-gray-300 text-xs mt-1" : "text-gray-500 text-xs mt-1"}>
                  {waterGoal} verres par jour
                </p>
              </div>

              {/* Eye frequency */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4`}>
                <label className="block text-sm font-semibold mb-2">Fréquence pauses yeux</label>
                <select
                  className={`w-full p-2 border rounded-lg ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}
                  value={eyeBreakInterval}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEyeBreakInterval(v);
                    setEyeBreakTimer((t) => Math.min(t, v));
                  }}
                >
                  <option value="1200">Toutes les 20 minutes</option>
                  <option value="1800">Toutes les 30 minutes</option>
                  <option value="2400">Toutes les 40 minutes</option>
                </select>
              </div>

              {/* Stretch frequency */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4`}>
                <label className="block text-sm font-semibold mb-2">Fréquence étirements</label>
                <select
                  className={`w-full p-2 border rounded-lg ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}
                  value={stretchInterval}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStretchInterval(v);
                    setStretchTimer((t) => Math.min(t, v));
                  }}
                >
                  <option value="2400">Toutes les 40 minutes</option>
                  <option value="3600">Toutes les 60 minutes</option>
                  <option value="5400">Toutes les 90 minutes</option>
                </select>
              </div>

              {/* Notifications background */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Notifications Android</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>
                    Alertes en arrière-plan
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={notificationsEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    setNotificationsEnabled(enabled);
                    try {
                      await ensureNotificationPermission();
                      if (!enabled) await cancelReminders();
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>

              {/* Sound */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Son</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>
                    Bip discret (si possible)
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              </div>

              {/* Dark mode */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Mode sombre</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>
                    Interface en mode nuit
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
              </div>

              <p className={darkMode ? "text-gray-400 text-xs" : "text-gray-500 text-xs"}>
                Conseil : si Android “tue” l’app en arrière-plan, autorisez l’activité en arrière-plan dans les
                paramètres batterie pour des notifications plus fiables.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="pb-20">
        {activeTab === "home" && <HomeScreen />}
        {activeTab === "stats" && <StatsScreen />}
      </div>

      {/* Bottom nav */}
      <div className={`${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"} fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t px-6 py-4`}>
        <div className="flex justify-around items-center">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === "home" ? "text-blue-600" : darkMode ? "text-gray-400" : "text-gray-400"
            }`}
          >
            <Home size={24} />
            <span className="text-xs font-medium">Accueil</span>
          </button>

          <button
            onClick={() => setActiveTab("stats")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === "stats" ? "text-blue-600" : darkMode ? "text-gray-400" : "text-gray-400"
            }`}
          >
            <TrendingUp size={24} />
            <span className="text-xs font-medium">Stats</span>
          </button>
        </div>
      </div>
    </div>
  );
}
