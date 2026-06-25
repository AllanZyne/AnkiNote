import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SyncStatus from './SyncStatus.jsx';

function fakeEngine(initial) {
  let status = initial; let cb = null;
  return {
    subscribe(fn) { cb = fn; fn(status); return () => { cb = null; }; },
    getStatus() { return status; },
    _emit(s) { status = s; if (cb) act(() => cb(s)); },
  };
}

describe('SyncStatus', () => {
  it('renders each state label', () => {
    const e = fakeEngine({ state: 'synced', pending: 0, lastSyncedAt: null });
    render(<SyncStatus engine={e} />);
    expect(screen.getByText('Synced')).toBeTruthy();
    e._emit({ state: 'offline', pending: 2, lastSyncedAt: null });
    expect(screen.getByText(/Offline/)).toBeTruthy();
    e._emit({ state: 'syncing', pending: 3, lastSyncedAt: null });
    expect(screen.getByText(/Syncing… \(3\)/)).toBeTruthy();
    e._emit({ state: 'error', pending: 1, lastSyncedAt: null });
    expect(screen.getByText(/Sync error/)).toBeTruthy();
  });
});
