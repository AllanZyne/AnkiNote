import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectScreen from './ConnectScreen.jsx';

describe('ConnectScreen', () => {
  it('builds a webdav config with a Basic auth header on submit', () => {
    const onConnect = vi.fn();
    render(<ConnectScreen onConnect={onConnect} />);
    fireEvent.change(screen.getByLabelText('WebDAV URL'), { target: { value: 'https://d/dav' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'p' } });
    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('u:p'),
    }));
  });

  it('offers a demo (in-memory) option', () => {
    const onConnect = vi.fn();
    render(<ConnectScreen onConnect={onConnect} />);
    fireEvent.click(screen.getByText('Try demo (in-memory)'));
    expect(onConnect).toHaveBeenCalledWith({ type: 'memory' });
  });
});
