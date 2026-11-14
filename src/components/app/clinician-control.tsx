import { useState } from "react"
import { actions, useDb } from "@/lib/storage/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

export function ClinicianControl() {
  const db = useDb()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(db.clinicianName)
  if (!editing)
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setName(db.clinicianName)
          setEditing(true)
        }}
      >
        Clinician: {db.clinicianName || "Set name"}
      </Button>
    )
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        try {
          actions.setClinician(name.trim())
          setEditing(false)
        } catch (error) {
          toast.add({
            title: "Could not save clinician",
            description:
              error instanceof Error ? error.message : "Saving failed.",
            type: "error",
          })
        }
      }}
    >
      <label htmlFor="clinician-name" className="sr-only">
        Clinician name
      </label>
      <Input
        id="clinician-name"
        autoFocus
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        className="w-40"
      />
      <Button size="sm" type="submit">
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
    </form>
  )
}
