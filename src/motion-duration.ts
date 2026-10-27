/** CSS minifiers can rewrite 200ms as .2s; JS animation clocks use milliseconds. */
export function cssTimeToMilliseconds(value: string, fallback = 200): number {
  const time = value.trim().toLowerCase();
  if (time === '0') return 0;
  const match = time.match(/^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/);
  if (!match) return fallback;
  const duration = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  return Number.isFinite(duration) ? duration : fallback;
}

export function readMotionDuration(): number {
  return cssTimeToMilliseconds(getComputedStyle(document.documentElement).getPropertyValue('--motion-duration'));
}
