import React from 'react';
import DeckMenu from './DeckMenu.jsx';
import { buildDeckTree } from '../lib/deckTree.js';

function DeckNode({ node, activeId, onSelect, actions, depth }) {
  const real = node.deck;
  const cls = `deck-node${real && real.id === activeId ? ' active' : ''}${node.archived ? ' archived' : ''}`;
  return (
    <div>
      <div
        className={cls}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => real && onSelect(real.id)}
      >
        <span className="deck-name">{node.segment}</span>
        {real && (
          <DeckMenu
            deck={real}
            onRename={actions.onRename}
            onTogglePin={actions.onTogglePin}
            onToggleArchive={actions.onToggleArchive}
            onDelete={actions.onDelete}
          />
        )}
      </div>
      {node.children.map(c => (
        <DeckNode key={c.path} node={c} activeId={activeId}
          onSelect={onSelect} actions={actions} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DeckTree({
  decks, activeId, onSelect, onRename, onTogglePin, onToggleArchive, onDelete,
}) {
  const actions = { onRename, onTogglePin, onToggleArchive, onDelete };
  const tree = buildDeckTree(decks);
  return (
    <div>
      {tree.map(n => (
        <DeckNode key={n.path} node={n} activeId={activeId}
          onSelect={onSelect} actions={actions} depth={0} />
      ))}
    </div>
  );
}
