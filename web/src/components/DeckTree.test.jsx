import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckTree from './DeckTree.jsx';

const noop = () => {};
const handlers = {
  onSelect: vi.fn(), onRename: noop, onTogglePin: noop,
  onToggleArchive: noop, onDelete: noop,
};

function deck(id, name, extra = {}) {
  return { id, name, parentId: null, pinned: false, archived: false, ...extra };
}

describe('DeckTree', () => {
  it('renders nested decks and fires onSelect', () => {
    const onSelect = vi.fn();
    const decks = [
      deck(1, 'Lang'),
      { ...deck(2, 'Verbs'), parentId: 1 },
      deck(3, 'Misc'),
    ];
    render(<DeckTree decks={decks} activeId={2} {...handlers} onSelect={onSelect} />);
    expect(screen.getByText('Lang')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();
    fireEvent.click(screen.getByText('Misc'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('sorts siblings pinned-first, archived-last, then by name', () => {
    const decks = [
      deck(1, 'Bravo'),
      deck(2, 'Alpha', { archived: true }),
      deck(3, 'Charlie', { pinned: true }),
      deck(4, 'Delta'),
    ];
    const { container } = render(<DeckTree decks={decks} activeId={null} {...handlers} />);
    const names = [...container.querySelectorAll('.deck-node')].map(n => n.textContent.replace('⋯', '').trim());
    // pinned (Charlie) -> normal by name (Bravo, Delta) -> archived (Alpha)
    expect(names).toEqual(['Charlie', 'Bravo', 'Delta', 'Alpha']);
  });

  it('marks archived decks with the archived class', () => {
    const decks = [deck(1, 'Old', { archived: true })];
    const { container } = render(<DeckTree decks={decks} activeId={null} {...handlers} />);
    expect(container.querySelector('.deck-node.archived')).toBeTruthy();
  });
});
