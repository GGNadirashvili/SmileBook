import type { PriceKind } from './types'

const TZ = 'Asia/Tbilisi'

/** Date (YYYY-MM-DD) in Tbilisi for a given instant. */
export function tbilisiDate(d: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const time = (d: string | Date) =>
  new Intl.DateTimeFormat('ka-GE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d))

export const dayLong = (d: string | Date) =>
  new Intl.DateTimeFormat('ka-GE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))

export const dayShort = (d: string | Date) =>
  new Intl.DateTimeFormat('ka-GE', { timeZone: TZ, day: 'numeric', month: 'short' }).format(new Date(d))

export const weekdayShort = (d: string | Date) =>
  new Intl.DateTimeFormat('ka-GE', { timeZone: TZ, weekday: 'short' }).format(new Date(d))

/** "დღეს 17:30", "ხვალ 09:00", "7 ოქტ. 12:00" */
export function relativeSlot(iso: string): string {
  const day = tbilisiDate(iso)
  const today = tbilisiDate()
  if (day === today) return `დღეს ${time(iso)}`
  if (day === addDays(today, 1)) return `ხვალ ${time(iso)}`
  return `${dayShort(iso)} ${time(iso)}`
}

export function price(kind: PriceKind | null, gel: number | null, opts: { short?: boolean } = {}): string {
  if (kind === 'on_consultation' || gel == null) return opts.short ? 'კონსულტაციით' : 'ფასი განისაზღვრება კონსულტაციაზე'
  const n = new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 }).format(gel)
  return kind === 'from' ? `₾${n}-დან` : `₾${n}`
}

export const km = (v: number | null) => (v == null ? '' : v < 1 ? `${Math.round(v * 1000)} მ` : `${v.toFixed(1)} კმ`)

export const minutes = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} სთ` : m > 60 ? `${Math.floor(m / 60)} სთ ${m % 60} წთ` : `${m} წთ`)

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')

/** Georgian plural-agnostic count helper: "24 შეფასება" */
export const count = (n: number, word: string) => `${n} ${word}`
