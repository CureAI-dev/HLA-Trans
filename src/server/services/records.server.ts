import type { Db } from "../db/client.server"
import { enqueueRun } from "../repos/runs.server"
import { getDonor, insertDonor } from "../repos/donors.server"
import { getPatient, insertPatient } from "../repos/patients.server"
import type { Donor, Patient } from "@/domain/schema"
import type { Versioned } from "@/domain/match-types"

const patientLabel = (p: Patient) =>
  `${p.identity.firstName} ${p.identity.lastName} (${p.identity.mrn})`
const donorLabel = (d: Donor) => d.identity.donorId

export async function createPatientWithRun(
  db: Db,
  input: Patient,
  actor: string
) {
  return db.transaction(async (tx) => {
    const patient: Versioned<Patient> = await insertPatient(tx, input, actor)
    const runId = await enqueueRun(tx, {
      subjectKind: "patient",
      subjectId: patient.record.id,
      subjectLabel: patientLabel(patient.record),
      trigger: "patient.created",
      actor,
    })
    return { patient, runId }
  })
}

export async function createDonorWithRun(db: Db, input: Donor, actor: string) {
  return db.transaction(async (tx) => {
    const donor: Versioned<Donor> = await insertDonor(tx, input, actor)
    const runId = await enqueueRun(tx, {
      subjectKind: "donor",
      subjectId: donor.record.id,
      subjectLabel: donorLabel(donor.record),
      trigger: "donor.created",
      actor,
    })
    return { donor, runId }
  })
}

export async function rerunForPatient(db: Db, id: string, actor: string) {
  return db.transaction(async (tx) => {
    const { record } = await getPatient(tx, id)
    return {
      runId: await enqueueRun(tx, {
        subjectKind: "patient",
        subjectId: id,
        subjectLabel: patientLabel(record),
        trigger: "manual",
        actor,
      }),
    }
  })
}

export async function rerunForDonor(db: Db, id: string, actor: string) {
  return db.transaction(async (tx) => {
    const { record } = await getDonor(tx, id)
    return {
      runId: await enqueueRun(tx, {
        subjectKind: "donor",
        subjectId: id,
        subjectLabel: donorLabel(record),
        trigger: "manual",
        actor,
      }),
    }
  })
}
