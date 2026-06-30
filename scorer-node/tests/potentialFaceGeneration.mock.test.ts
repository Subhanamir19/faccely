import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.OPENAI_API_KEY ??= "sk-test";

const service = await import("../src/services/potentialFaceGeneration.js");

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

const baseRow = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: "user-1",
  baseline_scan_id: "00000000-0000-0000-0000-000000000002",
  stage: 1,
  status: "pending",
  primary_image_path: null,
  alternate_image_path: null,
  prompt_version: "v1",
  targeted_metrics: [],
  regenerated_count: 0,
  error_reason: null,
  generated_at: null,
  unlocked_at: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} as const;

const baseScan = {
  id: baseRow.baseline_scan_id,
  user_id: baseRow.user_id,
  created_at: new Date(0).toISOString(),
  model_version: "test-model",
  front_image_path: "user-1/front.jpg",
  side_image_path: null,
  scores: {},
} as const;

const baseAdvancedResult = {
  cheekbones: {
    width_score: 62,
    maxilla_score: 35,
    bone_structure_score: 58,
    face_fat_score: 45,
    fwhr_score: 30,
  },
  jawline: {
    development_score: 40,
    gonial_angle_score: 52,
    projection_score: 47,
  },
  eyes: {
    canthal_tilt_score: 44,
    eye_type_score: 25,
    brow_volume_score: 55,
    symmetry_score: 60,
  },
  skin: {
    color_score: 50,
    quality_score: 22,
  },
} as const;

async function makeJpeg() {
  return sharp({
    create: {
      width: 64,
      height: 96,
      channels: 3,
      background: "#777777",
    },
  }).jpeg().toBuffer();
}

function makeOpenAI(response: unknown, calls: { count: number; prompts?: string[] }) {
  return {
    images: {
      edit: async (input: { prompt?: string }) => {
        calls.count += 1;
        if (input.prompt) calls.prompts?.push(input.prompt);
        return response;
      },
    },
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const row: Mutable<typeof baseRow> = { ...baseRow };
  const attempts: unknown[] = [];
  const readyRows: unknown[] = [];
  const failedRows: unknown[] = [];

  return {
    attempts,
    readyRows,
    failedRows,
    deps: {
      getPotentialFaceById: async () => row,
      getScanById: async () => baseScan,
      getAnalysisForScan: async () => ({
        id: "analysis-1",
        scan_id: baseScan.id,
        created_at: new Date(0).toISOString(),
        explanations: {},
        advanced_result: baseAdvancedResult,
      }),
      hasWeeklyGenerationCapacity: async () => true,
      downloadScanImage: async () => makeJpeg(),
      uploadPotentialFaceImage: async (input: { variant: string }) =>
        `${baseRow.user_id}/${baseRow.stage}/${input.variant}-test.jpg`,
      markReady: async (input: {
        primaryImagePath: string;
        alternateImagePath: string | null;
        targetedMetrics: unknown[];
        promptVersion: string;
      }) => {
        const ready = {
          ...row,
          status: "ready",
          primary_image_path: input.primaryImagePath,
          alternate_image_path: input.alternateImagePath,
          prompt_version: input.promptVersion,
          targeted_metrics: input.targetedMetrics,
          generated_at: new Date().toISOString(),
        };
        readyRows.push(ready);
        return ready;
      },
      markFailed: async (input: { errorReason: string }) => {
        const failed = {
          ...row,
          status: "failed",
          error_reason: input.errorReason,
        };
        failedRows.push(failed);
        return failed;
      },
      recordGenerationAttempt: async (input: unknown) => {
        attempts.push(input);
      },
      ...overrides,
    },
  };
}

test.afterEach(() => {
  service.setPotentialFaceGenerationDepsForTest(null);
});

test("records generation telemetry on successful potential-face generation", async () => {
  const imageB64 = Buffer.from("fake-image").toString("base64");
  const calls = { count: 0, prompts: [] as string[] };
  const openai = makeOpenAI(
    {
      _request_id: "req_success",
      data: [{ b64_json: imageB64 }],
      usage: {
        input_tokens: 1200,
        output_tokens: 1400,
        input_tokens_details: { image_tokens: 1000 },
      },
    },
    calls
  );
  const harness = makeDeps();
  service.setPotentialFaceGenerationDepsForTest(harness.deps as any);

  const result = await service.generatePotentialFace(openai as any, {
    potentialFaceId: baseRow.id,
    isFinalAttempt: false,
  });

  assert.equal(calls.count, 1);
  assert.equal(result?.status, "ready");
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.readyRows.length, 1);
  assert.equal(calls.prompts.length, 1);
  assert.match(calls.prompts[0], /Highest-leverage aesthetic targets/);
  assert.match(calls.prompts[0], /baseline score 22, target 47/);
  assert.match(calls.prompts[0], /only improve haircut shape, density appearance, or facial-hair grooming when those targets are listed/);
  assert.match(calls.prompts[0], /No waxy, plastic, airbrushed/);

  const ready = harness.readyRows[0] as { targeted_metrics: Array<Record<string, unknown>> };
  assert.equal(ready.targeted_metrics.length, 5);
  assert.deepEqual(ready.targeted_metrics[0], {
    group: "skin",
    sub_metric: "quality_score",
    baseline_score: 22,
    target_score: 47,
  });

  const attempt = harness.attempts[0] as Record<string, unknown>;
  assert.equal(attempt.success, true);
  assert.equal(attempt.model, "gpt-image-2");
  assert.equal(attempt.size, "1024x1024");
  assert.equal(attempt.quality, "medium");
  assert.equal(attempt.requestedCandidateCount, 1);
  assert.equal(attempt.candidateCount, 1);
  assert.equal(attempt.providerRequestId, "req_success");
  assert.deepEqual(attempt.providerUsage, {
    input_tokens: 1200,
    output_tokens: 1400,
    input_tokens_details: { image_tokens: 1000 },
  });
  assert.equal(attempt.sourceImageBytes instanceof Number, false);
  assert.equal(typeof attempt.sourceImageBytes, "number");
  assert.equal(attempt.sourceImageWidth, 64);
  assert.equal(attempt.sourceImageHeight, 96);
  assert.equal(attempt.generationPhase, "ready");
});

test("does not throw for BullMQ retry after OpenAI succeeds but upload fails", async () => {
  const imageB64 = Buffer.from("fake-image").toString("base64");
  const calls = { count: 0 };
  const openai = makeOpenAI(
    {
      _request_id: "req_paid_then_upload_failed",
      data: [{ b64_json: imageB64 }],
      usage: {
        input_tokens: 1000,
        output_tokens: 1000,
        input_tokens_details: { image_tokens: 900 },
      },
    },
    calls
  );
  const harness = makeDeps({
    uploadPotentialFaceImage: async () => {
      throw new Error("simulated storage outage");
    },
  });
  service.setPotentialFaceGenerationDepsForTest(harness.deps as any);

  const result = await service.generatePotentialFace(openai as any, {
    potentialFaceId: baseRow.id,
    isFinalAttempt: false,
  });

  assert.equal(calls.count, 1);
  assert.equal(result?.status, "failed");
  assert.equal(harness.failedRows.length, 1);
  assert.equal(harness.readyRows.length, 0);
  assert.equal(harness.attempts.length, 1);

  const attempt = harness.attempts[0] as Record<string, unknown>;
  assert.equal(attempt.success, false);
  assert.equal(attempt.candidateCount, 1);
  assert.equal(attempt.providerRequestId, "req_paid_then_upload_failed");
  assert.equal(attempt.generationPhase, "uploading_primary");
  assert.match(String(attempt.error), /simulated storage outage/);
});

test("does not call OpenAI when advanced analysis is missing", async () => {
  const calls = { count: 0 };
  const openai = makeOpenAI({ data: [] }, calls);
  const harness = makeDeps({
    getAnalysisForScan: async () => null,
  });
  service.setPotentialFaceGenerationDepsForTest(harness.deps as any);

  await assert.rejects(
    () =>
      service.generatePotentialFace(openai as any, {
        potentialFaceId: baseRow.id,
        isFinalAttempt: false,
      }),
    /Advanced analysis must be saved/
  );

  assert.equal(calls.count, 0);
  assert.equal(harness.readyRows.length, 0);
  assert.equal(harness.failedRows.length, 0);
  assert.equal(harness.attempts.length, 1);

  const attempt = harness.attempts[0] as Record<string, unknown>;
  assert.equal(attempt.success, false);
  assert.equal(attempt.candidateCount, 0);
  assert.equal(attempt.generationPhase, "pre_openai");
  assert.match(String(attempt.error), /advanced_analysis_missing/);
});
