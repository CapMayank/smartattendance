import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Loader2 } from 'lucide-react'
import {
  cloneElement,
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('bg-panel border border-line rounded-lg', className)}>{children}</div>
}

export function CardHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {actions}
    </div>
  )
}

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

const buttonVariants = {
  primary: 'bg-accent text-white hover:bg-accent-hover border-transparent',
  secondary: 'bg-raised text-fg border-line-strong hover:bg-hover',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-hover hover:text-fg',
  danger: 'bg-danger-soft text-danger border-transparent hover:bg-danger/20',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/* ---------- Form controls ---------- */
const controlBase =
  'w-full h-10 rounded-md bg-bg border border-line-strong px-3 text-sm text-fg placeholder:text-subtle transition-colors duration-150 focus:border-accent focus:outline-none focus-visible:outline-none disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(controlBase, className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, 'h-auto py-2', className)} {...props} />
  },
)

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}) {
  const id = useId()
  const noteId = `${id}-note`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-muted">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': error || hint ? noteId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {(error || hint) && (
        <p id={noteId} className={cn('text-xs', error ? 'text-danger' : 'text-subtle')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

/* ---------- Badge ---------- */
const badgeTones = {
  neutral: 'bg-raised text-muted border-line-strong',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof badgeTones
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-fg tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  const iconTone = {
    neutral: 'text-muted bg-raised',
    accent: 'text-accent bg-accent-soft',
    success: 'text-success bg-success-soft',
    warning: 'text-warning bg-warning-soft',
    danger: 'text-danger bg-danger-soft',
  }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
        </div>
        {icon && <div className={cn('p-2 rounded-md', iconTone)}>{icon}</div>}
      </div>
    </Card>
  )
}
