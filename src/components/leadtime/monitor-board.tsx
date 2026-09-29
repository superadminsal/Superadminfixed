import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cellLabel, durationMs, fmtClock } from "@/lib/leadtime/logic";
import { callBrain } from "@/lib/leadtime/api";
import type { AdminSession, Trip } from "@/lib/leadtime/types";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function MonitorBoard({ session }: { session: AdminSession }) {
  const q = useQuery({
    queryKey: ["trips", session.nik],
    queryFn: () =>
      callBrain({ data: { action: "trips", actorNik: session.nik, actorPos: session.pos } }),
    refetchInterval: 5000,
  });
  const [qtext, setQtext] = useState("");
  const all = (q.data?.trips ?? []) as Trip[];
  const trips = useMemo(() => {
    const t = qtext.trim().toUpperCase();
    if (!t) return all;
    return all.filter(
      (r) =>
        r.nopol.includes(t) ||
        r.noFo.includes(t) ||
        (r.mobil ?? "").toUpperCase().includes(t),
    );
  }, [all, qtext]);

  const stats = useMemo(() => {
    const waitTr = trips
      .map((t) => durationMs(t.transportQueue, t.transportStart))
      .filter((n): n is number => n != null);
    const procTr = trips
      .map((t) => durationMs(t.transportStart, t.transportEnd))
      .filter((n): n is number => n != null);
    const waitFg = trips
      .map((t) => durationMs(t.fgQueue, t.fgStart))
      .filter((n): n is number => n != null);
    const waitBs = trips
      .map((t) => durationMs(t.bsQueue, t.bsStart))
      .filter((n): n is number => n != null);
    const waitKs = trips
      .map((t) => durationMs(t.kasirQueue, t.kasirStart))
      .filter((n): n is number => n != null);
    const chart = [
      { name: "TR tunggu", menit: Math.round(avg(waitTr) / 60000) },
      { name: "TR proses", menit: Math.round(avg(procTr) / 60000) },
      { name: "FG tunggu", menit: Math.round(avg(waitFg) / 60000) },
      { name: "BS tunggu", menit: Math.round(avg(waitBs) / 60000) },
      { name: "Kasir tunggu", menit: Math.round(avg(waitKs) / 60000) },
    ];
    const bottleneck = [...chart].sort((a, b) => b.menit - a.menit)[0];
    return {
      chart,
      bottleneck,
      pending: trips.filter((t) => t.overallStatus === "PENDING").length,
      unpaid: trips.filter((t) => t.kasirLunas === "BELUM_LUNAS").length,
      done: trips.filter((t) => t.overallStatus === "SELESAI").length,
    };
  }, [trips]);

  if (q.data && q.data.ok === false) {
    return (
      <div className="rounded-xl bg-surface p-5 text-sm text-danger shadow-ticket">
        {String(q.data.message ?? "Rekap gagal dimuat.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Selesai" value={stats.done} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Belum lunas" value={stats.unpaid} />
      </div>
      <section className="rounded-xl bg-surface p-4 shadow-ticket">
        <h3 className="font-display text-xl">Rata-rata menit</h3>
        <p className="text-sm text-muted">
          Bottleneck: {stats.bottleneck?.name ?? "—"} {stats.bottleneck?.menit ?? 0} mnt
        </p>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="menit" fill="var(--color-accent)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <Input
        value={qtext}
        onChange={(e) => setQtext(e.target.value)}
        placeholder="Cari nopol / FO / mobil"
      />
      <div className="space-y-2">
        {trips.length === 0 ? (
          <p className="rounded-xl bg-surface p-5 text-sm text-muted shadow-ticket">Belum ada trip.</p>
        ) : (
          trips.slice(0, 40).map((t) => (
            <article key={`${t.nopol}-${t.noFo}`} className="rounded-xl bg-surface p-3 shadow-ticket">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl leading-none">{t.nopol}</h3>
                  <p className="mt-1 font-mono text-xs text-muted">
                    FO {t.noFo} · {t.mobil} · datang {fmtClock(t.securityIn)}
                  </p>
                </div>
                <Badge
                  tone={
                    t.overallStatus === "SELESAI"
                      ? "ok"
                      : t.overallStatus === "PENDING" || t.overallStatus === "TERTAHAN_KASIR"
                        ? "warn"
                        : "ink"
                  }
                >
                  {t.overallStatus}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
                FG {cellLabel(t.fgAssignment, t.fgEnd, "SKR")} · BS{" "}
                {cellLabel(t.bsAssignment, t.bsEnd, "TKG/RL")} · Kasir{" "}
                {cellLabel(t.kasirAssignment, t.kasirEnd, "cash")}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface p-3 shadow-ticket">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-display text-3xl leading-none">{value}</p>
    </div>
  );
}
