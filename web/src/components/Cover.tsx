const palettes = [
  ['#5fdfcb', '#0f716b'], ['#9aefdf', '#14ab9e'], ['#ffd866', '#ee9b2d'], ['#ffb199', '#ee5f3b'], ['#a8e1ff', '#2a8fc4'],
]
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }

/** Friendly generated cover (until clinics upload real photos). */
export function Cover({ id, name, url, className = '' }: { id: string; name: string; url?: string | null; className?: string }) {
  if (url) return <img src={url} alt={name} className={`object-cover ${className}`} loading="lazy" />
  const [a, b] = palettes[hash(id) % palettes.length]
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} role="img" aria-label={name}>
      <svg className="absolute -bottom-6 -right-4 opacity-25" width="150" height="150" viewBox="0 0 48 48">
        <path fill="#fff" d="M24 13C21 10.5 17 10 14.5 12C11.5 14.5 12 19 13.5 23C14.8 26.5 15 31 16.5 35C17.4 37.5 19.5 37.5 20.2 35C21 32.5 21.8 29 24 29C26.2 29 27 32.5 27.8 35C28.5 37.5 30.6 37.5 31.5 35C33 31 33.2 26.5 34.5 23C36 19 36.5 14.5 33.5 12C31 10 27 10.5 24 13Z" />
      </svg>
      <svg className="absolute left-3 top-3 opacity-40" width="22" height="22" viewBox="0 0 48 48"><path fill="#fff" d="M24 4l4 14 14 4-14 4-4 14-4-14-14-4 14-4z" /></svg>
    </div>
  )
}
