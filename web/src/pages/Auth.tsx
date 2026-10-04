import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Button, card } from '../components/ui'
import { LogoMark } from '../components/Logo'

const input = 'h-12 w-full rounded-xl border border-line bg-white px-4 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md px-4 py-12">
      <div className="mb-6 text-center"><div className="mb-3 inline-block"><LogoMark size={52} /></div><h1 className="text-3xl font-extrabold">{title}</h1><p className="mt-1 text-muted">{sub}</p></div>
      <div className={`${card} p-6`}>{children}</div>
    </div>
  )
}

function authMessage(m: string) {
  if (/invalid login/i.test(m)) return 'ელფოსტა ან პაროლი არასწორია.'
  if (/already registered|already been registered/i.test(m)) return 'ეს ელფოსტა უკვე რეგისტრირებულია.'
  if (/email not confirmed/i.test(m)) return 'გთხოვთ, ჯერ დაადასტუროთ ელფოსტა.'
  if (/password/i.test(m)) return 'პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს.'
  return 'ვერ მოხერხდა. სცადეთ თავიდან.'
}

export function Login() {
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/account'
  const nav = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(authMessage(error.message)); else nav(next, { replace: true })
  }
  return (
    <Shell title="კეთილი იყოს თქვენი მობრძანება" sub="შედით ანგარიშში ვიზიტების სამართავად">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="mb-1.5 block text-sm font-semibold">ელფოსტა</label><input className={input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="mb-1.5 block text-sm font-semibold">პაროლი</label><input className={input} type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {err && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{err}</p>}
        <Button type="submit" size="lg" busy={busy} className="w-full">შესვლა</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">ანგარიში არ გაქვთ? <Link className="font-semibold text-brand-700" to={`/register?next=${encodeURIComponent(next)}`}>რეგისტრაცია</Link></p>
    </Shell>
  )
}

export function Register() {
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/account'
  const nav = useNavigate()
  const { user } = useAuth()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false)
  if (user) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    const { data, error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { data: { full_name: f.name, phone: f.phone }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + next },
    })
    setBusy(false)
    if (error) { setErr(authMessage(error.message)); return }
    if (data.session) nav(next, { replace: true }); else setSent(true)
  }

  if (sent) return (
    <Shell title="შეამოწმეთ ელფოსტა" sub="">
      <div className="text-center"><MailCheck className="mx-auto mb-3 text-brand-600" size={44} /><p>დადასტურების ბმული გამოგიგზავნეთ მისამართზე <b>{f.email}</b>. დაადასტურეთ და შემდეგ შედით ანგარიშში.</p>
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="mt-4 inline-block font-semibold text-brand-700">შესვლა →</Link></div>
    </Shell>
  )
  return (
    <Shell title="შექმენით ანგარიში" sub="დაჯავშნეთ და მართეთ ვიზიტები ერთ სივრცეში">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="mb-1.5 block text-sm font-semibold">სახელი და გვარი</label><input className={input} required autoComplete="name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="mb-1.5 block text-sm font-semibold">ელფოსტა</label><input className={input} type="email" required autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="mb-1.5 block text-sm font-semibold">ტელეფონი</label><input className={input} type="tel" placeholder="+995 5xx xx xx xx" autoComplete="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="mb-1.5 block text-sm font-semibold">პაროლი</label><input className={input} type="password" minLength={6} required autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
        {err && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{err}</p>}
        <Button type="submit" size="lg" busy={busy} className="w-full">რეგისტრაცია</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">უკვე გაქვთ ანგარიში? <Link className="font-semibold text-brand-700" to={`/login?next=${encodeURIComponent(next)}`}>შესვლა</Link></p>
    </Shell>
  )
}
