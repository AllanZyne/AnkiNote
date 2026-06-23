import React, { useState } from 'react';
import Card from './Card.jsx';

export default function NoteEditor({ noteType, initialValues = {}, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of noteType.fields) v[f.name] = initialValues[f.name] ?? '';
    return v;
  });

  const setField = (name, val) => setValues(prev => ({ ...prev, [name]: val }));

  return (
    <div>
      <h3>{noteType.name}</h3>
      {noteType.fields.map(f => (
        <div className="field-row" key={f.id}>
          <label htmlFor={`f-${f.id}`}>{f.name}</label>
          <textarea
            id={`f-${f.id}`}
            rows={3}
            value={values[f.name]}
            onChange={e => setField(f.name, e.target.value)}
          />
        </div>
      ))}
      <div className="preview-pair">
        <Card noteType={noteType} template={noteType.templates[0]} values={values} />
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button onClick={() => onSubmit(values)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
