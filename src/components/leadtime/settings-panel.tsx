import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrBlock } from "@/components/leadtime/qr-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POS_META, POS_ORDER } from "@/lib/leadtime/constants";
import { getAppConfig, getCodeGs, saveScriptUrl } from "@/lib/leadtime/api";
import type { AdminSession } from "@/lib/leadtime/types";

export function SettingsPanel({ session }: { session: AdminSession }) {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["app-config", session.nik],
    queryFn: () => getAppConfig({ data: { actorNik: session.nik, actorPos: session.pos } }),
  });
  const code = useQuery({
    queryKey: ["code-gs"],
    queryFn: () => getCodeGs(),
  });
  const [url, setUrl] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof cfg.data?.scriptUrl === "string") setUrl(cfg.data.scriptUrl);
  }, [cfg.data?.scriptUrl]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const saveMut = useMutation({
    mutationFn: (scriptUrl: string) =>
      saveScriptUrl({ data: { actorNik: session.nik, actorPos: session.pos, scriptUrl } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      toast.success(res.message);
      void qc.invalidateQueries({ queryKey: ["app-config"] });
    },
  });

  const supirUrl = origin ? `${origin}/supir` : "/supir";

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          Hanya Transport
        </p>
        <h2 className="font-display text-3xl leading-none">Pengaturan</h2>
      </header>

      <section className="space-y-3 rounded-xl bg-surface p-4 shadow-ticket">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl">URL deploy Apps Script</h3>
          <Badge tone={cfg.data?.connected ? "ok" : "muted"}>
            {cfg.data?.connected ? "Terhubung Sheet" : "Belum terhubung"}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Tempel URL /exec setelah deploy. Semua HP di aplikasi ini otomatis memakai URL itu — tidak
          perlu edit kode.
        </p>
        <Label htmlFor="script-url">URL Web App</Label>
        <Input
          id="script-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/…/exec"
        />
        <Button
          className="w-full"
          onClick={() => saveMut.mutate(url)}
          disabled={saveMut.isPending}
        >
          <Save />
          {saveMut.isPending ? "Menyimpan…" : "Simpan & tes koneksi"}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setUrl("");
            saveMut.mutate("");
          }}
        >
          Hapus URL
        </Button>
      </section>

      <section className="space-y-3 rounded-xl bg-surface p-4 shadow-ticket">
        <h3 className="font-display text-xl">Otak Code.gs</h3>
        <p className="text-sm text-muted">
          Copy, tempel di Extensions → Apps Script pada file LEADTIME_APP, lalu deploy sebagai Web
          app (Execute as Me, access Anyone).
        </p>
        <Button
          variant="secondary"
          className="w-full"
          disabled={!code.data?.source}
          onClick={async () => {
            if (!code.data?.source) return;
            await navigator.clipboard.writeText(code.data.source);
            toast.success("Code.gs tersalin");
          }}
        >
          <Copy />
          Salin Code.gs
        </Button>
        <pre className="max-h-48 overflow-auto rounded-md bg-ink p-3 font-mono text-[10px] leading-relaxed text-accent-fg">
          {code.data?.source ? code.data.source.slice(0, 1200) + "\n…" : "Memuat Code.gs…"}
        </pre>
      </section>

      <section className="space-y-3 rounded-xl bg-surface p-4 shadow-ticket">
        <h3 className="font-display text-xl">Barcode fisik</h3>
        <p className="text-sm text-muted">
          Security: tempel tautan aplikasi supir. Pos lain: tempel kode antri di dinding.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Security</p>
            <p className="mt-1 text-sm">Link login supir</p>
            <div className="mt-2 flex justify-center">
              <QrBlock value={supirUrl} label={supirUrl} size={148} />
            </div>
          </div>
          {POS_ORDER.map((pos) => (
            <div key={pos} className="rounded-lg bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                {POS_META[pos].label}
              </p>
              <div className="mt-2 flex justify-center">
                <QrBlock value={POS_META[pos].queueCode} label={POS_META[pos].queueCode} size={148} />
              </div>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted">
          <Link2 className="size-3.5" />
          Cetak / screenshot, tempel di meja pos.
        </p>
      </section>
    </div>
  );
}
