import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-64 w-full rounded-2xl">
      <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <Marker position={[lat, lng]} icon={L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="price-pin active">📍 ${label}</div>` })} />
    </MapContainer>
  )
}
