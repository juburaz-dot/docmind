// Hybrid retrieval: keyword search (BM25) that works instantly, blended with
// semantic search (embeddings) once they have been computed in the background.

const STOPWORDS = new Set(
  'a an and are as at be by for from has have he her his i in is it its of on or our she that the their them they this to was we were what when where which who why will with you your do does did not can could would should about into than then there these those also any all how if so such been being just more most other some only very'.split(
    ' ',
  ),
);

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

// A tiny suffix stripper so "payments" matches "payment".
function stem(t) {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && t.endsWith('es') && !t.endsWith('ses')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  if (t.length > 5 && t.endsWith('ed')) return t.slice(0, -2);
  return t;
}

export function buildIndex(chunks) {
  const docs = chunks.map((c) => {
    const tokens = tokenize(c.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { chunk: c, tf, len: tokens.length };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLen = docs.reduce((n, d) => n + d.len, 0) / Math.max(docs.length, 1);
  return { docs, df, avgLen, N: docs.length };
}

function bm25Scores(index, query, k1 = 1.4, b = 0.75) {
  const qTokens = [...new Set(tokenize(query))];
  return index.docs.map((d) => {
    let score = 0;
    for (const t of qTokens) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) || 0;
      const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / (index.avgLen || 1))));
    }
    return score;
  });
}

export function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already normalized
}

function normalize(scores) {
  const max = Math.max(...scores, 0);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;
  return scores.map((s) => (s - min) / range);
}

/**
 * @param {object} index      result of buildIndex
 * @param {string} query
 * @param {object} opts       { k, queryVector, vectors: Map<chunkId, number[]> }
 */
export function search(index, query, { k = 6, queryVector = null, vectors = null } = {}) {
  if (!index.docs.length) return [];
  const keyword = normalize(bm25Scores(index, query));
  let semantic = null;
  if (queryVector && vectors) {
    const raw = index.docs.map((d) => {
      const v = vectors.get(d.chunk.id);
      return v ? cosine(queryVector, v) : 0;
    });
    semantic = normalize(raw);
  }
  const scored = index.docs.map((d, i) => ({
    chunk: d.chunk,
    score: semantic ? 0.4 * keyword[i] + 0.6 * semantic[i] : keyword[i],
  }));
  scored.sort((a, b) => b.score - a.score);
  let top = scored.slice(0, k).filter((s) => s.score > 0);
  // If nothing matched (e.g. "summarize this"), fall back to the opening passages.
  if (!top.length) top = index.docs.slice(0, k).map((d) => ({ chunk: d.chunk, score: 0 }));
  return top;
}

/**
 * Picks passages spread evenly through each document, up to a character budget.
 * Used by whole-document tools like Summarize and Quiz.
 */
export function sampleChunks(chunks, budgetChars) {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  if (total <= budgetChars) return { chunks, complete: true };
  const avg = total / chunks.length;
  const count = Math.max(1, Math.floor(budgetChars / avg));
  const step = chunks.length / count;
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(chunks[Math.floor(i * step)]);
  return { chunks: picked, complete: false };
}
