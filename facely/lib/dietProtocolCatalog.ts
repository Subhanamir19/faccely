import type { ImageSourcePropType } from "react-native";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import type { ProtocolType } from "@/lib/protocolCatalog";
import type { ScoreField } from "@/lib/taskSelection";

export type DietNeedId =
  | "structure_width"
  | "bone_mass"
  | "testosterone_support"
  | "igf1_support"
  | "skin_health"
  | "facial_leanness";

export type DietProtocolEntry = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  targets: DietNeedId[];
  influence: Partial<Record<DietNeedId, number>>;
  reason: string;
  image: ImageSourcePropType;
  tags?: Array<"food" | "drink" | "supplement">;
};

export type DietProtocolPick = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  reason: string;
};

type DietSelectionInput = {
  dateStr: string;
  scores: Partial<Record<ScoreField, number>> | null;
  goals: string[] | null;
  advanced?: AdvancedAnalysis | null;
  recentProtocolIds?: string[];
};

type DietShuffleInput = DietSelectionInput & {
  currentProtocolIds: string[];
  shuffleSeed?: number;
};

const MIN_DAILY_DIET_PROTOCOLS = 3;
const MAX_DAILY_DIET_PROTOCOLS = 4;

const TARGET_LABELS: Record<DietNeedId, string> = {
  structure_width: "cheekbone width",
  bone_mass: "bone mass",
  testosterone_support: "testosterone support",
  igf1_support: "IGF-1 support",
  skin_health: "skin health",
  facial_leanness: "facial leanness",
};

const img = {
  vitaminD3K2: require("@/assets/ASSETS-FOR-DIET/icons/vitamin-d3-k2.jpg"),
  avocado: require("@/assets/ASSETS-FOR-DIET/icons/avocado-slices.jpg"),
  zinc: require("@/assets/ASSETS-FOR-DIET/icons/zinc-supplement.jpg"),
  boneBroth: require("@/assets/ASSETS-FOR-DIET/icons/bone-broth.jpg"),
  unsaltedCheese: require("@/assets/ASSETS-FOR-DIET/icons/unsalted-cheese.jpg"),
  beefLiver: require("@/assets/ASSETS-FOR-DIET/icons/beef-liver.jpg"),
  eggYolks: require("@/assets/ASSETS-FOR-DIET/icons/egg-yolks.jpg"),
  rawKefir: require("@/assets/ASSETS-FOR-DIET/icons/raw-kefir.jpg"),
  ashwagandha: require("@/assets/ASSETS-FOR-DIET/icons/ashwagandha.jpg"),
  magnesiumAlmonds: require("@/assets/ASSETS-FOR-DIET/icons/magnesium-almonds.jpg"),
  oysters: require("@/assets/ASSETS-FOR-DIET/icons/oysters.jpg"),
  chiaSeeds: require("@/assets/ASSETS-FOR-DIET/icons/chia-seeds.jpg"),
  raisins: require("@/assets/ASSETS-FOR-DIET/icons/boron-raisins.jpg"),
  wholeEggs: require("@/assets/ASSETS-FOR-DIET/icons/whole-eggs.jpg"),
  beef: require("@/assets/ASSETS-FOR-DIET/icons/beef-steak.jpg"),
  oliveOil: require("@/assets/ASSETS-FOR-DIET/icons/pure-olive-oil.jpg"),
  wholeMilkHoney: require("@/assets/ASSETS-FOR-DIET/icons/whole-milk-raw-honey.jpg"),
  animalProtein: require("@/assets/ASSETS-FOR-DIET/icons/animal-first-protein.jpg"),
  chickenThighs: require("@/assets/ASSETS-FOR-DIET/icons/chicken-thighs.jpg"),
  greekYogurt: require("@/assets/ASSETS-FOR-DIET/icons/greek-yogurt.jpg"),
  zma: require("@/assets/ASSETS-FOR-DIET/icons/zma-stack.jpg"),
  pumpkinSeeds: require("@/assets/ASSETS-FOR-DIET/icons/pumpkin-seeds.jpg"),
  carrot: require("@/assets/ASSETS-FOR-DIET/icons/carrot.jpg"),
  ginger: require("@/assets/ASSETS-FOR-DIET/icons/raw-ginger.jpg"),
  orangeJuice: require("@/assets/ASSETS-FOR-DIET/icons/orange-juice.jpg"),
  vitaminC: require("@/assets/ASSETS-FOR-DIET/icons/vitamin-c.jpg"),
  greenTea: require("@/assets/ASSETS-FOR-DIET/icons/green-tea.jpg"),
  potassium: require("@/assets/ASSETS-FOR-DIET/icons/potassium-loading.jpg"),
  banana: require("@/assets/ASSETS-FOR-DIET/icons/banana.jpg"),
  sweetPotato: require("@/assets/ASSETS-FOR-DIET/icons/sweet-potato.jpg"),
  omega3: require("@/assets/ASSETS-FOR-DIET/icons/omega-3-capsules.jpg"),
  sardines: require("@/assets/ASSETS-FOR-DIET/icons/sardines.jpg"),
  fishOil: require("@/assets/ASSETS-FOR-DIET/icons/fish-oil-capsules.jpg"),
};

export const DIET_PROTOCOL_CATALOG: DietProtocolEntry[] = [
  {
    id: "vitamin-d3-k2",
    name: "Vitamin D3 + K2",
    type: "dietary",
    quantity: "Daily supplement",
    targets: ["structure_width", "bone_mass"],
    influence: { structure_width: 0.9, bone_mass: 1, testosterone_support: 0.35 },
    reason: "Supports bone structure and mineral-use protocol.",
    image: img.vitaminD3K2,
    tags: ["supplement"],
  },
  {
    id: "avocado",
    name: "Avocado",
    type: "dietary",
    quantity: "1 serving",
    targets: ["structure_width", "bone_mass", "facial_leanness"],
    influence: { structure_width: 0.45, bone_mass: 0.35, facial_leanness: 0.75, testosterone_support: 0.35 },
    reason: "Supports mineral intake and a leaner daily protocol.",
    image: img.avocado,
    tags: ["food"],
  },
  {
    id: "zinc-supplement",
    name: "Zinc Supplement",
    type: "dietary",
    quantity: "Daily supplement",
    targets: ["structure_width", "bone_mass", "testosterone_support"],
    influence: { structure_width: 0.65, bone_mass: 0.6, testosterone_support: 1, igf1_support: 0.45 },
    reason: "Supports hormone and structure-focused nutrition.",
    image: img.zinc,
    tags: ["supplement"],
  },
  {
    id: "bone-broth",
    name: "Bone Broth",
    type: "dietary",
    quantity: "1 cup",
    targets: ["structure_width", "bone_mass", "skin_health"],
    influence: { structure_width: 0.75, bone_mass: 0.85, skin_health: 0.55 },
    reason: "Supports collagen and bone-mass protocol targets.",
    image: img.boneBroth,
    tags: ["drink", "food"],
  },
  {
    id: "unsalted-cheese",
    name: "Unsalted Cheese",
    type: "dietary",
    quantity: "1 serving",
    targets: ["structure_width", "bone_mass"],
    influence: { structure_width: 0.7, bone_mass: 0.9, igf1_support: 0.4 },
    reason: "Supports calcium and bone-density nutrition.",
    image: img.unsaltedCheese,
    tags: ["food"],
  },
  {
    id: "beef-liver",
    name: "Beef Liver",
    type: "dietary",
    quantity: "1 serving",
    targets: ["structure_width", "bone_mass", "testosterone_support", "skin_health"],
    influence: { structure_width: 0.8, bone_mass: 0.8, testosterone_support: 0.85, skin_health: 0.8 },
    reason: "High-impact nutrient density for structure, skin, and hormone support.",
    image: img.beefLiver,
    tags: ["food"],
  },
  {
    id: "egg-yolks",
    name: "Egg Yolks",
    type: "dietary",
    quantity: "2-3 yolks",
    targets: ["structure_width", "bone_mass", "testosterone_support"],
    influence: { structure_width: 0.6, bone_mass: 0.55, testosterone_support: 0.75, igf1_support: 0.4 },
    reason: "Supports fat-soluble vitamins and hormone-focused nutrition.",
    image: img.eggYolks,
    tags: ["food"],
  },
  {
    id: "raw-kefir",
    name: "Raw Kefir",
    type: "dietary",
    quantity: "1 serving",
    targets: ["structure_width", "bone_mass", "skin_health"],
    influence: { structure_width: 0.5, bone_mass: 0.65, skin_health: 0.7, igf1_support: 0.35 },
    reason: "Supports gut, skin, and mineral-focused protocol needs.",
    image: img.rawKefir,
    tags: ["drink", "food"],
  },
  {
    id: "ashwagandha",
    name: "Ashwagandha",
    type: "dietary",
    quantity: "Daily supplement",
    targets: ["structure_width", "bone_mass", "testosterone_support"],
    influence: { structure_width: 0.35, bone_mass: 0.3, testosterone_support: 0.9 },
    reason: "Supports the testosterone-focused side of the protocol.",
    image: img.ashwagandha,
    tags: ["supplement"],
  },
  {
    id: "magnesium-almonds",
    name: "Magnesium Almonds",
    type: "dietary",
    quantity: "1 handful",
    targets: ["structure_width", "bone_mass"],
    influence: { structure_width: 0.45, bone_mass: 0.55, testosterone_support: 0.35 },
    reason: "Supports magnesium intake for structure and recovery.",
    image: img.magnesiumAlmonds,
    tags: ["food"],
  },
  {
    id: "raisins",
    name: "Raisins",
    type: "dietary",
    quantity: "1 small handful",
    targets: ["structure_width", "bone_mass"],
    influence: { structure_width: 0.45, bone_mass: 0.45, skin_health: 0.25 },
    reason: "Supports the mineral-focused structure protocol.",
    image: img.raisins,
    tags: ["food"],
  },
  {
    id: "oysters",
    name: "Oysters",
    type: "dietary",
    quantity: "1 serving",
    targets: ["structure_width", "bone_mass", "testosterone_support"],
    influence: { structure_width: 0.75, bone_mass: 0.65, testosterone_support: 1, igf1_support: 0.45 },
    reason: "Strong fit for zinc-heavy structure and testosterone support.",
    image: img.oysters,
    tags: ["food"],
  },
  {
    id: "chia-seeds",
    name: "Chia Seeds",
    type: "dietary",
    quantity: "1-2 tbsp",
    targets: ["structure_width", "bone_mass"],
    influence: { structure_width: 0.4, bone_mass: 0.55, skin_health: 0.35, facial_leanness: 0.3 },
    reason: "Supports minerals, omega-3 intake, and skin-focused nutrition.",
    image: img.chiaSeeds,
    tags: ["food"],
  },
  {
    id: "whole-eggs",
    name: "Whole Eggs",
    type: "dietary",
    quantity: "2-4 eggs",
    targets: ["testosterone_support", "igf1_support"],
    influence: { testosterone_support: 0.9, igf1_support: 0.65, bone_mass: 0.35 },
    reason: "Supports animal-first protein and hormone-focused nutrition.",
    image: img.wholeEggs,
    tags: ["food"],
  },
  {
    id: "beef",
    name: "Beef",
    type: "dietary",
    quantity: "1 serving",
    targets: ["testosterone_support", "igf1_support"],
    influence: { testosterone_support: 0.9, igf1_support: 0.85, bone_mass: 0.45 },
    reason: "High-priority animal protein for hormone and growth-factor support.",
    image: img.beef,
    tags: ["food"],
  },
  {
    id: "pure-olive-oil",
    name: "Pure Olive Oil",
    type: "dietary",
    quantity: "1 tbsp",
    targets: ["testosterone_support"],
    influence: { testosterone_support: 0.65, skin_health: 0.35 },
    reason: "Supports healthy-fat intake in the testosterone protocol.",
    image: img.oliveOil,
    tags: ["food"],
  },
  {
    id: "whole-milk-raw-honey",
    name: "Whole Milk + Raw Honey",
    type: "dietary",
    quantity: "1 glass",
    targets: ["igf1_support"],
    influence: { igf1_support: 1, bone_mass: 0.5, structure_width: 0.35 },
    reason: "Direct fit for the IGF-1 support protocol.",
    image: img.wholeMilkHoney,
    tags: ["drink", "food"],
  },
  {
    id: "animal-first-protein",
    name: "Animal-First Protein",
    type: "dietary",
    quantity: "Every meal",
    targets: ["igf1_support"],
    influence: { igf1_support: 1, testosterone_support: 0.65, bone_mass: 0.45 },
    reason: "Anchors protein at every meal for growth-factor support.",
    image: img.animalProtein,
    tags: ["food"],
  },
  {
    id: "chicken-thighs",
    name: "Chicken Thighs",
    type: "dietary",
    quantity: "1 serving",
    targets: ["igf1_support"],
    influence: { igf1_support: 0.7, testosterone_support: 0.35 },
    reason: "Adds animal protein for the IGF-1 support protocol.",
    image: img.chickenThighs,
    tags: ["food"],
  },
  {
    id: "greek-yogurt",
    name: "Greek Yogurt",
    type: "dietary",
    quantity: "1 serving",
    targets: ["igf1_support"],
    influence: { igf1_support: 0.75, bone_mass: 0.35, skin_health: 0.35 },
    reason: "Supports protein and calcium intake for the daily protocol.",
    image: img.greekYogurt,
    tags: ["food"],
  },
  {
    id: "zma-stack",
    name: "ZMA Stack",
    type: "dietary",
    quantity: "Daily stack",
    targets: ["igf1_support"],
    influence: { igf1_support: 0.8, testosterone_support: 0.75, bone_mass: 0.45 },
    reason: "Supports zinc and magnesium needs in the protocol.",
    image: img.zma,
    tags: ["supplement"],
  },
  {
    id: "pumpkin-seeds",
    name: "Pumpkin Seeds",
    type: "dietary",
    quantity: "1 handful",
    targets: ["igf1_support"],
    influence: { igf1_support: 0.55, testosterone_support: 0.55, skin_health: 0.3 },
    reason: "Supports zinc and magnesium intake.",
    image: img.pumpkinSeeds,
    tags: ["food"],
  },
  {
    id: "carrot",
    name: "Carrot",
    type: "dietary",
    quantity: "1 serving",
    targets: ["skin_health"],
    influence: { skin_health: 0.8, facial_leanness: 0.25 },
    reason: "Supports the skin-health protocol.",
    image: img.carrot,
    tags: ["food"],
  },
  {
    id: "raw-ginger",
    name: "Raw Ginger",
    type: "dietary",
    quantity: "Small serving",
    targets: ["skin_health"],
    influence: { skin_health: 0.7, facial_leanness: 0.45 },
    reason: "Supports skin and anti-puffiness nutrition.",
    image: img.ginger,
    tags: ["food"],
  },
  {
    id: "orange-juice",
    name: "Orange Juice",
    type: "dietary",
    quantity: "1 glass",
    targets: ["skin_health"],
    influence: { skin_health: 0.75, facial_leanness: 0.35 },
    reason: "Supports vitamin C intake for the skin protocol.",
    image: img.orangeJuice,
    tags: ["drink"],
  },
  {
    id: "vitamin-c",
    name: "Vitamin C",
    type: "dietary",
    quantity: "Daily serving",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.8, skin_health: 0.6 },
    reason: "Supports facial leanness and skin-health targets.",
    image: img.vitaminC,
    tags: ["supplement"],
  },
  {
    id: "green-tea",
    name: "Green Tea",
    type: "dietary",
    quantity: "1 cup",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.85, skin_health: 0.45 },
    reason: "Supports the facial-leanness protocol.",
    image: img.greenTea,
    tags: ["drink"],
  },
  {
    id: "potassium-loading",
    name: "Potassium Loading",
    type: "dietary",
    quantity: "1 daily set",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 1, skin_health: 0.25 },
    reason: "Strong fit for anti-puffiness and facial-leanness support.",
    image: img.potassium,
    tags: ["food"],
  },
  {
    id: "banana",
    name: "Banana",
    type: "dietary",
    quantity: "1 per day",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.6, igf1_support: 0.25 },
    reason: "Supports potassium intake in the leanness protocol.",
    image: img.banana,
    tags: ["food"],
  },
  {
    id: "sweet-potato",
    name: "Sweet Potato",
    type: "dietary",
    quantity: "1 per day",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.65, skin_health: 0.25 },
    reason: "Supports potassium intake and the facial-leanness protocol.",
    image: img.sweetPotato,
    tags: ["food"],
  },
  {
    id: "omega-3s",
    name: "Omega-3s",
    type: "dietary",
    quantity: "Daily serving",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.8, skin_health: 0.55 },
    reason: "Supports skin and facial-leanness nutrition.",
    image: img.omega3,
    tags: ["supplement"],
  },
  {
    id: "sardines",
    name: "Sardines",
    type: "dietary",
    quantity: "1 serving",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.85, skin_health: 0.6, testosterone_support: 0.3 },
    reason: "Food-first omega-3 option for leanness and skin support.",
    image: img.sardines,
    tags: ["food"],
  },
  {
    id: "fish-oil",
    name: "Fish Oil",
    type: "dietary",
    quantity: "Daily serving",
    targets: ["facial_leanness"],
    influence: { facial_leanness: 0.75, skin_health: 0.55 },
    reason: "Supports omega-3 intake for the leanness protocol.",
    image: img.fishOil,
    tags: ["supplement"],
  },
];

const BY_ID = new Map(DIET_PROTOCOL_CATALOG.map((entry) => [entry.id, entry]));

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function gap(score?: number | null): number {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) return 0.2;
  return clamp01((82 - score) / 82);
}

function maxGap(...scores: Array<number | null | undefined>): number {
  return Math.max(...scores.map(gap));
}

function daySlot(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return 0;
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function hashId(id: string): number {
  return id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function buildNeeds(input: DietSelectionInput): Record<DietNeedId, number> {
  const { scores, goals, advanced } = input;
  const needs: Record<DietNeedId, number> = {
    structure_width: maxGap(
      advanced?.cheekbones.width_score,
      advanced?.jawline.ramus_score,
      scores?.cheekbones,
    ),
    bone_mass: maxGap(
      advanced?.cheekbones.bone_structure_score,
      advanced?.cheekbones.maxilla_score,
      scores?.cheekbones,
    ),
    testosterone_support: maxGap(
      scores?.sexual_dimorphism,
      advanced?.jawline.development_score,
      advanced?.jawline.gonial_angle_score,
      advanced?.jawline.projection_score,
    ),
    igf1_support: maxGap(
      advanced?.cheekbones.maxilla_score,
      advanced?.cheekbones.bone_structure_score,
      advanced?.jawline.ramus_score,
      scores?.cheekbones,
    ),
    skin_health: maxGap(
      advanced?.skin.quality_score,
      scores?.skin_quality,
    ),
    facial_leanness: maxGap(
      advanced?.cheekbones.face_fat_score,
      scores?.sexual_dimorphism,
    ),
  };

  for (const goal of goals ?? []) {
    if (goal === "cheekbones") {
      needs.structure_width = clamp01(needs.structure_width + 0.2);
      needs.bone_mass = clamp01(needs.bone_mass + 0.12);
      needs.igf1_support = clamp01(needs.igf1_support + 0.1);
    } else if (goal === "jawline") {
      needs.structure_width = clamp01(needs.structure_width + 0.12);
      needs.testosterone_support = clamp01(needs.testosterone_support + 0.14);
      needs.facial_leanness = clamp01(needs.facial_leanness + 0.1);
    } else if (goal === "skin") {
      needs.skin_health = clamp01(needs.skin_health + 0.25);
    } else if (goal === "overall") {
      for (const key of Object.keys(needs) as DietNeedId[]) {
        needs[key] = clamp01(needs[key] + 0.06);
      }
    }
  }

  return needs;
}

function scoreEntry(
  entry: DietProtocolEntry,
  needs: Record<DietNeedId, number>,
  dateIndex: number,
  recentIds: Set<string>,
): number {
  let rank = 0;
  for (const [target, weight] of Object.entries(entry.influence) as Array<[DietNeedId, number]>) {
    rank += needs[target] * weight;
  }
  rank += entry.targets.length > 1 ? 0.08 : 0;
  if (entry.tags?.includes("food")) rank += 0.06;
  if (recentIds.has(entry.id)) rank *= 0.55;
  rank += ((dateIndex + hashId(entry.id)) % 13) * 0.004;
  return rank;
}

function mainTarget(entry: DietProtocolEntry, needs: Record<DietNeedId, number>): DietNeedId {
  return entry.targets
    .slice()
    .sort((a, b) => (entry.influence[b] ?? 0) * needs[b] - (entry.influence[a] ?? 0) * needs[a])[0];
}

function targetFit(entry: DietProtocolEntry, target: DietNeedId): number {
  return entry.influence[target] ?? 0;
}

function targetContribution(entry: DietProtocolEntry, target: DietNeedId, needs: Record<DietNeedId, number>): number {
  return targetFit(entry, target) * needs[target];
}

function protocolCountForNeeds(needs: Record<DietNeedId, number>, goals: string[] | null): number {
  const meaningfulNeedCount = (Object.keys(needs) as DietNeedId[])
    .filter((target) => needs[target] >= 0.34)
    .length;
  return meaningfulNeedCount >= 2 || (goals?.length ?? 0) > 0
    ? MAX_DAILY_DIET_PROTOCOLS
    : MIN_DAILY_DIET_PROTOCOLS;
}

function importantTargets(needs: Record<DietNeedId, number>, count: number): DietNeedId[] {
  return (Object.keys(needs) as DietNeedId[])
    .sort((a, b) => needs[b] - needs[a])
    .slice(0, count);
}

function toPick(entry: DietProtocolEntry, needs: Record<DietNeedId, number>): DietProtocolPick {
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    quantity: entry.quantity,
    reason: `Selected for ${TARGET_LABELS[mainTarget(entry, needs)]}.`,
  };
}

function pickFromRanked(
  ranked: Array<{ entry: DietProtocolEntry; rank: number }>,
  needs: Record<DietNeedId, number>,
  preferredTargets: DietNeedId[] = [],
  targetCount = MAX_DAILY_DIET_PROTOCOLS,
): DietProtocolEntry[] {
  const selected: DietProtocolEntry[] = [];
  const selectedIds = new Set<string>();
  let supplementCount = 0;
  const selectedTargets = new Set<DietNeedId>();

  const canAdd = (entry: DietProtocolEntry) => {
    if (selectedIds.has(entry.id)) return false;
    if (entry.tags?.includes("supplement") && supplementCount >= 1) return false;
    if (entry.id === "oil-based-cleanser") return false;
    return true;
  };

  const add = (entry: DietProtocolEntry) => {
    selected.push(entry);
    selectedIds.add(entry.id);
    if (entry.tags?.includes("supplement")) supplementCount += 1;
    for (const target of entry.targets) selectedTargets.add(target);
  };

  for (const target of preferredTargets) {
    if (selected.length >= targetCount) break;
    if (selectedTargets.has(target)) continue;
    const topNeedPick = ranked.find(({ entry }) =>
      canAdd(entry) &&
      entry.targets.includes(target) &&
      targetFit(entry, target) >= 0.55 &&
      targetContribution(entry, target, needs) > 0,
    );
    if (topNeedPick) add(topNeedPick.entry);
  }

  for (const { entry } of ranked) {
    if (selected.length >= targetCount) break;
    if (!canAdd(entry)) continue;
    const relevantToMainNeeds = preferredTargets.some((target) =>
      targetContribution(entry, target, needs) >= 0.08,
    );
    if (!relevantToMainNeeds && selected.length >= MIN_DAILY_DIET_PROTOCOLS) continue;
    add(entry);
  }

  if (selected.length < MIN_DAILY_DIET_PROTOCOLS) {
    for (const { entry } of ranked) {
      if (selected.length >= MIN_DAILY_DIET_PROTOCOLS) break;
      if (canAdd(entry)) add(entry);
    }
  }

  return selected.slice(0, targetCount);
}

export function getDietProtocolEntry(id: string): DietProtocolEntry | undefined {
  return BY_ID.get(id);
}

export function isDietProtocolId(id: string): boolean {
  return BY_ID.has(id);
}

export function getDietProtocolTargets(ids: string[]): DietNeedId[] {
  const targets = new Set<DietNeedId>();
  for (const id of ids) {
    const entry = BY_ID.get(id);
    if (!entry) continue;
    for (const target of entry.targets) targets.add(target);
  }
  return Array.from(targets);
}

export function getDietProtocolImage(id: string): ImageSourcePropType | undefined {
  return BY_ID.get(id)?.image;
}

export function getDietProtocolTargetText(id: string): string {
  const entry = BY_ID.get(id);
  if (!entry) return "Targets daily diet";
  return `Targets ${TARGET_LABELS[entry.targets[0]]}`;
}

export function getDietProtocolPrimaryTarget(id: string): string {
  const entry = BY_ID.get(id);
  if (!entry) return "daily diet";
  return TARGET_LABELS[entry.targets[0]];
}

export function getDietProtocolWhyText(id: string): string {
  const entry = BY_ID.get(id);
  return entry?.reason ?? "Included because it matches today's diet.";
}

export function selectDietProtocols(input: DietSelectionInput): DietProtocolPick[] {
  const needs = buildNeeds(input);
  const recentIds = new Set(input.recentProtocolIds ?? []);
  const dateIndex = daySlot(input.dateStr);
  const ranked = DIET_PROTOCOL_CATALOG
    .map((entry) => ({ entry, rank: scoreEntry(entry, needs, dateIndex, recentIds) }))
    .sort((a, b) => b.rank - a.rank);

  const targetCount = protocolCountForNeeds(needs, input.goals);
  const topNeeds = importantTargets(needs, targetCount);
  const selected = pickFromRanked(ranked, needs, topNeeds, targetCount);

  return selected.map((entry) => toPick(entry, needs));
}

export function shuffleDietProtocols(input: DietShuffleInput): DietProtocolPick[] {
  const allowedTargets = getDietProtocolTargets(input.currentProtocolIds);
  if (allowedTargets.length === 0) return selectDietProtocols(input);

  const needs = buildNeeds(input);
  const recentIds = new Set(input.recentProtocolIds ?? []);
  const currentIds = new Set(input.currentProtocolIds);
  const dateIndex = daySlot(input.dateStr);
  const seed = input.shuffleSeed ?? Date.now();

  const constrained = DIET_PROTOCOL_CATALOG.filter((entry) =>
    entry.targets.some((target) => allowedTargets.includes(target)),
  );
  const alternatives = constrained.filter((entry) => !currentIds.has(entry.id));
  const targetCount = Math.min(
    Math.max(input.currentProtocolIds.length || MIN_DAILY_DIET_PROTOCOLS, MIN_DAILY_DIET_PROTOCOLS),
    MAX_DAILY_DIET_PROTOCOLS,
  );
  const pool = alternatives.length >= targetCount ? alternatives : constrained;

  const ranked = pool
    .map((entry) => ({
      entry,
      rank:
        scoreEntry(entry, needs, dateIndex, recentIds) +
        ((seed + hashId(entry.id)) % 29) * 0.012,
    }))
    .sort((a, b) => b.rank - a.rank);

  const preferredTargets = allowedTargets
    .slice()
    .sort((a, b) => needs[b] - needs[a])
    .slice(0, targetCount);
  let selected = pickFromRanked(ranked, needs, preferredTargets, targetCount);

  if (selected.length < MIN_DAILY_DIET_PROTOCOLS && alternatives.length >= targetCount) {
    selected = pickFromRanked(
      constrained
        .map((entry) => ({
          entry,
          rank: scoreEntry(entry, needs, dateIndex, recentIds),
        }))
        .sort((a, b) => b.rank - a.rank),
      needs,
      preferredTargets,
      targetCount,
    );
  }

  return selected.map((entry) => toPick(entry, needs));
}
