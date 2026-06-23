import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BoxTree from './BoxTree.jsx';

const boxes = [
  { id: 1, name: 'Lang', parentId: null },
  { id: 2, name: 'Verbs', parentId: 1 },
  { id: 3, name: 'Misc', parentId: null },
];

describe('BoxTree', () => {
  it('renders nested boxes and fires onSelect', () => {
    const onSelect = vi.fn();
    render(<BoxTree boxes={boxes} activeId={2} onSelect={onSelect} />);
    expect(screen.getByText('Lang')).toBeTruthy();
    expect(screen.getByText('Verbs')).toBeTruthy();
    fireEvent.click(screen.getByText('Misc'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
