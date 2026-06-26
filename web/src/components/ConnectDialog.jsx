import React, { useState } from 'react';

export default function ConnectDialog({ onConnect, onClose }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const connect = (e) => {
    e.preventDefault();
    onConnect({ type: 'webdav', baseUrl, authHeader: 'Basic ' + btoa(`${user}:${pass}`) });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal connect-dialog" onClick={e => e.stopPropagation()}>
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Connect to your WebDAV vault</h2>
        <form onSubmit={connect}>
          <label>WebDAV URL
            <input aria-label="WebDAV URL" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://dav.example.com/remote.php/dav/files/me/ankinote" />
          </label>
          <label>Username
            <input aria-label="Username" value={user} onChange={e => setUser(e.target.value)} />
          </label>
          <label>Password
            <input aria-label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} />
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
