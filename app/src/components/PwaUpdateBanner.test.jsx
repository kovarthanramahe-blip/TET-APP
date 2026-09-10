import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// virtual:pwa-register/react only really resolves through vite-plugin-pwa's
// dev/build pipeline (and depends on browser service-worker machinery this
// component deliberately never touches directly) -- mocking it here isolates
// the banner's own UI logic (which state shows which message/buttons, and
// that the buttons call the right functions) from that machinery entirely.
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();
const updateServiceWorker = vi.fn();
let needRefresh = false;
let offlineReady = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  })
}));

// Imported after the mock is registered above.
const PwaUpdateBanner = (await import('./PwaUpdateBanner.jsx')).default;

beforeEach(() => {
  needRefresh = false;
  offlineReady = false;
  setNeedRefresh.mockClear();
  setOfflineReady.mockClear();
  updateServiceWorker.mockClear();
});

describe('PwaUpdateBanner', () => {
  it('renders nothing when there is no update and offline-readiness has not been announced', () => {
    const { container } = render(<PwaUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an offline-ready message with a dismiss button', () => {
    offlineReady = true;
    render(<PwaUpdateBanner />);
    expect(screen.getByText(/ready to work offline/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('shows an update-available prompt, and "Later" only dismisses it without reloading', () => {
    needRefresh = true;
    render(<PwaUpdateBanner />);
    expect(screen.getByText(/new version/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Later'));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('clicking "Update" calls updateServiceWorker to actually apply it', () => {
    needRefresh = true;
    render(<PwaUpdateBanner />);
    fireEvent.click(screen.getByText('Update'));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('prioritizes the update prompt over the offline-ready message if somehow both are true', () => {
    needRefresh = true;
    offlineReady = true;
    render(<PwaUpdateBanner />);
    expect(screen.getByText(/new version/)).toBeInTheDocument();
    expect(screen.queryByText(/ready to work offline/)).not.toBeInTheDocument();
  });

  it('auto-dismisses the offline-ready message after a few seconds, since it can otherwise sit over page content in that corner indefinitely', () => {
    vi.useFakeTimers();
    offlineReady = true;
    render(<PwaUpdateBanner />);
    expect(screen.getByText(/ready to work offline/)).toBeInTheDocument();
    vi.advanceTimersByTime(6000);
    expect(setOfflineReady).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('does NOT auto-dismiss the update-available prompt (it requires a real decision)', () => {
    vi.useFakeTimers();
    needRefresh = true;
    render(<PwaUpdateBanner />);
    vi.advanceTimersByTime(10000);
    expect(setNeedRefresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
