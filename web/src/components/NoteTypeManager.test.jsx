import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteTypeManager from './NoteTypeManager.jsx';

describe('NoteTypeManager', () => {
  it('builds a note type payload and saves it', () => {
    const onSave = vi.fn();
    render(<NoteTypeManager initial={null} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vocab' } });
    fireEvent.click(screen.getByText('Add field'));
    const fieldInputs = screen.getAllByPlaceholderText('Field name');
    fireEvent.change(fieldInputs[0], { target: { value: 'Term' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalled();
    const payload = onSave.mock.calls[0][0];
    expect(payload.name).toBe('Vocab');
    expect(payload.fields[0].name).toBe('Term');
    expect(payload.templates).toHaveLength(1);
  });
});
