import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  RefreshCw,
  Scale,
  X,
  XCircle,
} from 'lucide-react'
import { getCompare } from '../api'
import { Button } from './ui/button'

const MODE_ORDER = ['naive', 'local', 'global', 'hybrid']

const MODE_META = {
  naive: {
    label: 'Naive',
    blurb: 'Vector chunks only — no graph walk.',
    color: '#a89a7c',
  },
  local: {
    label: 'Local',
    blurb: 'Entity-neighborhood graph retrieval.',
    color: '#b4650f',
  },
  global: {
    label: 'Global',
    blurb: 'Relation / high-level graph retrieval.',
    color: '#7a4108',
  },
  hybrid: {
    label: 'Hybrid',
    blurb: 'Local + global combined context.',
    color: '#d97706',
  },
}

function formatLatency(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  if (seconds < 60) return `${Number(seconds).toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function formatChars(n) {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const MARKDOWN = {
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-2.5 text-sm font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>
  ),
}

export default function CompareView({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMode, setSelectedMode] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await getCompare()
      setData(payload)
      const firstOk = payload.pipelines?.find((p) => p.ok)?.pipeline
      setSelectedMode(firstOk || payload.pipelines?.[0]?.pipeline || null)
    } catch (err) {
      setError(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const ordered = useMemo(() => {
    if (!data?.pipelines) return []
    return [...data.pipelines].sort(
      (a, b) => MODE_ORDER.indexOf(a.pipeline) - MODE_ORDER.indexOf(b.pipeline),
    )
  }, [data])

  const maxLatency = useMemo(() => {
    const vals = ordered
      .map((p) => p.latency_seconds)
      .filter((v) => typeof v === 'number' && v > 0)
    return vals.length ? Math.max(...vals) : 1
  }, [ordered])

  const selected = ordered.find((p) => p.pipeline === selectedMode)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Compare</h2>
            <p className="text-[11px] text-muted-foreground">
              Same prompt · LightRAG modes · latency scorecard
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Chat
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        {loading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Could not load comparison</p>
                <p className="mt-1 text-destructive/90">{error}</p>
              </div>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            {/* Prompt */}
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Shared test prompt
              </p>
              <p className="mt-2 text-sm leading-relaxed text-card-foreground md:text-[15px]">
                {data.prompt}
              </p>
            </section>

            {/* Summary strip — Rag-eval-engine style hero metrics */}
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gauge className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Fastest mode</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {MODE_META[data.fastest]?.label || data.fastest || '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatLatency(data.fastest_latency_seconds)} wall time
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {data.num_ok}/{data.num_pipelines}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">modes returned an answer</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Questions</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {data.num_questions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">same prompt across all modes</p>
              </div>
            </section>

            {/* Paper-style LLM judge (optional) */}
            {data.paper_judge?.scores && (
              <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Paper-style comparison
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Lightweight LLM-as-judge on Comprehensiveness / Diversity / Empowerment
                      (LightRAG paper axes) — not a full Ragas eval.
                      {data.paper_judge.model ? ` Judge: ${data.paper_judge.model}` : ''}
                    </p>
                  </div>
                  {data.paper_judge.winner && (
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      Winner: {MODE_META[data.paper_judge.winner]?.label || data.paper_judge.winner}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {MODE_ORDER.map((mode) => {
                    const scores = data.paper_judge.scores[mode]
                    if (!scores) return null
                    const meta = MODE_META[mode]
                    const metrics = [
                      ['Comprehensiveness', scores.comprehensiveness],
                      ['Diversity', scores.diversity],
                      ['Empowerment', scores.empowerment],
                    ]
                    return (
                      <div key={mode} className="rounded-xl border border-border bg-background/50 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                        </div>
                        <div className="space-y-2">
                          {metrics.map(([label, value]) => (
                            <div key={label}>
                              <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                                <span>{label}</span>
                                <span className="font-mono">{value ?? '—'}/10</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, Number(value) || 0) * 10)}%`,
                                    backgroundColor: meta.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {data.paper_judge.rationale && (
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    {data.paper_judge.rationale}
                  </p>
                )}
              </section>
            )}

            {/* Latency chart */}
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Average latency</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    How long each LightRAG mode took (lower is faster). Timed-out runs show wall wait.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {ordered.map((row) => {
                  const meta = MODE_META[row.pipeline] || {
                    label: row.pipeline,
                    color: '#b4650f',
                  }
                  const value = row.latency_seconds ?? 0
                  const width = row.ok
                    ? Math.max(4, (value / maxLatency) * 100)
                    : Math.max(4, ((row.latency_seconds || maxLatency) / maxLatency) * 100)
                  return (
                    <button
                      key={row.pipeline}
                      type="button"
                      onClick={() => setSelectedMode(row.pipeline)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        selectedMode === row.pipeline
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-muted/60'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground">{meta.label}</span>
                        <span className="font-mono text-muted-foreground">
                          {row.ok ? formatLatency(row.latency_seconds) : `timeout · ${formatLatency(row.latency_seconds)}`}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, width)}%`,
                            backgroundColor: row.ok ? meta.color : '#9a3412',
                            opacity: row.ok ? 1 : 0.55,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Pipeline cards */}
            <section className="grid gap-3 sm:grid-cols-2">
              {ordered.map((row) => {
                const meta = MODE_META[row.pipeline] || {
                  label: row.pipeline,
                  blurb: '',
                  color: '#b4650f',
                }
                return (
                  <button
                    key={row.pipeline}
                    type="button"
                    onClick={() => setSelectedMode(row.pipeline)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      selectedMode === row.pipeline
                        ? 'border-primary/50 bg-card shadow-sm'
                        : 'border-border bg-card/80 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <h4 className="text-sm font-semibold text-foreground">{meta.label}</h4>
                      </div>
                      {row.ok ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          <CheckCircle2 className="h-3 w-3" /> ok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                          <XCircle className="h-3 w-3" /> failed
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{meta.blurb}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Latency</dt>
                        <dd className="mt-0.5 font-mono text-foreground">
                          {formatLatency(row.latency_seconds)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Answer size</dt>
                        <dd className="mt-0.5 font-mono text-foreground">{formatChars(row.chars)}</dd>
                      </div>
                    </dl>
                    {row.error && (
                      <p className="mt-2 text-[11px] text-destructive">{row.error}</p>
                    )}
                  </button>
                )
              })}
            </section>

            {/* Analysis conclusion */}
            <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Analysis conclusion
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                On this 8GB local stack, <strong>{MODE_META[data.fastest]?.label || 'naive/local'}</strong>{' '}
                is the interactive winner. Hybrid completed but was ~25× slower. Global timed out on the
                client after a long wait (server-side generation can overrun and hit token limits). Prefer
                naive/local for chat; treat global/hybrid as overnight experiments.
              </p>
            </section>

            {/* Answer panel */}
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <div className="flex flex-wrap gap-2">
                {ordered.map((row) => {
                  const meta = MODE_META[row.pipeline] || { label: row.pipeline }
                  return (
                    <button
                      key={row.pipeline}
                      type="button"
                      onClick={() => setSelectedMode(row.pipeline)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        selectedMode === row.pipeline
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>

              {selected && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {(MODE_META[selected.pipeline] || {}).label || selected.pipeline} answer
                    </span>
                    <span>·</span>
                    <span>{formatLatency(selected.latency_seconds)}</span>
                    {selected.chars != null && (
                      <>
                        <span>·</span>
                        <span>{formatChars(selected.chars)} chars</span>
                      </>
                    )}
                  </div>
                  {selected.ok && selected.response ? (
                    <div className="prose-sm mt-3 max-w-none text-sm leading-relaxed text-card-foreground">
                      <ReactMarkdown components={MARKDOWN}>{selected.response}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No answer captured for this mode
                      {selected.error ? ` (${selected.error})` : ''}.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
