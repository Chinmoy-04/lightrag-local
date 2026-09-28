import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from 'cn'

function TooltipProvider({ delayDuration = 200, ...props }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }) {
  return <TooltipPrimitive.Root {...props} />
}

function TooltipTrigger({ ...props }) {
  return <TooltipPrimitive.Trigger {...props} />
}

function TooltipContent({ className, sideOffset = 6, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground shadow-[var(--shadow-warm)]',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
