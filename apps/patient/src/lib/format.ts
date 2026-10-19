import type { TimestampLike } from '@chester/shared';

export const formatDate = (ts: TimestampLike | Date) =>
  (ts instanceof Date ? ts : ts.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const formatTime = (ts: TimestampLike | Date) =>
  (ts instanceof Date ? ts : ts.toDate()).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';
