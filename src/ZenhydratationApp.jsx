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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

import {
  ensureNotificationPermission,
  cancelReminders,
  scheduleNextReminders
} from "./platform/notifications";

/* =======================
   Helpers dates & storage
   ======================= */
const STATE_KEY = "zenhydratation_state_v3";
const HISTORY_KEY = "zenhydratation_history_v1";

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const clamp = (n, min, max) =>
  Math.min(max, Math.max(min, Number(n) || min));

const isActiveDay = (d) =>
  d.water > 0 || d.eyeBreaks > 0 || d.stretches > 0;

const computeStreak = (history) => {
  let s = 0;
  let cursor = new Date();
  const map = new Map(history.map((h) => [h.dayKey, h]));
  while (true) {
    const k = dateKey(cursor);
    if (!map.has(k) || !isActiveDay(map.get(k))) break;
    s++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return s;
};

/* =======================
   Main Component
   ======================= */
export default function ZenhydratationApp() {
  /* ---------- Settings ---------- */
  const [waterGoal, setWaterGoal] = useState(8);
  const [eyeInterval, setEyeInterval] = useState(1200);
  const [stretchInterval, setStretchInterval] = useState(3600);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  /* ---------- State ---------- */
  const [activeTab, setActiveTab] = useState("home");
  const [waterCount, setWaterCount] = useState(0);
  const [eyeTimer, setEyeTimer] = useState(1200);
  const [stretchTimer, setStretchTimer] = useState(3600);
  const [paused, setPaused] = useState(false);

  const [today, setToday] = useState({
    dayKey: dateKey(),
    water: 0,
    eyeBreaks: 0,
    stretches: 0,
    workTime: 0
  });

  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);

  const [showNotif, setShowNotif] = useState(null);
  const [showExercises, setShowExercises] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const saveRef = useRef(null);

  /* ---------- Exercises ---------- */
  const exercises = useMemo(
    () => ({
      eye: [
        { name: "20-20-20", sec: 20, desc: "Regardez à 6m pendant 20s" },
        { name: "Clignements", sec: 20, desc: "Clignez lentement" }
      ],
      stretch: [
        { name: "Cou", sec: 30, desc: "Rotation douce" },
        { name: "Épaules", sec: 30, desc: "Roulez les épaules" }
      ]
    }),
    []
  );

  /* ---------- Load ---------- */
  useEffect(() => {
    (async () => {
      const h = JSON.parse(
        (await Preferences.get({ key: HISTORY_KEY })).value || "[]"
      );
      setHistory(h);
      setStreak(computeStreak(h));

      const s = JSON.parse(
        (await Preferences.get({ key: STATE_KEY })).value || "{}"
      );

      if (s.today?.dayKey === dateKey()) {
        setToday(s.today);
        setWaterCount(s.waterCount || 0);
        setEyeTimer(s.eyeTimer || eyeInterval);
        setStretchTimer(s.stretchTimer || stretchInterval);
      }

      setWaterGoal(s.waterGoal || 8);
      setEyeInterval(s.eyeInterval || 1200);
      setStretchInterval(s.stretchInterval || 3600);
      setNotificationsEnabled(s.notificationsEnabled ?? true);

      await ensureNotificationPermission();
    })();
  }, []);

  /* ---------- Save ---------- */
  useEffect(() => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      await Preferences.set({
        key: STATE_KEY,
        value: JSON.stringify({
          waterGoal,
          eyeInterval,
          stretchInterval,
          notificationsEnabled,
          today,
          waterCount,
          eyeTimer,
          stretchTimer
        })
      });
    }, 300);
  }, [
    waterGoal,
    eyeInterval,
    stretchInterval,
    notificationsEnabled,
    today,
    waterCount,
    eyeTimer,
    stretchTimer
  ]);

  /* ---------- History ---------- */
  useEffect(() => {
    (async () => {
      const updated = [...history.filter((h) => h.dayKey !== today.dayKey), today]
        .slice(-30);
      setHistory(updated);
      setStreak(computeStreak(updated));
      await Preferences.set({
        key: HISTORY_KEY,
        value: JSON.stringify(updated)
      });
    })();
  }, [today]);

  /* ---------- Timers ---------- */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setEyeTimer((t) => (t <= 1 ? eyeInterval : t - 1));
      setStretchTimer((t) => (t <= 1 ? stretchInterval : t - 1));
      setToday((d) => ({ ...d, workTime: d.workTime + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, eyeInterval, stretchInterval]);

  /* ---------- Notifications background ---------- */
  useEffect(() => {
    scheduleNextReminders({
      enabled: notificationsEnabled && !paused,
      eyeSeconds: eyeTimer,
      stretchSeconds: stretchTimer
    });
  }, [notificationsEnabled, paused, eyeTimer, stretchTimer]);

  /* ---------- Exercise runner ---------- */
  useEffect(() => {
    if (!activeExercise) return;
    const id = setInterval(() => {
      setActiveExercise((e) => {
        if (!e) return null;
        if (e.remaining <= 1) {
          const list = exercises[e.type];
          if (e.index + 1 < list.length)
            return {
              ...e,
              index: e.index + 1,
              remaining: list[e.index + 1].sec
            };

          setToday((t) => ({
            ...t,
            [e.type === "eye" ? "eyeBreaks" : "stretches"]:
              t[e.type === "eye" ? "eyeBreaks" : "stretches"] + 1
          }));
          return null;
        }
        return { ...e, remaining: e.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeExercise, exercises]);

  /* ---------- Charts ---------- */
  const chart7 = history.slice(-7).map((d) => ({
    day: d.dayKey.slice(5),
    water: d.water,
    eye: d.eyeBreaks,
    stretch: d.stretches
  }));

  /* =======================
     UI
     ======================= */
  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50">
      {/* TOP */}
      <div className="p-6">
        <h1 className="text-2xl font-bold">Zenhydratation</h1>
        <p className="text-sm text-gray-600">Bien-être en télétravail</p>
      </div>

      {/* STREAK */}
      <div className="mx-6 mb-4 bg-orange-500 text-white rounded-xl p-4">
        🔥 Série : <b>{streak}</b> jour{streak > 1 && "s"}
      </div>

      {/* WATER */}
      <div className="mx-6 bg-blue-500 text-white rounded-xl p-4 mb-4">
        Eau : {waterCount}/{waterGoal}
        <button
          onClick={() => {
            if (waterCount < waterGoal) {
              setWaterCount((c) => c + 1);
              setToday((t) => ({ ...t, water: t.water + 1 }));
            }
          }}
          className="block w-full bg-white text-blue-600 mt-3 py-2 rounded"
        >
          + J’ai bu
        </button>
      </div>

      {/* STATS */}
      <div className="mx-6 bg-white rounded-xl p-4">
        <h2 className="font-semibold mb-2">7 derniers jours</h2>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={chart7}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="water" name="Eau" />
              <Bar dataKey="eye" name="Yeux" />
              <Bar dataKey="stretch" name="Étirements" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

