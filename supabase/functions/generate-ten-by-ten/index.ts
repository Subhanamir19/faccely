// supabase/functions/generate-ten-by-ten/index.ts
// Edge function: receives a face photo (base64) + user metadata,
// calls OpenAI gpt-image-1 images.edit, returns the generated image URL.
//
// Deploy:  supabase functions deploy generate-ten-by-ten
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildPrompt(metadata: {
  gender?: string | null;
  ethnicity?: string | null;
  age?: number | null;
}): string {
  const genderNote = metadata.gender ? `${metadata.gender} person` : "person";
  const ethnicityNote = metadata.ethnicity ? `, ${metadata.ethnicity} ethnicity` : "";
  const ageNote = metadata.age ? `, approximately ${metadata.age} years old` : "";

  return (
    `Enhance this ${genderNote}${ethnicityNote}${ageNote} to their ideal facial potential. ` +
    `Make the following improvements while strictly preserving their identity, skin tone, eye color, and hair: ` +
    `(1) sharpen and define the jawline and chin for a chiseled look, ` +
    `(2) create hunter eyes with a slight positive canthal tilt and well-defined orbital rims, ` +
    `(3) improve forward maxilla projection and cheekbone prominence, ` +
    `(4) clear, smooth, and perfect the skin texture and complexion. ` +
    `The result must be photorealistic, natural-looking, and clearly the same person — just their best version.`
  );
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", metadata = {} } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Decode base64 → Blob
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: mimeType });

    // Build multipart form for OpenAI images.edit
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", imageBlob, "face.jpg");
    formData.append("prompt", buildPrompt(metadata));
    formData.append("n", "1");
    formData.append("size", "1024x1024");

    const openAiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    const openAiResult = await openAiResponse.json();

    if (!openAiResponse.ok) {
      const msg = openAiResult?.error?.message ?? "OpenAI API error";
      console.error("[generate-ten-by-ten] OpenAI error:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const imageData = openAiResult?.data?.[0];
    if (!imageData) {
      return new Response(JSON.stringify({ error: "No image returned from OpenAI" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Return URL (if present) or b64_json
    return new Response(
      JSON.stringify({
        url: imageData.url ?? null,
        b64: imageData.b64_json ?? null,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[generate-ten-by-ten] Unexpected error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
