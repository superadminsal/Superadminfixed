export type Assignment = "ADA" | "TIDAK_ADA" | "PENDING" | null;
export type PosKey = "TRANSPORT" | "FG" | "BS" | "KASIR";
export type QueueStatus = "WAITING" | "SERVING" | "SKIPPED" | "DONE";
export type TripStatus = "BERJALAN" | "PENDING" | "SELESAI" | "TERTAHAN_KASIR";
export type LunasStatus = "LUNAS" | "BELUM_LUNAS" | null;
export type PosStatusLabel =
  | "ANTRI"
  | "MULAI"
  | "SELESAI"
  | "TIDAK_ADA"
  | "PENDING"
  | "SKIP"
  | null;
export type ScanStatus = "MULAI" | "SELESAI";

export type Trip = {
  id: number;
  nopol: string;
  noFo: string;
  mobil: string;
  vendor: string | null;
  wa: string | null;
  createdAt: string;
  securityIn: string | null;
  transportQueue: string | null;
  transportStart: string | null;
  transportEnd: string | null;
  transportStatus: PosStatusLabel;
  fgAssignment: Assignment;
  fgQueue: string | null;
  fgStart: string | null;
  fgEnd: string | null;
  fgStatus: PosStatusLabel;
  bsAssignment: Assignment;
  bsQueue: string | null;
  bsStart: string | null;
  bsEnd: string | null;
  bsStatus: PosStatusLabel;
  kasirAssignment: Assignment;
  kasirQueue: string | null;
  kasirStart: string | null;
  kasirEnd: string | null;
  kasirStatus: PosStatusLabel;
  kasirLunas: LunasStatus;
  overallStatus: TripStatus;
  notes: string | null;
};

export type QueueEntry = {
  id: number;
  tripId: number;
  pos: PosKey;
  nopol: string;
  noFo: string;
  mobil: string;
  queuedAt: string;
  status: QueueStatus;
  skipCount: number;
};

export type Equipment = {
  nopol: string;
  mobil: string;
  vendor: string;
  wa: string | null;
};

export type HoursRow = {
  process: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  is24h: boolean;
};

export type AccessRow = {
  nik: string;
  nama: string;
  pos: PosKey;
  pin: string;
};

export type Assignments = {
  fg: Exclude<Assignment, null>;
  bs: Exclude<Assignment, null>;
  kasir: Exclude<Assignment, null>;
};

export type DriverAction =
  | { type: "QUEUE"; pos: PosKey }
  | { type: "WAIT_QUEUE"; pos: PosKey }
  | { type: "IN_SERVICE"; pos: PosKey }
  | { type: "PENDING"; pos: PosKey }
  | { type: "DONE" }
  | { type: "TERTAHAN" };

export type ScanKind =
  | { kind: "queue"; pos: PosKey }
  | { kind: "driver"; nopol: string; noFo: string; pos: PosKey; status: ScanStatus };

export type StepState = "done" | "current" | "locked" | "skipped" | "pending";

export type Step = {
  id: string;
  label: string;
  state: StepState;
  detail: string;
};

export type AdminSession = {
  nik: string;
  nama: string;
  pos: PosKey;
};

export type DriverSession = {
  nopol: string;
  noFo: string;
};

export type BrainRequest = {
  action: string;
  nik?: string;
  pin?: string;
  nopol?: string;
  noFo?: string;
  code?: string;
  pos?: string;
  actorNik?: string;
  actorPos?: string;
  assignments?: Assignments;
  lunas?: string;
};

export type BrainResponse = {
  ok: boolean;
  message?: string;
  resumed?: boolean;
  warning?: string;
  needFinish?: boolean;
  pos?: PosKey;
  session?: AdminSession;
  trip?: Trip;
  queue?: QueueEntry[];
  trips?: Trip[];
  hours?: HoursRow[];
  connected?: boolean;
  time?: string;
  qr?: string;
};
