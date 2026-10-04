import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { List, Map as MapIcon, AlertTriangle, Info } from 'lucide-react'
import { SearchBox } from '../components/SearchBox'
import { FilterBar } from '../components/FilterBar'
import { ClinicCard } from '../components/ClinicCard'
import { MapView } from '../components/MapView'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Empty, ErrorNote, Spinner } from '../components/ui'
import { parseParams, toParams, type SearchState } from '../lib/searchState'
import { searchClinics } from '../lib/api'
import { useCategories, useCities, useGeolocate, useIntents } from '../lib/hooks'
import { sortLabel } from '../lib/labels'

export default function Search() {
  const [sp, setSp] = useSearchParams()
  const state = useMemo(() => parseParams(sp), [sp])
  const { data: cities = [] } = useCities()
  const { data: cats = [] } = useCategories()
  const { data: intents = [] } = useIntents()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [active, setActive] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)
  const geolocate = useGeolocate()

  const { sort, intent, ...filters } = state
  const effectiveSort = sort ?? (state.lat != null ? 'nearest' : 'recommended')
  const { data, isLoading, error } = useQuery({
    queryKey: ['search', filters, effectiveSort],
    queryFn: () => searchClinics({ ...filters, sort: effectiveSort }),
    placeholderData: prev => prev,
  })

  const update = (patch: Partial<SearchState>) => setSp(toParams({ ...state, ...patch }), { replace: true })
  const city = cities.find(c => c.id === state.city_id)
  const intentObj = intents.find(i => i.id === intent)
  const suggestedCats = intentObj ? cats.filter(c => intentObj.category_slugs.includes(c.slug)) : []
  const me = state.lat != null && state.lng != null ? { lat: state.lat, lng: state.lng } : undefined

  function nearMe() {
    if (state.lat != null) { update({ lat: undefined, lng: undefined, max_km: undefined, sort: undefined }); return }
    setLocating(true); setGeoError(false)
    geolocate(
      (lat, lng) => { setLocating(false); update({ lat, lng, sort: 'nearest' }) },
      () => { setLocating(false); setGeoError(true) },
    )
  }

  const results = data ?? []

  return (
    <div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-4">
          <SearchBox key={[state.city_id, state.district_id, state.category_id, state.q, state.date].join('|')} compact value={state} onSubmit={s => setSp(toParams({ ...state, ...s, sort: state.sort }))} />
          <FilterBar value={state} onChange={update} onReset={() => setSp(toParams({ q: state.q, category_id: state.category_id, city_id: state.city_id, district_id: state.district_id, intent: state.intent }))} onNearMe={nearMe} locating={locating} />
          {geoError && <div className="flex items-center gap-2 rounded-xl bg-sun-100 px-4 py-2.5 text-sm text-amber-900"><AlertTriangle size={16} /> მდებარეობის დადგენა ვერ მოხერხდა. შეამოწმეთ ბრაუზერის ნებართვა.</div>}
        </div>
      </div>

      {intentObj && (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div className="rounded-2xl bg-coral-50 p-4 ring-1 ring-coral-500/20">
            <div className="flex items-start gap-3">
              <Info size={20} className="mt-0.5 shrink-0 text-coral-600" />
              <div className="text-sm">
                <p className="font-semibold text-ink">„{intentObj.phrase}“ — გირჩევთ ამ ტიპის ვიზიტებს:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedCats.map(c => (
                    <button key={c.id} onClick={() => update({ category_id: c.id })}
                      className={`rounded-full border px-3.5 py-1.5 font-medium ${state.category_id === c.id ? 'border-coral-600 bg-coral-600 text-white' : 'border-coral-500/30 bg-white text-coral-600 hover:bg-coral-50'}`}>{c.name}</button>
                  ))}
                </div>
                <p className="mt-2 text-muted">ეს არ არის დიაგნოზი — ზუსტ მკურნალობას ექიმი განსაზღვრავს. თუ ტკივილი ძლიერია ან სახე გასივდა, აირჩიეთ „გადაუდებელი“ ან დარეკეთ 112-ზე.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-muted">
            <b className="text-ink">{results.length}</b> კლინიკა{city ? ` — ${city.name}` : ' საქართველოში'}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              დალაგება
              <select value={effectiveSort} onChange={e => update({ sort: e.target.value as SearchState['sort'] })} className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink outline-none">
                {Object.entries(sortLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="flex rounded-xl border border-line bg-white p-1 lg:hidden">
              <button onClick={() => setView('list')} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${view === 'list' ? 'bg-brand-700 text-white' : ''}`}><List size={15} /> სია</button>
              <button onClick={() => setView('map')} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${view === 'map' ? 'bg-brand-700 text-white' : ''}`}><MapIcon size={15} /> რუკა</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className={`space-y-3 ${view === 'map' ? 'hidden lg:block' : ''}`}>
            {error ? <ErrorNote error={error} /> : isLoading ? <Spinner /> : results.length === 0 ? (
              <Empty title="კლინიკა ვერ მოიძებნა" hint="სცადეთ ფილტრების შემცირება, სხვა თარიღი ან უბანი." />
            ) : results.map(c => <ClinicCard key={c.id} c={c} active={active === c.id} onHover={setActive} />)}
          </div>

          <div className={`${view === 'list' ? 'hidden lg:block' : ''}`}>
            <div className="sticky top-20 h-[calc(100vh-7rem)] min-h-[420px] overflow-hidden rounded-2xl ring-1 ring-line">
              <ErrorBoundary><MapView key={view} clinics={results} cities={cities} activeId={active} onSelect={setActive} selectedCity={city} me={me}
                onCity={id => update({ city_id: id, district_id: undefined })} /></ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
