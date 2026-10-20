import { groupWeeklyHours, type Practitioner } from '@chester/shared';

type DateInput = string | Date;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

export const formatDate = (d: DateInput) =>
  toDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const formatTime = (d: DateInput) =>
  toDate(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

const dayName = (d: number, locale?: string) =>
  // 2023-01-01 was a Sunday, so day 0 lands on Sunday.
  new Date(Date.UTC(2023, 0, 1 + d, 12)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });

/** "16:00" as "4 PM", "16:30" as "4:30 PM". */
export function formatClock(hhmm: string, locale?: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2023, 0, 1, h, m)).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: m ? '2-digit' : undefined,
    timeZone: 'UTC',
  });
}

/** A practitioner's working hours, one line per run of days: "Sun – Thu · 4 PM – 10 PM". */
export function formatHours(weekly: Practitioner['weekly_hours'], locale?: string) {
  return groupWeeklyHours(weekly).map(({ days, windows }) => {
    const first = dayName(days[0], locale);
    const last = dayName(days[days.length - 1], locale);
    const dayLabel = days.length === 1 ? first : days.length === 2 ? `${first}, ${last}` : `${first} – ${last}`;
    const times = windows.map((w) => `${formatClock(w.start, locale)} – ${formatClock(w.end, locale)}`).join(', ');
    return `${dayLabel} · ${times}`;
  });
}
