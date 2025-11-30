// src/utils/normalizeProtocolsPayload.ts
export const ProtocolsBuckets = [
  "glass_skin",
  "debloating",
  "facial_symmetry",
  "maxilla",
  "hunter_eyes",
  "cheekbones",
  "nose",
  "jawline",
] as const;

export function normalizeProtocolsPayload(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("protocols_response_not_json");
  }

  // If already structured, leave as-is
  if (parsed && typeof parsed === "object" && (parsed as any).protocols) {
    return parsed;
  }

  // Attempt to recover bucket values from top-level or nested objects
  if (parsed && typeof parsed === "object") {
    const maybeProtocols: Record<string, string> = {};
    let foundAny = false;

    for (const key of ProtocolsBuckets) {
      const rawVal = (parsed as any)[key];
      let line: string | undefined;

      if (typeof rawVal === "string" && rawVal.trim().length > 0) {
        line = rawVal;
      } else if (rawVal && typeof rawVal === "object") {
        const candidate =
          (typeof rawVal.protocol === "string" && rawVal.protocol.trim().length > 0 && rawVal.protocol) ||
          (typeof rawVal.value === "string" && rawVal.value.trim().length > 0 && rawVal.value) ||
          (typeof rawVal.text === "string" && rawVal.text.trim().length > 0 && rawVal.text) ||
          undefined;
        if (candidate) {
          line = candidate;
        }
      }

      if (line) {
        maybeProtocols[key] = line;
        foundAny = true;
      }
    }

    if (foundAny) {
      return { protocols: maybeProtocols };
    }
  }

  throw new Error("protocols_payload_unrecoverable");
}
