import { useEffect, useMemo, useState } from 'react'
import type { Slot } from '../lib/types'
import { addDays, dayLong, tbilisiDate, time, weekdayShort } from '../lib/format'

interface Props {
  slots: Slot[]
  from: string               // first day shown (YYYY-MM-DD)
  days?: number
  selected?: string | null    // ISO starts_at
  onSelect: (s: Slot) => void
  loading?: boolean
  empty?: React.ReactNode
}

export function SlotPicker({ slots, from, days = 14, selected, onSelect, loading, empty }: Props) {
  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>()
    for (const s of slots) {
      const d = tbilisiDate(s.starts_at)
      const arr = m.get(d) ?? []
      if (!arr.some(x => x.starts_at === s.starts_at)) arr.push(s)   // "any dentist": one chip per time
      m.set(d, arr)
    }
    return m
  }, [slots])

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days])
  const firstWithSlots = dayList.find(d => byDay.has(d))
  const selectedDay = selected ? tbilisiDate(selected) : undefined
  const [day, setDay] = useState<string | undefined>(selectedDay ?? firstWithSlots)

  useEffect(() => {
    if (!day || !byDay.has(day)) setDay(selectedDay && byDay.has(selectedDay) ? selectedDay : firstWithSlots)
  }, [byDay, firstWithSlots, selectedDay, day])

  const today = tbilisiDate()
  const list = day ? byDay.get(day) ?? [] : []
  const part = (h: number) => (h < 12 ? 'დილა' : h < 17 ? 'შუადღე' : 'საღამო')
  const groups = ['დილა', 'შუადღე', 'საღამო'].map(g => ({ g, items: list.filter(s => part(Number(time(s.starts_at).slice(0, 2))) === g) })).filter(x => x.items.length)

  if (loading) return <div className="grid grid-cols-4 gap-2" aria-busy>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-100" />)}</div>
  if (!slots.length) return <>{empty ?? <p className="text-muted">თავისუფალი დრო არ მოიძებნა.</p>}</>

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="დღეები">
        {dayList.map(d => {
          const n = byDay.get(d)?.length ?? 0
          const on = d === day
          return (
            <button key={d} role="tab" aria-selected={on} disabled={!n} onClick={() => setDay(d)}
              className={`flex w-[66px] shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 transition ${on ? 'border-brand-700 bg-brand-700 text-white shadow-md' : n ? 'border-line bg-white hover:border-brand-300' : 'border-transparent bg-slate-50 text-slate-300'}`}>
              <span className={`text-xs ${on ? 'text-brand-100' : 'text-muted'}`}>{d === today ? 'დღეს' : weekdayShort(d + 'T12:00:00Z')}</span>
              <span className="text-lg font-bold leading-tight">{Number(d.slice(8))}</span>
              <span className={`text-[10px] ${on ? 'text-brand-100' : n ? 'text-brand-600' : ''}`}>{n ? `${n} დრო` : '—'}</span>
            </button>
          )
        })}
      </div>

      {day && <p className="mb-2 mt-3 text-sm font-medium text-muted">{dayLong(day + 'T12:00:00Z')}</p>}
      <div className="space-y-4">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map(s => {
                const on = s.starts_at === selected
                return (
                  <button key={s.starts_at} onClick={() => onSelect(s)} aria-pressed={on}
                    className={`h-11 rounded-xl border text-[15px] font-semibold transition ${on ? 'border-brand-700 bg-brand-700 text-white shadow-md' : 'border-brand-100 bg-brand-50 text-brand-800 hover:border-brand-500 hover:bg-white'}`}>
                    {time(s.starts_at)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
