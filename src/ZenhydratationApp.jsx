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
 * ZenhydratationApp.jsx (Vercel-safe)
 * - 3 thèmes : neo (Neo Glass), classic, wellness
 * - Réglages via onglet Réglages (bottom nav) : pas de bouton settings en haut
 * - Offline: localStorage (historique 30j)
 * - Hydratation: ml (source de vérité), verres avec remplissage progressif
 * - Appui long sur un verre = annuler (retirer une dose)
 * - Bulles optionnelles
 * - Avatar homme/femme + énergie (fatigue) qui s’améliore avec hydratation + routines
 * - Home: Tuiles uniformes (ordre: Énergie, Hydratation, Yeux, Étirements, Réveil, Coucher)
 * ==========================================================
 */

/* =========================
 * Storage
 * ========================= */
const STORAGE_STATE_KEY = "zenhydratation_state_v5";
const STORAGE_HISTORY_KEY = "zenhydratation_history_v5";

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
    (entry.waterMl ?? 0) > 0 ||
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
 * Utils / UI helpers
 * ========================= */
function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* =========================
 * Themes
 * ========================= */
const THEMES = {
  neo: {
    id: "neo",
    label: "Neo Glass",
    bgRoot: "bg-[#070A12]",
    bgLayer: (
      <>
        <div className="fixed inset-0 bg-gradient-to-b from-[#070A12] via-[#0B1022] to-[#1A0B2E]" />
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute top-48 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
      </>
    ),
    textPrimary: "text-white/90",
    textSecondary: "text-white/65",
    textMuted: "text-white/50",
    card: "border border-white/10 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
    cardSoft: "border border-white/10 bg-white/[0.06] shadow-[0_18px_45px_rgba(0,0,0,0.30)] backdrop-blur-2xl",
    nav: "border border-white/10 bg-white/[0.07] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
    modalBackdrop: "bg-black/55",
    surfaceInput: "bg-black/30 border border-white/10 text-white/85",
    tooltip: {
      background: "rgba(10, 12, 18, 0.92)",
      border: "1px solid rgba(255,255,255,0.10)",
      color: "rgba(255,255,255,0.9)"
    }
  },

  classic: {
    id: "classic",
    label: "Classique",
    bgRoot: "bg-gray-50",
    bgLayer: (
      <>
        <div className="fixed inset-0 bg-gradient-to-b from-gray-50 via-gray-50 to-gray-100" />
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="absolute top-48 -right-24 h-96 w-96 rounded-full bg-purple-300/20 blur-3xl" />
        </div>
      </>
    ),
    textPrimary: "text-gray-900",
    textSecondary: "text-gray-700",
    textMuted: "text-gray-500",
    card: "border border-gray-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
    cardSoft: "border border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
    nav: "border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.10)]",
    modalBackdrop: "bg-black/40",
    surfaceInput: "bg-white border border-gray-200 text-gray-900",
    tooltip: {
      background: "rgba(255,255,255,0.98)",
      border: "1px solid rgba(0,0,0,0.08)",
      color: "rgba(17,24,39,0.95)"
    }
  },

  wellness: {
    id: "wellness",
    label: "Soft Wellness",
    bgRoot: "bg-[#F7FAFF]",
    bgLayer: (
      <>
        <div className="fixed inset-0 bg-gradient-to-b from-[#F7FAFF] via-[#F7FAFF] to-[#EEF6FF]" />
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute -top-28 -left-28 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="absolute top-40 -right-28 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-96 w-96 rounded-full bg-amber-300/15 blur-3xl" />
        </div>
      </>
    ),
    textPrimary: "text-slate-900",
    textSecondary: "text-slate-700",
    textMuted: "text-slate-500",
    card:
      "border border-white/70 bg-white/70 shadow-[0_14px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl",
    cardSoft:
      "border border-white/70 bg-white/60 shadow-[0_12px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl",
    nav:
      "border border-white/70 bg-white/70 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl",
    modalBackdrop: "bg-black/35",
    surfaceInput: "bg-white/90 border border-white/80 text-slate-900",
    tooltip: {
      background: "rgba(255,255,255,0.98)",
      border: "1px solid rgba(15,23,42,0.10)",
      color: "rgba(15,23,42,0.92)"
    }
  }
};

/* =========================
 * Visual helpers
 * ========================= */
function ProgressRing({ pct, size = 56, stroke = 7, glowClass = "text-cyan-300", theme }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  const isGlass = theme?.id === "neo";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isGlass ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"}
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
    </div>
  );
}

function GlassIconPlate({ children, glow = "cyan", theme }) {
  const glowMap = {
    cyan: "bg-cyan-400/20",
    violet: "bg-violet-500/20",
    emerald: "bg-emerald-500/20",
    amber: "bg-amber-500/20",
    indigo: "bg-indigo-500/20"
  };

  const plate =
    theme.id === "neo"
      ? theme.cardSoft
      : theme.id === "wellness"
        ? theme.cardSoft
        : "border border-gray-200 bg-white shadow-[0_8px_22px_rgba(0,0,0,0.06)]";

  return (
    <div className="relative">
      <div className={cn("absolute inset-0 rounded-full blur-2xl", glowMap[glow] ?? glowMap.cyan)} />
      <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", plate)}>
        {children}
      </div>
    </div>
  );
}

function SurfaceButton({ children, onClick, className, title, theme, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-2xl px-4 py-3 transition active:scale-[0.99]",
        theme.cardSoft,
        theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]",
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

  // theme (persisted)
  const [themeId, setThemeId] = useState("neo");
  const theme = THEMES[themeId] ?? THEMES.neo;

  // settings (timers)
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200);
  const [stretchInterval, setStretchInterval] = useState(3600);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // NEW: hydration as ml
  const [cupMl, setCupMl] = useState(250);
  const [dailyGoalMl, setDailyGoalMl] = useState(2000);
  const [waterMl, setWaterMl] = useState(0);

  // NEW: avatar + bubbles
  const [avatar, setAvatar] = useState("female"); // "female" | "male"
  const [bubblesEnabled, setBubblesEnabled] = useState(true);

  // timers
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);

  // modals
  const [showSettings, setShowSettings] = useState(false);
  const [showExercise, setShowExercise] = useState(null); // "eye"|"stretch"|"wake"|"sleep"|null
  const [showNotif, setShowNotif] = useState(null); // "eye"|"stretch"|null

  // routine player
  const [activeRoutine, setActiveRoutine] = useState(null);

  // history & stats
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [todayStats, setTodayStats] = useState({
    dayKey: dayKey(),
    waterMl: 0,
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
        {
          id: "eye-2020",
          name: "Règle 20-20-20",
          durationSec: 20,
          desc: "Regardez un objet à ~6 mètres pendant 20 secondes."
        },
        {
          id: "eye-blink",
          name: "Clignements",
          durationSec: 20,
          desc: "Clignez lentement des yeux (10 fois environ)."
        },
        {
          id: "eye-massage",
          name: "Massage des yeux",
          durationSec: 20,
          desc: "Fermez les yeux et massez doucement les tempes."
        }
      ],
      stretch: [
        {
          id: "st-neck",
          name: "Rotation du cou",
          durationSec: 30,
          desc: "Tournez lentement la tête de gauche à droite."
        },
        {
          id: "st-shoulders",
          name: "Étirement des épaules",
          durationSec: 30,
          desc: "Roulez vos épaules en arrière puis en avant."
        },
        {
          id: "st-arms",
          name: "Étirement des bras",
          durationSec: 30,
          desc: "Tendez les bras, entrelacez les doigts, étirez doucement."
        },
        {
          id: "st-back",
          name: "Flexion du dos",
          durationSec: 30,
          desc: "Penchez-vous vers l'avant doucement (sans douleur)."
        }
      ],
      wake: [
        {
          id: "wk-breath",
          name: "Respiration énergisante",
          durationSec: 60,
          desc: "Inspirez profondément par le nez, expirez lentement."
        },
        {
          id: "wk-mobility",
          name: "Mobilité douce",
          durationSec: 60,
          desc: "Bougez cou/épaules/hanches, amplitude confortable."
        },
        {
          id: "wk-posture",
          name: "Activation posturale",
          durationSec: 45,
          desc: "Redressez-vous, omoplates basses, respiration calme."
        }
      ],
      sleep: [
        {
          id: "sl-breath",
          name: "Respiration calmante",
          durationSec: 60,
          desc: "Inspirez 4s, expirez 6s. Relâchez les épaules."
        },
        {
          id: "sl-neck",
          name: "Détente nuque/épaules",
          durationSec: 45,
          desc: "Relâchez nuque/épaules, micro-rotations très lentes."
        },
        {
          id: "sl-scan",
          name: "Scan corporel",
          durationSec: 90,
          desc: "Parcourez le corps et relâchez progressivement."
        }
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

    if (typeof s.themeId === "string" && THEMES[s.themeId]) setThemeId(s.themeId);

    if (typeof s.eyeBreakInterval === "number") setEyeBreakInterval(clampInt(s.eyeBreakInterval, 600, 7200));
    if (typeof s.stretchInterval === "number") setStretchInterval(clampInt(s.stretchInterval, 900, 10800));
    if (typeof s.soundEnabled === "boolean") setSoundEnabled(s.soundEnabled);

    if (typeof s.cupMl === "number") setCupMl(clampInt(s.cupMl, 150, 600));
    if (typeof s.dailyGoalMl === "number") setDailyGoalMl(clampInt(s.dailyGoalMl, 1200, 4000));
    if (typeof s.avatar === "string") setAvatar(s.avatar === "male" ? "male" : "female");
    if (typeof s.bubblesEnabled === "boolean") setBubblesEnabled(s.bubblesEnabled);

    const current = dayKey();
    if (s.todayStats?.dayKey === current) {
      setTodayStats({
        dayKey: current,
        waterMl: clampInt(s.todayStats.waterMl ?? 0, 0, 50_000),
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

      if (typeof s.waterMl === "number") setWaterMl(clampInt(s.waterMl, 0, 50_000));
      else setWaterMl(clampInt(s.todayStats?.waterMl ?? 0, 0, 50_000));

      setEyeBreakTimer(clampInt(s.eyeBreakTimer ?? eyeBreakInterval, 1, 7200));
      setStretchTimer(clampInt(s.stretchTimer ?? stretchInterval, 1, 10800));
      setIsPaused(!!s.isPaused);
    } else {
      setTodayStats({
        dayKey: current,
        waterMl: 0,
        eyeBreaks: 0,
        stretches: 0,
        wakeRoutines: 0,
        sleepRoutines: 0,
        workTime: 0,
        details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
      });
      setWaterMl(0);
      setEyeBreakTimer(s.eyeBreakInterval ?? 1200);
      setStretchTimer(s.stretchInterval ?? 3600);
      setIsPaused(false);
    }
  }, []);

  /* =========================
   * Save
   * ========================= */
  useEffect(() => {
    const payload = {
      themeId,
      eyeBreakInterval,
      stretchInterval,
      soundEnabled,
      cupMl,
      dailyGoalMl,
      waterMl,
      avatar,
      bubblesEnabled,
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
    themeId,
    eyeBreakInterval,
    stretchInterval,
    soundEnabled,
    cupMl,
    dailyGoalMl,
    waterMl,
    avatar,
    bubblesEnabled,
    eyeBreakTimer,
    stretchTimer,
    isPaused,
    todayStats
  ]);

  /* =========================
   * Keep todayStats.waterMl in sync with waterMl
   * ========================= */
  useEffect(() => {
    setTodayStats((s) => (s.waterMl === waterMl ? s : { ...s, waterMl }));
  }, [waterMl]);

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
          waterMl: 0,
          eyeBreaks: 0,
          stretches: 0,
          wakeRoutines: 0,
          sleepRoutines: 0,
          workTime: 0,
          details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
        });
        setWaterMl(0);
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
   * Formatting / derived
   * ========================= */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const waterCount = Math.floor(waterMl / Math.max(1, cupMl));
  const hydrationPct = Math.round((waterMl / Math.max(1, dailyGoalMl)) * 100);

  const energyScore = useMemo(() => {
    const hydration = Math.min(1, waterMl / Math.max(1, dailyGoalMl));
    const routines =
      todayStats.eyeBreaks +
      todayStats.stretches +
      todayStats.wakeRoutines +
      todayStats.sleepRoutines;
    const activity = Math.min(1, routines / 6);
    const score = 0.6 * hydration + 0.4 * activity;
    return Math.round(score * 100);
  }, [
    waterMl,
    dailyGoalMl,
    todayStats.eyeBreaks,
    todayStats.stretches,
    todayStats.wakeRoutines,
    todayStats.sleepRoutines
  ]);

  const nextHero = useMemo(() => {
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
        return { glow: "violet", ring: "text-violet-400", icon: <Eye className="h-6 w-6 text-violet-500" /> };
      case "stretch":
        return { glow: "emerald", ring: "text-emerald-400", icon: <Activity className="h-6 w-6 text-emerald-500" /> };
      case "wake":
        return { glow: "amber", ring: "text-amber-400", icon: <Sun className="h-6 w-6 text-amber-500" /> };
      case "sleep":
        return { glow: "indigo", ring: "text-indigo-400", icon: <Moon className="h-6 w-6 text-indigo-500" /> };
      default:
        return { glow: "cyan", ring: "text-cyan-400", icon: <Eye className="h-6 w-6 text-cyan-500" /> };
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
    water: Math.round((d.waterMl ?? 0) / Math.max(1, cupMl)),
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0,
    wake: d.wakeRoutines ?? 0,
    sleep: d.sleepRoutines ?? 0
  }));

  const chart30 = window30.map((d) => ({
    day: d.dayKey.slice(5),
    water: Math.round((d.waterMl ?? 0) / Math.max(1, cupMl)),
    eye: d.eyeBreaks ?? 0,
    stretch: d.stretches ?? 0,
    wake: d.wakeRoutines ?? 0,
    sleep: d.sleepRoutines ?? 0
  }));

  /* =========================
   * Hydration actions (ml)
   * ========================= */
  const addWater = () => {
    const nextMl = Math.min(dailyGoalMl, waterMl + cupMl);
    if (nextMl !== waterMl) {
      setWaterMl(nextMl);
      if (soundEnabled) playTone({ freq: 740 });
    }
  };

  const removeWater = () => {
    const nextMl = Math.max(0, waterMl - cupMl);
    if (nextMl !== waterMl) {
      setWaterMl(nextMl);
      if (soundEnabled) playTone({ freq: 520, gain: 0.02 });
    }
  };

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
   * Routine player
   * ========================= */
  const startQueue = (type, queue, startIndex = 0) => {
    setActiveRoutine({
      type,
      queue,
      index: startIndex,
      remainingSec: queue[startIndex].durationSec,
      paused: false
    });
  };

  const stopRoutine = () => setActiveRoutine(null);

  const toggleRoutinePause = () => {
    setActiveRoutine((r) => (r ? { ...r, paused: !r.paused } : r));
  };

  const skipStep = () => {
    setActiveRoutine((r) => {
      if (!r) return r;
      const nextIndex = r.index + 1;
      if (nextIndex >= r.queue.length) return null;
      return { ...r, index: nextIndex, remainingSec: r.queue[nextIndex].durationSec };
    });
  };

  const creditCompletion = (type) => {
    const totalKeyMap = {
      eye: "eyeBreaks",
      stretch: "stretches",
      wake: "wakeRoutines",
      sleep: "sleepRoutines"
    };
    setTodayStats((s) => {
      const totalKey = totalKeyMap[type];
      return { ...s, [totalKey]: (s[totalKey] ?? 0) + 1 };
    });
    if (soundEnabled) playTone({ freq: type === "sleep" ? 520 : 740, durationMs: 220 });
  };

  useEffect(() => {
    if (!activeRoutine) return;

    const id = setInterval(() => {
      setActiveRoutine((r) => {
        if (!r) return null;
        if (r.paused) return r;

        if (r.remainingSec <= 1) {
          const step = r.queue[r.index];

          setTodayStats((s) => {
            const details = s.details ?? { eye: {}, stretch: {}, wake: {}, sleep: {} };
            const bucket = { ...(details[r.type] ?? {}) };
            if (step?.id) bucket[step.id] = (bucket[step.id] ?? 0) + 1;
            return { ...s, details: { ...details, [r.type]: bucket } };
          });

          const nextIndex = r.index + 1;
          if (nextIndex < r.queue.length) {
            return { ...r, index: nextIndex, remainingSec: r.queue[nextIndex].durationSec };
          }

          creditCompletion(r.type);
          return null;
        }

        return { ...r, remainingSec: r.remainingSec - 1 };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [activeRoutine, soundEnabled]);

  /* =========================
   * Screens
   * ========================= */
  const HomeScreen = () => {
    const heroTheme = themeGlow(nextHero.type);

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={cn("text-[20px] font-bold", theme.textPrimary)}>
              Zen et hydraté
            </div>
            <div className={cn("text-[13px] mt-1", theme.textSecondary)}>
              Pause, Respiration et Hydratation pour prendre soin de son corps et de son esprit.
            </div>
          </div>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className={cn(
              "h-11 w-11 rounded-2xl flex items-center justify-center transition",
              theme.cardSoft,
              theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
            )}
            title={isPaused ? "Reprendre" : "Pause"}
            aria-label={isPaused ? "Reprendre" : "Pause"}
          >
            {isPaused ? (
              <Play className={cn("h-5 w-5", theme.id === "neo" ? "text-white/85" : "text-gray-700")} />
            ) : (
              <Pause className={cn("h-5 w-5", theme.id === "neo" ? "text-white/85" : "text-gray-700")} />
            )}
          </button>
        </div>

        {/* Hero */}
        <div className={cn("mt-6 rounded-[28px] p-6", theme.card)}>
          <div className="flex items-center gap-5">
            <GlassIconPlate glow={heroTheme.glow} theme={theme}>
              {theme.id === "neo"
                ? React.cloneElement(heroTheme.icon, { className: "h-6 w-6 text-white/85" })
                : heroTheme.icon}
            </GlassIconPlate>

            <div className="flex-1 min-w-0">
              <div className={cn("text-[28px] font-semibold leading-none", theme.textPrimary)}>
                {nextHero.label}
              </div>
              <div className={cn("mt-2 text-[18px] font-medium", theme.textSecondary)}>
                Dans {nextHero.time}
              </div>
            </div>

            <ProgressRing pct={nextHero.pct} size={56} stroke={7} glowClass={heroTheme.ring} theme={theme} />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                setShowExercise(nextHero.type);
                if (soundEnabled) playTone({ freq: 520, gain: 0.02 });
              }}
              className={cn(
                "rounded-full px-10 py-3 text-[16px] font-semibold tracking-wide transition shadow-[0_14px_30px_rgba(0,0,0,0.25)]",
                theme.id === "neo"
                  ? "border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.06] hover:from-white/[0.14] hover:to-white/[0.08]"
                  : "border border-black/10 bg-black/[0.03] hover:bg-black/[0.05]"
              )}
            >
              <span className={theme.textPrimary}>DÉMARRER</span>
            </button>
          </div>
        </div>

        {/* Tuiles uniformes (ordre demandé) */}
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4">
            {/* 1) Énergie */}
            <div className={cn("w-full h-full min-h-[180px] rounded-[24px] p-4 flex flex-col justify-between", theme.card)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>Énergie</div>
                  <div className={cn("mt-1 text-[12px] font-semibold", theme.textMuted)}>
                    {energyScore < 35 ? "Fatigué" : energyScore < 70 ? "En amélioration" : "En forme"}
                  </div>
                </div>
                <div className="shrink-0">
                  <AvatarMood theme={theme} avatar={avatar} energyScore={energyScore} />
                </div>
              </div>

              <div className="mt-3">
                <div className={cn("h-3 rounded-full overflow-hidden", theme.id === "neo" ? "bg-white/10" : "bg-black/10")}>
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 ease-out",
                      theme.id === "neo"
                        ? "bg-gradient-to-r from-rose-300/70 via-amber-300/70 to-emerald-300/70"
                        : "bg-gradient-to-r from-rose-400/70 via-amber-400/70 to-emerald-400/70"
                    )}
                    style={{ width: `${energyScore}%` }}
                  />
                </div>
                <div className={cn("mt-2 text-[12px]", theme.textMuted)}>
                  Score: <span className={cn("font-semibold", theme.textSecondary)}>{energyScore}%</span>
                </div>
              </div>
            </div>

            {/* 2) Hydratation */}
            <div className={cn("w-full h-full min-h-[180px] rounded-[24px] p-4 flex flex-col justify-between", theme.card)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>Hydratation</div>
                  <div className={cn("mt-1 text-[12px] font-semibold", theme.textMuted)}>
                    {waterMl} / {dailyGoalMl} ml • {Math.max(0, Math.min(100, hydrationPct))}%
                  </div>
                  <div className={cn("mt-1 text-[12px]", theme.textMuted)}>
                    Dose: {cupMl}ml • {waterCount} dose{waterCount > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="shrink-0">
                  <GlassIconPlate glow="cyan" theme={theme}>
                    {theme.id === "neo"
                      ? <Droplets className="h-6 w-6 text-white/85" />
                      : <Droplets className="h-6 w-6 text-cyan-600" />}
                  </GlassIconPlate>
                </div>
              </div>

              <div className="mt-3">
                <WaterGlasses
                  totalMl={waterMl}
                  goalMl={dailyGoalMl}
                  cupMl={cupMl}
                  onAdd={addWater}
                  onRemove={removeWater}
                  bubblesEnabled={bubblesEnabled}
                  theme={theme}
                  size="sm"
                />
              </div>
            </div>

            {/* 3) Yeux */}
            <ShortcutTile
              title="Yeux"
              subtitle={formatTime(eyeBreakTimer)}
              glow="violet"
              theme={theme}
              icon={
                theme.id === "neo"
                  ? <Eye className="h-6 w-6 text-white/85" />
                  : <Eye className="h-6 w-6 text-violet-600" />
              }
              onClick={() => setShowExercise("eye")}
            />

            {/* 4) Étirements */}
            <ShortcutTile
              title="Étirements"
              subtitle={formatTime(stretchTimer)}
              glow="emerald"
              theme={theme}
              icon={
                theme.id === "neo"
                  ? <Activity className="h-6 w-6 text-white/85" />
                  : <Activity className="h-6 w-6 text-emerald-600" />
              }
              onClick={() => setShowExercise("stretch")}
            />

            {/* 5) Réveil */}
            <ShortcutTile
              title="Réveil"
              subtitle={`${exercises.wake.length} étapes`}
              glow="amber"
              theme={theme}
              icon={
                theme.id === "neo"
                  ? <Sun className="h-6 w-6 text-white/85" />
                  : <Sun className="h-6 w-6 text-amber-600" />
              }
              onClick={() => startQueue("wake", exercises.wake)}
            />

            {/* 6) Coucher */}
            <ShortcutTile
              title="Coucher"
              subtitle={`${exercises.sleep.length} étapes`}
              glow="indigo"
              theme={theme}
              icon={
                theme.id === "neo"
                  ? <Moon className="h-6 w-6 text-white/85" />
                  : <Moon className="h-6 w-6 text-indigo-600" />
              }
              onClick={() => startQueue("sleep", exercises.sleep)}
            />
          </div>
        </div>

        <div className={cn("mt-7 text-[14px] leading-snug", theme.textMuted)}>
          Aujourd&apos;hui: {todayStats.waterMl}ml • Yeux {todayStats.eyeBreaks} • Étirements {todayStats.stretches}
          <br />
          Réveil {todayStats.wakeRoutines} • Coucher {todayStats.sleepRoutines}
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
        <div className={cn("rounded-[24px] p-5", theme.cardSoft)}>
          <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>{title}</div>
          {entries.length === 0 ? (
            <div className={cn("mt-2 text-[13px]", theme.textMuted)}>Aucune donnée.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {entries.map(([id, count]) => (
                <div key={id} className="flex items-center justify-between">
                  <div className={cn("text-[13px] font-medium", theme.textSecondary)}>{labelsById[id] ?? id}</div>
                  <div className={cn("text-[13px] font-semibold", theme.textPrimary)}>{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    const tooltipStyle = {
      background: theme.tooltip.background,
      border: theme.tooltip.border,
      borderRadius: 14,
      color: theme.tooltip.color
    };

    return (
      <div className="px-5 pb-24 pt-6 space-y-6">
        <div className="flex items-end justify-between">
          <div className={cn("text-[28px] font-semibold", theme.textPrimary)}>Statistiques</div>
          <div className={cn("rounded-2xl px-4 py-2", theme.cardSoft)}>
            <span className={cn("text-[13px] font-semibold", theme.textSecondary)}>🔥 {streak}j</span>
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", theme.card)}>
          <div className="flex items-center gap-3">
            <Clock className={cn("h-6 w-6", theme.id === "neo" ? "text-white/80" : "text-gray-700")} />
            <div>
              <div className={cn("text-[13px] font-semibold", theme.textMuted)}>Temps de travail aujourd&apos;hui</div>
              <div className={cn("text-[26px] font-semibold", theme.textPrimary)}>{workH}h {workM}m</div>
            </div>
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", theme.card)}>
          <div className="flex items-center justify-between">
            <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>Graphique 7 jours</div>
            <div className={cn("text-[13px] font-semibold", theme.textMuted)}>
              Eau {Math.round(sum(window7, "waterMl") / 100) / 10}L
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 260 }}>
            {chart7.length === 0 ? (
              <div className={cn("text-[13px]", theme.textMuted)}>Aucune donnée pour l’instant.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart7}>
                  <XAxis
                    dataKey="day"
                    tick={{
                      fill: theme.id === "neo" ? "rgba(255,255,255,0.65)" : "rgba(15,23,42,0.60)",
                      fontSize: 12
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: theme.id === "neo" ? "rgba(255,255,255,0.65)" : "rgba(15,23,42,0.60)",
                      fontSize: 12
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{
                      color: theme.id === "neo" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.65)"
                    }}
                  />
                  <Bar dataKey="water" name={`Eau (doses ${cupMl}ml)`} fill="rgba(34, 211, 238, 0.60)" />
                  <Bar dataKey="eye" name="Yeux" fill="rgba(167, 139, 250, 0.60)" />
                  <Bar dataKey="stretch" name="Étirements" fill="rgba(52, 211, 153, 0.60)" />
                  <Bar dataKey="wake" name="Réveil" fill="rgba(251, 191, 36, 0.60)" />
                  <Bar dataKey="sleep" name="Coucher" fill="rgba(129, 140, 248, 0.60)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cn("rounded-[28px] p-6", theme.card)}>
          <div className="flex items-center justify-between">
            <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>Graphique 30 jours</div>
            <div className={cn("text-[13px] font-semibold", theme.textMuted)}>
              Jours: {window30.length}
            </div>
          </div>

          <div className="mt-4" style={{ width: "100%", height: 260 }}>
            {chart30.length === 0 ? (
              <div className={cn("text-[13px]", theme.textMuted)}>Aucune donnée sur 30 jours.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart30}>
                  <XAxis
                    dataKey="day"
                    tick={{
                      fill: theme.id === "neo" ? "rgba(255,255,255,0.65)" : "rgba(15,23,42,0.60)",
                      fontSize: 12
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: theme.id === "neo" ? "rgba(255,255,255,0.65)" : "rgba(15,23,42,0.60)",
                      fontSize: 12
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{
                      color: theme.id === "neo" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.65)"
                    }}
                  />
                  <Bar dataKey="water" name={`Eau (doses ${cupMl}ml)`} fill="rgba(34, 211, 238, 0.55)" />
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
   * ========================= */
  const ExerciseModal = () => {
    if (!showExercise) return null;

    const list = exercises[showExercise] ?? [];
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
        <div className={cn("absolute inset-0", theme.modalBackdrop)} onClick={() => setShowExercise(null)} />
        <div className="absolute inset-x-0 bottom-0">
          <div className={cn("mx-auto max-w-md rounded-t-[32px] p-6", theme.card, "border-b-0")}>
            <div className="flex items-center justify-between">
              <div className={cn("text-[18px] font-semibold", theme.textPrimary)}>{title}</div>
              <button
                onClick={() => setShowExercise(null)}
                className={cn(
                  "h-10 w-10 rounded-2xl flex items-center justify-center transition",
                  theme.cardSoft,
                  theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
                )}
              >
                <X className={cn("h-5 w-5", theme.id === "neo" ? "text-white/75" : "text-gray-600")} />
              </button>
            </div>

            {(showExercise === "wake" || showExercise === "sleep") && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    startQueue(showExercise, list);
                    setShowExercise(null);
                    if (soundEnabled) playTone({ freq: showExercise === "wake" ? 740 : 520, durationMs: 200 });
                  }}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3 font-semibold text-[15px] transition",
                    theme.id === "neo"
                      ? "border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.06] hover:from-white/[0.14] hover:to-white/[0.08]"
                      : "border border-black/10 bg-black/[0.03] hover:bg-black/[0.05]"
                  )}
                >
                  <span className={theme.textPrimary}>Démarrer la routine complète</span>
                </button>
              </div>
            )}

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
                    "w-full text-left rounded-[22px] p-4 transition active:scale-[0.99]",
                    theme.cardSoft,
                    theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn("text-[15px] font-semibold truncate", theme.textPrimary)}>{ex.name}</div>
                      <div className={cn("mt-1 text-[13px] leading-snug", theme.textMuted)}>{ex.desc}</div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold",
                        theme.id === "neo" ? "bg-white/10 border border-white/10" : "bg-black/[0.03] border border-black/10"
                      )}
                    >
                      <span className={theme.textSecondary}>{ex.durationSec}s</span>
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
   * Routine player overlay
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
        <div className={cn("absolute inset-0", theme.id === "neo" ? "bg-black/70" : "bg-black/50")} />
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className={cn("w-full max-w-md rounded-[32px] p-6", theme.card)}>
            <div className="flex items-start justify-between">
              <div>
                <div className={cn("text-[16px] font-semibold", theme.textPrimary)}>
                  {activeRoutine.type === "eye"
                    ? "Pause yeux"
                    : activeRoutine.type === "stretch"
                      ? "Étirements"
                      : activeRoutine.type === "wake"
                        ? "Routine Réveil"
                        : "Routine Coucher"}
                </div>
                <div className={cn("mt-1 text-[13px] font-semibold", theme.textMuted)}>
                  Étape {stepNo}/{totalSteps}
                </div>
              </div>
              <button
                onClick={stopRoutine}
                className={cn(
                  "h-10 w-10 rounded-2xl flex items-center justify-center transition",
                  theme.cardSoft,
                  theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
                )}
                aria-label="Fermer"
              >
                <X className={cn("h-5 w-5", theme.id === "neo" ? "text-white/75" : "text-gray-600")} />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="relative">
                <ProgressRing pct={pct} size={160} stroke={10} glowClass={t.ring} theme={theme} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={cn("text-[44px] font-semibold leading-none", theme.textPrimary)}>
                    {activeRoutine.remainingSec}s
                  </div>
                  <div className={cn("mt-2 text-[13px] font-semibold", theme.textMuted)}>
                    {activeRoutine.paused ? "En pause" : "En cours"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className={cn("text-[18px] font-semibold", theme.textPrimary)}>
                {step?.name ?? "Exercice"}
              </div>
              <div className={cn("mt-2 text-[13px] leading-snug", theme.textSecondary)}>
                {step?.desc ?? ""}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <SurfaceButton
                onClick={toggleRoutinePause}
                theme={theme}
                className="text-center"
                title={activeRoutine.paused ? "Reprendre" : "Pause"}
              >
                <div className="flex items-center justify-center gap-2">
                  {activeRoutine.paused ? (
                    <Play className={cn("h-4 w-4", theme.id === "neo" ? "text-white/85" : "text-gray-700")} />
                  ) : (
                    <Pause className={cn("h-4 w-4", theme.id === "neo" ? "text-white/85" : "text-gray-700")} />
                  )}
                  <span className={cn("text-[13px] font-semibold", theme.textPrimary)}>
                    {activeRoutine.paused ? "Reprendre" : "Pause"}
                  </span>
                </div>
              </SurfaceButton>

              <SurfaceButton onClick={skipStep} theme={theme} className="text-center" title="Passer">
                <span className={cn("text-[13px] font-semibold", theme.textPrimary)}>Passer</span>
              </SurfaceButton>

              <SurfaceButton
                onClick={() => {
                  creditCompletion(activeRoutine.type);
                  setActiveRoutine(null);
                }}
                theme={theme}
                className="text-center"
                title="Terminer"
              >
                <div className="flex items-center justify-center gap-2">
                  <Check className={cn("h-4 w-4", theme.id === "neo" ? "text-white/85" : "text-gray-700")} />
                  <span className={cn("text-[13px] font-semibold", theme.textPrimary)}>Terminer</span>
                </div>
              </SurfaceButton>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* =========================
   * Notif cards
   * ========================= */
  const NotifCard = ({ type }) => {
    const title = type === "eye" ? "Pause yeux" : "Étirements";
    const subtitle = type === "eye" ? "Reposez vos yeux 20 secondes" : "Bougez pendant 2 minutes";
    const text = type === "eye" ? "Regardez au loin (~6 mètres)." : "Levez-vous et étirez-vous.";
    const t = themeGlow(type);

    return (
      <div className="absolute top-4 left-4 right-4 z-50">
        <div className={cn("rounded-[24px] p-5", theme.card)}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <GlassIconPlate glow={t.glow} theme={theme}>
                {theme.id === "neo"
                  ? React.cloneElement(t.icon, { className: "h-6 w-6 text-white/85" })
                  : t.icon}
              </GlassIconPlate>
              <div>
                <div className={cn("text-[15px] font-semibold", theme.textPrimary)}>{title}</div>
                <div className={cn("mt-1 text-[13px]", theme.textMuted)}>{subtitle}</div>
              </div>
            </div>
            <button
              onClick={() => setShowNotif(null)}
              className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center transition",
                theme.cardSoft,
                theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
              )}
            >
              <X className={cn("h-5 w-5", theme.id === "neo" ? "text-white/75" : "text-gray-600")} />
            </button>
          </div>

          <div className={cn("mt-3 text-[13px]", theme.textSecondary)}>{text}</div>

          <button
            onClick={type === "eye" ? completeEyeBreak : completeStretch}
            className={cn(
              "mt-4 w-full rounded-2xl px-4 py-3 font-semibold text-[14px] transition",
              theme.id === "neo"
                ? "border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.06] hover:from-white/[0.16] hover:to-white/[0.08]"
                : "border border-black/10 bg-black/[0.03] hover:bg-black/[0.05]"
            )}
          >
            <span className={theme.textPrimary}>C’est fait</span>
          </button>
        </div>
      </div>
    );
  };

  /* =========================
   * Settings modal
   * ========================= */
  const SettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="fixed inset-0 z-50">
        <div className={cn("absolute inset-0", theme.modalBackdrop)} onClick={() => setShowSettings(false)} />
        <div className="absolute inset-x-0 bottom-0">
          <div className={cn("mx-auto max-w-md rounded-t-[32px] p-6", theme.card, "border-b-0")}>
            <div className="flex items-center justify-between">
              <div className={cn("text-[18px] font-semibold", theme.textPrimary)}>Paramètres</div>
              <button
                onClick={() => setShowSettings(false)}
                className={cn(
                  "h-10 w-10 rounded-2xl flex items-center justify-center transition",
                  theme.cardSoft,
                  theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
                )}
              >
                <X className={cn("h-5 w-5", theme.id === "neo" ? "text-white/75" : "text-gray-600")} />
              </button>
            </div>

            <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Theme selector */}
              <div className={cn("rounded-[22px] p-4", theme.cardSoft)}>
                <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Thème</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={cn(
                        "rounded-2xl px-3 py-3 text-[12px] font-semibold transition border",
                        t.id === themeId
                          ? (theme.id === "neo" ? "border-white/20 bg-white/[0.10]" : "border-black/15 bg-black/[0.04]")
                          : (theme.id === "neo" ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.10]" : "border-black/10 bg-black/[0.02] hover:bg-black/[0.04]"),
                        theme.textPrimary
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar */}
              <div className={cn("rounded-[22px] p-4", theme.cardSoft)}>
                <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Avatar</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAvatar("female")}
                    className={cn(
                      "rounded-2xl px-3 py-3 text-[12px] font-semibold transition border",
                      avatar === "female"
                        ? (theme.id === "neo" ? "border-white/20 bg-white/[0.10]" : "border-black/15 bg-black/[0.04]")
                        : (theme.id === "neo" ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.10]" : "border-black/10 bg-black/[0.02] hover:bg-black/[0.04]"),
                      theme.textPrimary
                    )}
                  >
                    Femme
                  </button>
                  <button
                    onClick={() => setAvatar("male")}
                    className={cn(
                      "rounded-2xl px-3 py-3 text-[12px] font-semibold transition border",
                      avatar === "male"
                        ? (theme.id === "neo" ? "border-white/20 bg-white/[0.10]" : "border-black/15 bg-black/[0.04]")
                        : (theme.id === "neo" ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.10]" : "border-black/10 bg-black/[0.02] hover:bg-black/[0.04]"),
                      theme.textPrimary
                    )}
                  >
                    Homme
                  </button>
                </div>
              </div>

              {/* Hydration in ml */}
              <div className={cn("rounded-[22px] p-4", theme.cardSoft)}>
                <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Hydratation (ml)</div>

                <div className="mt-3">
                  <div className={cn("text-[12px] font-semibold", theme.textMuted)}>Objectif quotidien</div>
                  <select
                    className={cn("mt-2 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold", theme.surfaceInput)}
                    value={dailyGoalMl}
                    onChange={(e) => setDailyGoalMl(Number(e.target.value))}
                  >
                    <option value={1500}>1500 ml</option>
                    <option value={2000}>2000 ml</option>
                    <option value={2500}>2500 ml</option>
                    <option value={3000}>3000 ml</option>
                    <option value={3500}>3500 ml</option>
                  </select>
                </div>

                <div className="mt-4">
                  <div className={cn("text-[12px] font-semibold", theme.textMuted)}>Dose par clic</div>
                  <select
                    className={cn("mt-2 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold", theme.surfaceInput)}
                    value={cupMl}
                    onChange={(e) => setCupMl(Number(e.target.value))}
                  >
                    <option value={200}>200 ml</option>
                    <option value={250}>250 ml</option>
                    <option value={330}>330 ml</option>
                    <option value={500}>500 ml</option>
                  </select>
                </div>

                <div className={cn("mt-3 text-[12px]", theme.textMuted)}>
                  Appui long sur un verre : −{cupMl}ml.
                </div>
              </div>

              {/* Timers */}
              <div className={cn("rounded-[22px] p-4", theme.cardSoft)}>
                <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Fréquence pauses yeux</div>
                <select
                  className={cn("mt-3 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold", theme.surfaceInput)}
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

              <div className={cn("rounded-[22px] p-4", theme.cardSoft)}>
                <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Fréquence étirements</div>
                <select
                  className={cn("mt-3 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold", theme.surfaceInput)}
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

              {/* Sound */}
              <div className={cn("rounded-[22px] p-4 flex items-center justify-between", theme.cardSoft)}>
                <div>
                  <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Sons</div>
                  <div className={cn("mt-1 text-[12px]", theme.textMuted)}>
                    Sur le web, les sons nécessitent une première interaction utilisateur.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-black"
                  checked={soundEnabled}
                  onChange={(e) => {
                    setSoundEnabled(e.target.checked);
                    playTone({ freq: e.target.checked ? 740 : 520, gain: 0.02 });
                  }}
                />
              </div>

              {/* Bubbles */}
              <div className={cn("rounded-[22px] p-4 flex items-center justify-between", theme.cardSoft)}>
                <div>
                  <div className={cn("text-[13px] font-semibold", theme.textSecondary)}>Bulles dans l’eau</div>
                  <div className={cn("mt-1 text-[12px]", theme.textMuted)}>Effet visuel léger.</div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-black"
                  checked={bubblesEnabled}
                  onChange={(e) => setBubblesEnabled(e.target.checked)}
                />
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className={cn(
                "mt-5 w-full rounded-2xl px-4 py-3 font-semibold text-[14px] transition",
                theme.id === "neo"
                  ? "border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.06] hover:from-white/[0.16] hover:to-white/[0.08]"
                  : "border border-black/10 bg-black/[0.03] hover:bg-black/[0.05]"
              )}
            >
              <span className={theme.textPrimary}>Fermer</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* =========================
   * Render
   * ========================= */
  return (
    <div className={cn("min-h-screen w-full flex justify-center", theme.bgRoot)}>
      {theme.bgLayer}

      <div className="relative w-full max-w-md">
        {showNotif === "eye" && <NotifCard type="eye" />}
        {showNotif === "stretch" && <NotifCard type="stretch" />}

        {activeTab === "home" && <HomeScreen />}
        {activeTab === "stats" && <StatsScreen />}

        {/* Bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 pb-5">
          <div className={cn("rounded-[26px] px-6 py-4 flex items-center justify-around", theme.nav)}>
            <button
              onClick={() => setActiveTab("home")}
              className={cn(
                "flex flex-col items-center gap-1 transition",
                activeTab === "home" ? theme.textPrimary : theme.textMuted
              )}
            >
              <Home className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Accueil</span>
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={cn(
                "flex flex-col items-center gap-1 transition",
                activeTab === "stats" ? theme.textPrimary : theme.textMuted
              )}
            >
              <TrendingUp className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Stats</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className={cn("flex flex-col items-center gap-1 transition", showSettings ? theme.textPrimary : theme.textMuted)}
            >
              <Settings className="h-6 w-6" />
              <span className="text-[11px] font-semibold">Réglages</span>
            </button>
          </div>
        </div>

        <ExerciseModal />
        <RoutinePlayer />
        <SettingsModal />

        {/* Keyframes */}
        <style>{`
          @keyframes zh_wave {
            0%   { transform: translateX(0) translateY(0); }
            50%  { transform: translateX(10%) translateY(6%); }
            100% { transform: translateX(0) translateY(0); }
          }
          @keyframes zh_bubble {
            0%   { transform: translateY(0) scale(0.9); opacity: 0; }
            20%  { opacity: 0.5; }
            60%  { opacity: 0.35; }
            100% { transform: translateY(-22px) scale(1.1); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* =========================
 * Shortcut tile (uniform size)
 * ========================= */
function ShortcutTile({ title, subtitle, icon, glow = "cyan", theme, onClick }) {
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
      className={cn(
        "group w-full h-full min-h-[180px] rounded-[24px] p-4 text-left transition active:scale-[0.99] flex flex-col justify-between",
        theme.card,
        theme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]"
      )}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={cn("absolute inset-0 rounded-full blur-2xl", glowMap[glow] ?? glowMap.cyan)} />
          <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", theme.cardSoft)}>
            {icon}
          </div>
        </div>

        <div className="min-w-0">
          <div className={cn("text-[16px] font-semibold leading-tight truncate", theme.textPrimary)}>{title}</div>
          <div className={cn("mt-1 text-[13px] font-semibold leading-none truncate", theme.textMuted)}>{subtitle}</div>
        </div>
      </div>

      <div className={cn("text-[12px] font-semibold", theme.textMuted)}>
        Ouvrir
      </div>
    </button>
  );
}

/* =========================
 * Avatar mood (emoji homme/femme + état qui évolue)
 * ========================= */
function AvatarMood({ theme, avatar, energyScore }) {
  const person = avatar === "male" ? "👨" : "👩";

  const mood =
    energyScore < 35
      ? { key: "tired", label: "Fatigué", emoji: "😴", aura: "bg-rose-500/15" }
      : energyScore < 70
        ? { key: "ok", label: "En amélioration", emoji: "🙂", aura: "bg-amber-500/15" }
        : { key: "good", label: "En forme", emoji: "😄", aura: "bg-emerald-500/15" };

  const genderLabel = avatar === "male" ? "Homme" : "Femme";

  return (
    <div className="relative">
      <div className={cn("absolute inset-0 rounded-full blur-2xl", mood.aura)} />
      <div
        className={cn("h-20 w-20 rounded-[26px] flex flex-col items-center justify-center", theme.cardSoft)}
        aria-label={`Avatar ${genderLabel}, ${mood.label}`}
        title={`${genderLabel} • ${mood.label}`}
      >
        <div className={cn("text-[11px] font-semibold", theme.textMuted)}>
          {genderLabel}
        </div>

        <div className={cn("mt-1 text-[26px] font-semibold", theme.textPrimary)} style={{ lineHeight: 1 }}>
          <span aria-hidden="true">{person}</span>{" "}
          <span aria-hidden="true">{mood.emoji}</span>
        </div>
      </div>
    </div>
  );
}

/* =========================
 * Water glasses (progress fill + long press undo + bubbles)
 * ========================= */
function WaterGlasses({
  totalMl,
  goalMl,
  cupMl,
  onAdd,
  onRemove,
  theme,
  bubblesEnabled = true,
  size = "md"
}) {
  const dims =
    size === "sm"
      ? { h: 56, gap: 8 }
      : size === "lg"
        ? { h: 78, gap: 12 }
        : { h: 68, gap: 12 };

  const fillColor =
    theme.id === "neo"
      ? "from-cyan-300/80 to-blue-400/80"
      : theme.id === "wellness"
        ? "from-sky-400/70 to-emerald-400/70"
        : "from-blue-500/70 to-cyan-500/70";

  const glassBg =
    theme.id === "neo"
      ? "bg-white/[0.06] border-white/10"
      : theme.id === "wellness"
        ? "bg-white/70 border-white/70"
        : "bg-white border-gray-200";

  const rim =
    theme.id === "neo"
      ? "bg-white/10"
      : theme.id === "wellness"
        ? "bg-white/70"
        : "bg-gray-100";

  const maxCups = Math.max(1, Math.ceil(goalMl / Math.max(1, cupMl)));
  const filledCups = Math.floor(totalMl / Math.max(1, cupMl));
  const remainderMl = totalMl - filledCups * cupMl;
  const partialPct = Math.max(0, Math.min(1, remainderMl / Math.max(1, cupMl)));

  const longPressRef = useRef(null);
  const longPressedRef = useRef(false);

  const startLongPress = () => {
    longPressedRef.current = false;
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onRemove?.();
    }, 450);
  };

  const endLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  return (
    <div className="w-full">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${maxCups}, minmax(0, 1fr))`,
          gap: dims.gap
        }}
      >
        {Array.from({ length: maxCups }).map((_, i) => {
          const isFull = i < filledCups;
          const isPartial = i === filledCups && partialPct > 0;
          const fillPct = isFull ? 0.78 : isPartial ? 0.78 * partialPct : 0;

          return (
            <button
              key={i}
              type="button"
              onMouseDown={startLongPress}
              onMouseUp={endLongPress}
              onMouseLeave={endLongPress}
              onTouchStart={startLongPress}
              onTouchEnd={endLongPress}
              onClick={() => {
                if (longPressedRef.current) return;
                onAdd?.();
              }}
              className="relative group"
              style={{ height: dims.h }}
              aria-label="Hydratation: ajouter (clic) / annuler (appui long)"
              title="Clic: +dose — Appui long: annuler"
            >
              <div className={cn("relative w-full h-full rounded-2xl border overflow-hidden", glassBg)}>
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1 top-2 bottom-2 w-[22%] rounded-full bg-white/10" />
                </div>

                <div className={cn("absolute top-0 left-0 right-0 h-[10%] opacity-60", rim)} />

                <div
                  className="absolute left-0 right-0 bottom-0 transition-[height] duration-700 ease-out"
                  style={{ height: `${fillPct * 100}%` }}
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-b", fillColor)} />

                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className={cn(
                        "absolute -left-[40%] top-[-10%] w-[180%] h-[60%] rounded-[100%] opacity-35",
                        theme.id === "neo" ? "bg-white/20" : "bg-white/35"
                      )}
                      style={{ animation: "zh_wave 2.6s ease-in-out infinite" }}
                    />
                    <div
                      className={cn(
                        "absolute -left-[30%] top-[2%] w-[160%] h-[55%] rounded-[100%] opacity-25",
                        theme.id === "neo" ? "bg-white/15" : "bg-white/30"
                      )}
                      style={{ animation: "zh_wave 3.2s ease-in-out infinite reverse" }}
                    />
                  </div>

                  {bubblesEnabled && (isFull || isPartial) && (
                    <div className="absolute inset-0 pointer-events-none">
                      <Bubble x="22%" delay="0s" />
                      <Bubble x="48%" delay="0.6s" />
                      <Bubble x="70%" delay="1.1s" />
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-1 rounded-full",
                      theme.id === "neo"
                        ? "bg-white/10 border border-white/10 text-white/80"
                        : "bg-black/5 border border-black/10 text-gray-700"
                    )}
                  >
                    + / −
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={cn("mt-3 text-[12px]", theme.textMuted)}>
        Clic: +{cupMl}ml • Appui long: −{cupMl}ml
      </div>
    </div>
  );
}

function Bubble({ x = "50%", delay = "0s" }) {
  return (
    <span
      className="absolute bottom-2 w-2 h-2 rounded-full bg-white/35"
      style={{
        left: x,
        animation: "zh_bubble 1.9s ease-in infinite",
        animationDelay: delay
      }}
    />
  );
}
