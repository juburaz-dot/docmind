// A folded page with a highlighter stroke across it.
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 3h13l6 6v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="rgb(var(--cobalt))" />
      <path d="M20 3v4a2 2 0 0 0 2 2h4" fill="rgb(var(--cobalt))" opacity=".55" />
      <rect x="8.5" y="14" width="15" height="4.5" rx="1.2" fill="rgb(var(--marker))" />
      <rect x="9.5" y="21.5" width="10" height="1.8" rx=".9" fill="#fff" opacity=".7" />
      <rect x="9.5" y="9.5" width="7" height="1.8" rx=".9" fill="#fff" opacity=".7" />
    </svg>
  );
}
