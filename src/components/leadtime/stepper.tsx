import { cn } from "@/lib/utils";
import type { Step } from "@/lib/leadtime/types";

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid grid-cols-3 gap-1 sm:grid-cols-5">
      {steps.map((step, i) => (
        <li key={step.id} className="min-w-0">
          <div
            className={cn(
              "rounded-md px-1.5 py-2 text-center shadow-ticket",
              step.state === "current" && "bg-accent text-accent-fg",
              step.state === "done" && "bg-ok text-ok-fg",
              step.state === "skipped" && "bg-surface-2 text-muted",
              step.state === "pending" && "bg-warn text-warn-fg",
              step.state === "locked" && "bg-surface text-subtle",
            )}
          >
            <div className="font-mono text-[10px] tabular-nums opacity-70">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="truncate font-display text-sm leading-tight">{step.label}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
