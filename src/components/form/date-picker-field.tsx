import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { parseIsoDate } from "@/domain/dates"
import { FieldFrame, useField } from "./field-frame"
import type { DateFieldProps } from "./date-field"

const pad = (n: number) => String(n).padStart(2, "0")
/** Calendar days are UTC midnights in the domain (parseIsoDate). Keep the picker in the same frame. */
const toIso = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromPicker = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
const toPicker = (d: Date) =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

export type DatePickerFieldProps = DateFieldProps & {
  captionLayout?: "label" | "dropdown"
  fromYear?: number
  toYear?: number
  disableFuture?: boolean
}

export function DatePickerField(props: DatePickerFieldProps) {
  const field = useField(props)
  const [open, setOpen] = useState(false)
  const parsed = props.value ? parseIsoDate(props.value) : null
  const selected = parsed ? toPicker(parsed) : undefined
  const today = new Date()
  const min = props.min ? parseIsoDate(props.min) : null
  const max = props.max ? parseIsoDate(props.max) : null
  return (
    <FieldFrame {...props} id={field.id}>
      <div className="flex gap-1">
        {/* Typed entry stays available: fastest for clinicians with a date in hand. */}
        <Input
          {...field}
          type="date"
          value={props.value}
          min={props.min}
          max={
            props.max ??
            (props.disableFuture ? toIso(fromPicker(today)) : undefined)
          }
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value)}
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={props.disabled}
                aria-label={`Pick ${props.label}`}
              />
            }
          >
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              captionLayout={props.captionLayout ?? "dropdown"}
              startMonth={new Date(props.fromYear ?? 1900, 0)}
              endMonth={new Date(props.toYear ?? today.getFullYear() + 1, 11)}
              disabled={[
                ...(props.disableFuture ? [{ after: today }] : []),
                ...(min ? [{ before: toPicker(min) }] : []),
                ...(max ? [{ after: toPicker(max) }] : []),
              ]}
              onSelect={(d) => {
                if (!d) return
                props.onChange(toIso(fromPicker(d)))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </FieldFrame>
  )
}
