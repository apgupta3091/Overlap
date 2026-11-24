import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Loader2 } from 'lucide-react'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap select-none'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
  danger: 'bg-bad text-white hover:brightness-95',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-[15px]',
}

export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, className = '', type = 'button', disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

interface LinkButtonProps extends LinkProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function LinkButton({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, String(className))} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  size?: Size
}

/** Icon-only button with a required accessible name. */
export function IconButton({ label, children, size = 'md', className = '', type = 'button', ...rest }: IconButtonProps) {
  const dim = size === 'sm' ? 'size-9' : 'size-11'
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex ${dim} items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
