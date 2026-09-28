import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ReactLenis } from 'lenis/react'
import {
  AlertTriangle,
  Clock,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  Scale,
  X,
  XCircle,
} from 'lucide-react'
import { getCompare } from '../api'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

const MODE_ORDER = ['naive', 'local', 'global', 'hybrid']

const MODE_META = {
  naive: {
    label: 'Naive',
    blurb: 'Vector chunks only, no graph walk.',
    tooltip:
      'Classic RAG: embed the question, pull similar text chunks, generate an answer. No knowledge-graph traversal.',
    color: '#a89a7c',
  },
  local: {
    label: 'Local',
    blurb: 'Entity-neighborhood graph retrieval.',
    tooltip:
      'Finds entities close to the question, then walks their local neighborhood in the graph for context.',
    color: '#b4650f',
  },
  global: {
    label: 'Global',
    blurb: 'Relation / high-level graph retrieval.',
    tooltip:
      'Looks at relationships across the graph for high-level themes, not just nearby entities.',
    color: '#7a4108',
  },
  hybrid: {
    label: 'Hybrid',
    blurb: 'Local + global combined context.',
    tooltip:
      'Merges local entity neighborhoods with global relation context, then generates the answer.',
    color: '#d97706',
  },
}

const JUDGE_AXES = [
  {
    key: 'comprehensiveness',
    short: 'C',
    label: 'Comprehensiveness',
    tip: 'How thoroughly the answer covers important aspects of the question (1-10).',
  },
  {
    key: 'diversity',
    short: 'D',
    label: 'Diversity',
    tip: 'How many distinct perspectives or facets appear, without repetitive fluff (1-10).',
  },
  {
    key: 'empowerment',
    short: 'E',
    label: 'Empowerment',
    tip: 'How well the answer helps a reader understand the topic and act on it (1-10).',
  },
]

function formatLatency(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '-'
  if (seconds < 60) return `${Number(seconds).toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function formatChars(n) {
  if (n == null) return '-'
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

function Tip({ label, children, side = 'top' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1 border-b border-dotted border-muted-foreground/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

function buildConclusion(data, ordered) {
  const queryModel = data.llm?.llm_model_query || 'the local model'
  const provider = data.llm?.llm_provider
  const cloudQuery = provider === 'openai' || /deepseek|gpt|groq/i.test(queryModel)
  const winner = data.paper_judge?.winner
  const winnerLabel = winner ? MODE_META[winner]?.label || winner : null
  const ok = ordered.filter((p) => p.ok)
  const maxLat = Math.max(...ok.map((p) => p.latency_seconds || 0), 0)
  const minLat = Math.min(...ok.map((p) => p.latency_seconds || Infinity))

  if (cloudQuery && ok.length >= 4 && maxLat < 60) {
    return (
      <>
        Answers here came from <strong>{queryModel}</strong>; the graph underneath is still the
        old local 8B extract. Everything finished in about {minLat.toFixed(0)}-
        {maxLat.toFixed(0)} seconds, which is a huge relief after global used to sit there for
        half an hour.
        {winnerLabel ? (
          <>
            {' '}
            Even so, the judge liked <strong>{winnerLabel}</strong> best. Hybrid and global write
            more cleanly now, but they didn&apos;t overtake plain chunk retrieval, so we&apos;re
            probably bottlenecked on the graph, not the writer.
          </>
        ) : (
          <> Run the judge script if you want scores on top of latency.</>
        )}
      </>
    )
  }

  if (maxLat >= 300) {
    return (
      <>
        Local 8B is fine for <strong>naive</strong> / <strong>local</strong>. Global and hybrid
        can wander off for ages (we once got a wall of repeated text). If you want those modes to
        feel usable, point query at DeepSeek in <code className="text-xs">.env</code>. Fastest
        this time: <strong>{MODE_META[data.fastest]?.label || data.fastest || '-'}</strong>.
      </>
    )
  }

  return (
    <>
      Fastest this time: <strong>{MODE_META[data.fastest]?.label || data.fastest || '-'}</strong>
      {winnerLabel ? (
        <>
          . Judge went with <strong>{winnerLabel}</strong>.
        </>
      ) : (
        '.'
      )}{' '}
      Longer notes are in the README if you care.
    </>
  )
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
  const hasJudge = Boolean(data?.paper_judge?.scores)

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Compare</h2>
              <p className="text-[11px] text-muted-foreground">
                Same prompt across LightRAG modes
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

        <ReactLenis
          className="chat-scroll"
          options={{
            autoRaf: true,
            lerp: 0.08,
            smoothWheel: true,
            syncTouch: true,
            touchMultiplier: 1.2,
            allowNestedScroll: true,
            respectReducedMotion: true,
          }}
        >
          <div className="px-4 py-5 md:px-8">
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
              <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <section className="border-b border-border pb-4">
                  <p className="text-xs font-medium text-muted-foreground">Shared test prompt</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground md:text-[15px]">
                    {data.prompt}
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {data.num_ok}/{data.num_pipelines} answered · fastest{' '}
                    {MODE_META[data.fastest]?.label || data.fastest || '-'} (
                    {formatLatency(data.fastest_latency_seconds)})
                    {data.paper_judge?.winner
                      ? ` · judge winner ${MODE_META[data.paper_judge.winner]?.label || data.paper_judge.winner}`
                      : ''}
                  </p>
                </section>

                <section>
                  {/* Column headers so metrics are not cryptic */}
                  <div className="mb-1 hidden items-center gap-3 px-1 text-[11px] font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1.4fr)_auto]">
                    <span>Mode</span>
                    <div className="flex items-center gap-4 font-mono">
                      <Tip label="Wall-clock time to retrieve context and generate the answer.">
                        <span className="inline-flex w-14 justify-end gap-1">
                          Time <HelpCircle className="h-3 w-3 opacity-60" />
                        </span>
                      </Tip>
                      <Tip label="Length of the generated answer in characters. Longer is not always better.">
                        <span className="inline-flex w-16 justify-end gap-1">
                          Size <HelpCircle className="h-3 w-3 opacity-60" />
                        </span>
                      </Tip>
                      {hasJudge && (
                        <Tip label="LLM-as-judge scores from the LightRAG paper axes (1-10 each). Not a full Ragas eval.">
                          <span className="inline-flex w-[7.5rem] justify-end gap-1">
                            Judge scores <HelpCircle className="h-3 w-3 opacity-60" />
                          </span>
                        </Tip>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-border border-y border-border">
                    {ordered.map((row) => {
                      const meta = MODE_META[row.pipeline] || {
                        label: row.pipeline,
                        blurb: '',
                        tooltip: row.pipeline,
                        color: '#b4650f',
                      }
                      const scores = data.paper_judge?.scores?.[row.pipeline]
                      const active = selectedMode === row.pipeline
                      const value = row.latency_seconds ?? 0
                      const width = row.ok
                        ? Math.max(2, (value / maxLatency) * 100)
                        : Math.max(2, ((row.latency_seconds || maxLatency) / maxLatency) * 100)

                      return (
                        <div
                          key={row.pipeline}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMode(row.pipeline)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedMode(row.pipeline)
                            }
                          }}
                          className={`relative block w-full cursor-pointer overflow-hidden px-1 py-3 text-left outline-none transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:bg-primary/5 ${
                            active ? 'bg-primary/5' : 'hover:bg-muted/40'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${Math.min(100, width)}%`,
                              backgroundColor: row.ok ? meta.color : '#9a3412',
                              opacity: row.ok ? 0.1 : 0.08,
                            }}
                          />

                          <div className="relative flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,1.4fr)_auto] md:items-center md:gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <span
                                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: meta.color }}
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Tip label={meta.tooltip}>
                                    <span className="text-sm font-medium text-foreground">
                                      {meta.label}
                                    </span>
                                  </Tip>
                                  {!row.ok && (
                                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-destructive">
                                      <XCircle className="h-3 w-3" /> failed
                                    </span>
                                  )}
                                  {data.paper_judge?.winner === row.pipeline && (
                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                      judge winner
                                    </span>
                                  )}
                                  {data.fastest === row.pipeline && row.ok && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      fastest
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">{meta.blurb}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pl-3.5 font-mono text-xs text-muted-foreground md:pl-0 md:justify-end">
                              <Tip label={`Latency: ${formatLatency(row.latency_seconds)} to finish this mode.`}>
                                <span className="inline-flex w-auto items-center justify-end gap-1 md:w-14">
                                  <Clock className="h-3 w-3" />
                                  {formatLatency(row.latency_seconds)}
                                </span>
                              </Tip>

                              <Tip label={`Answer length: ${formatChars(row.chars)} characters of generated text.`}>
                                <span className="inline-flex w-auto items-center justify-end gap-1 md:w-16">
                                  <FileText className="h-3 w-3" />
                                  {formatChars(row.chars)}
                                </span>
                              </Tip>

                              {scores ? (
                                <div className="inline-flex w-auto items-center justify-end gap-1.5 md:w-[7.5rem]">
                                  {JUDGE_AXES.map((axis) => (
                                    <Tip
                                      key={axis.key}
                                      label={`${axis.label}: ${scores[axis.key] ?? '-'}/10. ${axis.tip}`}
                                    >
                                      <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[11px] text-foreground">
                                        {axis.short}
                                        {scores[axis.key] ?? '-'}
                                      </span>
                                    </Tip>
                                  ))}
                                </div>
                              ) : hasJudge ? (
                                <span className="w-auto text-right md:w-[7.5rem]">-</span>
                              ) : null}
                            </div>
                          </div>

                          {row.error && (
                            <p className="relative mt-1.5 pl-3.5 font-mono text-[11px] text-destructive md:pl-3.5">
                              {row.error}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {hasJudge && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      Hover any score chip for the full axis name. Scores are 1-10 from an LLM
                      judge
                      {data.paper_judge.model ? ` (${data.paper_judge.model})` : ''}, matching
                      the LightRAG paper axes, not a full Ragas eval.
                    </p>
                  )}
                </section>

                <section className="border-b border-border pb-4">
                  <p className="text-xs font-medium text-muted-foreground">What we noticed</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                    {buildConclusion(data, ordered)}
                  </p>
                  {data.paper_judge?.rationale && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {data.paper_judge.rationale}
                    </p>
                  )}
                </section>

                <section>
                  {selected && (
                    <div>
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
                        <div className="prose-sm mt-3 max-w-none text-sm leading-relaxed text-foreground">
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
        </ReactLenis>
      </div>
    </TooltipProvider>
  )
}
