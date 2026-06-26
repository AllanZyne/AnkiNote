import yaml from 'js-yaml';

const FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function fence(lang, content) {
  const text = content ?? '';
  // Find longest run of backticks in content
  const matches = text.match(/`+/g);
  const maxLen = matches ? Math.max(...matches.map(m => m.length)) : 0;
  const fenceLen = Math.max(3, maxLen + 1);
  const tick = '`'.repeat(fenceLen);
  return tick + lang + '\n' + text + '\n' + tick;
}

// Extract the first fenced block of `lang` that appears under "## heading".
function blockUnder(body, heading, lang) {
  const re = new RegExp(`## ${heading}\\s*\\n+(\`{3,})${lang}\\n([\\s\\S]*?)\\n\\1`, 'm');
  const m = re.exec(body);
  return m ? m[2] : '';
}

export function serializeNoteType({ name, fields, templates, css }) {
  const fieldNames = fields.map(f => f.name);
  const t = templates[0] || { frontHtml: '', backHtml: '' };
  const fm = yaml.dump({ name, fields: fieldNames }).trimEnd();
  const body = [
    `## Front\n\n${fence('html', t.frontHtml)}`,
    `## Back\n\n${fence('html', t.backHtml)}`,
    `## CSS\n\n${fence('css', css)}`,
  ].join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

export function parseNoteType(md) {
  const m = FM.exec(md);
  const meta = m ? (yaml.load(m[1]) || {}) : {};
  const body = m ? m[2] : md;
  const fields = (meta.fields || []).map((name, ord) => ({ name, ord }));
  const frontHtml = blockUnder(body, 'Front', 'html');
  const backHtml = blockUnder(body, 'Back', 'html');
  const css = blockUnder(body, 'CSS', 'css');
  return {
    name: meta.name,
    fields,
    templates: [{ name: 'Card 1', frontHtml, backHtml, ord: 0 }],
    css,
  };
}
