import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronUp, ChevronDown, X, BookOpen } from 'lucide-react';
import { IconButton, cx } from './ui.jsx';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-cobalt/20 text-inherit">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

export default function DocumentViewer({ doc, focus, onClose }) {
  const scroller = useRef(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);

  const pages = useMemo(() => {
    const map = new Map();
    for (const c of doc?.chunks || []) {
      if (!map.has(c.page)) map.set(c.page, []);
      map.get(c.page).push(c);
    }
    return [...map.entries()];
  }, [doc]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !doc) return [];
    return doc.chunks.filter((c) => c.text.toLowerCase().includes(q)).map((c) => c.id);
  }, [query, doc]);

  // Scroll to a cited passage.
  useEffect(() => {
    if (!focus?.chunkId) return;
    const el = scroller.current?.querySelector(`[data-chunk="${CSS.escape(focus.chunkId)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  // Scroll to the current search match.
  useEffect(() => {
    const id = matches[matchIdx];
    if (!id) return;
    scroller.current?.querySelector(`[data-chunk="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matches, matchIdx]);

  useEffect(() => {
    setQuery('');
    setFindOpen(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [doc?.id]);

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted">
        <BookOpen size={28} strokeWidth={1.5} />
        <p className="max-w-xs text-sm">Pick a document on the left to read it here. Citations in answers open the exact passage.</p>
      </div>
    );
  }

  const q = query.trim().length >= 2 ? query.trim() : '';
  const step = (d) => setMatchIdx((i) => (matches.length ? (i + d + matches.length) % matches.length : 0));

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-line/70 px-4">
        {findOpen ? (
          <div className="flex flex-1 items-center gap-1">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMatchIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
                if (e.key === 'Escape') setFindOpen(false);
              }}
              placeholder="Find in document"
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
            />
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {query.trim().length >= 2 ? `${matches.length ? matchIdx + 1 : 0}/${matches.length}` : ''}
            </span>
            <IconButton label="Previous match" className="h-8 w-8" onClick={() => step(-1)} disabled={!matches.length}>
              <ChevronUp size={16} />
            </IconButton>
            <IconButton label="Next match" className="h-8 w-8" onClick={() => step(1)} disabled={!matches.length}>
              <ChevronDown size={16} />
            </IconButton>
            <IconButton
              label="Close search"
              className="h-8 w-8"
              onClick={() => {
                setFindOpen(false);
                setQuery('');
              }}
            >
              <X size={16} />
            </IconButton>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{doc.name}</h2>
            </div>
            <IconButton label="Find in document" className="h-8 w-8" onClick={() => setFindOpen(true)}>
              <Search size={16} />
            </IconButton>
            {onClose && (
              <IconButton label="Close document" className="h-8 w-8" onClick={onClose}>
                <X size={16} />
              </IconButton>
            )}
          </>
        )}
      </div>

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-6">
        <div className="mx-auto max-w-[68ch] space-y-5">
          {pages.map(([num, chunks]) => (
            <section key={num} className="rounded-lg bg-sheet px-6 py-7 shadow-sheet sm:px-10 sm:py-9" aria-label={`Page ${num}`}>
              <div className="font-serif text-[16px] leading-[1.75] text-ink/90">
                {chunks.map((c) => {
                  const cited = focus?.chunkId === c.id;
                  const isMatch = matches[matchIdx] === c.id;
                  return (
                    <p
                      key={c.id}
                      data-chunk={c.id}
                      className={cx('mb-4 whitespace-pre-line last:mb-0', isMatch && 'rounded outline outline-2 outline-offset-4 outline-cobalt/40')}
                    >
                      {c.text.split(/\n{2,}/).map((para, i) => {
                        const heading = /^#{1,6}\s+/.test(para);
                        const body = heading ? para.replace(/^#{1,6}\s+/, '') : para;
                        const content = <HighlightedText text={body} query={q} />;
                        return (
                          <span key={i} className={cx('block', i > 0 && 'mt-4', heading && 'font-sans text-[15px] font-semibold text-ink')}>
                            {cited ? (
                              <span key={focus.nonce} className="marker marker-sweep">
                                {content}
                              </span>
                            ) : (
                              content
                            )}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}
              </div>
              <div className="mt-6 text-right text-xs tabular-nums text-muted">
                {doc.kind === 'pdf' ? 'Page' : 'Section'} {num} of {doc.pageCount}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
