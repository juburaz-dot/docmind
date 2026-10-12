import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { linkCitations } from '../lib/citations.js';

export default function Markdown({ text, sources = [], docsById, onCite, plain = false }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children, ...props }) {
          if (href?.startsWith('#cite-')) {
            const n = Number(href.slice(6));
            const src = sources[n - 1];
            if (!src) return <sup className="text-muted">[{n}]</sup>;
            const doc = docsById?.get(src.docId);
            const label = `${doc?.name || 'Document'}, ${doc?.kind === 'pdf' ? 'page' : 'section'} ${src.page}`;
            if (plain) return <span className="cite">[{n}]</span>;
            return (
              <button
                type="button"
                onClick={() => onCite?.(src)}
                title={`Open ${label}`}
                aria-label={`Source ${n}: ${label}`}
                className="cite mx-0.5 inline-flex -translate-y-px items-center rounded bg-cobalt/15 px-1.5 py-px align-baseline font-sans text-[11px] font-semibold leading-4 text-cobalt transition-colors hover:bg-cobalt hover:text-white dark:hover:text-[#0c1020]"
              >
                {n}
              </button>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          );
        },
      }}
    >
      {linkCitations(text)}
    </ReactMarkdown>
  );
}
