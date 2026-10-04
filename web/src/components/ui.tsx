import { Star, BadgeCheck, Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Stars({ value, size = 16 }: { value: number | null; size?: number }) {
  const v = value ?? 0
  return (
    <span className="inline-flex" aria-label={`რეიტინგი ${v} 5-დან`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= Math.round(v) ? 'fill-sun-400 text-sun-400' : 'fill-slate-100 text-slate-300'} />
      ))}
    </span>
  )
}

export function Rating({ value, count }: { value: number | null; count: number }) {
  if (!count) return <span className="text-sm text-muted">ახალი</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star size={15} className="fill-sun-400 text-sun-400" />
      <b>{value?.toFixed(1)}</b>
      <span className="text-muted">({count})</span>
    </span>
  )
}

export function Verified({ label = 'გადამოწმებული' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
      <BadgeCheck size={14} /> {label}
    </span>
  )
}

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warm' | 'brand' | 'coral' }) {
  const tones = {
    plain: 'bg-slate-100 text-slate-700', warm: 'bg-sun-100 text-amber-800',
    brand: 'bg-brand-50 text-brand-700', coral: 'bg-coral-50 text-coral-600',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'coral'; size?: 'sm' | 'md' | 'lg'; busy?: boolean }
export function Button({ variant = 'primary', size = 'md', busy, className = '', children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    secondary: 'bg-white text-ink border border-line hover:border-brand-300 hover:bg-brand-50',
    ghost: 'text-brand-700 hover:bg-brand-50',
    danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50',
    coral: 'bg-coral-500 text-white hover:bg-coral-600 shadow-sm',
  }[variant]
  const s = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-13 px-7 text-base' }[size]
  return (
    <button {...rest} disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}>
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ label = 'იტვირთება…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 className="animate-spin" size={20} /> {label}</div>
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">🦷</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {hint && <p className="mx-auto mt-1 max-w-md text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const m = error instanceof Error ? error.message : String(error)
  return <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">შეცდომა: {m}</div>
}

export function Avatar({ name, size = 48, tone = 0 }: { name: string; size?: number; tone?: number }) {
  const tones = ['bg-brand-100 text-brand-800', 'bg-sun-100 text-amber-800', 'bg-coral-50 text-coral-600', 'bg-sky-100 text-sky-800']
  const i = (name.length + tone) % tones.length
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }} className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${tones[i]}`}>
      {name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')}
    </span>
  )
}

export const card = 'rounded-2xl bg-white shadow-card ring-1 ring-line'
