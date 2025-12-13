// Web / Vercel: no-op

export async function ensureNotificationPermission() {}
export async function cancelReminders() {}

export async function scheduleNextReminders({ enabled, eyeSeconds, stretchSeconds }) {
  // no-op in web
}
