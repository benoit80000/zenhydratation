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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function ZenhydratationApp() {
  const [activeTab, setActiveTab] = useState("home");

  /* =======================
     RÉGLAGES PERSISTÉS
     ======================= */
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeBreakInterval, setEyeBreakInterval] = useState(1200);
  const [stretchInterval, setStretchInterval] = useState(3600);

  /* =======================
     ÉTAT
     ======================= */
  const [waterCount, setWaterCount] = useState(0);
  const [eyeBreakTimer, setEyeBreakTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [isPaused, setIsPaused] = useState(false);
  const [showNotif, setShowNotif] = useState(null);
  const [showExercise, setShowExercise] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [todayStats, setTodayStats] = useState({
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    workTime: 0,
    dayKey: todayKey()
  });

  const saveTimeout = useRef(null);

  /* =======================
     LOAD OFFLINE
     ======================= */
  useEffect(() => {
    (async () => {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) return;

      try {
        const s = JSON.parse(value);
        setWaterGoal(s.waterGoal ?? 8);
        setEyeBreakInterval(s.eyeBreakInterval ?? 1200);
        setStretchInterval(s.stretchInterval ?? 3600);
        setWaterCount(s.waterCount ?? 0);
        setEyeBreakTimer(s.eyeBreakTimer ?? 1200);
        setStretchTimer(s.stretchTimer ?? 3600);
        setIsPaused(s.isPaused ?? false);

        if (s.todayStats?.dayKey === todayKey()) {
          setTodayStats(s.todayStats);
        }
      } catch {}
    })();
  }, []);

  /* =======================
     SAVE OFFLINE
     ======================= */
  useEffect(() => {
    const payload = {
      waterGoal,
      eyeBreakInterval,
      stretchInterval,
      waterCount,
      eyeBreakTimer,
      stretchTimer,
      isPaused,
      todayStats
    };

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(payload)
      });
    }, 300);
  }, [
    waterGoal,
    eyeBreakInterval,
    stretchInterval,
    waterCount,
    eyeBreakTimer,
    stretchTimer,
    isPaused,
    todayStats
  ]);

  /* =======================
     TIMERS
     ======================= */
  useEffect(() => {
    if (isPaused) return;

    const id = setInterval(() => {
      setEyeBreakTimer((t) => (t <= 1 ? eyeBreakInterval : t - 1));
      setStretchTimer((t) => (t <= 1 ? stretchInterval : t - 1));
      setTodayStats((s) => ({ ...s, workTime: s.workTime + 1 }));
    }, 1000);

    return () => clearInterval(id);
  }, [isPaused, eyeBreakInterval, stretchInterval]);

  /* =======================
     ACTIONS
     ======================= */
  const addWater = () => {
    if (waterCount < waterGoal) {
      setWaterCount((v) => v + 1);
      setTodayStats((s) => ({ ...s, water: s.water + 1 }));
    }
  };

  const exercises = useMemo(
    () => ({
      eye: [
        { name: "20-20-20", desc: "Regardez à 6 mètres pendant 20 secondes" },
        { name: "Clignements", desc: "Clignez lentement 10 fois" }
      ],
      stretch: [
        { name: "Cou", desc: "Rotation lente du cou" },
        { name: "Dos", desc: "Penchez-vous doucement en avant" }
      ]
    }),
    []
  );

  /* =======================
     UI
     ======================= */
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Zenhydratation</h1>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-3 rounded-full bg-gray-200"
          >
            {isPaused ? <Play /> : <Pause />}
          </button>
        </div>

        <div className="bg-blue-500 text-white p-6 rounded-2xl">
          <h2 className="font-semibold mb-2">Hydratation</h2>
          <p className="mb-4">
            {waterCount} / {waterGoal} verres
          </p>
          <button
            onClick={addWater}
            className="bg-white text-blue-600 w-full py-2 rounded-xl font-semibold"
          >
            J’ai bu un verre
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-purple-500 text-white p-4 rounded-xl">
            <Eye />
            <p className="mt-2">{Math.floor(eyeBreakTimer / 60)} min</p>
          </div>
          <div className="bg-green-500 text-white p-4 rounded-xl">
            <Activity />
            <p className="mt-2">{Math.floor(stretchTimer / 60)} min</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around">
        <button onClick={() => setActiveTab("home")}><Home /></button>
        <button onClick={() => setActiveTab("stats")}><TrendingUp /></button>
        <button onClick={() => setShowSettings(true)}><Settings /></button>
      </div>
    </div>
  );
}
