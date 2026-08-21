import React, { useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleSlash,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { Post, PostVerdict } from '../types'

interface LinkedInPostCardProps {
  post: Post
  onToggleApplied: (post: Post) => void
  onSetVerdict: (post: Post, verdict: PostVerdict) => void
  onDelete: (post: Post) => void
  onGoToPost: (post: Post) => void
  isLoading?: boolean
}

/**
 * Triage options. Clicking the rating a post already holds clears it, so a
 * mis-click is undone with a second click rather than needing a fourth button.
 */
const VERDICTS: Array<{
  value: Exclude<PostVerdict, ''>
  label: string
  icon: typeof Sparkles
  active: string
}> = [
  { value: 'yes', label: 'Ok', icon: Sparkles, active: 'bg-emerald-500 text-white' },
  { value: 'maybe', label: 'Maybe', icon: Circle, active: 'bg-amber-500 text-white' },
  { value: 'no', label: 'Not interested', icon: CircleSlash, active: 'bg-rose-500 text-white' },
]

/** Left accent rail per rating, so a scanned column shows its own triage state. */
const RAIL: Record<PostVerdict, string> = {
  '': '',
  yes: 'from-emerald-400 to-emerald-600',
  maybe: 'from-amber-400 to-amber-600',
  no: 'from-rose-400 to-rose-600',
}

/** Descriptions run long; collapse anything past this many characters. */
const COLLAPSE_THRESHOLD = 520

export function LinkedInPostCard({
  post,
  onToggleApplied,
  onSetVerdict,
  onDelete,
  onGoToPost,
  isLoading = false
}: LinkedInPostCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Get initials for fallback avatar
  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  /**
   * Parse LinkedIn relative time string (e.g., "1w", "2d", "3mo") to milliseconds
   */
  const parseLinkedInRelativeTime = (relativeTime: string): number | null => {
    if (!relativeTime || relativeTime.trim() === '') return null

    // Remove spaces and convert to lowercase
    const cleaned = relativeTime.trim().toLowerCase().replace(/\s+/g, '')

    // Match pattern: number followed by unit (m, h, d, w, mo, yr)
    const match = cleaned.match(/^(\d+)(m|h|d|w|mo|yr)$/)
    if (!match) return null

    const value = parseInt(match[1])
    const unit = match[2]

    const MS_PER_MINUTE = 60 * 1000
    const MS_PER_HOUR = 60 * MS_PER_MINUTE
    const MS_PER_DAY = 24 * MS_PER_HOUR
    const MS_PER_WEEK = 7 * MS_PER_DAY
    const MS_PER_MONTH = 30 * MS_PER_DAY // Approximate
    const MS_PER_YEAR = 365 * MS_PER_DAY // Approximate

    switch (unit) {
      case 'm': return value * MS_PER_MINUTE
      case 'h': return value * MS_PER_HOUR
      case 'd': return value * MS_PER_DAY
      case 'w': return value * MS_PER_WEEK
      case 'mo': return value * MS_PER_MONTH
      case 'yr': return value * MS_PER_YEAR
      default: return null
    }
  }

  /**
   * Calculate the actual post date from search_date and LinkedIn relative time
   */
  const calculateActualPostDate = (searchDate: string, linkedInRelativeTime: string): Date | null => {
    try {
      const searchDateTime = new Date(searchDate)
      if (isNaN(searchDateTime.getTime())) return null

      const relativeMs = parseLinkedInRelativeTime(linkedInRelativeTime)
      if (relativeMs === null) return null

      // Subtract the relative time from search date to get actual post date
      return new Date(searchDateTime.getTime() - relativeMs)
    } catch {
      return null
    }
  }

  /**
   * Format timestamp for display - handles both absolute timestamps and calculated dates
   */
  const formatTimestamp = (postDate: string, searchDate: string): string => {
    let actualPostDate: Date | null = null

    // Try to calculate actual post date from LinkedIn relative time
    actualPostDate = calculateActualPostDate(searchDate, postDate)

    // Fallback: try parsing postDate as absolute date
    if (!actualPostDate) {
      const parsedDate = new Date(postDate)
      if (!isNaN(parsedDate.getTime())) {
        actualPostDate = parsedDate
      }
    }

    // Final fallback: use search date
    if (!actualPostDate) {
      const parsedSearchDate = new Date(searchDate)
      if (!isNaN(parsedSearchDate.getTime())) {
        actualPostDate = parsedSearchDate
      } else {
        return 'Unknown time'
      }
    }

    // Calculate time difference from NOW
    const now = new Date()
    const diffMs = now.getTime() - actualPostDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    if (diffWeeks < 4) return `${diffWeeks}w`
    return actualPostDate.toLocaleDateString()
  }

  const formatNumber = (num: string | number) => {
    const numValue = typeof num === 'string' ? parseInt(num) || 0 : num
    if (numValue >= 1000) return `${(numValue / 1000).toFixed(1)}K`
    return numValue.toString()
  }

  /**
   * Interface furniture the scraper picks up from the LinkedIn feed markup.
   * Matched against individual bullet-separated fragments, since the feed emits
   * lines like "3 j \u2022 Modifi\u00e9 \u2022" that mix several of them.
   */
  const CHROME = [
    /^post du fil d[\u2019'`]actualit[eé]$/i,
    /^suivre\.*$/i,
    /^[\u2026.]*\s*plus$/i,
    /^afficher la traduction$/i,
    /^voir (?:l[\u2019'`]offre d[\u2019'`]emploi|le profil)$/i,
    /^acc[eé]der [àa] mon site web$/i,
    /^visit my website$/i,
    /^modifi[eé]$/i,
    /^promoted$/i,
    /^s[\u2019'`]inscrire$/i,
    /^\d+(er|e|nd|rd|th)?\s*(et\s*\+)?$/i,
    /^\d+\s*(min|h|j|d|w|sem|mo|mois|yr|an|ans)$/i,
    /^\d+$/,
    /^hashtag$/i,
  ]

  /** True when every bullet-separated fragment of the line is interface text. */
  const isChrome = (line: string) => {
    if (line === '') return false
    const fragments = line
      .split(/[\u2022•]/)
      .map(part => part.trim())
      .filter(Boolean)
    if (fragments.length === 0) return true
    return fragments.every(fragment => CHROME.some(pattern => pattern.test(fragment)))
  }

  const renderDescription = (text: string) => {
    if (!text) return null

    // The author's name and headline are already shown in the card header.
    const duplicated = new Set(
      [post.author_name, post.author_occupation]
        .filter(Boolean)
        .map(v => v.trim()),
    )

    const kept = text
      .split('\n')
      .filter(line => {
        const trimmed = line.trim()
        return !isChrome(trimmed) && !duplicated.has(trimmed)
      })

    // Removals leave runs of blank lines behind; keep at most one, and none at
    // either end, so a card never opens with empty space.
    const lines: string[] = []
    for (const line of kept) {
      const blank = line.trim() === ''
      if (blank && (lines.length === 0 || lines[lines.length - 1].trim() === '')) continue
      lines.push(line)
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

    const elements: React.ReactNode[] = []
    let currentHashtags: string[] = []

    const flushHashtags = (key: string | number) => {
      if (currentHashtags.length > 0) {
        elements.push(
          <div key={`hashtags-${key}`} className="flex flex-wrap gap-x-2 gap-y-1">
            {currentHashtags.map((tag, tagIndex) => (
              <span key={tagIndex} className="font-medium text-brand">
                {tag}
              </span>
            ))}
          </div>,
        )
        currentHashtags = []
      }
    }

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) {
        currentHashtags.push(trimmed)
      } else {
        flushHashtags(index)
        elements.push(
          <p key={`text-${index}`} className="whitespace-pre-wrap">
            {line}
          </p>,
        )
      }
    })

    flushHashtags('end')

    return elements
  }

  // Map database fields to display values
  const authorName = post.author_name || 'Unknown Author'
  const authorHeadline = post.author_occupation || 'LinkedIn User'
  const authorPhotoUrl = post.profile_image || undefined
  const likes = post.like_count ? parseInt(post.like_count) : undefined
  const comments = post.comment_count ? parseInt(post.comment_count) : undefined
  const isLong = (post.description || '').length > COLLAPSE_THRESHOLD

  return (
    <article
      className={`group relative animate-fade-up overflow-hidden rounded-2xl border bg-surface
                  shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift
                  ${post.verdict === 'yes' ? 'border-emerald-500/40' : ''}
                  ${post.verdict === 'maybe' ? 'border-amber-500/40' : ''}
                  ${post.verdict === 'no' ? 'border-line opacity-55 hover:opacity-100' : ''}
                  ${post.verdict === '' ? 'border-line' : ''}
                  ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
    >
      {/* Rated posts carry an accent rail rather than a heavy full border. */}
      {post.verdict !== '' && (
        <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${RAIL[post.verdict]}`} />
      )}

      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 gap-3">
          {authorPhotoUrl ? (
            <img
              src={authorPhotoUrl}
              alt={authorName}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-line"
            />
          ) : (
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br
                         from-brand to-violet-500 text-sm font-semibold text-white"
            >
              {getInitials(authorName)}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{authorName}</div>
            <div className="line-clamp-1 text-[0.8rem] text-muted">{authorHeadline}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-faint">
              <Clock size={11} />
              {formatTimestamp(post.post_date || post.search_date, post.search_date)}
              <span className="text-line">·</span>
              <span>#{post.id}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => onToggleApplied(post)}
            className={`icon-button ${post.applied ? 'text-brand hover:text-brand' : ''}`}
            disabled={isLoading}
            title={post.applied ? 'Mark as not applied' : 'Mark as applied'}
          >
            {post.applied ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
          <button
            onClick={() => onDelete(post)}
            className="icon-button hover:bg-red-500/10 hover:text-red-500"
            disabled={isLoading}
            title="Delete post"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      {/* Derived metadata first: pay and market are what the list is scanned for. */}
      {(post.salary || post.country || post.applied === 1) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {post.applied === 1 && (
            <span className="chip bg-brand-soft text-brand">
              <CheckCircle2 size={12} strokeWidth={2.4} />
              Applied
            </span>
          )}
          {post.salary && (
            <span className="chip bg-teal-500/12 text-teal-700 dark:text-teal-300">
              <Banknote size={12} strokeWidth={2.4} />
              {post.salary}
            </span>
          )}
          {post.country && (
            <span className="chip bg-raised text-muted">
              <MapPin size={12} strokeWidth={2.4} />
              {post.country}
            </span>
          )}
        </div>
      )}

      <div className="px-4 pb-3">
        <div
          className={`space-y-1.5 break-words text-[0.86rem] leading-relaxed text-ink/90
                      ${isLong && !expanded ? 'line-clamp-8' : ''}`}
        >
          {renderDescription(post.description)}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Triage row: the primary action on this screen, so it gets full width. */}
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2.5">
        {VERDICTS.map(({ value, label, icon: Icon, active }) => {
          const selected = post.verdict === value
          return (
            <button
              key={value}
              onClick={() => onSetVerdict(post, selected ? '' : value)}
              disabled={isLoading}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5
                          text-xs font-semibold transition-all disabled:opacity-40
                          ${selected ? active : 'bg-raised text-muted hover:text-ink'}`}
              title={selected ? `Clear "${label}"` : `Mark as ${label}`}
            >
              <Icon size={13} strokeWidth={2.4} />
              {label}
            </button>
          )
        })}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <button
          onClick={() => onGoToPost(post)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold
                     text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <ExternalLink size={14} />
          Open on LinkedIn
        </button>

        <div className="flex min-w-0 items-center gap-3 text-xs text-faint">
          {likes !== undefined && (
            <span className="flex items-center gap-1" title="Reactions at time of capture">
              <ThumbsUp size={12} />
              {formatNumber(likes)}
            </span>
          )}
          {comments !== undefined && (
            <span className="flex items-center gap-1" title="Comments at time of capture">
              <MessageCircle size={12} />
              {formatNumber(comments)}
            </span>
          )}
          <span className="max-w-[11rem] truncate" title={post.search_keywords}>
            {post.search_keywords}
          </span>
        </div>
      </footer>
    </article>
  )
}
