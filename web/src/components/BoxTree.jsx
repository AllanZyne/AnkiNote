import React from 'react';

function nodesOf(boxes, parentId) {
  return boxes.filter(b => b.parentId === parentId);
}

function BoxNode({ box, boxes, activeId, onSelect, depth }) {
  const children = nodesOf(boxes, box.id);
  return (
    <div>
      <div
        className={`box-node${box.id === activeId ? ' active' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(box.id)}
      >
        {box.name}
      </div>
      {children.map(c => (
        <BoxNode key={c.id} box={c} boxes={boxes}
          activeId={activeId} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function BoxTree({ boxes, activeId, onSelect }) {
  return (
    <div>
      {nodesOf(boxes, null).map(b => (
        <BoxNode key={b.id} box={b} boxes={boxes}
          activeId={activeId} onSelect={onSelect} depth={0} />
      ))}
    </div>
  );
}
