import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function SubmitButton({
  pending,
  pendingLabel = "Saving…",
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Spinner aria-hidden="true" />}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </Button>
  )
}
