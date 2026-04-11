// lib/lifeModals.ts
// Persistence helpers + content for the 4 life-moment modals
// (Comeback, Streak Celebration, Halfway Hype, Did You Know)

import AsyncStorage from "@react-native-async-storage/async-storage";

const K = {
  milestones:    "life_modals_v1_milestones",    // number[] of shown streak milestones
  lastFact:      "life_modals_v1_fact_date",      // YYYY-MM-DD of last did-you-know shown
  halfwayDate:   "life_modals_v1_halfway_date",   // YYYY-MM-DD of last halfway shown
  comebackShown: "life_modals_v1_comeback_shown", // YYYY-MM-DD we last showed comeback modal
};

// ---------------------------------------------------------------------------
// Streak milestone helpers
// ---------------------------------------------------------------------------

export async function getShownMilestones(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(K.milestones);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export async function markMilestoneShown(n: number): Promise<void> {
  try {
    const cur = await getShownMilestones();
    if (!cur.includes(n)) {
      await AsyncStorage.setItem(K.milestones, JSON.stringify([...cur, n]));
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Did You Know helpers
// ---------------------------------------------------------------------------

export async function canShowDidYouKnow(
  today: string,
): Promise<{ show: boolean; fact: string }> {
  try {
    const last = await AsyncStorage.getItem(K.lastFact);
    if (last) {
      const diffMs = new Date(today).getTime() - new Date(last).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 2) return { show: false, fact: "" };
    }
    await AsyncStorage.setItem(K.lastFact, today);
    const fact = DID_YOU_KNOW_FACTS[Math.floor(Math.random() * DID_YOU_KNOW_FACTS.length)];
    return { show: true, fact };
  } catch {
    return { show: false, fact: "" };
  }
}

// ---------------------------------------------------------------------------
// Halfway Hype helpers
// ---------------------------------------------------------------------------

export async function canShowHalfway(today: string): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(K.halfwayDate);
    if (last === today) return false;
    await AsyncStorage.setItem(K.halfwayDate, today);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Comeback helpers
// ---------------------------------------------------------------------------

/**
 * Returns true (and persists the decision) only when ALL conditions hold:
 *   1. The user has at least one completed day in history (lastCompletedDate is non-null)
 *   2. They haven't already seen the comeback modal for THIS streak-break window.
 *
 * "Same streak-break window" = the stored shown-date is strictly AFTER the user's
 * last completed workout date. If the user completes a workout after we showed the
 * modal, lastCompletedDate advances, the stored date falls behind it, and we become
 * eligible again for the next break — but only after 2+ missed days (enforced by
 * the caller checking getConsecutiveMissed).
 */
export async function canShowComeback(
  lastCompletedDate: string | null, // YYYY-MM-DD of most recent streakEarned day
  todayStr: string,                 // YYYY-MM-DD of current day
): Promise<boolean> {
  try {
    if (!lastCompletedDate) return false; // never completed → nothing to come back to

    const stored = await AsyncStorage.getItem(K.comebackShown);

    // Already shown for this gap: stored date is after the last completed date,
    // meaning no new workout has happened since we last showed the modal.
    if (stored && stored > lastCompletedDate) return false;

    // New gap (or first ever) — mark as shown for today and allow display.
    await AsyncStorage.setItem(K.comebackShown, todayStr);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dev: reset all flags (for testing)
// ---------------------------------------------------------------------------

export async function resetAllLifeModalFlags(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([K.milestones, K.lastFact, K.halfwayDate, K.comebackShown]);
  } catch {}
}

// ---------------------------------------------------------------------------
// Did You Know — facts list (15)
// ---------------------------------------------------------------------------

export const DID_YOU_KNOW_FACTS: string[] = [
  "Mewing only works flat against the roof — not the front. 6 months of correct posture can visibly sharpen your jawline.",
  "Side-sleeping flattens the lower cheek over years. Back sleeping is the easiest anti-aging habit.",
  "Chewing on one side creates asymmetry. Alternate sides to keep both masseters balanced.",
  "30 min of facial exercises daily for 20 weeks visibly increased cheek fullness in a Northwestern Medicine study.",
  "Skin repairs itself mostly between 11pm–3am. Late nights block more than any product can fix.",
  "High cheekbones signal higher testosterone exposure during development — the primary attractiveness cue across cultures.",
  "Cold water after washing flushes lymphatic fluid and closes pores. Reduces morning puffiness in under 60 seconds.",
  "30mg zinc daily matches tetracycline for acne reduction in clinical studies. Most people are deficient.",
  "Mastic gum grows the masseter 3–4x faster than regular gum. Cheaper than most supplements.",
  "Forward head posture softens the jawline. 10 minutes of chin tucks daily undoes it.",
  "Vitamin C serum (10–20%) reduces melanin more effectively than SPF alone for even skin tone.",
  "5 minutes of facial massage increases skin blood flow by 40% — that's why you glow afterward.",
  "Nasal breathing expands the palate over time. Mouth breathing narrows it.",
  "Sleeping with 1–2 pillows reduces under-eye puffiness via overnight lymphatic drainage.",
  "Symmetry is the strongest predictor of attractiveness. Your daily workout targets exactly that.",
];
