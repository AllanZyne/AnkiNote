import { describe, it, expect } from 'vitest';
import { serializeNote, parseNote } from './note.js';

const note = {
  id: 'abc', noteType: 'Basic',
  created: '2026-06-26T10:00:00.000+08:00', modified: '2026-06-26T10:00:00.000+08:00',
  fields: { Front: 'hola', Back: 'hello\n\nmulti-line' },
};

describe('note format', () => {
  it('serializes frontmatter + ## sections', () => {
    const md = serializeNote(note);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('id: abc');
    expect(md).toContain('noteType: Basic');
    expect(md).toContain('## Front');
    expect(md).toContain('hola');
    expect(md).toContain('## Back');
  });

  it('round-trips through parse', () => {
    const parsed = parseNote(serializeNote(note));
    expect(parsed.id).toBe('abc');
    expect(parsed.noteType).toBe('Basic');
    expect(parsed.fields.Front).toBe('hola');
    expect(parsed.fields.Back).toBe('hello\n\nmulti-line');
  });

  it('tolerates a body with no sections', () => {
    const md = '---\nid: x\nnoteType: Basic\n---\n';
    expect(parseNote(md).fields).toEqual({});
  });

  it('preserves field order', () => {
    const parsed = parseNote(serializeNote(note));
    expect(Object.keys(parsed.fields)).toEqual(['Front', 'Back']);
  });
});
