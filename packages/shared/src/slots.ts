import type { Practitioner } from "./types";

// Bookable slot calculation. The patient app uses it to show free times; the database's
// is_offered_slot() applies the same rules when a booking comes in.

export interface Slot {
  /** yyyy-mm-dd in the practitioner's time zone */
  date: string;
  /** HH:mm in the practitioner's time zone */
  time: string;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Weekday (0 = Sunday) of an ISO date, independent of the device time zone. */
export const weekdayOf = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isBlocked(practitioner: Pick<Practitioner, "blocked_ranges">, isoDate: string) {
  return practitioner.blocked_ranges.some((r) => isoDate >= r.from && isoDate <= r.to);
}

/**
 * Lists the start times a practitioner offers on a date, before removing booked ones.
 * @param taken start times ("HH:mm") already booked that day
 */
export function slotsForDate(
  practitioner: Pick<Practitioner, "weekly_hours" | "blocked_ranges" | "extra_days" | "session_minutes">,
  isoDate: string,
  taken: string[] = [],
): Slot[] {
  if (isBlocked(practitioner, isoDate)) return [];
  const windows = [
    ...(practitioner.weekly_hours[String(weekdayOf(isoDate))] ?? []),
    ...practitioner.extra_days.filter((d) => d.date === isoDate).map(({ start, end }) => ({ start, end })),
  ];
  const step = practitioner.session_minutes;
  const times = new Set<string>();
  for (const w of windows) {
    for (let t = toMinutes(w.start); t + step <= toMinutes(w.end); t += step) times.add(toHHMM(t));
  }
  return [...times]
    .filter((time) => !taken.includes(time))
    .sort()
    .map((time) => ({ date: isoDate, time }));
}

/** Converts a wall-clock date and time in an IANA zone to a UTC Date. */
export function zonedToUtc(isoDate: string, hhmm: string, timeZone: string): Date {
  const guess = new Date(`${isoDate}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asZoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asZoned - guess.getTime()));
}

/** yyyy-mm-dd for a Date as seen in a time zone. */
export function isoDateIn(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** HH:mm for a Date as seen in a time zone. */
export function timeIn(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export interface HoursGroup {
  /** Weekdays (0 = Sunday) that share these hours, in order. */
  days: number[];
  /** Working windows for those days, e.g. [{ start: "16:00", end: "22:00" }]. */
  windows: { start: string; end: string }[];
}

/**
 * Groups a practitioner's weekly hours into runs of days with the same hours, for display:
 * Sunday to Thursday 16:00 to 22:00 becomes one group.
 */
export function groupWeeklyHours(weekly: Practitioner["weekly_hours"]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (let d = 0; d < 7; d++) {
    const windows = [...(weekly[String(d)] ?? [])].sort((a, b) => a.start.localeCompare(b.start));
    if (windows.length === 0) continue;
    const last = groups[groups.length - 1];
    if (last && last.days[last.days.length - 1] === d - 1 && JSON.stringify(last.windows) === JSON.stringify(windows)) {
      last.days.push(d);
    } else {
      groups.push({ days: [d], windows });
    }
  }
  return groups;
}
