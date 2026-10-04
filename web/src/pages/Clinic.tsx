import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CalendarClock, Car, Clock, CreditCard, Heart, MapPin, Navigation, Phone, ShieldCheck, TrainFront, Accessibility, Languages, Banknote, Siren } from 'lucide-react'
import { getClinic, getClinicDentists, getClinicHours, getClinicServices, getReviews, getSlots, getClinicStats } from '../lib/api'
import { Avatar, Chip, ErrorNote, Rating, Spinner, Stars, Verified, card, Button } from '../components/ui'
import { Cover } from '../components/Cover'
import { SlotPicker } from '../components/SlotPicker'
import { MiniMap } from '../components/MiniMap'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useFavorites } from '../lib/hooks'
import { directionsUrl } from '../lib/calendar'
import { dateMedium, minutes, price, tbilisiDate, relativeSlot } from '../lib/format'
import { languageLabel, weekdayName } from '../lib/labels'
import type { Review, Service } from '../lib/types'

export default function ClinicPage() {
  const { slug = '' } = useParams()
  const nav = useNavigate()
  const { isFav, toggle } = useFavorites()
  const clinicQ = useQuery({ queryKey: ['clinic', slug], queryFn: () => getClinic(slug) })
  const clinic = clinicQ.data
  const id = clinic?.id
  const services = useQuery({ queryKey: ['services', id], queryFn: () => getClinicServices(id!), enabled: !!id })
  const dentists = useQuery({ queryKey: ['dentists', id], queryFn: () => getClinicDentists(id!), enabled: !!id })
  const hours = useQuery({ queryKey: ['hours', id], queryFn: () => getClinicHours(id!), enabled: !!id })
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => getReviews({ clinicId: id }), enabled: !!id })
  const stats = useQuery({ queryKey: ['stats', id], queryFn: () => getClinicStats(id!), enabled: !!id })

  const [serviceId, setServiceId] = useState<string | undefined>()
  const svc = services.data?.find(s => s.id === serviceId) ?? services.data?.[0]
  const from = tbilisiDate()
  const slots = useQuery({ queryKey: ['slots', svc?.id, from], queryFn: () => getSlots(svc!.id, from, 14), enabled: !!svc })

  const todayHours = useMemo(() => {
    if (!hours.data) return null
    const wd = ((new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' })).getDay() + 6) % 7) + 1
    return hours.data.find(h => h.weekday === wd) ?? null
  }, [hours.data])

  if (clinicQ.isLoading) return <Spinner />
  if (clinicQ.error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={clinicQ.error} /></div>
  if (!clinic) return <div className="mx-auto max-w-3xl p-10 text-center"><h1 className="text-2xl font-bold">კლინიკა ვერ მოიძებნა</h1><Link className="mt-4 inline-block text-brand-700" to="/search">← ძებნაზე დაბრუნება</Link></div>

  const nextSlot = slots.data?.[0]
  const rating = stats.data
  const group = (rs: Review[], k: 'staff' | 'cleanliness' | 'waiting') => {
    const v = rs.map(r => r[k]).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }

  return (
    <div>
      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="grid min-w-0 gap-5 sm:grid-cols-[220px_1fr]">
              <Cover id={clinic.id} name={clinic.name} url={clinic.cover_url} className="h-44 rounded-2xl sm:h-full" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {clinic.verified && <Verified label="გადამოწმებული კლინიკა" />}
                  {clinic.emergency && <Chip tone="coral"><Siren size={12} /> გადაუდებელი</Chip>}
                  {clinic.sponsored && <Chip>რეკლამა</Chip>}
                </div>
                <h1 className="mt-2 text-3xl font-extrabold leading-tight">{clinic.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
                  <span className="inline-flex items-center gap-1.5"><Stars value={rating?.rating ?? null} /> <b>{rating?.rating?.toFixed(1) ?? '—'}</b> <span className="text-muted">· {rating?.review_count ?? 0} გადამოწმებული შეფასება</span></span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-muted"><MapPin size={16} /> {[clinic.address, clinic.districts?.name, clinic.cities?.name].filter(Boolean).join(', ')}</p>
                {todayHours && <p className="mt-1 flex items-center gap-1.5 text-muted"><Clock size={16} /> დღეს {todayHours.open_time.slice(0, 5)}–{todayHours.close_time.slice(0, 5) === '23:59' ? '24:00' : todayHours.close_time.slice(0, 5)}</p>}
                {nextSlot && <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 font-semibold text-brand-800"><CalendarClock size={18} /> უახლოესი დრო: {relativeSlot(nextSlot.starts_at)}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="#times"><Button size="lg">ნახე თავისუფალი დრო</Button></a>
                  <Button variant="secondary" size="lg" onClick={() => toggle({ clinic_id: clinic.id })}>
                    <Heart size={18} className={isFav({ clinic_id: clinic.id }) ? 'fill-rose-500 text-rose-500' : ''} /> {isFav({ clinic_id: clinic.id }) ? 'შენახულია' : 'შენახვა'}
                  </Button>
                  <a href={directionsUrl(clinic.lat, clinic.lng)} target="_blank" rel="noreferrer"><Button variant="secondary" size="lg"><Navigation size={18} /> მარშრუტი</Button></a>
                  {clinic.phone && <a href={`tel:${clinic.phone.replace(/\s/g, '')}`}><Button variant="ghost" size="lg"><Phone size={18} /> {clinic.phone}</Button></a>}
                </div>
              </div>
            </div>

            {/* Booking widget */}
            <aside id="times" className={`${card} min-w-0 scroll-mt-24 self-start p-5 lg:sticky lg:top-20`}>
              <h2 className="text-lg font-extrabold">დაჯავშნე ვიზიტი</h2>
              <p className="mb-3 text-sm text-muted">{clinic.booking_mode === 'instant' ? 'მყისიერი დადასტურება' : 'დადასტურებას კლინიკა გამოგიგზავნით'}</p>
              {services.data && (
                <select value={svc?.id ?? ''} onChange={e => setServiceId(e.target.value)} className="mb-4 h-12 w-full rounded-xl border border-line bg-white px-3 font-medium outline-none focus:border-brand-400" aria-label="მომსახურება">
                  {services.data.map(s => <option key={s.id} value={s.id}>{s.name} · {price(s.price_kind, s.price_gel, { short: true })}</option>)}
                </select>
              )}
              {svc && <SlotPicker slots={slots.data ?? []} from={from} loading={slots.isLoading}
                onSelect={s => nav(`/clinics/${clinic.slug}/book?service=${svc.id}&slot=${encodeURIComponent(s.starts_at)}`)}
                empty={<WaitlistHint slug={clinic.slug} serviceId={svc.id} />} />}
            </aside>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {clinic.description && <Section title="კლინიკის შესახებ"><p className="text-[16px] leading-relaxed text-ink/80">{clinic.description}</p></Section>}

          <Section title="მომსახურება და ფასები">
            {services.isLoading ? <Spinner /> : (
              <ul className="divide-y divide-line">
                {services.data?.map(s => <ServiceRow key={s.id} s={s} slug={clinic.slug} />)}
              </ul>
            )}
          </Section>

          <Section title="ექიმები">
            <div className="grid gap-3 sm:grid-cols-2">
              {dentists.data?.map((d, i) => (
                <Link key={d.id} to={`/dentists/${d.id}`} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-line transition hover:bg-brand-50 hover:ring-brand-300">
                  <Avatar name={d.full_name} size={56} tone={i} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold">{d.full_name}{d.verified && <BadgeCheck size={16} className="text-brand-600" />}</div>
                    <div className="truncate text-sm text-muted">{d.specialty} · {d.years_experience} წლის გამოცდილება</div>
                    <Rating value={d.rating} count={d.review_count} />
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="შეფასებები">
            {reviews.data && reviews.data.length > 0 ? (
              <>
                <div className="mb-5 grid gap-4 rounded-2xl bg-brand-50 p-4 sm:grid-cols-4">
                  <div className="text-center sm:border-r sm:border-brand-100"><div className="text-4xl font-extrabold text-brand-800">{rating?.rating?.toFixed(1)}</div><Stars value={rating?.rating ?? 0} /><div className="text-xs text-muted">{rating?.review_count} შეფასება</div></div>
                  {([['staff', 'პერსონალი'], ['cleanliness', 'სისუფთავე'], ['waiting', 'ლოდინის დრო']] as const).map(([k, label]) => (
                    <div key={k} className="text-center"><div className="text-2xl font-bold">{group(reviews.data!, k)?.toFixed(1) ?? '—'}</div><div className="text-sm text-muted">{label}</div></div>
                  ))}
                </div>
                <ul className="space-y-4">
                  {reviews.data.map(r => (
                    <li key={r.id} className="rounded-2xl p-4 ring-1 ring-line">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Avatar name={r.author_name} size={36} /><b>{r.author_name}</b></div>
                        <Stars value={r.overall} size={15} />
                      </div>
                      <p className="mt-2 text-ink/85">{r.body}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 text-brand-700"><ShieldCheck size={13} /> დადასტურებული ვიზიტი</span>
                        <span>{dateMedium(r.created_at)}</span>
                      </div>
                      {r.clinic_reply && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>კლინიკის პასუხი:</b> {r.clinic_reply}</div>}
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-muted">შეფასებები ჯერ არ არის. შეფასების დატოვება შეუძლია მხოლოდ იმას, ვინც ვიზიტი დაასრულა.</p>}
          </Section>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="მდებარეობა">
            <ErrorBoundary><MiniMap lat={clinic.lat} lng={clinic.lng} label={clinic.name} /></ErrorBoundary>
            <p className="mt-3 text-sm text-muted">{clinic.address}</p>
            <a href={directionsUrl(clinic.lat, clinic.lng)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-700"><Navigation size={15} /> გახსენი მარშრუტი</a>
            <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">სამუშაო საათები</h3>
            <table className="w-full text-sm">
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map(d => {
                  const h = hours.data?.find(x => x.weekday === d)
                  return <tr key={d} className="border-b border-line/60 last:border-0"><td className="py-1.5">{weekdayName[d]}</td><td className="py-1.5 text-right font-medium">{h ? `${h.open_time.slice(0, 5)}–${h.close_time.slice(0, 5) === '23:59' ? '24:00' : h.close_time.slice(0, 5)}` : <span className="text-muted">დაკეტილია</span>}</td></tr>
                })}
              </tbody>
            </table>
          </Section>

          <Section title="დეტალები და პოლიტიკა">
            <ul className="space-y-2.5 text-[15px]">
              <li className="flex gap-2"><Languages size={18} className="mt-0.5 shrink-0 text-brand-600" /> {clinic.languages.map(l => languageLabel[l] ?? l).join(', ')}</li>
              <li className="flex gap-2"><CreditCard size={18} className="mt-0.5 shrink-0 text-brand-600" /> {[clinic.accepts_card && 'ბარათი', clinic.accepts_cash && 'ნაღდი', clinic.installments && 'განვადება'].filter(Boolean).join(' · ')}</li>
              <li className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                {clinic.parking && <span className="inline-flex items-center gap-1"><Car size={15} /> პარკინგი</span>}
                {clinic.wheelchair && <span className="inline-flex items-center gap-1"><Accessibility size={15} /> ადაპტირებული</span>}
                {clinic.near_metro && <span className="inline-flex items-center gap-1"><TrainFront size={15} /> მეტროსთან</span>}
              </li>
              <li className="flex gap-2"><Banknote size={18} className="mt-0.5 shrink-0 text-brand-600" /> უფასო გაუქმება ვიზიტამდე {clinic.free_cancel_hours} საათით ადრე</li>
              <li className="flex gap-2"><Clock size={18} className="mt-0.5 shrink-0 text-brand-600" /> ჯავშანი მინიმუმ {clinic.min_notice_hours} საათით ადრე, მაქსიმუმ {clinic.max_future_days} დღით წინ</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={`${card} p-6`}><h2 className="mb-4 text-xl font-extrabold">{title}</h2>{children}</section>
}

function ServiceRow({ s, slug }: { s: Service; slug: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div>
        <div className="font-semibold">{s.name}</div>
        <div className="text-sm text-muted">{minutes(s.duration_min)}{s.patient_type === 'child' ? ' · ბავშვებისთვის' : ''}</div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-extrabold">{price(s.price_kind, s.price_gel, { short: true })}</span>
        <Link to={`/clinics/${slug}/book?service=${s.id}`} className="rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100">დრო</Link>
      </div>
    </li>
  )
}

export function WaitlistHint({ slug, serviceId }: { slug: string; serviceId: string }) {
  return (
    <div className="rounded-2xl bg-sun-100 p-4 text-sm text-amber-900">
      <p className="font-semibold">უახლოეს დღეებში თავისუფალი დრო არ არის.</p>
      <Link to={`/clinics/${slug}/book?service=${serviceId}&waitlist=1`} className="mt-1 inline-block font-bold underline">შემატყობინეთ, თუ დრო გამოთავისუფლდება →</Link>
    </div>
  )
}

