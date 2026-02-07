export function nextIntervalDays(current: number, remembered: boolean) {
  if (!remembered) return 1;

  const next = Math.max(1, Math.round(current * 2));

  // chặn max 1 năm cho an toàn
  return Math.min(next, 365);
}

export function addDaysMs(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}
