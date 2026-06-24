import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BrowseView from './BrowseView.jsx';

const noteType = {
  id: 1, css: '',
  fields: [{ id: 1, name: 'Front', ord: 0 }],
  templates: [{ id: 1, frontHtml: '{{Front}}', backHtml: '{{Front}}' }],
};
const notes = [
  { id: 10, noteTypeId: 1, deckId: 1, values: { Front: 'hello' }, cardIds: [1] },
];

describe('BrowseView', () => {
  it('renders a card per note and fires onDelete', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <BrowseView notes={notes} noteTypesById={{ 1: noteType }}
        onEdit={() => {}} onDelete={onDelete} />
    );
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(10);
  });
});
