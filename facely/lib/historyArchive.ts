import { fetchScanDetail, fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import type { Scores } from "@/lib/api/scores";

export type HistoryPhotoItem = {
  id: string;
  createdAt: string;
  frontImageUrl: string;
  hasSideImage: boolean;
  overallScore: number | null;
};

const SCORE_KEYS: Array<keyof Scores> = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

function computeOverall(scores: Partial<Scores> | null | undefined): number | null {
  const values = SCORE_KEYS.map((key) => Number(scores?.[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function fromListItem(item: ScanHistoryItem): HistoryPhotoItem | null {
  if (!item.frontImageUrl) return null;
  return {
    id: item.id,
    createdAt: item.createdAt,
    frontImageUrl: item.frontImageUrl,
    hasSideImage: item.hasSideImage,
    overallScore: typeof item.overallScore === "number" ? Math.round(item.overallScore) : null,
  };
}

export async function fetchHistoryPhotoArchive(limit = 30): Promise<HistoryPhotoItem[]> {
  const scans = await fetchScanHistory(limit);
  const settled = await Promise.allSettled(
    scans.map(async (scan) => {
      const fromList = fromListItem(scan);
      if (fromList) return fromList;

      const detail = await fetchScanDetail(scan.id);
      return {
        id: detail.id,
        createdAt: detail.createdAt,
        frontImageUrl: detail.images.front.url,
        hasSideImage: detail.hasSideImage,
        overallScore: computeOverall(detail.scores),
      };
    })
  );

  return settled
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((item): item is HistoryPhotoItem => !!item?.frontImageUrl);
}
