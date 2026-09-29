import { Camera, CameraOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ScannerCtor = new (
  id: string,
  opts?: { verbose?: boolean },
) => {
  start: (
    camera: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onFail: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => Promise<void>;
};

export function Scanner({
  onDecode,
  active,
}: {
  onDecode: (text: string) => void;
  active: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const readerId = `qr-${id}`;
  const last = useRef({ text: "", at: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let inst: InstanceType<ScannerCtor> | null = null;
    let cancelled = false;
    setError(null);

    void import("html5-qrcode")
      .then(({ Html5Qrcode }) => {
        if (cancelled) return;
        const Ctor = Html5Qrcode as unknown as ScannerCtor;
        inst = new Ctor(readerId, { verbose: false });
        return inst.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (text) => {
            const now = Date.now();
            if (text === last.current.text && now - last.current.at < 2000) return;
            last.current = { text, at: now };
            onDecode(text);
          },
          () => undefined,
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Kamera tidak tersedia.");
        }
      });

    return () => {
      cancelled = true;
      if (!inst) return;
      inst
        .stop()
        .catch(() => undefined)
        .finally(() => {
          inst?.clear().catch(() => undefined);
        });
    };
  }, [active, onDecode, readerId]);

  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-lg bg-ink">
      <div id={readerId} className="min-h-48 w-full overflow-hidden" />
      {error ? <p className="px-3 py-2 text-sm text-accent-fg">{error}</p> : null}
    </div>
  );
}

export function ScanToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" variant={open ? "danger" : "secondary"} onClick={onToggle}>
      {open ? <CameraOff /> : <Camera />}
      {open ? "Tutup kamera" : "Buka kamera"}
    </Button>
  );
}
