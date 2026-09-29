/**
 * LEADTIME — otak aturan (Google Apps Script)
 * Tempel seluruh file ini di Extensions → Apps Script file LEADTIME_APP.
 * Deploy → Web app → Execute as: Me · Who has access: Anyone
 * Salin URL /exec ke Pengaturan Transport di aplikasi.
 *
 * This deployment is intentionally bound to the spreadsheet ID above so the
 * web app does not depend on SpreadsheetApp.getActive() context.
 */

var TZ = "Asia/Jakarta";
var SPREADSHEET_ID = "1ZDEYVRjiu45epHZoeIWqbNPcxak6W-XPAJAobwzRR7I";
var POS_LIST = ["TRANSPORT", "FG", "BS", "KASIR"];

var SHEET_NAMES = {
  MONITOR: ["MONITORING_LEADTIME", "Monitoring", "LEADTIME"],
  EQUIP: ["MASTER_EQUIPMENT", "Master Equipment", "EQUIPMENT"],
  HOURS: ["OPERATING_HOURS", "Operating Hours", "JAM"],
  AKSES: ["NIK_AKSES", "NIK AKSES"],
};

var MONITOR_HEADERS = [
  "NO",
  "TIMESTAMP",
  "NO_POLISI",
  "NO_FO",
  "MOBIL",
  "ANTRI_TRANSPORT",
  "MULAI_TRANSPORT",
  "SELESAI_TRANSPORT",
  "STATUS_TUGAS_TRANSPORT",
  "ANTRI_SKR",
  "MULAI_SKR",
  "SELESAI_SKR",
  "STATUS_TUGAS_FG",
  "ANTRI_TKG",
  "MULAI_TKG",
  "SELESAI_TKG",
  "STATUS_TUGAS_BS",
  "ANTRI_CASH",
  "MULAI_CASH",
  "SELESAI_CASH",
  "STATUS_TUGAS_KASIR",
  "STATUS_AKHIR",
];

var HEADER_ALIASES = {
  NO: ["NO", "NO.", "ID"],
  TIMESTAMP: ["TIMESTAMP", "TIME STAMP", "TIME STAMP"],
  NO_POLISI: ["NO_POLISI", "NO. POLISI", "NOMOR POLISI", "NOPOL"],
  NO_FO: ["NO_FO", "NO. FO", "NO FO", "FO"],
  MOBIL: ["MOBIL", "NAMA MOBIL"],
  ANTRI_TRANSPORT: ["ANTRI_TRANSPORT", "ANTRI TRANSPORT"],
  MULAI_TRANSPORT: ["MULAI_TRANSPORT", "MULAI TRANSPORT"],
  SELESAI_TRANSPORT: ["SELESAI_TRANSPORT", "SELESAI TRANSPORT"],
  STATUS_TUGAS_TRANSPORT: ["STATUS_TUGAS_TRANSPORT", "STATUS TUGAS TRANSPORT"],
  ANTRI_SKR: ["ANTRI_SKR", "ANTRI SKR (FG)", "ANTRI SKR", "ANTRI FG"],
  MULAI_SKR: ["MULAI_SKR", "MULAI SKR (FG)", "MULAI SKR", "MULAI FG"],
  SELESAI_SKR: ["SELESAI_SKR", "SELESAI SKR (FG)", "SELESAI SKR", "SELESAI FG"],
  STATUS_TUGAS_FG: ["STATUS_TUGAS_FG", "STATUS TUGAS FG"],
  ANTRI_TKG: ["ANTRI_TKG", "ANTRI TKG/RL (BS)", "ANTRI TKG/RL", "ANTRI BS"],
  MULAI_TKG: ["MULAI_TKG", "MULAI TKG/RL (BS)", "MULAI TKG/RL", "MULAI BS"],
  SELESAI_TKG: ["SELESAI_TKG", "SELESAI TKG/RL (BS)", "SELESAI TKG/RL", "SELESAI BS"],
  STATUS_TUGAS_BS: ["STATUS_TUGAS_BS", "STATUS TUGAS BS"],
  ANTRI_CASH: ["ANTRI_CASH", "ANTRI CASH (KASIR)", "ANTRI CASH", "ANTRI KASIR"],
  MULAI_CASH: ["MULAI_CASH", "MULAI CASH (KASIR)", "MULAI CASH", "MULAI KASIR"],
  SELESAI_CASH: ["SELESAI_CASH", "SELESAI CASH (KASIR)", "SELESAI CASH", "SELESAI KASIR"],
  STATUS_TUGAS_KASIR: ["STATUS_TUGAS_KASIR", "STATUS TUGAS KASIR", "STATUS TUGAS KAIR"],
  STATUS_AKHIR: ["STATUS_AKHIR", "STATUS AKHIR"],
};

function doGet(e) {
  return json_(handle_(e ? e.parameter : { action: "ping" }));
}

function doPost(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter || {};
    }
  } else if (e && e.parameter) {
    data = e.parameter;
  }
  return json_(handle_(data));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function handle_(req) {
  req = req || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, message: "Sistem sibuk, ulangi sebentar lagi." };
  }
  try {
    ensureSheets_();
    var action = String(req.action || "ping");
    switch (action) {
      case "ping":
        return { ok: true, message: "Otak Apps Script aktif", time: stamp_() };
      case "loginAdmin":
        return loginAdmin_(req);
      case "loginSupir":
        return loginSupir_(req);
      case "getTrip":
        return getTrip_(req);
      case "scanAntri":
        return scanAntri_(req);
      case "scanAdmin":
        return scanAdmin_(req);
      case "mulai":
        return mulai_(req);
      case "selesai":
        return selesai_(req);
      case "skip":
        return skip_(req);
      case "recall":
        return mulai_(req);
      case "queue":
        return listQueue_(req);
      case "trips":
        return listTrips_(req);
      case "hours":
        return { ok: true, hours: readHours_() };
      default:
        return { ok: false, message: "Aksi tidak dikenali: " + action };
    }
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}

function stamp_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss");
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheetByNames_(names, createName, headers) {
  var ss = ss_();
  for (var i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (sh) return sh;
  }
  var created = ss.insertSheet(createName);
  if (headers && headers.length) created.getRange(1, 1, 1, headers.length).setValues([headers]);
  return created;
}

function ensureSheets_() {
  var monitor = sheetByNames_(SHEET_NAMES.MONITOR, "MONITORING_LEADTIME", MONITOR_HEADERS);
  ensureMonitorHeaders_(monitor);
  sheetByNames_(SHEET_NAMES.EQUIP, "MASTER_EQUIPMENT", [
    "NOMOR POLISI",
    "MOBIL",
    "VENDOR",
    "NO. WHATSAPP",
  ]);
  sheetByNames_(SHEET_NAMES.HOURS, "OPERATING_HOURS", [
    "PROCESS",
    "DAY",
    "OPEN TIME",
    "CLOSE TIME",
    "STATUS",
  ]);
  var akses = sheetByNames_(SHEET_NAMES.AKSES, "NIK_AKSES", ["NIK", "NAMA", "POS", "PIN"]);
  if (akses.getLastRow() < 2) {
    akses.getRange(2, 1, 1, 4).setValues([["91130199", "HAFID MUKOWWI", "TRANSPORT", "6789"]]);
  }
}

function normalizeHeader_(v) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function ensureMonitorHeaders_(sh) {
  if (sh.getLastColumn() < 1 || sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, MONITOR_HEADERS.length).setValues([MONITOR_HEADERS]);
    return;
  }
  var existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), MONITOR_HEADERS.length)).getValues()[0];
  var have = {};
  for (var i = 0; i < existing.length; i++) {
    if (existing[i]) have[normalizeHeader_(existing[i])] = true;
  }
  var missing = [];
  for (var h = 0; h < MONITOR_HEADERS.length; h++) {
    var key = MONITOR_HEADERS[h];
    var aliases = HEADER_ALIASES[key] || [key];
    var found = false;
    for (var a = 0; a < aliases.length; a++) {
      if (have[normalizeHeader_(aliases[a])]) {
        found = true;
        break;
      }
    }
    if (!found) missing.push(key);
  }
  if (missing.length) {
    var start = sh.getLastColumn() + 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing]);
  }
}

function colMap_(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var key in HEADER_ALIASES) {
    var aliases = HEADER_ALIASES[key];
    for (var i = 0; i < headers.length; i++) {
      var n = normalizeHeader_(headers[i]);
      for (var a = 0; a < aliases.length; a++) {
        if (n === normalizeHeader_(aliases[a])) {
          map[key] = i + 1;
        }
      }
    }
  }
  return map;
}

function isStamp_(v) {
  if (v === null || v === undefined || v === "") return false;
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) return true;
  var u = String(v).trim().toUpperCase();
  if (!u) return false;
  if (u.indexOf("TIDAK ADA") >= 0 || u === "PENDING" || u === "SKIP") return false;
  return /\d/.test(u);
}

function cellStr_(v) {
  if (v === null || v === undefined || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm:ss");
  }
  return String(v).trim();
}

function get_(row, map, key) {
  var c = map[key];
  if (!c) return "";
  return cellStr_(row[c - 1]);
}

function setCells_(sh, rowIndex, map, patch) {
  for (var key in patch) {
    var c = map[key];
    if (c) sh.getRange(rowIndex, c).setValue(patch[key]);
  }
}

function monitor_() {
  return sheetByNames_(SHEET_NAMES.MONITOR, "MONITORING_LEADTIME", MONITOR_HEADERS);
}

function readTrips_() {
  var sh = monitor_();
  var map = colMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var nopol = normalizeNopol_(get_(values[i], map, "NO_POLISI"));
    if (!nopol) continue;
    out.push(rowToTrip_(values[i], map, i + 2));
  }
  return out;
}

function findTripRow_(nopol, noFo) {
  var sh = monitor_();
  var map = colMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (
      normalizeNopol_(get_(values[i], map, "NO_POLISI")) === nopol &&
      normalizeFo_(get_(values[i], map, "NO_FO")) === noFo
    ) {
      return { rowIndex: i + 2, map: map, trip: rowToTrip_(values[i], map, i + 2), sh: sh };
    }
  }
  return null;
}

function rowToTrip_(row, map, rowIndex) {
  var nopol = normalizeNopol_(get_(row, map, "NO_POLISI"));
  var noFo = normalizeFo_(get_(row, map, "NO_FO"));
  var fgStatus = get_(row, map, "STATUS_TUGAS_FG");
  var bsStatus = get_(row, map, "STATUS_TUGAS_BS");
  var ksStatus = get_(row, map, "STATUS_TUGAS_KASIR");
  var trip = {
    id: rowIndex,
    nopol: nopol,
    noFo: noFo,
    mobil: get_(row, map, "MOBIL"),
    vendor: null,
    wa: null,
    createdAt: get_(row, map, "TIMESTAMP"),
    securityIn: get_(row, map, "TIMESTAMP"),
    transportQueue: emptyToNull_(get_(row, map, "ANTRI_TRANSPORT")),
    transportStart: emptyToNull_(get_(row, map, "MULAI_TRANSPORT")),
    transportEnd: emptyToNull_(get_(row, map, "SELESAI_TRANSPORT")),
    transportStatus: emptyToNull_(get_(row, map, "STATUS_TUGAS_TRANSPORT")),
    fgQueue: emptyToNull_(get_(row, map, "ANTRI_SKR")),
    fgStart: emptyToNull_(get_(row, map, "MULAI_SKR")),
    fgEnd: emptyToNull_(get_(row, map, "SELESAI_SKR")),
    fgStatus: emptyToNull_(fgStatus),
    fgAssignment: assignmentFrom_(get_(row, map, "ANTRI_SKR"), fgStatus),
    bsQueue: emptyToNull_(get_(row, map, "ANTRI_TKG")),
    bsStart: emptyToNull_(get_(row, map, "MULAI_TKG")),
    bsEnd: emptyToNull_(get_(row, map, "SELESAI_TKG")),
    bsStatus: emptyToNull_(bsStatus),
    bsAssignment: assignmentFrom_(get_(row, map, "ANTRI_TKG"), bsStatus),
    kasirQueue: emptyToNull_(get_(row, map, "ANTRI_CASH")),
    kasirStart: emptyToNull_(get_(row, map, "MULAI_CASH")),
    kasirEnd: emptyToNull_(get_(row, map, "SELESAI_CASH")),
    kasirStatus: emptyToNull_(ksStatus),
    kasirAssignment: assignmentFrom_(get_(row, map, "ANTRI_CASH"), ksStatus),
    kasirLunas: lunasFrom_(ksStatus, get_(row, map, "STATUS_AKHIR")),
    overallStatus: emptyToNull_(get_(row, map, "STATUS_AKHIR")) || "BERJALAN",
    notes: null,
  };
  trip.qr = driverQr_(trip);
  trip.action = nextAction_(trip);
  return trip;
}

function emptyToNull_(v) {
  return v ? v : null;
}

function assignmentFrom_(queueCell, status) {
  var u = String(queueCell || status || "").toUpperCase();
  if (u.indexOf("TIDAK ADA") >= 0 || u === "TIDAK_ADA") return "TIDAK_ADA";
  if (u.indexOf("PENDING") >= 0) return "PENDING";
  if (!u) return null;
  return "ADA";
}

function lunasFrom_(kasirStatus, akhir) {
  var u = (String(kasirStatus || "") + " " + String(akhir || "")).toUpperCase();
  if (u.indexOf("BELUM") >= 0 || u.indexOf("TERTAHAN") >= 0) return "BELUM_LUNAS";
  if (u.indexOf("LUNAS") >= 0) return "LUNAS";
  return null;
}

function normalizeNopol_(v) {
  return String(v || "")
    .replace(/[\s.\-]/g, "")
    .toUpperCase();
}

function normalizeFo_(v) {
  return String(v || "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeNik_(v) {
  return String(v || "")
    .replace(/\s+/g, "")
    .trim();
}

function parseScan_(raw) {
  var upper = String(raw || "")
    .trim()
    .toUpperCase();
  var m = upper.match(/^([A-Z0-9]+)\|([A-Z0-9]+)\|(TRANSPORT|FG|BS|KASIR)\|(MULAI|SELESAI)$/);
  if (m) return { kind: "driver", nopol: m[1], noFo: m[2], pos: m[3], status: m[4] };
  var compact = upper.replace(/[\s-]+/g, "_");
  var map = {
    TRANSPORT_ANTRIAN: "TRANSPORT",
    ANTRIAN_TRANSPORT: "TRANSPORT",
    FG_ANTRIAN: "FG",
    ANTRIAN_FG: "FG",
    ANTRIAN_SKR: "FG",
    BS_ANTRIAN: "BS",
    ANTRIAN_BS: "BS",
    KASIR_ANTRIAN: "KASIR",
    ANTRIAN_KASIR: "KASIR",
  };
  if (map[compact]) return { kind: "queue", pos: map[compact] };
  return null;
}

function isStampTrip_(v) {
  return isStamp_(v);
}

function stamps_(trip, pos) {
  if (pos === "TRANSPORT")
    return { queue: trip.transportQueue, start: trip.transportStart, end: trip.transportEnd };
  if (pos === "FG") return { queue: trip.fgQueue, start: trip.fgStart, end: trip.fgEnd };
  if (pos === "BS") return { queue: trip.bsQueue, start: trip.bsStart, end: trip.bsEnd };
  return { queue: trip.kasirQueue, start: trip.kasirStart, end: trip.kasirEnd };
}

function assignmentOf_(trip, pos) {
  if (pos === "TRANSPORT") return "ADA";
  if (pos === "FG") return trip.fgAssignment;
  if (pos === "BS") return trip.bsAssignment;
  return trip.kasirAssignment;
}

function remaining_(trip) {
  if (!isStampTrip_(trip.transportEnd)) return ["TRANSPORT"];
  var out = [];
  var rest = ["FG", "BS", "KASIR"];
  for (var i = 0; i < rest.length; i++) {
    var pos = rest[i];
    var a = assignmentOf_(trip, pos);
    if (a === "TIDAK_ADA") continue;
    var s = stamps_(trip, pos);
    if (a === "PENDING" && !isStampTrip_(s.queue)) continue;
    if (!isStampTrip_(s.end)) out.push(pos);
  }
  return out;
}

function nextAction_(trip) {
  if (trip.overallStatus === "SELESAI") return { type: "DONE" };
  if (trip.overallStatus === "TERTAHAN_KASIR" && isStampTrip_(trip.kasirEnd))
    return { type: "TERTAHAN" };
  if (!isStampTrip_(trip.transportEnd)) {
    if (isStampTrip_(trip.transportStart)) return { type: "IN_SERVICE", pos: "TRANSPORT" };
    if (isStampTrip_(trip.transportQueue)) return { type: "WAIT_QUEUE", pos: "TRANSPORT" };
    return { type: "QUEUE", pos: "TRANSPORT" };
  }
  var left = remaining_(trip);
  if (!left.length) {
    if (trip.kasirLunas === "BELUM_LUNAS") return { type: "TERTAHAN" };
    return { type: "DONE" };
  }
  var pos = left[0];
  var a = assignmentOf_(trip, pos);
  if (a === "PENDING" && !isStampTrip_(stamps_(trip, pos).queue)) return { type: "PENDING", pos: pos };
  var s = stamps_(trip, pos);
  if (isStampTrip_(s.start) && !isStampTrip_(s.end)) return { type: "IN_SERVICE", pos: pos };
  if (isStampTrip_(s.queue) && !isStampTrip_(s.start)) return { type: "WAIT_QUEUE", pos: pos };
  return { type: "QUEUE", pos: pos };
}

function driverQr_(trip) {
  var n = nextAdminScan_(trip);
  return trip.nopol + "|" + trip.noFo + "|" + n.pos + "|" + n.status;
}

function nextAdminScan_(trip) {
  if (!isStampTrip_(trip.transportEnd)) {
    if (isStampTrip_(trip.transportStart)) return { pos: "TRANSPORT", status: "SELESAI" };
    return { pos: "TRANSPORT", status: "MULAI" };
  }
  var rest = ["FG", "BS", "KASIR"];
  for (var i = 0; i < rest.length; i++) {
    var pos = rest[i];
    var a = assignmentOf_(trip, pos);
    if (a === "TIDAK_ADA") continue;
    var s = stamps_(trip, pos);
    if (a === "PENDING" && !isStampTrip_(s.queue)) continue;
    if (isStampTrip_(s.end)) continue;
    if (isStampTrip_(s.start)) return { pos: pos, status: "SELESAI" };
    return { pos: pos, status: "MULAI" };
  }
  return { pos: "KASIR", status: "SELESAI" };
}

function canAccess_(actorPos, target) {
  return actorPos === "TRANSPORT" || actorPos === target;
}

function actor_(req) {
  var pos = String(req.actorPos || "").toUpperCase();
  var nik = normalizeNik_(req.actorNik);
  if (POS_LIST.indexOf(pos) < 0) return { error: "Sesi petugas tidak valid. Login ulang." };
  if (!nik) return { error: "NIK petugas kosong." };
  return { nik: nik, pos: pos };
}

function loginAdmin_(req) {
  var nik = normalizeNik_(req.nik);
  var pin = String(req.pin || "").trim();
  if (!nik || !pin) return { ok: false, message: "NIK dan PIN wajib diisi." };
  var sh = sheetByNames_(SHEET_NAMES.AKSES, "NIK_AKSES", ["NIK", "NAMA", "POS", "PIN"]);
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, message: "Sheet NIK_AKSES masih kosong." };
  var values = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeNik_(values[i][0]) === nik) {
      if (String(values[i][3]).trim() !== pin) return { ok: false, message: "PIN salah." };
      var pos = String(values[i][2] || "")
        .trim()
        .toUpperCase();
      if (POS_LIST.indexOf(pos) < 0)
        return { ok: false, message: 'POS harus TRANSPORT / FG / BS / KASIR.' };
      return {
        ok: true,
        message: "Masuk sebagai " + values[i][1],
        session: { nik: nik, nama: String(values[i][1] || "").trim(), pos: pos },
      };
    }
  }
  return { ok: false, message: "NIK tidak terdaftar di NIK_AKSES." };
}

function lookupEquip_(nopol) {
  var sh = sheetByNames_(SHEET_NAMES.EQUIP, "MASTER_EQUIPMENT", [
    "NOMOR POLISI",
    "MOBIL",
    "VENDOR",
    "NO. WHATSAPP",
  ]);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colN = 1,
    colM = 2,
    colV = 3,
    colW = 4;
  for (var i = 0; i < headers.length; i++) {
    var n = normalizeHeader_(headers[i]);
    if (n.indexOf("POLISI") >= 0 || n === "NOPOL") colN = i + 1;
    if (n === "MOBIL" || n.indexOf("NAMA") >= 0) colM = i + 1;
    if (n === "VENDOR") colV = i + 1;
    if (n.indexOf("WA") >= 0 || n.indexOf("HP") >= 0) colW = i + 1;
  }
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var r = 0; r < values.length; r++) {
    if (normalizeNopol_(values[r][colN - 1]) === nopol) {
      return {
        nopol: nopol,
        mobil: String(values[r][colM - 1] || ""),
        vendor: String(values[r][colV - 1] || ""),
        wa: String(values[r][colW - 1] || ""),
      };
    }
  }
  return null;
}

function loginSupir_(req) {
  var nopol = normalizeNopol_(req.nopol);
  var noFo = normalizeFo_(req.noFo);
  if (!nopol || !noFo) return { ok: false, message: "Nomor polisi dan No. FO wajib diisi." };
  var found = findTripRow_(nopol, noFo);
  if (found) {
    if (found.trip.overallStatus === "SELESAI") {
      return { ok: false, message: "FO " + noFo + " sudah selesai. Pakai No. FO baru." };
    }
    return { ok: true, resumed: true, message: "Sesi dilanjutkan", trip: found.trip };
  }
  var eq = lookupEquip_(nopol);
  var sh = monitor_();
  var map = colMap_(sh);
  var last = sh.getLastRow();
  var nextNo = 1;
  if (last >= 2 && map.NO) {
    var nos = sh.getRange(2, map.NO, last - 1, 1).getValues();
    for (var i = 0; i < nos.length; i++) {
      var n = Number(nos[i][0]);
      if (n > nextNo) nextNo = n;
    }
    nextNo += 1;
  } else {
    nextNo = Math.max(1, last);
  }
  var stamp = stamp_();
  var rowIndex = last + 1;
  if (last < 1) rowIndex = 2;
  var patch = {
    NO: nextNo,
    TIMESTAMP: stamp,
    NO_POLISI: nopol,
    NO_FO: noFo,
    MOBIL: eq ? eq.mobil : "BELUM DI MASTER",
    STATUS_AKHIR: "BERJALAN",
  };
  setCells_(sh, rowIndex, map, patch);
  var trip = findTripRow_(nopol, noFo).trip;
  return {
    ok: true,
    resumed: false,
    message: "Masuk DC tercatat",
    trip: trip,
    warning: eq ? null : "Nopol " + nopol + " belum ada di MASTER_EQUIPMENT.",
  };
}

function getTrip_(req) {
  var found = findTripRow_(normalizeNopol_(req.nopol), normalizeFo_(req.noFo));
  if (!found) return { ok: false, message: "Trip tidak ditemukan." };
  return { ok: true, trip: found.trip };
}

function canQueue_(trip, pos) {
  var action = nextAction_(trip);
  if (action.type === "QUEUE" && action.pos === pos) return { ok: true };
  if (action.type === "PENDING" && action.pos === pos) return { ok: true };
  if (action.type === "WAIT_QUEUE" && action.pos === pos)
    return { ok: false, message: "Sudah antre di " + pos + "." };
  if (action.type === "IN_SERVICE")
    return { ok: false, message: "Masih dilayani di " + action.pos + "." };
  if (action.type === "DONE" || action.type === "TERTAHAN")
    return { ok: false, message: "Tugas trip ini sudah selesai." };
  if (action.type === "QUEUE") return { ok: false, message: "Pos berikutnya adalah " + action.pos + "." };
  return { ok: false, message: "Scan tidak valid untuk status saat ini." };
}

function posCols_(pos) {
  if (pos === "TRANSPORT")
    return { queue: "ANTRI_TRANSPORT", start: "MULAI_TRANSPORT", end: "SELESAI_TRANSPORT", status: "STATUS_TUGAS_TRANSPORT" };
  if (pos === "FG") return { queue: "ANTRI_SKR", start: "MULAI_SKR", end: "SELESAI_SKR", status: "STATUS_TUGAS_FG" };
  if (pos === "BS") return { queue: "ANTRI_TKG", start: "MULAI_TKG", end: "SELESAI_TKG", status: "STATUS_TUGAS_BS" };
  return { queue: "ANTRI_CASH", start: "MULAI_CASH", end: "SELESAI_CASH", status: "STATUS_TUGAS_KASIR" };
}

function scanAntri_(req) {
  var nopol = normalizeNopol_(req.nopol);
  var noFo = normalizeFo_(req.noFo);
  var found = findTripRow_(nopol, noFo);
  if (!found) return { ok: false, message: "Trip tidak ditemukan. Login ulang." };
  var parsed = parseScan_(req.code);
  if (!parsed || parsed.kind !== "queue")
    return { ok: false, message: "Barcode antri tidak dikenali: " + req.code };
  var allowed = canQueue_(found.trip, parsed.pos);
  if (!allowed.ok) return allowed;
  var s = stamps_(found.trip, parsed.pos);
  if (isStampTrip_(s.queue) && !isStampTrip_(s.end)) {
    return { ok: true, trip: found.trip, message: "Sudah ada di antrean " + parsed.pos + "." };
  }
  var cols = posCols_(parsed.pos);
  var patch = {};
  patch[cols.queue] = stamp_();
  patch[cols.status] = "ANTRI";
  setCells_(found.sh, found.rowIndex, found.map, patch);
  return { ok: true, trip: findTripRow_(nopol, noFo).trip, message: "Masuk antrean " + parsed.pos + "." };
}

function scanAdmin_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  var parsed = parseScan_(req.code);
  if (!parsed || parsed.kind !== "driver")
    return { ok: false, message: "Scan barcode HP supir. Format NOPOL|NOFO|POS|STATUS" };
  if (!canAccess_(who.pos, parsed.pos))
    return { ok: false, message: "Akses " + parsed.pos + " ditolak." };
  if (who.pos !== "TRANSPORT" && parsed.pos !== who.pos)
    return { ok: false, message: "Barcode ini untuk " + parsed.pos + ", bukan " + who.pos + "." };
  var found = findTripRow_(parsed.nopol, parsed.noFo);
  if (!found) return { ok: false, message: parsed.nopol + " / " + parsed.noFo + " belum login." };
  if (parsed.status === "MULAI") return start_(found, parsed.pos);
  return { ok: true, needFinish: true, trip: found.trip, pos: parsed.pos };
}

function mulai_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  var pos = String(req.pos || "").toUpperCase();
  if (POS_LIST.indexOf(pos) < 0) return { ok: false, message: "Pos tidak valid." };
  if (!canAccess_(who.pos, pos)) return { ok: false, message: "Akses " + pos + " ditolak." };
  var found = findTripRow_(normalizeNopol_(req.nopol), normalizeFo_(req.noFo));
  if (!found) return { ok: false, message: "Trip tidak ditemukan." };
  return start_(found, pos);
}

function servingNopol_(pos) {
  var trips = readTrips_();
  for (var i = 0; i < trips.length; i++) {
    var s = stamps_(trips[i], pos);
    if (isStampTrip_(s.start) && !isStampTrip_(s.end)) return trips[i].nopol;
  }
  return null;
}

function start_(found, pos) {
  var trip = found.trip;
  var s = stamps_(trip, pos);
  if (isStampTrip_(s.end)) return { ok: false, message: pos + " sudah selesai." };
  if (isStampTrip_(s.start)) return { ok: false, message: "Sudah mulai di " + pos + ". Scan SELESAI." };
  if (!isStampTrip_(s.queue)) return { ok: false, message: "Belum antre di " + pos + "." };
  if (pos !== "TRANSPORT" && !isStampTrip_(trip.transportEnd))
    return { ok: false, message: "Laporan Transport belum selesai." };
  var busy = servingNopol_(pos);
  if (busy && busy !== trip.nopol) return { ok: false, message: "Masih melayani " + busy + ". Selesaikan dulu." };
  var cols = posCols_(pos);
  var patch = {};
  patch[cols.start] = stamp_();
  patch[cols.status] = "MULAI";
  setCells_(found.sh, found.rowIndex, found.map, patch);
  return {
    ok: true,
    trip: findTripRow_(trip.nopol, trip.noFo).trip,
    message: "Mulai " + pos + ".",
  };
}

function tidakAda_(pos) {
  if (pos === "FG") return "TIDAK ADA SKR";
  if (pos === "BS") return "TIDAK ADA TKG/RL";
  return "TIDAK ADA CASH";
}

function selesai_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  var pos = String(req.pos || "").toUpperCase();
  if (POS_LIST.indexOf(pos) < 0) return { ok: false, message: "Pos tidak valid." };
  if (!canAccess_(who.pos, pos)) return { ok: false, message: "Akses " + pos + " ditolak." };
  var found = findTripRow_(normalizeNopol_(req.nopol), normalizeFo_(req.noFo));
  if (!found) return { ok: false, message: "Trip tidak ditemukan." };
  var s = stamps_(found.trip, pos);
  if (!isStampTrip_(s.start)) return { ok: false, message: "Belum mulai di " + pos + "." };
  if (isStampTrip_(s.end)) return { ok: false, message: "Sudah selesai." };
  var patch = {};
  var now = stamp_();
  if (pos === "TRANSPORT") {
    var a = req.assignments || {};
    if (!a.fg || !a.bs || !a.kasir)
      return { ok: false, message: "Isi penugasan FG, BS, dan Kasir." };
    applyAssign_(patch, "FG", a.fg);
    applyAssign_(patch, "BS", a.bs);
    applyAssign_(patch, "KASIR", a.kasir);
  }
  var cols = posCols_(pos);
  patch[cols.end] = now;
  patch[cols.status] = "SELESAI";
  if (pos === "KASIR") {
    var lunas = String(req.lunas || "").toUpperCase();
    if (lunas !== "LUNAS" && lunas !== "BELUM_LUNAS")
      return { ok: false, message: "Pilih Lunas atau Belum lunas." };
    patch.STATUS_TUGAS_KASIR = lunas === "LUNAS" ? "LUNAS" : "BELUM LUNAS";
    patch.STATUS_AKHIR = lunas === "LUNAS" ? "SELESAI" : "TERTAHAN_KASIR";
  }
  setCells_(found.sh, found.rowIndex, found.map, patch);
  var trip = findTripRow_(found.trip.nopol, found.trip.noFo).trip;
  if (pos !== "KASIR") {
    var akhir = overall_(trip);
    setCells_(found.sh, found.rowIndex, found.map, { STATUS_AKHIR: akhir });
    trip = findTripRow_(found.trip.nopol, found.trip.noFo).trip;
  }
  return { ok: true, trip: trip, message: pos + " selesai." };
}

function applyAssign_(patch, pos, choice) {
  var cols = posCols_(pos);
  if (choice === "TIDAK_ADA") {
    var label = tidakAda_(pos);
    patch[cols.queue] = label;
    patch[cols.start] = label;
    patch[cols.end] = label;
    patch[cols.status] = "TIDAK_ADA";
  } else if (choice === "PENDING") {
    patch[cols.queue] = "PENDING";
    patch[cols.start] = "PENDING";
    patch[cols.status] = "PENDING";
  }
}

function overall_(trip) {
  if (trip.kasirLunas === "BELUM_LUNAS" && isStampTrip_(trip.kasirEnd)) return "TERTAHAN_KASIR";
  var action = nextAction_(trip);
  if (action.type === "DONE") return "SELESAI";
  if (action.type === "PENDING") return "PENDING";
  if (action.type === "TERTAHAN") return "TERTAHAN_KASIR";
  return "BERJALAN";
}

function skip_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  if (who.pos !== "TRANSPORT") return { ok: false, message: "Hanya Transport yang bisa melewati antrean." };
  var pos = String(req.pos || "").toUpperCase();
  var found = findTripRow_(normalizeNopol_(req.nopol), normalizeFo_(req.noFo));
  if (!found) return { ok: false, message: "Trip tidak ditemukan." };
  var s = stamps_(found.trip, pos);
  if (!isStampTrip_(s.queue) || isStampTrip_(s.start))
    return { ok: false, message: "Unit ini tidak bisa dilewati sekarang." };
  var cols = posCols_(pos);
  var patch = {};
  patch[cols.status] = "SKIP";
  setCells_(found.sh, found.rowIndex, found.map, patch);
  return { ok: true, message: found.trip.nopol + " dilewati." };
}

function queueStatus_(trip, pos) {
  var s = stamps_(trip, pos);
  var statusCol =
    pos === "TRANSPORT"
      ? trip.transportStatus
      : pos === "FG"
        ? trip.fgStatus
        : pos === "BS"
          ? trip.bsStatus
          : trip.kasirStatus;
  if (!isStampTrip_(s.queue) || isStampTrip_(s.end)) return null;
  if (isStampTrip_(s.start)) return "SERVING";
  if (String(statusCol || "").toUpperCase() === "SKIP") return "SKIPPED";
  return "WAITING";
}

function listQueue_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  var pos = String(req.pos || "").toUpperCase();
  if (POS_LIST.indexOf(pos) < 0) return { ok: false, message: "Pos tidak valid." };
  if (!canAccess_(who.pos, pos)) return { ok: false, message: "Akses " + pos + " ditolak." };
  var trips = readTrips_();
  var rows = [];
  for (var i = 0; i < trips.length; i++) {
    var st = queueStatus_(trips[i], pos);
    if (!st) continue;
    var s = stamps_(trips[i], pos);
    rows.push({
      id: trips[i].id,
      tripId: trips[i].id,
      pos: pos,
      nopol: trips[i].nopol,
      noFo: trips[i].noFo,
      mobil: trips[i].mobil,
      queuedAt: s.queue,
      status: st,
      skipCount: st === "SKIPPED" ? 1 : 0,
    });
  }
  rows.sort(function (a, b) {
    var rank = { SERVING: 0, WAITING: 1, SKIPPED: 2 };
    var r = (rank[a.status] || 9) - (rank[b.status] || 9);
    if (r) return r;
    return String(a.queuedAt).localeCompare(String(b.queuedAt));
  });
  return { ok: true, queue: rows };
}

function listTrips_(req) {
  var who = actor_(req);
  if (who.error) return { ok: false, message: who.error };
  if (who.pos !== "TRANSPORT") return { ok: false, message: "Rekap seluruh pos hanya untuk Transport." };
  return { ok: true, trips: readTrips_() };
}

function readHours_() {
  var sh = sheetByNames_(SHEET_NAMES.HOURS, "OPERATING_HOURS", [
    "PROCESS",
    "DAY",
    "OPEN TIME",
    "CLOSE TIME",
    "STATUS",
  ]);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, 5).getValues();
  var dayMap = {
    SUNDAY: 0,
    SUN: 0,
    MINGGU: 0,
    MONDAY: 1,
    MON: 1,
    SENIN: 1,
    TUESDAY: 2,
    TUE: 2,
    SELASA: 2,
    WEDNESDAY: 3,
    WED: 3,
    RABU: 3,
    THURSDAY: 4,
    THU: 4,
    KAMIS: 4,
    FRIDAY: 5,
    FRI: 5,
    JUMAT: 5,
    SATURDAY: 6,
    SAT: 6,
    SABTU: 6,
  };
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var process = String(values[i][0] || "").toUpperCase();
    var dayRaw = String(values[i][1] || "").toUpperCase();
    var day = dayMap[dayRaw];
    if (day === undefined && values[i][1] !== "") day = Number(values[i][1]);
    var status = String(values[i][4] || "").toUpperCase();
    out.push({
      process: process,
      dayOfWeek: day,
      openTime: cellStr_(values[i][2]) || null,
      closeTime: cellStr_(values[i][3]) || null,
      is24h: status.indexOf("24") >= 0,
    });
  }
  return out;
}
