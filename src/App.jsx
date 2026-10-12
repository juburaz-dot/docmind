import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Sun, Moon, Library as LibraryIcon, BookOpen, MessageSquare, Upload, Lock } from 'lucide-react';
import { useDocMind } from './lib/useDocMind.js';
import { loadTheme, saveTheme } from './lib/storage.js';
import { LOCAL_MODELS } from './lib/models.js';
import Logo from './components/Logo.jsx';
import Welcome from './components/Welcome.jsx';
import Library from './components/Library.jsx';
import DocumentViewer from './components/DocumentViewer.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { IconButton, cx } from './components/ui.jsx';

const SAMPLE_URL = './samples/sample-residential-lease.md';

export default function App() {
  const app = useDocMind();
  const [theme, setTheme] = useState(loadTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [focus, setFocus] = useState(null); // { chunkId, nonce }
  const [tab, setTab] = useState('chat'); // mobile only
  const [dragging, setDragging] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  // Close the viewer if its document was deleted.
  useEffect(() => {
    if (viewingId && !app.docsById.has(viewingId)) setViewingId(null);
  }, [viewingId, app.docsById]);

  const addFiles = useCallback(
    async (files) => {
      const added = await app.addFiles(files);
      if (added[0] && !viewingId) setViewingId(added[0].id);
    },
    [app, viewingId],
  );

  const loadSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const res = await fetch(SAMPLE_URL);
      const text = await res.text();
      await addFiles([new File([text], 'Sample residential lease.md', { type: 'text/markdown' })]);
    } finally {
      setSampleLoading(false);
    }
  }, [addFiles]);

  const onCite = useCallback((src) => {
    setViewingId(src.docId);
    setFocus({ chunkId: src.id, nonce: Date.now() });
    setTab('doc');
  }, []);

  // Drop files anywhere in the window.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e) => hasFiles(e) && e.preventDefault();
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  const viewingDoc = viewingId ? app.docsById.get(viewingId) : null;
  const showWelcome = app.ready && app.docs.length === 0;

  return (
    <div className="flex h-full flex-col">
      <Header
        app={app}
        theme={theme}
        onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="min-h-0 flex-1">
        {!app.ready ? null : showWelcome ? (
          <Welcome onFiles={addFiles} onSample={loadSample} gpu={app.gpu} busy={sampleLoading || app.uploads.length > 0} />
        ) : (
          <div
            className={cx(
              'grid h-full',
              viewingDoc
                ? 'lg:grid-cols-[264px_minmax(0,1fr)_minmax(380px,42%)]'
                : 'lg:grid-cols-[264px_minmax(0,1fr)]',
            )}
          >
            <aside className={cx('min-h-0 border-line/70 bg-rail lg:block lg:border-r', tab === 'library' ? 'block' : 'hidden')}>
              <Library
                app={app}
                viewingId={viewingId}
                onView={(id) => {
                  setViewingId(id);
                  setFocus(null);
                  setTab('doc');
                }}
                onOpenChat={(id) => {
                  app.openChat(id);
                  setTab('chat');
                }}
              />
            </aside>

            {viewingDoc && (
              <section className={cx('min-h-0 border-line/70 lg:block lg:border-r', tab === 'doc' ? 'block' : 'hidden')}>
                <DocumentViewer doc={viewingDoc} focus={focus} onClose={() => setViewingId(null)} />
              </section>
            )}
            {!viewingDoc && tab === 'doc' && (
              <section className="min-h-0 lg:hidden">
                <DocumentViewer doc={null} />
              </section>
            )}

            <section className={cx('min-h-0 bg-paper lg:block', tab === 'chat' ? 'block' : 'hidden')}>
              <ChatPanel app={app} onCite={onCite} onOpenSettings={() => setSettingsOpen(true)} />
            </section>
          </div>
        )}
      </main>

      {!showWelcome && app.ready && <MobileTabs tab={tab} setTab={setTab} hasDoc={!!viewingDoc} />}

      <AnimatePresence>{settingsOpen && <SettingsModal app={app} onClose={() => setSettingsOpen(false)} />}</AnimatePresence>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-cobalt/10 p-6 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-cobalt bg-sheet px-12 py-10 text-center shadow-sheet">
              <Upload size={28} className="text-cobalt" />
              <p className="text-lg font-semibold">Drop to add to your library</p>
              <p className="text-sm text-muted">PDF, Word, TXT or Markdown. Read locally, never uploaded.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ app, theme, onTheme, onSettings }) {
  const { settings, model } = app;
  let label;
  let dot = 'bg-muted';
  if (settings.provider === 'local') {
    const m = LOCAL_MODELS.find((x) => x.key === settings.localModel);
    label = `${m?.name || 'Local model'} · on device`;
    if (model.state === 'ready') dot = 'bg-emerald-500';
    if (model.state === 'loading') dot = 'bg-amber-400 animate-pulse';
    if (model.state === 'error' || app.gpu?.supported === false) dot = 'bg-danger';
  } else if (settings.provider === 'openai') {
    label = `${settings.openaiModel} · API`;
    dot = settings.openaiKey || !settings.openaiBaseUrl.includes('api.openai.com') ? 'bg-emerald-500' : 'bg-danger';
  } else {
    label = `${settings.anthropicModel} · API`;
    dot = settings.anthropicKey ? 'bg-emerald-500' : 'bg-danger';
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/70 bg-paper px-3 sm:px-5">
      <a href="./" className="flex items-center gap-2.5" aria-label="DocMind home">
        <Logo size={26} />
        <span className="text-[17px] font-semibold tracking-[-0.01em]">DocMind</span>
      </a>
      <span className="ml-1 hidden items-center gap-1.5 text-xs text-muted md:flex">
        <Lock size={12} /> Files never leave this device
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSettings}
        className="hidden max-w-[260px] items-center gap-2 truncate rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-cobalt/50 hover:text-ink sm:flex"
        title="Change model"
      >
        <span className={cx('h-2 w-2 shrink-0 rounded-full', dot)} />
        <span className="truncate">{label}</span>
      </button>
      <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
      <IconButton label="Settings" onClick={onSettings}>
        <Settings size={18} />
      </IconButton>
    </header>
  );
}

function MobileTabs({ tab, setTab, hasDoc }) {
  const tabs = [
    { key: 'library', label: 'Library', icon: LibraryIcon },
    { key: 'doc', label: 'Document', icon: BookOpen },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
  ];
  return (
    <nav className="grid shrink-0 grid-cols-3 border-t border-line/70 bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Sections">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          aria-current={tab === key ? 'page' : undefined}
          className={cx(
            'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
            tab === key ? 'text-cobalt' : 'text-muted',
            key === 'doc' && !hasDoc && 'opacity-60',
          )}
        >
          <Icon size={19} />
          {label}
        </button>
      ))}
    </nav>
  );
}
