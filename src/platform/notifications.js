// src/platform/notifications.js

/**
 * Ce module fonctionne dans 2 contextes :
 * - Web (Vercel) : fallback no-op (pas d'import Capacitor)
 * - Android/iOS (Capacitor) : import dynamique de @capacitor/local-notifications
 */

function isNativeCapacitor() {
  // Evite tout import Capacitor côté web
  return typeof window !== "undefined" && !!window.Capacitor;
}

async function getLocalNotifications() {
  if (!isNativeCapacitor()) return null;

  // Import dynamique => Vercel/Vite n’essaie pas de résoudre au build web
  const mod = await import("@capacitor/local-notifications");
  return mod.LocalNotifications;
}

export async function ensureNotificationPermission() {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}

export async function cancelReminders() {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;

  await LocalNotifications.cancel({
    notifications: [{ id: 1001 }, { id: 1002 }]
  });
}

export async function scheduleNextReminders({ enabled, eyeSeconds, stretchSeconds }) {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;

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
