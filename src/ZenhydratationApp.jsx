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
  Check,
  Sun,
  Moon
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
 * ==========================================================
 * ZenhydratationApp.jsx (Neo Glass)
 * - Web-first (Vercel OK), offline via localStorage
 * - No Capacitor imports (Android later)
 * - 4 modules: Hydratation, Yeux, Étirements, Réveil, Coucher
 * - Click an exercise => full-screen player (ring + timer)
 * - Real stats (no fake), history 7/30 days + streak auto
 * - Sound via WebAudio (works after a first user interaction)
 * ==========================================================
 */

/* =========================
 * Storage
 * ========================= */
const STORAGE_STATE_KEY = "zenhydratation_state_v3";
const STORAGE_HISTORY_KEY = "zenhydratation_history_v3";

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

/* =========================
 * Date helpers
 * ========================= */
function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, delta) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function isActiveDay(entry) {
  return (
    (entry.water ?? 0) > 0 ||
    (entry.eyeBreaks ?? 0) > 0 ||
    (entry.stretches ?? 0) > 0 ||
    (entry.wakeRoutines ?? 0) > 0 ||
    (entry.sleepRoutines ?? 0) > 0
  );
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

/* =========================
 * WebAudio (sound)
 * ========================= */
function playTone({ freq = 740, durationMs = 180, gain = 0.03 } = {}) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, durationMs);
  } catch {
    // ignore
  }
}

/* =========================
 * Neo Glass UI helpers
 * ========================= */
function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

const GLASS =
  "border border-white/10 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl";
const GLASS_SOFT =
  "border border-white/10 bg-white/[0.06] shadow-[0_18px_45px_rgba(0,0,0,0.30)] backdrop-blur-2xl";
const TEXT_PRIMARY = "text-white/90";
const TEXT_SECONDARY = "text-white/65";
const TEXT_MUTED = "text-white/50";

function ProgressRing({ pct, size = 56, stroke = 7, glowClass = "text-cyan-300" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          className={cn(glowClass)}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 rounded-full blur-2xl opacity-40 pointer-events-none">
        <div className={cn("absolute inset-0 rounded-full", glowClass.replace("text-", "bg-") + "/20")} />
      </div>
    </div>
  );
}

function GlassIconPlate({ children, glow = "cyan" }) {
  const glowMap = {
    cyan: "bg-cyan-400/20",
    violet: "bg-violet-500/20",
    emerald: "bg-emerald-500/20",
    amber: "bg-amber-500/20",
    indigo: "bg-indigo-500/20"
  };
  return (
    <div className="relative">
      <div className={cn("absolute inset-0 rounded-full blur-2xl", glowMap[glow] ?? glowMap.cyan)} />
      <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", GLASS_SOFT)}>
        {children}
      </div>
    </div>
  );
}

function GlassButton({ children, onClick, className, title, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-2xl px-4 py-3 transition hover:bg-white/[0.10] active:scale-[0.99]",
        GLASS_SOFT,
        className
      )}
    >
      {children}
    </button>
  );
}

/* =========================
 * Component
 * ========================= */
export default function ZenhydratationApp() {
  const [activeTab, setActiveTab] = useState("home");

  // settings
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200);
  const [stretchInterval, setStretchInterval] = useState(3600);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // timers / session
  const [waterCount, setWaterCount] = useState(0);
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);

  // modals
  const [showSettings, setShowSettings] = useState(false);
  const [showExercise, setShowExercise] = useState(null); // "eye"|"stretch"|"wake"|"sleep"|null
  const [showNotif, setShowNotif] = useState(null); // "eye"|"stretch"|null

  // player
  // { type, queue, index, remainingSec, startedAt, paused, pauseStartedAt, totalPausedMs }
  const [activeRoutine, setActiveRoutine] = useState(null);

  // history & stats
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [todayStats, setTodayStats] = useState({
    dayKey: dayKey(),
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    wakeRoutines: 0,
    sleepRoutines: 0,
    workTime: 0,
    details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
  });

  const saveDebounceRef = useRef(null);
  const lastDayRef = useRef(dayKey());

  const exercises = useMemo(
    () => ({
      eye: [
        { id: "eye-2020", name: "Règle 20-20-20", durationSec: 20, desc: "Regardez un objet à ~6 mètres pendant 20 secondes." },
        { id: "eye-blink", name: "Clignements", durationSec: 20, desc: "Clignez lentement des yeux (10 fois environ)." },
        { id: "eye-massage", name: "Massage des yeux", durationSec: 20, desc: "Fermez les yeux et massez doucement les tempes." }
      ],
      stretch: [
        { id: "st-neck", name: "Rotation du cou", durationSec: 30, desc: "Tournez lentement la tête de gauche à droite." },
        { id: "st-shoulders", name: "Étirement des épaules", durationSec: 30, desc: "Roulez vos épaules en arrière puis en avant." },
        { id: "st-arms", name: "Étirement des bras", durationSec: 30, desc: "Tendez les bras, entrelacez les doigts, étirez doucement." },
        { id: "st-back", name: "Flexion du dos", durationSec: 30, desc: "Penchez-vous vers l'avant doucement (sans douleur)." }
      ],
      wake: [
        { id: "wk-breath", name: "Respiration énergisante", durationSec: 60, desc: "Inspirez profondément par le nez, expirez lentement." },
        { id: "wk-mobility", name: "Mobilité douce", durationSec: 60, desc: "Bougez cou/épaules/hanches, amplitude confortable." },
        { id: "wk-posture", name: "Activation posturale", durationSec: 45, desc: "Redressez-vous, omoplates basses, respiration calme." }
      ],
      sleep: [
        { id: "sl-breath", name: "Respiration calmante", durationSec: 60, desc: "Inspirez 4s, expirez 6s. Relâchez les épaules." },
        { id: "sl-neck", name: "Détente nuque/épaules", durationSec: 45, desc: "Relâchez nuque/épaules, micro-rotations très lentes." },
        { id: "sl-scan", name: "Scan corporel", durationSec: 90, desc: "Parcourez le corps et relâchez progressivement." }
      ]
    }),
    []
  );

  const labelsById = useMemo(() => {
    const m = {};
    for (const k of ["eye", "stretch", "wake", "sleep"]) {
      for (const ex of exercises[k]) m[ex.id] = ex.name;
    }
    return m;
  }, [exercises]);

  /* =========================
   * Load
   * ========================= */
  useEffect(() => {
    const loadedHistory = readLS(STORAGE_HISTORY_KEY, []);
    const h = Array.isArray(loadedHistory) ? loadedHistory : [];
    setHistory(h);
    setStreak(computeStreak(h, new Date()));

    const s = readLS(STORAGE_STATE_KEY, null);
    if (!s) return;

    if (typeof s.waterGoal === "number") setWaterGoal(clampInt(s.waterGoal, 6, 12));
    if (typeof s.eyeBreakInterval === "number") setEyeBreakInterval(clampInt(s.eyeBreakInterval, 600, 7200));
    if (typeof s.stretchInterval === "number") setStretchInterval(clampInt(s.stretchInterval, 900, 10800));
    if (typeof s.soundEnabled === "boolean") setSoundEnabled(s.soundEnabled);

    const current = dayKey();
    if (s.todayStats?.dayKey === current) {
      setTodayStats({
        dayKey: current,
        water: clampInt(s.todayStats.water ?? 0, 0, 500),
        eyeBreaks: clampInt(s.todayStats.eyeBreaks ?? 0, 0, 500),
        stretches: clampInt(s.todayStats.stretches ?? 0, 0, 500),
        wakeRoutines: clampInt(s.todayStats.wakeRoutines ?? 0, 0, 500),
        sleepRoutines: clampInt(s.todayStats.sleepRoutines ?? 0, 0, 500),
        workTime: clampInt(s.todayStats.workTime ?? 0, 0, 24 * 3600),
        details: {
          eye: (s.todayStats.details?.eye && typeof s.todayStats.details.eye === "object") ? s.todayStats.details.eye : {},
          stretch: (s.todayStats.details?.stretch && typeof s.todayStats.details.stretch === "object") ? s.todayStats.details.stretch : {},
          wake: (s.todayStats.details?.wake && typeof s.todayStats.details.wake === "object") ? s.todayStats.details.wake : {},
          sleep: (s.todayStats.details?.sleep && typeof s.todayStats.details.sleep === "object") ? s.todayStats.details.sleep : {}
        }
      });
      setWaterCount(clampInt(s.waterCount ?? 0, 0, 200));
      setEyeBreakTimer(clampInt(s.eyeBreakTimer ?? eyeBreakInterval, 1, 7200));
      setStretchTimer(clampInt(s.stretchTimer ?? stretchInterval, 1, 10800));
      setIsPaused(!!s.isPaused);
    } else {
      setTodayStats({
        dayKey: current,
        water: 0,
        eyeBreaks: 0,
        stretches: 0,
        wakeRoutines: 0,
        sleepRoutines: 0,
        workTime: 0,
        details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
      });
      setWaterCount(0);
      setEyeBreakTimer(s.eyeBreakInterval ?? 1200);
      setStretchTimer(s.stretchInterval ?? 3600);
      setIsPaused(false);
    }
  }, []);

  /* =========================
   * Save (debounced)
   * ========================= */
  useEffect(() => {
    const payload = {
      waterGoal,
      eyeBreakInterval,
      stretchInterval,
      soundEnabled,
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
    waterCount,
    eyeBreakTimer,
    stretchTimer,
    isPaused,
    todayStats
  ]);

  /* =========================
   * Upsert today in history (max 30)
   * ========================= */
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

  /* =========================
   * Day rollover
   * ========================= */
  useEffect(() => {
    const id = setInterval(() => {
      const current = dayKey();
      if (lastDayRef.current !== current) {
        lastDayRef.current = current;
        setTodayStats({
          dayKey: current,
          water: 0,
          eyeBreaks: 0,
          stretches: 0,
          wakeRoutines: 0,
          sleepRoutines: 0,
          workTime: 0,
          details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
        });
        setWaterCount(0);
        setEyeBreakTimer(eyeBreakInterval);
        setStretchTimer(stretchInterval);
        setShowNotif(null);
        setShowExercise(null);
        setActiveRoutine(null);
        setIsPaused(false);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [eyeBreakInterval, stretchInterval]);

  /* =========================
   * Main timers
   * ========================= */
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

  const triggerNotification = (type) => {
    setShowNotif(type);
    if (soundEnabled) playTone({ freq: type === "eye" ? 880 : 660 });
    setTimeout(() => setShowNotif(null), 6000);
  };

  /* =========================
   * Hydration
   * ========================= */
  const addWater = () => {
    if (waterCount < waterGoal) {
      setWaterCount((v) => v + 1);
      setTodayStats((s) => ({ ...s, water: s.water + 1 }));
      if (soundEnabled) playTone({ freq: 740 });
    }
  };

  /* =========================
   * Quick “done” from notifs
   * ========================= */
  const completeEyeBreak = () => {
    setTodayStats((s) => ({ ...s, eyeBreaks: s.eyeBreaks + 1 }));
    setShowNotif(null);
    if (soundEnabled) playTone({ freq: 880 });
  };

  const completeStretch = () => {
    setTodayStats((s) => ({ ...s, stretches: s.stretches + 1 }));
    setShowNotif(null);
    if (soundEnabled) playTone({ freq: 660 });
  };

  /* =========================
   * Routine player (queue)
   * - when an exercise is selected: queue is that single exercise
   * - when a routine starts: queue is the routine list (3 steps)
   * ========================= */
  const startQueue = (type, queue, startIndex = 0) => {
    const now = Date.now();
    setActiveRoutine({
      type,
      queue,
      index: startIndex,
      remainingSec: queue[startIndex].durationSec,
      startedAt: now,
      paused: false,
      pauseStartedAt: null,
      totalPausedMs: 0
    });
  };

  const stopRoutine = () => setActiveRoutine(null);

  const toggleRoutinePause = () => {
    setActiveRoutine((r) => {
      if (!r) return r;
      if (!r.paused) {
        return { ...r, paused: true, pauseStartedAt: Date.now() };
      }
      const pausedMs = r.pauseStartedAt ? Date.now() - r.pauseStartedAt : 0;
      return { ...r, paused: false, pauseStartedAt: null, totalPausedMs: r.totalPausedMs + pausedMs };
    });
  };

  const skipStep = () => {
    setActiveRoutine((r) => {
      if (!r) return r;
      const nextIndex = r.index + 1;
      if (nextIndex >= r.queue.length) {
        // finishing early still counts as completed routine? We choose NO.
        return null;
      }
      return { ...r, index: nextIndex, remainingSec: r.queue[nextIndex].durationSec };
    });
  };

  const finishRoutineNow = () => {
    if (!activeRoutine) return;
    // credit one routine completion even if user terminates manually
    creditCompletion(activeRoutine.type, activeRoutine.queue[activeRoutine.index]?.id);
    setActiveRoutine(null);
  };

  const creditCompletion = (type, exIdOrNull) => {
    const totalKeyMap = {
      eye: "eyeBreaks",
      stretch: "stretches",
      wake: "wakeRoutines",
      sleep: "sleepRoutines"
    };

    setTodayStats((s) => {
      const totalKey = totalKeyMap[type];
      const details = s.details ?? { eye: {}, stretch: {}, wake: {}, sleep: {} };
      const nextDetails = { ...details };

      if (exIdOrNull) {
        const bucket = { ...(details[type] ?? {}) };
        bucket[exIdOrNull] = (bucket[exIdOrNull] ?? 0) + 1;
        nextDetails[type] = bucket;
      }

      return {
        ...s,
        [totalKey]: (s[totalKey] ?? 0) + 1,
        details: nextDetails
      };
    });

    if (soundEnabled) playTone({ freq: type === "sleep" ? 520 : 740, durationMs: 220 });
  };

  // routine ticking
  useEffect(() => {
    if (!activeRoutine) return;

    const id = setInterval(() => {
      setActiveRoutine((r) => {
        if (!r) return null;
        if (r.paused) return r;

        if (r.remainingSec <= 1) {
          const currentStep = r.queue[r.index];
          // for single-exercise sessions: count 1 for the module + detail
          // for multi-step routines: count 1 routine completion at the end (and detail per step)
          // Here: we always store detail per step, and only increment total on final step.
          // Additionally: for eye/stretch, if started from tiles (single exercise) queue length = 1 => end => total++.
          // For wake/sleep, queue length = 3 => end => total++ once.
          // Details: increment for each completed step.
          setTodayStats((s) => {
            const details = s.details ?? { eye: {}, stretch: {}, wake: {}, sleep: {} };
            const bucket = { ...(details[r.type] ?? {}) };
            if (currentStep?.id) bucket[currentStep.id] = (bucket[currentStep.id] ?? 0) + 1;

            return { ...s, details: { ...details, [r.type]: bucket } };
          });

          const nextIndex = r.index + 1;
          if (nextIndex < r.queue.length) {
            // next step
            if (soundEnabled) playTone({ freq: 600, durationMs: 120, gain: 0.02 });
            return { ...r, index: nextIndex, remainingSec: r.queue[nextIndex].durationSec };
          }

          // routine finished => credit total once
          creditCompletion(r.type, null);
          return null;
        }

        return { ...r, remainingSec: r.remainingSec - 1 };
      });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoutine, soundEnabled]);

  /* =========================
   * Formatting / derived
   * ========================= */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const hydrationPct = Math.round((waterCount / Math.max(1, waterGoal)) * 100);

  const nextHero = useMemo(() => {
    // hero prioritization: next eye vs stretch by time remaining
    const eyeSooner = eyeBreakTimer <= stretchTimer;
    const type = eyeSooner ? "eye" : "stretch";
    const label = type === "eye" ? "Pause yeux" : "Étirements";
    const time = type === "eye" ? formatTime(eyeBreakTimer) : formatTime(stretchTimer);
    const pct =
      type === "eye"
        ? ((eyeBreakInterval - eyeBreakTimer) / eyeBreakInterval) * 100
        : ((stretchInterval - stretchTimer) / stretchInterval) * 100;

    return { type, label, time, pct: Math.max(0, Math.min(100, pct)) };
  }, [eyeBreakTimer, stretchTimer, eyeBreakInterval, stretchInterval]);

  const themeGlow = (type) => {
    switch (type) {
      case "eye":
        return { glow: "violet", ring: "text-violet-300", icon: <Eye className="h-6 w-6 text-violet-200/90" /> };
      case "stretch":
        return { glow: "emerald", ring: "text-emerald-300", icon: <Activity className="h-6 w-6 text-emerald-200/90" /> };
      case "wake":
        return { glow: "amber", ring: "text-amber-300", icon: <Sun className="h-6 w-6 text-amber-200/90" /> };
      case "sleep":
        return { glow: "indigo", ring: "text-indigo-300", icon: <Moon className="h-6 w-6 text-indigo-200/90" /> };
      default:
        return { glow: "cyan", ring: "text-cyan-300", icon: <Eye className="h-6 w-6 text-cyan-200/90" /> };
    }
  };

  const lastNDays = (n) => {
    const sorted = [...history].sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
    return sorted.slice(Math.max(0, sorted.length - n));
  };

  const window7 = lastNDays(7);
  const window30 = lastNDays(30);

  const sum = (arr, k) => arr.reduce((acc, x) => acc + (x[k] ?? 0), 0);

  const chart7 = window7.map((d) => ({
    day: d.dayKey.slice(5),
    water: d.water ?? 0,
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0,
    wake: d.wakeRoutines ?? 0,
    sleep: d.sleepRoutines ?? 0
  }));

  const chart30 = window30.map((d) => ({
    day: d.dayKey.slice(5),
    water: d.water ?? 0,
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0,
    wake: d.wakeRoutines ?? 0,
    sleep: d.sleepRoutines ?? 0
  }));

  /* =========================
   * Screens
   * ========================= */
  const HomeScreen = () => {
    const heroTheme = themeGlow(nextHero.type);

    return (
      <div className="px-5 pb-24 pt-6">
        {/* Top header */}
        <div className="flex items-start justify-between">
          <div>
            <div className={cn("text-[34px] font-semibold tracking-tight leading-tight", TEXT_PRIMARY)}>
              Zenhydratation
            </div>
            <div className={cn("mt-1 text-[14px] font-medium", TEXT_MUTED)}>
              Focus. Respire. Hydrate.
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className={cn("rounded-2xl px-4 py-2", GLASS_SOFT)}>
                <span className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>🔥 Série</span>{" "}
                <span className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>{streak}j</span>
              </div>

              <div className={cn("rounded-2xl px-4 py-2", GLASS_SOFT)}>
                <span className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>Mode</span>{" "}
                <span className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>Offline</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className={cn("h-11 w-11 rounded-2xl flex items-center justify-center transition hover:bg-white/[0.10]", GLASS_SOFT)}
              aria-label="Paramètres"
            >
              <Settings className="h-5 w-5 text-white/75" />
            </button>

            <button
              onClick={() => setIsPaused((p) => !p)}
              className={cn("h-11 w-11 rounded-2xl flex items-center justify-center transition hover:bg-white/[0.10]", GLASS_SOFT)}
              title={isPaused ? "Reprendre" : "Pause"}
              aria-label={isPaused ? "Reprendre" : "Pause"}
            >
              {isPaused ? <Play className="h-5 w-5 text-white/85" /> : <Pause className="h-5 w-5 text-white/85" />}
            </button>
          </div>
        </div>

        {/* Hero “À faire maintenant” */}
        <div className={cn("mt-6 rounded-[28px] p-6", GLASS)}>
          <div className="flex items-center gap-5">
            <GlassIconPlate glow={heroTheme.glow}>{heroTheme.icon}</GlassIconPlate>

            <div className="flex-1 min-w-0">
              <div className={cn("text-[28px] font-semibold leading-none", TEXT_PRIMARY)}>
                {nextHero.label}
              </div>
              <div className={cn("mt-2 text-[18px] font-medium", TEXT_SECONDARY)}>
                Dans {nextHero.time}
              </div>
            </div>

            <ProgressRing pct={nextHero.pct} size={56} stroke={7} glowClass={heroTheme.ring} />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                // open list for that module
                setShowExercise(nextHero.type);
                if (soundEnabled) playTone({ freq: 520, gain: 0.02 });
              }}
              className={cn(
                "rounded-full px-10 py-3 text-[16px] font-semibold tracking-wide",
                "border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.06] hover:from-white/[0.14] hover:to-white/[0.08] transition",
                "shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
              )}
            >
              <span className={TEXT_PRIMARY}>DÉMARRER</span>
            </button>
          </div>
        </div>

        {/* Hydration */}
        <div className={cn("mt-6 rounded-[28px] p-6", GLASS)}>
          <div className="flex items-end justify-between">
            <div className={cn("text-[28px] font-semibold leading-none", TEXT_PRIMARY)}>
              Hydratation
            </div>
            <div className={cn("text-[16px] font-semibold", TEXT_SECONDARY)}>
              {waterCount} / {waterGoal} verres
            </div>
          </div>

          <div className="mt-5">
            <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-blue-400/70"
                style={{ width: `${Math.max(0, Math.min(100, hydrationPct))}%` }}
              />
            </div>

            <button
              onClick={addWater}
              className={cn("mt-5 w-full text-left text-[22px] font-medium hover:text-white/85 transition", TEXT_SECONDARY)}
            >
              Ajouter un verre
            </button>
          </div>
        </div>

        {/* Shortcuts tiles 2x2 */}
        <div className="mt-7">
          <div className={cn("text-[28px] font-semibold", TEXT_PRIMARY)}>Raccourcis</div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <ShortcutTile
              title="Yeux"
              subtitle={formatTime(eyeBreakTimer)}
              glow="violet"
              icon={<Eye className="h-6 w-6 text-violet-200/90" />}
              onClick={() => setShowExercise("eye")}
            />

            <ShortcutTile
              title="Étirements"
              subtitle={formatTime(stretchTimer)}
              glow="emerald"
              icon={<Activity className="h-6 w-6 text-emerald-200/90" />}
              onClick={() => setShowExercise("stretch")}
            />

            <ShortcutTile
              title="Réveil"
              subtitle={`${exercises.wake.length} étapes`}
              glow="amber"
              icon={<Sun className="h-6 w-6 text-amber-200/90" />}
              onClick={() => startQueue("wake", exercises.wake)}
            />

            <ShortcutTile
              title="Coucher"
              subtitle={`${exercises.sleep.length} étapes`}
              glow="indigo"
              icon={<Moon className="h-6 w-6 text-indigo-200/90" />}
              onClick={() => startQueue("sleep", exercises.sleep)}
            />
          </div>
        </div>

        {/* Today line */}
        <div className={cn("mt-7 text-[14px] leading-snug", TEXT_MUTED)}>
          Aujourd&apos;hui: Eau {todayStats.water} | Yeux {todayStats.eyeBreaks} | Étirements {todayStats.stretches}
          <br />
          Réveil {todayStats.wakeRoutines} | Coucher {todayStats.sleepRoutines}
        </div>
      </div>
    );
  };

  const StatsScreen = () => {
    const workH = Math.floor(todayStats.workTime / 3600);
    const workM = Math.floor((todayStats.workTime % 3600) / 60);

    const renderDetail = (groupKey, title) => {
      const entries = Object.entries(todayStats.details?.[groupKey] ?? {});
      return (
        <div className={cn("rounded-[24px] p-5", GLASS_SOFT)}>
          <div className={cn("text-[16px] font-semibold", TEXT_PRIMARY)}>{title}</div>
          {entries.length === 0 ? (
            <div className={cn("mt-2 text-[13px]", TEXT_MUTED)}>Aucune donnée.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {entries.map(([id, count]) => (
                <div key={id} className="flex items-center justify-between">
                  <div className={cn("text-[13px] font-medium", TEXT_SECONDARY)}>{labelsById[id] ?? id}</div>
                  <div className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="px-5 pb-24 pt-6 space-y-6">
        <div className="flex items-end justify-between">
          <div className={cn("text-[28px] font-semibold", TEXT_PRIMARY)}>Statistiques</div>
          <div className={cn("rounded-2xl px-4 py-2", GLASS_SOFT)}>
            <span className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>🔥 {streak}j</span>
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", GLASS)}>
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-white/80" />
            <div>
              <div className={cn("text-[13px] font-semibold", TEXT_MUTED)}>Temps de travail aujourd&apos;hui</div>
              <div className={cn("text-[26px] font-semibold", TEXT_PRIMARY)}>{workH}h {workM}m</div>
            </div>
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", GLASS)}>
          <div className="flex items-center justify-between">
            <div className={cn("text-[16px] font-semibold", TEXT_PRIMARY)}>Résumé 7 jours</div>
            <div className={cn("text-[13px] font-semibold", TEXT_MUTED)}>
              Eau {sum(window7, "water")} · Yeux {sum(window7, "eyeBreaks")} · Étire {sum(window7, "stretches")}
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 260 }}>
            {chart7.length === 0 ? (
              <div className={cn("text-[13px]", TEXT_MUTED)}>Aucune donnée pour l’instant.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart7}>
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10, 12, 18, 0.92)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      color: "rgba(255,255,255,0.9)"
                    }}
                  />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
                  <Bar dataKey="water" name="Eau" fill="rgba(34, 211, 238, 0.60)" />
                  <Bar dataKey="eye" name="Yeux" fill="rgba(167, 139, 250, 0.60)" />
                  <Bar dataKey="stretch" name="Étirements" fill="rgba(52, 211, 153, 0.60)" />
                  <Bar dataKey="wake" name="Réveil" fill="rgba(251, 191, 36, 0.60)" />
                  <Bar dataKey="sleep" name="Coucher" fill="rgba(129, 140, 248, 0.60)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", GLASS)}>
          <div className="flex items-center justify-between">
            <div className={cn("text-[16px] font-semibold", TEXT_PRIMARY)}>Graphique 30 jours</div>
            <div className={cn("text-[13px] font-semibold", TEXT_MUTED)}>
              Total routines: {sum(window30, "wakeRoutines") + sum(window30, "sleepRoutines")}
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 260 }}>
            {chart30.length === 0 ? (
              <div className={cn("text-[13px]", TEXT_MUTED)}>Aucune donnée sur 30 jours.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart30}>
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10, 12, 18, 0.92)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      color: "rgba(255,255,255,0.9)"
                    }}
                  />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
                  <Bar dataKey="water" name="Eau" fill="rgba(34, 211, 238, 0.55)" />
                  <Bar dataKey="eye" name="Yeux" fill="rgba(167, 139, 250, 0.55)" />
                  <Bar dataKey="stretch" name="Étirements" fill="rgba(52, 211, 153, 0.55)" />
                  <Bar dataKey="wake" name="Réveil" fill="rgba(251, 191, 36, 0.55)" />
                  <Bar dataKey="sleep" name="Coucher" fill="rgba(129, 140, 248, 0.55)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {renderDetail("eye", "Détails aujourd’hui — Yeux")}
          {renderDetail("stretch", "Détails aujourd’hui — Étirements")}
          {renderDetail("wake", "Détails aujourd’hui — Réveil")}
          {renderDetail("sleep", "Détails aujourd’hui — Coucher")}
        </div>
      </div>
    );
  };

  /* =========================
   * Exercise selection modal
   * - click an exercise -> play only that exercise (queue length 1)
   * - for wake/sleep, also offer a “Démarrer la routine” CTA
   * ========================= */
  const ExerciseModal = () => {
    if (!showExercise) return null;

    const list = exercises[showExercise] ?? [];
    const theme = themeGlow(showExercise);
    const title =
      showExercise === "eye"
        ? "👁️ Exercices Yeux"
        : showExercise === "stretch"
          ? "🤸 Étirements"
          : showExercise === "wake"
            ? "🌅 Routine Réveil"
            : "🌙 Routine Coucher";

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/55" onClick={() => setShowExercise(null)} />
        <div className="absolute inset-x-0 bottom-0">
          <div className={cn("mx-auto max-w-md rounded-t-[32px] p-6", GLASS, "border-b-0")}>
            <div className="flex items-center justify-between">
              <div className={cn("text-[18px] font-semibold", TEXT_PRIMARY)}>{title}</div>
              <button
                onClick={() => setShowExercise(null)}
                className={cn("h-10 w-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.10] transition", GLASS_SOFT)}
              >
                <X className="h-5 w-5 text-white/75" />
              </button>
            </div>

            {showExercise === "wake" || showExercise === "sleep" ? (
              <div className="mt-4">
                <button
                  onClick={() => {
                    startQueue(showExercise, list);
                    setShowExercise(null);
                    if (soundEnabled) playTone({ freq: showExercise === "wake" ? 740 : 520, durationMs: 200 });
                  }}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3 font-semibold text-[15px] transition",
                    "border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.06] hover:from-white/[0.14] hover:to-white/[0.08]"
                  )}
                >
                  <span className={TEXT_PRIMARY}>Démarrer la routine complète</span>
                </button>
              </div>
            ) : null}

            <div className="mt-4 space-y-3 max-h-[52vh] overflow-y-auto pr-1">
              {list.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    startQueue(showExercise, [ex], 0);
                    setShowExercise(null);
                    if (soundEnabled) playTone({ freq: 600, durationMs: 120, gain: 0.02 });
                  }}
                  className={cn(
                    "w-full text-left rounded-[22px] p-4 transition hover:bg-white/[0.10] active:scale-[0.99]",
                    GLASS_SOFT
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn("text-[15px] font-semibold truncate", TEXT_PRIMARY)}>{ex.name}</div>
                      <div className={cn("mt-1 text-[13px] leading-snug", TEXT_MUTED)}>{ex.desc}</div>
                    </div>
                    <div className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold", "bg-white/10 border border-white/10")}>
                      <span className={TEXT_SECONDARY}>{ex.durationSec}s</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className={cn("text-[12px] font-semibold", TEXT_MUTED)}>Démarrer</div>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", theme.ring.replace("text-", "bg-") + "/70")} />
                      <div className={cn("text-[12px] font-semibold", TEXT_MUTED)}>
                        {showExercise === "eye"
                          ? "Yeux"
                          : showExercise === "stretch"
                            ? "Étirements"
                            : showExercise === "wake"
                              ? "Réveil"
                              : "Coucher"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* =========================
   * Routine player overlay (Neo Glass)
   * ========================= */
  const RoutinePlayer = () => {
    if (!activeRoutine) return null;

    const step = activeRoutine.queue[activeRoutine.index];
    const totalSteps = activeRoutine.queue.length;
    const stepNo = activeRoutine.index + 1;

    const t = themeGlow(activeRoutine.type);
    const pct = step ? ((step.durationSec - activeRoutine.remainingSec) / step.durationSec) * 100 : 0;

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className={cn("w-full max-w-md rounded-[32px] p-6", GLASS)}>
            <div className="flex items-start justify-between">
              <div>
                <div className={cn("text-[16px] font-semibold", TEXT_PRIMARY)}>
                  {activeRoutine.type === "eye"
                    ? "Pause yeux"
                    : activeRoutine.type === "stretch"
                      ? "Étirements"
                      : activeRoutine.type === "wake"
                        ? "Routine Réveil"
                        : "Routine Coucher"}
                </div>
                <div className={cn("mt-1 text-[13px] font-semibold", TEXT_MUTED)}>
                  Étape {stepNo}/{totalSteps}
                </div>
              </div>
              <button
                onClick={stopRoutine}
                className={cn("h-10 w-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.10] transition", GLASS_SOFT)}
                aria-label="Fermer"
              >
                <X className="h-5 w-5 text-white/75" />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="relative">
                <div className={cn("absolute inset-0 rounded-full blur-3xl opacity-60", t.ring.replace("text-", "bg-") + "/20")} />
                <ProgressRing pct={pct} size={160} stroke={10} glowClass={t.ring} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={cn("text-[44px] font-semibold leading-none", TEXT_PRIMARY)}>
                    {activeRoutine.remainingSec}s
                  </div>
                  <div className={cn("mt-2 text-[13px] font-semibold", TEXT_MUTED)}>
                    {activeRoutine.paused ? "En pause" : "En cours"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className={cn("text-[18px] font-semibold", TEXT_PRIMARY)}>
                {step?.name ?? "Exercice"}
              </div>
              <div className={cn("mt-2 text-[13px] leading-snug", TEXT_SECONDARY)}>
                {step?.desc ?? ""}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <GlassButton
                onClick={toggleRoutinePause}
                className="text-center"
                title={activeRoutine.paused ? "Reprendre" : "Pause"}
              >
                <div className="flex items-center justify-center gap-2">
                  {activeRoutine.paused ? <Play className="h-4 w-4 text-white/85" /> : <Pause className="h-4 w-4 text-white/85" />}
                  <span className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>
                    {activeRoutine.paused ? "Reprendre" : "Pause"}
                  </span>
                </div>
              </GlassButton>

              <GlassButton onClick={skipStep} className="text-center" title="Passer">
                <div className="flex items-center justify-center gap-2">
                  <span className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>Passer</span>
                </div>
              </GlassButton>

              <GlassButton onClick={finishRoutineNow} className="text-center" title="Terminer">
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-white/85" />
                  <span className={cn("text-[13px] font-semibold", TEXT_PRIMARY)}>Terminer</span>
                </div>
              </GlassButton>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* =========================
   * Notifications cards (glass)
   * ========================= */
  const NotifCard = ({ type }) => {
    const title = type === "eye" ? "Pause yeux" : "Étirements";
    const subtitle = type === "eye" ? "Reposez vos yeux 20 secondes" : "Bougez pendant 2 minutes";
    const text = type === "eye" ? "Regardez au loin (~6 mètres)." : "Levez-vous et étirez-vous.";
    const t = themeGlow(type);

    return (
      <div className="absolute top-4 left-4 right-4 z-50">
        <div className={cn("rounded-[24px] p-5", GLASS)}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <GlassIconPlate glow={t.glow}>{t.icon}</GlassIconPlate>
              <div>
                <div className={cn("text-[15px] font-semibold", TEXT_PRIMARY)}>{title}</div>
                <div className={cn("mt-1 text-[13px]", TEXT_MUTED)}>{subtitle}</div>
              </div>
            </div>
            <button
              onClick={() => setShowNotif(null)}
              className={cn("h-10 w-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.10] transition", GLASS_SOFT)}
            >
              <X className="h-5 w-5 text-white/75" />
            </button>
          </div>

          <div className={cn("mt-3 text-[13px]", TEXT_SECONDARY)}>{text}</div>

          <button
            onClick={type === "eye" ? completeEyeBreak : completeStretch}
            className={cn(
              "mt-4 w-full rounded-2xl px-4 py-3 font-semibold text-[14px] transition",
              "border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.06] hover:from-white/[0.16] hover:to-white/[0.08]"
            )}
          >
            <span className={TEXT_PRIMARY}>C’est fait</span>
          </button>
        </div>
      </div>
    );
  };

  /* =========================
   * Render
   * ========================= */
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#070A12]">
      {/* Background gradient + ambient blobs */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#070A12] via-[#0B1022] to-[#1A0B2E]" />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-48 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-8 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* In-app Notifs */}
        {showNotif === "eye" && <NotifCard type="eye" />}
        {showNotif === "stretch" && <NotifCard type="stretch" />}

        {/* Main content */}
        {activeTab === "home" && <HomeScreen />}
        {activeTab === "stats" && <StatsScreen />}

        {/* Bottom nav (glass) */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 pb-5">
          <div className={cn("rounded-[26px] px-6 py-4 flex items-center justify-around", GLASS)}>
            <button
              onClick={() => setActiveTab("home")}
              className={cn(
                "flex flex-col items-center gap-1 transition",
                activeTab === "home" ? "text-white/90" : "text-white/55"
              )}
            >
              <Home className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Accueil</span>
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={cn(
                "flex flex-col items-center gap-1 transition",
                activeTab === "stats" ? "text-white/90" : "text-white/55"
              )}
            >
              <TrendingUp className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Stats</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className={cn("flex flex-col items-center gap-1 transition", "text-white/55 hover:text-white/80")}
            >
              <Settings className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Réglages</span>
            </button>
          </div>
        </div>

        {/* Exercise selection modal */}
        <ExerciseModal />

        {/* Routine player */}
        <RoutinePlayer />

        {/* Settings modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/55" onClick={() => setShowSettings(false)} />
            <div className="absolute inset-x-0 bottom-0">
              <div className={cn("mx-auto max-w-md rounded-t-[32px] p-6", GLASS, "border-b-0")}>
                <div className="flex items-center justify-between">
                  <div className={cn("text-[18px] font-semibold", TEXT_PRIMARY)}>Paramètres</div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className={cn("h-10 w-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.10] transition", GLASS_SOFT)}
                  >
                    <X className="h-5 w-5 text-white/75" />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className={cn("rounded-[22px] p-4", GLASS_SOFT)}>
                    <div className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>Objectif hydratation</div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min="6"
                        max="12"
                        value={waterGoal}
                        onChange={(e) => {
                          setWaterGoal(Number(e.target.value));
                          if (soundEnabled) playTone({ freq: 600, gain: 0.02 });
                        }}
                        className="w-full"
                      />
                      <div className={cn("min-w-[52px] text-right text-[13px] font-semibold", TEXT_PRIMARY)}>
                        {waterGoal}
                      </div>
                    </div>
                    <div className={cn("mt-2 text-[12px]", TEXT_MUTED)}>verres par jour</div>
                  </div>

                  <div className={cn("rounded-[22px] p-4", GLASS_SOFT)}>
                    <div className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>Fréquence pauses yeux</div>
                    <select
                      className={cn(
                        "mt-3 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold",
                        "bg-black/30 border border-white/10 text-white/85"
                      )}
                      value={eyeBreakInterval}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setEyeBreakInterval(v);
                        setEyeBreakTimer((t) => Math.min(t, v));
                        if (soundEnabled) playTone({ freq: 880, gain: 0.02 });
                      }}
                    >
                      <option value="1200">Toutes les 20 minutes</option>
                      <option value="1800">Toutes les 30 minutes</option>
                      <option value="2400">Toutes les 40 minutes</option>
                    </select>
                  </div>

                  <div className={cn("rounded-[22px] p-4", GLASS_SOFT)}>
                    <div className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>Fréquence étirements</div>
                    <select
                      className={cn(
                        "mt-3 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold",
                        "bg-black/30 border border-white/10 text-white/85"
                      )}
                      value={stretchInterval}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setStretchInterval(v);
                        setStretchTimer((t) => Math.min(t, v));
                        if (soundEnabled) playTone({ freq: 660, gain: 0.02 });
                      }}
                    >
                      <option value="2400">Toutes les 40 minutes</option>
                      <option value="3600">Toutes les 60 minutes</option>
                      <option value="5400">Toutes les 90 minutes</option>
                    </select>
                  </div>

                  <div className={cn("rounded-[22px] p-4 flex items-center justify-between", GLASS_SOFT)}>
                    <div>
                      <div className={cn("text-[13px] font-semibold", TEXT_SECONDARY)}>Sons</div>
                      <div className={cn("mt-1 text-[12px]", TEXT_MUTED)}>
                        Fonctionne après une interaction utilisateur (règle navigateur).
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-white"
                      checked={soundEnabled}
                      onChange={(e) => {
                        setSoundEnabled(e.target.checked);
                        playTone({ freq: e.target.checked ? 740 : 520, gain: 0.02 });
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className={cn(
                    "mt-5 w-full rounded-2xl px-4 py-3 font-semibold text-[14px] transition",
                    "border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.06] hover:from-white/[0.16] hover:to-white/[0.08]"
                  )}
                >
                  <span className={TEXT_PRIMARY}>Fermer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
 * Shortcut tile (Neo Glass)
 * ========================= */
function ShortcutTile({ title, subtitle, icon, glow = "cyan", onClick }) {
  const glowMap = {
    cyan: "bg-cyan-400/20",
    violet: "bg-violet-500/20",
    emerald: "bg-emerald-500/20",
    amber: "bg-amber-500/20",
    indigo: "bg-indigo-500/20"
  };

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[24px] border border-white/10 bg-white/[0.07] shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-2xl p-4 text-left hover:bg-white/[0.10] transition active:scale-[0.99]"
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={cn("absolute inset-0 rounded-full blur-2xl", glowMap[glow] ?? glowMap.cyan)} />
          <div className="h-11 w-11 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl flex items-center justify-center">
            {icon}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-white/90 text-[16px] font-semibold leading-tight truncate">{title}</div>
          <div className="mt-1 text-white/60 text-[13px] font-semibold leading-none truncate">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}
