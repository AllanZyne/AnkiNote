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

  it('renders inline LaTeX with $...$', () => {
    const html = renderMarkdown('area is $\\pi r^2$');
    expect(html).toContain('katex');
    expect(html).not.toContain('$');
  });

  it('renders display LaTeX with $$...$$', () => {
    const html = renderMarkdown('$$\\int_0^1 x^2\\,dx$$');
    expect(html).toContain('katex-display');
  });

  it('leaves a bare dollar sign untouched', () => {
    expect(renderMarkdown('it costs $5 today')).toContain('$5');
  });

  it('does not throw on invalid LaTeX, shows the source', () => {
    const html = renderMarkdown('$\\frac{1}{$');
    expect(typeof html).toBe('string');
  });

  it('embeds the KaTeX stylesheet (with inlined fonts) in srcdoc', () => {
    const doc = buildSrcDoc({ css: '', html: '<p>x</p>' });
    expect(doc).toContain('.katex');
    expect(doc).toContain('data:font/woff2;base64,');
  });
});
