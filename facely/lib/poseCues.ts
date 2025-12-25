/**
 * Pose-specific cues for each exercise.
 * These are displayed alongside each pose image in the exercise player.
 * Data sourced from docs/EXERCISE_POSE_CUES.md
 */

export type PoseCue = {
  poseNumber: number;
  cue: string;
};

export const POSE_CUES: Record<string, PoseCue[]> = {
  "alternating-cheek-puffs": [
    {
      poseNumber: 1,
      cue: "Seal your lips and inflate one cheek with air while keeping the other side relaxed.",
    },
    {
      poseNumber: 2,
      cue: "Move the air to the opposite cheek (lips still sealed) and hold that side.",
    },
  ],
  "chin-tucks": [
    {
      poseNumber: 1,
      cue: "Sit tall with head neutral and eyes forward (neck long, shoulders down).",
    },
    {
      poseNumber: 2,
      cue: "Glide your chin straight back (not down) to create a gentle \"double-chin\" and hold.",
    },
  ],
  cps: [
    {
      poseNumber: 1,
      cue: "Keep lips sealed and puff both cheeks evenly with air while keeping your jaw relaxed.",
    },
    {
      poseNumber: 2,
      cue: "Keep the cheeks engaged and pucker lips forward into a small \"O\" without leaking air.",
    },
  ],
  "eyes-and-cheeks": [
    {
      poseNumber: 1,
      cue: "Close your eyes, relax your face, and drop shoulders down away from ears.",
    },
    {
      poseNumber: 2,
      cue: "Keep shoulders down and open your mouth wide (jaw drop) without scrunching your face.",
    },
  ],
  "fish-face": [
    {
      poseNumber: 1,
      cue: "Start neutral with lips closed and cheeks relaxed.",
    },
    {
      poseNumber: 2,
      cue: "Suck cheeks inward toward your teeth and lightly pucker lips (\"fish face\"), then hold.",
    },
  ],
  "hunter-eyes": [
    {
      poseNumber: 1,
      cue: "Place index fingers at the outer corners of your eyes and gently lift/hold while you focus your gaze forward.",
    },
    {
      poseNumber: 2,
      cue: "With eyes closed, lightly press/hold near the outer brow/temple and maintain a soft, controlled squint.",
    },
  ],
  "hyoid-stretch": [
    {
      poseNumber: 1,
      cue: "Cross hands on your upper chest and tilt head back to look up, feeling the front of the neck lengthen.",
    },
    {
      poseNumber: 2,
      cue: "Keep hands crossed on chest and return head to neutral (chin level), neck long.",
    },
    {
      poseNumber: 3,
      cue: "Keep hands crossed and slowly tuck chin down toward chest to stretch the back/side of the neck.",
    },
  ],
  "jaw-resistance": [
    {
      poseNumber: 1,
      cue: "Place knuckles under the jawline and gently resist as you try to lift/close the jaw (controlled pressure).",
    },
    {
      poseNumber: 2,
      cue: "Make a fist under your chin and slowly open your mouth against that resistance, then hold.",
    },
  ],
  "lymphatic-drainage": [
    {
      poseNumber: 1,
      cue: "Using knuckles, sweep from under the chin along the jawline toward the ear in an upward motion.",
    },
    {
      poseNumber: 2,
      cue: "Using fingertips, gently stroke down the side of the neck toward the collarbone (light pressure).",
    },
  ],
  "neck-lift": [
    {
      poseNumber: 1,
      cue: "Tilt chin slightly up and lengthen the front of your neck (shoulders relaxed).",
    },
    {
      poseNumber: 2,
      cue: "Place a fist under your chin and gently press up while you open your mouth slowly to activate the front of the neck.",
    },
  ],
  "nose-massage": [
    {
      poseNumber: 1,
      cue: "Using knuckles, massage from the sides of the nose up toward the inner eye area with gentle pressure.",
    },
    {
      poseNumber: 2,
      cue: "Move knuckles lower and massage along the sides of the nose toward the upper lip/nostril area.",
    },
  ],
  "nose-tongue-touch": [
    {
      poseNumber: 1,
      cue: "Extend your tongue upward toward your nose while keeping lips relaxed, then hold.",
    },
    {
      poseNumber: 2,
      cue: "Reach the tongue as high/forward as possible toward the nose (no strain), then hold.",
    },
  ],
  "sternocleidomastoid-stretch": [
    {
      poseNumber: 1,
      cue: "Place a hand on the side of your neck, turn head slightly away, and puff cheeks while holding the stretch.",
    },
    {
      poseNumber: 2,
      cue: "Switch sides (hand + head turn) and repeat the cheek-puff hold.",
    },
  ],
  "thumb-pulling": [
    {
      poseNumber: 1,
      cue: "Place thumbs inside the mouth at the corners (fingers outside) and keep lips closed.",
    },
    {
      poseNumber: 2,
      cue: "Gently pull outward at the mouth corners while keeping lips sealed/puckered and jaw relaxed.",
    },
    {
      poseNumber: 3,
      cue: "Keep thumbs in place and smile while pulling outward to stretch the cheek/mouth-corner area.",
    },
  ],
  "upward-chewing": [
    {
      poseNumber: 1,
      cue: "Tilt head slightly up and keep lips closed with a tall neck posture.",
    },
    {
      poseNumber: 2,
      cue: "With head still slightly up, open your mouth wide in a slow \"chew\" motion (controlled, not forced).",
    },
  ],
};

/**
 * Get pose cues for an exercise by ID
 */
export function getPoseCues(exerciseId: string): PoseCue[] {
  return POSE_CUES[exerciseId] ?? [];
}

/**
 * Get a specific pose cue for an exercise
 */
export function getPoseCue(exerciseId: string, poseIndex: number): string | null {
  const cues = POSE_CUES[exerciseId];
  if (!cues || poseIndex < 0 || poseIndex >= cues.length) {
    return null;
  }
  return cues[poseIndex].cue;
}
