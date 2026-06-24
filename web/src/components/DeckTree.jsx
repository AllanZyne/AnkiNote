import React from 'react';

function nodesOf(decks, parentId) {
  return decks.filter(d => d.parentId === parentId);
}

function DeckNode({ deck, decks, activeId, onSelect, depth }) {
  const children = nodesOf(decks, deck.id);
  return (
    <div>
      <div
        className={`deck-node${deck.id === activeId ? ' active' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(deck.id)}
      >
        {deck.name}
      </div>
      {children.map(c => (
        <DeckNode key={c.id} deck={c} decks={decks}
          activeId={activeId} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DeckTree({ decks, activeId, onSelect }) {
  return (
    <div>
      {nodesOf(decks, null).map(d => (
        <DeckNode key={d.id} deck={d} decks={decks}
          activeId={activeId} onSelect={onSelect} depth={0} />
      ))}
    </div>
  );
}
