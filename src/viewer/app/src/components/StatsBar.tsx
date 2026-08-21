import React from 'react'
import { Banknote, CheckCircle2, CircleSlash, Layers, Sparkles } from 'lucide-react'
import { Post } from '../types'

interface StatsBarProps {
  posts: Post[]
  visible: number
}

interface Stat {
  label: string
  value: string
  icon: React.ElementType
  tone: string
}

/**
 * Headline counts for the whole collection. Deliberately derived from every
 * post rather than the filtered view, so the numbers stay a stable reference
 * while filters change - the filtered count is shown separately.
 */
export const StatsBar: React.FC<StatsBarProps> = ({ posts, visible }) => {
  const rated = (value: string) => posts.filter(p => p.verdict === value).length

  const stats: Stat[] = [
    {
      label: 'Showing',
      value: visible === posts.length ? `${posts.length}` : `${visible} of ${posts.length}`,
      icon: Layers,
      tone: 'text-brand bg-brand-soft',
    },
    {
      label: 'To triage',
      value: `${posts.filter(p => !p.verdict).length}`,
      icon: Layers,
      tone: 'text-violet-600 bg-violet-500/10 dark:text-violet-400',
    },
    {
      label: 'Ok',
      value: `${rated('yes')}`,
      icon: Sparkles,
      tone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    },
    {
      label: 'Not interested',
      value: `${rated('no')}`,
      icon: CircleSlash,
      tone: 'text-rose-600 bg-rose-500/10 dark:text-rose-400',
    },
    {
      label: 'Applied',
      value: `${posts.filter(p => p.applied).length}`,
      icon: CheckCircle2,
      tone: 'text-brand bg-brand-soft',
    },
    {
      label: 'With pay',
      value: `${posts.filter(p => p.salary).length}`,
      icon: Banknote,
      tone: 'text-teal-600 bg-teal-500/10 dark:text-teal-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-card"
        >
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
            <Icon size={17} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold leading-tight text-ink">{value}</div>
            <div className="text-[0.7rem] font-medium uppercase tracking-wider text-faint">
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
