// Local models offered in Settings. Each has an f16 build (faster, needs the
// GPU "shader-f16" feature) and an f32 build that works on more hardware.
export const LOCAL_MODELS = [
  {
    key: 'qwen-0.5b',
    name: 'Qwen 2.5 · 0.5B',
    blurb: 'Fastest. Fine for older laptops and quick lookups.',
    size: '~0.9 GB',
    f16: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    f32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  },
  {
    key: 'llama-1b',
    name: 'Llama 3.2 · 1B',
    blurb: 'Small and quick, good general answers.',
    size: '~0.9 GB',
    f16: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  },
  {
    key: 'qwen-1.5b',
    name: 'Qwen 2.5 · 1.5B',
    blurb: 'A good balance of speed and answer quality.',
    size: '~1.6 GB',
    f16: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    f32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    recommended: true,
  },
  {
    key: 'llama-3b',
    name: 'Llama 3.2 · 3B',
    blurb: 'Smarter answers. Needs a decent GPU.',
    size: '~2.3 GB',
    f16: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    f32: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  },
  {
    key: 'phi-3.5',
    name: 'Phi 3.5 mini · 3.8B',
    blurb: 'Best reasoning of the local options. Needs a strong GPU.',
    size: '~3.7 GB',
    f16: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    f32: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
  },
];

export const DEFAULT_LOCAL_MODEL = 'qwen-1.5b';

export const PROVIDERS = {
  local: { label: 'On this device', short: 'Local' },
  openai: { label: 'OpenAI-compatible API', short: 'API' },
  anthropic: { label: 'Anthropic Claude API', short: 'Claude' },
};

export const DEFAULT_SETTINGS = {
  provider: 'local',
  localModel: DEFAULT_LOCAL_MODEL,
  openaiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  anthropicKey: '',
  anthropicModel: 'claude-haiku-5-5',
  temperature: 0.3,
  topK: 6,
};
