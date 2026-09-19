import ModeSelector from './ModeSelector'
import StatusDot from './StatusDot'
import { AlertIcon, CheckIcon, DatabaseIcon, Spinner } from './Icons'

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
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-slate-800/80 bg-slate-950/60 p-5 md:h-screen md:w-80 md:border-b-0 md:border-r md:overflow-y-auto">
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-950/40">
            LR
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">LightRAG Local</h1>
            <p className="text-[11px] text-slate-500">arXiv:2410.05779 · fully offline</p>
          </div>
        </div>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
        <div className="flex items-center gap-2">
          <StatusDot variant={statusVariant} pulse={!ready && !healthError} />
          <span className="text-sm font-medium text-slate-200">{statusLabel}</span>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Query LLM</dt>
            <dd className="font-mono text-slate-300">{health?.llm_model_query ?? '—'}</dd>
          </div>
          {health?.llm_model_extract && health.llm_model_extract !== health.llm_model_query && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Extract LLM</dt>
              <dd className="font-mono text-slate-300">{health.llm_model_extract}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Embeddings</dt>
            <dd className="font-mono text-slate-300">{health?.embedding_model ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Corpus</dt>
            <dd className={health?.corpus_present ? 'text-emerald-400' : 'text-amber-400'}>
              {health?.corpus_present ? 'loaded' : 'missing'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Mode selector */}
      <ModeSelector value={mode} onChange={onModeChange} disabled={isIndexing} />

      {/* Index control */}
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Knowledge graph
        </span>
        <button
          type="button"
          onClick={onIndex}
          disabled={isIndexing || !health?.corpus_present}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5
                     text-sm font-semibold text-slate-900 transition-colors hover:bg-white
                     disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          {isIndexing ? <Spinner className="h-4 w-4" /> : <DatabaseIcon className="h-4 w-4" />}
          {isIndexing ? 'Building graph…' : 'Build knowledge graph'}
        </button>

        {isIndexing && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Entity extraction runs one chunk at a time on local hardware — this can take
            several hours for the full corpus. Progress is in the backend terminal log.
          </p>
        )}

        {!isIndexing && indexResult && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Indexed {indexResult.documents} document{indexResult.documents === 1 ? '' : 's'} (
              {formatChars(indexResult.characters)} chars) in {indexResult.latency_seconds}s.
            </span>
          </div>
        )}

        {!isIndexing && indexError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-300 ring-1 ring-rose-500/20">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{indexError}</span>
          </div>
        )}
      </div>

      <div className="mt-auto text-[11px] leading-relaxed text-slate-600">
        Indexed corpus: 30 recent papers on retrieval-augmented generation, so shared
        entities give global/hybrid mode something real to traverse.
      </div>
    </aside>
  )
}
