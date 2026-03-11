// lib/exerciseDetails.ts
// Per-exercise instructional data extracted from video analysis.

export interface ExerciseDetail {
  name: string;
  benefits: string;
  steps: string[];
  reps: string;
  tip: string;
}

export const EXERCISE_DETAILS: Record<string, ExerciseDetail> = {
  "jawline-1": {
    name: "Neck & Jawline Extension",
    benefits: "Strengthens the platysma and sternocleidomastoid muscles to define the jawline and tighten the neck area.",
    steps: [
      "Lie face down on a flat surface with your head and neck hanging off the edge.",
      "Lower your head slowly toward the floor to stretch the front of the neck.",
      "Lift your head back up until it is level with your body.",
      "Maintain a neutral spine throughout the movement.",
      "Repeat the dipping motion in a controlled, rhythmic manner.",
    ],
    reps: "3 sets of 15–20 reps",
    tip: "Avoid jerky movements — keep the motion fluid and controlled to prevent neck strain.",
  },

  "chin-tucks": {
    name: "Chin Tuck",
    benefits: "Improves posture and strengthens deep neck flexors to reduce a double chin and define the jawline.",
    steps: [
      "Look straight ahead with your shoulders relaxed.",
      "Draw your chin straight back toward your neck without tilting your head up or down.",
      "Keep your head level as if it is sliding on a horizontal shelf.",
      "Hold the tucked position briefly while feeling the stretch at the base of the skull.",
      "Release slowly back to the starting position.",
    ],
    reps: "3 sets of 10 reps, holding each tuck for 3–5 seconds",
    tip: "Avoid tilting your nose down — keep your gaze forward to ensure the movement comes from the cervical spine.",
  },

  "slim-nose-massage": {
    name: "Nose Contouring Massage",
    benefits: "Helps reduce puffiness around the nasal area and promotes a more defined nose shape.",
    steps: [
      "Place the tips of your index fingers on both sides of the bridge of your nose.",
      "Apply firm but gentle pressure against the nasal bone.",
      "Slide your fingers downward along the sides of the nose toward the nostrils.",
      "Lift your fingers and return to the starting position at the bridge.",
      "Repeat the stroking motion in a rhythmic, continuous pattern.",
    ],
    reps: "Perform for 30–60 seconds",
    tip: "Keep both fingers moving in a synchronized downward motion to support lymphatic drainage.",
  },

  "nose-massage": {
    name: "Nasal Bridge Sculpting",
    benefits: "Targets the muscles around the nasal bridge to refine the nose profile and reduce fluid retention.",
    steps: [
      "Curl your index fingers and place the middle knuckles against the sides of the nose bridge.",
      "Apply firm pressure against the sides of the nose.",
      "Slide your knuckles downward toward the base of the nostrils in a sweeping motion.",
      "Lift and reset your knuckles to the top of the bridge after each stroke.",
      "Maintain a steady, rhythmic pace throughout.",
    ],
    reps: "Perform for 45–60 seconds",
    tip: "Use the flat part of your knuckles rather than the tips to apply even pressure without pinching the skin.",
  },

  "fish-face": {
    name: "Fish Face",
    benefits: "Tones and lifts the cheek muscles while defining the hollows of the face for a more sculpted look.",
    steps: [
      "Suck your cheeks and lips deep into the hollows of your face.",
      "Pucker your lips outward to resemble a fish face.",
      "Hold this position while trying to smile to engage the cheek muscles.",
      "Maintain the suction for several seconds before relaxing.",
      "Release the tension and return to a neutral expression.",
    ],
    reps: "3 sets of 10 reps, holding for 5–10 seconds each",
    tip: "Keep your eyes wide and forehead relaxed — all tension should be concentrated on the cheeks and mouth only.",
  },

  "gua-sha": {
    name: "Gua Sha Jawline Sculpting",
    benefits: "Promotes lymphatic drainage and enhances facial contouring for a sharper, more chiseled jawline.",
    steps: [
      "Place the curved edge of the gua sha tool at the center of your chin.",
      "Glide the tool firmly along the jawline toward the earlobe.",
      "Wiggle the tool slightly at the end of the stroke to stimulate drainage.",
      "Repeat the same motion on the opposite side of the face.",
      "Hold the tool at a flat angle against the skin for optimal pressure.",
    ],
    reps: "5–10 strokes per side, daily",
    tip: "Apply a facial oil or serum before starting so the tool glides smoothly without tugging the skin.",
  },

  "hunter-eyes-2": {
    name: "Hunter Eyes Squinch",
    benefits: "Strengthens the lower eyelid muscles to create a more focused, intense, and hooded eye appearance.",
    steps: [
      "Place your index fingers at the outer corners of your eyebrows to provide slight tension.",
      "Place your thumbs under your cheekbones to stabilize the face.",
      "Squint your lower eyelids upward while keeping the upper eyelids as still as possible.",
      "Hold the contraction briefly, feeling the tension in the under-eye area.",
      "Release the squint slowly and repeat.",
    ],
    reps: "3 sets of 15–20 reps",
    tip: "Avoid wrinkling your forehead — focus entirely on isolating the lower eyelid movement.",
  },

  "hunter-eyes-1": {
    name: "Eyelid Isolation Squint",
    benefits: "Tones the orbicularis oculi muscles to create a more defined and hooded eye shape.",
    steps: [
      "Place your index fingers at the outer corners of your eyebrows and your thumbs on your cheekbones.",
      "Gently pull the skin outward to create slight tension around the eye area.",
      "Close your eyes firmly while maintaining the finger position.",
      "Squeeze the eyelids together for a brief moment.",
      "Release the tension and open your eyes slowly.",
    ],
    reps: "3 sets of 15 reps",
    tip: "Keep the movement controlled — avoid recruiting your forehead muscles to help close the eyes.",
  },

  "neck-lift-1": {
    name: "Neck Lift",
    benefits: "Tones the platysma muscle and tightens the skin under the chin to reduce sagging.",
    steps: [
      "Tilt your head back slowly until you are looking directly at the ceiling.",
      "Open your mouth as wide as possible while keeping your head tilted.",
      "Close your mouth firmly, bringing your lower lip up toward your upper lip.",
      "Feel the intense stretch and contraction in the front of your neck.",
      "Lower your chin back to a neutral position and relax.",
    ],
    reps: "3 sets of 10–12 reps",
    tip: "Avoid overextending your neck — the focus should be on the muscle contraction in front, not a deep spinal bend.",
  },

  "neck-lift-2": {
    name: "Skyward Neck Stretch",
    benefits: "Tones the platysma muscle to help define the jawline and reduce the appearance of a double chin.",
    steps: [
      "Sit or stand with a straight back and relaxed shoulders.",
      "Tilt your head back slowly until you are looking directly at the ceiling.",
      "Hold the stretch while keeping your mouth closed.",
      "Return your head to the neutral, forward-facing position.",
      "Repeat the movement in a slow, controlled manner.",
    ],
    reps: "Hold for 5–10 seconds per tilt; repeat 10 times",
    tip: "Move slowly to avoid neck strain — you should feel a clear pull along the front of your neck.",
  },

  "jaw-resistance": {
    name: "Jaw Resistance Press",
    benefits: "Strengthens the jaw muscles and tightens the under-chin area to create a more defined profile.",
    steps: [
      "Make a fist and place it directly underneath your chin.",
      "Open your mouth slowly while pushing upward with your fist to create resistance.",
      "Hold the open position for a moment against the pressure.",
      "Close your mouth slowly while maintaining light upward contact from your fist.",
      "Repeat with steady, controlled tension.",
    ],
    reps: "3 sets of 10–15 reps",
    tip: "The resistance should come entirely from your hand — avoid straining your neck to compensate.",
  },

  "lymphatic-drainage": {
    name: "Jawline Sculpting Massage",
    benefits: "Promotes lymphatic drainage and helps define the jawline by smoothing and firming the facial contours.",
    steps: [
      "Form a V-shape with your index and middle fingers on both hands.",
      "Place your chin between the knuckles on both sides.",
      "Slide your fingers firmly along the jawbone toward your ears.",
      "Maintain consistent pressure throughout the movement.",
      "Bring your hands back to the center and repeat the stroke.",
    ],
    reps: "Repeat for 30–60 seconds",
    tip: "Use a facial oil or moisturizer to prevent skin tugging and ensure a smooth gliding motion.",
  },

  "alternating-cheek-puffs": {
    name: "Side Kisses",
    benefits: "Tones the cheek muscles and enhances facial symmetry by engaging the muscles around the mouth.",
    steps: [
      "Pucker your lips into a kissing shape.",
      "Shift your puckered lips toward the left side as far as comfortable.",
      "Return to the center momentarily.",
      "Shift your puckered lips toward the right side.",
      "Continue alternating sides in a rhythmic motion.",
    ],
    reps: "Alternate for 30 seconds",
    tip: "Exaggerate the movement to fully engage the cheek muscles, but keep your eyes and forehead relaxed.",
  },

  "neck-curls": {
    name: "Lying Neck Curls",
    benefits: "Strengthens the neck flexors and tightens the skin along the jawline for a more prominent, chiseled look.",
    steps: [
      "Lie flat on your back on a bed or sofa with your head hanging off the edge.",
      "Slowly lift your chin toward your chest using only your neck muscles.",
      "Hold the peak contraction for one second.",
      "Lower your head back down to the starting position in a controlled motion.",
      "Keep your shoulders flat and stationary throughout the movement.",
    ],
    reps: "3 sets of 10–15 reps",
    tip: "Keep movements smooth and avoid using momentum — this protects your neck and maximizes muscle engagement.",
  },

  "towel-chewing": {
    name: "Towel Resistance Chew",
    benefits: "Engages the masseter muscles through intense resistance to broaden the jawline and define the chin.",
    steps: [
      "Roll a clean small towel into a firm bundle.",
      "Place the towel between your molars on both sides of your mouth.",
      "Bite down firmly on the towel to engage the jaw muscles.",
      "Hold the contraction for a few seconds.",
      "Slowly release the tension without dropping the towel.",
      "Repeat the chewing motion with steady force.",
    ],
    reps: "3 sets of 15–20 bites",
    tip: "Avoid over-clenching or using a towel that is too thick — excess stress on the jaw joint can cause discomfort.",
  },
};

export function getExerciseDetail(id: string): ExerciseDetail | null {
  return EXERCISE_DETAILS[id] ?? null;
}
