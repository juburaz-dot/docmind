// Small promise-based client for the embedding worker.
let worker = null;
let nextId = 1;
const pending = new Map();
let failed = false;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/embed.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data;
      const job = pending.get(msg.id);
      if (msg.type === 'batch') job?.onProgress?.(msg.done / msg.total);
      if (msg.type === 'result') {
        pending.delete(msg.id);
        job?.resolve(msg.vectors);
      }
      if (msg.type === 'error') {
        pending.delete(msg.id);
        job?.reject(new Error(msg.error));
      }
    };
    worker.onerror = (e) => {
      failed = true;
      for (const job of pending.values()) job.reject(new Error(e.message || 'Embedding worker crashed'));
      pending.clear();
    };
  }
  return worker;
}

export function embeddingsAvailable() {
  return !failed && typeof Worker !== 'undefined';
}

export function embed(texts, onProgress) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, texts });
  });
}

export async function embedQuery(text) {
  if (!embeddingsAvailable()) return null;
  try {
    const [v] = await embed([text]);
    return v;
  } catch {
    return null;
  }
}
