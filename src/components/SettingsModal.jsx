import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Cpu, Cloud, KeyRound, Check, Trash2 } from 'lucide-react';
import { LOCAL_MODELS, PROVIDERS } from '../lib/models.js';
import { Button, IconButton, cx } from './ui.jsx';

export default function SettingsModal({ app, onClose }) {
  const { settings, setSettings, gpu } = app;
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="scroll-thin flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-sheet shadow-sheet sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-4">
          <h2 id="settings-title" className="text-base font-semibold">
            Settings
          </h2>
          <IconButton label="Close settings" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="scroll-thin overflow-y-auto px-6 py-5">
          <Section title="Where answers come from">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(PROVIDERS).map(([key, p]) => {
                const Icon = key === 'local' ? Cpu : key === 'anthropic' ? KeyRound : Cloud;
                const active = settings.provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettings({ provider: key })}
                    aria-pressed={active}
                    className={cx(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'border-cobalt bg-cobalt/10 font-medium text-ink' : 'border-line hover:border-cobalt/40',
                    )}
                  >
                    <Icon size={16} className={active ? 'text-cobalt' : 'text-muted'} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {settings.provider === 'local' && (
            <Section
              title="On-device model"
              note={
                gpu?.supported === false
                  ? `Not available here: ${gpu.reason}`
                  : 'Bigger models answer better but download more and need a stronger graphics card. Each downloads once.'
              }
            >
              <div className="space-y-1.5">
                {LOCAL_MODELS.map((m) => {
                  const active = settings.localModel === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSettings({ localModel: m.key })}
                      aria-pressed={active}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors',
                        active ? 'border-cobalt bg-cobalt/10' : 'border-line hover:border-cobalt/40',
                      )}
                    >
                      <span
                        className={cx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-cobalt bg-cobalt text-white dark:text-[#0c1020]' : 'border-line',
                        )}
                      >
                        {active && <Check size={10} strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {m.name}
                          {m.recommended && <span className="ml-2 text-xs font-normal text-cobalt">Recommended</span>}
                        </span>
                        <span className="block text-xs text-muted">{m.blurb}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{m.size}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {settings.provider === 'openai' && (
            <Section
              title="OpenAI-compatible API"
              note="Works with OpenAI, OpenRouter, Groq, or a local server like Ollama (http://localhost:11434/v1) or LM Studio. Your key is stored only in this browser."
            >
              <Field label="API key">
                <input
                  type="password"
                  autoComplete="off"
                  value={settings.openaiKey}
                  onChange={(e) => setSettings({ openaiKey: e.target.value.trim() })}
                  placeholder="sk-…"
                  className={inputCls}
                />
              </Field>
              <Field label="Base URL">
                <input value={settings.openaiBaseUrl} onChange={(e) => setSettings({ openaiBaseUrl: e.target.value.trim() })} className={inputCls} />
              </Field>
              <Field label="Model">
                <input value={settings.openaiModel} onChange={(e) => setSettings({ openaiModel: e.target.value.trim() })} className={inputCls} />
              </Field>
            </Section>
          )}

          {settings.provider === 'anthropic' && (
            <Section title="Anthropic Claude API" note="Your key is stored only in this browser and sent only to api.anthropic.com.">
              <Field label="API key">
                <input
                  type="password"
                  autoComplete="off"
                  value={settings.anthropicKey}
                  onChange={(e) => setSettings({ anthropicKey: e.target.value.trim() })}
                  placeholder="sk-ant-…"
                  className={inputCls}
                />
              </Field>
              <Field label="Model">
                <input value={settings.anthropicModel} onChange={(e) => setSettings({ anthropicModel: e.target.value.trim() })} className={inputCls} />
              </Field>
            </Section>
          )}

          <Section title="Answer style">
            <Field label={`Creativity: ${settings.temperature <= 0.2 ? 'precise' : settings.temperature <= 0.6 ? 'balanced' : 'creative'}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ temperature: Number(e.target.value) })}
                className="w-full accent-[rgb(var(--cobalt))]"
              />
            </Field>
            <Field label={`Passages per answer: ${settings.topK}`}>
              <input
                type="range"
                min="3"
                max="12"
                step="1"
                value={settings.topK}
                onChange={(e) => setSettings({ topK: Number(e.target.value) })}
                className="w-full accent-[rgb(var(--cobalt))]"
              />
            </Field>
          </Section>

          <Section title="Your data" note="Documents and chats live in this browser’s storage. Clearing site data also removes them.">
            {confirmClear ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Delete all {app.chats.length} chats?</span>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await app.clearAllChats();
                    setConfirmClear(false);
                  }}
                >
                  Delete chats
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  Keep them
                </Button>
              </div>
            ) : (
              <Button variant="danger" className="px-2" onClick={() => setConfirmClear(true)} disabled={!app.chats.length}>
                <Trash2 size={15} /> Delete all chats
              </Button>
            )}
          </Section>
        </div>

        <div className="flex justify-end border-t border-line/70 px-6 py-3.5">
          <Button onClick={onClose}>Done</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-cobalt';

function Section({ title, note, children }) {
  return (
    <section className="border-b border-line/50 py-5 first:pt-0 last:border-0 last:pb-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-1 text-xs leading-5 text-muted">{note}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
