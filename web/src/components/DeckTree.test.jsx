import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckTree from './DeckTree.jsx';

const noop = () => {};
const handlers = { onRename: noop, onTogglePin: noop, onToggleArchive: noop, onDelete: noop };
const d = (id, name, extra = {}) => ({ id, name, pinned: false, archived: false, ...extra });

describe('DeckTree', () => {
  it('renders last-segment labels nested by path', () => {
    render(<DeckTree decks={[d(1, 'Spanish'), d(2, 'Spanish::Verbs')]}
      activeId={null} onSelect={noop} {...handlers} />);
    expect(screen.getByText('Spanish')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();
  });

  it('selects by deck id on click', () => {
    const onSelect = vi.fn();
    render(<DeckTree decks={[d(2, 'Spanish::Verbs'), d(1, 'Spanish')]}
      activeId={null} onSelect={onSelect} {...handlers} />);
    fireEvent.click(screen.getByText('Verbs'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('renders a virtual intermediate without a menu', () => {
    const { container } = render(<DeckTree decks={[d(2, 'Spanish::Verbs')]}
      activeId={null} onSelect={noop} {...handlers} />);
    // Only the real deck (Verbs) has a menu trigger; the virtual Spanish does not.
    expect(container.querySelectorAll('[aria-label="Deck menu"]')).toHaveLength(1);
  });

  it('marks archived decks with the archived class', () => {
    const { container } = render(<DeckTree decks={[d(1, 'Old', { archived: true })]}
      activeId={null} onSelect={noop} {...handlers} />);
    expect(container.querySelector('.deck-node.archived')).toBeTruthy();
  });
});
