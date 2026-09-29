import type { AdminSession, DriverSession } from "./types.ts";

const DRIVER_KEY = "leadtime.driver";
const ADMIN_KEY = "leadtime.admin.v2";

export type { AdminSession, DriverSession };

export function readDriverSession(): DriverSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRIVER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverSession;
    if (!parsed.nopol || !parsed.noFo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDriverSession(session: DriverSession | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(DRIVER_KEY);
  else localStorage.setItem(DRIVER_KEY, JSON.stringify(session));
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed.nik || !parsed.pos || !parsed.nama) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAdminSession(session: AdminSession | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(ADMIN_KEY);
  else localStorage.setItem(ADMIN_KEY, JSON.stringify(session));
}
