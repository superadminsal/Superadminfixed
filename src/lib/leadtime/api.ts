import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BrainRequest, BrainResponse } from "./types.ts";

export const callBrain = createServerFn({ method: "POST" })
  .validator((data: BrainRequest) => data)
  .handler(async ({ data }): Promise<BrainResponse> => {
    const { dispatchBrain } = await import("./store.server.ts");
    return dispatchBrain(data);
  });

export const getAppConfig = createServerFn({ method: "POST" })
  .validator(z.object({ actorPos: z.string(), actorNik: z.string() }))
  .handler(async ({ data }) => {
    const { readConfig } = await import("./store.server.ts");
    const cfg = readConfig();
    if (data.actorPos !== "TRANSPORT") {
      return { ok: true as const, connected: Boolean(cfg.scriptUrl), scriptUrl: "" };
    }
    return {
      ok: true as const,
      connected: Boolean(cfg.scriptUrl),
      scriptUrl: cfg.scriptUrl,
    };
  });

export const saveScriptUrl = createServerFn({ method: "POST" })
  .validator(
    z.object({
      actorPos: z.string(),
      actorNik: z.string(),
      scriptUrl: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.actorPos !== "TRANSPORT") {
      return { ok: false as const, message: "Hanya Transport yang boleh mengubah URL deploy." };
    }
    const url = data.scriptUrl.trim();
    if (url && !url.startsWith("https://script.google.com/")) {
      return {
        ok: false as const,
        message: "URL harus dari deploy Apps Script (https://script.google.com/.../exec).",
      };
    }
    const { writeConfig, pingScript } = await import("./store.server.ts");
    if (!url) {
      writeConfig({ scriptUrl: "" });
      return {
        ok: true as const,
        message: "URL dihapus. Aplikasi memakai penyimpanan lokal.",
        connected: false as const,
      };
    }

    const ping = await pingScript(url);
    if (!ping.ok) {
      return {
        ok: false as const,
        message: ping.message ?? "Ping Apps Script gagal.",
        connected: false as const,
      };
    }

    writeConfig({ scriptUrl: url });
    return { ok: true as const, message: "Terhubung ke Google Sheet.", connected: true as const };
  });

export const getCodeGs = createServerFn({ method: "POST" }).handler(async () => {
  const { readCodeGs } = await import("./store.server.ts");
  return readCodeGs();
});
