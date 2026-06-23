import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

export function renderMarkdown(text) {
  return md.render(text ?? '');
}

export function substitute(templateHtml, renderedFields) {
  return templateHtml.replace(/\{\{\s*([\w-]+)\s*\}\}/g,
    (_m, name) => renderedFields[name] ?? '');
}

export function renderCardSides({ template, values }) {
  const rendered = {};
  for (const [name, mdText] of Object.entries(values)) {
    rendered[name] = renderMarkdown(mdText);
  }
  return {
    front: substitute(template.frontHtml, rendered),
    back: substitute(template.backHtml, rendered),
  };
}

export function buildSrcDoc({ css, html }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0}
  .card{padding:20px;font-family:system-ui,sans-serif;cursor:pointer}
  ${css}
</style></head>
<body>
  <div class="card">${html}</div>
  <script>
    document.body.addEventListener('click', () => {
      parent.postMessage({ type: 'flip' }, '*');
    });
  </script>
</body></html>`;
}
