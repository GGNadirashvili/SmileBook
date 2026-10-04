import { Link } from 'react-router-dom'
import { Heart, MapPin, Clock, Car, Accessibility, TrainFront, Megaphone, Siren } from 'lucide-react'
import type { ClinicHit } from '../lib/types'
import { km, price, relativeSlot } from '../lib/format'
import { Chip, Rating, Verified } from './ui'
import { Cover } from './Cover'
import { useFavorites } from '../lib/hooks'

interface Props { c: ClinicHit; active?: boolean; onHover?: (id: string | null) => void }

export function ClinicCard({ c, active, onHover }: Props) {
  const { isFav, toggle } = useFavorites()
  const fav = isFav({ clinic_id: c.id })
  const bookHref = c.next_slot && c.service_id
    ? `/clinics/${c.slug}/book?service=${c.service_id}&slot=${encodeURIComponent(c.next_slot)}${c.next_dentist_id ? `&dentist=${c.next_dentist_id}` : ''}`
    : `/clinics/${c.slug}#times`

  return (
    <article
      onMouseEnter={() => onHover?.(c.id)} onMouseLeave={() => onHover?.(null)}
      className={`group rise flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition sm:flex-row ${active ? 'ring-2 ring-brand-500' : 'ring-line hover:ring-brand-200'}`}
    >
      <Link to={`/clinics/${c.slug}`} className="relative block h-36 shrink-0 sm:h-auto sm:w-44">
        <Cover id={c.id} name={c.name} url={c.cover_url} className="h-full w-full" />
        {c.sponsored && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-muted"><Megaphone size={11} /> რეკლამა</span>}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/clinics/${c.slug}`} className="block truncate text-lg font-bold leading-tight hover:text-brand-700">{c.name}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <Rating value={c.rating} count={c.review_count} />
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {[c.district_name, c.city_name].filter(Boolean).join(', ')}</span>
              {c.distance_km != null && <span className="font-medium text-brand-700">{km(c.distance_km)}</span>}
            </div>
          </div>
          <button onClick={() => toggle({ clinic_id: c.id })} aria-label={fav ? 'ფავორიტებიდან ამოღება' : 'ფავორიტებში დამატება'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-rose-50">
            <Heart size={19} className={fav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {c.verified && <Verified label="გადამოწმებული კლინიკა" />}
          {c.open_now && <Chip tone="brand"><Clock size={12} /> ახლა ღიაა</Chip>}
          {c.emergency && <Chip tone="coral"><Siren size={12} /> გადაუდებელი</Chip>}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-1">
          <div>
            {c.service_name && <div className="text-xs text-muted">{c.service_name}</div>}
            <div className="text-xl font-extrabold text-ink">{price(c.price_kind, c.price_gel, { short: true })}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 text-xs text-muted lg:flex">
              <Accessibility size={13} className="opacity-0" />
            </div>
            {c.next_slot ? (
              <Link to={bookHref} className="rounded-xl bg-brand-50 px-3.5 py-2 text-left transition hover:bg-brand-100">
                <div className="text-[11px] font-medium uppercase tracking-wide text-brand-700">უახლოესი დრო</div>
                <div className="font-bold text-brand-800">{relativeSlot(c.next_slot)}</div>
              </Link>
            ) : (
              <Link to={bookHref} className="rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-muted">თავისუფალი დრო არ არის</Link>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function AmenityIcons({ parking, wheelchair, metro }: { parking?: boolean; wheelchair?: boolean; metro?: boolean }) {
  return (
    <span className="inline-flex gap-2 text-muted">
      {parking && <span title="პარკინგი"><Car size={15} /></span>}
      {wheelchair && <span title="ინვალიდის ეტლისთვის ადაპტირებული"><Accessibility size={15} /></span>}
      {metro && <span title="მეტროსთან"><TrainFront size={15} /></span>}
    </span>
  )
}
