import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckMenu from './DeckMenu.jsx';

const base = { id: 1, name: 'D', pinned: false, archived: false };

function setup(deck = base) {
  const handlers = {
    onRename: vi.fn(), onTogglePin: vi.fn(),
    onToggleArchive: vi.fn(), onDelete: vi.fn(),
  };
  render(<DeckMenu deck={deck} {...handlers} />);
  return handlers;
}

describe('DeckMenu', () => {
  it('opens on trigger click and shows items', () => {
    setup();
    expect(screen.queryByText('Rename')).toBeNull();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Pin')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('reflects pinned/archived state in labels', () => {
    setup({ ...base, pinned: true, archived: true });
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Unpin')).toBeTruthy();
    expect(screen.getByText('Unarchive')).toBeTruthy();
  });

  it('fires callbacks and closes after click', () => {
    const h = setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Rename'));
    expect(h.onRename).toHaveBeenCalledWith(base);
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('fires pin, archive, and delete callbacks', () => {
    const h = setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Pin'));
    expect(h.onTogglePin).toHaveBeenCalledWith(base);
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Archive'));
    expect(h.onToggleArchive).toHaveBeenCalledWith(base);
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.click(screen.getByText('Delete'));
    expect(h.onDelete).toHaveBeenCalledWith(base);
  });

  it('closes when clicking outside the menu', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    expect(screen.getByText('Rename')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('does not close when clicking inside the menu container', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Deck menu'));
    fireEvent.mouseDown(screen.getByText('Rename'));
    // mousedown inside should not close before the click action fires
    expect(screen.getByText('Rename')).toBeTruthy();
  });
});
