import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteEditor from './NoteEditor.jsx';

const noteType = {
  id: 1, name: 'Basic', css: '',
  fields: [{ id: 1, name: 'Front', ord: 0 }, { id: 2, name: 'Back', ord: 1 }],
  templates: [{ id: 1, name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Back}}' }],
};

describe('NoteEditor', () => {
  it('renders a field per note-type field and submits values', () => {
    const onSubmit = vi.fn();
    render(<NoteEditor noteType={noteType} initialValues={{}} onSubmit={onSubmit} onCancel={() => {}} />);
    const front = screen.getByLabelText('Front');
    const back = screen.getByLabelText('Back');
    fireEvent.change(front, { target: { value: 'hola' } });
    fireEvent.change(back, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit).toHaveBeenCalledWith({ Front: 'hola', Back: 'hello' });
  });
});
