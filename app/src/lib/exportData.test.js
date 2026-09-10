import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportNotesCSV, exportBackupJSON, parseBackupFile } from './exportData.js';
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
