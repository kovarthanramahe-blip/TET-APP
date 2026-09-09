// Phase 9: client-side CSV export. Pure frontend -- reads data already in
// local/cloud-synced state, no new endpoint, no dependency. Each exporter
// mirrors the same human-readable columns the app already shows the user
// (e.g. sessions' Topic column matches StudySessions.jsx's own
// topicId.split('|')[2] display), not raw internal fields like id/topicId.
import { today } from './dates.js';

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function toCSV(columns, rows) {
  const header = columns.map(c => csvEscape(c.header)).join(',');
  const lines = rows.map(row => columns.map(c => csvEscape(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
