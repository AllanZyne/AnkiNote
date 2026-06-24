import React, { useState, useEffect, useRef } from 'react';

export default function DeckMenu({ deck, onRename, onTogglePin, onToggleArchive, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const run = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn(deck);
  };

  const toggle = (e) => {
    e.stopPropagation();
    setOpen(v => !v);
  };

  return (
    <span className="deck-menu" ref={rootRef}>
      <button className="deck-menu-trigger" aria-label="Deck menu" onClick={toggle}>⋯</button>
      {open && (
        <div className="deck-menu-list">
          <button onClick={run(onRename)}>Rename</button>
          <button onClick={run(onTogglePin)}>{deck.pinned ? 'Unpin' : 'Pin'}</button>
          <button onClick={run(onToggleArchive)}>{deck.archived ? 'Unarchive' : 'Archive'}</button>
          <button onClick={run(onDelete)}>Delete</button>
        </div>
      )}
    </span>
  );
}
