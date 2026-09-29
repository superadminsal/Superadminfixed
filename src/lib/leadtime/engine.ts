import { POS_META } from "./constants.ts";
import { posHoursStatus } from "./hours.ts";
import {
  assignmentOf,
  canActorAccess,
  canQueueAt,
  driverQrPayload,
  emptyNoun,
  formatStamp,
  isStamp,
  nextDriverAction,
  normalizeFo,
  normalizeNik,
  normalizeNopol,
  overallFromTrip,
  parseScanCode,
  stamps,
  tidakAdaLabel,
} from "./logic.ts";
import type {
  AccessRow,
  Assignment,
  Assignments,
  BrainRequest,
  BrainResponse,
  Equipment,
  HoursRow,
  LunasStatus,
  PosKey,
  QueueEntry,
  Trip,
} from "./types.ts";

export type Db = {
  trips: Trip[];
  equipment: Equipment[];
  hours: HoursRow[];
  akses: AccessRow[];
  queues: QueueEntry[];
  nextTripId: number;
  nextQueueId: number;
};

const POS_KEYS: PosKey[] = ["TRANSPORT", "FG", "BS", "KASIR"];

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asPos(v: unknown): PosKey | null {
  const p = asString(v).toUpperCase();
  return POS_KEYS.includes(p as PosKey) ? (p as PosKey) : null;
}

function findTrip(db: Db, nopol: string, noFo: string): Trip | undefined {
  return db.trips.find((t) => t.nopol === nopol && t.noFo === noFo);
}

function queueOf(db: Db, tripId: number, pos: PosKey): QueueEntry | undefined {
  return db.queues.find((q) => q.tripId === tripId && q.pos === pos);
}

function lookupEquipment(db: Db, nopol: string): Equipment | undefined {
  return db.equipment.find((e) => e.nopol === nopol);
}

function actor(req: BrainRequest): { nik: string; pos: PosKey } | { error: string } {
  const pos = asPos(req.actorPos);
  const nik = normalizeNik(asString(req.actorNik));
  if (!pos) return { error: "Sesi petugas tidak valid. Login ulang." };
  if (!nik) return { error: "NIK petugas kosong." };
  return { nik, pos };
}

function guardPos(
  actorPos: PosKey,
  target: PosKey,
): BrainResponse | null {
  if (canActorAccess(actorPos, target)) return null;
  return { ok: false, message: `Akses ${POS_META[target].label} hanya untuk pos itu dan Transport.` };
}

function setPosStamps(
  trip: Trip,
  pos: PosKey,
  patch: { queue?: string | null; start?: string | null; end?: string | null; status?: Trip["transportStatus"]; assignment?: Assignment; lunas?: LunasStatus },
) {
  if (pos === "TRANSPORT") {
    if (patch.queue !== undefined) trip.transportQueue = patch.queue;
    if (patch.start !== undefined) trip.transportStart = patch.start;
    if (patch.end !== undefined) trip.transportEnd = patch.end;
    if (patch.status !== undefined) trip.transportStatus = patch.status;
  } else if (pos === "FG") {
    if (patch.queue !== undefined) trip.fgQueue = patch.queue;
    if (patch.start !== undefined) trip.fgStart = patch.start;
    if (patch.end !== undefined) trip.fgEnd = patch.end;
    if (patch.status !== undefined) trip.fgStatus = patch.status;
    if (patch.assignment !== undefined) trip.fgAssignment = patch.assignment;
  } else if (pos === "BS") {
    if (patch.queue !== undefined) trip.bsQueue = patch.queue;
    if (patch.start !== undefined) trip.bsStart = patch.start;
    if (patch.end !== undefined) trip.bsEnd = patch.end;
    if (patch.status !== undefined) trip.bsStatus = patch.status;
    if (patch.assignment !== undefined) trip.bsAssignment = patch.assignment;
  } else {
    if (patch.queue !== undefined) trip.kasirQueue = patch.queue;
    if (patch.start !== undefined) trip.kasirStart = patch.start;
    if (patch.end !== undefined) trip.kasirEnd = patch.end;
    if (patch.status !== undefined) trip.kasirStatus = patch.status;
    if (patch.assignment !== undefined) trip.kasirAssignment = patch.assignment;
    if (patch.lunas !== undefined) trip.kasirLunas = patch.lunas;
  }
}

function refreshTrip(trip: Trip) {
  trip.overallStatus = overallFromTrip(trip);
}

function tripPublic(trip: Trip) {
  return { ...trip, qr: driverQrPayload(trip), action: nextDriverAction(trip) };
}

export function handleBrain(db: Db, req: BrainRequest, now = new Date()): BrainResponse {
  const action = asString(req.action);
  switch (action) {
    case "ping":
      return { ok: true, message: "Otak aktif", time: formatStamp(now) };
    case "loginAdmin":
      return loginAdmin(db, req);
    case "loginSupir":
      return loginSupir(db, req, now);
    case "getTrip":
      return getTrip(db, req);
    case "scanAntri":
      return scanAntri(db, req, now);
    case "scanAdmin":
      return scanAdmin(db, req, now);
    case "mulai":
      return mulai(db, req, now);
    case "selesai":
      return selesai(db, req, now);
    case "skip":
      return skip(db, req);
    case "recall":
      return mulai(db, req, now);
    case "queue":
      return listQueue(db, req);
    case "trips":
      return listTrips(db, req);
    case "hours":
      return { ok: true, hours: db.hours };
    case "aksesDummy":
      return { ok: true };
    default:
      return { ok: false, message: `Aksi tidak dikenali: ${action}` };
  }
}

function loginAdmin(db: Db, req: BrainRequest): BrainResponse {
  const nik = normalizeNik(asString(req.nik));
  const pin = asString(req.pin).trim();
  if (!nik || !pin) return { ok: false, message: "NIK dan PIN wajib diisi." };
  const row = db.akses.find((a) => a.nik === nik);
  if (!row) return { ok: false, message: "NIK tidak terdaftar di NIK_AKSES." };
  if (row.pin !== pin) return { ok: false, message: "PIN salah." };
  if (!POS_KEYS.includes(row.pos)) {
    return { ok: false, message: `POS "${row.pos}" tidak valid. Isi TRANSPORT / FG / BS / KASIR.` };
  }
  return {
    ok: true,
    message: `Masuk sebagai ${row.nama}`,
    session: { nik: row.nik, nama: row.nama, pos: row.pos },
  };
}

function loginSupir(db: Db, req: BrainRequest, now: Date): BrainResponse {
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  if (!nopol || !noFo) {
    return { ok: false, message: "Nomor polisi dan No. FO wajib diisi." };
  }
  const eq = lookupEquipment(db, nopol);
  const mobil = eq?.mobil ?? "BELUM DI MASTER";
  const existing = findTrip(db, nopol, noFo);
  if (existing) {
    if (existing.overallStatus === "SELESAI") {
      return {
        ok: false,
        message: `FO ${noFo} sudah selesai. Pakai No. FO baru untuk trip berikutnya.`,
      };
    }
    return {
      ok: true,
      resumed: true,
      message: "Sesi dilanjutkan",
      trip: tripPublic(existing),
      warning: eq ? undefined : `Nopol ${nopol} belum ada di MASTER_EQUIPMENT.`,
    };
  }
  const stamp = formatStamp(now);
  const trip: Trip = {
    id: db.nextTripId++,
    nopol,
    noFo,
    mobil,
    vendor: eq?.vendor ?? null,
    wa: eq?.wa ?? null,
    createdAt: stamp,
    securityIn: stamp,
    transportQueue: null,
    transportStart: null,
    transportEnd: null,
    transportStatus: null,
    fgAssignment: null,
    fgQueue: null,
    fgStart: null,
    fgEnd: null,
    fgStatus: null,
    bsAssignment: null,
    bsQueue: null,
    bsStart: null,
    bsEnd: null,
    bsStatus: null,
    kasirAssignment: null,
    kasirQueue: null,
    kasirStart: null,
    kasirEnd: null,
    kasirStatus: null,
    kasirLunas: null,
    overallStatus: "BERJALAN",
    notes: null,
  };
  db.trips.unshift(trip);
  return {
    ok: true,
    resumed: false,
    message: "Masuk DC tercatat",
    trip: tripPublic(trip),
    warning: eq ? undefined : `Nopol ${nopol} belum ada di MASTER_EQUIPMENT.`,
  };
}

function getTrip(db: Db, req: BrainRequest): BrainResponse {
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  const trip = findTrip(db, nopol, noFo);
  if (!trip) return { ok: false, message: "Trip tidak ditemukan." };
  return { ok: true, trip: tripPublic(trip) };
}

function scanAntri(db: Db, req: BrainRequest, now: Date): BrainResponse {
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  const trip = findTrip(db, nopol, noFo);
  if (!trip) return { ok: false, message: "Trip tidak ditemukan. Login ulang." };
  const parsed = parseScanCode(asString(req.code));
  if (!parsed || parsed.kind !== "queue") {
    return { ok: false, message: `Barcode antri tidak dikenali: ${asString(req.code)}` };
  }
  const allowed = canQueueAt(trip, parsed.pos);
  if (!allowed.ok) return allowed;
  const clock = posHoursStatus(db.hours, parsed.pos, now);
  if (!clock.open && parsed.pos !== "TRANSPORT") {
    return {
      ok: false,
      message: `${POS_META[parsed.pos].label} tutup (${clock.label}). Minta Transport set Pending.`,
    };
  }
  return enqueue(db, trip, parsed.pos, now);
}

function enqueue(db: Db, trip: Trip, pos: PosKey, now: Date): BrainResponse {
  const stamp = formatStamp(now);
  const existing = queueOf(db, trip.id, pos);
  if (existing && existing.status !== "DONE") {
    return { ok: true, trip: tripPublic(trip), message: `Sudah ada di antrean ${POS_META[pos].label}.` };
  }
  if (existing) {
    existing.status = "WAITING";
    existing.queuedAt = stamp;
    existing.skipCount = 0;
  } else {
    db.queues.push({
      id: db.nextQueueId++,
      tripId: trip.id,
      pos,
      nopol: trip.nopol,
      noFo: trip.noFo,
      mobil: trip.mobil,
      queuedAt: stamp,
      status: "WAITING",
      skipCount: 0,
    });
  }
  setPosStamps(trip, pos, { queue: stamp, status: "ANTRI" });
  if (pos !== "TRANSPORT") {
    const a = assignmentOf(trip, pos);
    if (a === "PENDING") setPosStamps(trip, pos, { assignment: "ADA" });
  }
  refreshTrip(trip);
  return { ok: true, trip: tripPublic(trip), message: `Masuk antrean ${POS_META[pos].label}.` };
}

function scanAdmin(db: Db, req: BrainRequest, now: Date): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  const parsed = parseScanCode(asString(req.code));
  if (!parsed || parsed.kind !== "driver") {
    return {
      ok: false,
      message: "Scan barcode HP supir. Format NOPOL|NOFO|POS|STATUS",
    };
  }
  const blocked = guardPos(who.pos, parsed.pos);
  if (blocked) return blocked;
  if (who.pos !== "TRANSPORT" && parsed.pos !== who.pos) {
    return { ok: false, message: `Barcode ini untuk ${parsed.pos}, bukan ${who.pos}.` };
  }
  const trip = findTrip(db, parsed.nopol, parsed.noFo);
  if (!trip) return { ok: false, message: `${parsed.nopol} / ${parsed.noFo} belum login.` };
  if (parsed.status === "MULAI") {
    return startService(db, trip, parsed.pos, now);
  }
  return { ok: true, needFinish: true, trip: tripPublic(trip), pos: parsed.pos };
}

function mulai(db: Db, req: BrainRequest, now: Date): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  const pos = asPos(req.pos);
  if (!pos) return { ok: false, message: "Pos tidak valid." };
  const blocked = guardPos(who.pos, pos);
  if (blocked) return blocked;
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  const trip = findTrip(db, nopol, noFo);
  if (!trip) return { ok: false, message: "Trip tidak ditemukan." };
  return startService(db, trip, pos, now);
}

function startService(db: Db, trip: Trip, pos: PosKey, now: Date): BrainResponse {
  const s = stamps(trip, pos);
  if (isStamp(s.end)) return { ok: false, message: `${POS_META[pos].label} sudah selesai.` };
  if (isStamp(s.start)) return { ok: false, message: `Sudah mulai di ${POS_META[pos].label}. Scan SELESAI.` };
  if (!isStamp(s.queue)) return { ok: false, message: `Belum antre di ${POS_META[pos].label}.` };
  if (pos !== "TRANSPORT") {
    const a = assignmentOf(trip, pos);
    if (a === "TIDAK_ADA") return { ok: false, message: `Transport menandai tidak ada ${emptyNoun(pos)}.` };
    if (!trip.transportEnd) return { ok: false, message: "Laporan Transport belum selesai." };
  }
  const serving = db.queues.find((q) => q.pos === pos && q.status === "SERVING");
  if (serving && serving.tripId !== trip.id) {
    return {
      ok: false,
      message: `Masih melayani ${serving.nopol}. Selesaikan dulu.`,
    };
  }
  const q = queueOf(db, trip.id, pos);
  if (q) q.status = "SERVING";
  const stamp = formatStamp(now);
  setPosStamps(trip, pos, { start: stamp, status: "MULAI" });
  refreshTrip(trip);
  return { ok: true, trip: tripPublic(trip), message: `Mulai ${POS_META[pos].task}.` };
}

function selesai(db: Db, req: BrainRequest, now: Date): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  const pos = asPos(req.pos);
  if (!pos) return { ok: false, message: "Pos tidak valid." };
  const blocked = guardPos(who.pos, pos);
  if (blocked) return blocked;
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  const trip = findTrip(db, nopol, noFo);
  if (!trip) return { ok: false, message: "Trip tidak ditemukan." };
  const s = stamps(trip, pos);
  if (!isStamp(s.start)) return { ok: false, message: `Belum mulai di ${POS_META[pos].label}.` };
  if (isStamp(s.end)) return { ok: false, message: "Sudah selesai." };

  if (pos === "TRANSPORT") {
    const raw = req.assignments as Assignments | undefined;
    if (!raw?.fg || !raw.bs || !raw.kasir) {
      return { ok: false, message: "Isi penugasan FG, BS, dan Kasir (Ada / Tidak ada / Pending)." };
    }
    applyAssignments(trip, raw, formatStamp(now));
  }
  if (pos === "KASIR") {
    const lunas = asString(req.lunas).toUpperCase();
    if (lunas !== "LUNAS" && lunas !== "BELUM_LUNAS") {
      return { ok: false, message: "Pilih Lunas atau Belum lunas." };
    }
    trip.kasirLunas = lunas as LunasStatus;
  }

  const stamp = formatStamp(now);
  setPosStamps(trip, pos, { end: stamp, status: "SELESAI" });
  const q = queueOf(db, trip.id, pos);
  if (q) q.status = "DONE";
  refreshTrip(trip);
  return { ok: true, trip: tripPublic(trip), message: `${POS_META[pos].label} selesai.` };
}

function applyAssignments(trip: Trip, a: Assignments, stamp: string) {
  trip.fgAssignment = a.fg;
  trip.bsAssignment = a.bs;
  trip.kasirAssignment = a.kasir;
  for (const pos of ["FG", "BS", "KASIR"] as PosKey[]) {
    const choice = pos === "FG" ? a.fg : pos === "BS" ? a.bs : a.kasir;
    if (choice === "TIDAK_ADA") {
      const label = tidakAdaLabel(pos);
      setPosStamps(trip, pos, { queue: label, start: label, end: label, status: "TIDAK_ADA", assignment: "TIDAK_ADA" });
    } else if (choice === "PENDING") {
      setPosStamps(trip, pos, { queue: "PENDING", start: "PENDING", end: null, status: "PENDING", assignment: "PENDING" });
    } else {
      setPosStamps(trip, pos, { assignment: "ADA" });
    }
  }
  void stamp;
}

function skip(db: Db, req: BrainRequest): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  if (who.pos !== "TRANSPORT") {
    return { ok: false, message: "Hanya Transport yang bisa melewati antrean." };
  }
  const pos = asPos(req.pos);
  if (!pos) return { ok: false, message: "Pos tidak valid." };
  const nopol = normalizeNopol(asString(req.nopol));
  const noFo = normalizeFo(asString(req.noFo));
  const trip = findTrip(db, nopol, noFo);
  if (!trip) return { ok: false, message: "Trip tidak ditemukan." };
  const q = queueOf(db, trip.id, pos);
  if (!q || q.status === "DONE" || q.status === "SERVING") {
    return { ok: false, message: "Unit ini tidak bisa dilewati sekarang." };
  }
  q.status = "SKIPPED";
  q.skipCount += 1;
  setPosStamps(trip, pos, { status: "SKIP" });
  return { ok: true, message: `${q.nopol} dilewati. Panggil lagi jika sudah di tempat.` };
}

function listQueue(db: Db, req: BrainRequest): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  const pos = asPos(req.pos);
  if (!pos) return { ok: false, message: "Pos tidak valid." };
  const blocked = guardPos(who.pos, pos);
  if (blocked) return blocked;
  const rows = db.queues
    .filter((q) => q.pos === pos && q.status !== "DONE")
    .slice()
    .sort((a, b) => {
      const rank = (s: QueueEntry["status"]) => (s === "SERVING" ? 0 : s === "WAITING" ? 1 : 2);
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return a.queuedAt.localeCompare(b.queuedAt);
    });
  return { ok: true, queue: rows };
}

function listTrips(db: Db, req: BrainRequest): BrainResponse {
  const who = actor(req);
  if ("error" in who) return { ok: false, message: who.error };
  if (who.pos !== "TRANSPORT") {
    return { ok: false, message: "Rekap seluruh pos hanya untuk Transport." };
  }
  return { ok: true, trips: db.trips.map(tripPublic) };
}

export function seedDb(): Db {
  const hours: HoursRow[] = [];
  const mk = (process: string, day: number, open: string | null, close: string | null, is24h: boolean) => {
    hours.push({ process, dayOfWeek: day, openTime: open, closeTime: close, is24h });
  };
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    mk("TRANSPORT", day, day === 0 ? "06:00" : null, day === 0 ? "23:00" : null, day !== 0);
    mk("SECURITY", day, day === 0 ? "06:00" : null, day === 0 ? "23:00" : null, day !== 0);
  }
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (day === 1) mk("FG", day, "00:00", "23:00", false);
    else if (day === 6) mk("FG", day, "06:00", "20:00", false);
    else mk("FG", day, "06:00", "23:00", false);
  }
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (day === 1) mk("BS", day, "00:00", "23:00", false);
    else if (day === 6) mk("BS", day, "07:00", "20:00", false);
    else if (day === 0) mk("BS", day, "06:00", "23:00", false);
    else mk("BS", day, "07:00", "23:00", false);
  }
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (day === 1) mk("KASIR", day, "00:00", "23:00", false);
    else if (day === 6) mk("KASIR", day, "06:30", "20:00", false);
    else if (day === 0) mk("KASIR", day, "06:00", "23:00", false);
    else mk("KASIR", day, "06:30", "22:00", false);
  }

  return {
    nextTripId: 1,
    nextQueueId: 1,
    trips: [],
    queues: [],
    hours,
    akses: [
      { nik: "91130199", nama: "HAFID MUKOWWI", pos: "TRANSPORT", pin: "6789" },
      { nik: "91130001", nama: "PETUGAS FG", pos: "FG", pin: "1111" },
      { nik: "91130002", nama: "PETUGAS BS", pos: "BS", pin: "2222" },
      { nik: "91130003", nama: "PETUGAS KASIR", pos: "KASIR", pin: "3333" },
    ],
    equipment: [
      { nopol: "B9284SXX", mobil: "6D JPM", vendor: "JPM", wa: "6285860458619" },
      { nopol: "B1234SAL", mobil: "SAL-DEMO", vendor: "MAJR", wa: "6281234567890" },
      { nopol: "B9150UCY", mobil: "BINTARO-TRAC003", vendor: "DKS", wa: "6285693229085" },
      { nopol: "B9335UCZ", mobil: "BINTARO-TRAC008", vendor: "DKS", wa: "6285716298360" },
      { nopol: "B9373SXS", mobil: "SAL-MAJR001", vendor: "MAJR", wa: "6283129217890" },
      { nopol: "B9369SXS", mobil: "SAL-MAJR002", vendor: "MAJR", wa: "6289655898055" },
      { nopol: "B9095UCY", mobil: "SAL-TRAC003", vendor: "JPM", wa: "6285811160395" },
      { nopol: "B9214VCD", mobil: "SAL-TTP001", vendor: "TTP", wa: "6281400792756" },
    ],
  };
}
