// src/routes/protocols.ts
import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";

import { ScoresSchema, ExplanationsSchemaV2 } from "../validators.js";
import { getScanById } from "../supabase/scans.js";
import { getAnalysisForScan } from "../supabase/analyses.js";

const ProtocolsBuckets = [
  "glass_skin",
  "debloating",
  "facial_symmetry",
  "maxilla",
  "hunter_eyes",
  "cheekbones",
  "nose",
  "jawline",
] as const;

const ProtocolsResponseSchema = z.object({
  protocols: z.object(
    ProtocolsBuckets.reduce((shape, key) => {
      shape[key] = z.string().min(1);
      return shape;
    }, {} as Record<(typeof ProtocolsBuckets)[number], z.ZodString>)
  ),
});

const ScanIdPayloadSchema = z
  .object({
    scanId: z.string().min(1),
    scores: z.never().optional(),
    explanations: z.never().optional(),
  })
  .strict();

const DirectPayloadSchema = z
  .object({
    scanId: z.null().optional(),
    scores: ScoresSchema,
    explanations: ExplanationsSchemaV2.optional().nullable(),
  })
  .strict();

const RequestSchema = z.union([ScanIdPayloadSchema, DirectPayloadSchema]);

type ProtocolsRequest = z.infer<typeof RequestSchema>;

export const router = Router();

let openaiClient: OpenAI | undefined;
export function setProtocolsOpenAIClient(o: OpenAI) {
  openaiClient = o;
}

type ResolvedInput = {
  scanId: string | null;
  source: "history" | "payload";
  scores: z.infer<typeof ScoresSchema>;
  explanations: z.infer<typeof ExplanationsSchemaV2> | null;
  modelVersion: string | null;
};

function pickUserId(req: any, res: any): string | undefined {
  return res?.locals?.userId ?? req?.header?.("x-user-id");
}

function sanitizeExplanations(
  raw: unknown
): z.infer<typeof ExplanationsSchemaV2> | null {
  const parsed = ExplanationsSchemaV2.safeParse(raw);
  if (parsed.success) return parsed.data;
  return null;
}

function buildSystemPrompt() {
  const allowed = `
Glass Skin:
"Wash + Moisturize + SPF 30"
"Exfoliate 2A-/week"
"Retinol 0.25% twice weekly"
"Eye serum HA + peptides PM"
"Accutane consult"

Debloating:
"Chew 25 each bite"
"Tongue-led swallow"
"10-min walk post-meal"
"Na:K ratio 3:2 daily"
"Remove seed oils"
"Ceylon cinnamon with fruit"

Facial Symmetry:
"Thumb pull + chin tuck 2A-30s"
"Tongue chew 6 min"
"Eye + mouth drills 1 min each"
"Hang 3A-30s"
"Sprint 30s  3"

Maxilla:
"MU lift 5 min"
"Nasal breathing 7 min"
"Hard foods for jaw activation"

Hunter Eyes:
"Eye resistance close 3A-10 reps"
"Relax eyebrows"
"Brush/oil brows"

Cheekbones:
"Lateral thumb pull 3A-30s"
"Tongue-led swallow"
"Mastic gum 6 min"

Nose:
"Thumb pull + chin tuck"
"Tongue to palate 10 reps"
"Light bridge tapping 30s"
"Avoid lectins/phytates/oxalates"
"Clay mask 10 min"

Jawline:
"Chin tuck 2A-20s"
"Deep nasal breathing 5 min"
"Thumb push on palate 3A-30s"
`.trim();

  return [
    "You are a facial improvement coach.",
    "Given face scores (0-100) and optional brief explanations (strings), pick EXACTLY ONE protocol per bucket from the fixed library below.",
    "Buckets: glass_skin, debloating, facial_symmetry, maxilla, hunter_eyes, cheekbones, nose, jawline.",
    "Rules:",
    "- Choose only from the provided protocol strings. Never invent or rewrite.",
    "- Tailor selections to the strongest needs implied by scores and explanations.",
    "- Output STRICT JSON matching the required schema and nothing else.",
    "Allowed protocol library:",
    allowed,
  ].join("\n");
}

function buildUserPrompt(input: ResolvedInput) {
  return JSON.stringify(
    {
      scores: input.scores,
      explanations: input.explanations,
      modelVersion: input.modelVersion,
      source: input.source,
      scanId: input.scanId,
      required_schema: {
        protocols: ProtocolsBuckets,
      },
    },
    null,
    2
  );
}

async function generateProtocols(
  openai: OpenAI,
  input: ResolvedInput
): Promise<z.infer<typeof ProtocolsResponseSchema>> {
  const MODEL = "gpt-4o-mini";
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.25,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("protocols_response_not_json");
  }

  return ProtocolsResponseSchema.parse(parsed);
}

router.post("/", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      issues: parsed.error.issues,
    });
  }

  const payload = parsed.data as ProtocolsRequest;
  let resolved: ResolvedInput;

  try {
    if ("scanId" in payload && payload.scanId) {
      const userId = pickUserId(req, res);
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }

      const scan = await getScanById(userId, payload.scanId);
      if (!scan) {
        return res.status(404).json({ error: "scan_not_found" });
      }
      const analysis = await getAnalysisForScan(scan.id);
      const scores = ScoresSchema.parse(scan.scores);
      resolved = {
        scanId: scan.id,
        source: "history",
        scores,
        explanations: sanitizeExplanations(analysis?.explanations) ?? null,
        modelVersion: scan.model_version ?? null,
      };
    } else {
      const direct = DirectPayloadSchema.parse(payload);
      const scores = ScoresSchema.parse(direct.scores);
      resolved = {
        scanId: null,
        source: "payload",
        scores,
        explanations: direct.explanations ? sanitizeExplanations(direct.explanations) : null,
        modelVersion: null,
      };
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "protocols_source_failed", detail: String(err?.message || err) });
  }

  if (!openaiClient) {
    return res.status(500).json({ error: "openai_unavailable" });
  }

  try {
    const t0 = Date.now();
    const protocols = await generateProtocols(openaiClient, resolved);
    return res.json({
      scanId: resolved.scanId,
      source: resolved.source,
      modelVersion: resolved.modelVersion,
      createdAt: new Date().toISOString(),
      protocols: protocols.protocols,
      latencyMs: Date.now() - t0,
    });
  } catch (err: any) {
    if (err?.issues) {
      return res.status(502).json({
        error: "protocols_shape_invalid",
        detail: "Upstream response failed validation.",
        issues: err.issues,
      });
    }
    const message = String(err?.message || err || "protocols_generation_failed");
    const status = message === "protocols_response_not_json" ? 502 : 500;
    return res.status(status).json({
      error: "protocols_generation_failed",
      detail: message,
    });
  }
});

export default router;

// SUMMARY:
// - New POST /protocols route with zod validation
// - Supports scanId OR raw scores+explanations
// - Calls OpenAI in JSON mode with fixed protocol library
// - Returns { scanId, source, modelVersion, createdAt, protocols{} }
