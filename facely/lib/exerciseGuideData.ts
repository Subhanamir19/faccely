/**
 * Exercise guide data containing performance details for each exercise.
 * This data is displayed in the Guide component when users want to learn
 * how to perform an exercise properly.
 */

export type ExerciseGuide = {
  id: string;
  name: string;
  holdTime: string;
  reps: string;
  frequency: string;
  howTo: string[];
  tips: string[];
};

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  cps: {
    id: "cps",
    name: "CPS (Correct Tongue Posture)",
    holdTime: "10-20 seconds per rep, goal is all day",
    reps: "10-15 reps initially",
    frequency: "Continuous habit throughout the day",
    howTo: [
      "Place your entire tongue flat against the roof of your mouth",
      "Keep the tip just behind your front teeth (not touching them)",
      "Seal your lips completely",
      "Breathe through your nose only",
      "Keep teeth slightly apart, don't clench your jaw",
    ],
    tips: [
      "Start with 10-15 minute focused practice daily",
      "Gradually build to maintaining all day",
      "Your tongue should create suction against the palate",
    ],
  },
  "thumb-pulling": {
    id: "thumb-pulling",
    name: "Thumb Pulling",
    holdTime: "1-2 minutes per set",
    reps: "Several sets throughout the day",
    frequency: "Every hour ideally",
    howTo: [
      "Wash your hands thoroughly",
      "Place clean thumbs on the roof of your mouth",
      "Apply gentle upward and outward pressure on the palate",
      "Maintain steady, controlled pressure",
      "Breathe slowly and mindfully through your nose",
    ],
    tips: [
      "Frequency matters more than force",
      "Use gentle pressure, never force",
      "Stop if you feel any discomfort or strain",
    ],
  },
  "chin-tucks": {
    id: "chin-tucks",
    name: "Chin Tucks",
    holdTime: "5-10 seconds (work up to 15-20 sec)",
    reps: "10-20 reps per session",
    frequency: "2-5 times per day",
    howTo: [
      "Sit or stand tall with good posture",
      "Keep your eyes looking straight ahead",
      "Pull your chin straight back (like making a double chin)",
      "Don't tilt your head up or down",
      "Hold, then return to neutral position",
    ],
    tips: [
      "Imagine a string pulling the back of your head up",
      "Keep shoulders relaxed and down",
      "Start with fewer reps and build up gradually",
    ],
  },
  "hunter-eyes": {
    id: "hunter-eyes",
    name: "Hunter Eyes 1",
    holdTime: "5 seconds",
    reps: "10-15 reps",
    frequency: "2 sets daily",
    howTo: [
      "Relax your face completely",
      "Gently lower your upper eyelids (squint slightly)",
      "Keep your forehead smooth - don't wrinkle it",
      "Relax your eyebrows, let them drop slightly",
      "Hold the squint, then release and repeat",
    ],
    tips: [
      "Focus on the eyes only, not the forehead",
      "The movement should feel controlled, not strained",
      "Consistency is more important than intensity",
    ],
  },
  "hyoid-stretch": {
    id: "hyoid-stretch",
    name: "Hyoid Stretch",
    holdTime: "1 minute (isometric)",
    reps: "3 sets with 1-minute rest between",
    frequency: "3 sets per day",
    howTo: [
      "Lie flat on your back with spine on the floor",
      "Keep your shoulders down",
      "Lift only your head about 2 inches off the ground",
      "Bring your chin toward your chest (don't strain)",
      "Hold the position, then lower slowly",
    ],
    tips: [
      "Keep your stomach down, don't let it rise",
      "Don't poke your chin out",
      "Start with shorter holds and build up to 1 minute",
    ],
  },
  "lymphatic-drainage": {
    id: "lymphatic-drainage",
    name: "Lymphatic Drainage",
    holdTime: "3-5 minutes per session",
    reps: "Continuous massage motions",
    frequency: "Daily, ideally at night",
    howTo: [
      "Apply a facial oil or moisturizer for slip",
      "Start at forehead, use light circular motions",
      "Move down to temples, then cheeks",
      "Massage along jawline toward ears",
      "Finish by stroking down the neck to collarbone",
    ],
    tips: [
      "Use very light pressure - skin level only",
      "Never press deep into muscle tissue",
      "Always move toward lymph nodes (down toward neck)",
    ],
  },
  "upward-chewing": {
    id: "upward-chewing",
    name: "Upward Chewing",
    holdTime: "5-10 minutes per session",
    reps: "Continuous motion",
    frequency: "Several times per day",
    howTo: [
      "Press your tongue firmly against the roof of your mouth",
      "Simulate a chewing motion using only your tongue",
      "Keep your lips closed throughout",
      "Maintain consistent pressure on the palate",
      "Move in a controlled, rhythmic pattern",
    ],
    tips: [
      "Start with shorter sessions and build up",
      "Focus on tongue strength, not jaw movement",
      "This may feel unnatural at first - that's normal",
    ],
  },
  "neck-lift": {
    id: "neck-lift",
    name: "Neck Lift",
    holdTime: "5-10 seconds",
    reps: "10-20 reps",
    frequency: "Daily",
    howTo: [
      "Keep shoulders relaxed and down",
      "Tilt your head back slightly",
      "Thrust your jaw forward",
      "Feel the stretch under your chin and neck",
      "Hold, then return to neutral",
    ],
    tips: [
      "Don't tilt back too far - keep it comfortable",
      "Feel the front of your neck engage",
      "Combine with deep breathing for better results",
    ],
  },
  "jaw-resistance": {
    id: "jaw-resistance",
    name: "Jaw Resistance",
    holdTime: "5-10 seconds per rep",
    reps: "3 sets of 10 reps",
    frequency: "Daily",
    howTo: [
      "Make a fist and place it under your chin",
      "Try to open your mouth while resisting with your fist",
      "Push against the resistance for the full hold",
      "Release and relax",
      "Repeat with controlled, steady pressure",
    ],
    tips: [
      "Start with light resistance and build up",
      "Don't strain or clench too hard",
      "Keep the rest of your face relaxed",
    ],
  },
  "eyes-and-cheeks": {
    id: "eyes-and-cheeks",
    name: "Eyes and Cheeks",
    holdTime: "15 seconds",
    reps: "5-10 reps",
    frequency: "Daily, 15-20 min total face workout",
    howTo: [
      "Start with face relaxed, shoulders down",
      "Smile as wide as you can",
      "Lift your cheeks up toward your eyes",
      "Optionally close your eyes for extra lift",
      "Hold the position, then slowly release",
    ],
    tips: [
      "Really engage the cheek muscles",
      "Feel the lift under your eyes",
      "Combine with other face yoga exercises",
    ],
  },
  "alternating-cheek-puffs": {
    id: "alternating-cheek-puffs",
    name: "Alternating Cheek Puffs",
    holdTime: "3-5 seconds each side",
    reps: "10-15 alternations per set",
    frequency: "3-5 sets daily",
    howTo: [
      "Seal your lips completely",
      "Fill your mouth with air",
      "Push all the air into one cheek",
      "Hold for 3-5 seconds",
      "Move the air to the opposite cheek and hold",
    ],
    tips: [
      "Keep lips tightly sealed throughout",
      "Don't let any air escape",
      "Start slowly and increase speed as you improve",
    ],
  },
  "nose-massage": {
    id: "nose-massage",
    name: "Nose Massage",
    holdTime: "5 minutes total",
    reps: "10 reps for nose push exercise",
    frequency: "Daily",
    howTo: [
      "Apply a small amount of facial oil to your nose",
      "Use fingertips to massage the bridge in circular motions",
      "Move down to the sides of the nose",
      "For nose push: push tip up with index finger",
      "Push tip down 10 times with gentle resistance",
    ],
    tips: [
      "Use gentle, consistent pressure",
      "Focus on circulation, not reshaping",
      "This helps with muscle tone around the nose",
    ],
  },
  "sternocleidomastoid-stretch": {
    id: "sternocleidomastoid-stretch",
    name: "SCM Stretch",
    holdTime: "15-30 seconds each side",
    reps: "3-5 reps per side",
    frequency: "Daily",
    howTo: [
      "Place one hand on the side of your neck",
      "Turn your head slightly away from that hand",
      "Puff your cheeks with air while holding the stretch",
      "Feel the stretch along the neck muscle",
      "Switch sides and repeat",
    ],
    tips: [
      "Don't force the stretch - keep it gentle",
      "Breathe normally throughout",
      "Great for neck tension relief",
    ],
  },
  "nose-tongue-touch": {
    id: "nose-tongue-touch",
    name: "Nose Touching with Tongue",
    holdTime: "10 seconds",
    reps: "5-10 reps with 10-second breaks",
    frequency: "Daily",
    howTo: [
      "Keep your head straight, facing forward",
      "Stick your tongue out",
      "Stretch your tongue upward toward your nose",
      "Reach as high as possible without straining",
      "Hold at maximum extension, then relax",
    ],
    tips: [
      "Don't strain - stretch only as far as comfortable",
      "Keep your jaw and face relaxed",
      "This exercises the tongue and maxilla area",
    ],
  },
  "fish-face": {
    id: "fish-face",
    name: "Fish Face",
    holdTime: "15-30 seconds (work up to 60-90 sec)",
    reps: "5-10 reps",
    frequency: "Daily",
    howTo: [
      "Start with lips closed, face relaxed",
      "Suck your cheeks inward toward your teeth",
      "Pucker your lips slightly (fish face)",
      "Try to smile while holding the position",
      "Hold, then release slowly",
    ],
    tips: [
      "Feel the cheek muscles working",
      "Keep breathing normally through your nose",
      "Great for cheekbone definition and reducing face fat",
    ],
  },
  "cheekbone-knuckle-massage": {
    id: "cheekbone-knuckle-massage",
    name: "Cheekbone Knuckle Massage",
    holdTime: "30-60 seconds continuous",
    reps: "10-15 strokes per side",
    frequency: "Daily",
    howTo: [
      "Curl your fingers into a loose fist on both hands",
      "Place the flat of your knuckles beside your nose at cheekbone level",
      "Apply firm but comfortable pressure against the cheekbones",
      "Sweep outward along the cheekbones from nose toward ears",
      "Repeat in smooth, continuous upward strokes",
    ],
    tips: [
      "Use firm pressure but never painful — skin should move with the knuckles",
      "Always stroke outward (nose to ears), never inward",
      "Apply facial oil or moisturizer for smoother glide",
    ],
  },
  "neck-curls": {
    id: "neck-curls",
    name: "Neck Curls",
    holdTime: "2-3 seconds per rep",
    reps: "2 sets of 10 reps",
    frequency: "Twice a week (max)",
    howTo: [
      "Lay on your back with your head hanging off the edge of a bed or bench",
      "Press your tongue firmly against the roof of your mouth (mewing position)",
      "Curl your chin toward your chest, creating as many double chins as possible",
      "Focus on contracting the area under your chin (superhyoid), not your neck fibers",
      "Slowly extend your head back, pulling your chin as far back as possible, then repeat",
    ],
    tips: [
      "Warm up thoroughly before starting — these muscles are often underdeveloped",
      "Do NOT curl your neck up like a sit-up; focus specifically on the under-chin squeeze",
      "Keep tongue on the roof of your mouth throughout the entire movement",
    ],
  },
  "resisted-jaw-openings": {
    id: "resisted-jaw-openings",
    name: "Resisted Jaw Openings",
    holdTime: "2-3 seconds per rep",
    reps: "2 sets of 20 reps (beginners), up to 5-6 sets (advanced)",
    frequency: "Twice a week",
    howTo: [
      "Bring your hands together as if praying",
      "Create a 90-degree angle between your thumbs and index fingers",
      "Place thumbs underneath your chin, index fingers against your nose for stability",
      "Keep your head up and body straight",
      "Slowly open your jaw against the resistance of your thumbs, squeezing the superhyoid muscles",
    ],
    tips: [
      "Go very easy at first to avoid TMJ problems",
      "For warm-up sets, apply only light pressure; increase for working sets",
      "Do this exercise on the same day as neck curls, either before or after",
    ],
  },
  "chin-tucks-with-head-tilt": {
    id: "chin-tucks-with-head-tilt",
    name: "Chin Tucks with Head Tilt",
    holdTime: "10 seconds per rep",
    reps: "15 reps, 3 sets",
    frequency: "Daily",
    howTo: [
      "Stand or sit with spine straight and shoulders back",
      "Identify your overdeveloped (stronger/bigger) side",
      "Tilt your head AWAY from the strong side (toward the weak side) about 15-20 degrees",
      "While tilted, pull your chin straight back (not down) to create a double chin",
      "Hold for 10 seconds, feeling the neck stretch, then release",
    ],
    tips: [
      "Only tilt 15-20 degrees — don't overdo the angle",
      "The chin goes straight BACK, never down — imagine pushing into a wall behind you",
      "This variation specifically targets facial asymmetry by balancing neck muscles",
    ],
  },
};

/**
 * Get exercise guide by ID
 */
export function getExerciseGuide(exerciseId: string): ExerciseGuide | null {
  return EXERCISE_GUIDES[exerciseId] ?? null;
}
