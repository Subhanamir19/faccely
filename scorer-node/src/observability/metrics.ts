// src/observability/metrics.ts
// Minimal Prometheus-style metrics without extra deps.
// Exposes queue depths, concurrency stats, and basic process stats.

import type { Application } from "express";
import os from "node:os";
import { queuesProbe } from "../queue/index.js";
import { SERVICE, SERVER } from "../config/index.js";

// Counters for request tracking (in-memory, resets on restart)
const requestCounters = {
  total: 0,
  success: 0,
  error: 0,
  timeout: 0,
  overloaded: 0,
};

const openaiCounters = {
  requests: 0,
  success: 0,
  retries: 0,
  failures: 0,
  rateLimited: 0,
};

// Export functions to increment counters from other modules
export function incrementRequestCounter(type: keyof typeof requestCounters) {
  requestCounters[type]++;
}

export function incrementOpenAICounter(type: keyof typeof openaiCounters) {
  openaiCounters[type]++;
}

// Concurrency state getter (will be set by index.ts)
let getConcurrencyState: () => { active: number; queuePending: number } = () => ({ active: 0, queuePending: 0 });

/**
 * Render a small text payload in Prometheus exposition format.
 */
function renderPrometheusText(sample: {
  service: { name: string; version: string };
  queueCounts?: Record<
    string,
    Partial<{
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    }>
  >;
  process: {
    pid: number;
    rss_bytes: number;
    heap_used_bytes: number;
    heap_total_bytes: number;
    external_bytes: number;
    cpu_user_ms?: number;
    cpu_system_ms?: number;
    uptime_seconds: number;
  };
  system: {
    load1: number;
    load5: number;
    load15: number;
    totalmem_bytes: number;
    freemem_bytes: number;
  };
}) {
  const lines: string[] = [];

  // Service meta
  lines.push(`# HELP sigma_service_info Build/service metadata`);
  lines.push(`# TYPE sigma_service_info gauge`);
  lines.push(
    `sigma_service_info{service="${sample.service.name}",version="${sample.service.version}"} 1`
  );

  // Queue counts
  if (sample.queueCounts) {
    lines.push(`# HELP sigma_queue_jobs Number of jobs by state`);
    lines.push(`# TYPE sigma_queue_jobs gauge`);
    for (const [q, counts] of Object.entries(sample.queueCounts)) {
      for (const [k, v] of Object.entries(counts)) {
        if (typeof v === "number") {
          lines.push(`sigma_queue_jobs{queue="${q}",state="${k}"} ${v}`);
        }
      }
    }
  }

  // Process stats
  lines.push(`# HELP sigma_process_memory_bytes Node.js memory usage in bytes`);
  lines.push(`# TYPE sigma_process_memory_bytes gauge`);
  lines.push(`sigma_process_memory_bytes{type="rss"} ${sample.process.rss_bytes}`);
  lines.push(`sigma_process_memory_bytes{type="heap_used"} ${sample.process.heap_used_bytes}`);
  lines.push(`sigma_process_memory_bytes{type="heap_total"} ${sample.process.heap_total_bytes}`);
  lines.push(`sigma_process_memory_bytes{type="external"} ${sample.process.external_bytes}`);

  if (sample.process.cpu_user_ms != null) {
    lines.push(`# HELP sigma_process_cpu_ms CPU time spent by the process (ms)`);
    lines.push(`# TYPE sigma_process_cpu_ms counter`);
    lines.push(`sigma_process_cpu_ms{type="user"} ${sample.process.cpu_user_ms}`);
    lines.push(`sigma_process_cpu_ms{type="system"} ${sample.process.cpu_system_ms ?? 0}`);
  }

  lines.push(`# HELP sigma_process_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE sigma_process_uptime_seconds gauge`);
  lines.push(`sigma_process_uptime_seconds ${sample.process.uptime_seconds}`);

  // System load/memory
  lines.push(`# HELP sigma_system_loadavg Linux load averages`);
  lines.push(`# TYPE sigma_system_loadavg gauge`);
  lines.push(`sigma_system_loadavg{window="1"} ${sample.system.load1}`);
  lines.push(`sigma_system_loadavg{window="5"} ${sample.system.load5}`);
  lines.push(`sigma_system_loadavg{window="15"} ${sample.system.load15}`);

  lines.push(`# HELP sigma_system_memory_bytes System memory in bytes`);
  lines.push(`# TYPE sigma_system_memory_bytes gauge`);
  lines.push(`sigma_system_memory_bytes{type="total"} ${sample.system.totalmem_bytes}`);
  lines.push(`sigma_system_memory_bytes{type="free"} ${sample.system.freemem_bytes}`);

  // Concurrency metrics
  const concurrency = getConcurrencyState();
  lines.push(`# HELP sigma_concurrency_slots Concurrent processing slots`);
  lines.push(`# TYPE sigma_concurrency_slots gauge`);
  lines.push(`sigma_concurrency_slots{type="active"} ${concurrency.active}`);
  lines.push(`sigma_concurrency_slots{type="max"} ${SERVER.maxConcurrent}`);
  lines.push(`sigma_concurrency_slots{type="queue_pending"} ${concurrency.queuePending}`);
  lines.push(`sigma_concurrency_slots{type="queue_max"} ${SERVER.requestQueueMaxPending}`);

  // Request counters
  lines.push(`# HELP sigma_requests_total Total HTTP requests by status`);
  lines.push(`# TYPE sigma_requests_total counter`);
  lines.push(`sigma_requests_total{status="total"} ${requestCounters.total}`);
  lines.push(`sigma_requests_total{status="success"} ${requestCounters.success}`);
  lines.push(`sigma_requests_total{status="error"} ${requestCounters.error}`);
  lines.push(`sigma_requests_total{status="timeout"} ${requestCounters.timeout}`);
  lines.push(`sigma_requests_total{status="overloaded"} ${requestCounters.overloaded}`);

  // OpenAI counters
  lines.push(`# HELP sigma_openai_total OpenAI API calls by outcome`);
  lines.push(`# TYPE sigma_openai_total counter`);
  lines.push(`sigma_openai_total{status="requests"} ${openaiCounters.requests}`);
  lines.push(`sigma_openai_total{status="success"} ${openaiCounters.success}`);
  lines.push(`sigma_openai_total{status="retries"} ${openaiCounters.retries}`);
  lines.push(`sigma_openai_total{status="failures"} ${openaiCounters.failures}`);
  lines.push(`sigma_openai_total{status="rate_limited"} ${openaiCounters.rateLimited}`);

  return lines.join("\n") + "\n";
}

// Allow index.ts to provide the concurrency state getter
export function setConcurrencyStateGetter(getter: () => { active: number; queuePending: number }) {
  getConcurrencyState = getter;
}

export function initMetrics(
  app: Application,
  opts: { enabled?: boolean; path?: string } = {}
) {
  const enabled = opts.enabled ?? true;
  const path = opts.path ?? "/metrics";
  if (!enabled) return;

  app.get(path, async (_req, res) => {
    // Queue probe: tolerate multiple shapes
    let queueCounts:
      | Record<string, Partial<{ waiting: number; active: number; completed: number; failed: number; delayed: number; paused: number }>>
      | undefined;

    try {
      const probe: any = await queuesProbe();

      // Accept either {queues: {...}} or a flat map {...} that looks like counts.
      const candidate = (probe && (probe.queues ?? probe)) as Record<string, any> | undefined;

      if (candidate && typeof candidate === "object") {
        // Heuristic: if the object has keys that look like queue names mapping to count objects,
        // and not just {enabled, healthy, reason}, accept it.
        const keys = Object.keys(candidate);
        const looksLikeHealth = "enabled" in candidate && "healthy" in candidate;
        if (!looksLikeHealth && keys.length) {
          queueCounts = candidate;
        }
      }
    } catch {
      // keep endpoint alive even if Redis is down
      queueCounts = undefined;
    }

    const mu = process.memoryUsage();
    const cpu = process.cpuUsage?.();
    const payload = renderPrometheusText({
      service: { name: SERVICE.name, version: SERVICE.version },
      queueCounts,
      process: {
        pid: process.pid,
        rss_bytes: mu.rss ?? 0,
        heap_used_bytes: mu.heapUsed ?? 0,
        heap_total_bytes: mu.heapTotal ?? 0,
        external_bytes: (mu as any).external ?? 0,
        cpu_user_ms: cpu ? (cpu.user as number) / 1000 : undefined,
        cpu_system_ms: cpu ? (cpu.system as number) / 1000 : undefined,
        uptime_seconds: Math.floor(process.uptime()),
      },
      system: {
        load1: os.loadavg()[0] ?? 0,
        load5: os.loadavg()[1] ?? 0,
        load15: os.loadavg()[2] ?? 0,
        totalmem_bytes: os.totalmem(),
        freemem_bytes: os.freemem(),
      },
    });

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(payload);
  });
}
