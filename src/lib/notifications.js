import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Android 13+ : permission runtime requise.
 */
export async function ensureNotificationPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}

/**
 * Replanifie les prochaines notifications (œil + étirements).
 * Note: exactitude dépend d'Android (exact alarm permissions). 
 */
export async function scheduleNextReminders({
  eyeSeconds,
  stretchSeconds,
  enabled = true
}) {
  // On annule ce qu'on a posé avant, puis on reprogramme proprement.
  await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] });

  if (!enabled) return;

  const now = Date.now();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title: "Zenhydratation",
        body: "Pause yeux : 20 secondes (règle 20-20-20).",
        schedule: { at: new Date(now + eyeSeconds * 1000) }
      },
      {
        id: 1002,
        title: "Zenhydratation",
        body: "Étirements : levez-vous et bougez 2 minutes.",
        schedule: { at: new Date(now + stretchSeconds * 1000) }
      }
    ]
  });
}
