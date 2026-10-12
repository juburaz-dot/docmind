// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanText, splitIntoPseudoPages, fileKind } from '../src/lib/parsers.js';
import { chunkPages } from '../src/lib/chunker.js';
import { buildIndex, search, sampleChunks, tokenize } from '../src/lib/search.js';
import { linkCitations, citedNumbers } from '../src/lib/citations.js';

const lease = readFileSync(new URL('../public/samples/sample-residential-lease.md', import.meta.url), 'utf8');
const pages = splitIntoPseudoPages(cleanText(lease));
const chunks = chunkPages(pages, 'lease');
const index = buildIndex(chunks);

test('detects supported file types', () => {
  assert.equal(fileKind('Report.PDF'), 'pdf');
  assert.equal(fileKind('notes.md'), 'md');
  assert.equal(fileKind('contract.docx'), 'docx');
  assert.equal(fileKind('image.png'), null);
});

test('cleanText joins hyphenated line breaks and collapses spaces', () => {
  assert.equal(cleanText('infor-\nmation   here\r\n\n\n\nnext'), 'information here\n\nnext');
});

test('chunks keep page numbers, stay within size, and lose no text', () => {
  assert.ok(chunks.length > 5);
  for (const c of chunks) {
    assert.ok(c.text.length <= 1100, `chunk too long: ${c.text.length}`);
    assert.ok(c.page >= 1 && c.page <= pages.length);
    assert.equal(c.id, `lease:${c.index}`);
  }
  const words = (s) => s.split(/\s+/).filter(Boolean).length;
  const original = pages.reduce((n, p) => n + words(p.text), 0);
  const chunked = chunks.reduce((n, c) => n + words(c.text), 0);
  assert.equal(chunked, original);
});

test('keyword search finds the right clause', () => {
  const top = search(index, 'What happens if I pay rent late?', { k: 3 });
  assert.match(top[0].chunk.text, /late/i);
  assert.ok(top.some((r) => r.chunk.text.includes('$75')));

  const pets = search(index, 'Can I keep a dog?', { k: 2 });
  assert.match(pets[0].chunk.text, /dog/i);

  const deposit = search(index, 'when is my security deposit returned', { k: 2 });
  assert.match(deposit[0].chunk.text, /21 days/);
});

test('search falls back to opening passages when nothing matches', () => {
  const r = search(index, 'zzzz qqqq', { k: 2 });
  assert.equal(r.length, 2);
  assert.equal(r[0].chunk.index, 0);
});

test('semantic vectors are blended into the ranking', () => {
  const vectors = new Map(chunks.map((c) => [c.id, c.index === 4 ? [1, 0] : [0, 1]]));
  const r = search(index, 'zzzz', { k: 1, queryVector: [1, 0], vectors });
  assert.equal(r[0].chunk.index, 4);
});

test('sampleChunks spreads picks across the document within budget', () => {
  const { chunks: picked, complete } = sampleChunks(chunks, 2000);
  assert.equal(complete, false);
  assert.ok(picked.length >= 2);
  assert.ok(picked[picked.length - 1].index > chunks.length / 2);
  assert.equal(sampleChunks(chunks, 1e9).complete, true);
});

test('tokenize stems plurals and drops stopwords', () => {
  assert.deepEqual(tokenize('The payments are late'), ['payment', 'late']);
});

test('citations become links and are counted', () => {
  assert.equal(linkCitations('Rent is due [1][2, 3].'), 'Rent is due [1](#cite-1)[2](#cite-2)[3](#cite-3).');
  assert.equal(linkCitations('a [link](http://x)'), 'a [link](http://x)');
  assert.deepEqual([...citedNumbers('See [2] and [4; 5].')], [2, 4, 5]);
});
