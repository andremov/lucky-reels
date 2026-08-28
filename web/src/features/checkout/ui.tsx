import type { InputHTMLAttributes, ReactNode } from 'react';

export function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${name}-error`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-white/70">{label}</span>
      <input
        {...props}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-lg border border-case-edge bg-window px-3 py-2 text-white outline-none focus:border-gold"
      />
      {error ? (
        <span id={errorId} role="alert" className="text-xs text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: { variant?: 'primary' | 'ghost' } & InputHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  }) {
  const styles =
    variant === 'primary'
      ? 'bg-gold text-page hover:bg-gold-dim disabled:bg-gold-dim/40 disabled:text-white/40'
      : 'border border-case-edge text-white/80 hover:border-gold/60';
  return (
    <button
      type="button"
      {...(props as Record<string, unknown>)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {children}
    </p>
  );
}
