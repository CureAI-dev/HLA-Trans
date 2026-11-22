import { useState } from "react"
import type { ReactNode } from "react"
import { flushSync } from "react-dom"
import { Link } from "@tanstack/react-router"
import { OctagonX, TriangleAlert } from "lucide-react"
import type { MatchDetail } from "@/domain/match-types"
import type { RuleId } from "@/domain/schema"
import { Accordion } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FindingRow, RuleAccordionItem } from "./rule-card"
import { VerdictBar } from "./verdict-bar"
import { MissingDataTable } from "./missing-data-table"
import { SideBySide } from "./side-by-side"
import { IschemiaBreakdown } from "./ischemia-breakdown"
import { PairInputsSummary } from "./pair-inputs-summary"
import { LocalTime } from "@/components/app/local-time"

export type ResultInput = Pick<
  MatchDetail,
  "result" | "patient" | "donor" | "pair" | "criteria" | "criteriaVersion"
> &
  Partial<
    Pick<
      MatchDetail,
      "id" | "source" | "outOfDate" | "createdAt" | "createdBy" | "decision"
    >
  >

export function ResultView({
  detail,
  mode,
  onPairFix,
  aside,
}: {
  detail: ResultInput
  mode: "saved" | "preview"
  onPairFix: () => void
  /** Right-hand column (decision panel), pinned at xl. */
  aside?: ReactNode
}) {
  const { result, patient, donor } = detail
  // FAIL and REVIEW rules start open; PASS rules start collapsed.
  const [open, setOpen] = useState<RuleId[]>(() =>
    result.rules.filter((r) => r.status !== "pass").map((r) => r.rule)
  )
  const [tab, setTab] = useState("findings")
  const missing = result.rules.flatMap((r) =>
    r.findings
      .filter((f) => f.missing)
      .map((finding) => ({ rule: r.rule, finding }))
  )
  const goToRule = (id: RuleId) => {
    flushSync(() => {
      setTab("findings")
      setOpen((prev) => (prev.includes(id) ? prev : [...prev, id]))
    })
    document
      .getElementById(`rule-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const savedMeta =
    mode === "saved" && detail.createdAt ? (
      <>
        Saved{" "}
        <time dateTime={detail.createdAt} suppressHydrationWarning>
          <LocalTime value={detail.createdAt} />
        </time>{" "}
        by {detail.createdBy || "Unspecified clinician"}. Records, pair inputs
        and criteria are frozen.
      </>
    ) : null
  return (
    <div>
      <VerdictBar
        overall={result.overall}
        patientName={`${patient.identity.firstName} ${patient.identity.lastName}`.trim()}
        donorCode={donor.identity.donorId}
        sourceLabel={
          mode === "preview"
            ? "Live preview (not saved)"
            : detail.source === "screening"
              ? "Screening result"
              : "Checked pair"
        }
        criteriaVersion={detail.criteriaVersion}
        engineVersion={result.engineVersion}
        outOfDate={detail.outOfDate ?? false}
        rules={result.rules}
        onRule={goToRule}
        meta={savedMeta}
        bleed={mode === "saved"}
      />
      <div
        className={
          aside ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" : undefined
        }
      >
        <div className="min-w-0 space-y-5">
          {detail.outOfDate && (
            <Alert>
              <TriangleAlert aria-hidden="true" className="text-caution" />
              <AlertTitle>Out of date</AlertTitle>
              <AlertDescription>
                The patient, donor or criteria changed after this result was
                saved.{" "}
                <Link
                  to="/matches/check"
                  search={{ patientId: patient.id, donorId: donor.id }}
                  className="underline underline-offset-4"
                >
                  Check the pair again
                </Link>{" "}
                for a current result.
              </AlertDescription>
            </Alert>
          )}
          {result.blockers.length > 0 && (
            <Alert variant="destructive">
              <OctagonX aria-hidden="true" />
              <AlertTitle>Blockers ({result.blockers.length})</AlertTitle>
              <AlertDescription>
                <ul className="w-full">
                  {result.blockers.map((f) => (
                    <FindingRow key={f.code} finding={f} />
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <MissingDataTable
            items={missing}
            patientId={patient.id}
            donorId={donor.id}
            onPairFix={onPairFix}
          />
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="findings">Findings</TabsTrigger>
              <TabsTrigger value="compare">Patient vs donor</TabsTrigger>
              <TabsTrigger value="logistics">
                Pair inputs &amp; ischemia
              </TabsTrigger>
            </TabsList>
            <TabsContent value="findings" className="pt-4">
              <Accordion
                multiple
                value={open}
                onValueChange={(v) => setOpen(v as RuleId[])}
                className="gap-3"
              >
                {result.rules.map((r) => (
                  <RuleAccordionItem key={r.rule} rule={r} />
                ))}
              </Accordion>
            </TabsContent>
            <TabsContent value="compare" className="pt-4">
              <SideBySide patient={patient} donor={donor} />
            </TabsContent>
            <TabsContent value="logistics" className="space-y-4 pt-4">
              <PairInputsSummary
                pair={detail.pair}
                title={mode === "saved" ? "Frozen pair inputs" : "Pair inputs"}
              />
              <IschemiaBreakdown
                pair={detail.pair}
                patient={patient}
                criteria={detail.criteria}
              />
            </TabsContent>
          </Tabs>
        </div>
        {aside && (
          <aside
            aria-label="Decision"
            className="xl:sticky xl:top-40 xl:self-start"
          >
            {aside}
          </aside>
        )}
      </div>
    </div>
  )
}
