import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useState } from 'react'
import type { City, ClinicHit } from '../lib/types'
import { price, time } from '../lib/format'

interface Props {
  clinics: ClinicHit[]
  cities: City[]
  activeId: string | null
  onSelect: (id: string) => void
  selectedCity?: City
  onCity: (id: number) => void
  me?: { lat: number; lng: number }
}

const GEORGIA: [number, number] = [42.05, 43.6]

function Controller({ clinics, city, me }: { clinics: ClinicHit[]; city?: City; me?: { lat: number; lng: number } }) {
  const map = useMap()
  const key = clinics.map(c => c.id).join(',')
  useEffect(() => {
    const size = map.getSize()
    if (!size.x || !size.y) return   // hidden container (e.g. mobile list view): Leaflet cannot animate
    if (me && clinics.length) {
      const b = L.latLngBounds([[me.lat, me.lng], ...clinics.slice(0, 6).map(c => [c.lat, c.lng] as [number, number])])
      map.flyToBounds(b, { padding: [50, 50], maxZoom: 15, duration: 0.7 })
    } else if (city && clinics.length > 1) {
      map.flyToBounds(L.latLngBounds(clinics.map(c => [c.lat, c.lng] as [number, number])), { padding: [60, 60], maxZoom: 15, duration: 0.7 })
    } else if (city) {
      map.flyTo([city.lat, city.lng], city.zoom, { duration: 0.7 })
    } else {
      map.flyTo(GEORGIA, 7, { duration: 0.7 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id, key, me?.lat, me?.lng])
  return null
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  useEffect(() => onZoom(map.getZoom()), [map, onZoom])
  return null
}

export function MapView({ clinics, cities, activeId, onSelect, selectedCity, onCity, me }: Props) {
  const [zoom, setZoom] = useState(7)
  const showCities = !selectedCity && !me && zoom < 10

  const cityCounts = useMemo(() => {
    const m = new Map<number, number>()
    clinics.forEach(c => m.set(c.city_id, (m.get(c.city_id) ?? 0) + 1))
    return m
  }, [clinics])

  return (
    <MapContainer center={GEORGIA} zoom={7} minZoom={6} className="h-full w-full" zoomControl scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Controller clinics={clinics} city={selectedCity} me={me} />
      <ZoomWatcher onZoom={setZoom} />

      {showCities && cities.filter(c => cityCounts.has(c.id)).map(c => (
        <Marker key={c.id} position={[c.lat, c.lng]} eventHandlers={{ click: () => onCity(c.id) }}
          icon={L.divIcon({
            className: '', iconSize: [0, 0],
            html: `<div class="city-pin">${cityCounts.get(c.id)}</div><div class="city-label">${c.name}</div>`,
          })} />
      ))}

      {!showCities && clinics.map(c => (
        <Marker key={c.id} position={[c.lat, c.lng]} zIndexOffset={c.id === activeId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(c.id) }}
          icon={L.divIcon({
            className: '', iconSize: [0, 0],
            html: `<div class="price-pin ${c.id === activeId ? 'active' : ''}">${price(c.price_kind, c.price_gel, { short: true })}${c.next_slot ? ` <small>· ${time(c.next_slot)}</small>` : ''}</div>`,
          })} />
      ))}

      {me && <CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2a8fc4', fillOpacity: 1 }} />}
    </MapContainer>
  )
}
