// Prompt builders. Passages are numbered [1], [2]... so the model can cite them
// and the UI can turn those numbers into clickable links.

const BASE_RULES = `You are DocMind, a careful assistant that answers questions using ONLY the provided document passages.
Rules:
- Base every statement on the passages. If they do not contain the answer, say so plainly and suggest what to ask instead.
- Cite sources inline with the passage number in square brackets, like [1] or [2][4], right after the claim they support.
- Never invent passage numbers, quotes, page numbers or facts.
- Use clear Markdown: short paragraphs, bullet lists where helpful, **bold** for key terms.
- Be concise unless the user asks for detail.`;

export function formatPassages(sources, docsById) {
  return sources
    .map((s, i) => {
      const doc = docsById.get(s.docId);
      return `[${i + 1}] (${doc?.name || 'document'}, page ${s.page})\n${s.text}`;
    })
    .join('\n\n---\n\n');
}

function trimHistory(history, maxChars) {
  const out = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const content = m.content.length > 1500 ? m.content.slice(0, 1500) + '…' : m.content;
    if (used + content.length > maxChars) break;
    used += content.length;
    out.unshift({ role: m.role, content });
  }
  return out;
}

export function buildQuestionPrompt({ question, sources, docsById, history, settings }) {
  const historyBudget = settings.provider === 'local' ? 1800 : 12000;
  return [
    { role: 'system', content: BASE_RULES },
    ...trimHistory(history, historyBudget),
    {
      role: 'user',
      content: `Document passages:\n\n${formatPassages(sources, docsById)}\n\n---\n\nQuestion: ${question}`,
    },
  ];
}

export const TOOLS = {
  summarize: {
    label: 'Summarize',
    hint: 'A short overview with the main points',
    minDocs: 1,
    instruction: `Write a summary of the document(s).
Start with a 2–3 sentence overview, then a "Key points" bullet list (5–8 bullets). Cite passages like [3].`,
  },
  keypoints: {
    label: 'Key facts & actions',
    hint: 'Deadlines, numbers, names and obligations',
    minDocs: 1,
    instruction: `Extract the concrete, actionable facts from the document(s). Use these Markdown sections, skipping any that are empty:
### Dates & deadlines
### Numbers & amounts
### People & organizations
### Obligations & action items
Each bullet should be one line with a citation like [2].`,
  },
  quiz: {
    label: 'Quiz me',
    hint: 'Five questions to test your understanding',
    minDocs: 1,
    instruction: `Create a 5-question multiple-choice quiz that tests understanding of the document(s).
Format each question exactly like this:

**Q1. Question text?**
- A) option
- B) option
- C) option
- D) option

After all five questions, add a section "### Answers" listing each answer as
"**Q1 — B)** one-sentence explanation [citation]".
Make the wrong options plausible. Cover different parts of the material.`,
  },
  simplify: {
    label: 'Explain simply',
    hint: 'Plain language, no jargon',
    minDocs: 1,
    instruction: `Explain what the document(s) say in plain language a 14-year-old could follow.
Replace jargon with everyday words, and add a short "Terms worth knowing" list defining any unavoidable technical terms. Cite passages like [1].`,
  },
  compare: {
    label: 'Compare documents',
    hint: 'Similarities and differences between two files',
    minDocs: 2,
    instruction: `Compare the documents. Use these Markdown sections:
### In short
One or two sentences on how they relate.
### What's the same
### What's different
A Markdown table with columns: Topic | ${'{A}'} | ${'{B}'}
### What changed or stands out
Cite passages like [4] throughout.`,
  },
};

export function buildToolPrompt({ toolKey, sources, docsById, docs, complete }) {
  const tool = TOOLS[toolKey];
  let instruction = tool.instruction;
  if (toolKey === 'compare') {
    instruction = instruction.replace('{A}', docs[0]?.name || 'Document A').replace('{B}', docs[1]?.name || 'Document B');
  }
  const coverage = complete
    ? ''
    : '\n\nNote: these passages are a representative sample spread across the document(s), not the full text.';
  return [
    { role: 'system', content: BASE_RULES },
    {
      role: 'user',
      content: `Documents: ${docs.map((d) => `"${d.name}"`).join(', ')}${coverage}\n\nDocument passages:\n\n${formatPassages(
        sources,
        docsById,
      )}\n\n---\n\nTask: ${instruction}`,
    },
  ];
}

export const SUGGESTED_QUESTIONS = [
  'What is this document about?',
  'What are the most important deadlines or dates?',
  'Are there any risks or obligations I should know about?',
  'Explain the main argument in simple terms.',
];
