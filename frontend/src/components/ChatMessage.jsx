import { AlertTriangle, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import AITextLoading from './kokonutui/ai-text-loading'

// LightRAG's responses regularly include headers, bullet lists, and code
// blocks even when response_type asks for prose, so assistant messages get
// real markdown rendering, mapped onto our theme tokens rather than
// hardcoded colors so it matches both light and dark mode.
const MARKDOWN_COMPONENTS = {
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-foreground first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-foreground first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-2.5 text-sm font-semibold text-foreground first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2.5 overflow-x-auto rounded-lg bg-muted p-2.5 text-[12px] last:mb-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
}

function formatLatency(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

function latencyTone(seconds) {
  if (seconds < 8) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25'
  if (seconds < 25) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25'
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/25'
}

function ModeBadge({ mode }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary ring-1 ring-inset ring-primary/25">
      {mode}
    </span>
  )
}

function LatencyBadge({ seconds }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${latencyTone(seconds)}`}
    >
      <Clock className="h-3 w-3" />
      {formatLatency(seconds)}
    </span>
  )
}

function Paragraphs({ text }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean)
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  )
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[13px] leading-relaxed text-primary-foreground shadow-sm">
          <Paragraphs text={message.content} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div
        className={[
          'max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed shadow-sm',
          message.error
            ? 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25'
            : 'bg-card text-card-foreground ring-1 ring-inset ring-border',
        ].join(' ')}
      >
        {message.error && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Query failed
          </div>
        )}
        {message.error ? (
          <Paragraphs text={message.content} />
        ) : (
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.content}</ReactMarkdown>
        )}
        {!message.error && message.latency != null && (
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
            <ModeBadge mode={message.mode} />
            <LatencyBadge seconds={message.latency} />
          </div>
        )}
      </div>
    </div>
  )
}

const GRAPH_LOADING_PHRASES = [
  'Traversing the graph…',
  'Ranking entities…',
  'Weighing relationships…',
  'Assembling context…',
]

export function ThinkingBubble({ mode }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-[13px] ring-1 ring-inset ring-border">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary ring-1 ring-inset ring-primary/25">
          {mode}
        </span>
        <AITextLoading texts={GRAPH_LOADING_PHRASES} interval={1800} className="text-[13px]" />
      </div>
    </div>
  )
}
