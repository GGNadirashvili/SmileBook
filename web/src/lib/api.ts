import { supabase } from './supabase'
import type {
  Appointment, Category, City, Clinic, ClinicHit, ClinicHour, Dentist, District, FamilyMember,
  Intent, Profile, Review, SearchFilters, Service, Slot,
} from './types'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ───────── catalogue ─────────
export const getCities = async () => check(await supabase.from('cities').select('*').order('sort')) as City[]
export const getDistricts = async () => check(await supabase.from('districts').select('*').order('name')) as District[]
export const getCategories = async () => check(await supabase.from('service_categories').select('*').order('sort')) as Category[]
export const getIntents = async () => check(await supabase.from('search_intents').select('*')) as Intent[]

// ───────── search ─────────
export async function searchClinics(filters: SearchFilters): Promise<ClinicHit[]> {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== false))
  return check(await supabase.rpc('search_clinics', { p: clean })) as ClinicHit[]
}

// ───────── clinic / dentist ─────────
export async function getClinic(slug: string): Promise<Clinic | null> {
  const res = await supabase.from('clinics').select('*, cities(name), districts(name)').eq('slug', slug).maybeSingle()
  return check(res) as Clinic | null
}

export const getClinicServices = async (clinicId: string) =>
  check(await supabase.from('clinic_services').select('*').eq('clinic_id', clinicId).eq('active', true).order('category_id')) as Service[]

export interface DentistWithStats extends Dentist {
  rating: number | null; review_count: number; service_ids: string[]
}

export async function getClinicDentists(clinicId: string): Promise<DentistWithStats[]> {
  const dentists = check(await supabase.from('dentists').select('*').eq('clinic_id', clinicId).eq('active', true).order('full_name')) as Dentist[]
  if (!dentists.length) return []
  const ids = dentists.map(d => d.id)
  const [stats, links] = await Promise.all([
    supabase.from('dentist_stats').select('*').in('dentist_id', ids),
    supabase.from('dentist_services').select('dentist_id, service_id').in('dentist_id', ids),
  ])
  const st = new Map((check(stats) as { dentist_id: string; rating: number; review_count: number }[]).map(s => [s.dentist_id, s]))
  const ln = check(links) as { dentist_id: string; service_id: string }[]
  return dentists.map(d => ({
    ...d,
    rating: st.get(d.id)?.rating ?? null,
    review_count: st.get(d.id)?.review_count ?? 0,
    service_ids: ln.filter(l => l.dentist_id === d.id).map(l => l.service_id),
  }))
}

export async function getDentist(id: string) {
  const res = await supabase.from('dentists').select('*, clinics(id, slug, name, address, verified, cities(name))').eq('id', id).maybeSingle()
  return check(res) as (Dentist & { clinics: { id: string; slug: string; name: string; address: string; verified: boolean; cities: { name: string } } }) | null
}

export const getClinicHours = async (clinicId: string) =>
  check(await supabase.from('clinic_hours').select('weekday, open_time, close_time').eq('clinic_id', clinicId).order('weekday')) as ClinicHour[]

export async function getClinicStats(clinicId: string) {
  const res = await supabase.from('clinic_stats').select('*').eq('clinic_id', clinicId).maybeSingle()
  return check(res) as { rating: number; review_count: number } | null
}

export async function getReviews(opts: { clinicId?: string; dentistId?: string }) {
  let q = supabase.from('reviews').select('id, author_name, overall, staff, cleanliness, waiting, body, clinic_reply, created_at, dentist_id')
    .eq('status', 'published').order('created_at', { ascending: false }).limit(30)
  if (opts.clinicId) q = q.eq('clinic_id', opts.clinicId)
  if (opts.dentistId) q = q.eq('dentist_id', opts.dentistId)
  return check(await q) as Review[]
}

export async function getDentistServices(dentistId: string) {
  const res = await supabase.from('dentist_services').select('clinic_services(*)').eq('dentist_id', dentistId)
  return (check(res) as unknown as { clinic_services: Service }[]).map(r => r.clinic_services).filter(Boolean)
}

// ───────── availability + booking ─────────
export async function getSlots(serviceId: string, from: string, days = 14, dentistId?: string | null): Promise<Slot[]> {
  return check(await supabase.rpc('available_slots_range', {
    p_service_id: serviceId, p_from: from, p_days: days, p_dentist_id: dentistId ?? null,
  })) as Slot[]
}

export async function bookAppointment(args: { serviceId: string; startsAt: string; dentistId?: string | null; familyMemberId?: string | null; notes?: string }) {
  return check(await supabase.rpc('book_appointment', {
    p_service_id: args.serviceId, p_starts_at: args.startsAt, p_dentist_id: args.dentistId ?? null,
    p_family_member_id: args.familyMemberId ?? null, p_notes: args.notes ?? null,
  })) as string
}

export async function cancelAppointment(id: string) {
  check(await supabase.rpc('cancel_appointment', { p_id: id }))
}

export async function rescheduleAppointment(id: string, newStart: string) {
  return check(await supabase.rpc('reschedule_appointment', { p_id: id, p_new_start: newStart })) as string
}

export async function myAppointments(): Promise<Appointment[]> {
  const res = await supabase.from('appointments')
    .select('*, clinics(name, slug, address, lat, lng, phone, free_cancel_hours), dentists(full_name), clinic_services(name)')
    .order('starts_at', { ascending: false })
  return check(res) as Appointment[]
}

export async function getAppointment(id: string) {
  const res = await supabase.from('appointments')
    .select('*, clinics(name, slug, address, lat, lng, phone, free_cancel_hours), dentists(full_name), clinic_services(name)')
    .eq('id', id).maybeSingle()
  return check(res) as Appointment | null
}

// ───────── patient extras ─────────
export const getFamily = async () => check(await supabase.from('family_members').select('*').order('created_at')) as FamilyMember[]
export async function addFamily(m: { full_name: string; relation: string; owner_id: string }) {
  check(await supabase.from('family_members').insert(m))
}
export async function removeFamily(id: string) { check(await supabase.from('family_members').delete().eq('id', id)) }

export async function getFavorites() {
  return check(await supabase.from('favorites').select('id, clinic_id, dentist_id')) as { id: string; clinic_id: string | null; dentist_id: string | null }[]
}
export async function addFavorite(userId: string, target: { clinic_id?: string; dentist_id?: string }) {
  check(await supabase.from('favorites').insert({ user_id: userId, ...target }))
}
export async function removeFavorite(id: string) { check(await supabase.from('favorites').delete().eq('id', id)) }

export async function joinWaitlist(w: { user_id: string; clinic_id: string; service_id: string; dentist_id?: string | null; date_from: string; date_to: string }) {
  check(await supabase.from('waitlist').insert(w))
}

export async function createReview(r: { appointmentId: string; overall: number; staff?: number; cleanliness?: number; waiting?: number; body?: string }) {
  return check(await supabase.rpc('create_review', {
    p_appointment_id: r.appointmentId, p_overall: r.overall, p_staff: r.staff ?? null,
    p_cleanliness: r.cleanliness ?? null, p_waiting: r.waiting ?? null, p_body: r.body ?? null,
  })) as string
}

export async function getProfile(id: string) {
  const res = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  return check(res) as Profile | null
}
export async function updateProfile(id: string, patch: Partial<Pick<Profile, 'full_name' | 'phone'>>) {
  check(await supabase.from('profiles').update(patch).eq('id', id))
}

/** Map raw Postgres error codes from our RPCs to Georgian messages. */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('slot_unavailable')) return 'სამწუხაროდ, ეს დრო უკვე დაკავდა. აირჩიეთ სხვა დრო.'
  if (m.includes('late_cancellation')) return 'უფასო გაუქმების ვადა გავიდა. გთხოვთ, დაუკავშირდეთ კლინიკას.'
  if (m.includes('not_authenticated')) return 'გთხოვთ, შედით ანგარიშში.'
  if (m.includes('visit_not_completed')) return 'შეფასება შესაძლებელია მხოლოდ დასრულებული ვიზიტის შემდეგ.'
  if (m.includes('duplicate key')) return 'ეს ჩანაწერი უკვე არსებობს.'
  return 'რაღაც არ მოხდა ისე, როგორც უნდა. სცადეთ თავიდან.'
}

export async function getClinicsByIds(ids: string[]) {
  if (!ids.length) return []
  const res = await supabase.from('clinics').select('id, slug, name, address, verified, cities(name)').in('id', ids)
  return check(res) as unknown as { id: string; slug: string; name: string; address: string; verified: boolean; cities: { name: string } }[]
}
export async function getDentistsByIds(ids: string[]) {
  if (!ids.length) return []
  const res = await supabase.from('dentists').select('id, full_name, specialty, clinics(name, slug)').in('id', ids)
  return check(res) as unknown as { id: string; full_name: string; specialty: string | null; clinics: { name: string; slug: string } }[]
}
export async function reviewedAppointmentIds() {
  const res = await supabase.from('reviews').select('appointment_id')
  return (check(res) as { appointment_id: string }[]).map(r => r.appointment_id)
}
