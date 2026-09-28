const VARIANTS = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-rose-500',
  pending: 'bg-muted-foreground/50',
}

export default function StatusDot({ variant = 'pending', pulse = false }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${VARIANTS[variant]}`}
        />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${VARIANTS[variant]}`} />
    </span>
  )
}
