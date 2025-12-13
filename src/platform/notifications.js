// Dispatcher: choisit web vs natif
// IMPORTANT: aucun import de @capacitor/local-notifications ici.

function isNativeCapacitor() {
  return typeof window !== "undefined" && !!window.Capacitor;
}

let implPromise = null;

async function getImpl() {
  if (!implPromise) {
    implPromise = isNativeCapacitor()
      ? import("./notifications.native.js")
      : import("./notifications.web.js");
  }
  return implPromise;
}

export async function ensureNotificationPermission() {
  const impl = await getImpl();
  return impl.ensureNotificationPermission();
}

export async function cancelReminders() {
  const impl = await getImpl();
  return impl.cancelReminders();
}

export async function scheduleNextReminders(args) {
  const impl = await getImpl();
  return impl.scheduleNextReminders(args);
}
