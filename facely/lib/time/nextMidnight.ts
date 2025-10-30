// facely/lib/time/nextMidnight.ts
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
  