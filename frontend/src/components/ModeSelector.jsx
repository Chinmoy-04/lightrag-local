import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

const MODES = [
  {
    id: 'naive',
    label: 'Naive',
    hint: 'Plain vector search over chunks, no graph traversal.',
  },
  {
    id: 'local',
    label: 'Local',
    hint: 'Entity-centric: pulls in the entities closest to the query.',
  },
  {
    id: 'global',
    label: 'Global',
    hint: 'Relationship-centric: reasons over how entities connect.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    hint: 'Combines local and global context for the fullest answer.',
  },
]

export default function ModeSelector({ value, onChange, disabled }) {
  return (
    <TooltipProvider>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Retrieval mode</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {MODES.map((mode) => {
            const active = value === mode.id
            return (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(mode.id)}
                    className={[
                      'rounded-md px-2.5 py-2.5 text-sm font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      'active:scale-[0.98]',
                      active
                        ? 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                        : 'bg-secondary/80 text-secondary-foreground ring-1 ring-inset ring-border hover:bg-muted',
                    ].join(' ')}
                  >
                    {mode.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  {mode.hint}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {MODES.find((mode) => mode.id === value)?.hint}
        </p>
      </div>
    </TooltipProvider>
  )
}

export { MODES }
