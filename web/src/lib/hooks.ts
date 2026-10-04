import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { addFavorite, getCategories, getCities, getDistricts, getFavorites, getIntents, removeFavorite } from './api'

const forever = { staleTime: Infinity, gcTime: Infinity }
export const useCities = () => useQuery({ queryKey: ['cities'], queryFn: getCities, ...forever })
export const useDistricts = () => useQuery({ queryKey: ['districts'], queryFn: getDistricts, ...forever })
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: getCategories, ...forever })
export const useIntents = () => useQuery({ queryKey: ['intents'], queryFn: getIntents, ...forever })

export function useFavorites() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const nav = useNavigate()
  const loc = useLocation()
  const q = useQuery({ queryKey: ['favorites', user?.id], queryFn: getFavorites, enabled: !!user })
  const list = q.data ?? []

  async function toggle(target: { clinic_id?: string; dentist_id?: string }) {
    if (!user) { nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`); return }
    const existing = list.find(f => (target.clinic_id && f.clinic_id === target.clinic_id) || (target.dentist_id && f.dentist_id === target.dentist_id))
    if (existing) await removeFavorite(existing.id)
    else await addFavorite(user.id, target)
    await qc.invalidateQueries({ queryKey: ['favorites'] })
  }
  const isFav = (target: { clinic_id?: string; dentist_id?: string }) =>
    list.some(f => (target.clinic_id && f.clinic_id === target.clinic_id) || (target.dentist_id && f.dentist_id === target.dentist_id))
  return { list, toggle, isFav }
}

export function useGeolocate() {
  return (cb: (lat: number, lng: number) => void, onError?: () => void) => {
    if (!navigator.geolocation) { onError?.(); return }
    navigator.geolocation.getCurrentPosition(
      p => cb(p.coords.latitude, p.coords.longitude),
      () => onError?.(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    )
  }
}
