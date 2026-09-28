import { Send, Square } from 'lucide-react'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

export default function Composer({ value, onChange, onSubmit, onStop, disabled, placeholder }) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 44, maxHeight: 160 })

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit()
    adjustHeight(true)
  }

  const canSend = !disabled && value.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 shadow-[var(--shadow-warm)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        <Textarea
          ref={textareaRef}
          rows={1}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 disabled:opacity-70"
        />
        {disabled ? (
          <Button
            type="button"
            onClick={onStop}
            size="icon"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-lg transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.96]"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSend}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.96]"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-1.5 px-1 font-mono text-[11px] text-muted-foreground">
        {disabled ? 'Generating, click stop to cancel' : 'Enter send · Shift+Enter newline'}
      </p>
    </form>
  )
}
