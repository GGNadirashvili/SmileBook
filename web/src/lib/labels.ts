import type { ApptStatus } from './types'

export const statusLabel: Record<ApptStatus, string> = {
  pending: 'ელოდება დადასტურებას',
  confirmed: 'დადასტურებულია',
  arrived: 'მივიდა',
  completed: 'დასრულდა',
  cancelled: 'გაუქმებულია',
  no_show: 'არ გამოცხადდა',
}

export const statusStyle: Record<ApptStatus, string> = {
  pending: 'bg-sun-100 text-amber-800',
  confirmed: 'bg-brand-100 text-brand-800',
  arrived: 'bg-sky-100 text-sky-800',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
  no_show: 'bg-orange-100 text-orange-800',
}

export const languageLabel: Record<string, string> = { ka: 'ქართული', en: 'English', ru: 'Русский' }

export const sortLabel: Record<string, string> = {
  recommended: 'რეკომენდებული',
  earliest: 'უახლოესი დრო',
  nearest: 'უახლოესი მანძილით',
  rating: 'უმაღლესი რეიტინგი',
  reviews: 'ყველაზე მეტი შეფასება',
  price_low: 'ფასი: დაბლიდან მაღლისკენ',
  price_high: 'ფასი: მაღლიდან დაბლისკენ',
}

export const relationLabel: Record<string, string> = {
  child: 'შვილი', parent: 'მშობელი', partner: 'მეუღლე / პარტნიორი', other: 'სხვა',
}

export const weekdayName = ['', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა']

export const partLabel: Record<string, string> = { morning: 'დილა', afternoon: 'შუადღე', evening: 'საღამო' }

export const specialtyHint = 'სტომატოლოგი'
