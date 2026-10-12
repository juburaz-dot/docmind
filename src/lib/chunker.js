// Splits page text into non-overlapping passages of a few sentences.
// Each passage remembers its page so answers can cite "page 4".

const TARGET = 700; // characters per passage
const MAX = 1100;

function splitSentences(paragraph) {
  const parts = paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g);
  return parts ? parts.map((s) => s.trim()).filter(Boolean) : [paragraph];
}

export function chunkPages(pages, docId) {
  const chunks = [];
  for (const page of pages) {
    const paragraphs = page.text.split(/\n{2,}|\n(?=[-•*\d]+[.)]?\s)/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
    let buf = '';
    const flush = () => {
      if (buf.trim()) {
        chunks.push({
          id: `${docId}:${chunks.length}`,
          docId,
          index: chunks.length,
          page: page.num,
          text: buf.trim(),
        });
      }
      buf = '';
    };
    for (const para of paragraphs) {
      if (buf.length + para.length <= MAX) {
        buf += (buf ? '\n\n' : '') + para;
        if (buf.length >= TARGET) flush();
        continue;
      }
      flush();
      if (para.length <= MAX) {
        buf = para;
        continue;
      }
      for (const sentence of splitSentences(para)) {
        if (buf.length + sentence.length > MAX) flush();
        if (sentence.length > MAX) {
          for (let i = 0; i < sentence.length; i += MAX) {
            buf = sentence.slice(i, i + MAX);
            flush();
          }
        } else {
          buf += (buf ? ' ' : '') + sentence;
        }
      }
      if (buf.length >= TARGET) flush();
    }
    flush();
  }
  return chunks;
}
