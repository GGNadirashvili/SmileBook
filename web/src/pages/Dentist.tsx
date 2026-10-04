import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Heart, Languages, MapPin, Briefcase, ShieldCheck } from 'lucide-react'
import { getDentist, getDentistServices, getReviews, getSlots } from '../lib/api'
import { Avatar, Button, ErrorNote, Spinner, Stars, card } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'
import { useFavorites } from '../lib/hooks'
import { minutes, price, tbilisiDate } from '../lib/format'
import { languageLabel } from '../lib/labels'

export default function DentistPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { isFav, toggle } = useFavorites()
  const dq = useQuery({ queryKey: ['dentist', id], queryFn: () => getDentist(id) })
  const services = useQuery({ queryKey: ['dentist-services', id], queryFn: () => getDentistServices(id), enabled: !!dq.data })
  const reviews = useQuery({ queryKey: ['dentist-reviews', id], queryFn: () => getReviews({ dentistId: id }), enabled: !!dq.data })
  const [serviceId, setServiceId] = useState<string>()
  const svc = services.data?.find(s => s.id === serviceId) ?? services.data?.[0]
  const from = tbilisiDate()
  const slots = useQuery({ queryKey: ['slots', svc?.id, from, id], queryFn: () => getSlots(svc!.id, from, 14, id), enabled: !!svc })

  if (dq.isLoading) return <Spinner />
  if (dq.error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={dq.error} /></div>
  const d = dq.data
  if (!d) return <div className="p-10 text-center">ექიმი ვერ მოიძებნა</div>

  const rs = reviews.data ?? []
  const avg = rs.length ? rs.reduce((a, r) => a + r.overall, 0) / rs.length : null

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <section className={`${card} flex flex-wrap items-center gap-5 p-6`}>
          <Avatar name={d.full_name} size={96} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">{d.full_name}{d.verified && <span title="გადამოწმებული ექიმი"><BadgeCheck className="text-brand-600" /></span>}</h1>
            <p className="text-lg text-muted">{d.specialty}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><Briefcase size={15} /> {d.years_experience} წლის გამოცდილება</span>
              <span className="inline-flex items-center gap-1"><Languages size={15} /> {d.languages.map(l => languageLabel[l] ?? l).join(', ')}</span>
              {avg && <span className="inline-flex items-center gap-1.5"><Stars value={avg} size={14} /> <b className="text-ink">{avg.toFixed(1)}</b> ({rs.length})</span>}
            </div>
            <Link to={`/clinics/${d.clinics.slug}`} className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-700"><MapPin size={15} /> {d.clinics.name}, {d.clinics.cities?.name}</Link>
          </div>
          <Button variant="secondary" onClick={() => toggle({ dentist_id: d.id })}>
            <Heart size={17} className={isFav({ dentist_id: d.id }) ? 'fill-rose-500 text-rose-500' : ''} /> {isFav({ dentist_id: d.id }) ? 'შენახულია' : 'შენახვა'}
          </Button>
        </section>

        {d.bio && <section className={`${card} p-6`}><h2 className="mb-2 text-xl font-extrabold">ექიმის შესახებ</h2><p className="leading-relaxed text-ink/80">{d.bio}</p></section>}

        <section className={`${card} p-6`}>
          <h2 className="mb-3 text-xl font-extrabold">მომსახურება და ფასები</h2>
          <ul className="divide-y divide-line">
            {services.data?.map(s => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div><div className="font-semibold">{s.name}</div><div className="text-sm text-muted">{minutes(s.duration_min)}</div></div>
                <div className="font-extrabold">{price(s.price_kind, s.price_gel, { short: true })}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-6`}>
          <h2 className="mb-3 text-xl font-extrabold">შეფასებები</h2>
          {rs.length === 0 ? <p className="text-muted">შეფასებები ჯერ არ არის.</p> : (
            <ul className="space-y-3">
              {rs.map(r => (
                <li key={r.id} className="rounded-2xl p-4 ring-1 ring-line">
                  <div className="flex items-center justify-between"><b>{r.author_name}</b><Stars value={r.overall} size={14} /></div>
                  <p className="mt-1.5 text-ink/85">{r.body}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700"><ShieldCheck size={13} /> დადასტურებული ვიზიტი</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className={`${card} min-w-0 self-start p-5 lg:sticky lg:top-20`}>
        <h2 className="text-lg font-extrabold">დაჯავშნე {d.full_name.split(' ')[0]}-თან</h2>
        {services.data && services.data.length > 0 && (
          <select value={svc?.id ?? ''} onChange={e => setServiceId(e.target.value)} className="my-3 h-12 w-full rounded-xl border border-line bg-white px-3 font-medium outline-none">
            {services.data.map(s => <option key={s.id} value={s.id}>{s.name} · {price(s.price_kind, s.price_gel, { short: true })}</option>)}
          </select>
        )}
        {svc && <SlotPicker slots={slots.data ?? []} from={from} loading={slots.isLoading}
          onSelect={s => nav(`/clinics/${d.clinics.slug}/book?service=${svc.id}&dentist=${d.id}&slot=${encodeURIComponent(s.starts_at)}`)}
          empty={<p className="text-sm text-muted">უახლოეს დღეებში თავისუფალი დრო არ არის.</p>} />}
      </aside>
    </div>
  )
}
