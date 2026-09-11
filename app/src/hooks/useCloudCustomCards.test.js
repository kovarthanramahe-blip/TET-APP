import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as cloudData from '../lib/cloudData.js';
import { useCloudCustomCards } from './useCloudCustomCards.js';
import { dayIndex } from '../lib/dates.js';

vi.mock('../lib/cloudData.js', () => ({
  fetchCustomCards: vi.fn(),
  fetchTopicKeyMaps: vi.fn(),
  cloudAddCustomCard: vi.fn(),
  cloudUpdateCustomCard: vi.fn(),
  cloudDeleteCustomCard: vi.fn(),
  cloudGradeCustomCard: vi.fn()
}));

function setup(baseStateOverrides = {}) {
  const baseUpdate = vi.fn();
  const baseState = {
    customCards: [],
    customCardFront: '', customCardBack: '', customCardCategory: '', customCardTopicId: null,
    customCardCurrentId: null,
    ...baseStateOverrides
  };
  const utils = renderHook(() => useCloudCustomCards({ active: true, userId: 'user-1', baseState, baseUpdate }));
  return { ...utils, baseUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
  cloudData.fetchTopicKeyMaps.mockResolvedValue({ keyToTopicId: new Map(), topicIdToKey: new Map() });
  cloudData.fetchCustomCards.mockResolvedValue([{ id: 'c1', front: 'Original front', back: 'Original back', category: '', topicId: null }]);
  cloudData.cloudUpdateCustomCard.mockResolvedValue(undefined);
  cloudData.cloudGradeCustomCard.mockResolvedValue(undefined);
});

// updateCustomCard used to await the cloud write BEFORE updating local
// state, which is what Flashcards.jsx's Front/Back/Category inputs are
// bound to. A per-keystroke onChange awaiting a network round-trip meant
// the input didn't visibly update until the write resolved, and out-of-
// order responses could revert it to a stale value mid-typing -- the exact
// failure mode updateNote() in useCloudTasksAndNotes.js already guards
// against for notes.
describe('useCloudCustomCards: updateCustomCard is optimistic and debounced', () => {
  it('updates local state immediately, before the cloud write resolves', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let resolveWrite;
    cloudData.cloudUpdateCustomCard.mockReturnValue(new Promise(res => { resolveWrite = res; }));

    act(() => {
      result.current.actions.updateCustomCard('c1', { front: 'New front' });
    });

    // Local state reflects the edit right away, with the cloud write still
    // pending -- proving this is no longer "await, then update local state".
    expect(result.current.customCards.find(c => c.id === 'c1').front).toBe('New front');
    expect(cloudData.cloudUpdateCustomCard).not.toHaveBeenCalled();

    resolveWrite();
  });

  it('coalesces rapid edits into a single debounced write', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    vi.useFakeTimers();
    try {
      act(() => {
        result.current.actions.updateCustomCard('c1', { front: 'F' });
        result.current.actions.updateCustomCard('c1', { front: 'Fi' });
        result.current.actions.updateCustomCard('c1', { front: 'Fin' });
      });

      expect(cloudData.cloudUpdateCustomCard).not.toHaveBeenCalled();

      await act(async () => { vi.advanceTimersByTime(600); });

      expect(cloudData.cloudUpdateCustomCard).toHaveBeenCalledTimes(1);
      expect(cloudData.cloudUpdateCustomCard).toHaveBeenCalledWith('user-1', expect.any(Map), 'c1', { front: 'Fin' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useCloudCustomCards: deleteCustomCard does not silently drop a pending edit when the delete fails', () => {
  it('re-sends the pending edit if cloudDeleteCustomCard rejects', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.actions.updateCustomCard('c1', { front: 'Edited front' });
    });

    cloudData.cloudDeleteCustomCard.mockRejectedValue(new Error('network error'));

    await act(async () => {
      await result.current.actions.deleteCustomCard('c1');
    });

    expect(cloudData.cloudUpdateCustomCard).toHaveBeenCalledWith('user-1', expect.any(Map), 'c1', { front: 'Edited front' });
    expect(result.current.customCards.some(c => c.id === 'c1')).toBe(true);
  });

  it('does not resend anything if the delete actually succeeds', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.actions.updateCustomCard('c1', { front: 'Edited front' });
    });

    cloudData.cloudDeleteCustomCard.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.actions.deleteCustomCard('c1');
    });

    expect(cloudData.cloudUpdateCustomCard).not.toHaveBeenCalled();
    expect(result.current.customCards.some(c => c.id === 'c1')).toBe(false);
  });
});

// gradeCustomCardState() (the local-mode path, logic.js) always resets
// customCardRevealed to false and advances customCardCurrentId to
// whatever's next in the due queue. This cloud-mode path used to update
// only the customCards array and leave both of those untouched -- so
// Flashcards.jsx's derived `currentCustomCard` would silently fall
// through to the next due card while `customCardRevealed` was still true
// from the card just graded, showing that next card's answer and grade
// buttons immediately instead of requiring "Reveal answer" first.
describe('useCloudCustomCards: gradeCustomCard resets reveal/current-card state like the local path does', () => {
  it('resets customCardRevealed and advances customCardCurrentId to the next still-due card', async () => {
    const today = dayIndex();
    cloudData.fetchCustomCards.mockResolvedValue([
      { id: 'c1', front: 'Card 1', back: 'Back 1', category: '', topicId: null, ease: 2.5, interval: 0, reps: 0, due: today },
      { id: 'c2', front: 'Card 2', back: 'Back 2', category: '', topicId: null, ease: 2.5, interval: 0, reps: 0, due: today }
    ]);
    const { result, baseUpdate } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // Grade 2 ("Good") pushes c1's due date to tomorrow -- no longer due --
    // while c2 stays due today.
    await act(async () => {
      await result.current.actions.gradeCustomCard('c1', 2);
    });

    expect(baseUpdate).toHaveBeenCalledWith({ customCardRevealed: false, customCardCurrentId: 'c2' });
  });

  it('sets customCardCurrentId to null when nothing remains due', async () => {
    const today = dayIndex();
    cloudData.fetchCustomCards.mockResolvedValue([
      { id: 'c1', front: 'Card 1', back: 'Back 1', category: '', topicId: null, ease: 2.5, interval: 0, reps: 0, due: today }
    ]);
    const { result, baseUpdate } = setup();
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.actions.gradeCustomCard('c1', 2);
    });

    expect(baseUpdate).toHaveBeenCalledWith({ customCardRevealed: false, customCardCurrentId: null });
  });
});

// Same bug class as gradeCustomCard above, but for deletion: deleting the
// card currently shown revealed used to leave customCardCurrentId/
// customCardRevealed untouched, so the next due card Flashcards.jsx falls
// through to would render already revealed.
describe('useCloudCustomCards: deleteCustomCard resets reveal/current-card state when the deleted card was the current one', () => {
  it('resets customCardCurrentId and customCardRevealed when deleting the current card', async () => {
    const { result, baseUpdate } = setup({ customCardCurrentId: 'c1', customCardRevealed: true });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    cloudData.cloudDeleteCustomCard.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.actions.deleteCustomCard('c1');
    });

    expect(baseUpdate).toHaveBeenCalledWith({ customCardCurrentId: null, customCardRevealed: false });
  });

  it('does not touch reveal/current-card state when deleting a different card', async () => {
    const { result, baseUpdate } = setup({ customCardCurrentId: 'c-other', customCardRevealed: true });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    cloudData.cloudDeleteCustomCard.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.actions.deleteCustomCard('c1');
    });

    expect(baseUpdate).not.toHaveBeenCalled();
  });
});
