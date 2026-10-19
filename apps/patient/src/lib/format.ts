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
