import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Siren, User, LogOut, CalendarDays, Menu, X, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Logo } from './Logo'
import { useAuth } from '../auth/AuthProvider'

export function Header() {
  const { user, profile, signOut } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-[15px] font-medium transition hover:bg-brand-50 ${isActive ? 'text-brand-700' : 'text-ink'}`

  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" aria-label="SmileBook"><Logo /></Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/search" className={link}>კლინიკები</NavLink>
          <NavLink to="/search?emergency=1&sort=earliest" className={link}>
            <span className="inline-flex items-center gap-1.5 text-coral-600"><Siren size={16} /> გადაუდებელი</span>
          </NavLink>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {profile?.role === 'admin' && <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50"><ShieldCheck size={16} /> ადმინი</Link>}
              {profile?.role === 'clinic_staff' && <Link to="/clinic" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50"><LayoutDashboard size={16} /> კლინიკის პანელი</Link>}
              <Link to="/account" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-brand-50">
                <CalendarDays size={16} /> ჩემი ვიზიტები
              </Link>
              <button onClick={async () => { await signOut(); nav('/') }} title="გასვლა" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-brand-50"><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-4 py-2 text-[15px] font-semibold text-brand-700 hover:bg-brand-50">შესვლა</Link>
              <Link to="/register" className="rounded-xl bg-brand-700 px-4 py-2 text-[15px] font-semibold text-white hover:bg-brand-800">რეგისტრაცია</Link>
            </>
          )}
        </div>

        <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-brand-50 md:hidden" onClick={() => setOpen(o => !o)} aria-label="მენიუ">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-white px-4 pb-4 md:hidden" onClick={() => setOpen(false)}>
          <div className="flex flex-col py-2">
            <Link className="rounded-lg px-3 py-3 font-medium" to="/search">კლინიკები</Link>
            <Link className="rounded-lg px-3 py-3 font-medium text-coral-600" to="/search?emergency=1&sort=earliest">🚨 გადაუდებელი დახმარება</Link>
            {user ? (
              <>
                <Link className="rounded-lg px-3 py-3 font-medium" to="/account"><User size={16} className="mr-2 inline" />ჩემი ვიზიტები</Link>
                {profile?.role === 'clinic_staff' && <Link className="rounded-lg px-3 py-3 font-medium" to="/clinic">კლინიკის პანელი</Link>}
                {profile?.role === 'admin' && <Link className="rounded-lg px-3 py-3 font-medium" to="/admin">ადმინისტრატორი</Link>}
                <button className="rounded-lg px-3 py-3 text-left font-medium text-muted" onClick={() => signOut()}>გასვლა</button>
              </>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link to="/login" className="flex-1 rounded-xl border border-line py-3 text-center font-semibold">შესვლა</Link>
                <Link to="/register" className="flex-1 rounded-xl bg-brand-700 py-3 text-center font-semibold text-white">რეგისტრაცია</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
