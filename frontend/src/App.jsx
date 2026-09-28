import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactLenis } from 'lenis/react'
import { Database, Loader2 } from 'lucide-react'
import { getHealth, postIndex, postQuery } from './api'
import Sidebar from './components/Sidebar'
import Composer from './components/Composer'
import ChatMessage, { ThinkingBubble } from './components/ChatMessage'
import GraphViewer from './components/GraphViewer'
import CompareView from './components/CompareView'
import { Button } from './components/ui/button'

const EXAMPLE_PROMPTS = [
  'How do these papers combine knowledge graphs with retrieval-augmented generation?',
  'What approaches are used for multi-hop reasoning in RAG systems?',
  'What privacy or safety risks do these papers raise about RAG?',
  'Which systems use entity linking or relation extraction before retrieval?',
  'How do the papers evaluate graph-based RAG against naive vector search?',
  'What failure modes appear when the knowledge graph is incomplete or noisy?',
  'Summarize Graph-RAG, CoG, and related methods mentioned in the corpus.',
  'When would hybrid mode help more than local-only retrieval?',
]

const HEALTH_POLL_MS = 20_000

const LENIS_OPTIONS = {
  autoRaf: true,
  lerp: 0.08,
  smoothWheel: true,
  syncTouch: true,
  touchMultiplier: 1.2,
  // Nested scroll containers (e.g. code blocks) stay usable.
  allowNestedScroll: true,
  respectReducedMotion: true,
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)

  const [mode, setMode] = useState('hybrid')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [view, setView] = useState('chat') // 'chat' | 'graph' | 'compare'

  const [isIndexing, setIsIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState(null)
  const [indexError, setIndexError] = useState(null)
  const [hasIndexedThisSession, setHasIndexedThisSession] = useState(false)

  const scrollAnchorRef = useRef(null)
  const queryAbortRef = useRef(null)
  const chatLenisRef = useRef(null)

  const refreshHealth = useCallback(async () => {
    try {
      const data = await getHealth()
      setHealth(data)
      setHealthError(null)
    } catch (error) {
      setHealthError(error.message)
    }
  }, [])

  useEffect(() => {
    refreshHealth()
    const interval = setInterval(refreshHealth, HEALTH_POLL_MS)
    return () => clearInterval(interval)
  }, [refreshHealth])

  // Keep the latest message in view inside the chat Lenis container only.
  useEffect(() => {
    if (view !== 'chat') return
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    const lenis = chatLenisRef.current?.lenis
    if (lenis) {
      lenis.scrollTo(anchor, { offset: 24, duration: 0.9, lerp: 0.1 })
    } else {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isQuerying, view])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && view !== 'chat') {
        setView('chat')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view])

  async function handleIndex() {
    setIsIndexing(true)
    setIndexError(null)
    setIndexResult(null)
    try {
      const result = await postIndex()
      setIndexResult(result)
      setHasIndexedThisSession(true)
    } catch (error) {
      setIndexError(error.message)
    } finally {
      setIsIndexing(false)
      refreshHealth()
    }
  }

  async function sendPrompt(prompt) {
    const trimmed = prompt.trim()
    if (!trimmed || isQuerying) return

    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: trimmed }])
    setInput('')
    setIsQuerying(true)

    const controller = new AbortController()
    queryAbortRef.current = controller

    try {
      const result = await postQuery(trimmed, mode, { signal: controller.signal })
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: result.response,
          latency: result.latency_seconds,
          mode: result.mode,
        },
      ])
    } catch (error) {
      if (error.cancelled) {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', cancelled: true, content: 'Cancelled.' },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', error: true, content: error.message, retryPrompt: trimmed },
        ])
      }
    } finally {
      setIsQuerying(false)
      queryAbortRef.current = null
    }
  }

  function handleStop() {
    queryAbortRef.current?.abort()
  }

  function handleClearThread() {
    setMessages([])
  }

  const graphOpen = view === 'graph'
  const compareOpen = view === 'compare'
  const showIndexAdvisory =
    messages.length === 0 && health?.corpus_present && !hasIndexedThisSession

  return (
    // Viewport-locked shell: sidebar stays put; only the main pane scrolls.
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background text-foreground md:flex-row flex-col">
      <Sidebar
        health={health}
        healthError={healthError}
        mode={mode}
        onModeChange={setMode}
        isIndexing={isIndexing}
        indexResult={indexResult}
        indexError={indexError}
        onIndex={handleIndex}
        onOpenGraph={() => setView(graphOpen ? 'chat' : 'graph')}
        graphOpen={graphOpen}
        onOpenCompare={() => setView(compareOpen ? 'chat' : 'compare')}
        compareOpen={compareOpen}
      />

      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {graphOpen ? (
          <GraphViewer onClose={() => setView('chat')} />
        ) : compareOpen ? (
          <CompareView onClose={() => setView('chat')} />
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {/*
              ReactLenis creates its own wrapper+content divs. Put the height
              constraint on `className` (the wrapper), not on a child with flex-1,
              or the wrapper grows with content and nothing scrolls.
            */}
            <ReactLenis ref={chatLenisRef} className="chat-scroll" options={LENIS_OPTIONS}>
              <div className="px-4 py-8 md:px-10 md:py-10">
                {messages.length === 0 ? (
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                    {showIndexAdvisory && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
                        <p className="max-w-[52ch] leading-relaxed">
                          No graph built this session yet. Naive mode can still hit an existing
                          vector index on disk; local/global/hybrid need the knowledge graph.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleIndex}
                          disabled={isIndexing}
                          className="shrink-0 gap-1.5"
                        >
                          {isIndexing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Database className="h-3.5 w-3.5" />
                          )}
                          Build now
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-10 md:grid-cols-2 md:items-start">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
                          Ask the indexed corpus
                        </h2>
                        <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
                          30 RAG papers. Naive and local answer in seconds; global and hybrid can
                          run much longer depending on the query model.
                        </p>
                        <dl className="mt-6 space-y-2 border-t border-border pt-4 font-mono text-xs">
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted-foreground">corpus</dt>
                            <dd className="text-foreground">
                              {health?.corpus_present ? 'loaded' : 'missing'}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted-foreground">mode</dt>
                            <dd className="text-foreground">{mode}</dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted-foreground">query llm</dt>
                            <dd className="truncate pl-3 text-right text-foreground">
                              {health?.llm_model_query ?? 'unknown'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Try one</p>
                        <div className="prompt-stagger mt-2 flex flex-col divide-y divide-border border-y border-border">
                          {EXAMPLE_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => sendPrompt(prompt)}
                              className="group flex items-baseline gap-2.5 py-3 text-left text-sm text-foreground transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-primary"
                            >
                              <span className="font-mono text-muted-foreground transition-colors group-hover:text-primary">
                                &gt;
                              </span>
                              <span className="leading-snug">{prompt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-4">
                    <div className="flex items-baseline justify-between">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {messages.length} message{messages.length === 1 ? '' : 's'}
                      </p>
                      <button
                        type="button"
                        onClick={handleClearThread}
                        className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Clear thread
                      </button>
                    </div>
                    {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} onRetry={sendPrompt} />
                    ))}
                    {isQuerying && <ThinkingBubble mode={mode} />}
                    <div ref={scrollAnchorRef} />
                  </div>
                )}
              </div>
            </ReactLenis>

            <div className="shrink-0 border-t border-border bg-background">
              <div className="mx-auto w-full max-w-2xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={() => sendPrompt(input)}
                  onStop={handleStop}
                  disabled={isQuerying}
                  placeholder={`Ask something · ${mode} mode`}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
