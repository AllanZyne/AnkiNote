import yaml from 'js-yaml';

const FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function serializeNote({ id, noteType, created, modified, fields = {} }) {
  const fm = yaml.dump({ id, noteType, created, modified }).trimEnd();
  const body = Object.entries(fields)
    .map(([name, value]) => `## ${name}\n\n${value ?? ''}`)
    .join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

export function parseNote(md) {
  const m = FM.exec(md);
  const meta = m ? (yaml.load(m[1]) || {}) : {};
  const body = m ? m[2] : md;
  const fields = {};
  // Split on "## Heading" lines, keep order.
  const parts = body.split(/^## (.+)$/m);
  // parts[0] is preamble (ignored); then [name, content, name, content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim();
    const content = (parts[i + 1] ?? '').replace(/^\n+/, '').replace(/\n+$/, '');
    fields[name] = content;
  }
  return { id: meta.id, noteType: meta.noteType, created: meta.created, modified: meta.modified, fields };
}
