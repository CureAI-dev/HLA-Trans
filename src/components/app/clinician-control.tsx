import { useState } from "react"
import { getRouteApi, useRouter } from "@tanstack/react-router"
import { CLINICIAN_COOKIE, writePrefCookie } from "@/lib/prefs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const rootRoute = getRouteApi("__root__")

export function ClinicianControl() {
  const { prefs } = rootRoute.useRouteContext()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(prefs.clinician)
  if (!editing)
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setName(prefs.clinician)
          setEditing(true)
        }}
      >
        Clinician: {prefs.clinician || "Set name"}
      </Button>
    )
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        writePrefCookie(CLINICIAN_COOKIE, name.trim().slice(0, 200))
        setEditing(false)
        void router.invalidate()
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
