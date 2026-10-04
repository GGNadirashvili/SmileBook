export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#lg)" />
      <path fill="#fff" d="M24 13C21 10.5 17 10 14.5 12C11.5 14.5 12 19 13.5 23C14.8 26.5 15 31 16.5 35C17.4 37.5 19.5 37.5 20.2 35C21 32.5 21.8 29 24 29C26.2 29 27 32.5 27.8 35C28.5 37.5 30.6 37.5 31.5 35C33 31 33.2 26.5 34.5 23C36 19 36.5 14.5 33.5 12C31 10 27 10.5 24 13Z" />
      <path d="M18.5 20.5Q24 25.5 29.5 20.5" fill="none" stroke="#0f766e" strokeWidth="2.4" strokeLinecap="round" />
      <path fill="#ffc233" d="M38 5l1.1 3 3 1.1-3 1.1L38 13.2l-1.1-3-3-1.1 3-1.1z" />
    </svg>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-[22px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        Smile<span className={light ? 'text-brand-200' : 'text-brand-600'}>Book</span>
      </span>
    </span>
  )
}
