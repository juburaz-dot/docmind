// Central app state: documents, chats, AI calls and settings.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseFile } from './parsers.js';
import { chunkPages } from './chunker.js';
import { buildIndex, search, sampleChunks } from './search.js';
import { embed, embedQuery, embeddingsAvailable } from './embeddings.js';
import { streamChat, contextBudget, isLocalModelCached, loadLocalModel, loadedLocalModel, resolveLocalModelId, detectGPU } from './llm.js';
import { buildQuestionPrompt, buildToolPrompt, TOOLS } from './prompts.js';
import { db, loadSettings, saveSettings, uid } from './storage.js';
import { DEFAULT_SETTINGS } from './models.js';

function titleFrom(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 46) + '…' : t;
}

export function useDocMind() {
  const [docs, setDocs] = useState([]);
  const [uploads, setUploads] = useState([]); // files currently being processed
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [settings, setSettingsState] = useState(() => loadSettings(DEFAULT_SETTINGS));
  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useState({ state: 'idle', progress: 0, text: '', cached: false });
  const [gpu, setGpu] = useState(null);
  const [ready, setReady] = useState(false);
  const abortRef = useRef(null);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  /* ---------- Load saved data ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [savedDocs, savedChats] = await Promise.all([db.listDocs(), db.listChats()]);
        setDocs(savedDocs);
        setSelectedIds(new Set(savedDocs.map((d) => d.id)));
        setChats(savedChats);
        if (savedChats[0]) setActiveChatId(savedChats[0].id);
        // Finish embeddings for any document that was closed mid-way.
        savedDocs.filter((d) => !d.vectors).forEach((d) => embedDoc(d));
      } catch (err) {
        console.warn('Could not open saved data', err);
      } finally {
        setReady(true);
      }
    })();
    detectGPU().then(setGpu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Settings ---------- */
  const setSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (settings.provider !== 'local') return;
    let cancelled = false;
    (async () => {
      const id = await resolveLocalModelId(settings.localModel);
      const cached = await isLocalModelCached(settings.localModel);
      if (cancelled) return;
      setModel((m) =>
        loadedLocalModel() === id
          ? { ...m, state: 'ready', cached: true }
          : m.state === 'loading'
            ? m
            : { state: 'idle', progress: 0, text: '', cached },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.localModel, settings.provider]);

  const onLoadProgress = useCallback(({ progress, text }) => {
    setModel((m) => ({ ...m, state: 'loading', progress, text }));
  }, []);

  const loadModel = useCallback(async () => {
    setModel((m) => ({ ...m, state: 'loading', progress: 0, text: 'Starting…' }));
    try {
      await loadLocalModel(settings.localModel, onLoadProgress);
      setModel({ state: 'ready', progress: 1, text: '', cached: true });
    } catch (err) {
      setModel((m) => ({ ...m, state: 'error', text: String(err?.message || err) }));
    }
  }, [settings.localModel, onLoadProgress]);

  /* ---------- Documents ---------- */
  const embedDoc = useCallback(async (doc) => {
    if (!embeddingsAvailable()) return;
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, embedProgress: 0 } : d)));
    try {
      const vectors = await embed(
        doc.chunks.map((c) => c.text),
        (p) => setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, embedProgress: p } : d))),
      );
      const updated = { ...doc, vectors, embedProgress: undefined };
      setDocs((ds) => ds.map((d) => (d.id === doc.id ? updated : d)));
      const { embedProgress, ...toSave } = updated;
      await db.saveDoc(toSave);
    } catch (err) {
      console.warn('Semantic search unavailable, using keyword search only.', err);
      setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, embedProgress: undefined, embedFailed: true } : d)));
    }
  }, []);

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList);
      const jobs = files.map((f) => ({ id: uid('up_'), name: f.name, progress: 0, error: null }));
      setUploads((u) => [...u, ...jobs]);
      const added = [];
      await Promise.all(
        files.map(async (file, i) => {
          const job = jobs[i];
          try {
            const { kind, pages } = await parseFile(file, (p) =>
              setUploads((u) => u.map((j) => (j.id === job.id ? { ...j, progress: p } : j))),
            );
            const id = uid('doc_');
            const doc = {
              id,
              name: file.name,
              kind,
              size: file.size,
              addedAt: Date.now() + i,
              pageCount: pages.length,
              chunks: chunkPages(pages, id),
            };
            await db.saveDoc(doc);
            setDocs((ds) => [...ds, doc]);
            setSelectedIds((s) => new Set([...s, id]));
            setUploads((u) => u.filter((j) => j.id !== job.id));
            added.push(doc);
            embedDoc(doc);
          } catch (err) {
            setUploads((u) => u.map((j) => (j.id === job.id ? { ...j, error: String(err?.message || err) } : j)));
          }
        }),
      );
      return added;
    },
    [embedDoc],
  );

  const dismissUpload = useCallback((id) => setUploads((u) => u.filter((j) => j.id !== id)), []);

  const removeDoc = useCallback(async (id) => {
    await db.deleteDoc(id);
    setDocs((ds) => ds.filter((d) => d.id !== id));
    setSelectedIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }, []);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const docsById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const selectedDocs = useMemo(() => docs.filter((d) => selectedIds.has(d.id)), [docs, selectedIds]);

  const index = useMemo(() => buildIndex(selectedDocs.flatMap((d) => d.chunks)), [selectedDocs]);
  const vectors = useMemo(() => {
    const m = new Map();
    for (const d of selectedDocs) if (d.vectors) d.chunks.forEach((c, i) => d.vectors[i] && m.set(c.id, d.vectors[i]));
    return m;
  }, [selectedDocs]);

  /* ---------- Chats ---------- */
  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);

  // Save the open chat whenever it changes and no answer is streaming.
  useEffect(() => {
    if (generating || !activeChat) return;
    db.saveChat({ ...activeChat, messages: activeChat.messages.map(({ pending, ...m }) => m) }).catch(() => {});
  }, [activeChat, generating]);

  const updateChat = useCallback((id, fn) => {
    setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const ensureChat = useCallback(
    (title) => {
      if (activeChat) return activeChat.id;
      const chat = { id: uid('chat_'), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      setChats((cs) => [chat, ...cs]);
      setActiveChatId(chat.id);
      return chat.id;
    },
    [activeChat],
  );

  const newChat = useCallback(() => setActiveChatId(null), []);
  const openChat = useCallback((id) => setActiveChatId(id), []);
  const deleteChat = useCallback(
    async (id) => {
      await db.deleteChat(id);
      setChats((cs) => cs.filter((c) => c.id !== id));
      if (activeChatId === id) setActiveChatId(null);
    },
    [activeChatId],
  );
  const clearAllChats = useCallback(async () => {
    await Promise.all(chatsRef.current.map((c) => db.deleteChat(c.id)));
    setChats([]);
    setActiveChatId(null);
  }, []);

  /* ---------- Generation ---------- */
  const run = useCallback(
    async ({ chatId, userText, tool, buildMessages, sources }) => {
      const userMsg = { id: uid('m_'), role: 'user', content: userText, tool };
      const botMsg = { id: uid('m_'), role: 'assistant', content: '', sources, tool, pending: true };
      updateChat(chatId, (c) => ({ ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, botMsg] }));

      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);
      try {
        const history = (chatsRef.current.find((c) => c.id === chatId)?.messages || [])
          .filter((m) => !m.error && m.content && m.id !== userMsg.id && m.id !== botMsg.id)
          .map((m) => ({ role: m.role, content: m.content }));
        const messages = buildMessages(history);
        if (settings.provider === 'local') setModel((m) => (m.state === 'ready' ? m : { ...m, state: 'loading' }));
        await streamChat({
          messages,
          settings,
          signal: controller.signal,
          onLoadProgress,
          onToken: (t) => {
            setModel((m) => (m.state === 'ready' ? m : { state: 'ready', progress: 1, text: '', cached: true }));
            updateChat(chatId, (c) => ({
              ...c,
              messages: c.messages.map((m) => (m.id === botMsg.id ? { ...m, content: m.content + t } : m)),
            }));
          },
        });
        if (settings.provider === 'local') setModel({ state: 'ready', progress: 1, text: '', cached: true });
      } catch (err) {
        if (err?.name !== 'AbortError') {
          const message = String(err?.message || err);
          if (settings.provider === 'local') setModel((m) => ({ ...m, state: 'error', text: message }));
          updateChat(chatId, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === botMsg.id ? { ...m, error: message } : m)),
          }));
        }
      } finally {
        updateChat(chatId, (c) => ({
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === botMsg.id ? { ...m, pending: false, content: m.content || (m.error ? '' : '_Stopped._') } : m,
          ),
        }));
        setGenerating(false);
        abortRef.current = null;
      }
    },
    [settings, updateChat, onLoadProgress],
  );

  const ask = useCallback(
    async (question) => {
      const q = question.trim();
      if (!q || generating || !selectedDocs.length) return;
      const chatId = ensureChat(titleFrom(q));
      const queryVector = vectors.size ? await embedQuery(q) : null;
      const k = settings.provider === 'local' ? Math.min(settings.topK, 6) : Math.max(settings.topK, 8);
      let results = search(index, q, { k, queryVector, vectors }).map((r) => r.chunk);
      // Keep within the model's context budget.
      const budget = contextBudget(settings);
      let used = 0;
      results = results.filter((c) => (used += c.text.length) <= budget || used === c.text.length);
      const sources = results.map(({ id, docId, page, text }) => ({ id, docId, page, text }));
      await run({
        chatId,
        userText: q,
        sources,
        buildMessages: (history) => buildQuestionPrompt({ question: q, sources, docsById, history, settings }),
      });
    },
    [generating, selectedDocs, ensureChat, vectors, index, settings, docsById, run],
  );

  const runTool = useCallback(
    async (toolKey, docIds) => {
      const tool = TOOLS[toolKey];
      const targetDocs = (docIds ? docIds.map((id) => docsById.get(id)).filter(Boolean) : selectedDocs).slice(
        0,
        toolKey === 'compare' ? 2 : 8,
      );
      if (generating || targetDocs.length < tool.minDocs) return;
      const budget = contextBudget(settings);
      const per = Math.floor(budget / targetDocs.length);
      let complete = true;
      const picked = targetDocs.flatMap((d) => {
        const s = sampleChunks(d.chunks, per);
        if (!s.complete) complete = false;
        return s.chunks;
      });
      const sources = picked.map(({ id, docId, page, text }) => ({ id, docId, page, text }));
      const label = `${tool.label}: ${targetDocs.map((d) => d.name).join(' vs ')}`;
      const chatId = ensureChat(titleFrom(label));
      await run({
        chatId,
        userText: label,
        tool: toolKey,
        sources,
        buildMessages: () => buildToolPrompt({ toolKey, sources, docsById, docs: targetDocs, complete }),
      });
    },
    [docsById, selectedDocs, generating, settings, ensureChat, run],
  );

  const retry = useCallback(
    async (msgId) => {
      const chat = activeChat;
      if (!chat || generating) return;
      const i = chat.messages.findIndex((m) => m.id === msgId);
      const userMsg = chat.messages[i - 1];
      if (!userMsg) return;
      updateChat(chat.id, (c) => ({ ...c, messages: c.messages.slice(0, i - 1) }));
      await new Promise((r) => setTimeout(r, 0));
      if (userMsg.tool) await runTool(userMsg.tool);
      else await ask(userMsg.content);
    },
    [activeChat, generating, updateChat, runTool, ask],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    ready,
    gpu,
    docs,
    docsById,
    uploads,
    dismissUpload,
    addFiles,
    removeDoc,
    selectedIds,
    selectedDocs,
    toggleSelected,
    chats,
    activeChat,
    newChat,
    openChat,
    deleteChat,
    clearAllChats,
    ask,
    runTool,
    retry,
    stop,
    generating,
    settings,
    setSettings,
    model,
    loadModel,
  };
}
