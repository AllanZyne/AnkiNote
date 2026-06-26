import React, { useEffect, useState } from 'react';

const LABEL = { synced: 'Synced', syncing: 'Syncing…', offline: 'Offline', error: 'Sync error' };

export default function SyncStatus({ engine }) {
  const [status, setStatus] = useState(engine.getStatus());
  useEffect(() => engine.subscribe(setStatus), [engine]);

  const base = LABEL[status.state] ?? status.state;
  const text = status.pending > 0 ? `${base} (${status.pending})` : base;
  const OFFLINE_HINT = "Couldn't reach the vault — the server may be down or not sending CORS headers for this site.";
  const title = status.state === 'offline'
    ? OFFLINE_HINT
    : (status.lastSyncedAt ? `Last synced ${status.lastSyncedAt}` : 'Not synced yet');

  return (
    <span className={`sync-status sync-${status.state}`} title={title} aria-label={`Sync status: ${base}`}>
      {text}
    </span>
  );
}
