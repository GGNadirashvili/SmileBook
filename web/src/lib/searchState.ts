import type { SearchFilters } from './types'

export interface SearchState extends SearchFilters { intent?: number }

const num = (v: string | null) => (v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined)
const flag = (v: string | null) => (v === '1' ? true : undefined)

export function parseParams(sp: URLSearchParams): SearchState {
  const s: SearchState = {
    city_id: num(sp.get('city')), district_id: num(sp.get('district')), category_id: num(sp.get('cat')),
    q: sp.get('q') || undefined, intent: num(sp.get('intent')),
    date: sp.get('date') || undefined,
    part: (sp.get('part') as SearchState['part']) || undefined,
    within_hours: num(sp.get('within')),
    open_now: flag(sp.get('open')), open_weekends: flag(sp.get('weekends')), emergency: flag(sp.get('emergency')),
    languages: sp.get('lang') ? sp.get('lang')!.split(',') : undefined,
    min_price: num(sp.get('minp')), max_price: num(sp.get('maxp')),
    min_rating: num(sp.get('rating')), min_reviews: num(sp.get('reviews')),
    patient_type: (sp.get('ptype') as SearchState['patient_type']) || undefined,
    wheelchair: flag(sp.get('wc')), parking: flag(sp.get('park')), near_metro: flag(sp.get('metro')),
    card: flag(sp.get('card')), cash: flag(sp.get('cash')), installments: flag(sp.get('inst')),
    dentist_gender: (sp.get('gender') as SearchState['dentist_gender']) || undefined,
    min_experience: num(sp.get('exp')),
    lat: num(sp.get('lat')), lng: num(sp.get('lng')), max_km: num(sp.get('km')),
    sort: (sp.get('sort') as SearchState['sort']) || undefined,
  }
  return s
}

export function toParams(s: SearchState): URLSearchParams {
  const sp = new URLSearchParams()
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== '' && v !== false && v !== null) sp.set(k, v === true ? '1' : String(v)) }
  set('city', s.city_id); set('district', s.district_id); set('cat', s.category_id); set('q', s.q); set('intent', s.intent)
  set('date', s.date); set('part', s.part); set('within', s.within_hours)
  set('open', s.open_now); set('weekends', s.open_weekends); set('emergency', s.emergency)
  set('lang', s.languages?.join(',')); set('minp', s.min_price); set('maxp', s.max_price)
  set('rating', s.min_rating); set('reviews', s.min_reviews); set('ptype', s.patient_type)
  set('wc', s.wheelchair); set('park', s.parking); set('metro', s.near_metro)
  set('card', s.card); set('cash', s.cash); set('inst', s.installments)
  set('gender', s.dentist_gender); set('exp', s.min_experience)
  set('lat', s.lat); set('lng', s.lng); set('km', s.max_km); set('sort', s.sort)
  return sp
}

/** Number of "More filters" currently active (for the badge). */
export function advancedCount(s: SearchState): number {
  return [s.open_weekends, s.emergency, s.patient_type, s.dentist_gender, s.min_experience, s.min_reviews,
    s.wheelchair, s.parking, s.near_metro, s.card, s.cash, s.installments, s.max_km, s.min_price].filter(Boolean).length
}
