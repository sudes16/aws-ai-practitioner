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
