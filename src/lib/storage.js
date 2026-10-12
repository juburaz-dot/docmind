// Persistence in the browser's IndexedDB (documents, chats) and localStorage
// (settings). Nothing is sent anywhere.
import { get, set, del, keys, createStore } from 'idb-keyval';

const docStore = createStore('docmind-docs', 'docs');
const chatStore = createStore('docmind-chats', 'chats');

export const db = {
  async listDocs() {
    const ids = await keys(docStore);
    const docs = await Promise.all(ids.map((id) => get(id, docStore)));
    return docs.filter(Boolean).sort((a, b) => a.addedAt - b.addedAt);
  },
  saveDoc: (doc) => set(doc.id, doc, docStore),
  deleteDoc: (id) => del(id, docStore),

  async listChats() {
    const ids = await keys(chatStore);
    const chats = await Promise.all(ids.map((id) => get(id, chatStore)));
    return chats.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  saveChat: (chat) => set(chat.id, chat, chatStore),
  deleteChat: (id) => del(id, chatStore),
};

const SETTINGS_KEY = 'docmind:settings';

export function loadSettings(defaults) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings last for this session only */
  }
}

export function loadTheme() {
  try {
    const t = localStorage.getItem('docmind:theme');
    if (t) return t;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem('docmind:theme', theme);
  } catch {
    /* ignore */
  }
}

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
