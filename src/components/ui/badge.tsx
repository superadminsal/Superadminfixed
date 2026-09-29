import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "ink",
  children,
}: {
  className?: string;
  tone?: "ink" | "ok" | "warn" | "danger" | "muted";
  children: ReactNode;
}) {
  const tones = {
    ink: "bg-accent text-accent-fg",
    ok: "bg-ok text-ok-fg",
    warn: "bg-warn text-warn-fg",
    danger: "bg-danger text-danger-fg",
    muted: "bg-surface-2 text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
