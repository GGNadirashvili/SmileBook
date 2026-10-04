import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, CalendarDays, Sparkles, Stethoscope, HeartPulse } from 'lucide-react'
import { useCategories, useCities, useDistricts, useIntents } from '../lib/hooks'
import type { SearchState } from '../lib/searchState'
import { addDays, tbilisiDate } from '../lib/format'
import { Button } from './ui'

const stem = (w: string) => w.toLowerCase().slice(0, 4)
const words = (s: string) => s.split(/[\s,.]+/).filter(w => w.length >= 3).map(stem)

interface Props { value: SearchState; onSubmit: (s: SearchState) => void; compact?: boolean }

export function SearchBox({ value, onSubmit, compact = false }: Props) {
  const { data: cats = [] } = useCategories()
  const { data: intents = [] } = useIntents()
  const { data: cities = [] } = useCities()
  const { data: districts = [] } = useDistricts()

  const [text, setText] = useState(value.q ?? '')
  const [cat, setCat] = useState<number | undefined>(value.category_id)
  const [intent, setIntent] = useState<number | undefined>(value.intent)
  const [city, setCity] = useState<number | undefined>(value.city_id)
  const [district, setDistrict] = useState<number | undefined>(value.district_id)
  const [date, setDate] = useState<string | undefined>(value.date)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Show the chosen intent phrase / category name in the box when arriving via URL
  useEffect(() => {
    if (value.q) return
    const phrase = value.intent ? intents.find(i => i.id === value.intent)?.phrase : undefined
    const name = value.category_id ? cats.find(c => c.id === value.category_id)?.name : undefined
    if (phrase ?? name) setText((phrase ?? name)!)
  }, [value.category_id, value.intent, value.q, cats, intents])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const suggestions = useMemo(() => {
    const t = text.trim().toLowerCase()
    const catHits = t ? cats.filter(c => c.name.toLowerCase().includes(t)).slice(0, 5) : cats.slice(0, 6)
    const tw = words(t)
    const intentHits = (t
      ? intents.map(i => {
          const pw = words(i.phrase)
          const score = i.phrase.toLowerCase().includes(t) ? 10 : tw.filter(w => pw.includes(w)).length
          return { i, score }
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.i)
      : intents.filter(i => i.emergency)).slice(0, 4)
    return { catHits, intentHits }
  }, [text, cats, intents])

  const today = tbilisiDate()
  const dateMode = !date ? 'any' : date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : 'custom'
  const cityDistricts = districts.filter(d => d.city_id === city)

  function pickCategory(id: number, label: string) { setCat(id); setIntent(undefined); setText(label); setOpen(false) }
  function pickIntent(id: number, phrase: string, slugs: string[]) {
    const first = cats.find(c => c.slug === slugs[0])
    setCat(first?.id); setIntent(id); setText(phrase); setOpen(false)
  }
  function submit() {
    const isCatText = cat && cats.find(c => c.id === cat)?.name === text
    const isIntentText = intent && intents.find(i => i.id === intent)?.phrase === text
    onSubmit({
      ...value,
      category_id: cat, intent: isIntentText ? intent : undefined,
      q: isCatText || isIntentText ? undefined : text.trim() || undefined,
      city_id: city, district_id: district, date,
    })
  }

  const field = 'flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-400'
  const sel = 'h-12 w-full cursor-pointer bg-transparent text-[15px] outline-none'

  return (
    <div className={`grid gap-2 ${compact ? 'lg:grid-cols-[1.6fr_1fr_1fr_.9fr_auto]' : 'lg:grid-cols-[1.7fr_1fr_1fr_.9fr_auto]'}`}>
      <div ref={box} className="relative">
        <label className={field}>
          <Search size={18} className="shrink-0 text-brand-600" />
          <input
            value={text}
            onChange={e => { setText(e.target.value); setCat(undefined); setIntent(undefined); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); submit() } }}
            placeholder="მომსახურება, ექიმი ან „კბილი მტკივა“"
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            aria-label="ძებნა"
          />
        </label>
        {open && (suggestions.catHits.length > 0 || suggestions.intentHits.length > 0) && (
          <div className="absolute left-0 right-0 top-full z-[1200] mt-2 max-h-96 overflow-auto rounded-2xl bg-white p-2 text-left shadow-pop ring-1 ring-line">
            {suggestions.intentHits.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-coral-600"><HeartPulse size={13} /> როგორ გრძნობთ თავს?</div>
                {suggestions.intentHits.map(i => (
                  <button key={i.id} onClick={() => pickIntent(i.id, i.phrase, i.category_slugs)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-brand-50">
                    <span className="font-medium">{i.phrase}</span>
                    <span className="text-xs text-muted">→ {cats.find(c => c.slug === i.category_slugs[0])?.name}</span>
                  </button>
                ))}
              </>
            )}
            {suggestions.catHits.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-brand-700"><Stethoscope size={13} /> მომსახურება</div>
                {suggestions.catHits.map(c => (
                  <button key={c.id} onClick={() => pickCategory(c.id, c.name)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-brand-50">
                    <Sparkles size={15} className="text-brand-500" /> {c.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <label className={field}>
        <MapPin size={18} className="shrink-0 text-brand-600" />
        <select value={city ?? ''} onChange={e => { setCity(e.target.value ? Number(e.target.value) : undefined); setDistrict(undefined) }} className={sel} aria-label="ქალაქი">
          <option value="">მთელი საქართველო</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className={`${field} ${cityDistricts.length ? '' : 'opacity-60'}`}>
        <MapPin size={18} className="shrink-0 text-slate-300" />
        <select value={district ?? ''} disabled={!cityDistricts.length} onChange={e => setDistrict(e.target.value ? Number(e.target.value) : undefined)} className={sel} aria-label="უბანი">
          <option value="">{cityDistricts.length ? 'ყველა უბანი' : 'უბანი'}</option>
          {cityDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>

      <label className={field}>
        <CalendarDays size={18} className="shrink-0 text-brand-600" />
        {dateMode === 'custom' ? (
          <input type="date" min={today} value={date} onChange={e => setDate(e.target.value || undefined)} className={sel} aria-label="თარიღი" />
        ) : (
          <select value={dateMode} onChange={e => {
            const v = e.target.value
            setDate(v === 'today' ? today : v === 'tomorrow' ? addDays(today, 1) : v === 'custom' ? addDays(today, 2) : undefined)
          }} className={sel} aria-label="თარიღი">
            <option value="any">ნებისმიერი დღე</option>
            <option value="today">დღეს</option>
            <option value="tomorrow">ხვალ</option>
            <option value="custom">აირჩიეთ თარიღი…</option>
          </select>
        )}
      </label>

      <Button size="lg" onClick={submit} className="h-12 w-full lg:w-auto"><Search size={18} /> ძებნა</Button>
    </div>
  )
}
