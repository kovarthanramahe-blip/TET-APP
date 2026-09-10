// Phase 9: client-side CSV export. Pure frontend -- reads data already in
// local/cloud-synced state, no new endpoint, no dependency. Each exporter
// mirrors the same human-readable columns the app already shows the user
// (e.g. sessions' Topic column matches StudySessions.jsx's own
// topicId.split('|')[2] display), not raw internal fields like id/topicId.
import { today } from './dates.js';
import { sanitizeForPersistence } from './logic.js';

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
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

export function exportBackupJSON(s) {
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: sanitizeForPersistence(s)
  };
  downloadFile(`htet-prep-backup-${today()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

// Deliberately shallow validation -- just enough to reject a random/foreign
// JSON file with a clear message. A field-by-field schema check isn't
// needed: whatever comes back here still gets merged onto a fresh
// seedState() (mirroring loadState()'s own tolerant merge), so a backup
// from an older app version with missing newer fields degrades to
// defaults for those fields rather than failing outright.
export function parseBackupFile(text) {
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
  return { state: parsed.state };
}
