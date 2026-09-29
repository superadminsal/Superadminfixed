import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Play, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { POS_META } from "@/lib/leadtime/constants";
import { fmtClock, fmtDuration } from "@/lib/leadtime/logic";
import { callBrain } from "@/lib/leadtime/api";
import type { AdminSession, Assignment, LunasStatus, PosKey, QueueEntry } from "@/lib/leadtime/types";

export function QueueBoard({
  pos,
  session,
  canSkip,
}: {
  pos: PosKey;
  session: AdminSession;
  canSkip: boolean;
}) {
  const qc = useQueryClient();
  const actor = { actorNik: session.nik, actorPos: session.pos };
  const q = useQuery({
    queryKey: ["queue", pos, session.nik],
    queryFn: () => callBrain({ data: { action: "queue", pos, ...actor } }),
    refetchInterval: 4000,
  });
  const rows = (q.data?.queue ?? []) as QueueEntry[];
  const [assignOpen, setAssignOpen] = useState<QueueEntry | null>(null);
  const [cashOpen, setCashOpen] = useState<QueueEntry | null>(null);

  const serving = rows.find((e) => e.status === "SERVING") ?? null;
  const waiting = useMemo(() => {
    const skipped = rows.filter((e) => e.status === "SKIPPED");
    const wait = rows.filter((e) => e.status === "WAITING");
    return [...skipped, ...wait];
  }, [rows]);
  const nextUp = waiting[0] ?? null;

  const startMut = useMutation({
    mutationFn: (entry: QueueEntry) =>
      callBrain({
        data: { action: "mulai", nopol: entry.nopol, noFo: entry.noFo, pos, ...actor },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message ?? "Gagal mulai");
      toast.success(res.message);
      void qc.invalidateQueries();
    },
  });
  const finishMut = useMutation({
    mutationFn: (payload: {
      entry: QueueEntry;
      assignments?: { fg: Exclude<Assignment, null>; bs: Exclude<Assignment, null>; kasir: Exclude<Assignment, null> };
      lunas?: Exclude<LunasStatus, null>;
    }) =>
      callBrain({
        data: {
          action: "selesai",
          nopol: payload.entry.nopol,
          noFo: payload.entry.noFo,
          pos,
          assignments: payload.assignments,
          lunas: payload.lunas,
          ...actor,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message ?? "Gagal selesai");
      toast.success(res.message);
      setAssignOpen(null);
      setCashOpen(null);
      void qc.invalidateQueries();
    },
  });
  const skipMut = useMutation({
    mutationFn: (entry: QueueEntry) =>
      callBrain({
        data: { action: "skip", nopol: entry.nopol, noFo: entry.noFo, pos, ...actor },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message ?? "Gagal skip");
      toast.success(res.message);
      void qc.invalidateQueries();
    },
  });

  function onFinishClick(entry: QueueEntry) {
    if (pos === "TRANSPORT") setAssignOpen(entry);
    else if (pos === "KASIR") setCashOpen(entry);
    else finishMut.mutate({ entry });
  }

  if (q.data && q.data.ok === false) {
    return (
      <div className="rounded-xl bg-surface p-5 text-sm text-danger shadow-ticket">
        {String(q.data.message ?? "Antrean gagal dimuat.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Antrean · {POS_META[pos].queueCode}
          </p>
          <h2 className="font-display text-3xl leading-none">{POS_META[pos].label}</h2>
          <p className="mt-1 text-sm text-muted">{POS_META[pos].task}</p>
        </div>
        <Badge tone={serving ? "ok" : waiting.length ? "warn" : "muted"}>
          {waiting.length} antre
        </Badge>
      </header>

      <section className="rounded-xl bg-surface p-4 shadow-ticket">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Sedang dilayani
        </p>
        {serving ? (
          <QueueRow
            entry={serving}
            highlight
            next={false}
            onStart={() => undefined}
            onSkip={() => undefined}
            onFinish={() => onFinishClick(serving)}
            finishing={finishMut.isPending}
            canStart={false}
            canSkip={false}
            canFinish
          />
        ) : (
          <p className="mt-2 text-sm text-muted">Tidak ada yang dilayani.</p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Menunggu</p>
        {waiting.length === 0 ? (
          <div className="rounded-xl bg-surface p-5 text-sm text-muted shadow-ticket">
            Antrean kosong.
          </div>
        ) : (
          waiting.map((entry) => (
            <QueueRow
              key={`${entry.nopol}-${entry.noFo}`}
              entry={entry}
              highlight={false}
              next={nextUp?.nopol === entry.nopol && nextUp?.noFo === entry.noFo}
              canStart={!serving}
              canSkip={canSkip && !serving && waiting.length > 1}
              canFinish={false}
              finishing={false}
              onStart={() => startMut.mutate(entry)}
              onSkip={() => skipMut.mutate(entry)}
              onFinish={() => undefined}
            />
          ))
        )}
      </section>

      <AssignDialog
        entry={assignOpen}
        open={Boolean(assignOpen)}
        busy={finishMut.isPending}
        onClose={() => setAssignOpen(null)}
        onSubmit={(assignments) => {
          if (!assignOpen) return;
          finishMut.mutate({ entry: assignOpen, assignments });
        }}
      />
      <CashDialog
        entry={cashOpen}
        open={Boolean(cashOpen)}
        busy={finishMut.isPending}
        onClose={() => setCashOpen(null)}
        onSubmit={(lunas) => {
          if (!cashOpen) return;
          finishMut.mutate({ entry: cashOpen, lunas });
        }}
      />
    </div>
  );
}

function QueueRow({
  entry,
  highlight,
  next,
  canStart,
  canSkip,
  canFinish,
  finishing,
  onStart,
  onSkip,
  onFinish,
}: {
  entry: QueueEntry;
  highlight: boolean;
  next: boolean;
  canStart: boolean;
  canSkip: boolean;
  canFinish: boolean;
  finishing: boolean;
  onStart: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  return (
    <article
      className={`mt-2 flex flex-col gap-3 rounded-lg p-3 shadow-ticket sm:flex-row sm:items-center sm:justify-between ${
        highlight ? "bg-accent text-accent-fg" : "bg-surface"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl leading-none">{entry.nopol}</h3>
          {entry.status === "SKIPPED" ? <Badge tone="warn">Skip</Badge> : null}
          {next ? <Badge tone={highlight ? "muted" : "ink"}>Berikutnya</Badge> : null}
        </div>
        <p className={`mt-1 font-mono text-xs ${highlight ? "text-accent-fg/70" : "text-muted"}`}>
          FO {entry.noFo} · {entry.mobil} · antre {fmtClock(entry.queuedAt)} · tunggu{" "}
          {fmtDuration(entry.queuedAt, new Date().toISOString())}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canStart ? (
          <Button size="sm" onClick={onStart}>
            {entry.status === "SKIPPED" ? <SkipForward /> : <Play />}
            {entry.status === "SKIPPED" ? "Panggil lagi" : "Mulai"}
          </Button>
        ) : null}
        {canSkip && entry.status === "WAITING" ? (
          <Button size="sm" variant="secondary" onClick={onSkip}>
            <SkipForward />
            Lewati
          </Button>
        ) : null}
        {canFinish ? (
          <Button
            size="sm"
            variant={highlight ? "secondary" : "default"}
            disabled={finishing}
            onClick={onFinish}
          >
            <Check />
            Selesai
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function AssignDialog({
  entry,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  entry: QueueEntry | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (a: { fg: Assignment; bs: Assignment; kasir: Assignment }) => void;
}) {
  const [fg, setFg] = useState<Assignment>("ADA");
  const [bs, setBs] = useState<Assignment>("TIDAK_ADA");
  const [kasir, setKasir] = useState<Assignment>("ADA");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tutup laporan transport">
        <p className="mb-4 text-sm text-muted">
          {entry ? `${entry.nopol} · FO ${entry.noFo}` : ""} · tentukan tugas pos lanjutan.
        </p>
        <Choice label="SKR / FG" value={fg} onChange={setFg} />
        <Choice label="TKG-RL / BS" value={bs} onChange={setBs} />
        <Choice label="Setoran cash" value={kasir} onChange={setKasir} />
        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={busy || !fg || !bs || !kasir}
          onClick={() => {
            if (!fg || !bs || !kasir) return;
            onSubmit({ fg, bs, kasir });
          }}
        >
          Simpan & selesai
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Assignment;
  onChange: (v: Assignment) => void;
}) {
  const opts: { id: Assignment; text: string }[] = [
    { id: "ADA", text: "Ada" },
    { id: "TIDAK_ADA", text: "Tidak ada" },
    { id: "PENDING", text: "Pending" },
  ];
  return (
    <fieldset className="mb-3">
      <Label>{label}</Label>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`h-10 rounded-md text-sm shadow-ticket ${
              value === o.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CashDialog({
  entry,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  entry: QueueEntry | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (lunas: "LUNAS" | "BELUM_LUNAS") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Status setoran">
        <p className="mb-4 text-sm text-muted">
          {entry ? `${entry.nopol} · FO ${entry.noFo}` : ""} · pilih status cash.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={() => onSubmit("LUNAS")}>
            Lunas
          </Button>
          <Button disabled={busy} variant="secondary" onClick={() => onSubmit("BELUM_LUNAS")}>
            Belum lunas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnpaidCashList({ session }: { session: AdminSession }) {
  const trips = useQuery({
    queryKey: ["trips-unpaid", session.nik],
    enabled: session.pos === "TRANSPORT",
    queryFn: async () => {
      const res = await callBrain({
        data: { action: "trips", actorNik: session.nik, actorPos: session.pos },
      });
      const rows = (res.trips ?? []) as { nopol: string; noFo: string; kasirLunas: string }[];
      return rows.filter((t) => t.kasirLunas === "BELUM_LUNAS");
    },
  });
  if (!trips.data?.length) return null;
  return (
    <section className="rounded-xl bg-surface p-4 shadow-ticket">
      <h3 className="font-display text-xl">Belum lunas</h3>
      <ul className="mt-2 space-y-2">
        {trips.data.map((t) => (
          <li key={`${t.nopol}-${t.noFo}`} className="font-mono text-sm">
            {t.nopol} · {t.noFo}
          </li>
        ))}
      </ul>
    </section>
  );
}
