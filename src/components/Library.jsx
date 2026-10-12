import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, FileText, AlertTriangle, X, MessageSquare, Check } from 'lucide-react';
import { ACCEPTED_EXTENSIONS } from '../lib/parsers.js';
import { IconButton, ProgressBar, cx, formatBytes } from './ui.jsx';

const KIND_LABEL = { pdf: 'PDF', docx: 'Word', txt: 'Text', md: 'Markdown' };

export default function Library({ app, viewingId, onView, onOpenChat }) {
  const input = useRef(null);
  const [confirmId, setConfirmId] = useState(null);
  const { docs, uploads, selectedIds, toggleSelected, chats, activeChat } = app;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-semibold">Documents</h2>
        <IconButton label="Add documents" onClick={() => input.current?.click()} className="h-8 w-8">
          <Plus size={17} />
        </IconButton>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) app.addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-0.5">
          {docs.map((d) => {
            const checked = selectedIds.has(d.id);
            return (
              <li key={d.id}>
                <div
                  className={cx(
                    'group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors',
                    viewingId === d.id ? 'bg-sheet shadow-sm' : 'hover:bg-sheet/60',
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Include ${d.name} in answers`}
                    title={checked ? 'Included in answers' : 'Not included in answers'}
                    onClick={() => toggleSelected(d.id)}
                    className={cx(
                      'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                      checked ? 'border-cobalt bg-cobalt text-white dark:text-[#0c1020]' : 'border-line bg-sheet',
                    )}
                  >
                    {checked && <Check size={13} strokeWidth={3} />}
                  </button>
                  <button type="button" onClick={() => onView(d.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium leading-5">{d.name}</span>
                    <span className="block text-xs text-muted">
                      {KIND_LABEL[d.kind]} · {d.pageCount} {d.kind === 'pdf' ? 'page' : 'section'}{d.pageCount === 1 ? '' : 's'} · {formatBytes(d.size)}
                    </span>
                    {d.embedProgress !== undefined && (
                      <span className="mt-1.5 block">
                        <ProgressBar value={d.embedProgress} className="h-1" />
                        <span className="mt-1 block text-[11px] text-muted">Indexing for smarter search…</span>
                      </span>
                    )}
                  </button>
                  {confirmId === d.id ? (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                        onClick={() => {
                          app.removeDoc(d.id);
                          setConfirmId(null);
                        }}
                      >
                        Delete
                      </button>
                      <IconButton label="Cancel" className="h-7 w-7" onClick={() => setConfirmId(null)}>
                        <X size={14} />
                      </IconButton>
                    </div>
                  ) : (
                    <IconButton
                      label={`Delete ${d.name}`}
                      className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      onClick={() => setConfirmId(d.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}

          <AnimatePresence>
            {uploads.map((u) => (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-lg px-2 py-2">
                  {u.error ? (
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
                  ) : (
                    <FileText size={16} className="mt-0.5 shrink-0 animate-pulse text-cobalt" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    {u.error ? (
                      <span className="block text-xs text-danger">{u.error}</span>
                    ) : (
                      <>
                        <ProgressBar value={u.progress} className="mt-1.5 h-1" />
                        <span className="mt-1 block text-[11px] text-muted">Reading file…</span>
                      </>
                    )}
                  </div>
                  {u.error && (
                    <IconButton label="Dismiss" className="h-7 w-7" onClick={() => app.dismissUpload(u.id)}>
                      <X size={14} />
                    </IconButton>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {docs.length > 1 && (
          <p className="px-2 pt-2 text-xs text-muted">
            {selectedIds.size} of {docs.length} included in answers. Tick a box to include or leave out a document.
          </p>
        )}

        <div className="mt-6 flex items-center justify-between px-2 pb-1">
          <h2 className="text-sm font-semibold">Chats</h2>
          <button type="button" onClick={app.newChat} className="rounded-md px-2 py-1 text-xs font-medium text-cobalt hover:bg-cobalt/10">
            New chat
          </button>
        </div>
        {chats.length === 0 ? (
          <p className="px-2 text-xs text-muted">Your conversations are saved here, in this browser only.</p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpenChat(c.id)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg py-2 pl-2 pr-9 text-left text-sm transition-colors',
                    activeChat?.id === c.id ? 'bg-sheet font-medium shadow-sm' : 'text-ink/80 hover:bg-sheet/60',
                  )}
                >
                  <MessageSquare size={14} className="shrink-0 text-muted" />
                  <span className="truncate">{c.title}</span>
                </button>
                <IconButton
                  label={`Delete chat ${c.title}`}
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  onClick={() => app.deleteChat(c.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
