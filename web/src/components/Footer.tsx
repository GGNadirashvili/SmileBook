import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="mt-16 bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm text-brand-200">
            იპოვეთ სანდო სტომატოლოგი საქართველოში, ნახეთ თავისუფალი დრო და დაჯავშნეთ ონლაინ — სატელეფონო ზარის გარეშე.
          </p>
        </div>
        <div className="text-sm">
          <h4 className="mb-3 font-bold text-white">პაციენტებისთვის</h4>
          <ul className="space-y-2">
            <li><Link to="/search" className="hover:text-white">კლინიკების ძებნა</Link></li>
            <li><Link to="/search?emergency=1&sort=earliest" className="hover:text-white">გადაუდებელი დახმარება</Link></li>
            <li><Link to="/account" className="hover:text-white">ჩემი ვიზიტები</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h4 className="mb-3 font-bold text-white">კლინიკებისთვის</h4>
          <ul className="space-y-2">
            <li><Link to="/register" className="hover:text-white">კლინიკის დამატება</Link></li>
            <li><Link to="/login" className="hover:text-white">კლინიკის პანელი</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} SmileBook · სატესტო ვერსია — კლინიკები და მონაცემები გამოგონილია
      </div>
    </footer>
  )
}
