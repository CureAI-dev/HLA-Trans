import { useState } from "react"
import type { ReactNode } from "react"
import type { LinkOptions } from "@tanstack/react-router"
import { ageInYears } from "@/domain/calc"
import {
  CANDIDATE_STATE,
  DONOR_STATE,
  SEX,
  URGENCY_STATUS,
  labelOf,
} from "@/domain/options"
import { donorRiskFlags, patientRiskFlags } from "@/domain/risk-flags"
import type { DecisionVerdict } from "@/domain/options"
import {
  CompletenessCard,
  KeyFacts,
  LatestRunView,
  OverviewCard,
  RiskFlagsCard,
} from "@/components/app/detail-overview"
import { RecordActions } from "@/components/app/page-actions"
import { PageHeader } from "@/components/app/page-header"
import { ScreeningResults } from "@/components/donor/screening-results"
import { DecisionPanel } from "@/components/match/decision-panel"
import { MatchTable } from "@/components/match/match-table"
import { ResultView } from "@/components/match/result-view"
import { PatientDerived } from "@/components/patient/patient-summary"
import { donorRecordSections } from "@/components/record/donor-record"
import { patientRecordSections } from "@/components/record/patient-record"
import { RecordView } from "@/components/record/record-view"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGuide } from "../guide-store"
import {
  PRACTICE_CRITERIA,
  practiceMatch,
  practicePair,
  practicePatientRows,
  practiceRun,
  practiceScreening,
} from "../practice"
import { PracticeBanner } from "./practice-banner"

export type RecordTab = "overview" | "record" | "matches"

/** Links on practice screens go nowhere: they are covered during a tutorial and inert otherwise. */
const NOWHERE: LinkOptions = { to: "/" }
const nothing = () => undefined
const asyncNothing = () => Promise.resolve()

function PracticeFrame({ children }: { children: ReactNode }) {
  const running = useGuide((s) => s.active !== null)
  return (
    <>
      <PracticeBanner />
      <div inert={!running}>{children}</div>
    </>
  )
}

export function PracticePatient({
  tab,
  menu,
  onTab,
}: {
  tab: RecordTab
  menu: boolean
  onTab: (tab: RecordTab) => void
}) {
  const [{ patient: p }] = useState(practicePair)
  const [rows] = useState(practicePatientRows)
  const [run] = useState(() => practiceRun("patient"))
  const [menuOpen, setMenuOpen] = useState(false)
  const age = ageInYears(p.identity.dateOfBirth)
  const name = `${p.identity.firstName} ${p.identity.lastName}`
  return (
    <PracticeFrame>
      <PageHeader
        title={name}
        breadcrumbs={[{ label: "Patients" }, { label: name }]}
        badges={
          <>
            <Badge variant="outline">
              {labelOf(CANDIDATE_STATE, p.listing.state)}
            </Badge>
            <Badge variant="outline">
              {p.listing.urgencyStatus
                ? labelOf(URGENCY_STATUS, p.listing.urgencyStatus)
                : "Urgency not recorded"}
            </Badge>
            <Badge variant="outline">ABO {p.blood.abo}</Badge>
            <Badge variant="outline">
              {age} y · {labelOf(SEX, p.identity.sex)}
            </Badge>
          </>
        }
        description={`MRN ${p.identity.mrn} · ${p.identity.transplantCenter} · listed ${p.listing.listingDate}`}
        actions={
          <RecordActions
            entityLabel="patient"
            editLink={NOWHERE}
            checkLink={NOWHERE}
            onRerun={nothing}
            rerunPending={false}
            onDelete={asyncNothing}
            deletePending={false}
            menu={{
              open: menu || menuOpen,
              onOpenChange: setMenuOpen,
              modal: false,
            }}
          />
        }
      />
      <Tabs value={tab} onValueChange={(next) => onTab(next as RecordTab)}>
        <TabsList className="mb-4" data-guide="record-tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="record" data-guide="tab-record">
            Clinical record
          </TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <OverviewCard title="Key facts">
                <KeyFacts
                  sections={patientRecordSections}
                  record={p}
                  paths={[
                    "identity.dateOfBirth",
                    "listing.listingDate",
                    "diagnosis.primary",
                    "support.device",
                    "body.heightCm",
                    "body.weightKg",
                  ]}
                />
              </OverviewCard>
              <OverviewCard title="Derived values">
                <PatientDerived patient={p} />
              </OverviewCard>
            </div>
            <div className="space-y-4">
              <RiskFlagsCard
                flags={patientRiskFlags(
                  p,
                  new Date(),
                  PRACTICE_CRITERIA.criteria
                )}
                editLink={NOWHERE}
              />
              <CompletenessCard
                sections={patientRecordSections}
                record={p}
                priority={["blood.abo", "body.heightCm", "body.weightKg"]}
                editLink={NOWHERE}
              />
              <LatestRunView
                run={run}
                onRerun={nothing}
                rerunPending={false}
                openLink={() => NOWHERE}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="record">
          <div data-guide="record-values">
            <RecordView
              sections={patientRecordSections}
              record={p}
              editLink={NOWHERE}
            />
          </div>
        </TabsContent>
        <TabsContent value="matches">
          <div data-guide="record-matches">
            <MatchTable rows={rows} showPatient={false} emptyText="" />
          </div>
        </TabsContent>
      </Tabs>
    </PracticeFrame>
  )
}

export function PracticeDonor() {
  const [{ donor }] = useState(practicePair)
  const [rows] = useState(practiceScreening)
  const id = donor.identity
  const flags = donorRiskFlags(donor, PRACTICE_CRITERIA.criteria)
  return (
    <PracticeFrame>
      <PageHeader
        title={id.donorId}
        titleClassName="font-mono"
        breadcrumbs={[{ label: "Donors" }, { label: id.donorId }]}
        badges={
          <>
            <Badge variant="outline">{labelOf(DONOR_STATE, id.state)}</Badge>
            <Badge variant="outline">ABO {donor.blood.abo}</Badge>
            <Badge variant="outline">
              {id.ageYears} y · {labelOf(SEX, id.sex)}
            </Badge>
            <Badge variant="outline">{donor.donation.type.toUpperCase()}</Badge>
          </>
        }
        description={id.donorHospital}
      />
      <Tabs defaultValue="matches">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="record">Clinical record</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <RiskFlagsCard flags={flags} editLink={NOWHERE} />
        </TabsContent>
        <TabsContent value="record">
          <RecordView
            sections={donorRecordSections}
            record={donor}
            editLink={NOWHERE}
          />
        </TabsContent>
        <TabsContent value="matches">
          <ScreeningResults
            donorId={donor.id}
            rows={rows}
            criteriaVersion={PRACTICE_CRITERIA.version}
            emptyText=""
          />
        </TabsContent>
      </Tabs>
    </PracticeFrame>
  )
}

export function PracticeRun() {
  const [run] = useState(() => practiceRun("donor"))
  const [rows] = useState(practiceScreening)
  const [tab, setTab] = useState("all")
  return (
    <PracticeFrame>
      <PageHeader
        title={`Matching · ${run.subjectLabel}`}
        description="Screening order: outcome, urgency, pediatric priority, blood type priority, time at status. Not OPTN allocation."
        breadcrumbs={[{ label: "Matching" }, { label: run.subjectLabel }]}
      />
      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        <TabsList className="mb-4" data-guide="run-tabs">
          <TabsTrigger value="all">All ({run.total})</TabsTrigger>
          <TabsTrigger value="pass">Pass ({run.passCount})</TabsTrigger>
          <TabsTrigger value="review">Review ({run.reviewCount})</TabsTrigger>
          <TabsTrigger value="fail">Fail ({run.failCount})</TabsTrigger>
        </TabsList>
      </Tabs>
      <MatchTable
        rows={rows.filter((r) => tab === "all" || r.overall === tab)}
        showDonor={false}
        emptyText="No results in this group."
      />
    </PracticeFrame>
  )
}

export function PracticeResult({
  mode,
  outOfDate,
  tab,
  verdict,
  clinician,
}: {
  mode: "screening" | "checked"
  outOfDate: boolean
  tab: "findings" | "compare"
  verdict?: DecisionVerdict
  clinician: string
}) {
  const [detail] = useState(() => practiceMatch(mode, outOfDate))
  return (
    <PracticeFrame>
      <PageHeader
        title="Match result"
        breadcrumbs={[{ label: "Match results" }, { label: "Match result" }]}
      />
      <ResultView
        key={tab}
        detail={detail}
        mode="saved"
        initialTab={tab}
        onPairFix={nothing}
        aside={
          <DecisionPanel
            detail={detail}
            clinician={clinician}
            practice={{ verdict }}
          />
        }
      />
    </PracticeFrame>
  )
}
