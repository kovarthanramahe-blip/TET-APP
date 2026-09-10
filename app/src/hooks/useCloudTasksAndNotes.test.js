import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as cloudData from '../lib/cloudData.js';
import { useCloudTasksAndNotes } from './useCloudTasksAndNotes.js';

vi.mock('../lib/cloudData.js', () => ({
  fetchTasks: vi.fn(),
  fetchNotes: vi.fn(),
  fetchTopicKeyMaps: vi.fn(),
  cloudAddTask: vi.fn(),
  cloudUpdateTask: vi.fn(),
  cloudDeleteTask: vi.fn(),
  cloudAddNote: vi.fn(),
  cloudUpdateNote: vi.fn(),
  cloudDeleteNote: vi.fn(),
  cloudResetAllTasksDone: vi.fn()
}));

function setup() {
  const baseUpdate = vi.fn();
  const baseActions = { setActiveNote: vi.fn() };
  const baseState = { tasks: [], level: 'Level 1 (PRT)' };
  return renderHook(() => useCloudTasksAndNotes({ active: true, userId: 'user-1', baseState, baseUpdate, baseActions }));
}

beforeEach(() => {
  vi.clearAllMocks();
  cloudData.fetchTasks.mockResolvedValue([]);
  cloudData.fetchTopicKeyMaps.mockResolvedValue({ keyToTopicId: new Map(), topicIdToKey: new Map() });
  cloudData.fetchNotes.mockResolvedValue([{ id: 'n1', title: 'Original title', topic: '', topicId: null, body: 'original body' }]);
  cloudData.cloudUpdateNote.mockResolvedValue(undefined);
});

// A note-edit debounces its write for 600ms (see updateNote()'s own
// comment); deleting a note right after editing it used to cancel that
// pending write unconditionally, before even attempting the delete. If the
// delete then failed, the note was never actually removed, but the edit
// that was in flight was gone for good -- silently, with only the delete
// failure (not the lost edit) ever surfaced.
describe('useCloudTasksAndNotes: deleteNote does not silently drop a pending edit when the delete fails', () => {
  it('re-sends the pending edit if cloudDeleteNote rejects', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.actions.updateNote('n1', { title: 'Edited title' });
    });

    cloudData.cloudDeleteNote.mockRejectedValue(new Error('network error'));

    await act(async () => {
      await result.current.actions.deleteNote('n1');
    });

    expect(cloudData.cloudUpdateNote).toHaveBeenCalledWith('user-1', expect.any(Map), 'n1', { title: 'Edited title' });
    // The note is still there locally too, matching that the delete
    // genuinely didn't go through.
    expect(result.current.notes.some(n => n.id === 'n1')).toBe(true);
  });

  it('does not resend anything if the delete actually succeeds', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.actions.updateNote('n1', { title: 'Edited title' });
    });

    cloudData.cloudDeleteNote.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.actions.deleteNote('n1');
    });

    expect(cloudData.cloudUpdateNote).not.toHaveBeenCalled();
    expect(result.current.notes.some(n => n.id === 'n1')).toBe(false);
  });

  it('does nothing extra on delete failure when there was no pending edit', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    cloudData.cloudDeleteNote.mockRejectedValue(new Error('network error'));

    await act(async () => {
      await result.current.actions.deleteNote('n1');
    });

    expect(cloudData.cloudUpdateNote).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/network error/);
  });
});
