// Native (Capacitor Android/iOS)
import { LocalNotifications } from "@capacitor/local-notifications";

export async function ensureNotificationPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}

export async function cancelReminders() {
  await LocalNotifications.cancel({
    notifications: [{ id: 1001 }, { id: 1002 }]
  });
}

export async function scheduleNextReminders({ enabled, eyeSeconds, stretchSeconds }) {
  await cancelReminders();
  if (!enabled) return;

  const now = Date.now();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title: "Zenhydratation",
        body: "Pause yeux : 20 secondes (règle 20-20-20).",
        schedule: { at: new Date(now + Math.max(5, Number(eyeSeconds) || 0) * 1000) }
      },
      {
        id: 1002,
        title: "Zenhydratation",
        body: "Étirements : levez-vous et bougez 2 minutes.",
        schedule: { at: new Date(now + Math.max(5, Number(stretchSeconds) || 0) * 1000) }
      }
    ]
  });
}
