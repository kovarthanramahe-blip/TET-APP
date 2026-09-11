import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as cloudData from '../lib/cloudData.js';
import { useCloudCustomCards } from './useCloudCustomCards.js';

vi.mock('../lib/cloudData.js', () => ({
  fetchCustomCards: vi.fn(),
  fetchTopicKeyMaps: vi.fn(),
  cloudAddCustomCard: vi.fn(),
  cloudUpdateCustomCard: vi.fn(),
  cloudDeleteCustomCard: vi.fn(),
  cloudGradeCustomCard: vi.fn()
}));

function setup() {
  const baseUpdate = vi.fn();
  const baseState = {
    customCards: [],
    customCardFront: '', customCardBack: '', customCardCategory: '', customCardTopicId: null
  };
  return renderHook(() => useCloudCustomCards({ active: true, userId: 'user-1', baseState, baseUpdate }));
}

beforeEach(() => {
  vi.clearAllMocks();
  cloudData.fetchTopicKeyMaps.mockResolvedValue({ keyToTopicId: new Map(), topicIdToKey: new Map() });
  cloudData.fetchCustomCards.mockResolvedValue([{ id: 'c1', front: 'Original front', back: 'Original back', category: '', topicId: null }]);
  cloudData.cloudUpdateCustomCard.mockResolvedValue(undefined);
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
