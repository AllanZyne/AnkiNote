import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectDialog from './ConnectDialog.jsx';

describe('ConnectDialog', () => {
  it('builds a webdav config with a Basic auth header on submit', () => {
    const onConnect = vi.fn();
    render(<ConnectDialog onConnect={onConnect} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('WebDAV URL'), { target: { value: 'https://d/dav' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'p' } });
    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('u:p'),
    }));
  });

  it('offers a local-only option', () => {
    const onConnect = vi.fn();
    render(<ConnectDialog onConnect={onConnect} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use local-only'));
    expect(onConnect).toHaveBeenCalledWith({ type: 'memory' });
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<ConnectDialog onConnect={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the dialog', () => {
    const onClose = vi.fn();
    render(<ConnectDialog onConnect={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Connect to your WebDAV vault'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders an error message when the error prop is set', () => {
    render(<ConnectDialog onConnect={() => {}} onClose={() => {}} error="boom CORS headers" />);
    expect(screen.getByRole('alert').textContent).toMatch(/CORS headers/);
  });

  it('pre-fills URL and username from an initial webdav config, password blank', () => {
    const initial = { type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('alice:secret') };
    render(<ConnectDialog onConnect={() => {}} onClose={() => {}} initial={initial} />);
    expect(screen.getByLabelText('WebDAV URL').value).toBe('https://d/dav');
    expect(screen.getByLabelText('Username').value).toBe('alice');
    expect(screen.getByLabelText('Password').value).toBe('');
  });

  it('reuses the saved authHeader when password is left blank', () => {
    const onConnect = vi.fn();
    const initial = { type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('alice:secret') };
    render(<ConnectDialog onConnect={onConnect} onClose={() => {}} initial={initial} />);
    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({
      type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('alice:secret'),
    }));
  });

  it('rebuilds the authHeader when a new password is typed', () => {
    const onConnect = vi.fn();
    const initial = { type: 'webdav', baseUrl: 'https://d/dav', authHeader: 'Basic ' + btoa('alice:secret') };
    render(<ConnectDialog onConnect={onConnect} onClose={() => {}} initial={initial} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'newpass' } });
    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({
      authHeader: 'Basic ' + btoa('alice:newpass'),
    }));
  });
});
