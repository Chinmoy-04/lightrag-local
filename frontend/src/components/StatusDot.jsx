const VARIANTS = {
  ok: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]',
  warn: 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]',
  error: 'bg-rose-500 shadow-[0_0_8px_2px_rgba(244,63,94,0.6)]',
  pending: 'bg-slate-500',
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
