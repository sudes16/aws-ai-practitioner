export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

// Relative-then-absolute timestamp used in History rows.
// Today / Yesterday → labeled relative; 2-6 days ago → weekday + time;
// older same-year → "Mon DD, h:mm AM"; cross-year → "Mon DD, YYYY".
// Anchored to the user's local timezone so a late-evening session won't slip
// into "yesterday" prematurely.
export function formatSessionTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that0  = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const daysAgo = Math.round((today0.getTime() - that0.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  if (daysAgo >= 2 && daysAgo <= 6) {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${time}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${md}, ${time}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Local-timezone calendar-day key in YYYY-MM-DD form. Use this for "what day
// was this for the user looking at it now?" comparisons (streaks, today
// filters) so a late-evening session doesn't shift into tomorrow's UTC date
// and break the streak. Stored ISO timestamps stay UTC — only the derived
// day-key is localized.
export function toLocalDateKey(d: Date | string = new Date()): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DateBucket = 'Today' | 'Yesterday' | 'This week' | 'This month' | 'Earlier';

/** Coarse local-day bucket used by History grouping. Anchored to user's timezone. */
export function getDateBucket(iso: string): DateBucket {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Earlier';
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that0  = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const daysAgo = Math.round((today0.getTime() - that0.getTime()) / 86400000);
  if (daysAgo <= 0)  return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo <= 6)  return 'This week';
  if (daysAgo <= 29) return 'This month';
  return 'Earlier';
}
