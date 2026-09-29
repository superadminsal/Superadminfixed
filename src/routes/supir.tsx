import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, QrCode, ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QrBlock } from "@/components/leadtime/qr-block";
import { Scanner, ScanToggle } from "@/components/leadtime/scanner";
import { Stepper } from "@/components/leadtime/stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POS_META } from "@/lib/leadtime/constants";
import {
  driverQrPayload,
  fmtClock,
  nextDriverAction,
  normalizeFo,
  normalizeNopol,
  tripSteps,
} from "@/lib/leadtime/logic";
import { callBrain } from "@/lib/leadtime/api";
import { readDriverSession, writeDriverSession } from "@/lib/leadtime/session";
import type { DriverAction, DriverSession, PosKey, Trip } from "@/lib/leadtime/types";

export const Route = createFileRoute("/supir")({ component: SupirPage });

function actionCopy(action: DriverAction): { title: string; body: string } {
  switch (action.type) {
    case "QUEUE":
      return {
        title: `Antri di ${POS_META[action.pos].label}`,
        body: `Scan ${POS_META[action.pos].queueCode} di dinding pos.`,
      };
    case "WAIT_QUEUE":
      return {
        title: `Menunggu giliran ${POS_META[action.pos].label}`,
        body: "Tunjukkan barcode ini ke petugas untuk Mulai.",
      };
    case "IN_SERVICE":
      return {
        title: `Sedang dilayani · ${POS_META[action.pos].label}`,
        body: "Tunjukkan barcode SELESAI sampai petugas menutup tugas.",
      };
    case "PENDING":
      return {
        title: `${POS_META[action.pos].label} pending`,
        body: "Pos tutup. Lanjut besok, atau antre jika sudah buka.",
      };
    case "DONE":
      return { title: "Tugas selesai", body: "Trip closed. Siap rute berikutnya." };
    case "TERTAHAN":
      return { title: "Tertahan kasir", body: "Setoran belum lunas. Konfirmasi ke kasir." };
  }
}

function themePos(trip: Trip | null): PosKey {
  if (!trip) return "TRANSPORT";
  const action = nextDriverAction(trip);
  if ("pos" in action) return action.pos;
  return "TRANSPORT";
}

function SupirPage() {
  const [session, setSession] = useState<DriverSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readDriverSession());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-sm text-muted">Membuka…</div>
    );
  }

  if (!session) {
    return (
      <Login
        onLogin={(next) => {
          writeDriverSession(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <DriverHome
      session={session}
      onLogout={() => {
        writeDriverSession(null);
        setSession(null);
      }}
    />
  );
}

function Login({ onLogin }: { onLogin: (s: DriverSession) => void }) {
  const [nopol, setNopol] = useState("");
  const [noFo, setNoFo] = useState("");
  const mutation = useMutation({
    mutationFn: () => callBrain({ data: { action: "loginSupir", nopol, noFo } }),
    onSuccess: (res) => {
      if (!res.ok || !res.trip) {
        toast.error(res.message ?? "Login gagal");
        return;
      }
      const trip = res.trip as Trip;
      toast.success(res.resumed ? "Sesi dilanjutkan" : "Datang DC tercatat");
      if (res.warning) toast.message(String(res.warning));
      onLogin({ nopol: trip.nopol, noFo: trip.noFo });
    },
    onError: () => toast.error("Gagal terhubung ke sistem."),
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <Link to="/" className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        SUPER ADMIN SAL
      </Link>
      <h1 className="mt-3 font-display text-5xl leading-none">Masuk gerbang</h1>
      <p className="mt-2 text-sm text-muted">
        Nomor polisi dan No. FO. Waktu masuk menjadi TIMESTAMP kolom B.
      </p>
      <form
        className="mt-8 space-y-4 rounded-xl bg-surface p-5 shadow-ticket"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="nopol">Nomor polisi</Label>
          <Input
            id="nopol"
            autoCapitalize="characters"
            autoComplete="off"
            value={nopol}
            onChange={(e) => setNopol(normalizeNopol(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nofo">Nomor Freight Order</Label>
          <Input
            id="nofo"
            inputMode="numeric"
            autoComplete="off"
            value={noFo}
            onChange={(e) => setNoFo(normalizeFo(e.target.value))}
            required
          />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Mencatat…" : "Masuk"}
        </Button>
      </form>
    </main>
  );
}

function DriverHome({
  session,
  onLogout,
}: {
  session: DriverSession;
  onLogout: () => void;
}) {
  const qc = useQueryClient();
  const tripQuery = useQuery({
    queryKey: ["trip", session.nopol, session.noFo],
    queryFn: () =>
      callBrain({ data: { action: "getTrip", nopol: session.nopol, noFo: session.noFo } }),
    refetchInterval: 4000,
  });
  const [cam, setCam] = useState(false);
  const [manual, setManual] = useState("");

  const trip = (tripQuery.data?.trip as Trip | undefined) ?? null;
  const action = trip ? nextDriverAction(trip) : null;
  const steps = trip ? tripSteps(trip) : [];
  const payload = trip ? driverQrPayload(trip) : `${session.nopol}|${session.noFo}|TRANSPORT|MULAI`;
  const pos = themePos(trip);

  const scanMut = useMutation({
    mutationFn: (code: string) =>
      callBrain({
        data: { action: "scanAntri", nopol: session.nopol, noFo: session.noFo, code },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Scan ditolak");
        return;
      }
      toast.success(res.message);
      setCam(false);
      void qc.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: () => toast.error("Gagal mengirim scan."),
  });

  const onDecode = useCallback(
    (text: string) => {
      if (scanMut.isPending) return;
      scanMut.mutate(text);
    },
    [scanMut],
  );

  const copy = action ? actionCopy(action) : null;
  const queuePos: PosKey | null =
    action?.type === "QUEUE" || action?.type === "PENDING" ? action.pos : null;

  return (
    <div data-pos={pos} className="min-h-dvh bg-bg text-fg">
      <main className="mx-auto min-h-dvh max-w-md px-4 py-5">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Link to="/" className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              SUPER ADMIN SAL
            </Link>
            <h1 className="font-display text-4xl leading-none">{session.nopol}</h1>
            <p className="mt-1 font-mono text-sm text-muted">FO {session.noFo}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Keluar">
            <LogOut />
          </Button>
        </header>

        {tripQuery.isLoading || !trip || !copy ? (
          <div className="rounded-xl bg-surface p-6 text-sm text-muted shadow-ticket">
            {tripQuery.data && tripQuery.data.ok === false
              ? String(tripQuery.data.message)
              : "Memuat status tugas…"}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface p-4 shadow-ticket">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-lg leading-none">{trip.mobil}</p>
                  <p className="mt-1 text-xs text-muted">{trip.vendor ?? "—"}</p>
                </div>
                <Badge
                  tone={
                    trip.overallStatus === "SELESAI"
                      ? "ok"
                      : trip.overallStatus === "PENDING" || trip.overallStatus === "TERTAHAN_KASIR"
                        ? "warn"
                        : "ink"
                  }
                >
                  {trip.overallStatus}
                </Badge>
              </div>
              <div className="mt-4">
                <Stepper steps={steps} />
              </div>
              <p className="mt-3 text-sm text-muted">
                {steps.find((s) => s.state === "current")?.detail}
              </p>
            </div>

            <section className="rounded-xl bg-surface p-4 shadow-ticket">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl leading-none">{copy.title}</h2>
                  <p className="mt-1 text-sm text-muted">{copy.body}</p>
                </div>
                <QrCode className="size-5 shrink-0 text-accent" />
              </div>
              <div className="mt-4 flex justify-center">
                <QrBlock value={payload} label={payload} size={200} />
              </div>
            </section>

            {action?.type !== "DONE" && action?.type !== "TERTAHAN" ? (
              <section className="space-y-2 rounded-xl bg-surface p-4 shadow-ticket">
                <ScanToggle open={cam} onToggle={() => setCam((v) => !v)} />
                <Scanner active={cam} onDecode={onDecode} />
                {queuePos ? (
                  <Button
                    type="button"
                    size="xl"
                    className="w-full"
                    disabled={scanMut.isPending}
                    onClick={() => scanMut.mutate(POS_META[queuePos].queueCode)}
                  >
                    <ScanLine />
                    Antri · {POS_META[queuePos].label}
                  </Button>
                ) : null}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manual.trim()) return;
                    scanMut.mutate(manual.trim());
                    setManual("");
                  }}
                >
                  <Input
                    value={manual}
                    onChange={(e) => setManual(e.target.value.toUpperCase())}
                    placeholder={queuePos ? POS_META[queuePos].queueCode : "KODE_ANTRIAN"}
                  />
                  <Button type="submit" variant="secondary">
                    Kirim
                  </Button>
                </form>
              </section>
            ) : null}

            <Times trip={trip} />
          </div>
        )}
      </main>
    </div>
  );
}

function Times({ trip }: { trip: Trip }) {
  const rows = useMemo(
    () => [
      ["Datang DC", trip.securityIn],
      ["Antri TR", trip.transportQueue],
      ["Mulai TR", trip.transportStart],
      ["Selesai TR", trip.transportEnd],
      ["Antri FG", trip.fgQueue],
      ["Selesai FG", trip.fgEnd],
      ["Antri BS", trip.bsQueue],
      ["Selesai BS", trip.bsEnd],
      ["Antri Kasir", trip.kasirQueue],
      ["Selesai Kasir", trip.kasirEnd],
    ],
    [trip],
  );
  return (
    <section className="rounded-xl bg-surface p-4 shadow-ticket">
      <h2 className="font-display text-xl">Cap waktu</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-2 px-2.5 py-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
            <dd className="font-mono text-sm tabular-nums">{fmtClock(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
