import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Lock, Quote, Cpu } from 'lucide-react';
import { ACCEPTED_EXTENSIONS } from '../lib/parsers.js';
import { Button } from './ui.jsx';

export default function Welcome({ onFiles, onSample, gpu, busy }) {
  const input = useRef(null);

  return (
    <div className="scroll-thin flex h-full items-start overflow-y-auto lg:items-center">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
        <div className="max-w-xl self-center">
          <h1 className="text-[2.4rem] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[3.1rem]">
            Ask your documents anything. They stay on your computer.
          </h1>
          <p className="mt-5 max-w-[34rem] font-serif text-lg leading-relaxed text-muted">
            DocMind reads PDFs, Word files and notes, then answers your questions with page-level citations. The AI
            runs inside your browser, so contracts, medical records and research never get uploaded anywhere.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => input.current?.click()} className="px-5 py-2.5 text-[15px]" disabled={busy}>
              <Upload size={17} /> Choose files
            </Button>
            <Button variant="quiet" onClick={onSample} className="px-5 py-2.5 text-[15px]" disabled={busy}>
              <FileText size={17} /> Try a sample lease
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <dl className="mt-10 grid gap-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-2 font-semibold">
                <Lock size={15} className="text-cobalt" /> Private by design
              </dt>
              <dd className="mt-1 text-muted">Files are read and stored only in this browser.</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 font-semibold">
                <Quote size={15} className="text-cobalt" /> Every answer cited
              </dt>
              <dd className="mt-1 text-muted">Click a citation to see the exact passage.</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 font-semibold">
                <Cpu size={15} className="text-cobalt" /> Free to run
              </dt>
              <dd className="mt-1 text-muted">No account, no API bill. Bring a key if you want one.</dd>
            </div>
          </dl>

          {gpu && !gpu.supported && (
            <p className="mt-8 rounded-lg border border-line bg-sheet px-4 py-3 text-sm text-muted">
              <span className="font-semibold text-ink">This browser can’t run the on-device AI.</span> {gpu.reason} Use a
              recent Chrome or Edge, or add an API key in Settings after uploading.
            </p>
          )}
        </div>

        <DropSheet onFiles={onFiles} />
      </div>
    </div>
  );
}

// The drop target is drawn as a document page. On load, a highlighter sweeps
// across one sentence and a citation appears: the product in one moment.
function DropSheet({ onFiles }) {
  return (
    // Dropping is handled for the whole window in App.jsx.
    <label className="group relative block cursor-pointer select-none">
      <input
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-[1.5deg] rounded-xl bg-sheet/60 shadow-sheet" aria-hidden />
      <div className="relative rounded-xl bg-sheet p-7 shadow-sheet transition-transform duration-300 group-hover:-translate-y-1 sm:p-9">
        <div className="mb-6 flex items-center justify-between text-xs text-muted">
          <span>Residential Lease · page 3</span>
          <span>PDF</span>
        </div>
        <div className="space-y-3 font-serif text-[15px] leading-7 text-ink/80">
          <p>
            4.1 The Tenant shall pay rent of $2,150 on the first day of each calendar month, by bank transfer to the
            account named in Schedule B.
          </p>
          <p>
            <motion.span
              className="marker"
              initial={{ backgroundSize: '0% 100%' }}
              animate={{ backgroundSize: '100% 100%' }}
              transition={{ delay: 0.9, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            >
              4.2 Rent received more than five days late incurs a fee of $75, plus $10 for each further day.
            </motion.span>{' '}
            The Landlord may waive this fee in writing.
          </p>
          <p className="text-ink/45">4.3 Payments are applied first to outstanding fees, then to rent owed.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.4 }}
          className="mt-6 rounded-lg bg-rail px-4 py-3 text-sm"
        >
          <p className="font-medium">What happens if I pay rent late?</p>
          <p className="mt-1 font-serif text-[15px] text-ink/85">
            After a five-day grace period you owe a $75 fee plus $10 per extra day{' '}
            <span className="rounded bg-cobalt/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-cobalt">p. 3</span>
          </p>
        </motion.div>

        <div className="mt-7 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line py-5 text-sm text-muted transition-colors group-hover:border-cobalt group-hover:text-cobalt">
          <Upload size={16} /> Drop PDF, Word, TXT or Markdown files here
        </div>
      </div>
    </label>
  );
}
