import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'
import { Sparkles } from 'lucide-react'
import { getHealth, postIndex, postQuery } from './api'
import Sidebar from './components/Sidebar'
import Composer from './components/Composer'
import ChatMessage, { ThinkingBubble } from './components/ChatMessage'
import GraphViewer from './components/GraphViewer'
import CompareView from './components/CompareView'

const EXAMPLE_PROMPTS = [
  'How do these papers combine knowledge graphs with retrieval-augmented generation?',
  'What approaches are used for multi-hop reasoning in RAG systems?',
  'What privacy or safety risks do these papers raise about RAG?',
]

const HEALTH_POLL_MS = 20_000

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

  const scrollAnchorRef = useRef(null)
  const lenis = useLenis()

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

  useEffect(() => {
    if (view !== 'chat') return
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    if (lenis) {
      lenis.scrollTo(anchor, { duration: 0.6 })
    } else {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isQuerying, lenis, view])

  async function handleIndex() {
    setIsIndexing(true)
    setIndexError(null)
    setIndexResult(null)
    try {
      const result = await postIndex()
      setIndexResult(result)
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

    try {
      const result = await postQuery(trimmed, mode)
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
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', error: true, content: error.message },
      ])
    } finally {
      setIsQuerying(false)
    }
  }

  const graphOpen = view === 'graph'
  const compareOpen = view === 'compare'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
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

      <main className="flex min-h-screen min-h-0 flex-1 flex-col">
        {graphOpen ? (
          <GraphViewer onClose={() => setView('chat')} />
        ) : compareOpen ? (
          <CompareView onClose={() => setView('chat')} />
        ) : (
          <>
            <ReactLenis root="asChild" options={{ autoRaf: true }}>
              <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
                {messages.length === 0 ? (
                  <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">
                      Ask about the indexed RAG papers
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Pick a retrieval mode on the left, then ask a question. Try one below —
                      or open Compare for the saved four-mode scorecard.
                    </p>
                    <div className="mt-5 flex w-full flex-col gap-2">
                      {EXAMPLE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendPrompt(prompt)}
                          className="rounded-xl border border-border bg-card px-4 py-2.5 text-left
                                     text-sm text-card-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-2xl flex-col gap-3">
                    {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                    {isQuerying && <ThinkingBubble mode={mode} />}
                    <div ref={scrollAnchorRef} />
                  </div>
                )}
              </div>
            </ReactLenis>

            <div className="mx-auto w-full max-w-2xl">
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={() => sendPrompt(input)}
                disabled={isQuerying}
                placeholder={`Ask something · ${mode} mode`}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
