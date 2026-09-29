import { POS_META, POS_ORDER, QUEUE_CODE_ALIASES, TZ } from "./constants.ts";
import type {
  Assignment,
  DriverAction,
  PosKey,
  ScanKind,
  ScanStatus,
  Step,
  Trip,
} from "./types.ts";

export function normalizeNopol(raw: string): string {
  return raw.replace(/[\s.\-]/g, "").toUpperCase();
}

export function normalizeFo(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function normalizeNik(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function isStamp(value: string | null | undefined): boolean {
  if (!value) return false;
  const u = value.trim().toUpperCase();
  if (!u) return false;
  if (u.includes("TIDAK ADA") || u === "PENDING" || u === "SKIP") return false;
  return /\d/.test(u);
}

export function parseStamp(value: string | null | undefined): Date | null {
  if (!isStamp(value)) return null;
  const v = value!.trim();
  const isoish = v.includes("T") ? v : v.replace(" ", "T");
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(isoish) ? isoish : `${isoish}+07:00`;
  const d = new Date(withTz);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseScanCode(raw: string): ScanKind | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();

  const driver = upper.match(
    /^([A-Z0-9]+)\|([A-Z0-9]+)\|(TRANSPORT|FG|BS|KASIR)\|(MULAI|SELESAI)$/,
  );
  if (driver) {
    return {
      kind: "driver",
      nopol: driver[1],
      noFo: driver[2],
      pos: driver[3] as PosKey,
      status: driver[4] as ScanStatus,
    };
  }

  const compact = upper.replace(/[\s-]+/g, "_");
  const mapped = QUEUE_CODE_ALIASES[compact];
  if (mapped) return { kind: "queue", pos: mapped };
  return null;
}

export function driverQrPayload(trip: Trip): string {
  const next = nextAdminScan(trip);
  return `${trip.nopol}|${trip.noFo}|${next.pos}|${next.status}`;
}

export function nextAdminScan(trip: Trip): { pos: PosKey; status: ScanStatus } {
  if (!trip.transportEnd) {
    if (trip.transportStart) return { pos: "TRANSPORT", status: "SELESAI" };
    return { pos: "TRANSPORT", status: "MULAI" };
  }
  for (const pos of ["FG", "BS", "KASIR"] as PosKey[]) {
    const a = assignmentOf(trip, pos);
    if (a === "TIDAK_ADA") continue;
    const s = stamps(trip, pos);
    if (a === "PENDING" && !isStamp(s.queue)) continue;
    if (isStamp(s.end)) continue;
    if (isStamp(s.start)) return { pos, status: "SELESAI" };
    return { pos, status: "MULAI" };
  }
  return { pos: "KASIR", status: "SELESAI" };
}

export function jakartaNow(at = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+07:00`,
  );
}

export function formatStamp(at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

export function fmtClock(value: string | null): string {
  if (!isStamp(value)) return value?.trim() ? value : "—";
  const d = parseStamp(value);
  if (!d) return value ?? "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDateTime(value: string | null): string {
  if (!isStamp(value)) return value?.trim() ? value : "—";
  const d = parseStamp(value);
  if (!d) return value ?? "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDuration(from: string | null, to: string | null): string {
  const ms = durationMs(from, to);
  if (ms == null) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} jam ${m} mnt`;
  if (m > 0) return `${m} mnt ${s} dtk`;
  return `${s} dtk`;
}

export function durationMs(from: string | null, to: string | null): number | null {
  const a = parseStamp(from);
  const b = parseStamp(to);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

export function assignmentOf(trip: Trip, pos: PosKey): Assignment {
  if (pos === "TRANSPORT") return "ADA";
  if (pos === "FG") return trip.fgAssignment;
  if (pos === "BS") return trip.bsAssignment;
  return trip.kasirAssignment;
}

export function stamps(trip: Trip, pos: PosKey) {
  if (pos === "TRANSPORT") {
    return {
      queue: trip.transportQueue,
      start: trip.transportStart,
      end: trip.transportEnd,
    };
  }
  if (pos === "FG") {
    return { queue: trip.fgQueue, start: trip.fgStart, end: trip.fgEnd };
  }
  if (pos === "BS") {
    return { queue: trip.bsQueue, start: trip.bsStart, end: trip.bsEnd };
  }
  return { queue: trip.kasirQueue, start: trip.kasirStart, end: trip.kasirEnd };
}

export function remainingPos(trip: Trip): PosKey[] {
  if (!trip.transportEnd) return ["TRANSPORT"];
  return (["FG", "BS", "KASIR"] as PosKey[]).filter((pos) => {
    const a = assignmentOf(trip, pos);
    if (a === "TIDAK_ADA") return false;
    if (a === "PENDING" && !isStamp(stamps(trip, pos).queue)) return false;
    return !isStamp(stamps(trip, pos).end);
  });
}

export function nextDriverAction(trip: Trip): DriverAction {
  if (trip.overallStatus === "SELESAI") return { type: "DONE" };
  if (trip.overallStatus === "TERTAHAN_KASIR" && isStamp(trip.kasirEnd)) {
    return { type: "TERTAHAN" };
  }
  if (!trip.transportEnd) {
    if (isStamp(trip.transportStart)) return { type: "IN_SERVICE", pos: "TRANSPORT" };
    if (isStamp(trip.transportQueue)) return { type: "WAIT_QUEUE", pos: "TRANSPORT" };
    return { type: "QUEUE", pos: "TRANSPORT" };
  }

  const left = remainingPos(trip);
  if (left.length === 0) {
    if (trip.kasirLunas === "BELUM_LUNAS") return { type: "TERTAHAN" };
    return { type: "DONE" };
  }

  const pos = left[0];
  const a = assignmentOf(trip, pos);
  if (a === "PENDING" && !isStamp(stamps(trip, pos).queue)) {
    return { type: "PENDING", pos };
  }
  const s = stamps(trip, pos);
  if (isStamp(s.start) && !isStamp(s.end)) return { type: "IN_SERVICE", pos };
  if (isStamp(s.queue) && !isStamp(s.start)) return { type: "WAIT_QUEUE", pos };
  return { type: "QUEUE", pos };
}

export function canQueueAt(trip: Trip, pos: PosKey): { ok: true } | { ok: false; message: string } {
  const action = nextDriverAction(trip);
  if (action.type === "QUEUE" && action.pos === pos) return { ok: true };
  if (action.type === "PENDING" && action.pos === pos) {
    return { ok: true };
  }
  if (action.type === "WAIT_QUEUE" && action.pos === pos) {
    return { ok: true };
  }
  if (action.type === "IN_SERVICE") {
    return {
      ok: false,
      message: `Masih dilayani di ${POS_META[action.pos].label}.`,
    };
  }
  if (action.type === "DONE" || action.type === "TERTAHAN") {
    return { ok: false, message: "Tugas trip ini sudah selesai." };
  }
  if (action.type === "QUEUE") {
    return {
      ok: false,
      message: `Pos berikutnya adalah ${POS_META[action.pos].label}.`,
    };
  }
  if (action.type === "PENDING") {
    return {
      ok: false,
      message: `Masih pending di ${POS_META[action.pos].label}. Minta Transport ubah jika pos sudah buka.`,
    };
  }
  if (action.type === "WAIT_QUEUE") {
    return {
      ok: false,
      message: `Masih antre di ${POS_META[action.pos].label}.`,
    };
  }
  return { ok: false, message: "Scan tidak valid untuk status saat ini." };
}

export function canActorAccess(actorPos: PosKey, targetPos: PosKey): boolean {
  return actorPos === "TRANSPORT" || actorPos === targetPos;
}

export function tripSteps(trip: Trip): Step[] {
  const action = nextDriverAction(trip);
  const steps: Step[] = [
    {
      id: "SECURITY",
      label: "Datang DC",
      state: trip.securityIn ? "done" : "current",
      detail: trip.securityIn ? fmtClock(trip.securityIn) : "Login di gerbang",
    },
  ];

  for (const pos of POS_ORDER) {
    const a = assignmentOf(trip, pos);
    const s = stamps(trip, pos);
    let state: Step["state"] = "locked";
    let detail = "Menunggu giliran";

    if (pos !== "TRANSPORT" && !trip.transportEnd) {
      state = "locked";
      detail = "Menunggu transport";
    } else if (a === "TIDAK_ADA") {
      state = "skipped";
      detail =
        pos === "FG" ? "Tidak ada SKR" : pos === "BS" ? "Tidak ada TKG/RL" : "Tidak ada cash";
    } else if (isStamp(s.end)) {
      state = "done";
      detail = fmtClock(s.end);
    } else if (a === "PENDING" && !isStamp(s.queue)) {
      state = "pending";
      detail = "Pending · lanjut besok";
    } else if (
      (action.type === "QUEUE" ||
        action.type === "WAIT_QUEUE" ||
        action.type === "IN_SERVICE" ||
        action.type === "PENDING") &&
      action.pos === pos
    ) {
      state = "current";
      if (action.type === "IN_SERVICE") detail = `Sedang dilayani · ${fmtClock(s.start)}`;
      else if (action.type === "WAIT_QUEUE") detail = `Antre · ${fmtClock(s.queue)}`;
      else if (action.type === "PENDING") detail = "Pending · pos tutup";
      else detail = `Siap antre · ${POS_META[pos].queueCode}`;
    }

    steps.push({
      id: pos,
      label: POS_META[pos].label,
      state,
      detail,
    });
  }
  return steps;
}

export function cellLabel(
  assignment: Assignment,
  stamp: string | null,
  emptyNoun: string,
): string {
  if (assignment === "TIDAK_ADA") return `Tidak ada ${emptyNoun}`;
  if (assignment === "PENDING" && !isStamp(stamp)) return "Pending";
  return fmtDateTime(stamp);
}

export function overallFromTrip(trip: Trip): Trip["overallStatus"] {
  if (trip.kasirLunas === "BELUM_LUNAS" && isStamp(trip.kasirEnd)) return "TERTAHAN_KASIR";
  const action = nextDriverAction({ ...trip, overallStatus: "BERJALAN" });
  if (action.type === "DONE") return "SELESAI";
  if (action.type === "PENDING") return "PENDING";
  if (action.type === "TERTAHAN") return "TERTAHAN_KASIR";
  return "BERJALAN";
}

export function emptyNoun(pos: PosKey): string {
  if (pos === "FG") return "SKR";
  if (pos === "BS") return "TKG/RL";
  if (pos === "KASIR") return "cash";
  return "";
}

export function tidakAdaLabel(pos: PosKey): string {
  if (pos === "FG") return "TIDAK ADA SKR";
  if (pos === "BS") return "TIDAK ADA TKG/RL";
  if (pos === "KASIR") return "TIDAK ADA CASH";
  return "TIDAK ADA";
}
