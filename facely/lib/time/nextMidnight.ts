// facely/lib/time/nextMidnight.ts

/** Returns "YYYY-MM-DD" in the device's LOCAL timezone. */
export function getLocalDateString(d?: Date): string {
  const now = d ?? new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function msUntilNextMidnight(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - now.getTime();
  }
  
  export function scheduleDaily(callback: () => void): () => void {
    const run = () => {
      callback();
      const i = setInterval(callback, 24 * 60 * 60 * 1000);
      (global as any).__dailyInterval = i;
    };
    const t = setTimeout(run, msUntilNextMidnight());
    return () => {
      clearTimeout(t);
      if ((global as any).__dailyInterval) clearInterval((global as any).__dailyInterval);
    };
  }

/** Returns the Monday 00:00:00 of the current local calendar week. */
export function getStartOfWeek(d?: Date): Date {
  const now = d ?? new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Returns the Monday 00:00:00 of the NEXT calendar week. */
export function getNextMonday(): Date {
  const monday = getStartOfWeek();
  monday.setDate(monday.getDate() + 7);
  return monday;
}
  