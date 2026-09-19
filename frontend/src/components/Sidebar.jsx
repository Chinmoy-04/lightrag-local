import { AlertTriangle, CircleCheck, Database, Loader2 } from 'lucide-react'
import ModeSelector from './ModeSelector'
import StatusDot from './StatusDot'
import SwitchButton from './kokonutui/switch-button'
import { Button } from './ui/button'

function formatChars(chars) {
  if (!chars) return '0'
  if (chars > 1_000_000) return `${(chars / 1_000_000).toFixed(2)}M`
  if (chars > 1_000) return `${(chars / 1_000).toFixed(0)}K`
  return String(chars)
}

export default function Sidebar({
  health,
  healthError,
  mode,
  onModeChange,
  isIndexing,
  indexResult,
  indexError,
  onIndex,
}) {
  const ready = health?.status === 'ok'
  const statusVariant = healthError ? 'error' : ready ? 'ok' : 'warn'
  const statusLabel = healthError ? 'Backend unreachable' : ready ? 'Ready' : 'Initializing'

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-sidebar-border bg-sidebar p-5 md:h-screen md:w-80 md:border-b-0 md:border-r md:overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            LR
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-foreground">LightRAG Local</h1>
            <p className="text-[11px] text-muted-foreground">arXiv:2410.05779 · fully offline</p>
          </div>
        </div>
        <SwitchButton size="sm" showLabel={false} className="shrink-0 px-2.5" aria-label="Toggle theme" />
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-center gap-2">
          <StatusDot variant={statusVariant} pulse={!ready && !healthError} />
          <span className="text-sm font-medium text-card-foreground">{statusLabel}</span>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Query LLM</dt>
            <dd className="font-mono text-card-foreground">{health?.llm_model_query ?? '—'}</dd>
          </div>
          {health?.llm_model_extract && health.llm_model_extract !== health.llm_model_query && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Extract LLM</dt>
              <dd className="font-mono text-card-foreground">{health.llm_model_extract}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Embeddings</dt>
            <dd className="font-mono text-card-foreground">{health?.embedding_model ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Corpus</dt>
            <dd className={health?.corpus_present ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}>
              {health?.corpus_present ? 'loaded' : 'missing'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Mode selector */}
      <ModeSelector value={mode} onChange={onModeChange} disabled={isIndexing} />

      {/* Index control */}
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Knowledge graph
        </span>
        <Button
          type="button"
          onClick={onIndex}
          disabled={isIndexing || !health?.corpus_present}
          size="lg"
          className="mt-2 w-full gap-2"
        >
          {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {isIndexing ? 'Building graph…' : 'Build knowledge graph'}
        </Button>

        {isIndexing && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Entity extraction runs one chunk at a time on local hardware — this can take
            several hours for the full corpus. Progress is in the backend terminal log.
          </p>
        )}

        {!isIndexing && indexResult && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-primary/10 p-2.5 text-xs text-primary ring-1 ring-inset ring-primary/20">
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Indexed {indexResult.documents} document{indexResult.documents === 1 ? '' : 's'} (
              {formatChars(indexResult.characters)} chars) in {indexResult.latency_seconds}s.
            </span>
          </div>
        )}

        {!isIndexing && indexError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive ring-1 ring-inset ring-destructive/20">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{indexError}</span>
          </div>
        )}
      </div>

      <div className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
        Indexed corpus: 30 recent papers on retrieval-augmented generation, so shared
        entities give global/hybrid mode something real to traverse.
      </div>
    </aside>
  )
}
