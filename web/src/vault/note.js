import yaml from 'js-yaml';

const FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function serializeNote({ id, noteType, created, modified, fields = {} }) {
  const fm = yaml.dump({ id, noteType, created, modified }).trimEnd();
  const body = Object.entries(fields)
    .map(([name, value]) => `<!-- field: ${name} -->\n${value ?? ''}`)
    .join('\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

export function parseNote(md) {
  const m = FM.exec(md);
  const meta = m ? (yaml.load(m[1]) || {}) : {};
  const body = m ? m[2] : md;
  const fields = {};
  // Split on "<!-- field: NAME -->" delimiter lines
  const parts = body.split(/^<!-- field: (.+?) -->$/m);
  // parts[0] is preamble (ignored); then [name, content, name, content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim();
    let content = parts[i + 1] ?? '';
    // Strip exactly one leading newline (structural delimiter)
    if (content.startsWith('\n')) content = content.slice(1);
    // Strip exactly one trailing newline if there's another field OR if we're at the end
    if (content.endsWith('\n')) {
      // Always strip the last trailing newline (either separator before next field, or file-end newline)
      content = content.slice(0, -1);
    }
    fields[name] = content;
  }
  return { id: meta.id, noteType: meta.noteType, created: meta.created, modified: meta.modified, fields };
}
