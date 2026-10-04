import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import Search from './pages/Search'
import ClinicPage from './pages/Clinic'
import DentistPage from './pages/Dentist'
import Book from './pages/Book'
import Account from './pages/Account'
import { Login, Register } from './pages/Auth'
import { ComingSoon } from './pages/Placeholder'
import { LogoMark } from './components/Logo'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } })

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Setup() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <LogoMark size={64} />
      <h1 className="mt-6 text-3xl font-extrabold">Supabase ჯერ არ არის დაკავშირებული</h1>
      <p className="mt-3 text-muted">შექმენით <code>web/.env</code> ფაილი და ჩაწერეთ <code>VITE_SUPABASE_URL</code> და <code>VITE_SUPABASE_ANON_KEY</code> (იხილეთ <code>.env.example</code>). შემდეგ გადატვირთეთ dev სერვერი.</p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <Setup />
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <ScrollTop />
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/clinics/:slug" element={<ClinicPage />} />
                <Route path="/clinics/:slug/book" element={<Book />} />
                <Route path="/dentists/:id" element={<DentistPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/account" element={<Account />} />
                <Route path="/clinic/*" element={<ComingSoon title="კლინიკის პანელი" />} />
                <Route path="/admin/*" element={<ComingSoon title="ადმინისტრატორის პანელი" />} />
                <Route path="*" element={<ComingSoon title="გვერდი ვერ მოიძებნა" />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
