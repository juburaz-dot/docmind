// Turns an uploaded File into plain text, split into pages.
// Everything happens locally in the browser.

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown'];
export const MAX_FILE_MB = 60;

export function fileKind(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.txt')) return 'txt';
  return null;
}

let pdfjsPromise;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

async function parsePdf(file, onProgress) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
    }
    pages.push({ num: i, text: cleanText(text) });
    onProgress?.(i / pdf.numPages);
  }
  await (task.destroy?.() ?? pdf.cleanup?.());
  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  if (totalChars < 20) {
    throw new Error(
      'This PDF has no selectable text. It is probably a scanned image. Run it through OCR first, then upload it again.',
    );
  }
  return pages;
}

async function parseDocx(file) {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return splitIntoPseudoPages(cleanText(value));
}

async function parseText(file) {
  return splitIntoPseudoPages(cleanText(await file.text()));
}

// Word and text files have no real pages, so we group paragraphs into
// sections of roughly one printed page (~3,000 characters).
export function splitIntoPseudoPages(text, pageSize = 3000) {
  const paragraphs = text.split(/\n{2,}/);
  const pages = [];
  let current = '';
  for (const p of paragraphs) {
    if (current && current.length + p.length > pageSize) {
      pages.push(current.trim());
      current = '';
    }
    current += p + '\n\n';
  }
  if (current.trim()) pages.push(current.trim());
  if (!pages.length) throw new Error('This file is empty.');
  return pages.map((t, i) => ({ num: i + 1, text: t }));
}

export function cleanText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2') // re-join hyphenated line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parseFile(file, onProgress) {
  const kind = fileKind(file.name);
  if (!kind) throw new Error(`"${file.name}" is not supported. Use PDF, Word (.docx), TXT or Markdown.`);
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" is larger than ${MAX_FILE_MB} MB.`);
  }
  let pages;
  if (kind === 'pdf') pages = await parsePdf(file, onProgress);
  else if (kind === 'docx') pages = await parseDocx(file);
  else pages = await parseText(file);
  onProgress?.(1);
  return { kind, pages };
}
