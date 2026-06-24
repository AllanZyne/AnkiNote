import React from 'react';
import DeckMenu from './DeckMenu.jsx';

function rank(deck) {
  if (deck.archived) return 2;
  if (deck.pinned) return 0;
  return 1;
}

function sortedChildren(decks, parentId) {
  return decks
    .filter(d => d.parentId === parentId)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function DeckNode({ deck, decks, activeId, onSelect, actions, depth }) {
  const children = sortedChildren(decks, deck.id);
  const cls = `deck-node${deck.id === activeId ? ' active' : ''}${deck.archived ? ' archived' : ''}`;
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(deck.id)}
      >
        <span className="deck-name">{deck.name}</span>
        <DeckMenu
          deck={deck}
          onRename={actions.onRename}
          onTogglePin={actions.onTogglePin}
          onToggleArchive={actions.onToggleArchive}
          onDelete={actions.onDelete}
        />
      </div>
      {children.map(c => (
        <DeckNode key={c.id} deck={c} decks={decks}
          activeId={activeId} onSelect={onSelect} actions={actions} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DeckTree({
  decks, activeId, onSelect, onRename, onTogglePin, onToggleArchive, onDelete,
}) {
  const actions = { onRename, onTogglePin, onToggleArchive, onDelete };
  return (
    <div>
      {sortedChildren(decks, null).map(d => (
        <DeckNode key={d.id} deck={d} decks={decks}
          activeId={activeId} onSelect={onSelect} actions={actions} depth={0} />
      ))}
    </div>
  );
}
