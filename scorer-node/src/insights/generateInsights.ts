// scorer-node/src/insights/generateInsights.ts
// Builds scan context, calls gpt-4o-mini, saves result to insights table.

import OpenAI from "openai";
import { InsightContentSchema } from "../validators.js";
import { getAllScansForUser, type ScanRecord } from "../supabase/scans.js";
import { getAnalysisForScanBatch } from "../supabase/analyses.js";
import { upsertInsight } from "../supabase/insights.js";
import { metricKeys } from "../validators.js";

/* -------------------------------------------------------------------------- */
/*   OpenAI client singleton                                                  */
/* -------------------------------------------------------------------------- */

let _openai: OpenAI | null = null;

export function setInsightsOpenAIClient(client: OpenAI): void {
  _openai = client;
}

export function getInsightsOpenAIClient(): OpenAI | null {
  return _openai;
}

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function avgScore(scan: ScanRecord): number {
  const scores = scan.scores as Record<string, number>;
  const vals = metricKeys
    .map((k) => scores[k])
    .filter((v): v is number => typeof v === "number");
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScanForPrompt(
  scan: ScanRecord,
  label: string,
  explanationText?: string
): string {
  const s = scan.scores as Record<string, number>;
  const lines = [
    `${label} — ${formatDate(scan.created_at)}:`,
    `  Overall: ${avgScore(scan)}`,
    `  Jawline: ${s.jawline}, Symmetry: ${s.facial_symmetry}, Skin: ${s.skin_quality}`,
    `  Cheekbones: ${s.cheekbones}, Eyes: ${s.eyes_symmetry}, Nose: ${s.nose_harmony}, Masculinity: ${s.sexual_dimorphism}`,
  ];
  if (explanationText) {
    lines.push(`  AI Analysis: ${explanationText.slice(0, 300)}`);
  }
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/*   Context selection scheme                                                 */
/* -------------------------------------------------------------------------- */

export function selectScanContext(scans: ScanRecord[]): ScanRecord[] {
  // scans must be ordered ASC (oldest first)
  if (scans.length < 2) return [];

  const first = scans[0];
  const latest = scans[scans.length - 1];
  const prev = scans[scans.length - 2];

  const selected = new Map<string, ScanRecord>();
  selected.set(first.id, first);
  if (prev.id !== first.id) selected.set(prev.id, prev);
  selected.set(latest.id, latest);

  if (scans.length >= 10) {
    // best scan ever
    const best = scans.reduce((b, s) => (avgScore(s) > avgScore(b) ? s : b));
    if (!selected.has(best.id)) selected.set(best.id, best);

    // worst scan after baseline — only include as a recovery story if user has surpassed it
    const latestAvg = avgScore(latest);
    const afterBaseline = scans.slice(1, -1);
    if (afterBaseline.length > 0) {
      const worst = afterBaseline.reduce((w, s) =>
        avgScore(s) < avgScore(w) ? s : w
      );
      if (!selected.has(worst.id) && latestAvg > avgScore(worst)) {
        selected.set(worst.id, worst);
      }
    }

    // scan closest to 30 days ago
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const closest = scans.reduce((c, s) => {
      const diff = Math.abs(new Date(s.created_at).getTime() - thirtyDaysAgo);
      const cDiff = Math.abs(new Date(c.created_at).getTime() - thirtyDaysAgo);
      return diff < cDiff ? s : c;
    });
    if (!selected.has(closest.id)) selected.set(closest.id, closest);
  }

  return Array.from(selected.values())
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .slice(0, 6);
}

/* -------------------------------------------------------------------------- */
/*   Prompt builder                                                           */
/* -------------------------------------------------------------------------- */

function buildPrompt(
  selected: ScanRecord[],
  allScans: ScanRecord[],
  analysisMap: Map<string, { explanations: Record<string, unknown> }>
): string {
  const baseline = selected[0];
  const latest = selected[selected.length - 1];
  const baselineAvg = avgScore(baseline);
  const latestAvg = avgScore(latest);
  const overallDelta = Math.round((latestAvg - baselineAvg) * 10) / 10;

  const scanLines = selected.map((scan) => {
    let label: string;
    const scanNumber = allScans.findIndex((s) => s.id === scan.id) + 1;
    if (scan.id === baseline.id) {
      label = `Scan #1 (Baseline)`;
    } else if (scan.id === latest.id) {
      label = `Scan #${scanNumber} (Latest)`;
    } else {
      label = `Scan #${scanNumber}`;
    }

    // Extract a short summary from explanations if available
    let explanationText: string | undefined;
    const analysis = analysisMap.get(scan.id);
    if (analysis?.explanations) {
      const expl = analysis.explanations as Record<string, unknown>;
      // Try to get narrative/summary from explanations
      const texts: string[] = [];
      for (const key of metricKeys) {
        const val = expl[key];
        if (Array.isArray(val) && val.length > 0) {
          texts.push(String(val[0]).slice(0, 60));
        }
      }
      if (texts.length > 0) explanationText = texts.slice(0, 3).join("; ");
    }

    return formatScanForPrompt(scan, label, explanationText);
  });

  return [
    `The user has completed ${allScans.length} facial scan(s). Analyze their progress.`,
    ``,
    `SCAN HISTORY:`,
    ...scanLines.map((l) => l + "\n"),
    `Overall score change from baseline to latest: ${overallDelta >= 0 ? "+" : ""}${overallDelta}`,
    ``,
    `Return a JSON object with this exact structure:`,
    `{`,
    `  "overall_delta": <number — difference in overall avg from baseline to latest>,`,
    `  "verdict": <"improved" | "same" | "declined" — improved if overall_delta > 1.5, declined if < -1.5, else same>,`,
    `  "narrative": <2-3 sentences, max 300 chars — honest, specific, motivating. Reference actual score numbers.>,`,
    `  "metrics": {`,
    `    "jawline": { "delta": <latest - baseline>, "verdict": <"improved"|"same"|"declined"> },`,
    `    "facial_symmetry": { "delta": ..., "verdict": ... },`,
    `    "skin_quality": { "delta": ..., "verdict": ... },`,
    `    "cheekbones": { "delta": ..., "verdict": ... },`,
    `    "eyes_symmetry": { "delta": ..., "verdict": ... },`,
    `    "nose_harmony": { "delta": ..., "verdict": ... },`,
    `    "sexual_dimorphism": { "delta": ..., "verdict": ... }`,
    `  },`,
    `  "advanced": [`,
    `    { "label": <short anatomical label, max 30 chars>, "comment": <specific observation, max 80 chars>, "change": <"improving"|"same"|"worse"> },`,
    `    ... (10 to 13 items total, covering: jaw definition, cheekbone projection, skin texture, eye spacing, brow structure, nose bridge, lip definition, facial thirds balance, temple width, chin projection, neck-jaw angle, overall symmetry, masculinity markers)`,
    `  ]`,
    `}`,
    ``,
    `Metric verdict rules: "improved" if delta >= 2, "declined" if delta <= -2, else "same".`,
    `Advanced change rules: "improving" if trending upward across scans, "worse" if trending down, "same" if stable.`,
    `Return only the JSON object, no markdown fences.`,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*   JSON extraction (handles model wrapping output in code fences)          */
/* -------------------------------------------------------------------------- */

function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const cleaned = fenceMatch ? fenceMatch[1] : text.trim();
  return JSON.parse(cleaned);
}

/* -------------------------------------------------------------------------- */
/*   Public API                                                               */
/* -------------------------------------------------------------------------- */

export async function generateInsightsForUser(
  openai: OpenAI,
  userId: string,
  latestScanId: string
): Promise<void> {
  const allScans = await getAllScansForUser(userId);

  if (allScans.length < 2) {
    console.log(`[insights] user ${userId} has < 2 scans, skipping`);
    return;
  }

  const selected = selectScanContext(allScans);
  if (selected.length < 2) return;

  // Fetch analyses for baseline + latest to enrich prompt
  const selectedIds = selected.map((s) => s.id);
  const analysisMap = await getAnalysisForScanBatch(selectedIds);

  const prompt = buildPrompt(selected, allScans, analysisMap);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert facial aesthetics coach. Analyze the user's facial scan history and return a JSON progress insight. Be honest, specific, and encouraging. Return only valid JSON, no markdown.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  const rawJson = extractJson(rawText);
  const content = InsightContentSchema.parse(rawJson);

  await upsertInsight(userId, latestScanId, content);
  console.log(
    `[insights] saved for user=${userId} latestScanId=${latestScanId} advanced=${content.advanced?.length ?? 0}`
  );
}
