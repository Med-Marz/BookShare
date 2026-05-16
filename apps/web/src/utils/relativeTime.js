// Tiny relative-time formatter — wraps Intl.RelativeTimeFormat so we can say
// "3 minutes ago" without pulling in date-fns. Falls back to a local date
// string after a week, since "27 days ago" is harder to read than "May 16".
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(isoString) {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return '';
  const diff = then - Date.now();
  const abs = Math.abs(diff);

  if (abs < MINUTE) return rtf.format(Math.round(diff / SECOND), 'second');
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  if (abs < WEEK) return rtf.format(Math.round(diff / DAY), 'day');

  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
