import React, { useState } from 'react';

const DEFAULT_TEMPLATE = {
  name: 'Card 1', frontHtml: '{{Front}}', backHtml: '{{Front}}\n<hr>\n{{Back}}',
};

export default function NoteTypeManager({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [css, setCss] = useState(initial?.css ?? '.card { font-size: 20px; text-align: center; }');
  const [fields, setFields] = useState(
    initial?.fields?.map(f => f.name) ?? ['Front', 'Back']
  );
  const [tpl, setTpl] = useState(initial?.templates?.[0] ?? DEFAULT_TEMPLATE);

  const setFieldName = (i, val) =>
    setFields(prev => prev.map((f, idx) => (idx === i ? val : f)));
  const addField = () => setFields(prev => [...prev, '']);
  const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i));

  const save = () => onSave({
    name,
    css,
    fields: fields.filter(Boolean).map(n => ({ name: n })),
    templates: [{ name: tpl.name, frontHtml: tpl.frontHtml, backHtml: tpl.backHtml }],
  });

  return (
    <div>
      <h3>{initial ? 'Edit note type' : 'New note type'}</h3>
      <div className="field-row">
        <label htmlFor="nt-name">Name</label>
        <input id="nt-name" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="field-row">
        <label>Fields</label>
        {fields.map((f, i) => (
          <div className="toolbar" key={i}>
            <input placeholder="Field name" value={f}
              onChange={e => setFieldName(i, e.target.value)} />
            <button onClick={() => removeField(i)}>Remove</button>
          </div>
        ))}
        <button onClick={addField}>Add field</button>
      </div>

      <div className="field-row">
        <label htmlFor="nt-front">Front template (HTML, use {'{{Field}}'})</label>
        <textarea id="nt-front" rows={3} value={tpl.frontHtml}
          onChange={e => setTpl({ ...tpl, frontHtml: e.target.value })} />
      </div>
      <div className="field-row">
        <label htmlFor="nt-back">Back template (HTML)</label>
        <textarea id="nt-back" rows={3} value={tpl.backHtml}
          onChange={e => setTpl({ ...tpl, backHtml: e.target.value })} />
      </div>
      <div className="field-row">
        <label htmlFor="nt-css">CSS</label>
        <textarea id="nt-css" rows={4} value={css}
          onChange={e => setCss(e.target.value)} />
      </div>

      <div className="toolbar">
        <button onClick={save}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
