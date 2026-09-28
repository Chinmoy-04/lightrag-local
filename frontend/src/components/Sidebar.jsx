import { AlertTriangle, CircleCheck, Database, Loader2, Network, Scale } from 'lucide-react'
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
  onOpenGraph,
  graphOpen,
  onOpenCompare,
  compareOpen,
}) {
  const ready = health?.status === 'ok'
  const statusVariant = healthError ? 'error' : ready ? 'ok' : 'warn'
  const statusLabel = healthError ? 'Backend unreachable' : ready ? 'Ready' : 'Initializing'
  const modesDisabled = isIndexing || graphOpen || compareOpen

  return (
    <aside
      data-lenis-prevent
      className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-sidebar-border bg-sidebar/90 backdrop-blur-sm md:h-full md:w-72 md:border-b-0 md:border-r md:overflow-y-auto lg:w-80"
    >      <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-xs font-semibold tracking-tight text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            LR
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              LightRAG Local
            </h1>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              arXiv:2410.05779
            </p>
          </div>
        </div>
        <SwitchButton size="sm" showLabel={false} className="shrink-0 px-2.5" aria-label="Toggle theme" />
      </div>

      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        <section>
          <div className="flex items-center gap-2">
            <StatusDot variant={statusVariant} pulse={!ready && !healthError} />
            <span className="text-sm font-medium text-sidebar-foreground">{statusLabel}</span>
          </div>
          <dl className="mt-3 divide-y divide-border/70 text-xs">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">Query</dt>
              <dd className="truncate font-mono text-[11px] text-sidebar-foreground">
                {health?.llm_model_query ?? '-'}
              </dd>
            </div>
            {health?.llm_model_extract && health.llm_model_extract !== health.llm_model_query && (
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Extract</dt>
                <dd className="truncate font-mono text-[11px] text-sidebar-foreground">
                  {health.llm_model_extract}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">Embed</dt>
              <dd className="truncate font-mono text-[11px] text-sidebar-foreground">
                {health?.embedding_model ?? '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">Corpus</dt>
              <dd
                className={
                  health?.corpus_present
                    ? 'font-mono text-[11px] text-primary'
                    : 'font-mono text-[11px] text-amber-700 dark:text-amber-400'
                }
              >
                {health?.corpus_present ? 'loaded' : 'missing'}
              </dd>
            </div>
          </dl>
        </section>

        <ModeSelector value={mode} onChange={onModeChange} disabled={modesDisabled} />

        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Knowledge graph</p>
          <Button
            type="button"
            onClick={onIndex}
            disabled={isIndexing || !health?.corpus_present}
            size="lg"
            className="w-full gap-2 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]"
          >
            {isIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {isIndexing ? 'Building graph…' : 'Build knowledge graph'}
          </Button>

          {/* Deliberately quieter than Build: these inspect existing state,
              they don't take the primary action of the sidebar. */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={graphOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onOpenGraph}
              disabled={!ready}
              className="gap-1.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]"
            >
              <Network className="h-3.5 w-3.5" />
              Graph
            </Button>
            <Button
              type="button"
              variant={compareOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onOpenCompare}
              disabled={!ready}
              className="gap-1.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]"
            >
              <Scale className="h-3.5 w-3.5" />
              Compare
            </Button>
          </div>

          {isIndexing && (
            <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
              Extraction runs one chunk at a time on local hardware. Full corpus can take hours.
              Watch the backend terminal; don&apos;t click Build again mid-run.
            </p>
          )}

          {!isIndexing && indexResult && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-2.5 text-xs text-primary ring-1 ring-inset ring-primary/20">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Indexed {indexResult.documents} document{indexResult.documents === 1 ? '' : 's'} (
                {formatChars(indexResult.characters)} chars) in {indexResult.latency_seconds}s.
              </span>
            </div>
          )}

          {!isIndexing && indexError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive ring-1 ring-inset ring-destructive/20">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{indexError}</span>
            </div>
          )}
        </section>

        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
          Corpus: 30 RAG papers. Shared entities give global/hybrid something real to walk.
        </p>
      </div>
    </aside>
  )
}
