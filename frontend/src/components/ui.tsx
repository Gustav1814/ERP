import { forwardRef, useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';

type Tone = 'neutral' | 'accent' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'pink' | 'sky' | 'indigo';
const alignStyles = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted border border-divider',
  accent: 'bg-accent/20 text-accent border border-accent/25',
  emerald: 'bg-emerald/20 text-emerald border border-emerald/25',
  amber: 'bg-amber/20 text-amber border border-amber/25',
  rose: 'bg-rose/20 text-rose border border-rose/25',
  cyan: 'bg-cyan/20 text-cyan border border-cyan/25',
  pink: 'bg-pink/20 text-pink border border-pink/25',
  sky: 'bg-sky/20 text-sky border border-sky/25',
  indigo: 'bg-indigo/20 text-indigo border border-indigo/25',
};

export function Pill({
  children,
  tone = 'neutral',
  className = '',
  nowrap = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  /** Keeps label on one line — use for short status/qualify chips. */
  nowrap?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${nowrap ? 'whitespace-nowrap' : ''} ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'accent' }: { tone?: Tone }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-muted',
    accent: 'bg-accent',
    emerald: 'bg-emerald',
    amber: 'bg-amber',
    rose: 'bg-rose',
    cyan: 'bg-cyan',
    pink: 'bg-pink',
    sky: 'bg-sky',
    indigo: 'bg-indigo',
  };
  return <span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_4px_currentColor] ${color[tone]}`} />;
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`glass-card ${padded ? 'p-6 md:p-7' : ''} ${className}`}>{children}</div>
  );
}

/** Full-screen modal: shared blur backdrop + glass panel (single stacking layer). */
export function ModalFrame({
  children,
  onBackdropClick,
  zClass = 'z-50',
  panelClassName = '',
}: {
  children: ReactNode;
  onBackdropClick?: () => void;
  zClass?: string;
  panelClassName?: string;
}) {
  return (
    <div className={`fixed inset-0 ${zClass} isolate flex items-center justify-center p-4`}>
      {onBackdropClick ? (
        <button
          type="button"
          className="modal-backdrop absolute inset-0 cursor-default border-0 p-0"
          aria-label="Close dialog"
          onClick={onBackdropClick}
        />
      ) : (
        <div className="modal-backdrop absolute inset-0" aria-hidden />
      )}
      <div
        className={`modal-panel animate-modal-in relative z-10 max-h-[min(90vh,48rem)] w-full overflow-y-auto ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Modal with backdrop and shell on separate z-layers (for click-outside detection refs).
 * Shell uses `pointer-events-none` so pointer events reach the backdrop; panel re-enables them.
 */
export const ModalFrameSplit = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    backdropZClass: string;
    shellZClass: string;
    panelClassName?: string;
  }
>(function ModalFrameSplit({ children, backdropZClass, shellZClass, panelClassName = '' }, ref) {
  return (
    <>
      <div className={`modal-backdrop fixed inset-0 ${backdropZClass}`} aria-hidden />
      <div
        ref={ref}
        className={`fixed inset-0 ${shellZClass} flex items-center justify-center p-4 pointer-events-none`}
      >
        <div
          className={`modal-panel animate-modal-in pointer-events-auto relative max-h-[min(90vh,48rem)] w-full overflow-y-auto ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
});

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-divider bg-subtle px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" style={{ boxShadow: '0 0 6px var(--accent)' }} />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[14px] text-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3 self-start sm:self-auto">{actions}</div> : null}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  tone = 'accent',
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: 'from-muted/15',
    accent: 'from-accent/20',
    emerald: 'from-emerald/20',
    amber: 'from-amber/20',
    rose: 'from-rose/20',
    cyan: 'from-cyan/20',
    pink: 'from-pink/20',
    sky: 'from-sky/20',
    indigo: 'from-indigo/20',
  };
  const toneIcon: Record<Tone, string> = {
    neutral: 'text-muted border-divider',
    accent: 'text-accent border-accent/25',
    emerald: 'text-emerald border-emerald/25',
    amber: 'text-amber border-amber/25',
    rose: 'text-rose border-rose/25',
    cyan: 'text-cyan border-cyan/25',
    pink: 'text-pink border-pink/25',
    sky: 'text-sky border-sky/25',
    indigo: 'text-indigo border-indigo/25',
  };
  return (
    <div className="glass-card group relative overflow-hidden p-6 transition-all duration-300 hover:scale-[1.02]">
      <div
        className={`pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br ${toneBg[tone]} to-transparent blur-3xl opacity-60 transition-opacity duration-500 group-hover:opacity-80`}
      />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted opacity-70">{label}</div>
        {icon ? (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-subtle ${toneIcon[tone]}`}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="relative mt-5 font-display text-3xl font-bold leading-none text-fg tracking-tight">{value}</div>
      {delta ? (
        <div className="relative mt-2 text-[12px] text-muted font-medium">{delta}</div>
      ) : null}
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={`text-[11px] font-semibold uppercase tracking-wider text-muted px-5 py-3 ${alignStyles[align]} first:rounded-tl-2xl last:rounded-tr-2xl ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 text-[13px] text-fg ${alignStyles[align]} ${className}`}>{children}</td>
  );
}

/**
 * Single-line table cell; full value opens in a modal (use for long strings so row heights stay even).
 * Empty `value` shows `emptyLabel` (default `none`) with no popup.
 */
export function TableCellPopover({
  value,
  previewValue,
  emptyLabel = 'none',
  popoverTitle = 'Details',
  className = '',
  hoverClassName = 'hover:bg-subtle/60',
  textClassName = '',
  /** 0 = always offer a popup when non-empty; default 44 = popup only for longer text (keeps short IDs plain). */
  minCharsForPopover = 44,
}: {
  value: string;
  previewValue?: string;
  emptyLabel?: string;
  popoverTitle?: string;
  className?: string;
  /** Hover styling for the clickable preview button. */
  hoverClassName?: string;
  /** Applied to the one-line preview span (e.g. font size). */
  textClassName?: string;
  minCharsForPopover?: number;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trimmed = (value ?? '').trim();
  const previewText = (previewValue ?? trimmed).trim();
  const isEmpty = trimmed.length === 0;
  const preview = previewText.length === 0 ? emptyLabel : previewText;
  const canExpand =
    !isEmpty && (minCharsForPopover === 0 || trimmed.length > minCharsForPopover);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copyFull = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const line = (
    <span
      className={`block truncate text-[14px] font-medium leading-normal ${isEmpty ? 'text-muted' : 'text-fg'} ${textClassName}`}
    >
      {preview}
    </span>
  );

  return (
    <>
      {canExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={`View full ${popoverTitle}`}
          className={`w-full max-w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer ${hoverClassName} ${className}`}
        >
          {line}
        </button>
      ) : (
        <div className={`w-full max-w-full ${isEmpty ? 'text-muted' : ''} ${className}`}>{line}</div>
      )}
      {open && trimmed.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4">
              <div
                className="modal-backdrop absolute inset-0"
                aria-hidden
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="modal-panel animate-modal-in relative z-10 flex max-h-[min(85vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl text-fg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-divider px-5 py-4">
                  <p id={titleId} className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {popoverTitle}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      onClick={() => void copyFull()}
                    >
                      {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-fg [word-break:break-word]">
                    {trimmed}
                  </pre>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function TableShell({
  children,
  className = '',
  tableClassName = '',
}: {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div className={`glass-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className={`table-sticky-head min-w-full border-separate border-spacing-0 ${tableClassName}`}>{children}</table>
      </div>
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-divider px-6 py-16 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-subtle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
          <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-[13px] text-muted opacity-70">{label}</span>
    </div>
  );
}
