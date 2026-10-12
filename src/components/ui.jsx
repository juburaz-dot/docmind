import { forwardRef } from 'react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const IconButton = forwardRef(function IconButton({ label, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-rail hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Button({ variant = 'primary', className, children, ...props }) {
  const styles = {
    primary: 'bg-cobalt text-white hover:brightness-110 dark:text-[#0c1020]',
    quiet: 'bg-rail text-ink hover:bg-line/70',
    ghost: 'text-muted hover:bg-rail hover:text-ink',
    danger: 'text-danger hover:bg-danger/10',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, className }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line/70', className)}>
      <div
        className="h-full rounded-full bg-cobalt transition-[width] duration-300"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
