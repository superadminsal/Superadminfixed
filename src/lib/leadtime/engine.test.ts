import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleBrain, seedDb } from "./engine.ts";
import { driverQrPayload, parseScanCode } from "./logic.ts";

describe("barcode format", () => {
  it("reads wall queue codes", () => {
    assert.deepEqual(parseScanCode("TRANSPORT_ANTRIAN"), { kind: "queue", pos: "TRANSPORT" });
    assert.deepEqual(parseScanCode("FG_ANTRIAN"), { kind: "queue", pos: "FG" });
    assert.deepEqual(parseScanCode("BS_ANTRIAN"), { kind: "queue", pos: "BS" });
    assert.deepEqual(parseScanCode("KASIR_ANTRIAN"), { kind: "queue", pos: "KASIR" });
  });

  it("reads driver QR NOPOL|NOFO|POS|STATUS", () => {
    assert.deepEqual(parseScanCode("B9284SXX|3200123456|FG|MULAI"), {
      kind: "driver",
      nopol: "B9284SXX",
      noFo: "3200123456",
      pos: "FG",
      status: "MULAI",
    });
    assert.deepEqual(parseScanCode("B1234SAL|3200123123|KASIR|SELESAI"), {
      kind: "driver",
      nopol: "B1234SAL",
      noFo: "3200123123",
      pos: "KASIR",
      status: "SELESAI",
    });
  });
});

describe("leadtime brain", () => {
  it("logs admin via NIK_AKSES and routes by POS", () => {
    const db = seedDb();
    const res = handleBrain(db, { action: "loginAdmin", nik: "91130199", pin: "6789" });
    assert.equal(res.ok, true);
    const session = res.session as { pos: string; nama: string };
    assert.equal(session.pos, "TRANSPORT");
    assert.equal(session.nama, "HAFID MUKOWWI");

    const bad = handleBrain(db, { action: "loginAdmin", nik: "91130199", pin: "0000" });
    assert.equal(bad.ok, false);

    const fg = handleBrain(db, { action: "loginAdmin", nik: "91130001", pin: "1111" });
    assert.equal((fg.session as { pos: string }).pos, "FG");
  });

  it("writes TIMESTAMP on driver login and does not overwrite on resume", () => {
    const db = seedDb();
    const t1 = new Date("2026-09-27T03:00:00+07:00");
    const first = handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" }, t1);
    assert.equal(first.ok, true);
    const trip1 = first.trip as { securityIn: string; nopol: string };
    assert.equal(trip1.nopol, "B9284SXX");
    assert.match(trip1.securityIn, /2026-09-27 03:00:00/);

    const t2 = new Date("2026-09-27T04:00:00+07:00");
    const resume = handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" }, t2);
    assert.equal(resume.ok, true);
    assert.equal(resume.resumed, true);
    assert.equal((resume.trip as { securityIn: string }).securityIn, trip1.securityIn);
  });

  it("walks antri → mulai → selesai transport with bypass", () => {
    const db = seedDb();
    const actor = { actorNik: "91130199", actorPos: "TRANSPORT" };
    handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" });

    const antri = handleBrain(db, {
      action: "scanAntri",
      nopol: "B9284SXX",
      noFo: "3200123456",
      code: "TRANSPORT_ANTRIAN",
    });
    assert.equal(antri.ok, true);

    const trip = antri.trip!;
    assert.equal(driverQrPayload(trip), "B9284SXX|3200123456|TRANSPORT|MULAI");

    const code = driverQrPayload(trip);
    const scanMulai = handleBrain(db, {
      action: "scanAdmin",
      code,
      ...actor,
    });
    assert.equal(scanMulai.ok, true);
    assert.equal((scanMulai.trip as { transportStatus: string }).transportStatus, "MULAI");

    const finish = handleBrain(db, {
      action: "selesai",
      nopol: "B9284SXX",
      noFo: "3200123456",
      pos: "TRANSPORT",
      assignments: { fg: "TIDAK_ADA", bs: "PENDING", kasir: "ADA" },
      ...actor,
    });
    assert.equal(finish.ok, true);
    const done = finish.trip!;
    assert.equal(done.fgQueue, "TIDAK ADA SKR");
    assert.equal(done.fgStatus, "TIDAK_ADA");
    assert.equal(done.bsQueue, "PENDING");
    assert.equal(driverQrPayload(done), "B9284SXX|3200123456|KASIR|MULAI");
    assert.equal(done.overallStatus, "BERJALAN");
  });

  it("rejects FG from reading kasir queue and starting other pos", () => {
    const db = seedDb();
    handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" });
    handleBrain(db, {
      action: "scanAntri",
      nopol: "B9284SXX",
      noFo: "3200123456",
      code: "TRANSPORT_ANTRIAN",
    });
    const fgQueue = handleBrain(db, {
      action: "queue",
      pos: "KASIR",
      actorNik: "91130001",
      actorPos: "FG",
    });
    assert.equal(fgQueue.ok, false);

    const mulai = handleBrain(db, {
      action: "mulai",
      nopol: "B9284SXX",
      noFo: "3200123456",
      pos: "TRANSPORT",
      actorNik: "91130001",
      actorPos: "FG",
    });
    assert.equal(mulai.ok, false);
  });

  it("blocks duplicate antri and mulai before antri", () => {
    const db = seedDb();
    const actor = { actorNik: "91130199", actorPos: "TRANSPORT" };
    handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" });
    const tooSoon = handleBrain(db, {
      action: "scanAdmin",
      code: "B9284SXX|3200123456|TRANSPORT|MULAI",
      ...actor,
    });
    assert.equal(tooSoon.ok, false);

    handleBrain(db, {
      action: "scanAntri",
      nopol: "B9284SXX",
      noFo: "3200123456",
      code: "TRANSPORT_ANTRIAN",
    });
    const dup = handleBrain(db, {
      action: "scanAntri",
      nopol: "B9284SXX",
      noFo: "3200123456",
      code: "TRANSPORT_ANTRIAN",
    });
    assert.equal(dup.ok, true);
    assert.match(String(dup.message), /Sudah/);
  });

  it("marks kasir belum lunas as TERTAHAN_KASIR", () => {
    const db = seedDb();
    const now = new Date("2026-09-29T10:00:00+07:00");
    const actor = { actorNik: "91130199", actorPos: "TRANSPORT" };
    handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" }, now);
    handleBrain(
      db,
      {
        action: "scanAntri",
        nopol: "B9284SXX",
        noFo: "3200123456",
        code: "TRANSPORT_ANTRIAN",
      },
      now,
    );
    handleBrain(
      db,
      {
        action: "mulai",
        nopol: "B9284SXX",
        noFo: "3200123456",
        pos: "TRANSPORT",
        ...actor,
      },
      now,
    );
    handleBrain(
      db,
      {
        action: "selesai",
        nopol: "B9284SXX",
        noFo: "3200123456",
        pos: "TRANSPORT",
        assignments: { fg: "TIDAK_ADA", bs: "TIDAK_ADA", kasir: "ADA" },
        ...actor,
      },
      now,
    );
    handleBrain(
      db,
      {
        action: "scanAntri",
        nopol: "B9284SXX",
        noFo: "3200123456",
        code: "KASIR_ANTRIAN",
      },
      now,
    );
    handleBrain(
      db,
      {
        action: "mulai",
        nopol: "B9284SXX",
        noFo: "3200123456",
        pos: "KASIR",
        actorNik: "91130003",
        actorPos: "KASIR",
      },
      now,
    );
    const done = handleBrain(
      db,
      {
        action: "selesai",
        nopol: "B9284SXX",
        noFo: "3200123456",
        pos: "KASIR",
        lunas: "BELUM_LUNAS",
        actorNik: "91130003",
        actorPos: "KASIR",
      },
      now,
    );
    assert.equal(done.ok, true, String(done.message));
    assert.equal((done.trip as { overallStatus: string }).overallStatus, "TERTAHAN_KASIR");
    assert.equal((done.trip as { kasirLunas: string }).kasirLunas, "BELUM_LUNAS");
  });

  it("only Transport can skip", () => {
    const db = seedDb();
    handleBrain(db, { action: "loginSupir", nopol: "B9284SXX", noFo: "3200123456" });
    handleBrain(db, {
      action: "scanAntri",
      nopol: "B9284SXX",
      noFo: "3200123456",
      code: "TRANSPORT_ANTRIAN",
    });
    const denied = handleBrain(db, {
      action: "skip",
      nopol: "B9284SXX",
      noFo: "3200123456",
      pos: "TRANSPORT",
      actorNik: "91130001",
      actorPos: "FG",
    });
    assert.equal(denied.ok, false);
    const ok = handleBrain(db, {
      action: "skip",
      nopol: "B9284SXX",
      noFo: "3200123456",
      pos: "TRANSPORT",
      actorNik: "91130199",
      actorPos: "TRANSPORT",
    });
    assert.equal(ok.ok, true);
  });

  it("builds live driver QR after login", () => {
    const db = seedDb();
    const res = handleBrain(db, { action: "loginSupir", nopol: "b 9284 sxx", noFo: "3200123456" });
    const trip = res.trip as Parameters<typeof driverQrPayload>[0];
    assert.equal(driverQrPayload(trip), "B9284SXX|3200123456|TRANSPORT|MULAI");
  });
});
