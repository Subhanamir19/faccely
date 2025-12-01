// src/lib/api/routineAsync.ts
// Async Routine client: start job, query job, poll with backoff.
// Uses EXPO_PUBLIC_API_BASE_URL (Expo public env) for both dev/prod.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
import { buildAuthHeaders } from "./authHeaders";

// -------- Types (mirror server responses, minimal but safe) ----------
export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused";

export type RoutineTask = {
  headline?: string;
  category?: string;
  protocol?: string;
  done?: boolean;
};

export type RoutineDay = {
  day?: number;
  components?: RoutineTask[]; // server currently returns `components`
  tasks?: RoutineTask[];      // keep forward-compat for `tasks`
  notes?: string[];
};

export type RoutineResult = {
  days: RoutineDay[];
  // other fields may exist (phase_plan, etc.) — ignore safely on client
};

export type JobSnapshot =
  | {
      id: string;
      queue?: string;
      status: Exclude<JobStatus, "completed" | "failed">;
      progress?: number;
      timestamps?: Record<string, number | null>;
    }
  | {
      id: string;
      queue?: string;
      status: "completed";
      progress?: number;
      result: RoutineResult;
      timestamps?: Record<string, number | null>;
    }
  | {
      id: string;
      queue?: string;
      status: "failed";
      progress?: number;
      error: { message: string; stacktraces?: string[] };
      timestamps?: Record<string, number | null>;
    };

// Payload shape expected by POST /routine/async
export type Scores = {
  jawline: number;
  facial_symmetry: number;
  skin_quality: number;
  cheekbones: number;
  eyes_symmetry: number;
  nose_harmony: number;
  sexual_dimorphism: number;
};

export type RoutineContext = Record<string, unknown> & {
  // you can pass goal, nonce, etc.
  goal?: string;
};

export type StartRoutineArgs = {
  scores: Scores;
  context?: RoutineContext;
  protocolVersion?: string; // e.g., "v1"
  idempotencyKey?: string;  // optional; will auto-generate if omitted
};

// ---------------------- Small utilities -------------------------------
function uuidLike(): string {
  // Good-enough UUID v4 fallback for RN; prefer native crypto if present.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      // @ts-ignore - RN may shim crypto
      return crypto.randomUUID();
    } catch {}
  }
  const s = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: "GET" });
  const text = await r.text();
  if (!r.ok) {
    // try to surface server JSON if any
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error?.message || j?.error || text || `HTTP ${r.status}`);
    } catch {
      throw new Error(text || `HTTP ${r.status}`);
    }
  }
  return JSON.parse(text) as T;
}

async function postJson<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    // Server sends structured JSON on errors — preserve message if present
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error?.message || j?.error || text || `HTTP ${r.status}`);
    } catch {
      throw new Error(text || `HTTP ${r.status}`);
    }
  }
  return JSON.parse(text) as T;
}

// ---------------------- Public API surface ----------------------------

/**
 * Quick readiness check for async workers.
 * Returns true only when Redis & worker are live (Railway).
 */
export async function isAsyncReady(): Promise<boolean> {
  try {
    const res = await getJson<{ enabled: boolean; healthy: boolean }>(
      `${API_BASE}/queues/health`
    );
    return !!(res.enabled && res.healthy);
  } catch {
    return false;
  }
}

/**
 * Kick off async routine generation. Returns the BullMQ job id and status URL.
 * Handles idempotency header to avoid accidental double-enqueue on flaky networks.
 */
export async function startRoutineAsync(args: StartRoutineArgs): Promise<{
  jobId: string;
  statusUrl: string; // server-relative path (e.g., /jobs/:id)
}> {
  const idem = args.idempotencyKey ?? uuidLike();
  const payload: Record<string, unknown> = {
    scores: args.scores,
  };
  if (args.context) payload.context = args.context;
  if (args.protocolVersion) payload.protocolVersion = args.protocolVersion;

  const res = await postJson<{ job_id: string; status_url: string }>(
    `${API_BASE}/routine/async`,
    payload,
    {
      "X-Idempotency-Key": idem,
      ...buildAuthHeaders({ includeLegacy: true }),
    }
  );

  return { jobId: res.job_id, statusUrl: res.status_url };
}

/**
 * Fetch a single job snapshot.
 */
export async function getJob(jobId: string): Promise<JobSnapshot> {
  return getJson<JobSnapshot>(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
}

export type PollOptions = {
  /** initial delay between polls (ms). Default 1200 */
  intervalMs?: number;
  /** max delay between polls (ms). Default 5000 */
  maxIntervalMs?: number;
  /** absolute timeout (ms). Default 60_000 */
  timeoutMs?: number;
  /** optional hook for UI updates (receives each snapshot) */
  onUpdate?: (snap: JobSnapshot) => void;
};

/**
 * Poll a job until completed or failed. Uses simple exponential backoff.
 */
export async function pollJob(
  jobId: string,
  opts: PollOptions = {}
): Promise<JobSnapshot & ({ status: "completed"; result: RoutineResult } | { status: "failed" })> {
  const start = Date.now();
  let delay = Math.max(300, opts.intervalMs ?? 1200);
  const maxDelay = Math.max(delay, opts.maxIntervalMs ?? 5000);
  const timeout = opts.timeoutMs ?? 60_000;

  while (true) {
    const snap = await getJob(jobId);
    opts.onUpdate?.(snap);

    if (snap.status === "completed") {
      // type guard: ensure result present
      if (!("result" in snap)) throw new Error("completed_without_result");
      return snap as any;
    }
    if (snap.status === "failed") {
      const msg = (snap as any).error?.message ?? "async_job_failed";
      throw new Error(msg);
    }

    if (Date.now() - start > timeout) {
      throw new Error("async_poll_timeout");
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(Math.floor(delay * 1.5), maxDelay);
  }
}

/**
 * Convenience: one-shot helper that starts, then polls until completion.
 * You can wire this to a single “Generate routine” button.
 */
export async function generateRoutineAsync(args: StartRoutineArgs, poll?: PollOptions) {
  const { jobId } = await startRoutineAsync(args);
  const done = await pollJob(jobId, poll);
  return done; // returns completed snapshot with result (or throws on failure)
}

// ---------------------- Usage pattern (example) ----------------------
// if (await isAsyncReady()) {
//   const { status, result } = await generateRoutineAsync({
//     scores,
//     context: { goal: "jawline", nonce: uuidLike() },
//     protocolVersion: "v1",
//   }, {
//     onUpdate: (s) => setSpinnerLabel(s.status),
//     timeoutMs: 90_000,
//   });
//   if (status === "completed") renderRoutine(result.days);
// }
