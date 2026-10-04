import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, CalendarPlus, Navigation, Users, BellRing, Hourglass, Wallet } from 'lucide-react'
import { addDays, dayLong, minutes, price, tbilisiDate, time } from '../lib/format'
import { bookAppointment, friendlyError, getAppointment, getClinic, getClinicDentists, getClinicServices, getFamily, getSlots, joinWaitlist } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { Avatar, Button, ErrorNote, Spinner, card } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'
import { directionsUrl, downloadIcs, googleCalendarUrl } from '../lib/calendar'
import { relationLabel } from '../lib/labels'

const steps = ['მომსახურება', 'ექიმი და დრო', 'დადასტურება']

export default function Book() {
  const { slug = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { user, profile } = useAuth()

  const serviceId = sp.get('service') ?? undefined
  const dentistParam = sp.get('dentist') ?? 'any'
  const slot = sp.get('slot') ?? undefined
  const waitlistMode = sp.get('waitlist') === '1'
  const [bookedId, setBookedId] = useState<string | null>(null)

  const clinicQ = useQuery({ queryKey: ['clinic', slug], queryFn: () => getClinic(slug) })
  const clinic = clinicQ.data
  const services = useQuery({ queryKey: ['services', clinic?.id], queryFn: () => getClinicServices(clinic!.id), enabled: !!clinic })
  const dentists = useQuery({ queryKey: ['dentists', clinic?.id], queryFn: () => getClinicDentists(clinic!.id), enabled: !!clinic })
  const service = services.data?.find(s => s.id === serviceId)
  const offering = (dentists.data ?? []).filter(d => service && d.service_ids.includes(service.id))
  const dentist = dentistParam !== 'any' ? dentists.data?.find(d => d.id === dentistParam) : undefined

  const from = tbilisiDate()
  const slots = useQuery({
    queryKey: ['slots', service?.id, from, dentistParam],
    queryFn: () => getSlots(service!.id, from, 14, dentistParam === 'any' ? null : dentistParam),
    enabled: !!service && !slot,
  })

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)))
    setSp(n, { replace: false })
  }

  if (clinicQ.isLoading || services.isLoading) return <Spinner />
  if (clinicQ.error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={clinicQ.error} /></div>
  if (!clinic) return <div className="p-10 text-center">კლინიკა ვერ მოიძებნა</div>

  if (bookedId) return <Success id={bookedId} />

  const step = !service ? 0 : !slot ? 1 : 2

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={`/clinics/${clinic.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand-700"><ChevronLeft size={16} /> {clinic.name}</Link>

      <ol className="mb-6 flex items-center gap-2" aria-label="ნაბიჯები">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500'}`}>{i < step ? <Check size={16} /> : i + 1}</span>
            <span className={`hidden text-sm font-medium sm:inline ${i === step ? 'text-ink' : 'text-muted'}`}>{s}</span>
            {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < step ? 'bg-brand-500' : 'bg-slate-200'}`} />}
          </li>
        ))}
      </ol>

      {/* STEP 1 — service */}
      {step === 0 && (
        <section className={`${card} p-6`}>
          <h1 className="text-2xl font-extrabold">რა მომსახურება გჭირდებათ?</h1>
          <ul className="mt-4 space-y-2">
            {services.data?.map(s => (
              <li key={s.id}>
                <button onClick={() => set({ service: s.id, slot: null })} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line p-4 text-left transition hover:border-brand-400 hover:bg-brand-50">
                  <div><div className="font-semibold">{s.name}</div><div className="text-sm text-muted">{minutes(s.duration_min)}</div></div>
                  <div className="font-extrabold">{price(s.price_kind, s.price_gel, { short: true })}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* STEP 2 — dentist + time */}
      {step === 1 && service && (
        <section className={`${card} p-6`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold">აირჩიეთ ექიმი და დრო</h1>
              <p className="mt-1 text-muted">{service.name} · {minutes(service.duration_min)} · <b className="text-ink">{price(service.price_kind, service.price_gel, { short: true })}</b></p>
            </div>
            <button className="text-sm font-medium text-brand-700" onClick={() => set({ service: null, slot: null })}>შეცვლა</button>
          </div>

          <div className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
            <button onClick={() => set({ dentist: null })} className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition ${dentistParam === 'any' ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-200' : 'border-line bg-white hover:border-brand-300'}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-brand-700"><Users size={18} /></span>
              <span><div className="text-sm font-bold">ნებისმიერი ექიმი</div><div className="text-xs text-muted">ყველაზე სწრაფი დრო</div></span>
            </button>
            {offering.map((d, i) => (
              <button key={d.id} onClick={() => set({ dentist: d.id })} className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition ${dentistParam === d.id ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-200' : 'border-line bg-white hover:border-brand-300'}`}>
                <Avatar name={d.full_name} size={40} tone={i} />
                <span><div className="text-sm font-bold">{d.full_name}</div><div className="text-xs text-muted">{d.specialty}</div></span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <SlotPicker slots={slots.data ?? []} from={from} loading={slots.isLoading}
              onSelect={s => set({ slot: s.starts_at, dentist: dentistParam === 'any' ? null : s.dentist_id })}
              empty={<Waitlist clinicId={clinic.id} serviceId={service.id} dentistId={dentistParam === 'any' ? null : dentistParam} autoOpen={waitlistMode} />} />
            {(slots.data?.length ?? 0) > 0 && <Waitlist clinicId={clinic.id} serviceId={service.id} dentistId={dentistParam === 'any' ? null : dentistParam} compact />}
          </div>
        </section>
      )}

      {/* STEP 3 — confirm */}
      {step === 2 && service && slot && (
        <Confirm
          clinicName={clinic.name} address={clinic.address} instant={clinic.booking_mode === 'instant'} cancelHours={clinic.free_cancel_hours}
          serviceName={service.name} duration={service.duration_min} priceText={price(service.price_kind, service.price_gel)}
          dentistName={dentist?.full_name ?? (dentistParam === 'any' ? 'პირველი თავისუფალი ექიმი' : undefined)}
          slot={slot} loggedIn={!!user} defaultName={profile?.full_name ?? ''}
          onBack={() => set({ slot: null })}
          onConfirm={async ({ familyId, notes }) => {
            const id = await bookAppointment({ serviceId: service.id, startsAt: slot, dentistId: dentistParam === 'any' ? null : dentistParam, familyMemberId: familyId, notes })
            await qc.invalidateQueries({ queryKey: ['appointments'] })
            await qc.invalidateQueries({ queryKey: ['slots'] })
            setBookedId(id)
          }}
          onSlotTaken={() => { void qc.invalidateQueries({ queryKey: ['slots'] }); set({ slot: null }) }}
          loginHref={`/login?next=${encodeURIComponent(`/clinics/${slug}/book?${sp.toString()}`)}`}
          registerHref={`/register?next=${encodeURIComponent(`/clinics/${slug}/book?${sp.toString()}`)}`}
          navHome={() => nav('/')}
        />
      )}
    </div>
  )
}

interface ConfirmProps {
  clinicName: string; address: string; instant: boolean; cancelHours: number
  serviceName: string; duration: number; priceText: string; dentistName?: string; slot: string
  loggedIn: boolean; defaultName: string
  onBack: () => void; onConfirm: (a: { familyId: string | null; notes: string }) => Promise<void>
  onSlotTaken: () => void; loginHref: string; registerHref: string; navHome: () => void
}

function Confirm(p: ConfirmProps) {
  const { user } = useAuth()
  const family = useQuery({ queryKey: ['family', user?.id], queryFn: getFamily, enabled: p.loggedIn })
  const [who, setWho] = useState<string>('me')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function go() {
    setBusy(true); setErr(null)
    try { await p.onConfirm({ familyId: who === 'me' ? null : who, notes }) }
    catch (e) {
      const msg = friendlyError(e); setErr(msg)
      if (e instanceof Error && e.message.includes('slot_unavailable')) setTimeout(p.onSlotTaken, 1800)
    } finally { setBusy(false) }
  }

  return (
    <section className={`${card} p-6`}>
      <h1 className="text-2xl font-extrabold">დაადასტურეთ ჯავშანი</h1>

      <dl className="mt-5 divide-y divide-line rounded-2xl bg-brand-50/60 px-5 ring-1 ring-brand-100">
        {[
          ['მომსახურება', `${p.serviceName} · ${minutes(p.duration)}`],
          ['კლინიკა', `${p.clinicName}, ${p.address}`],
          ['ექიმი', p.dentistName ?? '—'],
          ['დრო', `${dayLong(p.slot)} · ${time(p.slot)}`],
          ['სავარაუდო ფასი', p.priceText],
        ].map(([k, v]) => <div key={k} className="flex justify-between gap-6 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
      </dl>

      <p className="mt-3 flex items-start gap-2 text-sm text-muted"><Wallet size={16} className="mt-0.5 shrink-0" /> გადახდა ხდება კლინიკაში. უფასო გაუქმება ვიზიტამდე {p.cancelHours} საათით ადრე. {p.instant ? '' : 'კლინიკა დაგიდასტურებთ ჯავშანს.'}</p>

      {!p.loggedIn ? (
        <div className="mt-6 rounded-2xl bg-sun-100 p-5">
          <p className="font-bold text-ink">ჯავშნის დასასრულებლად შედით ანგარიშში</p>
          <p className="text-sm text-amber-900">თქვენი არჩეული დრო შენახულია.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={p.loginHref}><Button>შესვლა</Button></Link>
            <Link to={p.registerHref}><Button variant="secondary">რეგისტრაცია</Button></Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <label className="mb-1.5 block text-sm font-semibold">ვის ჯავშნით?</label>
            <select value={who} onChange={e => setWho(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand-400">
              <option value="me">მე ({p.defaultName || 'ჩემი ანგარიში'})</option>
              {family.data?.map(f => <option key={f.id} value={f.id}>{f.full_name} ({relationLabel[f.relation] ?? f.relation})</option>)}
            </select>
            <Link to="/account#family" className="mt-1 inline-block text-sm font-medium text-brand-700">+ ოჯახის წევრის დამატება</Link>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold">კომენტარი კლინიკისთვის <span className="font-normal text-muted">(არასავალდებულო)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="მაგ. კბილი მტკივა 3 დღეა…" className="w-full rounded-xl border border-line p-3 outline-none focus:border-brand-400" />
          </div>
          {err && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{err}</div>}
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" size="lg" onClick={p.onBack}>უკან</Button>
            <Button size="lg" busy={busy} onClick={go} className="flex-1">დაჯავშნა</Button>
          </div>
        </>
      )}
    </section>
  )
}

function Waitlist({ clinicId, serviceId, dentistId, compact, autoOpen }: { clinicId: string; serviceId: string; dentistId: string | null; compact?: boolean; autoOpen?: boolean }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(!!autoOpen)
  const [days, setDays] = useState(14)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function join() {
    if (!user) { nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`); return }
    try {
      const today = tbilisiDate()
      await joinWaitlist({ user_id: user.id, clinic_id: clinicId, service_id: serviceId, dentist_id: dentistId, date_from: today, date_to: addDays(today, days) })
      setDone(true)
    } catch (e) { setErr(friendlyError(e)) }
  }

  if (done) return <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-50 p-4 text-brand-800"><BellRing size={18} /> ჩაგწერეთ მოლოდინის სიაში. თუ დრო გათავისუფლდება, ელფოსტით შეგატყობინებთ.</div>
  return (
    <div className={compact ? 'mt-5 border-t border-line pt-4' : ''}>
      {!compact && <p className="mb-3 font-semibold">უახლოეს დღეებში თავისუფალი დრო არ მოიძებნა.</p>}
      {!open ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-sun-100 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-sun-300/60"><Hourglass size={16} /> {compact ? 'სასურველი დრო არ არის? ' : ''}შემატყობინეთ, თუ დრო გამოთავისუფლდება</button>
      ) : (
        <div className="rounded-2xl bg-sun-100 p-4">
          <p className="text-sm font-semibold text-amber-900">შეგატყობინებთ პირველს, როცა დრო გათავისუფლდება:</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm">
              <option value={7}>მომდევნო 7 დღეში</option><option value={14}>მომდევნო 14 დღეში</option><option value={30}>მომდევნო 30 დღეში</option>
            </select>
            <Button size="sm" onClick={join}>მომწერეთ</Button>
          </div>
          {err && <p className="mt-2 text-sm text-rose-700">{err}</p>}
        </div>
      )}
    </div>
  )
}

function Success({ id }: { id: string }) {
  const { data: a, isLoading } = useQuery({ queryKey: ['appointment', id], queryFn: () => getAppointment(id) })
  if (isLoading || !a) return <Spinner />
  const ev = {
    title: `${a.clinic_services?.name} — ${a.clinics?.name}`, start: a.starts_at, end: a.ends_at,
    location: a.clinics?.address, details: `ექიმი: ${a.dentists?.full_name}`,
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <div className="rise mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-100 text-brand-700"><Check size={40} strokeWidth={3} /></div>
      <h1 className="text-3xl font-extrabold">{a.status === 'confirmed' ? 'ჯავშანი დადასტურებულია!' : 'მოთხოვნა გაიგზავნა!'}</h1>
      <p className="mt-2 text-muted">{a.status === 'confirmed' ? 'გელით ვიზიტზე.' : 'კლინიკა მალე დაგიდასტურებთ ჯავშანს.'}</p>

      <div className={`${card} mt-6 p-5 text-left`}>
        <div className="text-lg font-bold">{a.clinic_services?.name}</div>
        <div className="mt-1 text-brand-700 font-semibold">{dayLong(a.starts_at)} · {time(a.starts_at)}</div>
        <div className="mt-3 text-sm text-muted">{a.clinics?.name} · {a.clinics?.address}</div>
        <div className="text-sm text-muted">ექიმი: {a.dentists?.full_name} · {a.patient_name}</div>
        <div className="mt-2 text-sm font-semibold">{price(a.price_kind, a.price_gel)}</div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer"><Button variant="secondary"><CalendarPlus size={17} /> Google Calendar</Button></a>
        <Button variant="secondary" onClick={() => downloadIcs(ev)}><CalendarPlus size={17} /> Apple / Outlook (.ics)</Button>
        {a.clinics && <a href={directionsUrl(a.clinics.lat, a.clinics.lng)} target="_blank" rel="noreferrer"><Button variant="secondary"><Navigation size={17} /> მარშრუტი</Button></a>}
      </div>
      <Link to="/account" className="mt-6 inline-block font-semibold text-brand-700">ჩემი ვიზიტები →</Link>
    </div>
  )
}
