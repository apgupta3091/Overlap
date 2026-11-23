import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  children: ReactNode
  className?: string
}

function FieldShell({ id, label, hint, error, optional, children, className = '' }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  )
}

const control =
  'w-full rounded-lg border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:bg-sunken disabled:text-ink-muted'

function describedBy(id: string, hint?: ReactNode, error?: string) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  prefix?: string
  suffix?: string
  wrapperClassName?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, prefix, suffix, wrapperClassName, id: idProp, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <div className="relative flex items-center">
        {prefix && <span aria-hidden className="pointer-events-none absolute left-3 text-ink-muted">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${control} min-h-11 ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-14' : ''} ${error ? 'border-bad' : 'border-line-strong'} ${className}`}
          {...rest}
        />
        {suffix && <span aria-hidden className="pointer-events-none absolute right-3 text-sm text-ink-muted">{suffix}</span>}
      </div>
    </FieldShell>
  )
})

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode
  hint?: ReactNode
  error?: string
  options: readonly { value: string; label: string }[]
  wrapperClassName?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, options, wrapperClassName, id: idProp, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} min-h-11 ${error ? 'border-bad' : 'border-line-strong'} ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  wrapperClassName?: string
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, optional, wrapperClassName, id: idProp, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} min-h-24 py-2.5 ${error ? 'border-bad' : 'border-line-strong'} ${className}`}
        {...rest}
      />
    </FieldShell>
  )
})

/** Form-level error summary: shown inline (not only as a toast). */
export function FormError({ message, id }: { message: string | null | undefined; id?: string }) {
  if (!message) return null
  return (
    <div id={id} role="alert" className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2.5 text-sm text-bad">
      {message}
    </div>
  )
}
