const VARIANTS = {
  ok: 'bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.55)]',
  warn: 'bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.5)]',
  error: 'bg-rose-500 shadow-[0_0_8px_2px_rgba(244,63,94,0.5)]',
  pending: 'bg-muted-foreground/50',
}

export default function StatusDot({ variant = 'pending', pulse = false }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${VARIANTS[variant]}`}
        />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${VARIANTS[variant]}`} />
    </span>
  )
}
