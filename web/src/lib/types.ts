export type PriceKind = 'fixed' | 'from' | 'on_consultation'
export type ApptStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show'
export type UserRole = 'patient' | 'clinic_staff' | 'admin'

export interface City { id: number; slug: string; name: string; lat: number; lng: number; zoom: number }
export interface District { id: number; city_id: number; name: string }
export interface Category { id: number; slug: string; name: string; icon: string }
export interface Intent { id: number; phrase: string; category_slugs: string[]; emergency: boolean }

export interface ClinicHit {
  id: string; slug: string; name: string; address: string
  city_id: number; city_name: string; district_name: string | null
  lat: number; lng: number
  verified: boolean; sponsored: boolean; emergency: boolean
  cover_url: string | null
  rating: number | null; review_count: number; open_now: boolean
  service_id: string | null; service_name: string | null
  price_kind: PriceKind | null; price_gel: number | null
  next_slot: string | null; next_dentist_id: string | null; next_dentist_name: string | null
  distance_km: number | null
}

export interface Clinic {
  id: string; slug: string; name: string; description: string | null
  city_id: number; district_id: number | null; address: string
  lat: number; lng: number; phone: string | null; email: string | null; cover_url: string | null
  verified: boolean; sponsored: boolean; emergency: boolean; open_weekends: boolean
  wheelchair: boolean; parking: boolean; near_metro: boolean
  accepts_card: boolean; accepts_cash: boolean; installments: boolean
  languages: string[]; booking_mode: 'instant' | 'approval'
  min_notice_hours: number; max_future_days: number; free_cancel_hours: number
  cities: { name: string } | null; districts: { name: string } | null
}

export interface Dentist {
  id: string; clinic_id: string; full_name: string; gender: 'female' | 'male' | null
  specialty: string | null; bio: string | null; years_experience: number | null
  languages: string[]; photo_url: string | null; verified: boolean
}

export interface Service {
  id: string; clinic_id: string; category_id: number; name: string; description: string | null
  duration_min: number; price_kind: PriceKind; price_gel: number | null
  patient_type: 'all' | 'adult' | 'child'
}

export interface ClinicHour { weekday: number; open_time: string; close_time: string }

export interface Review {
  id: string; author_name: string; overall: number; staff: number | null
  cleanliness: number | null; waiting: number | null; body: string | null
  clinic_reply: string | null; created_at: string; dentist_id: string | null
}

export interface Slot { dentist_id: string; starts_at: string; ends_at: string }

export interface Appointment {
  id: string; clinic_id: string; dentist_id: string; service_id: string
  patient_name: string; patient_phone: string | null
  starts_at: string; ends_at: string; status: ApptStatus
  price_kind: PriceKind | null; price_gel: number | null; notes: string | null
  clinics?: { name: string; slug: string; address: string; lat: number; lng: number; phone: string | null; free_cancel_hours: number }
  dentists?: { full_name: string }
  clinic_services?: { name: string }
}

export interface FamilyMember { id: string; full_name: string; relation: string; birth_date: string | null }
export interface Profile { id: string; full_name: string | null; phone: string | null; role: UserRole }

export interface SearchFilters {
  city_id?: number; district_id?: number; category_id?: number; q?: string
  date?: string; part?: 'morning' | 'afternoon' | 'evening'; within_hours?: number
  open_now?: boolean; open_weekends?: boolean; emergency?: boolean
  languages?: string[]; min_price?: number; max_price?: number
  min_rating?: number; min_reviews?: number; patient_type?: 'adult' | 'child'
  wheelchair?: boolean; parking?: boolean; near_metro?: boolean
  card?: boolean; cash?: boolean; installments?: boolean
  dentist_gender?: 'female' | 'male'; min_experience?: number
  lat?: number; lng?: number; max_km?: number
  sort?: 'recommended' | 'earliest' | 'nearest' | 'rating' | 'reviews' | 'price_low' | 'price_high'
}
