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

// Georgian names are hard-coded so output never depends on the browser's locale data.
const WD_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ']
const WD_LONG = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი']
const MON_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ']
const MON_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']

const partsFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function parts(d: string | Date) {
  const o: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(new Date(d))) o[p.type] = p.value
  const dow = new Date(Date.UTC(+o.year, +o.month - 1, +o.day)).getUTCDay()
  return { y: +o.year, m: +o.month - 1, d: +o.day, hh: o.hour, mm: o.minute, dow }
}

export const time = (d: string | Date) => { const p = parts(d); return `${p.hh}:${p.mm}` }
export const dayLong = (d: string | Date) => { const p = parts(d); return `${WD_LONG[p.dow]}, ${p.d} ${MON_LONG[p.m]}` }
export const dayShort = (d: string | Date) => { const p = parts(d); return `${p.d} ${MON_SHORT[p.m]}` }
export const weekdayShort = (d: string | Date) => WD_SHORT[parts(d).dow]
export const dateMedium = (d: string | Date) => { const p = parts(d); return `${p.d} ${MON_SHORT[p.m]}, ${p.y}` }

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
  const n = Math.round(gel).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return kind === 'from' ? `₾${n}-დან` : `₾${n}`
}

export const km = (v: number | null) => (v == null ? '' : v < 1 ? `${Math.round(v * 1000)} მ` : `${v.toFixed(1)} კმ`)

export const minutes = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} სთ` : m > 60 ? `${Math.floor(m / 60)} სთ ${m % 60} წთ` : `${m} წთ`)

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('')

/** Georgian plural-agnostic count helper: "24 შეფასება" */
export const count = (n: number, word: string) => `${n} ${word}`
