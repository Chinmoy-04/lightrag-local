import ReactMarkdown from 'react-markdown'
import { AlertIcon, ClockIcon, Spinner } from './Icons'

// LightRAG's responses regularly include headers, bullet lists, and code
// blocks even when response_type asks for prose, so assistant messages get
// real markdown rendering. Mapped to Tailwind utilities directly rather than
// pulling in @tailwindcss/typography for a handful of element types.
const MARKDOWN_COMPONENTS = {
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-slate-100 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-slate-100 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-2.5 text-sm font-semibold text-slate-200 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-50">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[12px] text-slate-200">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2.5 overflow-x-auto rounded-lg bg-black/40 p-2.5 text-[12px] last:mb-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-slate-600 pl-3 text-slate-400 last:mb-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-white/10" />,
}

function formatLatency(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

function latencyTone(seconds) {
  if (seconds < 8) return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
  if (seconds < 25) return 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
  return 'bg-rose-500/15 text-rose-300 ring-rose-500/25'
}

function ModeBadge({ mode }) {
  return (
    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium capitalize text-violet-300 ring-1 ring-inset ring-violet-500/25">
      {mode}
    </span>
  )
}

function LatencyBadge({ seconds }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${latencyTone(seconds)}`}
    >
      <ClockIcon className="h-3 w-3" />
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
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
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
            ? 'bg-rose-950/50 text-rose-200 ring-1 ring-inset ring-rose-500/30'
            : 'bg-slate-800/80 text-slate-100 ring-1 ring-inset ring-slate-700/60',
        ].join(' ')}
      >
        {message.error && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <AlertIcon className="h-3.5 w-3.5" />
            Query failed
          </div>
        )}
        {message.error ? (
          <Paragraphs text={message.content} />
        ) : (
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.content}</ReactMarkdown>
        )}
        {!message.error && message.latency != null && (
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
            <ModeBadge mode={message.mode} />
            <LatencyBadge seconds={message.latency} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ThinkingBubble({ mode }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-slate-800/80 px-4 py-3 text-[13px] text-slate-400 ring-1 ring-inset ring-slate-700/60">
        <Spinner className="h-3.5 w-3.5 text-violet-400" />
        <span>
          Traversing the graph in <span className="font-medium capitalize text-slate-300">{mode}</span> mode…
        </span>
      </div>
    </div>
  )
}
