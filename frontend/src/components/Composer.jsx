import { Loader2, Send } from 'lucide-react'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

export default function Composer({ value, onChange, onSubmit, disabled, placeholder }) {
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
    <form onSubmit={handleSubmit} className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          disabled={!canSend}
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          aria-label="Send message"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  )
}
