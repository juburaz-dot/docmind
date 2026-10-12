// Turn "[1]" or "[2, 3]" in model output into links the renderer can intercept.
export function linkCitations(text) {
  return text.replace(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\](?!\()/g, (_, nums) =>
    nums
      .split(/[,;]/)
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join(''),
  );
}

/** Numbers of the passages an answer cites, e.g. "see [1][3]" -> Set{1,3}. */
export function citedNumbers(text) {
  const out = new Set();
  for (const m of text.matchAll(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\](?!\()/g)) {
    for (const n of m[1].split(/[,;]/)) out.add(Number(n.trim()));
  }
  return out;
}
