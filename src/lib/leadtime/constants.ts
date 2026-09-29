import type { PosKey } from "./types.ts";

export const APP_NAME = "SUPER ADMIN SAL";
export const APP_TAGLINE = "Lead time laporan deliveryman";
export const TZ = "Asia/Jakarta";

export const POS_ORDER: PosKey[] = ["TRANSPORT", "FG", "BS", "KASIR"];

export const POS_META: Record<
  PosKey,
  { label: string; short: string; task: string; queueCode: string; emptyNoun: string }
> = {
  TRANSPORT: {
    label: "Transport",
    short: "TR",
    task: "Laporan dokumen",
    queueCode: "TRANSPORT_ANTRIAN",
    emptyNoun: "",
  },
  FG: {
    label: "Gudang FG",
    short: "FG",
    task: "Turun SKR / sisa kiriman",
    queueCode: "FG_ANTRIAN",
    emptyNoun: "SKR",
  },
  BS: {
    label: "Gudang BS",
    short: "BS",
    task: "Turun TKG / RL",
    queueCode: "BS_ANTRIAN",
    emptyNoun: "TKG/RL",
  },
  KASIR: {
    label: "Kasir",
    short: "KS",
    task: "Setoran cash",
    queueCode: "KASIR_ANTRIAN",
    emptyNoun: "cash",
  },
};

export const QUEUE_CODE_ALIASES: Record<string, PosKey> = {
  TRANSPORT_ANTRIAN: "TRANSPORT",
  ANTRIAN_TRANSPORT: "TRANSPORT",
  ANTRI_TRANSPORT: "TRANSPORT",
  FG_ANTRIAN: "FG",
  ANTRIAN_FG: "FG",
  ANTRIAN_SKR: "FG",
  ANTRI_FG: "FG",
  ANTRI_SKR: "FG",
  BS_ANTRIAN: "BS",
  ANTRIAN_BS: "BS",
  ANTRIAN_TKG: "BS",
  ANTRI_BS: "BS",
  KASIR_ANTRIAN: "KASIR",
  ANTRIAN_KASIR: "KASIR",
  ANTRIAN_CASH: "KASIR",
  ANTRI_KASIR: "KASIR",
};
