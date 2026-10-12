// One streaming chat interface over three backends:
//   - local:     WebLLM running on the user's GPU (no network after download)
//   - openai:    any OpenAI-compatible endpoint (OpenAI, OpenRouter, Ollama, LM Studio...)
//   - anthropic: Claude API, called directly from the browser
import { LOCAL_MODELS } from './models.js';

/* ---------- Device capability ---------- */

let gpuInfoPromise = null;
export function detectGPU() {
  if (!gpuInfoPromise) {
    gpuInfoPromise = (async () => {
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        return { supported: false, reason: 'This browser does not support WebGPU.' };
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return { supported: false, reason: 'No compatible graphics adapter was found.' };
        return { supported: true, f16: adapter.features.has('shader-f16') };
      } catch (err) {
        return { supported: false, reason: String(err?.message || err) };
      }
    })();
  }
  return gpuInfoPromise;
}

export async function resolveLocalModelId(key) {
  const model = LOCAL_MODELS.find((m) => m.key === key) || LOCAL_MODELS[0];
  const gpu = await detectGPU();
  return gpu.f16 ? model.f16 : model.f32;
}

/* ---------- Local engine (WebLLM) ---------- */

let webllm = null;
let engine = null;
let engineModelId = null;
let loadingPromise = null;

async function getWebLLM() {
  if (!webllm) webllm = await import('@mlc-ai/web-llm');
  return webllm;
}

export async function isLocalModelCached(key) {
  try {
    const { hasModelInCache } = await getWebLLM();
    return await hasModelInCache(await resolveLocalModelId(key));
  } catch {
    return false;
  }
}

export function loadedLocalModel() {
  return engineModelId;
}

export async function loadLocalModel(key, onProgress) {
  const modelId = await resolveLocalModelId(key);
  if (engine && engineModelId === modelId) return engine;
  if (loadingPromise) await loadingPromise.catch(() => {});
  if (engine && engineModelId === modelId) return engine;

  loadingPromise = (async () => {
    const gpu = await detectGPU();
    if (!gpu.supported) throw new Error(gpu.reason);
    const lib = await getWebLLM();
    const progress = (r) => onProgress?.({ progress: r.progress ?? 0, text: r.text || '' });
    if (engine) {
      engine.setInitProgressCallback?.(progress);
      engineModelId = null;
      await engine.reload(modelId);
    } else {
      const worker = new Worker(new URL('../workers/llm.worker.js', import.meta.url), { type: 'module' });
      engine = await lib.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: progress });
    }
    engineModelId = modelId;
    return engine;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/* ---------- Streaming helpers ---------- */

async function* readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data);
      } catch {
        /* ignore keep-alives */
      }
    }
  }
}

async function apiError(res, provider) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.message || JSON.stringify(body);
  } catch {
    detail = res.statusText;
  }
  if (res.status === 401) return new Error(`The ${provider} API key was rejected. Check it in Settings.`);
  if (res.status === 404) return new Error(`${provider} could not find that model. Check the model name in Settings. (${detail})`);
  if (res.status === 429) return new Error(`${provider} rate limit or quota reached. Wait a moment or check your plan. (${detail})`);
  return new Error(`${provider} returned ${res.status}: ${detail}`);
}

/* ---------- Public API ---------- */

/**
 * Streams a chat completion.
 * @param {object} p
 * @param {Array<{role:string, content:string}>} p.messages   including a leading system message
 * @param {object} p.settings
 * @param {(token:string)=>void} p.onToken
 * @param {AbortSignal} p.signal
 * @param {(info:{progress:number,text:string})=>void} p.onLoadProgress   local model download progress
 * @returns {Promise<string>} full text
 */
export async function streamChat({ messages, settings, onToken, signal, onLoadProgress }) {
  let full = '';
  const emit = (t) => {
    if (!t) return;
    full += t;
    onToken?.(t);
  };

  if (settings.provider === 'local') {
    const eng = await loadLocalModel(settings.localModel, onLoadProgress);
    const onAbort = () => eng.interruptGenerate();
    signal?.addEventListener('abort', onAbort);
    try {
      const stream = await eng.chat.completions.create({
        messages,
        stream: true,
        temperature: settings.temperature,
        max_tokens: 900,
      });
      for await (const chunk of stream) {
        emit(chunk.choices?.[0]?.delta?.content);
        if (signal?.aborted) break;
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
    return full;
  }

  if (settings.provider === 'openai') {
    if (!settings.openaiKey && settings.openaiBaseUrl.includes('api.openai.com')) {
      throw new Error('Add your OpenAI API key in Settings, or switch to the on-device model.');
    }
    const base = settings.openaiBaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(settings.openaiKey ? { Authorization: `Bearer ${settings.openaiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.openaiModel,
        messages,
        stream: true,
        temperature: settings.temperature,
      }),
    });
    if (!res.ok) throw await apiError(res, 'OpenAI');
    for await (const evt of readSSE(res)) emit(evt.choices?.[0]?.delta?.content);
    return full;
  }

  if (settings.provider === 'anthropic') {
    if (!settings.anthropicKey) throw new Error('Add your Anthropic API key in Settings, or switch to the on-device model.');
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.anthropicModel,
        system,
        max_tokens: 2048,
        temperature: settings.temperature,
        stream: true,
        messages: messages.filter((m) => m.role !== 'system'),
      }),
    });
    if (!res.ok) throw await apiError(res, 'Anthropic');
    for await (const evt of readSSE(res)) {
      if (evt.type === 'content_block_delta') emit(evt.delta?.text);
      if (evt.type === 'error') throw new Error(evt.error?.message || 'Anthropic stream error');
    }
    return full;
  }

  throw new Error(`Unknown provider: ${settings.provider}`);
}

/** How much document text fits in one request for the active provider. */
export function contextBudget(settings) {
  return settings.provider === 'local' ? 7000 : 60000;
}
