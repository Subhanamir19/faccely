import { composeSigmaPrompt } from "../src/services/sigmaPrompt.ts";

const out = composeSigmaPrompt(
  { thread_id: "1", user_text: "How to sharpen my jawline?", share_scores: true },
  { latest_scores: { jawline: 68 } }
);
console.log(out);
