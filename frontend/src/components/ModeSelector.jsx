const MODES = [
  { id: 'naive', label: 'Naive', hint: 'Plain vector search over chunks, no graph traversal.' },
  { id: 'local', label: 'Local', hint: 'Entity-centric: pulls in the entities closest to the query.' },
  { id: 'global', label: 'Global', hint: 'Relationship-centric: reasons over how entities connect.' },
  { id: 'hybrid', label: 'Hybrid', hint: 'Combines local and global context for the fullest answer.' },
]

export default function ModeSelector({ value, onChange, disabled }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Retrieval mode
      </span>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {MODES.map((mode) => {
          const active = value === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              title={mode.hint}
              disabled={disabled}
              onClick={() => onChange(mode.id)}
              className={[
                'rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                'disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40'
                  : 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border hover:bg-muted',
              ].join(' ')}
            >
              {mode.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {MODES.find((mode) => mode.id === value)?.hint}
      </p>
    </div>
  )
}

export { MODES }
