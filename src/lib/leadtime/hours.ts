import { TZ } from "./constants.ts";
import type { HoursRow, PosKey } from "./types.ts";

const POS_PROCESS: Record<PosKey | "SECURITY", string> = {
  SECURITY: "SECURITY",
  TRANSPORT: "TRANSPORT",
  FG: "FG",
  BS: "BS",
  KASIR: "KASIR",
};

function jakartaHm(at: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { day: map[weekday] ?? 1, minutes: hour * 60 + minute };
}

function parseHm(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function posHoursStatus(
  hours: HoursRow[],
  pos: PosKey | "SECURITY",
  at = new Date(),
): { open: boolean; label: string } {
  const process = POS_PROCESS[pos];
  const { day, minutes } = jakartaHm(at);
  const row = hours.find((h) => h.process === process && h.dayOfWeek === day);
  if (!row) return { open: true, label: "Jam tidak di-set" };
  if (row.is24h) return { open: true, label: "24 jam" };
  const open = parseHm(row.openTime);
  const close = parseHm(row.closeTime);
  if (open == null || close == null) return { open: true, label: "24 jam" };
  const isOpen = minutes >= open && minutes <= close;
  return {
    open: isOpen,
    label: `${row.openTime}–${row.closeTime} WIB${isOpen ? "" : " · tutup"}`,
  };
}
