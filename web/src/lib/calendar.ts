const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export interface CalEvent { title: string; start: string; end: string; location?: string; details?: string }

export const googleCalendarUrl = (e: CalEvent) =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${stamp(e.start)}/${stamp(e.end)}` +
  `&details=${encodeURIComponent(e.details ?? '')}&location=${encodeURIComponent(e.location ?? '')}`

export function downloadIcs(e: CalEvent) {
  const esc = (s: string) => s.replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SmileBook//KA', 'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@smilebook`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`, e.location ? `LOCATION:${esc(e.location)}` : '', e.details ? `DESCRIPTION:${esc(e.details)}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:სტომატოლოგთან ვიზიტი', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'smilebook-appointment.ics'; a.click()
  URL.revokeObjectURL(url)
}

export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
