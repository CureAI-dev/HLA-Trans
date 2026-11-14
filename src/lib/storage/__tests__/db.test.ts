import { beforeEach, expect, test, vi } from "vitest"
import { DEFAULT_CRITERIA } from "../../../domain/criteria"
import { defaultPairInputs } from "../../../domain/factories"
import { createLocalStore, StorageWriteError } from "../local-store"
import { dbSchema } from "../../../domain/schema"

class MemoryStorage {
  data = new Map<string, string>()
  fail = false
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new DOMException("full", "QuotaExceededError")
    this.data.set(key, value)
  }
}
let storage: MemoryStorage
test.each(["getter", "read"] as const)(
  "blocked storage %s preserves data and exposes typed errors",
  async (failure) => {
    const { initialDb, DB_KEY, actions } = await import("../db")
    const { StorageWriteError: ActionStorageError } =
      await import("../local-store")
    const original = JSON.stringify(initialDb())
    storage.data.set(DB_KEY, original)
    const denied = new DOMException("denied", "SecurityError")
    const store = createLocalStore({
      key: DB_KEY,
      schema: dbSchema,
      initial: initialDb,
    })
    if (failure === "getter")
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw denied
        },
      })
    else
      vi.spyOn(storage, "getItem").mockImplementation(() => {
        throw denied
      })
    for (const operation of [
      () => store.set(initialDb()),
      () => store.update((db) => db),
      () => store.get(),
      () => store.sizeInBytes(),
    ]) {
      expect(operation).toThrow(StorageWriteError)
      expect(operation).toThrowError(expect.objectContaining({ cause: denied }))
    }
    expect(() => actions.setClinician("Denied")).toThrow(ActionStorageError)
    expect(() => actions.setClinician("Denied")).toThrowError(
      expect.objectContaining({ cause: denied })
    )
    expect(storage.data.get(DB_KEY)).toBe(original)
    if (failure === "getter")
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: storage,
      })
    else vi.mocked(storage.getItem).mockRestore()
    expect(store.get()!.clinicianName).toBe("")
    const cached = store.get()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw denied
      },
    })
    expect(() =>
      store.set({ ...initialDb(), clinicianName: "Changed" })
    ).toThrow(StorageWriteError)
    expect(() =>
      store.update((db) => {
        db.clinicianName = "Changed"
        return db
      })
    ).toThrow(StorageWriteError)
    expect(store.get()).toBe(cached)
    expect(storage.data.get(DB_KEY)).toBe(original)
  }
)
beforeEach(() => {
  vi.resetModules()
  storage = new MemoryStorage()
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})
test("saves, reloads, snapshots and audits without reference mutation", async () => {
  const { actions, dbStore, initialDb, DB_KEY } = await import("../db")
  actions.loadSampleData()
  const db = dbStore.get()!
  const p = db.patients[0]
  const e = actions.createEvaluation(p.id, db.donors[0].id, defaultPairInputs())
  const edited = structuredClone(p)
  edited.identity.firstName = "Edited"
  actions.savePatient(edited)
  expect(dbStore.get()!.evaluations[0].patientSnapshot.identity.firstName).toBe(
    e.patientSnapshot.identity.firstName
  )
  expect(Object.isFrozen(dbStore.get()!.patients[0].identity)).toBe(true)
  expect(
    createLocalStore({
      key: DB_KEY,
      schema: dbSchema,
      initial: initialDb,
    }).get()
  ).toEqual(dbStore.get())
  expect(dbStore.get()!.audit.map((a) => a.action)).toEqual([
    "data.seeded",
    "evaluation.created",
    "patient.updated",
  ])
})
test("decisions enforce documentation, acknowledgement and finality", async () => {
  const { actions, dbStore, DbActionError } = await import("../db")
  actions.loadSampleData()
  const db = dbStore.get()!
  const e = actions.createEvaluation(
    db.patients[0].id,
    db.donors[0].id,
    defaultPairInputs()
  )
  const decision = {
    verdict: "decline" as const,
    reasons: [],
    clinician: "Dr Test",
    rationale: "Reason",
    acknowledgedFindings: true,
  }
  expect(() => actions.decide(e.id, decision)).toThrow(DbActionError)
  const accept = { ...decision, verdict: "accept" as const }
  expect(() => actions.decide(e.id, { ...accept, clinician: " " })).toThrow(
    DbActionError
  )
  expect(() => actions.decide(e.id, { ...accept, rationale: " " })).toThrow(
    DbActionError
  )
  expect(() =>
    actions.decide(e.id, { ...accept, acknowledgedFindings: false })
  ).toThrow(DbActionError)
  actions.decide(e.id, accept)
  expect(() => actions.decide(e.id, accept)).toThrow(DbActionError)
})
test("criteria version, invalid import and quota failures preserve cache", async () => {
  const { actions, dbStore, DbActionError } = await import("../db")
  expect(actions.publishCriteria(DEFAULT_CRITERIA, "Updated").version).toBe(2)
  const before = dbStore.get()
  expect(() => actions.importDb("invalid JSON")).toThrow(DbActionError)
  expect(dbStore.get()).toBe(before)
  storage.fail = true
  expect(() => actions.setClinician("New")).toThrowError(
    expect.objectContaining({ name: "StorageWriteError" })
  )
  expect(dbStore.get()).toBe(before)
})
test("all record actions audit, sample merge is idempotent, imports and reset audit", async () => {
  const { actions, dbStore } = await import("../db")
  actions.setClinician("Dr Test")
  actions.loadSampleData()
  const first = dbStore.get()!
  actions.loadSampleData()
  expect(dbStore.get()!.patients.length).toBe(first.patients.length)
  const patient = structuredClone(first.patients[0])
  patient.id = "new-patient"
  const donor = structuredClone(first.donors[0])
  donor.id = "new-donor"
  actions.savePatient(patient)
  actions.saveDonor(donor)
  actions.saveDonor(donor)
  actions.deletePatient(patient.id)
  actions.deleteDonor(donor.id)
  expect(dbStore.get()!.audit.map((a) => a.action)).toEqual([
    "data.seeded",
    "data.seeded",
    "patient.created",
    "donor.created",
    "donor.updated",
    "patient.deleted",
    "donor.deleted",
  ])
  const counts = actions.importDb(JSON.parse(actions.exportDb()))
  expect(counts.patients).toBe(first.patients.length)
  expect(dbStore.get()!.audit.at(-1)!.action).toBe("data.imported")
  actions.reset()
  expect(dbStore.get()!.patients).toEqual([])
  expect(dbStore.get()!.audit.at(-1)!.action).toBe("data.reset")
  expect(dbStore.get()!.audit.at(-1)!.actor).toBe("Dr Test")
})
test("invalid writes and criteria ordering do not modify data", async () => {
  const { actions, dbStore, DbActionError } = await import("../db")
  const criteria = structuredClone(DEFAULT_CRITERIA)
  criteria.size.phmRatioPassMin = 0.5
  expect(() => actions.publishCriteria(criteria, "Bad ordering")).toThrow(
    DbActionError
  )
  const before = dbStore.get()
  expect(() =>
    dbStore.set({ ...before!, clinicianName: 42 } as never)
  ).toThrow()
  expect(dbStore.get()).toBe(before)
})
test("cross-tab storage events reload validated state and notify subscribers", async () => {
  const { initialDb, DB_KEY } = await import("../db")
  const store = createLocalStore({
    key: DB_KEY,
    schema: dbSchema,
    initial: initialDb,
  })
  const listener = vi.fn()
  const stop = store.subscribe(listener)
  store.get()
  const fresh = initialDb()
  fresh.clinicianName = "Other tab"
  storage.setItem(DB_KEY, JSON.stringify(fresh))
  const handler = vi.mocked(window.addEventListener).mock.calls[0][1]
  if (typeof handler !== "function") throw new Error("Expected event listener")
  handler({ key: DB_KEY } as StorageEvent)
  expect(listener).toHaveBeenCalledOnce()
  expect(store.get()!.clinicianName).toBe("Other tab")
  stop()
  expect(window.removeEventListener).toHaveBeenCalled()
})
test("failed functional writes cannot mutate cached state", async () => {
  const { initialDb, DB_KEY } = await import("../db")
  const store = createLocalStore({
    key: DB_KEY,
    schema: dbSchema,
    initial: initialDb,
  })
  const before = store.get()
  storage.fail = true
  expect(() =>
    store.update((db) => {
      db.clinicianName = "Mutation"
      return db
    })
  ).toThrow(StorageWriteError)
  expect(store.get()).toBe(before)
  expect(store.get()!.clinicianName).toBe("")
})
test("corruption is backed up and backup failure prevents overwriting original", async () => {
  const { initialDb, DB_KEY } = await import("../db")
  storage.data.set(DB_KEY, "corrupt")
  const store = createLocalStore({
    key: DB_KEY,
    schema: dbSchema,
    initial: initialDb,
  })
  expect(store.get()!.patients).toEqual([])
  expect(store.recoveryNotice()).toBeTruthy()
  expect(
    [...storage.data.keys()].some((k) => k.startsWith(`${DB_KEY}.corrupt.`))
  ).toBe(true)
  const blocked = createLocalStore({
    key: DB_KEY,
    schema: dbSchema,
    initial: initialDb,
  })
  storage.fail = true
  blocked.get()
  storage.fail = false
  expect(() => blocked.set(initialDb())).toThrow(StorageWriteError)
  expect(storage.getItem(DB_KEY)).toBe("corrupt")
})
