import React, { useState } from 'react';

export default function ConnectScreen({ onConnect }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const connect = (e) => {
    e.preventDefault();
    onConnect({ type: 'webdav', baseUrl, authHeader: 'Basic ' + btoa(`${user}:${pass}`) });
  };

  return (
    <div className="connect-screen">
      <h1>AnkiNote</h1>
      <p>Connect to your WebDAV vault.</p>
      <form onSubmit={connect}>
        <label>WebDAV URL<input aria-label="WebDAV URL" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://dav.example.com/remote.php/dav/files/me/ankinote" /></label>
        <label>Username<input aria-label="Username" value={user} onChange={e => setUser(e.target.value)} /></label>
        <label>Password<input aria-label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
        <button type="submit">Connect</button>
      </form>
      <button onClick={() => onConnect({ type: 'memory' })}>Try demo (in-memory)</button>
    </div>
  );
}
