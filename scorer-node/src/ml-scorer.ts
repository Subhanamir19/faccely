// C:\SS\scorer-node\src\ml-scorer.ts
/**
 * ML Scoring Client - calls the Python FastAPI microservice for facial scoring.
 * Uses local EfficientNet-B0 model instead of OpenAI API.
 */

import type { Scores } from "./validators.js";
import { ML_SCORING } from "./config/index.js";
import FormData from "form-data";

type ScoreResult = { scores: Scores; modelVersion: string };

// Timeout for ML API calls (30 seconds)
const ML_API_TIMEOUT_MS = 30_000;

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { headers?: Record<string, string> },
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Score a single image using the ML API.
 */
export async function scoreWithML(imageBuffer: Buffer): Promise<ScoreResult> {
  if (!ML_SCORING.apiUrl) {
    throw new Error("ML_SCORING_API_URL not configured");
  }

  const formData = new FormData();
  formData.append("image", imageBuffer, {
    filename: "image.jpg",
    contentType: "image/jpeg",
  });

  const response = await fetchWithTimeout(
    `${ML_SCORING.apiUrl}/score`,
    {
      method: "POST",
      body: formData as any,
      headers: formData.getHeaders(),
    },
    ML_API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  console.log("[ml-scorer] ML API response:", result);

  return {
    scores: result.scores,
    modelVersion: result.modelVersion || "efficientnet_b0_v1",
  };
}

/**
 * Score a pair of images (frontal + side) using the ML API.
 * Note: Current ML model only uses frontal image.
 */
export async function scoreWithMLPair(
  frontalBuffer: Buffer,
  sideBuffer: Buffer
): Promise<ScoreResult> {
  if (!ML_SCORING.apiUrl) {
    throw new Error("ML_SCORING_API_URL not configured");
  }

  const formData = new FormData();
  formData.append("frontal", frontalBuffer, {
    filename: "frontal.jpg",
    contentType: "image/jpeg",
  });
  formData.append("side", sideBuffer, {
    filename: "side.jpg",
    contentType: "image/jpeg",
  });

  const response = await fetchWithTimeout(
    `${ML_SCORING.apiUrl}/score/pair`,
    {
      method: "POST",
      body: formData as any,
      headers: formData.getHeaders(),
    },
    ML_API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  console.log("[ml-scorer] ML API pair response:", result);

  return {
    scores: result.scores,
    modelVersion: result.modelVersion || "efficientnet_b0_v1",
  };
}

/**
 * Check if the ML scoring service is healthy.
 */
export async function checkMLHealth(): Promise<boolean> {
  if (!ML_SCORING.apiUrl) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(
      `${ML_SCORING.apiUrl}/health`,
      { method: "GET" },
      5000 // 5 second timeout for health check
    );
    if (!response.ok) return false;

    const data = await response.json();
    // Check that model is actually loaded
    return data.model_loaded === true;
  } catch {
    return false;
  }
}
