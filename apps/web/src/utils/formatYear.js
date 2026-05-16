// Render a year integer as a human-readable string.
// Positive years stay as-is ("2008"); negative years become "500 BCE".
export function formatYear(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return `${Math.abs(n)} BCE`;
  return String(n);
}
