import { Stethoscope, Sparkles, Shield, Activity, Scissors, Brain, Cog, Crown, Gem, AlignJustify, Smile, Baby, Sun, ScanLine, type LucideIcon } from 'lucide-react'

const map: Record<string, LucideIcon> = {
  stethoscope: Stethoscope, sparkles: Sparkles, shield: Shield, activity: Activity, scissors: Scissors, brain: Brain,
  cog: Cog, crown: Crown, gem: Gem, 'align-justify': AlignJustify, smile: Smile, baby: Baby, sun: Sun, scan: ScanLine,
}
export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const I = map[name] ?? Sparkles
  return <I size={size} />
}
