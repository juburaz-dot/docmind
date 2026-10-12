import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  Square,
  Copy,
  Check,
  RotateCcw,
  Download,
  FileDown,
  Sparkles,
  ListChecks,
  GraduationCap,
  Lightbulb,
  GitCompare,
  AlertTriangle,
  Cpu,
  WandSparkles,
} from 'lucide-react';
import Markdown from './Markdown.jsx';
import { citedNumbers } from '../lib/citations.js';
import { Button, IconButton, ProgressBar, cx } from './ui.jsx';
import { TOOLS, SUGGESTED_QUESTIONS } from '../lib/prompts.js';
import { LOCAL_MODELS } from '../lib/models.js';
import { exportMarkdown, exportPdf } from '../lib/export.js';

const TOOL_ICONS = {
  summarize: Sparkles,
  keypoints: ListChecks,
  quiz: GraduationCap,
  simplify: Lightbulb,
  compare: GitCompare,
};

export default function ChatPanel({ app, onCite, onOpenSettings }) {
  const { activeChat, generating, selectedDocs, docsById } = app;
  const [draft, setDraft] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const scroller = useRef(null);
  const textarea = useRef(null);
  const stick = useRef(true);
  const messages = activeChat?.messages || [];
  const noDocs = selectedDocs.length === 0;

  // Follow the stream unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    stick.current = true;
  }, [activeChat?.id]);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [draft]);

  const send = (text = draft) => {
    if (!text.trim() || generating || noDocs) return;
    stick.current = true;
    app.ask(text);
    setDraft('');
  };

  const tool = (key) => {
    setToolsOpen(false);
    stick.current = true;
    app.runTool(key);
  };

  const doExportPdf = () => {
    setExportOpen(false);
    const html = activeChat.messages
      .map((m) =>
        m.role === 'user'
          ? `<div class="q">${escapeHtml(m.content)}</div>`
          : `<div>${renderToStaticMarkup(<Markdown text={m.content} sources={m.sources} docsById={docsById} plain />)}</div>${
              m.sources?.length
                ? `<div class="src">Sources: ${m.sources
                    .map((s, i) => `[${i + 1}] ${escapeHtml(docsById.get(s.docId)?.name || 'document')} p.${s.page}`)
                    .join(' · ')}</div>`
                : ''
            }`,
      )
      .join('');
    try {
      exportPdf(activeChat, html);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-line/70 px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{activeChat?.title || 'New chat'}</h2>
        {activeChat && messages.length > 0 && (
          <div className="relative">
            <IconButton label="Export chat" className="h-8 w-8" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen}>
              <Download size={16} />
            </IconButton>
            <AnimatePresence>
              {exportOpen && (
                <Popover onClose={() => setExportOpen(false)} className="right-0 top-10 w-52">
                  <MenuItem
                    icon={FileDown}
                    onClick={() => {
                      setExportOpen(false);
                      exportMarkdown(activeChat, docsById);
                    }}
                  >
                    Export as Markdown
                  </MenuItem>
                  <MenuItem icon={FileDown} onClick={doExportPdf}>
                    Export as PDF
                  </MenuItem>
                </Popover>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-[44rem] px-4 py-5 sm:px-6">
          <ModelStatus app={app} onOpenSettings={onOpenSettings} />

          {messages.length === 0 ? (
            <EmptyChat app={app} onAsk={send} onTool={tool} />
          ) : (
            <div className="space-y-7">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <UserMessage key={m.id} msg={m} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    msg={m}
                    docsById={docsById}
                    onCite={onCite}
                    onRetry={() => app.retry(m.id)}
                    canRetry={!generating}
                    onOpenSettings={onOpenSettings}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line/70 bg-paper/80 px-3 pb-3 pt-2.5 backdrop-blur sm:px-5">
        <div className="mx-auto max-w-[44rem]">
          <div className="relative flex items-end gap-1.5 rounded-xl border border-line bg-sheet p-1.5 shadow-sm focus-within:border-cobalt/60">
            <div className="relative">
              <IconButton
                label="Document tools"
                onClick={() => setToolsOpen((o) => !o)}
                disabled={noDocs || generating}
                aria-expanded={toolsOpen}
                className="h-10 w-10"
              >
                <WandSparkles size={18} />
              </IconButton>
              <AnimatePresence>
                {toolsOpen && (
                  <Popover onClose={() => setToolsOpen(false)} className="bottom-12 left-0 w-72">
                    {Object.entries(TOOLS).map(([key, t]) => {
                      const Icon = TOOL_ICONS[key];
                      const disabled = selectedDocs.length < t.minDocs;
                      return (
                        <MenuItem key={key} icon={Icon} onClick={() => tool(key)} disabled={disabled}>
                          <span className="block font-medium">{t.label}</span>
                          <span className="block text-xs text-muted">
                            {disabled ? 'Include at least two documents' : key === 'compare' && selectedDocs.length > 2 ? 'Uses the first two included documents' : t.hint}
                          </span>
                        </MenuItem>
                      );
                    })}
                  </Popover>
                )}
              </AnimatePresence>
            </div>
            <textarea
              ref={textarea}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={noDocs}
              placeholder={noDocs ? 'Include a document to start asking' : 'Ask about your documents…'}
              aria-label="Your question"
              className="scroll-thin max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 outline-none placeholder:text-muted disabled:cursor-not-allowed"
            />
            {generating ? (
              <IconButton label="Stop generating" onClick={app.stop} className="h-10 w-10 bg-ink text-paper hover:bg-ink hover:text-paper">
                <Square size={14} fill="currentColor" />
              </IconButton>
            ) : (
              <IconButton
                label="Send"
                onClick={() => send()}
                disabled={!draft.trim() || noDocs}
                className="h-10 w-10 bg-cobalt text-white hover:bg-cobalt hover:text-white hover:brightness-110 dark:text-[#0c1020] dark:hover:text-[#0c1020]"
              >
                <Send size={16} />
              </IconButton>
            )}
          </div>
          <p className="mt-1.5 px-1 text-center text-[11px] text-muted">
            {app.settings.provider === 'local'
              ? 'Answers are generated on this device. Check important details against the source.'
              : 'Questions and matching passages are sent to the API you configured. Files stay here.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
}

function Popover({ children, onClose, className }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onDown = (e) => !e.target.closest('[data-popover]') && onClose();
    window.addEventListener('keydown', onKey);
    setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);
  return (
    <motion.div
      data-popover
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.14 }}
      className={cx('absolute z-30 rounded-xl border border-line bg-sheet p-1.5 shadow-sheet', className)}
      role="menu"
    >
      {children}
    </motion.div>
  );
}

function MenuItem({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-rail disabled:pointer-events-none disabled:opacity-45"
      {...props}
    >
      <Icon size={16} className="mt-0.5 shrink-0 text-cobalt" />
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function ModelStatus({ app, onOpenSettings }) {
  const { settings, model, gpu } = app;
  if (settings.provider !== 'local') return null;
  const info = LOCAL_MODELS.find((m) => m.key === settings.localModel);

  if (gpu && !gpu.supported) {
    return (
      <Notice tone="warn" icon={AlertTriangle}>
        <p className="font-medium">The on-device AI can’t run in this browser.</p>
        <p className="mt-0.5 text-muted">{gpu.reason} Open DocMind in a recent Chrome or Edge, or use your own API key.</p>
        <Button variant="quiet" className="mt-3" onClick={onOpenSettings}>
          Use an API key
        </Button>
      </Notice>
    );
  }
  if (model.state === 'loading') {
    return (
      <Notice icon={Cpu}>
        <p className="font-medium">Loading {info?.name} on your device…</p>
        <ProgressBar value={model.progress} className="mt-2.5" />
        <p className="mt-2 line-clamp-2 text-xs text-muted">
          {model.text || 'Preparing…'} The first time takes a few minutes; after that it loads from cache.
        </p>
      </Notice>
    );
  }
  if (model.state === 'error') {
    return (
      <Notice tone="warn" icon={AlertTriangle}>
        <p className="font-medium">The model didn’t load.</p>
        <p className="mt-0.5 break-words text-muted">{model.text}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="quiet" onClick={app.loadModel}>
            Try again
          </Button>
          <Button variant="ghost" onClick={onOpenSettings}>
            Pick a smaller model
          </Button>
        </div>
      </Notice>
    );
  }
  if (model.state === 'idle' && !model.cached && gpu?.supported) {
    return (
      <Notice icon={Cpu}>
        <p className="font-medium">One-time download: {info?.name} ({info?.size})</p>
        <p className="mt-0.5 text-muted">It downloads once when you ask your first question, then works offline.</p>
        <Button variant="quiet" className="mt-3" onClick={app.loadModel}>
          Download now
        </Button>
      </Notice>
    );
  }
  return null;
}

function Notice({ tone, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        'mb-6 flex gap-3 rounded-xl border px-4 py-3.5 text-sm',
        tone === 'warn' ? 'border-danger/30 bg-danger/5' : 'border-line bg-sheet',
      )}
    >
      <Icon size={18} className={cx('mt-0.5 shrink-0', tone === 'warn' ? 'text-danger' : 'text-cobalt')} />
      <div className="min-w-0 flex-1">{children}</div>
    </motion.div>
  );
}

function EmptyChat({ app, onAsk, onTool }) {
  const { selectedDocs } = app;
  if (!selectedDocs.length) {
    return (
      <div className="py-16 text-center text-sm text-muted">
        No documents are included. Tick a document in the library to ask about it.
      </div>
    );
  }
  const names = selectedDocs.map((d) => d.name);
  return (
    <div className="pb-6 pt-4">
      <h3 className="text-xl font-semibold tracking-[-0.01em]">What do you want to know?</h3>
      <p className="mt-1.5 text-sm text-muted">
        Asking about{' '}
        <span className="text-ink">{names.length === 1 ? names[0] : `${names.length} documents`}</span>.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {Object.entries(TOOLS)
          .filter(([, t]) => selectedDocs.length >= t.minDocs)
          .map(([key, t]) => {
            const Icon = TOOL_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTool(key)}
                className="flex items-start gap-3 rounded-xl border border-line bg-sheet px-4 py-3 text-left transition-colors hover:border-cobalt/50"
              >
                <Icon size={17} className="mt-0.5 shrink-0 text-cobalt" />
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted">{t.hint}</span>
                </span>
              </button>
            );
          })}
      </div>

      <p className="mb-2 mt-7 text-sm font-medium text-muted">Or ask</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink/85 transition-colors hover:border-cobalt/50 hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ msg }) {
  const Icon = msg.tool ? TOOL_ICONS[msg.tool] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-cobalt px-4 py-2.5 text-[15px] leading-6 text-white dark:text-[#0c1020]">
        {Icon && <Icon size={14} className="-mt-0.5 mr-1.5 inline" />}
        {msg.content}
      </div>
    </motion.div>
  );
}

function AssistantMessage({ msg, docsById, onCite, onRetry, canRetry, onOpenSettings }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  // Only list the sources the answer actually cited; fall back to all.
  const cited = citedNumbers(msg.content);
  const listed = (msg.sources || []).map((s, i) => ({ ...s, n: i + 1 })).filter((s) => !cited.size || cited.has(s.n));

  return (
    <div className="group">
      {msg.error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={15} className="text-danger" /> The answer couldn’t be generated.
          </p>
          <p className="mt-1 break-words text-muted">{msg.error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="quiet" onClick={onRetry} disabled={!canRetry}>
              <RotateCcw size={14} /> Try again
            </Button>
            <Button variant="ghost" onClick={onOpenSettings}>
              Settings
            </Button>
          </div>
        </div>
      ) : msg.pending && !msg.content ? (
        <div className="flex items-center gap-1.5 py-2" aria-label="Thinking">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-cobalt"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
          <span className="ml-2 text-sm text-muted">Reading the passages…</span>
        </div>
      ) : (
        <div className={cx('prose-answer', msg.pending && 'caret')}>
          <Markdown text={msg.content} sources={msg.sources} docsById={docsById} onCite={onCite} />
        </div>
      )}

      {!msg.pending && !msg.error && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {listed.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSources((s) => !s)}
              className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-rail hover:text-ink"
              aria-expanded={showSources}
            >
              {showSources ? 'Hide' : 'Show'} {listed.length} source{listed.length === 1 ? '' : 's'}
            </button>
          )}
          <IconButton label={copied ? 'Copied' : 'Copy answer'} className="h-7 w-7" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
          <IconButton label="Regenerate" className="h-7 w-7" onClick={onRetry} disabled={!canRetry}>
            <RotateCcw size={14} />
          </IconButton>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showSources && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-1.5 overflow-hidden"
          >
            {listed.map((s) => {
              const doc = docsById.get(s.docId);
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => onCite(s)}
                    className="flex w-full gap-3 rounded-lg border border-line bg-sheet px-3 py-2 text-left text-sm transition-colors hover:border-cobalt/50"
                  >
                    <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded bg-cobalt/15 px-1 text-[11px] font-semibold text-cobalt">
                      {s.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-muted">
                        {doc?.name || 'Removed document'} · {doc?.kind === 'pdf' ? 'page' : 'section'} {s.page}
                      </span>
                      <span className="line-clamp-2 font-serif text-[14px] text-ink/85">{s.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
