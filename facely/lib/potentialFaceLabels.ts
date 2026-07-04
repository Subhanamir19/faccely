// facely/lib/potentialFaceLabels.ts
// Shared sub-metric label map used by the Potential Face reveal screen and
// the dashboard card. Keep in sync with `SUB_METRIC_VISUAL_HINT` in
// scorer-node/src/services/potentialFaceGeneration.ts (the backend writes the
// (group, sub_metric) keys; the client renders human labels).

import type { TargetedMetric } from "@/store/potentialFace";

const SUB_METRIC_LABEL: Record<string, string> = {
  "cheekbones.width_score": "Cheekbone width",
  "cheekbones.maxilla_score": "Maxillary projection",
  "cheekbones.bone_structure_score": "Cheekbone definition",
  "cheekbones.face_fat_score": "Cheek hollows",
  "cheekbones.fwhr_score": "Facial width-height balance",
  "jawline.development_score": "Jawline definition",
  "jawline.gonial_angle_score": "Gonial angle",
  "jawline.projection_score": "Chin projection",
  "eyes.canthal_tilt_score": "Canthal tilt",
  "eyes.eye_type_score": "Eye shape",
  "eyes.brow_volume_score": "Brow fullness",
  "eyes.symmetry_score": "Eye symmetry",
  "skin.color_score": "Even skin tone",
  "skin.quality_score": "Skin clarity",
  "haircut.density_score": "Hair density",
  "haircut.styling_score": "Hair styling",
  "haircut.facial_hair_score": "Facial hair",
};

export function labelForMetric(m: TargetedMetric): string {
  const compound = `${m.group}.${m.sub_metric}`;
  if (SUB_METRIC_LABEL[compound]) return SUB_METRIC_LABEL[compound];
  // Defensive fallback: "bone_structure_score" → "Bone structure"
  const cleaned = m.sub_metric.replace(/_score$/, "").replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
