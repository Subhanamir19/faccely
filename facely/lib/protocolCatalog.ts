// facely/lib/protocolCatalog.ts
// Structured catalog of skincare, dietary, and lifestyle protocol add-ons.
// These complement the facial exercise tasks and appear as daily add-ons.

import type { ScoreField, TargetArea } from "./taskSelection";

export type ProtocolType = "skincare" | "dietary" | "lifestyle";

export type ProtocolEntry = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string; // e.g. "6–8 sprints", "300–600mg", "1 glass"
  targets: TargetArea[];
  scoreFields: ScoreField[];
  // Trigger conditions — at least one must be true to surface this protocol
  scoreTrigger?: { field: ScoreField; below: number };
  goalTrigger?: string[];
  always?: boolean;
  reason: string;
};

export const PROTOCOL_CATALOG: ProtocolEntry[] = [
  // ── Skincare — always available ───────────────────────────────────────────

  {
    id: "cold-water-splash",
    name: "Cold Water Splash",
    type: "skincare",
    quantity: "30 sec, morning",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Reduces morning puffiness and activates circulation for a sharper, more defined look",
  },
  {
    id: "gua-sha",
    name: "Gua Sha Massage",
    type: "skincare",
    quantity: "5–10 min",
    targets: ["skin", "jawline", "cheekbones"],
    scoreFields: ["skin_quality", "cheekbones", "jawline"],
    always: true,
    reason: "Drains lymph, reduces facial puffiness and defines the jawline and cheekbone contour",
  },

  // ── Skincare — score-gated (skin_quality < 70) ────────────────────────────

  {
    id: "facial-icing",
    name: "Facial Icing",
    type: "skincare",
    quantity: "2–3 min",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Ice reduces active inflammation and tightens pores — proven for acne-prone and congested skin",
  },
  {
    id: "oil-cleanser",
    name: "Oil-Based Cleanser",
    type: "skincare",
    quantity: "1–2 min, nightly",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Dissolves sebum and buildup without stripping the barrier — the foundation of double cleanse",
  },
  {
    id: "bentonite-clay-mask",
    name: "Bentonite Clay Mask",
    type: "skincare",
    quantity: "15 min, 2x per week",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Deep-cleans pores and reduces excess oil — use 1-2x per week for measurable results",
  },
  {
    id: "turmeric-mask",
    name: "Turmeric Mask",
    type: "skincare",
    quantity: "20 min, 2x per week",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Turmeric + honey + plain yogurt brightens and reduces acne inflammation — backed by clinical evidence",
  },

  // ── Lifestyle ─────────────────────────────────────────────────────────────

  {
    id: "sprint-session",
    name: "Sprint Session",
    type: "lifestyle",
    quantity: "6–8 sprints",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry", "sexual_dimorphism"],
    always: true,
    reason: "High-intensity sprints spike testosterone and drop cortisol — reshapes body and face composition",
  },
  {
    id: "nasal-breathing",
    name: "Nasal Breathing Practice",
    type: "lifestyle",
    quantity: "All day + tape at night",
    targets: ["jawline", "all"],
    scoreFields: ["jawline", "facial_symmetry"],
    always: true,
    reason: "Consistent nasal breathing gradually improves palate structure and forward facial growth",
  },
  {
    id: "cold-shower",
    name: "Cold Shower",
    type: "lifestyle",
    quantity: "2–3 min cold",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Reduces systemic inflammation and tightens facial skin — major recovery protocol for puffiness",
  },
  {
    id: "sunlight-exposure",
    name: "10-Min Morning Sunlight",
    type: "lifestyle",
    quantity: "10–15 min, before 10am",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "Sets circadian rhythm and boosts vitamin D — critical for skin health and testosterone production",
  },
  {
    id: "mewing",
    name: "Mewing (Tongue Posture)",
    type: "lifestyle",
    quantity: "Constant resting posture",
    targets: ["jawline", "cheekbones"],
    scoreFields: ["jawline", "cheekbones", "facial_symmetry"],
    always: true,
    reason: "Correct resting tongue posture reshapes the maxilla and defines the midface over months",
  },
  {
    id: "back-sleeping",
    name: "Sleep on Your Back Tonight",
    type: "lifestyle",
    quantity: "Full night",
    targets: ["all"],
    scoreFields: ["facial_symmetry"],
    always: true,
    reason: "Prevents unilateral compression and supports symmetry — small habit, compounding results",
  },
  {
    id: "high-intensity-exercise",
    name: "High Intensity Training",
    type: "lifestyle",
    quantity: "15–20 min",
    targets: ["all"],
    scoreFields: ["skin_quality", "sexual_dimorphism", "facial_symmetry"],
    always: true,
    reason: "Compound lifts and HIIT spike testosterone and growth hormone — directly improves facial masculinity and body composition",
  },

  // ── Dietary ───────────────────────────────────────────────────────────────

  {
    id: "lemon-electrolytes",
    name: "Lemon + Electrolytes",
    type: "dietary",
    quantity: "1 glass, first thing AM",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Alkalises the body and flushes retained water — the most effective morning debloating ritual",
  },
  {
    id: "egg-yolk-banana",
    name: "Egg Yolks + Banana",
    type: "dietary",
    quantity: "3 yolks + 1 banana",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "B vitamins from yolks and potassium from banana fuel recovery and reduce facial puffiness",
  },
  {
    id: "black-raisins",
    name: "Black Raisins",
    type: "dietary",
    quantity: "Small handful, soaked overnight",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality"],
    always: true,
    reason: "High iron and antioxidant content supports skin clarity and reduces oxidative stress",
  },
  {
    id: "raw-banana",
    name: "Raw (Unripe) Banana",
    type: "dietary",
    quantity: "5–6 bananas",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Resistant starch feeds gut bacteria and reduces systemic inflammation that causes face puffiness",
  },
  {
    id: "beef-liver",
    name: "Beef Liver",
    type: "dietary",
    quantity: "100–150g",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "The most bioavailable source of vitamin A, B12 and iron — directly improves skin and hormone levels",
  },
  {
    id: "red-meat",
    name: "Red Meat (unprocessed)",
    type: "dietary",
    quantity: "150–200g",
    targets: ["jawline", "all"],
    scoreFields: ["jawline", "skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "High in zinc and collagen precursors — supports jaw muscle development and long-term skin structure",
  },
  {
    id: "unsalted-cheese",
    name: "Unsalted Cheese",
    type: "dietary",
    quantity: "50–80g",
    targets: ["jawline", "cheekbones"],
    scoreFields: ["jawline", "cheekbones"],
    always: true,
    reason: "Provides calcium and quality protein for bone density — supports structural facial definition",
  },
  {
    id: "ashwagandha",
    name: "Ashwagandha",
    type: "dietary",
    quantity: "300–600mg",
    targets: ["all"],
    scoreFields: ["skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "Clinically proven to lower cortisol by 30% and raise testosterone — reduces facial puffiness and stress-driven skin breakdown",
  },
  {
    id: "raw-milk",
    name: "Raw Milk",
    type: "dietary",
    quantity: "1–2 glasses",
    targets: ["jawline", "all"],
    scoreFields: ["jawline", "skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "Bioavailable calcium, growth factors and fat-soluble vitamins support bone density and hormonal function",
  },
];
