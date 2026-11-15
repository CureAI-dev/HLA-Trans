import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { DatabaseZap } from "lucide-react"
import { importDataFn } from "@/features/data/data.functions"
import { markLegacyImported, readLegacyBackup } from "@/lib/legacy-import"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

export function LegacyImportBanner() {
  const [backup, setBackup] = useState<unknown>(null)
  useEffect(() => setBackup(readLegacyBackup()), []) // client only, after hydration
  const qc = useQueryClient()
  const importer = useMutation({
    mutationKey: ["data", "import-legacy"],
    meta: { errorTitle: "Browser data not imported" },
    mutationFn: () => importDataFn({ data: { backup } }),
    onSuccess: (s) => {
      markLegacyImported()
      setBackup(null)
      toast.add({
        title: "Browser data imported",
        description: `${s.patients} patients, ${s.donors} donors, ${s.matches} match results.`,
      })
      void qc.invalidateQueries()
    },
  })
  if (!backup) return null
  return (
    <Alert className="mb-6">
      <DatabaseZap aria-hidden="true" />
      <AlertTitle>Records found in this browser</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>
          Import them into the shared database. Existing records are never
          overwritten.
        </span>
        <Button
          size="sm"
          onClick={() => importer.mutate()}
          disabled={importer.isPending}
        >
          {importer.isPending && <Spinner />} Import browser data
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            markLegacyImported()
            setBackup(null)
          }}
        >
          Not now
        </Button>
      </AlertDescription>
    </Alert>
  )
}
