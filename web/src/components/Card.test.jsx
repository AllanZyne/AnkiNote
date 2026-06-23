import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Card from './Card.jsx';

const props = {
  noteType: { css: '' },
  template: { frontHtml: '{{Front}}', backHtml: '{{Back}}' },
  values: { Front: 'front side', Back: 'back side' },
};

describe('Card', () => {
  it('renders an iframe showing the front by default', () => {
    const { container } = render(<Card {...props} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('srcDoc')).toContain('front side');
  });
});
