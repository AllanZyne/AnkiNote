import { describe, it, expect } from 'vitest';
import { serializeNoteType, parseNoteType } from './noteType.js';

const nt = {
  name: 'Basic',
  fields: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
  templates: [{ name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}<hr>{{Back}}', ord: 0 }],
  css: '.card { font-size: 20px; }',
};

describe('note-type format', () => {
  it('serializes frontmatter fields + fenced html/css', () => {
    const md = serializeNoteType(nt);
    expect(md).toContain('name: Basic');
    expect(md).toContain('```html');
    expect(md).toContain('{{Front}}');
    expect(md).toContain('```css');
    expect(md).toContain('.card { font-size: 20px; }');
  });

  it('round-trips', () => {
    const p = parseNoteType(serializeNoteType(nt));
    expect(p.name).toBe('Basic');
    expect(p.fields.map(f => f.name)).toEqual(['Front', 'Back']);
    expect(p.templates[0].frontHtml).toBe('{{Front}}');
    expect(p.templates[0].backHtml).toBe('{{Front}}<hr>{{Back}}');
    expect(p.css).toBe('.card { font-size: 20px; }');
  });

  it('round-trips frontHtml containing nested ``` fence', () => {
    const n = {
      name: 'Code',
      fields: [{ name: 'Front', ord: 0 }],
      templates: [{
        name: 'Card 1',
        frontHtml: 'before\n```js\nconst x = 1;\n```\nafter',
        backHtml: 'back',
        ord: 0,
      }],
      css: '',
    };
    const p = parseNoteType(serializeNoteType(n));
    expect(p.templates[0].frontHtml).toBe('before\n```js\nconst x = 1;\n```\nafter');
  });

  it('round-trips css containing ``` run', () => {
    const n = {
      name: 'Code',
      fields: [{ name: 'Front', ord: 0 }],
      templates: [{ name: 'Card 1', frontHtml: 'f', backHtml: 'b', ord: 0 }],
      css: '/* comment with ``` fence marker */',
    };
    const p = parseNoteType(serializeNoteType(n));
    expect(p.css).toBe('/* comment with ``` fence marker */');
  });
});
