import { describe, it, expect } from 'vitest';
import { renderMarkdown, substitute, renderCardSides, buildSrcDoc } from './render.js';

describe('render', () => {
  it('renders markdown to html', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
  });

  it('substitutes field placeholders', () => {
    expect(substitute('{{A}} and {{B}}', { A: 'x', B: 'y' })).toBe('x and y');
  });

  it('treats missing fields as empty', () => {
    expect(substitute('{{A}}{{Missing}}', { A: 'x' })).toBe('x');
  });

  it('renders both card sides through the pipeline', () => {
    const sides = renderCardSides({
      noteType: { css: '' },
      template: { frontHtml: '{{Front}}', backHtml: '{{Front}}<hr>{{Back}}' },
      values: { Front: '*q*', Back: '*a*' },
    });
    expect(sides.front).toContain('<em>q</em>');
    expect(sides.back).toContain('<em>a</em>');
  });

  it('builds a full srcdoc embedding css and html', () => {
    const doc = buildSrcDoc({ css: '.card{color:red}', html: '<p>hi</p>' });
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('.card{color:red}');
    expect(doc).toContain('<p>hi</p>');
  });
});
