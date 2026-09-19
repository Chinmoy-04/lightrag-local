import { useEffect, useRef } from 'react'
import { SendIcon, Spinner } from './Icons'

export default function Composer({ value, onChange, onSubmit, disabled, placeholder }) {
  const textareaRef = useRef(null)

  // Auto-grow up to a sane cap instead of pulling in a textarea library.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  const canSend = !disabled && value.trim().length > 0

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="border-t border-slate-800/80 bg-slate-950/80 p-4"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-slate-700/60 bg-slate-900 p-2 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/30">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100
                     placeholder:text-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500
                     text-white transition-colors hover:bg-violet-400
                     disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
          aria-label="Send message"
        >
          {disabled ? <Spinner className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-slate-600">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  )
}
