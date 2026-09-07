export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function dayIndex(d) {
  return Math.floor(new Date((d || today()) + 'T00:00:00').getTime() / 86400000);
}

export function seedDay(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export function fmtShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function fmtWeekday(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
}
