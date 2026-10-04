import { Link } from 'react-router-dom'
import { Empty } from '../components/ui'

export function ComingSoon({ title }: { title: string }) {
  return <div className="mx-auto max-w-2xl px-4 py-16"><Empty title={title} hint="ეს განყოფილება მალე დაემატება." action={<Link className="font-semibold text-brand-700" to="/">მთავარზე დაბრუნება</Link>} /></div>
}
