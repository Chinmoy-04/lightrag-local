import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, postIndex, postQuery } from './api'
import Sidebar from './components/Sidebar'
import Composer from './components/Composer'
import ChatMessage, { ThinkingBubble } from './components/ChatMessage'
import { SparkleIcon } from './components/Icons'

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

  const [isIndexing, setIsIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState(null)
  const [indexError, setIndexError] = useState(null)

  const scrollAnchorRef = useRef(null)

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
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isQuerying])

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 md:flex-row">
      <Sidebar
        health={health}
        healthError={healthError}
        mode={mode}
        onModeChange={setMode}
        isIndexing={isIndexing}
        indexResult={indexResult}
        indexError={indexError}
        onIndex={handleIndex}
      />

      <main className="flex min-h-screen flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/20">
                <SparkleIcon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-100">
                Ask about the indexed RAG papers
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Pick a retrieval mode on the left, then ask a question. Try one below.
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendPrompt(prompt)}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-left
                               text-sm text-slate-300 transition-colors hover:border-violet-500/40 hover:bg-slate-900"
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

        <div className="mx-auto w-full max-w-2xl">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => sendPrompt(input)}
            disabled={isQuerying}
            placeholder={`Ask something · ${mode} mode`}
          />
        </div>
      </main>
    </div>
  )
}
