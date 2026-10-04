import { useState } from 'react'
import { SlidersHorizontal, X, Navigation, Star, Clock } from 'lucide-react'
import type { SearchState } from '../lib/searchState'
import { advancedCount } from '../lib/searchState'
import { addDays, tbilisiDate } from '../lib/format'
import { languageLabel, partLabel } from '../lib/labels'
import { Button } from './ui'

interface Props {
  value: SearchState
  onChange: (patch: Partial<SearchState>) => void
  onReset: () => void
  onNearMe: () => void
  locating: boolean
}

const pill = (on: boolean) =>
  `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${on ? 'border-brand-600 bg-brand-700 text-white' : 'border-line bg-white text-ink hover:border-brand-300'}`

export function FilterBar({ value, onChange, onReset, onNearMe, locating }: Props) {
  const [more, setMore] = useState(false)
  const today = tbilisiDate()
  const tomorrow = addDays(today, 1)
  const extra = advancedCount(value)

  const selectCls = (on: boolean) =>
    `h-10 shrink-0 cursor-pointer rounded-full border px-3 text-sm font-medium outline-none transition ${on ? 'border-brand-600 bg-brand-700 text-white' : 'border-line bg-white'}`

  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={pill(value.date === today)} onClick={() => onChange({ date: value.date === today ? undefined : today })}>დღეს</button>
        <button className={pill(value.date === tomorrow)} onClick={() => onChange({ date: value.date === tomorrow ? undefined : tomorrow })}>ხვალ</button>
        <button className={pill(value.within_hours === 2)} onClick={() => onChange({ within_hours: value.within_hours === 2 ? undefined : 2, date: undefined })}>
          <Clock size={14} /> 2 საათში
        </button>
        <select aria-label="დღის დრო" className={selectCls(!!value.part)} value={value.part ?? ''} onChange={e => onChange({ part: (e.target.value || undefined) as SearchState['part'] })}>
          <option value="">დღის ნებისმიერი დრო</option>
          {Object.entries(partLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className={pill(!!value.open_now)} onClick={() => onChange({ open_now: !value.open_now || undefined })}>ახლა ღიაა</button>
        <button className={pill(value.min_rating === 4)} onClick={() => onChange({ min_rating: value.min_rating === 4 ? undefined : 4 })}>
          <Star size={14} className={value.min_rating === 4 ? 'fill-white' : 'fill-sun-400 text-sun-400'} /> 4+
        </button>
        <select aria-label="ფასი" className={selectCls(!!value.max_price)} value={value.max_price ?? ''} onChange={e => onChange({ max_price: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">ფასი: ნებისმიერი</option>
          <option value="50">₾50-მდე</option><option value="100">₾100-მდე</option><option value="200">₾200-მდე</option>
          <option value="500">₾500-მდე</option><option value="2000">₾2000-მდე</option>
        </select>
        <select aria-label="ენა" className={selectCls(!!value.languages?.length)} value={value.languages?.[0] ?? ''} onChange={e => onChange({ languages: e.target.value ? [e.target.value] : undefined })}>
          <option value="">ენა: ნებისმიერი</option>
          {Object.entries(languageLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className={pill(value.lat != null)} onClick={onNearMe} disabled={locating}>
          <Navigation size={14} /> {locating ? 'ვპოულობ…' : 'ჩემთან ახლოს'}
        </button>
        <button className={pill(extra > 0)} onClick={() => setMore(true)}>
          <SlidersHorizontal size={14} /> მეტი ფილტრი{extra > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-brand-700">{extra}</span>}
        </button>
      </div>

      {more && <MoreFilters value={value} onChange={onChange} onReset={onReset} onClose={() => setMore(false)} />}
    </>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] transition ${on ? 'border-brand-500 bg-brand-50 font-semibold text-brand-800' : 'border-line bg-white'}`}>
      {label}
      <span className={`grid h-5 w-9 items-center rounded-full p-0.5 transition ${on ? 'bg-brand-600' : 'bg-slate-200'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4"><h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h4><div className="grid gap-2 sm:grid-cols-2">{children}</div></section>
  )
}

function MoreFilters({ value, onChange, onReset, onClose }: { value: SearchState; onChange: (p: Partial<SearchState>) => void; onReset: () => void; onClose: () => void }) {
  const t = (k: keyof SearchState) => () => onChange({ [k]: value[k] ? undefined : true } as Partial<SearchState>)
  return (
    <div className="fixed inset-0 z-[1500] flex justify-end bg-ink/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-extrabold">ფილტრები</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="დახურვა"><X /></button>
        </div>
        <div className="flex-1 divide-y divide-line overflow-auto px-5">
          <Group title="პაციენტი">
            <Toggle label="მოზრდილი" on={value.patient_type === 'adult'} onClick={() => onChange({ patient_type: value.patient_type === 'adult' ? undefined : 'adult' })} />
            <Toggle label="ბავშვი" on={value.patient_type === 'child'} onClick={() => onChange({ patient_type: value.patient_type === 'child' ? undefined : 'child' })} />
          </Group>
          <Group title="კლინიკა">
            <Toggle label="გადაუდებელი / 24/7" on={!!value.emergency} onClick={t('emergency')} />
            <Toggle label="მუშაობს შაბათს" on={!!value.open_weekends} onClick={t('open_weekends')} />
            <Toggle label="ინვალიდის ეტლისთვის ადაპტირებული" on={!!value.wheelchair} onClick={t('wheelchair')} />
            <Toggle label="პარკინგი" on={!!value.parking} onClick={t('parking')} />
            <Toggle label="მეტროსთან ახლოს" on={!!value.near_metro} onClick={t('near_metro')} />
          </Group>
          <Group title="ექიმი">
            <Toggle label="ქალი ექიმი" on={value.dentist_gender === 'female'} onClick={() => onChange({ dentist_gender: value.dentist_gender === 'female' ? undefined : 'female' })} />
            <Toggle label="მამაკაცი ექიმი" on={value.dentist_gender === 'male'} onClick={() => onChange({ dentist_gender: value.dentist_gender === 'male' ? undefined : 'male' })} />
            <Toggle label="გამოცდილება 10+ წელი" on={value.min_experience === 10} onClick={() => onChange({ min_experience: value.min_experience === 10 ? undefined : 10 })} />
          </Group>
          <Group title="შეფასებები">
            <Toggle label="რეიტინგი 4.5+" on={value.min_rating === 4.5} onClick={() => onChange({ min_rating: value.min_rating === 4.5 ? undefined : 4.5 })} />
            <Toggle label="მინიმუმ 10 შეფასება" on={value.min_reviews === 10} onClick={() => onChange({ min_reviews: value.min_reviews === 10 ? undefined : 10 })} />
          </Group>
          <Group title="გადახდა">
            <Toggle label="ბარათით" on={!!value.card} onClick={t('card')} />
            <Toggle label="ნაღდი ფულით" on={!!value.cash} onClick={t('cash')} />
            <Toggle label="განვადება" on={!!value.installments} onClick={t('installments')} />
          </Group>
          <section className="py-4">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">მანძილი (საჭიროა მდებარეობა)</h4>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 5, 10].map(k => (
                <button key={k} disabled={value.lat == null} onClick={() => onChange({ max_km: value.max_km === k ? undefined : k })}
                  className={`rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40 ${value.max_km === k ? 'border-brand-600 bg-brand-700 text-white' : 'border-line'}`}>{k} კმ-მდე</button>
              ))}
            </div>
          </section>
        </div>
        <div className="flex gap-3 border-t border-line p-4">
          <Button variant="secondary" className="flex-1" onClick={onReset}>გასუფთავება</Button>
          <Button className="flex-1" onClick={onClose}>შედეგების ნახვა</Button>
        </div>
      </div>
    </div>
  )
}
