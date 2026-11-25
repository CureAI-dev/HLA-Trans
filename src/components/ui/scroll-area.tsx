import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "cn"

/**
 * shadcn scroll area, plus three additions: `orientation`, `viewportProps` (id, ref, className)
 * and a Content wrapper so the thumb follows content that grows after mount.
 * Limit the height with a class on the root (`h-full`, `max-h-72`); the viewport fills it.
 */
function ScrollArea({
  className,
  children,
  orientation = "vertical",
  viewportProps,
  contentClassName,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  orientation?: "vertical" | "horizontal" | "both"
  viewportProps?: ScrollAreaPrimitive.Viewport.Props &
    React.RefAttributes<HTMLDivElement>
  contentClassName?: string
}) {
  const x = orientation !== "vertical"
  const y = orientation !== "horizontal"
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative flex min-h-0 min-w-0 flex-col", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        {...viewportProps}
        style={{
          // One axis only, unless both are asked for: the other never shows a track.
          overflowX: x ? "auto" : "hidden",
          overflowY: y ? "auto" : "hidden",
        }}
        className={cn(
          "min-h-0 w-full flex-1 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          x && "data-has-overflow-x:pb-2.5",
          viewportProps?.className
        )}
      >
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          className={contentClassName}
          // Vertical areas keep the viewport's width so wide children scroll inside themselves.
          style={x ? undefined : { minWidth: 0 }}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {y && <ScrollBar />}
      {x && <ScrollBar orientation="horizontal" />}
      {x && y && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "z-30 flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-none bg-input transition-colors hover:bg-muted-foreground/60 active:bg-muted-foreground/60"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
