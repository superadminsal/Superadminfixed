import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function QrBlock({
  value,
  label,
  size = 220,
  className,
}: {
  value: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#2d2140", light: "#fcf8ff" },
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [value, size]);

  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <div className="rounded-lg bg-surface p-2 shadow-ticket" style={{ width: size, height: size }}>
        {src ? (
          <img src={src} alt={label ?? value} className="size-full" />
        ) : (
          <div className="size-full bg-surface-2" />
        )}
      </div>
      {label ? (
        <figcaption className="max-w-full break-all text-center font-mono text-xs tracking-wide text-muted">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}
