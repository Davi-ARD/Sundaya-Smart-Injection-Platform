import type { ReactNode } from 'react'

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-slate-900 outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100'

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
  step,
  min,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  required?: boolean
  step?: string | number
  min?: string | number
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        step={step}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  required = true,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value as T)}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={fieldClass}
      />
    </label>
  )
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
}
