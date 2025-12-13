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
 * Web-safe offline storage
 * (Vercel OK / offline OK)
 * =========================
 */
const STORAGE_STATE_KEY = "zenhydratation_state_v1";
const STORAGE_HISTORY_KEY = "zenhydratation_history_v1";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function readLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (!v) return fallback;
  return safeParse(v, fallback);
}

function writeLS(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/**
 * =========================
 * Date helpers
 * =========================
 */
function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

function addDays(d, delta) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function isActiveDay(entry) {
  return (entry.water ?? 0) > 0 || (entry.eyeBreaks ?? 0) > 0 || (entry.stretches ?? 0) > 0;
}

function computeStreak(history, today = new Date()) {
  const map = new Map(history.map((e) => [e.dayKey, e]));
  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (true) {
    const dk = dayKey(cursor);
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
 * Component
 * =========================
 */
export default function ZenhydratationApp() {
  const [activeTab, setActiveTab] = useState("home");

  // Settings (réels, modifiables)
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200); // 20 min
  const [stretchInterval, setStretchInterval] = useState(3600); // 60 min
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // State
  const [waterCount, setWaterCount] = useState(0);
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);

  const [showNotif, setShowNotif] = useState(null); // "eye" | "stretch" | null
  const [showExercise, setShowExercise] = useState(null); // "eye" | "stretch" | null
  const [showSettings, setShowSettings] = useState(false);

  // Session d'exercices réelle
  // { type: "eye"|"stretch", index: number, remaining: number }
  const [activeExercise, setActiveExercise] = useState(null);

  // Historique & streak (zéro fictif)
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);

  // Stats du jour (zéro fictif)
  const [todayStats, setTodayStats] = useState({
    dayKey: dayKey(),
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    workTime: 0
  });

  const saveDebounceRef = useRef(null);
  const lastDayRef = useRef(dayKey());

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
   * Load state + history (offline web)
   * =========================
   */
  useEffect(() => {
    const loadedHistory = readLS(STORAGE_HISTORY_KEY, []);
    setHistory(Array.isArray(loadedHistory) ? loadedHistory : []);
    setStreak(computeStreak(Array.isArray(loadedHistory) ? loadedHistory : [], new Date()));

    const s = readLS(STORAGE_STATE_KEY, null);
    if (!s) return;

    // settings
    if (typeof s.waterGoal === "number") setWaterGoal(clampInt(s.waterGoal, 6, 12));
    if (typeof s.eyeBreakInterval === "number") setEyeBreakInterval(clampInt(s.eyeBreakInterval, 600, 7200));
    if (typeof s.stretchInterval === "number") setStretchInterval(clampInt(s.stretchInterval, 900, 10800));
    if (typeof s.soundEnabled === "boolean") setSoundEnabled(s.soundEnabled);
    if (typeof s.darkMode === "boolean") setDarkMode(s.darkMode);

    // restore only if same day (sinon on repart à 0)
    const current = dayKey();
    if (s.todayStats?.dayKey === current) {
      setTodayStats({
        dayKey: current,
        water: clampInt(s.todayStats.water ?? 0, 0, 500),
        eyeBreaks: clampInt(s.todayStats.eyeBreaks ?? 0, 0, 500),
        stretches: clampInt(s.todayStats.stretches ?? 0, 0, 500),
        workTime: clampInt(s.todayStats.workTime ?? 0, 0, 24 * 3600)
      });
      setWaterCount(clampInt(s.waterCount ?? 0, 0, 200));
      setEyeBreakTimer(clampInt(s.eyeBreakTimer ?? 1200, 1, 7200));
      setStretchTimer(clampInt(s.stretchTimer ?? 3600, 1, 10800));
      setIsPaused(!!s.isPaused);
    } else {
      // nouveau jour : timers reset aux intervalles
      setTodayStats({ dayKey: current, water: 0, eyeBreaks: 0, stretches: 0, workTime: 0 });
      setWaterCount(0);
      setEyeBreakTimer(s.eyeBreakInterval ?? 1200);
      setStretchTimer(s.stretchInterval ?? 3600);
      setIsPaused(false);
    }
  }, []);

  /**
   * =========================
   * Save state (debounced)
   * =========================
   */
  useEffect(() => {
    const payload = {
      waterGoal,
      eyeBreakInterval,
      stretchInterval,
      soundEnabled,
      darkMode,
      waterCount,
      eyeBreakTimer,
      stretchTimer,
      isPaused,
      todayStats
    };

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      writeLS(STORAGE_STATE_KEY, payload);
    }, 250);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [
    waterGoal,
    eyeBreakInterval,
    stretchInterval,
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
   * Upsert today into history (max 30)
   * =========================
   */
  useEffect(() => {
    const current = todayStats.dayKey;
    setHistory((prev) => {
      const without = prev.filter((e) => e.dayKey !== current);
      const next = [...without, todayStats].sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
      const trimmed = next.slice(Math.max(0, next.length - 30));
      writeLS(STORAGE_HISTORY_KEY, trimmed);
      setStreak(computeStreak(trimmed, new Date()));
      return trimmed;
    });
  }, [todayStats]);

  /**
   * =========================
   * Rollover day if app stays open
   * =========================
   */
  useEffect(() => {
    const id = setInterval(() => {
      const current = dayKey();
      if (lastDayRef.current !== current) {
        lastDayRef.current = current;
        setTodayStats({ dayKey: current, water: 0, eyeBreaks: 0, stretches: 0, workTime: 0 });
        setWaterCount(0);
        setEyeBreakTimer(eyeBreakInterval);
        setStretchTimer(stretchInterval);
        setShowNotif(null);
        setShowExercise(null);
        setActiveExercise(null);
        setIsPaused(false);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [eyeBreakInterval, stretchInterval]);

  /**
   * =========================
   * Main timers
   * =========================
   */
  useEffect(() => {
    if (isPaused) return;

    const id = setInterval(() => {
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

      setTodayStats((s) => ({ ...s, workTime: s.workTime + 1 }));
    }, 1000);

    return () => clearInterval(id);
  }, [isPaused, eyeBreakInterval, stretchInterval]);

  function playBeep(type) {
    if (!soundEnabled) return;
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

  const triggerNotification = (type) => {
    setShowNotif(type);
    playBeep(type);
    setTimeout(() => setShowNotif(null), 6000);
  };

  /**
   * =========================
   * Exercise runner (real)
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
            return { type: prev.type, index: nextIndex, remaining: list[nextIndex].durationSec };
          }

          // Finished => credit ONE session (not per exercise)
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
   * Actions
   * =========================
   */
  const addWater = () => {
    if (waterCount < waterGoal) {
      setWaterCount((v) => v + 1);
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  /**
   * =========================
   * Stats computations (no fake)
   * =========================
   */
  const lastNDays = (n) => {
    const sorted = [...history].sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
    return sorted.slice(Math.max(0, sorted.length - n));
  };

  const window7 = lastNDays(7);
  const window30 = lastNDays(30);

  const sum = (arr, k) => arr.reduce((acc, x) => acc + (x[k] ?? 0), 0);

  const chart7 = window7.map((d) => ({
    day: d.dayKey.slice(5), // MM-DD
    water: d.water ?? 0,
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0
  }));

  const chart30 = window30.map((d) => ({
    day: d.dayKey.slice(5),
    water: d.water ?? 0,
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0
  }));

  /**
   * =========================
   * Screens
   * =========================
   */
  const HomeScreen = () => (
    <div className="p-6 space-y-6">
      {/* Header */}
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
            title={isPaused ? "Reprendre" : "Pause"}
          >
            {isPaused ? <Play size={20} className="text-white" /> : <Pause size={20} className={darkMode ? "text-gray-100" : "text-gray-700"} />}
          </button>
        </div>
      </div>

      {/* Streak (calculated) */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div>
            <p className="text-sm opacity-90">Série en cours</p>
            <p className="text-2xl font-bold">{streak} jour{streak > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-90">Basé sur l’historique</p>
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
          <RowStat icon={<Droplets size={20} className="text-blue-600" />} label="Eau bue" value={`${todayStats.water} verre${todayStats.water > 1 ? "s" : ""}`} darkMode={darkMode} />
          <RowStat icon={<Eye size={20} className="text-purple-600" />} label="Pauses yeux" value={`${todayStats.eyeBreaks}`} darkMode={darkMode} />
          <RowStat icon={<Activity size={20} className="text-green-600" />} label="Étirements" value={`${todayStats.stretches}`} darkMode={darkMode} />
        </div>
      </div>
    </div>
  );

  const StatsScreen = () => {
    const workH = Math.floor(todayStats.workTime / 3600);
    const workM = Math.floor((todayStats.workTime % 3600) / 60);

    const w7 = window7.length ? window7 : [];
    const w30 = window30.length ? window30 : [];

    return (
      <div className="p-6 space-y-6">
        <h1 className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Statistiques</h1>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg">
          <Clock size={28} className="mb-3" />
          <p className="text-sm opacity-90 mb-1">Temps de travail aujourd'hui</p>
          <p className="text-3xl font-bold">{workH}h {workM}m</p>
        </div>

        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
          <h3 className={`font-semibold mb-3 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Résumé 7 jours</h3>
          <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"} grid grid-cols-3 gap-3`}>
            <div><span className="font-semibold">{sum(w7, "water")}</span><div>Eau</div></div>
            <div><span className="font-semibold">{sum(w7, "eyeBreaks")}</span><div>Yeux</div></div>
            <div><span className="font-semibold">{sum(w7, "stretches")}</span><div>Étirements</div></div>
          </div>
        </div>

        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Graphique 7 jours</h3>
          {chart7.length === 0 ? (
            <p className={darkMode ? "text-gray-300 text-sm" : "text-gray-600 text-sm"}>
              Aucune donnée pour l’instant (tout commence à 0).
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={chart7}>
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
          )}
        </div>

        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Graphique 30 jours</h3>
          {chart30.length === 0 ? (
            <p className={darkMode ? "text-gray-300 text-sm" : "text-gray-600 text-sm"}>
              Aucune donnée sur 30 jours pour l’instant.
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={chart30}>
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
          )}
        </div>
      </div>
    );
  };

  /**
   * =========================
   * Render
   * =========================
   */
  return (
    <div className={`${darkMode ? "bg-gray-900" : "bg-gray-50"} max-w-md mx-auto min-h-screen relative`}>
      {/* In-app Notifications */}
      {showNotif === "eye" && (
        <NotifCard
          icon={<Eye size={24} className="text-purple-600" />}
          title="Temps de repos !"
          subtitle="Reposez vos yeux 20 secondes"
          text="Regardez au loin (6 mètres) pendant 20 secondes"
          color="purple"
          onClose={() => setShowNotif(null)}
          onDone={completeEyeBreak}
        />
      )}

      {showNotif === "stretch" && (
        <NotifCard
          icon={<Activity size={24} className="text-green-600" />}
          title="Temps de bouger !"
          subtitle="Faites des étirements"
          text="Levez-vous et étirez-vous pendant 2 minutes"
          color="green"
          onClose={() => setShowNotif(null)}
          onDone={completeStretch}
        />
      )}

      {/* Exercise list modal */}
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
                setActiveExercise({ type: showExercise, index: 0, remaining: list[0].durationSec });
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
                  const list = exercises[activeExercise.type];
                  const nextIndex = activeExercise.index + 1;
                  if (nextIndex < list.length) {
                    setActiveExercise({
                      type: activeExercise.type,
                      index: nextIndex,
                      remaining: list[nextIndex].durationSec
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

              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Notifications sonores</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>Bip discret en web</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              </div>

              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Mode sombre</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>Interface en mode nuit</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
              </div>
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

/**
 * =========================
 * Small UI helpers
 * =========================
 */
function RowStat({ icon, label, value, darkMode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          {icon}
        </div>
        <span className={darkMode ? "text-gray-200" : "text-gray-700"}>{label}</span>
      </div>
      <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}

function NotifCard({ icon, title, subtitle, text, color, onClose, onDone }) {
  const border =
    color === "purple" ? "border-purple-500" : color === "green" ? "border-green-500" : "border-gray-300";
  const btn =
    color === "purple" ? "bg-purple-500 hover:bg-purple-600" : color === "green" ? "bg-green-500 hover:bg-green-600" : "bg-gray-600 hover:bg-gray-700";

  return (
    <div className={`absolute top-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-5 border-l-4 ${border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
        <button onClick={onClose}>
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-3">{text}</p>

      <button
        onClick={onDone}
        className={`w-full ${btn} text-white py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2`}
      >
        <Check size={18} />
        C'est fait !
      </button>
    </div>
  );
}
