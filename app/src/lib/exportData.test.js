import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportNotesCSV, exportTasksCSV, exportBackupJSON, parseBackupFile } from './exportData.js';
import { seedState, sanitizeForPersistence } from './logic.js';

// jsdom doesn't implement URL.createObjectURL/revokeObjectURL -- stub them
// the same way a real browser download would resolve them, so the
// Blob-plus-anchor download mechanics (shared by every exporter in this
// file) can run at all under jsdom.
let createdUrls;
let clickedAnchors;
let realClick;

beforeEach(() => {
  createdUrls = [];
  clickedAnchors = [];
  URL.createObjectURL = vi.fn(() => {
    const url = 'blob:mock-' + createdUrls.length;
    createdUrls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    clickedAnchors.push({ href: this.href, download: this.download });
  };
});

afterEach(() => {
  HTMLAnchorElement.prototype.click = realClick;
  vi.restoreAllMocks();
});

describe('exportBackupJSON', () => {
  it('downloads a JSON file named with today\'s date, containing the sanitized state under a versioned envelope', async () => {
    const s = { ...seedState(), running: true, quizStage: 'active', quiz: [{ type: 'mcq' }] };
    exportBackupJSON(s);

    expect(clickedAnchors).toHaveLength(1);
    expect(clickedAnchors[0].download).toMatch(/^htet-prep-backup-\d{4}-\d{2}-\d{2}\.json$/);

    // Recover exactly what was blobbed by re-reading the Blob passed to
    // createObjectURL via the mock's call args.
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    const payload = JSON.parse(text);

    expect(payload.format).toBe('htet-prep-backup');
    expect(payload.version).toBe(1);
    expect(typeof payload.exportedAt).toBe('string');
    // The exported state must already be sanitized -- same as saveState().
    expect(payload.state).toEqual(sanitizeForPersistence(s));
  });
});

describe('parseBackupFile', () => {
  it('round-trips a file produced by exportBackupJSON back into a usable state object', async () => {
    const s = seedState();
    exportBackupJSON(s);
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();

    const result = parseBackupFile(text);
    expect(result.error).toBeUndefined();
    expect(result.state).toEqual(sanitizeForPersistence(s));
  });

  it('rejects invalid JSON with a clear error', () => {
    const result = parseBackupFile('not json at all {{{');
    expect(result.error).toMatch(/valid JSON/);
  });

  it('rejects well-formed JSON that isn\'t a recognized backup', () => {
    expect(parseBackupFile(JSON.stringify({ hello: 'world' })).error).toMatch(/backup file/);
    expect(parseBackupFile(JSON.stringify({ format: 'htet-prep-backup' })).error).toMatch(/backup file/);
    expect(parseBackupFile(JSON.stringify(null)).error).toMatch(/backup file/);
    expect(parseBackupFile(JSON.stringify(42)).error).toMatch(/backup file/);
  });
});

describe('exportNotesCSV (regression: shared download plumbing still works for CSV)', () => {
  it('still downloads a CSV file with the expected filename', () => {
    exportNotesCSV(seedState());
    expect(clickedAnchors).toHaveLength(1);
    expect(clickedAnchors[0].download).toMatch(/^htet-notes-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

// Phase 33: CSV/formula injection. Excel/Sheets/LibreOffice treat a cell
// starting with =, +, -, or @ as a formula, not literal text, on open --
// every string column exported here (title/body/topic/label) is free text
// the user typed themselves, so a title like
// =HYPERLINK("http://evil","click") must not reach the file unescaped.
async function csvTextFor(exportFn, state) {
  exportFn(state);
  const blob = URL.createObjectURL.mock.calls.at(-1)[0];
  return blob.text();
}

describe('CSV export: formula-injection guard', () => {
  // Kept free of embedded commas/quotes here -- that interaction (the
  // prefix combined with RFC 4180 quoting) is covered precisely by its
  // own test below instead of approximated with a substring check.
  const riskyValues = ['=SUM(A1:A9)', '+1+1', '-2+3', "@cmd|'/C calc'!A1"];

  it('prefixes a note title/body starting with =, +, -, or @ so a spreadsheet treats it as text', async () => {
    for (const risky of riskyValues) {
      const s = { ...seedState(), notes: [{ id: 'n1', title: risky, topic: '', body: risky }] };
      const csv = await csvTextFor(exportNotesCSV, s);
      const dataLine = csv.split('\r\n')[1];
      // The raw value must never appear un-prefixed (that would mean it
      // reaches the spreadsheet as a live formula).
      expect(dataLine.startsWith(risky)).toBe(false);
      expect(dataLine).toContain("'" + risky);
    }
  });

  it('prefixes a task title the same way', async () => {
    const s = { ...seedState(), tasks: [{ id: 't1', title: '=1+1', priority: 'Low', due: '', done: false }] };
    const csv = await csvTextFor(exportTasksCSV, s);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine.startsWith("'=1+1")).toBe(true);
  });

  it('leaves ordinary titles (not starting with a risky character) untouched', async () => {
    const s = { ...seedState(), notes: [{ id: 'n1', title: 'Normal title', topic: '', body: 'Some body text' }] };
    const csv = await csvTextFor(exportNotesCSV, s);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine.startsWith('Normal title')).toBe(true);
  });

  it('still applies the existing comma/quote/newline escaping on top of the prefix', async () => {
    const s = { ...seedState(), notes: [{ id: 'n1', title: '=A,"B"', topic: '', body: '' }] };
    const csv = await csvTextFor(exportNotesCSV, s);
    const dataLine = csv.split('\r\n')[1];
    // Expect: prefixed with ', then the whole field quoted because of the
    // comma, with the embedded quote doubled per RFC 4180.
    expect(dataLine.startsWith('"\'=A,""B"""')).toBe(true);
  });
});
