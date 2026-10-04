import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Siren, Navigation, CalendarCheck, BadgeCheck, Wallet, ArrowRight, Clock, MapPin } from 'lucide-react'
import { SearchBox } from '../components/SearchBox'
import { CategoryIcon } from '../components/CategoryIcon'
import { Button } from '../components/ui'
import { useCategories, useCities, useGeolocate } from '../lib/hooks'
import { toParams, type SearchState } from '../lib/searchState'

const quick = [
  { label: 'კბილი მტკივა', to: '/search?q=&intent=1&cat=1&sort=earliest', hot: true },
  { label: 'პროფესიული წმენდა', to: '/search?cat=2' },
  { label: 'ბავშვის ვიზიტი', to: '/search?cat=12' },
  { label: 'გათეთრება', to: '/search?cat=13' },
  { label: 'იმპლანტი', to: '/search?cat=7' },
]

export default function Home() {
  const nav = useNavigate()
  const { data: cats = [] } = useCategories()
  const { data: cities = [] } = useCities()
  const geolocate = useGeolocate()
  const [locating, setLocating] = useState(false)
  const [emCity, setEmCity] = useState<number>(1)

  const go = (s: SearchState) => nav(`/search?${toParams(s)}`)

  function nearest() {
    setLocating(true)
    geolocate(
      (lat, lng) => { setLocating(false); go({ lat, lng, sort: 'earliest' }) },
      () => { setLocating(false); go({ sort: 'earliest' }) },
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-100 via-brand-50 to-surface">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sun-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 md:pt-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> რეალური თავისუფალი დრო, ახლავე
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight text-ink md:text-6xl">
              იპოვე სტომატოლოგი, რომელსაც <span className="text-brand-600">დრო აქვს</span> შენთვის
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted">
              შეადარეთ კლინიკები, ნახეთ ფასები და დაჯავშნეთ ვიზიტი რამდენიმე დაწკაპუნებით — ზარის გარეშე.
            </p>
          </div>

          <div className="mt-8 rounded-3xl bg-white/90 p-3 shadow-pop ring-1 ring-white backdrop-blur">
            <SearchBox value={{}} onSubmit={go} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">პოპულარული:</span>
            {quick.map(q => (
              <Link key={q.label} to={q.to} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition hover:-translate-y-0.5 ${q.hot ? 'bg-coral-50 text-coral-600 ring-coral-500/30' : 'bg-white text-ink ring-line hover:ring-brand-300'}`}>
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency + earliest */}
      <section className="mx-auto -mt-2 grid max-w-7xl gap-4 px-4 md:grid-cols-2">
        <div className="rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-coral-500 to-coral-600 p-7 text-white shadow-card">
          <Siren className="mb-3" size={30} />
          <h2 className="text-2xl font-extrabold">გადაუდებელი სტომატოლოგი</h2>
          <p className="mt-1 text-white/90">ახლა ღია კლინიკები, რომლებსაც უახლოეს საათებში პაციენტის მიღება შეუძლიათ.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <select value={emCity} onChange={e => setEmCity(Number(e.target.value))} className="h-12 rounded-xl bg-white px-4 font-medium text-ink outline-none" aria-label="ქალაქი">
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => go({ city_id: emCity, open_now: true, within_hours: 3, sort: 'earliest' })}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 font-bold text-coral-600 transition hover:bg-coral-50">
              იპოვე ახლავე <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-7 text-white shadow-card">
          <Clock className="mb-3" size={30} />
          <h2 className="text-2xl font-extrabold">უახლოესი ვიზიტი ჩემთან ახლოს</h2>
          <p className="mt-1 text-brand-100">არ გვინდა 80 პროფილის შედარება. აჩვენე უახლოესი თავისუფალი დრო და ფასი.</p>
          <div className="mt-5">
            <Button variant="secondary" size="lg" onClick={nearest} busy={locating} className="!h-12">
              <Navigation size={18} /> გამოიყენე ჩემი მდებარეობა
            </Button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <h2 className="text-2xl font-extrabold md:text-3xl">რა გჭირდებათ?</h2>
        <p className="mt-1 text-muted">აირჩიეთ მომსახურება და ნახეთ თავისუფალი დრო.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cats.map(c => (
            <Link key={c.id} to={`/search?cat=${c.id}`} className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-brand-300">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"><CategoryIcon name={c.icon} /></span>
              <span className="text-[15px] font-semibold leading-tight">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <h2 className="text-2xl font-extrabold md:text-3xl">კლინიკები მთელ საქართველოში</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {cities.map(c => (
            <Link key={c.id} to={`/search?city=${c.id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold shadow-card ring-1 ring-line transition hover:ring-brand-400">
              <MapPin size={16} className="text-brand-600" /> {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { i: CalendarCheck, t: 'რეალური თავისუფალი დრო', d: 'ვხედავთ ექიმების გრაფიკს, სავარძლებს და უკვე დაკავებულ დროს — ორმაგი ჯავშანი გამორიცხულია.' },
            { i: Wallet, t: 'გამჭვირვალე ფასები', d: 'ფიქსირებული ფასი, „-დან“ ფასი ან კონსულტაციაზე განსაზღვრული — წინასწარ ხედავთ.' },
            { i: BadgeCheck, t: 'გადამოწმებული კლინიკები და შეფასებები', d: 'შეფასების დატოვება შეუძლია მხოლოდ იმას, ვინც ვიზიტი რეალურად დაასრულა.' },
          ].map(x => (
            <div key={x.t} className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><x.i /></span>
              <h3 className="text-lg font-bold">{x.t}</h3>
              <p className="mt-1.5 text-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Clinic CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-900 p-8 text-white md:flex-row md:items-center md:p-12">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">კლინიკა ხართ? გაავსეთ თავისუფალი დრო.</h2>
            <p className="mt-2 max-w-xl text-brand-200">განათავსეთ გრაფიკი, მიიღეთ ონლაინ ჯავშნები და შეამცირეთ უშედეგო ზარები.</p>
          </div>
          <Link to="/register" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-sun-400 px-6 font-bold text-ink transition hover:bg-sun-300">კლინიკის დამატება <ArrowRight size={18} /></Link>
        </div>
      </section>
    </div>
  )
}
