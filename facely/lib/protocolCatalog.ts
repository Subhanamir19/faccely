// facely/lib/protocolCatalog.ts
// Structured catalog of skincare, dietary, and lifestyle protocol add-ons.
// These complement the facial exercise tasks and appear as daily add-ons.

import type { ScoreField, TargetArea } from "./taskSelection";

export type ProtocolType = "skincare" | "dietary" | "lifestyle";

export type ProtocolEntry = {
  id: string;
  name: string;
  type: ProtocolType;
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
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Reduces morning puffiness and activates circulation for a sharper, more defined look",
  },
  {
    id: "gua-sha",
    name: "Gua Sha Massage",
    type: "skincare",
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
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Ice reduces active inflammation and tightens pores — proven for acne-prone and congested skin",
  },
  {
    id: "oil-cleanser",
    name: "Oil-Based Cleanser",
    type: "skincare",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Dissolves sebum and buildup without stripping the barrier — the foundation of double cleanse",
  },
  {
    id: "bentonite-clay-mask",
    name: "Bentonite Clay Mask",
    type: "skincare",
    targets: ["skin"],
    scoreFields: ["skin_quality"],
    scoreTrigger: { field: "skin_quality", below: 70 },
    reason: "Deep-cleans pores and reduces excess oil — use 1-2x per week for measurable results",
  },
  {
    id: "turmeric-mask",
    name: "Turmeric Mask",
    type: "skincare",
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
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry", "sexual_dimorphism"],
    always: true,
    reason: "High-intensity sprints spike testosterone and drop cortisol — reshapes body and face composition",
  },
  {
    id: "nasal-breathing",
    name: "Nasal Breathing Practice",
    type: "lifestyle",
    targets: ["jawline", "all"],
    scoreFields: ["jawline", "facial_symmetry"],
    always: true,
    reason: "Consistent nasal breathing gradually improves palate structure and forward facial growth",
  },
  {
    id: "cold-shower",
    name: "Cold Shower",
    type: "lifestyle",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Reduces systemic inflammation and tightens facial skin — major recovery protocol for puffiness",
  },
  {
    id: "sunlight-exposure",
    name: "10-Min Morning Sunlight",
    type: "lifestyle",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "Sets circadian rhythm and boosts vitamin D — critical for skin health and testosterone production",
  },
  {
    id: "mewing",
    name: "Mewing (Tongue Posture)",
    type: "lifestyle",
    targets: ["jawline", "cheekbones"],
    scoreFields: ["jawline", "cheekbones", "facial_symmetry"],
    always: true,
    reason: "Correct resting tongue posture reshapes the maxilla and defines the midface over months",
  },
  {
    id: "back-sleeping",
    name: "Sleep on Your Back Tonight",
    type: "lifestyle",
    targets: ["all"],
    scoreFields: ["facial_symmetry"],
    always: true,
    reason: "Prevents unilateral compression and supports symmetry — small habit, compounding results",
  },

  // ── Dietary ───────────────────────────────────────────────────────────────

  {
    id: "lemon-electrolytes",
    name: "Lemon + Electrolytes",
    type: "dietary",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Alkalises the body and flushes retained water — the most effective morning debloating ritual",
  },
  {
    id: "egg-yolk-banana",
    name: "Egg Yolks + Banana",
    type: "dietary",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "B vitamins from yolks and potassium from banana fuel recovery and reduce facial puffiness",
  },
  {
    id: "black-raisins",
    name: "Black Raisins (soaked overnight)",
    type: "dietary",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality"],
    always: true,
    reason: "High iron and antioxidant content supports skin clarity and reduces oxidative stress",
  },
  {
    id: "raw-banana",
    name: "Raw (Unripe) Banana",
    type: "dietary",
    targets: ["all"],
    scoreFields: ["skin_quality", "facial_symmetry"],
    always: true,
    reason: "Resistant starch feeds gut bacteria and reduces systemic inflammation that causes face puffiness",
  },
  {
    id: "beef-liver",
    name: "Beef Liver",
    type: "dietary",
    targets: ["skin", "all"],
    scoreFields: ["skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "The most bioavailable source of vitamin A, B12 and iron — directly improves skin and hormone levels",
  },
  {
    id: "red-meat",
    name: "Red Meat (unprocessed)",
    type: "dietary",
    targets: ["jawline", "all"],
    scoreFields: ["jawline", "skin_quality", "sexual_dimorphism"],
    always: true,
    reason: "High in zinc and collagen precursors — supports jaw muscle development and long-term skin structure",
  },
  {
    id: "unsalted-cheese",
    name: "Unsalted Cheese",
    type: "dietary",
    targets: ["jawline", "cheekbones"],
    scoreFields: ["jawline", "cheekbones"],
    always: true,
    reason: "Provides calcium and quality protein for bone density — supports structural facial definition",
  },
];
