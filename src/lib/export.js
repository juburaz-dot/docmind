// Export a conversation as Markdown or as a print-ready PDF.

function sourcesLine(msg, docsById) {
  if (!msg.sources?.length) return '';
  const list = msg.sources
    .map((s, i) => `[${i + 1}] ${docsById.get(s.docId)?.name || 'document'}, p. ${s.page}`)
    .join('  \n');
  return `\n\n<sub>Sources:  \n${list}</sub>`;
}

export function chatToMarkdown(chat, docsById) {
  const lines = [`# ${chat.title}`, '', `_Exported from DocMind on ${new Date().toLocaleString()}_`, ''];
  for (const m of chat.messages) {
    if (m.role === 'user') lines.push(`## 🧑 ${m.content}`, '');
    else lines.push(m.content + sourcesLine(m, docsById), '');
  }
  return lines.join('\n');
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name) {
  return (name || 'chat').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'chat';
}

export function exportMarkdown(chat, docsById) {
  download(`${safeFilename(chat.title)}.md`, chatToMarkdown(chat, docsById), 'text/markdown');
}

/** Opens the rendered chat in a print window; the browser's "Save as PDF" does the rest. */
export function exportPdf(chat, renderedHtml) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups for this site to export a PDF.');
  const title = String(chat.title).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1b2430;line-height:1.6}
  h1{font-family:system-ui,sans-serif;font-size:24px;margin-bottom:4px}
  .meta{color:#667;font:13px system-ui,sans-serif;margin-bottom:32px}
  .q{font:600 15px system-ui,sans-serif;margin:28px 0 8px;padding-top:16px;border-top:1px solid #dde}
  .src{font:12px system-ui,sans-serif;color:#667;margin-top:8px}
  table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:4px 8px}
  .cite{font:600 11px system-ui,sans-serif;color:#2f4bd8;vertical-align:super}
  details{display:block}summary{font-weight:600}
</style></head><body><h1>${title}</h1><div class="meta">Exported from DocMind · ${new Date().toLocaleString()}</div>${renderedHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
