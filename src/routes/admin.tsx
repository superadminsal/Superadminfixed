import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, ScanLine, Settings } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MonitorBoard } from "@/components/leadtime/monitor-board";
import { QueueBoard, UnpaidCashList } from "@/components/leadtime/queue-board";
import { QrBlock } from "@/components/leadtime/qr-block";
import { Scanner, ScanToggle } from "@/components/leadtime/scanner";
import { SettingsPanel } from "@/components/leadtime/settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppErrorComponent } from "@/lib/error-component";
import { POS_META, POS_ORDER } from "@/lib/leadtime/constants";
import { callBrain } from "@/lib/leadtime/api";
import { readAdminSession, writeAdminSession } from "@/lib/leadtime/session";
import type { AdminSession, PosKey } from "@/lib/leadtime/types";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  errorComponent: AppErrorComponent,
});

function PosShell({ pos, children }: { pos: PosKey | null; children: ReactNode }) {
  return (
    <div data-pos={pos ?? undefined} className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}

function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setSession(readAdminSession());
    } catch {
      setSession(null);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-sm text-muted">
        Membuka dasbor…
      </div>
    );
  }

  if (!session) {
    return (
      <AdminLogin
        onLogin={(next) => {
          writeAdminSession(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <AdminHome
      session={session}
      onLogout={() => {
        writeAdminSession(null);
        setSession(null);
      }}
    />
  );
}

function AdminLogin({ onLogin }: { onLogin: (s: AdminSession) => void }) {
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const mut = useMutation({
    mutationFn: () => callBrain({ data: { action: "loginAdmin", nik, pin } }),
    onSuccess: (res) => {
      if (!res.ok || !res.session) {
        toast.error(res.message ?? "Login gagal");
        return;
      }
      const session = res.session as AdminSession;
      if (!session.nik || !session.pos || !POS_META[session.pos]) {
        toast.error("Data pos tidak valid. Cek kolom POS di NIK_AKSES.");
        return;
      }
      toast.success(res.message ?? `Masuk ${session.pos}`);
      onLogin(session);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Tidak terhubung ke sistem."),
  });

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8">
      <Link to="/" className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        SUPER ADMIN SAL
      </Link>
      <h1 className="mt-3 font-display text-5xl leading-none">Masuk pos</h1>
      <p className="mt-2 text-sm text-muted">NIK dan PIN sesuai sheet NIK_AKSES.</p>
      <form
        className="mt-8 space-y-4 rounded-xl bg-surface p-5 shadow-ticket"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="nik">NIK</Label>
          <Input
            id="nik"
            inputMode="numeric"
            autoComplete="username"
            value={nik}
            onChange={(e) => setNik(e.target.value.replace(/\s+/g, ""))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            inputMode="numeric"
            autoComplete="current-password"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={mut.isPending}>
          {mut.isPending ? "Memeriksa…" : "Masuk"}
        </Button>
      </form>
    </main>
  );
}

function AdminHome({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const isTower = session.pos === "TRANSPORT";
  const [view, setView] = useState<PosKey | "REKAP" | "SET">(session.pos);
  const meta = POS_META[session.pos] ?? POS_META.TRANSPORT;

  useEffect(() => {
    setView(session.pos);
  }, [session.pos]);

  const viewPos: PosKey | null = view === "REKAP" || view === "SET" ? null : view;
  const themePos: PosKey = viewPos ?? session.pos;

  return (
    <PosShell pos={themePos}>
      <main className="mx-auto min-h-dvh max-w-5xl px-4 py-5">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/" className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              SUPER ADMIN SAL
            </Link>
            <h1 className="font-display text-4xl leading-none">
              {isTower && viewPos ? POS_META[viewPos].label : isTower ? "Control Tower" : meta.label}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {session.nama} · {session.nik}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Keluar">
            <LogOut />
          </Button>
        </header>

        {isTower ? (
          <nav className="mb-5 flex gap-1 overflow-x-auto pb-1">
            {POS_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`shrink-0 rounded-md px-3 py-2 text-sm shadow-ticket ${
                  view === id ? "bg-accent text-accent-fg" : "bg-surface text-fg"
                }`}
              >
                {POS_META[id].label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setView("REKAP")}
              className={`shrink-0 rounded-md px-3 py-2 text-sm shadow-ticket ${
                view === "REKAP" ? "bg-accent text-accent-fg" : "bg-surface text-fg"
              }`}
            >
              Rekap
            </button>
            <button
              type="button"
              onClick={() => setView("SET")}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-sm shadow-ticket ${
                view === "SET" ? "bg-accent text-accent-fg" : "bg-surface text-fg"
              }`}
            >
              <Settings className="size-3.5" />
              Pengaturan
            </button>
          </nav>
        ) : null}

        {view === "REKAP" && isTower ? <MonitorBoard session={session} /> : null}
        {view === "SET" && isTower ? <SettingsPanel session={session} /> : null}
        {viewPos ? <PosBoard pos={viewPos} session={session} /> : null}
      </main>
    </PosShell>
  );
}

function PosBoard({ pos, session }: { pos: PosKey; session: AdminSession }) {
  const qc = useQueryClient();
  const [cam, setCam] = useState(false);
  const [manual, setManual] = useState("");
  const actor = { actorNik: session.nik, actorPos: session.pos };

  const scanMut = useMutation({
    mutationFn: (code: string) => callBrain({ data: { action: "scanAdmin", code, ...actor } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message ?? "Scan ditolak");
      toast.success(res.message ?? (res.needFinish ? "Ketuk Selesai di antrean" : "Scan diterima"));
      setCam(false);
      void qc.invalidateQueries();
    },
    onError: () => toast.error("Scan gagal."),
  });

  const onDecode = useCallback(
    (text: string) => {
      if (scanMut.isPending) return;
      scanMut.mutate(text);
    },
    [scanMut],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <QueueBoard pos={pos} session={session} canSkip={session.pos === "TRANSPORT"} />
      <aside className="space-y-4">
        <section className="rounded-xl bg-surface p-4 shadow-ticket">
          <h2 className="font-display text-xl leading-none">QR antri pos</h2>
          <p className="mt-1 text-sm text-muted">Tempel di meja. Supir yang scan.</p>
          <div className="mt-3 flex justify-center">
            <QrBlock value={POS_META[pos].queueCode} label={POS_META[pos].queueCode} size={168} />
          </div>
        </section>
        <section className="space-y-2 rounded-xl bg-surface p-4 shadow-ticket">
          <h2 className="font-display text-xl leading-none">Scan barcode supir</h2>
          <p className="text-sm text-muted">
            Format NOPOL|NOFO|{pos}|MULAI atau SELESAI.
          </p>
          <ScanToggle open={cam} onToggle={() => setCam((v) => !v)} />
          <Scanner active={cam} onDecode={onDecode} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!manual.trim()) return;
              scanMut.mutate(manual.trim().toUpperCase());
              setManual("");
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              placeholder={`NOPOL|NOFO|${pos}|MULAI`}
            />
            <Button type="submit" variant="secondary">
              <ScanLine />
            </Button>
          </form>
        </section>
        {pos === "KASIR" || session.pos === "TRANSPORT" ? (
          <UnpaidCashList session={session} />
        ) : null}
      </aside>
    </div>
  );
}
