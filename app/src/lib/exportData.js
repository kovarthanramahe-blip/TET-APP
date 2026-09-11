// Phase 9: client-side CSV export. Pure frontend -- reads data already in
// local/cloud-synced state, no new endpoint, no dependency. Each exporter
// mirrors the same human-readable columns the app already shows the user
// (e.g. sessions' Topic column matches StudySessions.jsx's own
// topicId.split('|')[2] display), not raw internal fields like id/topicId.
import { today } from './dates.js';
import { sanitizeForPersistence } from './logic.js';

// Phase 33: CSV/"formula injection" mitigation. Excel, Google Sheets and
// LibreOffice all treat a cell whose content starts with =, +, -, @ (or a
// leading tab/CR) as a formula to evaluate rather than literal text when a
// CSV is opened -- so a note/task titled e.g.
// =HYPERLINK("http://evil.example","click") would execute the moment this
// export is opened in a spreadsheet, since every string column here
// (title, body, topic, label) is free text the user typed themselves.
// Prefixing with a leading apostrophe is the standard OWASP-recommended
// fix: it's not part of the CSV format itself, but it's the same
// convention these spreadsheet apps already use to mean "force text" for
// a manually-typed cell, so it neutralizes the formula interpretation on
// import without otherwise changing how the value reads.
const RISKY_LEADING_CHAR = /^[=+\-@\t\r]/;

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = RISKY_LEADING_CHAR.test(str) ? "'" + str : str;
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

function toCSV(columns, rows) {
  const header = columns.map(c => csvEscape(c.header)).join(',');
  const lines = rows.map(row => columns.map(c => csvEscape(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV(filename, csvContent) {
  downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

export function exportNotesCSV(s) {
  const csv = toCSV([
    { header: 'Title', value: n => n.title },
    { header: 'Topic', value: n => n.topic || '' },
    { header: 'Body', value: n => n.body || '' }
  ], s.notes);
  downloadCSV(`htet-notes-${today()}.csv`, csv);
}

export function exportSessionsCSV(s) {
  const csv = toCSV([
    { header: 'Label', value: x => x.label },
    { header: 'Topic', value: x => (x.topicId ? x.topicId.split('|')[2] : '') },
    { header: 'Date', value: x => x.date },
    { header: 'Minutes', value: x => x.mins }
  ], s.sessions);
  downloadCSV(`htet-study-sessions-${today()}.csv`, csv);
}

export function exportQuizAttemptsCSV(s) {
  const csv = toCSV([
    { header: 'Date', value: a => a.when },
    { header: 'Mode', value: a => a.mode },
    { header: 'Correct', value: a => a.correct },
    { header: 'Total', value: a => a.total },
    { header: 'Score %', value: a => a.pct }
  ], s.attempts);
  downloadCSV(`htet-quiz-attempts-${today()}.csv`, csv);
}

export function exportTasksCSV(s) {
  const csv = toCSV([
    { header: 'Title', value: t => t.title },
    { header: 'Priority', value: t => t.priority },
    { header: 'Due date', value: t => t.due || '' },
    { header: 'Done', value: t => (t.done ? 'Yes' : 'No') }
  ], s.tasks);
  downloadCSV(`htet-tasks-${today()}.csv`, csv);
}

// Phase 19: unlike the per-category CSV exports above (human-readable,
// one-way, meant for opening in a spreadsheet), this is a full-fidelity
// snapshot meant to round-trip back into the app -- every session, task,
// note, confidence mark, flashcard SRS schedule and setting, in the app's
// own internal shape. sanitizeForPersistence() is the same rule
// saveState() already applies before writing to localStorage, so a backup
// never disagrees with what the app itself considers "real" state.
const BACKUP_FORMAT = 'htet-prep-backup';
const BACKUP_VERSION = 1;

// Phase 20: a restore file crosses a real trust boundary -- unlike
// localStorage (only ever written by this app's own saveState()), a
// backup file can come from anywhere. A file this large has no legitimate
// use here (the whole point is a JSON mirror of localStorage, which browsers
// already cap in the low single-digit MB), so reject oversized files before
// even attempting to parse them.
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const MAX_STRING_LENGTH = 100000; // generous for a long markdown note; blocks multi-MB string abuse
const MAX_ARRAY_LENGTH = 5000; // far beyond any realistic sessions/tasks/notes/attempts history
const MAX_MAP_KEYS = 5000; // confidence/cards/answers are keyed by a small, bounded syllabus/deck/quiz size

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isSafeString(v) {
  return typeof v === 'string' && v.length <= MAX_STRING_LENGTH;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isSafeStringOrNull(v) {
  return v === null || isSafeString(v);
}

function isArrayOfShape(v, itemIsValid) {
  return Array.isArray(v) && v.length <= MAX_ARRAY_LENGTH && v.every(item => isPlainObject(item) && itemIsValid(item));
}

// Every key this validates against a plain object's OWN enumerable string
// keys. JSON.parse always produces "__proto__" as an ordinary data
// property (never the accessor), so it isn't dangerous by itself here --
// but sanitizeImportedState() below stores the validated object AS-IS
// (not a rebuilt copy), so a "__proto__"/"constructor"/"prototype" key
// would ride along into confidence/cards/answers untouched. Nothing in
// this codebase currently copies those fields onto another object in a
// way that would trigger the prototype-chain setter (no Object.assign or
// for...in loop touches them), but that's a property of today's call
// sites, not of this validator -- reject the whole map outright if one of
// these names shows up, the same way any other malformed/untrusted shape
// here is simply dropped, rather than leaving a live landmine for the
// next bit of code that merges these maps.
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeMap(v, valueIsValid) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length > MAX_MAP_KEYS) return false;
  return keys.every(k => isSafeString(k) && !DANGEROUS_KEYS.has(k) && valueIsValid(v[k]));
}

// Field-level validators for every top-level key seedState() defines.
// Anything not listed here is simply never read off an imported file --
// see sanitizeImportedState() below -- which is what actually keeps out
// "__proto__" / "constructor" / "prototype" or any other unexpected key,
// not a denylist of specific names.
const FIELD_VALIDATORS = {
  view: isSafeString,
  theme: isSafeString,
  level: isSafeString,
  confidence: v => isSafeMap(v, val => isFiniteNumber(val) && val >= 0 && val <= 3),
  sessions: v => isArrayOfShape(v, item =>
    isSafeString(item.label) && isFiniteNumber(item.mins) && isSafeString(item.date) && isSafeStringOrNull(item.topicId)),
  tasks: v => isArrayOfShape(v, item =>
    isSafeString(item.id) && isSafeString(item.title) && isSafeString(item.priority)
    && isSafeStringOrNull(item.due) && typeof item.done === 'boolean'),
  notes: v => isArrayOfShape(v, item =>
    isSafeString(item.id) && isSafeString(item.title) && isSafeString(item.topic)
    && isSafeStringOrNull(item.topicId) && isSafeString(item.body)),
  cards: v => isSafeMap(v, val => isPlainObject(val)
    && isFiniteNumber(val.ease) && isFiniteNumber(val.interval) && isFiniteNumber(val.reps) && isFiniteNumber(val.due)),
  customCards: v => isArrayOfShape(v, item =>
    isSafeString(item.id) && isSafeString(item.front) && isSafeString(item.back) && isSafeString(item.category)
    && isSafeStringOrNull(item.topicId) && isFiniteNumber(item.ease) && isFiniteNumber(item.interval)
    && isFiniteNumber(item.reps) && isFiniteNumber(item.due)),
  customTopics: v => isArrayOfShape(v, item =>
    isSafeString(item.id) && isSafeString(item.level) && isSafeString(item.moduleName)
    && isSafeString(item.name) && isSafeString(item.desc)),
  planItems: v => isArrayOfShape(v, item =>
    isSafeString(item.id) && isSafeString(item.date) && isSafeString(item.moduleName)
    && isFiniteNumber(item.minutesGoal) && typeof item.done === 'boolean'),
  attempts: v => isArrayOfShape(v, item =>
    isSafeString(item.when) && isSafeString(item.mode) && isFiniteNumber(item.correct)
    && isFiniteNumber(item.total) && isFiniteNumber(item.pct)),
  reviews: isFiniteNumber,
  taskFilter: isSafeString,
  taskDraft: isSafeString,
  taskDue: isSafeString,
  taskPriority: isSafeString,
  logLabel: isSafeString,
  logMinutes: isFiniteNumber,
  sessionTopicId: isSafeStringOrNull,
  customCardFront: isSafeString,
  customCardBack: isSafeString,
  customCardCategory: isSafeString,
  customCardTopicId: isSafeStringOrNull,
  customCardCurrentId: isSafeStringOrNull,
  customCardRevealed: v => typeof v === 'boolean',
  customTopicModule: isSafeString,
  customTopicName: isSafeString,
  customTopicDesc: isSafeString,
  activeNote: isSafeStringOrNull,
  timerMode: isSafeString,
  phase: isSafeString,
  running: v => typeof v === 'boolean',
  remaining: isFiniteNumber,
  cycles: isFiniteNumber,
  quizStage: isSafeString,
  quizTypes: v => Array.isArray(v) && v.length <= MAX_ARRAY_LENGTH && v.every(isSafeString),
  quizParts: v => Array.isArray(v) && v.length <= MAX_ARRAY_LENGTH && v.every(isSafeString),
  quizMode: isSafeString,
  quiz: v => v === null, // sanitizeForPersistence() always exports this as null
  qIndex: isFiniteNumber,
  answers: v => isSafeMap(v, val => val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'),
  textAnswer: isSafeString,
  mockLeft: isFiniteNumber,
  revealed: v => typeof v === 'boolean',
  cardIndex: isFiniteNumber,
  cardRevealed: v => typeof v === 'boolean',
  confirmReset: v => typeof v === 'boolean',
  pomodoroMinutes: isFiniteNumber,
  breakMinutes: isFiniteNumber,
  showQuotes: v => typeof v === 'boolean',
  examDate: isSafeStringOrNull,
  dailyGoalMinutes: isFiniteNumber,
  remindersEnabled: v => typeof v === 'boolean',
  reminderTime: isSafeString,
  reminderDays: v => Array.isArray(v) && v.length <= 7 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 6),
  endOfDayNudgeEnabled: v => typeof v === 'boolean',
  endOfDayNudgeTime: isSafeString
};

// Builds a brand-new plain object containing only recognized keys with
// validated values -- never Object.assign()/spread of the raw imported
// object, so a key this app doesn't know about (whether "__proto__",
// "constructor", "prototype", or simply a field from a future/foreign
// format) can never end up copied anywhere, and every value that *is*
// copied has already been shape- and size-checked above. A key that's
// missing or fails validation is just left out, same as loadState()'s
// existing tolerant merge already does for a backup with gaps.
export function sanitizeImportedState(rawState) {
  const clean = {};
  if (!isPlainObject(rawState)) return clean;
  for (const key of Object.keys(FIELD_VALIDATORS)) {
    if (!Object.prototype.hasOwnProperty.call(rawState, key)) continue;
    const value = rawState[key];
    if (FIELD_VALIDATORS[key](value)) clean[key] = value;
  }
  return clean;
}

export function exportBackupJSON(s) {
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: sanitizeForPersistence(s)
  };
  downloadFile(`htet-prep-backup-${today()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

// Validates the file's overall envelope, then runs its `state` through the
// allowlist above -- so what callers get back is always a fresh, validated
// object regardless of what the file actually contained.
export function parseBackupFile(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_FILE_BYTES) {
    return { error: 'That backup file is too large.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: "That file isn't valid JSON." };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== BACKUP_FORMAT
    || !parsed.state || typeof parsed.state !== 'object') {
    return { error: "That doesn't look like an HTET Study Desk backup file." };
  }
  return { state: sanitizeImportedState(parsed.state) };
}
