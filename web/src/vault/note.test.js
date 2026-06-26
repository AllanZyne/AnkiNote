import { describe, it, expect } from 'vitest';
import { serializeNote, parseNote } from './note.js';

const note = {
  id: 'abc', noteType: 'Basic',
  created: '2026-06-26T10:00:00.000+08:00', modified: '2026-06-26T10:00:00.000+08:00',
  fields: { Front: 'hola', Back: 'hello\n\nmulti-line' },
};

describe('note format', () => {
  it('serializes frontmatter + field comment delimiters', () => {
    const md = serializeNote(note);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('id: abc');
    expect(md).toContain('noteType: Basic');
    expect(md).toContain('<!-- field: Front -->');
    expect(md).toContain('hola');
    expect(md).toContain('<!-- field: Back -->');
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

  it('round-trips field value containing "## NotAHeading" line', () => {
    const n = {
      id: 'x', noteType: 'Basic',
      created: '2026-06-26T10:00:00Z', modified: '2026-06-26T10:00:00Z',
      fields: { Back: 'line1\n## NotAHeading\nline2' },
    };
    const parsed = parseNote(serializeNote(n));
    expect(parsed.fields.Back).toBe('line1\n## NotAHeading\nline2');
  });

  it('round-trips field value with leading AND trailing blank lines', () => {
    const n = {
      id: 'x', noteType: 'Basic',
      created: '2026-06-26T10:00:00Z', modified: '2026-06-26T10:00:00Z',
      fields: { Front: '\n\ncontent\n\n' },
    };
    const parsed = parseNote(serializeNote(n));
    expect(parsed.fields.Front).toBe('\n\ncontent\n\n');
  });

  it('round-trips field value containing "---"', () => {
    const n = {
      id: 'x', noteType: 'Basic',
      created: '2026-06-26T10:00:00Z', modified: '2026-06-26T10:00:00Z',
      fields: { Back: 'before\n---\nafter' },
    };
    const parsed = parseNote(serializeNote(n));
    expect(parsed.fields.Back).toBe('before\n---\nafter');
  });

  it('round-trips multiple fields with adversarial content', () => {
    const n = {
      id: 'x', noteType: 'Basic',
      created: '2026-06-26T10:00:00Z', modified: '2026-06-26T10:00:00Z',
      fields: {
        Front: '\nstart',
        Middle: '## FakeSection\ncontent',
        Back: 'end\n',
      },
    };
    const parsed = parseNote(serializeNote(n));
    expect(parsed.fields.Front).toBe('\nstart');
    expect(parsed.fields.Middle).toBe('## FakeSection\ncontent');
    expect(parsed.fields.Back).toBe('end\n');
    expect(Object.keys(parsed.fields)).toEqual(['Front', 'Middle', 'Back']);
  });
});
