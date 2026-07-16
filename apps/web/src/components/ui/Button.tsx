import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 hover:-translate-y-0.5',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5',
  danger: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:-translate-y-0.5',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizeClasses }) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    />
  )
}
