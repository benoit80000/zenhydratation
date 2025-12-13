/* ===============================
   ZenhydratationApp.jsx
   Web offline – version finale
   =============================== */

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

/* ===============================
   Storage helpers
   =============================== */
const STATE_KEY = "zenhydratation_state_v2";
const HISTORY_KEY = "zenhydratation_history_v2";

const readLS = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const isActiveDay = (d) =>
  d.water > 0 ||
  d.eyeBreaks > 0 ||
  d.stretches > 0 ||
  d.wakeRoutines > 0 ||
  d.sleepRoutines > 0;

const computeStreak = (history) => {
  let s = 0;
  let c = new Date();
  const map = new Map(history.map((h) => [h.dayKey, h]));
  while (true) {
    const k = dayKey(c);
    if (!map.has(k) || !isActiveDay(map.get(k))) break;
    s++;
    c.setDate(c.getDate() - 1);
  }
  return s;
};

/* ===============================
   Web Audio (alertes sonores)
   =============================== */
let audioCtx = null;
function playSound(freq = 880, duration = 200) {
  try {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
    }, duration);
  } catch {}
}

/* ===============================
   Component
   =============================== */
export default function ZenhydratationApp() {
  /* ---------- Settings ---------- */
  const [waterGoal, setWaterGoal] = useState(8);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  /* ---------- State ---------- */
  const [activeTab, setActiveTab] = useState("home");
  const [waterCount, setWaterCount] = useState(0);
  const [showExercise, setShowExercise] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [today, setToday] = useState({
    dayKey: dayKey(),
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    wakeRoutines: 0,
    sleepRoutines: 0,
    workTime: 0,
    details: { eye: {}, stretch: {}, wake: {}, sleep: {} }
  });

  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);

  /* ---------- Exercises ---------- */
  const exercises = useMemo(
    () => ({
      eye: [
        { id: "eye-2020", name: "Règle 20-20-20", sec: 20, desc: "Regardez à 6 mètres pendant 20 secondes" },
        { id: "eye-blink", name: "Clignements", sec: 20, desc: "Clignez lentement des yeux" },
        { id: "eye-massage", name: "Massage des yeux", sec: 20, desc: "Massez doucement les tempes" }
      ],
      stretch: [
        { id: "st-neck", name: "Rotation du cou", sec: 30, desc: "Tournez lentement la tête" },
        { id: "st-shoulders", name: "Épaules", sec: 30, desc: "Roulez les épaules" },
        { id: "st-back", name: "Dos", sec: 30, desc: "Penchez-vous doucement" }
      ],
      wake: [
        { id: "wk-breath", name: "Respiration réveil", sec: 60, desc: "Respiration profonde et énergisante" },
        { id: "wk-mobility", name: "Mobilité douce", sec: 60, desc: "Bougez les articulations" }
      ],
      sleep: [
        { id: "sl-breath", name: "Respiration calme", sec: 60, desc: "Respiration lente" },
        { id: "sl-relax", name: "Scan corporel", sec: 90, desc: "Détendez chaque partie du corps" }
      ]
    }),
    []
  );

  /* ---------- Load ---------- */
  useEffect(() => {
    const h = readLS(HISTORY_KEY, []);
    setHistory(h);
    setStreak(computeStreak(h));

    const s = readLS(STATE_KEY, null);
    if (s && s.today?.dayKey === dayKey()) {
      setToday(s.today);
      setWaterCount(s.waterCount ?? 0);
      setWaterGoal(s.waterGoal ?? 8);
      setSoundEnabled(s.soundEnabled ?? true);
      setDarkMode(s.darkMode ?? false);
    }
  }, []);

  /* ---------- Save ---------- */
  useEffect(() => {
    writeLS(STATE_KEY, {
      today,
      waterCount,
      waterGoal,
      soundEnabled,
      darkMode
    });
  }, [today, waterCount, waterGoal, soundEnabled, darkMode]);

  /* ---------- History ---------- */
  useEffect(() => {
    const next = [...history.filter((h) => h.dayKey !== today.dayKey), today]
      .slice(-30);
    setHistory(next);
    setStreak(computeStreak(next));
    writeLS(HISTORY_KEY, next);
  }, [today]);

  /* ---------- Exercise runner ---------- */
  useEffect(() => {
    if (!activeExercise) return;

    const id = setInterval(() => {
      setActiveExercise((e) => {
        if (!e) return null;
        if (e.remaining <= 1) {
          const group = e.type;
          const totalKey = {
            eye: "eyeBreaks",
            stretch: "stretches",
            wake: "wakeRoutines",
            sleep: "sleepRoutines"
          }[group];

          setToday((t) => ({
            ...t,
            [totalKey]: t[totalKey] + 1,
            details: {
              ...t.details,
              [group]: {
                ...t.details[group],
                [e.id]: (t.details[group][e.id] ?? 0) + 1
              }
            }
          }));

          if (soundEnabled) playSound(660);
          return null;
        }
        return { ...e, remaining: e.remaining - 1 };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [activeExercise, soundEnabled]);

  /* ---------- UI ---------- */
  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-50"} min-h-screen max-w-md mx-auto`}>
      {/* Header */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">Zenhydratation</h1>
        <p className="text-sm opacity-70">Bien-être quotidien</p>
      </div>

      {/* Streak */}
      <div className="mx-6 mb-4 bg-orange-500 text-white rounded-xl p-4">
        🔥 Série : <b>{streak}</b> jour{streak > 1 && "s"}
      </div>

      {/* Water */}
      <div className="mx-6 mb-4 bg-blue-500 text-white rounded-xl p-4">
        Eau : {waterCount}/{waterGoal}
        <button
          onClick={() => {
            setWaterCount((c) => c + 1);
            setToday((t) => ({ ...t, water: t.water + 1 }));
            if (soundEnabled) playSound(880);
          }}
          className="block w-full bg-white text-blue-600 mt-3 py-2 rounded"
        >
          + J’ai bu
        </button>
      </div>

      {/* Routines */}
      <div className="mx-6 grid grid-cols-2 gap-4">
        {[
          ["eye", "Yeux", Eye],
          ["stretch", "Étirements", Activity],
          ["wake", "Réveil", Sun],
          ["sleep", "Coucher", Moon]
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setShowExercise(k)}
            className="bg-white rounded-xl p-4 shadow text-left"
          >
            <Icon size={24} className="mb-2" />
            <div className="font-semibold">{label}</div>
          </button>
        ))}
      </div>

      {/* Exercise modal */}
      {showExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Choisir un exercice</h3>
            <div className="space-y-3">
              {exercises[showExercise].map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    setActiveExercise({
                      ...ex,
                      type: showExercise,
                      remaining: ex.sec
                    });
                    setShowExercise(null);
                    if (soundEnabled) playSound(520);
                  }}
                  className="w-full text-left p-4 bg-gray-100 rounded-xl"
                >
                  <div className="font-semibold">{ex.name}</div>
                  <div className="text-sm text-gray-600">{ex.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active exercise */}
      {activeExercise && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center w-80">
            <h2 className="text-xl font-bold mb-2">{activeExercise.name}</h2>
            <p className="text-sm mb-4">{activeExercise.desc}</p>
            <div className="text-5xl font-bold text-blue-600 mb-4">
              {activeExercise.remaining}s
            </div>
            <button
              onClick={() => setActiveExercise(null)}
              className="w-full bg-gray-300 py-2 rounded"
            >
              Arrêter
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4 flex justify-around">
        <button onClick={() => setActiveTab("home")}><Home /></button>
        <button onClick={() => setActiveTab("stats")}><TrendingUp /></button>
        <button onClick={() => setShowSettings(true)}><Settings /></button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Paramètres</h3>

            <label className="block mb-4">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />{" "}
              Sons activés
            </label>

            <label className="block mb-4">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
              />{" "}
              Mode sombre
            </label>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
