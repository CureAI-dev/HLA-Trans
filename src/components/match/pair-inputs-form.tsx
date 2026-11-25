import type { PairInputs } from "@/domain/schema"
import { PRESERVATION, CROSSMATCH } from "@/domain/options"
import { NumberField, SelectField } from "@/components/form"

export function PairInputsForm({
  value,
  onChange,
  errors = {},
}: {
  value: PairInputs
  onChange: (value: PairInputs) => void
  errors?: Partial<Record<keyof PairInputs, string>>
}) {
  const times = [
    { key: "distanceNm", label: "Distance", unit: "NM" },
    {
      key: "procurementMinutes",
      label: "Procurement and packaging",
      unit: "minutes",
    },
    { key: "transportMinutes", label: "Transport", unit: "minutes" },
    { key: "implantMinutes", label: "Implant to reperfusion", unit: "minutes" },
  ] as const
  const perfusion = {
    key: "perfusionMinutes",
    label: "Normothermic perfusion",
    unit: "minutes",
  } as const
  const number = (f: (typeof times)[number] | typeof perfusion) => (
    <NumberField
      key={f.key}
      label={f.label}
      unit={f.unit}
      min={0}
      value={value[f.key]}
      error={errors[f.key]}
      onChange={(v) => onChange({ ...value, [f.key]: v })}
    />
  )
  return (
    <section id="pair-inputs" className="space-y-4 border p-4">
      <h2 className="text-lg font-semibold">Pair inputs</h2>
      <p>
        Blank measurements remain not recorded and require review. Perfusion is
        subtracted only for normothermic OCS.
      </p>
      <div
        data-guide="pair-times"
        className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-2"
      >
        {times.map(number)}
      </div>
      <div
        data-guide="pair-preservation"
        className="grid items-end gap-4 md:grid-cols-2"
      >
        {number(perfusion)}
        <SelectField
          label="Preservation method"
          value={value.preservation}
          error={errors.preservation}
          options={PRESERVATION}
          onChange={(v) => onChange({ ...value, preservation: v })}
        />
      </div>
      <div data-guide="pair-crossmatch" className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Flow crossmatch"
          value={value.flowCrossmatch}
          error={errors.flowCrossmatch}
          options={CROSSMATCH}
          onChange={(v) => onChange({ ...value, flowCrossmatch: v })}
        />
        <SelectField
          label="CDC crossmatch"
          value={value.cdcCrossmatch}
          error={errors.cdcCrossmatch}
          options={CROSSMATCH}
          onChange={(v) => onChange({ ...value, cdcCrossmatch: v })}
        />
      </div>
    </section>
  )
}
