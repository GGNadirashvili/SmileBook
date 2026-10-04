import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Navigation, X, Star, Trash2, Plus, CalendarClock, XCircle, Heart, Users, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import {
  addFamily, cancelAppointment, createReview, friendlyError, getClinicsByIds, getDentistsByIds, getFamily, getSlots,
  myAppointments, removeFamily, rescheduleAppointment, reviewedAppointmentIds, updateProfile,
} from '../lib/api'
import { useFavorites } from '../lib/hooks'
import { Avatar, Button, Empty, ErrorNote, Spinner, card } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'
import { dayLong, price, tbilisiDate, time } from '../lib/format'
import { relationLabel, statusLabel, statusStyle } from '../lib/labels'
import { directionsUrl, downloadIcs, googleCalendarUrl } from '../lib/calendar'
import type { Appointment } from '../lib/types'

type Tab = 'visits' | 'favorites' | 'family' | 'profile'
const tabs: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: 'visits', label: 'ვიზიტები', icon: CalendarClock }, { id: 'favorites', label: 'შენახული', icon: Heart },
  { id: 'family', label: 'ოჯახი', icon: Users }, { id: 'profile', label: 'პროფილი', icon: UserRound },
]

export default function Account() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<Tab>(location.hash === '#family' ? 'family' : 'visits')
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login?next=/account" replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">ჩემი ანგარიში</h1>
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition ${tab === t.id ? 'bg-brand-700 text-white' : 'bg-white ring-1 ring-line hover:ring-brand-300'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'visits' && <Visits />}
        {tab === 'favorites' && <Favorites />}
        {tab === 'family' && <Family />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </div>
  )
}

// ───────────── visits ─────────────
function Visits() {
  const qc = useQueryClient()
  const appts = useQuery({ queryKey: ['appointments'], queryFn: myAppointments })
  const reviewed = useQuery({ queryKey: ['reviewed'], queryFn: reviewedAppointmentIds })
  const [resched, setResched] = useState<Appointment | null>(null)
  const [reviewing, setReviewing] = useState<Appointment | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (appts.isLoading) return <Spinner />
  if (appts.error) return <ErrorNote error={appts.error} />
  const now = Date.now()
  const upcoming = (appts.data ?? []).filter(a => new Date(a.ends_at).getTime() >= now && ['pending', 'confirmed'].includes(a.status)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
  const past = (appts.data ?? []).filter(a => !upcoming.includes(a))

  async function cancel(a: Appointment) {
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ ვიზიტის გაუქმება?')) return
    try { await cancelAppointment(a.id); setMsg({ ok: true, text: 'ვიზიტი გაუქმდა.' }); await qc.invalidateQueries({ queryKey: ['appointments'] }) }
    catch (e) { setMsg({ ok: false, text: friendlyError(e) }) }
  }

  const Row = ({ a, isUpcoming }: { a: Appointment; isUpcoming: boolean }) => {
    const ev = { title: `${a.clinic_services?.name} — ${a.clinics?.name}`, start: a.starts_at, end: a.ends_at, location: a.clinics?.address, details: `ექიმი: ${a.dentists?.full_name}` }
    return (
      <li className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold">{a.clinic_services?.name}</div>
            <div className="font-semibold text-brand-700">{dayLong(a.starts_at)} · {time(a.starts_at)}</div>
            <Link to={`/clinics/${a.clinics?.slug}`} className="mt-1 block text-sm text-muted hover:text-brand-700">{a.clinics?.name} · {a.clinics?.address}</Link>
            <div className="text-sm text-muted">ექიმი: {a.dentists?.full_name} · პაციენტი: {a.patient_name}</div>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[a.status]}`}>{statusLabel[a.status]}</span>
            <div className="mt-1 text-sm font-bold">{price(a.price_kind, a.price_gel, { short: true })}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {isUpcoming && <>
            <Button size="sm" variant="secondary" onClick={() => setResched(a)}><CalendarClock size={15} /> გადაცვლა</Button>
            <Button size="sm" variant="danger" onClick={() => cancel(a)}><XCircle size={15} /> გაუქმება</Button>
            <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><CalendarPlus size={15} /> Google</Button></a>
            <Button size="sm" variant="ghost" onClick={() => downloadIcs(ev)}><CalendarPlus size={15} /> .ics</Button>
            {a.clinics && <a href={directionsUrl(a.clinics.lat, a.clinics.lng)} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Navigation size={15} /> მარშრუტი</Button></a>}
          </>}
          {a.status === 'completed' && !reviewed.data?.includes(a.id) && <Button size="sm" onClick={() => setReviewing(a)}><Star size={15} /> შეაფასე</Button>}
          {a.status === 'completed' && reviewed.data?.includes(a.id) && <span className="text-sm text-brand-700">✓ შეფასებული</span>}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-8">
      {msg && <div className={`rounded-xl p-3 text-sm font-medium ${msg.ok ? 'bg-brand-50 text-brand-800' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</div>}
      <section>
        <h2 className="mb-3 text-xl font-extrabold">მომავალი ვიზიტები</h2>
        {upcoming.length === 0
          ? <Empty title="მომავალი ვიზიტები არ გაქვთ" hint="იპოვეთ კლინიკა და დაჯავშნეთ რამდენიმე დაწკაპუნებით." action={<Link to="/search"><Button>კლინიკების ძებნა</Button></Link>} />
          : <ul className="space-y-3">{upcoming.map(a => <Row key={a.id} a={a} isUpcoming />)}</ul>}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">ისტორია</h2>
          <ul className="space-y-3">{past.map(a => <Row key={a.id} a={a} isUpcoming={false} />)}</ul>
        </section>
      )}
      {resched && <RescheduleModal a={resched} onClose={() => setResched(null)} onDone={async () => { setResched(null); setMsg({ ok: true, text: 'ვიზიტი გადაიცვალა.' }); await qc.invalidateQueries({ queryKey: ['appointments'] }) }} />}
      {reviewing && <ReviewModal a={reviewing} onClose={() => setReviewing(null)} onDone={async () => { setReviewing(null); setMsg({ ok: true, text: 'მადლობა შეფასებისთვის!' }); await qc.invalidateQueries({ queryKey: ['reviewed'] }) }} />}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1500] grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-pop" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-extrabold">{title}</h3><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="დახურვა"><X /></button></div>
        {children}
      </div>
    </div>
  )
}

function RescheduleModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const from = tbilisiDate()
  const slots = useQuery({ queryKey: ['resched-slots', a.service_id, a.dentist_id], queryFn: () => getSlots(a.service_id, from, 14, a.dentist_id) })
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function save() {
    if (!picked) return
    setBusy(true); setErr(null)
    try { await rescheduleAppointment(a.id, picked); onDone() } catch (e) { setErr(friendlyError(e)) } finally { setBusy(false) }
  }
  return (
    <Modal title="ვიზიტის გადაცვლა" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">{a.clinic_services?.name} · {a.dentists?.full_name}</p>
      <SlotPicker slots={slots.data ?? []} from={from} loading={slots.isLoading} selected={picked} onSelect={s => setPicked(s.starts_at)} />
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      <Button size="lg" className="mt-5 w-full" disabled={!picked} busy={busy} onClick={save}>დადასტურება</Button>
    </Modal>
  )
}

function ReviewModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const [r, setR] = useState({ overall: 5, staff: 5, cleanliness: 5, waiting: 5 })
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function save() {
    setBusy(true); setErr(null)
    try { await createReview({ appointmentId: a.id, ...r, body }); onDone() } catch (e) { setErr(friendlyError(e)) } finally { setBusy(false) }
  }
  const Rate = ({ k, label }: { k: keyof typeof r; label: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[15px]">{label}</span>
      <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => setR({ ...r, [k]: n })} aria-label={`${n} ვარსკვლავი`}><Star size={26} className={n <= r[k] ? 'fill-sun-400 text-sun-400' : 'text-slate-300'} /></button>
      ))}</span>
    </div>
  )
  return (
    <Modal title="შეაფასე ვიზიტი" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{a.clinics?.name} · {a.dentists?.full_name}</p>
      <div className="divide-y divide-line rounded-2xl bg-slate-50 px-4">
        <Rate k="overall" label="საერთო" /><Rate k="staff" label="პერსონალი" /><Rate k="cleanliness" label="სისუფთავე" /><Rate k="waiting" label="ლოდინის დრო" />
      </div>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="დაწერეთ თქვენი შთაბეჭდილება…" className="mt-4 w-full rounded-xl border border-line p-3 outline-none focus:border-brand-400" />
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      <Button size="lg" className="mt-4 w-full" busy={busy} onClick={save}>გაგზავნა</Button>
    </Modal>
  )
}

// ───────────── favorites ─────────────
function Favorites() {
  const { list, toggle } = useFavorites()
  const clinicIds = list.filter(f => f.clinic_id).map(f => f.clinic_id!)
  const dentistIds = list.filter(f => f.dentist_id).map(f => f.dentist_id!)
  const clinics = useQuery({ queryKey: ['fav-clinics', clinicIds], queryFn: () => getClinicsByIds(clinicIds) })
  const dentists = useQuery({ queryKey: ['fav-dentists', dentistIds], queryFn: () => getDentistsByIds(dentistIds) })
  if (!list.length) return <Empty title="შენახული არაფერი გაქვთ" hint="დააჭირეთ გულს კლინიკის ან ექიმის გვერდზე, რომ მალე იპოვოთ." />
  return (
    <div className="space-y-6">
      {clinics.data && clinics.data.length > 0 && <section><h2 className="mb-3 text-xl font-extrabold">კლინიკები</h2><ul className="space-y-2">
        {clinics.data.map(c => <li key={c.id} className={`${card} flex items-center justify-between p-4`}><Link to={`/clinics/${c.slug}`} className="font-semibold hover:text-brand-700">{c.name}<span className="block text-sm font-normal text-muted">{c.address}, {c.cities?.name}</span></Link>
          <button onClick={() => toggle({ clinic_id: c.id })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-rose-50" aria-label="წაშლა"><Heart className="fill-rose-500 text-rose-500" size={18} /></button></li>)}</ul></section>}
      {dentists.data && dentists.data.length > 0 && <section><h2 className="mb-3 text-xl font-extrabold">ექიმები</h2><ul className="space-y-2">
        {dentists.data.map(d => <li key={d.id} className={`${card} flex items-center justify-between p-4`}><Link to={`/dentists/${d.id}`} className="flex items-center gap-3 font-semibold hover:text-brand-700"><Avatar name={d.full_name} size={42} /><span>{d.full_name}<span className="block text-sm font-normal text-muted">{d.specialty} · {d.clinics?.name}</span></span></Link>
          <button onClick={() => toggle({ dentist_id: d.id })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-rose-50" aria-label="წაშლა"><Heart className="fill-rose-500 text-rose-500" size={18} /></button></li>)}</ul></section>}
    </div>
  )
}

// ───────────── family ─────────────
function Family() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fam = useQuery({ queryKey: ['family', user?.id], queryFn: getFamily })
  const [name, setName] = useState(''); const [rel, setRel] = useState('child')
  async function add() {
    if (!name.trim() || !user) return
    await addFamily({ full_name: name.trim(), relation: rel, owner_id: user.id })
    setName(''); await qc.invalidateQueries({ queryKey: ['family'] })
  }
  return (
    <div id="family" className="space-y-4">
      <p className="text-muted">დაჯავშნეთ ვიზიტი შვილის, მშობლის ან მეუღლისთვის — ერთი ანგარიშიდან.</p>
      <ul className="space-y-2">
        {fam.data?.map(m => (
          <li key={m.id} className={`${card} flex items-center justify-between p-4`}>
            <span className="flex items-center gap-3"><Avatar name={m.full_name} size={42} /><span className="font-semibold">{m.full_name}<span className="block text-sm font-normal text-muted">{relationLabel[m.relation] ?? m.relation}</span></span></span>
            <button onClick={async () => { await removeFamily(m.id); await qc.invalidateQueries({ queryKey: ['family'] }) }} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50" aria-label="წაშლა"><Trash2 size={17} /></button>
          </li>
        ))}
      </ul>
      <div className={`${card} flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-48 flex-1"><label className="mb-1 block text-sm font-semibold">სახელი და გვარი</label><input value={name} onChange={e => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-400" /></div>
        <div><label className="mb-1 block text-sm font-semibold">ვინ არის</label>
          <select value={rel} onChange={e => setRel(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3">{Object.entries(relationLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <Button onClick={add}><Plus size={16} /> დამატება</Button>
      </div>
    </div>
  )
}

// ───────────── profile ─────────────
function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? ''); const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saved, setSaved] = useState(false)
  if (!user) return null
  return (
    <div className={`${card} max-w-lg space-y-4 p-6`}>
      <div><label className="mb-1 block text-sm font-semibold">ელფოსტა</label><input disabled value={user.email ?? ''} className="h-11 w-full rounded-xl border border-line bg-slate-50 px-3 text-muted" /></div>
      <div><label className="mb-1 block text-sm font-semibold">სახელი და გვარი</label><input value={name} onChange={e => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-400" /></div>
      <div><label className="mb-1 block text-sm font-semibold">ტელეფონი</label><input value={phone} onChange={e => setPhone(e.target.value)} className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand-400" /></div>
      <Button onClick={async () => { await updateProfile(user.id, { full_name: name, phone }); await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000) }}>{saved ? '✓ შენახულია' : 'შენახვა'}</Button>
    </div>
  )
}
