// Local calendar-date components (getFullYear/getMonth/getDate), not
// toISOString()'s always-UTC ones -- see today()'s own comment below for
// why the distinction matters throughout this file.
export function toLocalDateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Phase 36: was `new Date().toISOString().slice(0, 10)`. toISOString() is
// ALWAYS UTC by spec, so for any timezone ahead of UTC -- including
// India/IST at UTC+5:30, this app's actual audience -- that returned
// YESTERDAY's date for the first ~5.5 hours of every local day. A study
// session logged at 1am IST would silently be stamped with yesterday's
// date and not count toward "today", breaking daily streaks and
// daily-goal tracking for exactly the kind of late-night/early-morning
// session a real exam aspirant would log. getFullYear/getMonth/getDate
// are local by spec, unlike their getUTC* counterparts.
export function today() {
  return toLocalDateString(new Date());
}

export function dayIndex(d) {
  return Math.floor(new Date((d || today()) + 'T00:00:00').getTime() / 86400000);
}

// The local calendar date `days` away from today (negative = past,
// positive = future) as a YYYY-MM-DD string. Uses setDate/getDate
// (calendar arithmetic on the local date), not raw millisecond shifting,
// so it can't land on the wrong side of a DST transition either -- the
// same safe pattern migrateToSupabase.js's dateStringFromDayIndex()
// already uses, for the identical reason.
export function offsetDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function seedDay(n) {
  return offsetDateString(n);
}

export function fmtShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function fmtWeekday(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
}
