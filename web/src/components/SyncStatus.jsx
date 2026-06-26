import React, { useEffect, useState } from 'react';

const LABEL = { local: 'Local', synced: 'Synced', syncing: 'Syncing…', offline: 'Offline', error: 'Sync error' };

export default function SyncStatus({ engine }) {
  const [status, setStatus] = useState(engine.getStatus());
  useEffect(() => engine.subscribe(setStatus), [engine]);

  const base = LABEL[status.state] ?? status.state;
  const text = status.pending > 0 ? `${base} (${status.pending})` : base;
  const OFFLINE_HINT = "Couldn't reach the vault — the server may be down or not sending CORS headers for this site.";
  const ERROR_HINT = "The vault server rejected the request — check your credentials or the server logs.";
  const LOCAL_HINT = 'Local-only — not connected to a vault. Connect to sync.';
  const title = status.state === 'local' ? LOCAL_HINT
    : status.state === 'offline' ? OFFLINE_HINT
    : status.state === 'error' ? ERROR_HINT
    : (status.lastSyncedAt ? `Last synced ${status.lastSyncedAt}` : 'Not synced yet');

  return (
    <span className={`sync-status sync-${status.state}`} title={title} aria-label={`Sync status: ${base}`}>
      {text}
    </span>
  );
}
