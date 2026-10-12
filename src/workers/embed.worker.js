// Computes sentence embeddings off the main thread with Transformers.js.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const opts = {
        dtype: 'q8',
        progress_callback: (p) => {
          if (p.status === 'progress') self.postMessage({ type: 'progress', progress: (p.progress || 0) / 100 });
        },
      };
      // WASM keeps the GPU free for the chat model. The model is ~23 MB.
      return pipeline('feature-extraction', MODEL, opts);
    })();
  }
  return extractorPromise;
}

self.onmessage = async (e) => {
  const { id, texts } = e.data;
  try {
    const extractor = await getExtractor();
    const vectors = [];
    const BATCH = 16;
    for (let i = 0; i < texts.length; i += BATCH) {
      const out = await extractor(texts.slice(i, i + BATCH), { pooling: 'mean', normalize: true });
      vectors.push(...out.tolist());
      self.postMessage({ type: 'batch', id, done: Math.min(i + BATCH, texts.length), total: texts.length });
    }
    self.postMessage({ type: 'result', id, vectors });
  } catch (err) {
    self.postMessage({ type: 'error', id, error: String(err?.message || err) });
  }
};
