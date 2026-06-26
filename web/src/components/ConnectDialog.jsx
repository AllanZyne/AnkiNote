import React, { useState } from 'react';

function decodeUser(authHeader) {
  try { return atob(String(authHeader).replace(/^Basic /, '')).split(':')[0] || ''; }
  catch { return ''; }
}

export default function ConnectDialog({ onConnect, onClose, error, initial }) {
  const webdav = initial?.type === 'webdav' ? initial : null;
  const [baseUrl, setBaseUrl] = useState(webdav?.baseUrl ?? '');
  const [user, setUser] = useState(webdav ? decodeUser(webdav.authHeader) : '');
  const [pass, setPass] = useState('');

  const connect = (e) => {
    e.preventDefault();
    const authHeader = pass !== ''
      ? 'Basic ' + btoa(`${user}:${pass}`)
      : (webdav?.authHeader ?? 'Basic ' + btoa(`${user}:`));
    onConnect({ type: 'webdav', baseUrl, authHeader });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal connect-dialog" onClick={e => e.stopPropagation()}>
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Connect to your WebDAV vault</h2>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <form onSubmit={connect}>
          <label>WebDAV URL
            <input aria-label="WebDAV URL" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://dav.example.com/remote.php/dav/files/me/ankinote" />
          </label>
          <label>Username
            <input aria-label="Username" value={user} onChange={e => setUser(e.target.value)} />
          </label>
          <label>Password
            <input aria-label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder={webdav ? 'leave blank to keep current password' : ''} />
          </label>
          <div className="toolbar">
            <button type="submit">Connect</button>
            <button type="button" onClick={() => onConnect({ type: 'memory' })}>Use local-only</button>
          </div>
        </form>
      </div>
    </div>
  );
}
