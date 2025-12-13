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

const STORAGE_KEY = "zenhydratation_state_v1";

function dayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampInt(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

export default function ZenhydratationApp() {
  const [activeTab, setActiveTab] = useState("home");

  // Réglages (OFFLINE + modifiables)
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200); // 20 min
  const [stretchInterval, setStretchInterval] = useState(3600); // 60 min
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Etat
  const [waterCount, setWaterCount] = useState(0);
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);
  const [showNotif, setShowNotif] = useState(null); // 'eye' | 'stretch' | null
  const [showExercise, setShowExercise] = useState(null); // 'eye' | 'stretch' | null
  const [streak, setStreak] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  const [todayStats, setTodayStats] = useState({
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    workTime: 0,
    dayKey: dayKey()
  });

  const saveTimerRef = useRef(null);

  // ---------- OFFLINE: LOAD ----------
  useEffect(() => {
    (async () => {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return;

      try {
        const s = JSON.parse(value);

        // Settings
        if (typeof s.waterGoal === "number") setWaterGoal(clampInt(s.waterGoal, 6, 12));
        if (typeof s.eyeBreakInterval === "number") setEyeBreakInterval(clampInt(s.eyeBreakInterval, 600, 7200));
        if (typeof s.stretchInterval === "number") setStretchInterval(clampInt(s.stretchInterval, 900, 10800));
        if (typeof s.soundEnabled === "boolean") setSoundEnabled(s.soundEnabled);
        if (typeof s.darkMode === "boolean") setDarkMode(s.darkMode);

        // State
        if (typeof s.waterCount === "number") setWaterCount(clampInt(s.waterCount, 0, 50));
        if (typeof s.eyeBreakTimer === "number") setEyeBreakTimer(clampInt(s.eyeBreakTimer, 1, 7200));
        if (typeof s.stretchTimer === "number") setStretchTimer(clampInt(s.stretchTimer, 1, 10800));
        if (typeof s.isPaused === "boolean") setIsPaused(s.isPaused);
        if (typeof s.streak === "number") setStreak(clampInt(s.streak, 0, 9999));

        // Today stats: reset si changement de jour
        if (s.todayStats && typeof s.todayStats === "object") {
          const current = dayKey();
          if (s.todayStats.dayKey === current) {
            setTodayStats({
              water: clampInt(s.todayStats.water ?? 0, 0, 200),
              eyeBreaks: clampInt(s.todayStats.eyeBreaks ?? 0, 0, 500),
              stretches: clampInt(s.todayStats.stretches ?? 0, 0, 500),
              workTime: clampInt(s.todayStats.workTime ?? 0, 0, 24 * 3600),
              dayKey: current
            });
          } else {
            // Nouveau jour : reset
            setTodayStats({ water: 0, eyeBreaks: 0, stretches: 0, workTime: 0, dayKey: current });
            setWaterCount(0);
            setEyeBreakTimer(s.eyeBreakInterval ?? 1200);
            setStretchTimer(s.stretchInterval ?? 3600);
          }
        }
      } catch {
        // ignore parsing errors
      }
    })();
  }, []);

  // ---------- OFFLINE: SAVE (debounce) ----------
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
      showNotif: null, // on ne persiste pas les notifs transitoires
      showExercise: null,
      streak,
      todayStats
    };

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(payload) });
    }, 250);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
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
    streak,
    todayStats
  ]);

  // ---------- Timers ----------
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

      setTodayStats((prev) => ({
        ...prev,
        workTime: prev.workTime + 1
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, eyeBreakInterval, stretchInterval]);

  const triggerNotification = (type) => {
    setShowNotif(type);

    // Son optionnel (simple et offline, via Web Audio)
    if (soundEnabled) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
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

    setTimeout(() => setShowNotif(null), 5000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const addWater = () => {
    if (waterCount < waterGoal) {
      setWaterCount((c) => c + 1);
      setTodayStats((prev) => ({ ...prev, water: prev.water + 1 }));
    }
  };

  const completeEyeBreak = () => {
    setTodayStats((prev) => ({ ...prev, eyeBreaks: prev.eyeBreaks + 1 }));
    setShowNotif(null);
  };

  const completeStretch = () => {
    setTodayStats((prev) => ({ ...prev, stretches: prev.stretches + 1 }));
    setShowNotif(null);
  };

  const exercises = useMemo(
    () => ({
      stretch: [
        { name: "Rotation du cou", duration: "30 sec", desc: "Tournez lentement la tête de gauche à droite" },
        { name: "Étirement des épaules", duration: "30 sec", desc: "Roulez vos épaules en arrière puis en avant" },
        { name: "Étirement des bras", duration: "30 sec", desc: "Tendez les bras devant vous, entrelacez les doigts" },
        { name: "Flexion du dos", duration: "30 sec", desc: "Debout, penchez-vous vers l'avant doucement" }
      ],
      eye: [
        { name: "Règle 20-20-20", desc: "Regardez un objet à 6 mètres pendant 20 secondes" },
        { name: "Clignements", desc: "Clignez des yeux 10 fois lentement" },
        { name: "Massage des yeux", desc: "Fermez les yeux et massez doucement les tempes" }
      ]
    }),
    []
  );

  const HomeScreen = () => (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Zenhydratation</h1>
          <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
            Hydratation, pauses yeux et étirements en télétravail
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"} transition-colors`}
          >
            <Settings size={20} className={darkMode ? "text-gray-200" : "text-gray-700"} />
          </button>
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`p-3 rounded-full ${isPaused ? "bg-green-500" : darkMode ? "bg-gray-600" : "bg-gray-300"} transition-colors`}
          >
            {isPaused ? <Play size={20} className="text-white" /> : <Pause size={20} className={darkMode ? "text-gray-100" : "text-gray-700"} />}
          </button>
        </div>
      </div>

      {/* Streak */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div>
            <p className="text-sm opacity-90">Série en cours</p>
            <p className="text-2xl font-bold">{streak} jours</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-90">Continue comme ça !</p>
          <p className="text-sm font-semibold">+{streak * 10} points</p>
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

      {/* Stats jour */}
      <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Activité d'aujourd'hui</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Droplets size={20} className="text-blue-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Eau bue</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>{todayStats.water} verres</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Eye size={20} className="text-purple-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Pauses yeux</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>{todayStats.eyeBreaks}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Activity size={20} className="text-green-600" />
              </div>
              <span className={darkMode ? "text-gray-200" : "text-gray-700"}>Étirements</span>
            </div>
            <span className={`font-semibold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>{todayStats.stretches}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const StatsScreen = () => (
    <div className="p-6 space-y-6">
      <h1 className={`text-2xl font-bold ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Statistiques</h1>

      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg">
        <Clock size={28} className="mb-3" />
        <p className="text-sm opacity-90 mb-1">Temps de travail aujourd'hui</p>
        <p className="text-3xl font-bold">
          {Math.floor(todayStats.workTime / 3600)}h {Math.floor((todayStats.workTime % 3600) / 60)}m
        </p>
      </div>

      <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} rounded-2xl p-5 shadow-md border`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-800"}`}>Objectifs de la semaine</h3>
        <p className={darkMode ? "text-gray-300" : "text-gray-600"}>
          Vous pouvez ensuite rendre ces objectifs dynamiques (calcul sur 7 jours) en restant 100% offline.
        </p>
      </div>
    </div>
  );

  return (
    <div className={`${darkMode ? "bg-gray-900" : "bg-gray-50"} max-w-md mx-auto min-h-screen relative`}>
      {/* Notifications */}
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
          <p className="text-sm text-gray-600 mb-3">Regardez au loin (6 mètres) pendant 20 secondes</p>
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
          <p className="text-sm text-gray-600 mb-3">Levez-vous et étirez-vous pendant 2 minutes</p>
          <button
            onClick={completeStretch}
            className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={18} />
            C'est fait !
          </button>
        </div>
      )}

      {/* Modal exercices */}
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
                    {exercise.duration && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        {exercise.duration}
                      </span>
                    )}
                  </div>
                  <p className={darkMode ? "text-gray-300 text-sm" : "text-gray-600 text-sm"}>{exercise.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowExercise(null)}
              className={`w-full mt-4 py-3 rounded-xl font-semibold text-white ${
                showExercise === "eye" ? "bg-purple-500 hover:bg-purple-600" : "bg-green-500 hover:bg-green-600"
              } transition-colors`}
            >
              Commencer les exercices
            </button>
          </div>
        </div>
      )}

      {/* Modal paramètres */}
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
              {/* Objectif hydratation */}
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

              {/* Fréquence yeux */}
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

              {/* Fréquence étirements */}
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

              {/* Son */}
              <div className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} rounded-xl p-4 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold">Notifications sonores</p>
                  <p className={darkMode ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>Bip discret lors des alertes</p>
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

      {/* Contenu */}
      <div className="pb-20">
        {activeTab === "home" && <HomeScreen />}
        {activeTab === "stats" && <StatsScreen />}
      </div>

      {/* Navigation */}
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
