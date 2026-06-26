import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App.jsx';

beforeEach(async () => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('ankinote');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      console.warn('DB delete blocked');
      setTimeout(resolve, 100);
    };
  });
});

describe('App boot', () => {
  it('boots into the note UI (not a gate) with no saved settings', async () => {
    render(<App />);
    // The note UI shell renders: the Decks sidebar header and New note button appear.
    await waitFor(() => expect(screen.getByText('Decks')).toBeTruthy());
    expect(screen.getByText('New note')).toBeTruthy();
  });

  it('auto-opens the connect dialog on first run and can dismiss it', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Connect to your WebDAV vault')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByText('Connect to your WebDAV vault')).toBeNull());
    // UI still present after dismiss
    expect(screen.getByText('Decks')).toBeTruthy();
  });

  it('toolbar Connect button reopens the dialog and shows Local-only', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Decks')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Close'));
    const btn = screen.getByRole('button', { name: /Local-only/ });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText('Connect to your WebDAV vault')).toBeTruthy());
  });
});
