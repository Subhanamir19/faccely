// lib/faceLandmarks.ts
// On-device face geometry for the analysis reveal. ML Kit runs on the saved
// scan photo and returns contour points in image pixels; this module turns
// them into the few shapes the reveal draws (jaw trace, eye corners, brows,
// cheekbone width, midface, hairline).
//
// Nothing here may throw into a screen. When detection fails, or its output
// fails a sanity check, callers get geometry derived from a default face box
// (`source: "estimate"`) and draw spotlights instead of traced lines.

import { Image } from "react-native";
import FaceDetection, { type Face, type Point } from "@react-native-ml-kit/face-detection";

import { logger } from "@/lib/logger";

export type { Point };

export type Box = { x: number; y: number; w: number; h: number };

export type FaceGeometry = {
  imageW: number;
  imageH: number;
  /** "landmarks" = traced from detection; "estimate" = default face box only. */
  source: "landmarks" | "estimate";
  faceBox: Box;
  /** Lower face outline, one side of the jaw round the chin to the other. */
  jaw?: Point[];
  jawCorners?: [Point, Point];
  chin?: Point;
  leftEye?: Point[];
  rightEye?: Point[];
  /** Per eye: [inner corner, outer corner]. */
  leftEyeCorners?: [Point, Point];
  rightEyeCorners?: [Point, Point];
  leftBrow?: Point[];
  rightBrow?: Point[];
  /** Widest points at cheekbone height. */
  cheekbones?: [Point, Point];
  /** Top of the face outline, for the hairline arc. */
  hairline?: Point[];
  noseBottom?: Point;
  upperLip?: Point;
};

export function getImageSize(uri: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (w, h) => resolve(w > 0 && h > 0 ? { w, h } : null),
      () => resolve(null),
    );
  });
}

/** Where a frontal capture-guide photo puts the face, as fractions of the image. */
const DEFAULT_FACE_BOX = { x: 0.2, y: 0.16, w: 0.6, h: 0.66 };

export function estimateGeometry(imageW: number, imageH: number): FaceGeometry {
  return {
    imageW,
    imageH,
    source: "estimate",
    faceBox: {
      x: DEFAULT_FACE_BOX.x * imageW,
      y: DEFAULT_FACE_BOX.y * imageH,
      w: DEFAULT_FACE_BOX.w * imageW,
      h: DEFAULT_FACE_BOX.h * imageH,
    },
  };
}

const avg = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

function byX(pts: Point[]): [Point, Point] {
  let min = pts[0];
  let max = pts[0];
  for (const p of pts) {
    if (p.x < min.x) min = p;
    if (p.x > max.x) max = p;
  }
  return [min, max];
}

/** Inner corner is the one nearer the face midline. */
function eyeCorners(eye: Point[], midX: number): [Point, Point] {
  const [a, b] = byX(eye);
  return Math.abs(a.x - midX) < Math.abs(b.x - midX) ? [a, b] : [b, a];
}

/** Rejects detections that would put lines in the wrong place. */
function isPlausible(face: Face, imageW: number, imageH: number): boolean {
  const { frame, contours } = face;
  if (!contours?.face?.points || contours.face.points.length < 30) return false;
  if (frame.width < imageW * 0.25 || frame.height < imageH * 0.2) return false;
  // A strongly turned head makes frontal contours unreliable.
  if (Math.abs(face.rotationY ?? 0) > 20 || Math.abs(face.rotationZ ?? 0) > 20) return false;
  const eyes = [contours.leftEye?.points, contours.rightEye?.points];
  if (eyes.some((e) => !e || e.length < 8)) return false;
  const eyeY = avg([...eyes[0]!, ...eyes[1]!]).y;
  const noseY = contours.noseBottom?.points?.length ? avg(contours.noseBottom.points).y : null;
  const lipY = contours.upperLipTop?.points?.length ? avg(contours.upperLipTop.points).y : null;
  const chinY = Math.max(...contours.face.points.map((p) => p.y));
  if (noseY === null || lipY === null) return false;
  return eyeY < noseY && noseY < lipY && lipY < chinY;
}

function toGeometry(face: Face, imageW: number, imageH: number): FaceGeometry {
  const c = face.contours!;
  const outline = c.face.points;
  const midX = face.frame.left + face.frame.width / 2;
  const leftEye = c.leftEye.points;
  const rightEye = c.rightEye.points;
  const eyeY = avg([...leftEye, ...rightEye]).y;
  const noseBottom = avg(c.noseBottom.points);
  const upperLip = avg(c.upperLipTop.points);

  // ML Kit's face outline starts at the top centre and runs clockwise. The
  // jaw is every outline point below the nose, ordered left to right round
  // the chin.
  const below = outline.filter((p) => p.y >= noseBottom.y);
  const leftSide = below.filter((p) => p.x < midX).sort((a, b) => a.y - b.y);
  const rightSide = below.filter((p) => p.x >= midX).sort((a, b) => b.y - a.y);
  const jaw = [...leftSide, ...rightSide];
  const chin = outline.reduce((low, p) => (p.y > low.y ? p : low), outline[0]);

  // Jaw corner: the outline point at mouth height on each side.
  const cornerAt = (side: Point[]) =>
    side.reduce((best, p) => (Math.abs(p.y - upperLip.y) < Math.abs(best.y - upperLip.y) ? p : best), side[0]);

  // Cheekbones: widest outline points between the eyes and the nose bottom.
  const band = outline.filter((p) => p.y >= eyeY && p.y <= noseBottom.y);
  const cheekbones = band.length >= 2 ? byX(band) : undefined;

  const hairline = outline.filter((p) => p.y <= eyeY - (noseBottom.y - eyeY) * 0.6).sort((a, b) => a.x - b.x);

  return {
    imageW,
    imageH,
    source: "landmarks",
    faceBox: { x: face.frame.left, y: face.frame.top, w: face.frame.width, h: face.frame.height },
    jaw: jaw.length >= 6 ? jaw : undefined,
    jawCorners: leftSide.length && rightSide.length ? [cornerAt(leftSide), cornerAt(rightSide)] : undefined,
    chin,
    leftEye,
    rightEye,
    leftEyeCorners: eyeCorners(leftEye, midX),
    rightEyeCorners: eyeCorners(rightEye, midX),
    leftBrow: c.leftEyebrowTop?.points?.length ? c.leftEyebrowTop.points : undefined,
    rightBrow: c.rightEyebrowTop?.points?.length ? c.rightEyebrowTop.points : undefined,
    cheekbones,
    hairline: hairline.length >= 4 ? hairline : undefined,
    noseBottom,
    upperLip,
  };
}

// One detection per photo. The loading screen starts it while the advanced
// analysis is still running, so the reveal finds it finished.
const cache = new Map<string, Promise<FaceGeometry | null>>();

/**
 * Detect the face in a frontal photo. Always resolves: to traced geometry when
 * detection is trustworthy, otherwise to an estimate (or null without a size).
 */
export function detectFaceGeometry(uri: string): Promise<FaceGeometry | null> {
  let pending = cache.get(uri);
  if (!pending) {
    pending = runDetection(uri);
    cache.set(uri, pending);
  }
  return pending;
}

/** Fire-and-forget warm-up; the result lands in the cache. */
export function prefetchFaceGeometry(uri: string | null | undefined): void {
  if (uri) void detectFaceGeometry(uri);
}

/**
 * Detection if it finishes within `waitMs`, otherwise the estimate. A screen
 * never waits on detection longer than that.
 */
export async function faceGeometryWithin(uri: string, waitMs: number): Promise<FaceGeometry | null> {
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), waitMs));
  const result = await Promise.race([detectFaceGeometry(uri), timeout]);
  if (result !== "timeout") return result;
  const size = await getImageSize(uri);
  return size ? estimateGeometry(size.w, size.h) : null;
}

async function runDetection(uri: string): Promise<FaceGeometry | null> {
  const size = await getImageSize(uri);
  if (!size) return null;
  try {
    const faces = await FaceDetection.detect(uri, {
      performanceMode: "accurate",
      landmarkMode: "all",
      contourMode: "all",
      minFaceSize: 0.2,
    });
    // Contours come back for the most prominent face only.
    const face = faces.find((f) => f.contours?.face);
    if (face && isPlausible(face, size.w, size.h)) return toGeometry(face, size.w, size.h);
  } catch (err) {
    // A build without the native module lands here too.
    logger.warn("[faceLandmarks] detection unavailable", err);
  }
  return estimateGeometry(size.w, size.h);
}
