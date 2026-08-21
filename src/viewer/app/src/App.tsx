import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  AlertCircle,
  Database,
  LayoutGrid,
  Moon,
  SearchX,
  Sun,
  X,
} from 'lucide-react'
import { Post, PostVerdict } from './types'
import { TableView } from './components/TableView'
import { FilterView } from './components/FilterView'
import { LinkedInPostCard } from './components/LinkedInPostCard'
import { StatsBar } from './components/StatsBar'
import { PostSkeleton } from './components/PostSkeleton'

type TabType = 'posts' | 'db'
export type AppliedFilterType = 'all' | 'applied' | 'not-applied'
export type VerdictFilterType = 'all' | 'yes' | 'maybe' | 'no' | 'unrated'
export type PayFilterType = 'all' | 'with-pay'

interface FilterState {
  keywordFilter: string
  appliedFilter: AppliedFilterType
  verdictFilter: VerdictFilterType
  countryFilter: string
  payFilter: PayFilterType
}

type ThemeName = 'light' | 'dark'

/** Remembered per browser; falls back to the OS preference on first visit. */
function initialTheme(): ThemeName {
  try {
    const stored = localStorage.getItem('viewer-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private windows and blocked site data throw on access - ignore.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<ThemeName>(initialTheme)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('posts')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [appliedFilter, setAppliedFilter] =
    useState<AppliedFilterType>('all')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilterType>('all')
  const [payFilter, setPayFilter] = useState<PayFilterType>('all')
  const [countryFilter, setCountryFilter] = useState('')
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({})
  const [cardErrorMessage, setCardErrorMessage] = useState<string | null>(null)
  
  // Track if we're currently syncing to avoid infinite loops
  const isSyncingRef = useRef(false)
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('viewer-theme', theme)
    } catch {
      // Persisting the choice is a convenience, not a requirement.
    }
  }, [theme])

  const setLoadingPost = (postId: number, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [postId]: loading }))
  }

  const handleToggleApplied = async (post: Post) => {
    setLoadingPost(post.id, true)
    setCardErrorMessage(null)

    try {
      const newAppliedStatus = !post.applied
      const response = await fetch(`/api/posts/${post.id}/applied`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied: newAppliedStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update applied status')
      }

      // Update local state instead of full refresh
      onPostUpdate({ id: post.id, applied: newAppliedStatus ? 1 : 0 })
    } catch (error) {
      setCardErrorMessage(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    } finally {
      setLoadingPost(post.id, false)
    }
  }

  const handleSetVerdict = async (post: Post, verdict: PostVerdict) => {
    setLoadingPost(post.id, true)
    setCardErrorMessage(null)

    try {
      const response = await fetch(`/api/posts/${post.id}/verdict`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set verdict')
      }

      // Update local state instead of full refresh
      onPostUpdate({ id: post.id, verdict })
    } catch (error) {
      setCardErrorMessage(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    } finally {
      setLoadingPost(post.id, false)
    }
  }

  const handleDelete = async (post: Post) => {
    if (
      !confirm(
        `Are you sure you want to delete this post?\n\nKeywords: ${post.search_keywords}`
      )
    ) {
      return
    }

    setLoadingPost(post.id, true)
    setCardErrorMessage(null)

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete post')
      }

      // Update local state instead of full refresh
      onPostDelete(post.id)
    } catch (error) {
      setCardErrorMessage(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    } finally {
      setLoadingPost(post.id, false)
    }
  }

  const onPostUpdate = (updatedPost: Partial<Post>) => {
    setPosts(prevPosts =>
      prevPosts.map(p => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p))
    )
  }

  const onPostDelete = (postId: number) => {
    setPosts(prevPosts => prevPosts.filter(p => p.id !== postId))
  }

  // Memoize unique keywords
  const uniqueKeywords = useMemo(() => {
    const keywords = new Set<string>()
    posts.forEach(post => {
      // search_keywords may be a comma-separated string
      post.search_keywords.split(',').forEach(kw => {
        const trimmedKw = kw.trim()
        if (trimmedKw) {
          keywords.add(trimmedKw)
        }
      })
    })
    return Array.from(keywords).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    )
  }, [posts])

  // Memoize unique countries - country holds a comma-separated list per post
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>()
    posts.forEach(post => {
      ;(post.country || '').split(',').forEach(c => {
        const trimmed = c.trim()
        if (trimmed) {
          countries.add(trimmed)
        }
      })
    })
    return Array.from(countries).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    )
  }, [posts])

  // Fetch posts from API
  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts')
      if (!response.ok) {
        throw new Error(`Failed to load posts: ${response.statusText}`)
      }
      const data = await response.json()
      setPosts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Initial load + polling every 3 seconds
  useEffect(() => {
    fetchPosts()
    const interval = setInterval(fetchPosts, 3000)
    return () => clearInterval(interval)
  }, [])

  // Fetch filter state from API
  const fetchFilterState = async () => {
    try {
      const response = await fetch('/api/filter-state')
      if (!response.ok) {
        return // Silently fail - filter state is optional
      }
      const state: FilterState = await response.json()
      
      // Only update if not currently syncing (avoid loops)
      if (!isSyncingRef.current) {
        isSyncingRef.current = true
        
        // Update React state with fetched values
        setKeywordFilter(state.keywordFilter)
        setAppliedFilter(state.appliedFilter)
        setVerdictFilter(state.verdictFilter ?? 'all')
        setPayFilter(state.payFilter ?? 'all')
        setCountryFilter(state.countryFilter ?? '')
        
        // Reset sync flag after a short delay
        setTimeout(() => {
          isSyncingRef.current = false
        }, 100)
      }
    } catch (err) {
      // Silently fail - filter state is optional
    }
  }

  // Poll filter state every 1.5 seconds
  useEffect(() => {
    fetchFilterState()
    const interval = setInterval(fetchFilterState, 1500)
    return () => clearInterval(interval)
  }, [])

  // Debounced function to sync filter state to API
  const syncFilterStateToAPI = useCallback((updates: Partial<FilterState>) => {
    // Clear any pending update
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current)
    }
    
    // Schedule new update after 500ms
    pendingUpdateRef.current = setTimeout(async () => {
      try {
        isSyncingRef.current = true
        await fetch('/api/filter-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        
        // Reset sync flag after a delay
        setTimeout(() => {
          isSyncingRef.current = false
        }, 100)
      } catch (error) {
        // Silently fail
        isSyncingRef.current = false
      }
    }, 500)
  }, [])

  // Wrapped setters that sync to API
  const setKeywordFilterAndSync = useCallback((value: string) => {
    setKeywordFilter(value)
    syncFilterStateToAPI({ keywordFilter: value })
  }, [syncFilterStateToAPI])

  const setAppliedFilterAndSync = useCallback((value: AppliedFilterType) => {
    setAppliedFilter(value)
    syncFilterStateToAPI({ appliedFilter: value })
  }, [syncFilterStateToAPI])

  const setVerdictFilterAndSync = useCallback((value: VerdictFilterType) => {
    setVerdictFilter(value)
    syncFilterStateToAPI({ verdictFilter: value })
  }, [syncFilterStateToAPI])

  const setPayFilterAndSync = useCallback((value: PayFilterType) => {
    setPayFilter(value)
    syncFilterStateToAPI({ payFilter: value })
  }, [syncFilterStateToAPI])

  const setCountryFilterAndSync = useCallback((value: string) => {
    setCountryFilter(value)
    syncFilterStateToAPI({ countryFilter: value })
  }, [syncFilterStateToAPI])

  // Apply filters
  const filteredPosts = posts.filter(post => {
    // Keyword filter
    const keywordMatch =
      keywordFilter.trim() === '' ||
      post.search_keywords
        .split(',')
        .map(kw => kw.trim())
        .includes(keywordFilter)

    // Country filter - post.country is a comma-separated list
    const countryMatch =
      countryFilter.trim() === '' ||
      (post.country || '')
        .split(',')
        .map(c => c.trim())
        .includes(countryFilter)

    // Applied status filter
    const appliedMatch =
      appliedFilter === 'all' ||
      (appliedFilter === 'applied' && post.applied === 1) ||
      (appliedFilter === 'not-applied' && post.applied === 0)

    // Triage verdict filter
    const verdictMatch =
      verdictFilter === 'all' ||
      (verdictFilter === 'unrated' && !post.verdict) ||
      post.verdict === verdictFilter

    // Pay filter
    const payMatch = payFilter === 'all' || Boolean(post.salary)

    return keywordMatch && countryMatch && appliedMatch && verdictMatch && payMatch
  })

  const resetFilters = useCallback(() => {
    setKeywordFilterAndSync('')
    setCountryFilterAndSync('')
    setAppliedFilterAndSync('all')
    setVerdictFilterAndSync('all')
    setPayFilterAndSync('all')
  }, [
    setKeywordFilterAndSync,
    setCountryFilterAndSync,
    setAppliedFilterAndSync,
    setVerdictFilterAndSync,
    setPayFilterAndSync,
  ])

  const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
    { id: 'posts', label: 'Cards', icon: LayoutGrid },
    { id: 'db', label: 'Table', icon: Database },
  ]

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header so the theme toggle and identity stay reachable while scrolling. */}
      <header className="sticky top-0 z-30 border-b border-line glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/saitama-job-hunting.png"
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-contain"
            />
            <div className="min-w-0">
              <h1 className="truncate text-[0.95rem] font-semibold leading-tight text-ink">
                Vacancy Radar
              </h1>
              <p className="truncate text-xs text-faint">
                Triage the vacancies your searches brought in
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="segment">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`segment-item flex items-center justify-center gap-1.5 px-3
                              ${activeTab === id ? 'segment-item-active' : ''}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="icon-button border border-line"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <StatsBar posts={posts} visible={filteredPosts.length} />

        {(error || cardErrorMessage) && (
          <div
            className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10
                       px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <p className="flex-1">{error || cardErrorMessage}</p>
            <button
              onClick={() => {
                setError(null)
                setCardErrorMessage(null)
              }}
              className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <FilterView
            keywordFilter={keywordFilter}
            setKeywordFilter={setKeywordFilterAndSync}
            appliedFilter={appliedFilter}
            setAppliedFilter={setAppliedFilterAndSync}
            verdictFilter={verdictFilter}
            setVerdictFilter={setVerdictFilterAndSync}
            payFilter={payFilter}
            setPayFilter={setPayFilterAndSync}
            uniqueKeywords={uniqueKeywords}
            countryFilter={countryFilter}
            setCountryFilter={setCountryFilterAndSync}
            uniqueCountries={uniqueCountries}
            onReset={resetFilters}
          />

          {loading && posts.length === 0 ? (
            <div className="grid items-start gap-4 p-4 sm:p-6 xl:grid-cols-2">
              {[0, 1, 2].map(i => (
                <PostSkeleton key={i} />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-raised text-faint">
                <SearchX size={22} />
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {posts.length === 0 ? 'No posts captured yet' : 'No posts match these filters'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {posts.length === 0
                    ? 'Run a search from your assistant to populate the database.'
                    : `${posts.length} post${posts.length === 1 ? '' : 's'} are hidden by the current filters.`}
                </p>
              </div>
              {posts.length > 0 && (
                <button
                  onClick={resetFilters}
                  className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white
                             transition-opacity hover:opacity-90"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : activeTab === 'posts' ? (
            <div className="grid items-start gap-4 p-4 sm:p-6 xl:grid-cols-2">
              {filteredPosts.map(post => (
                <LinkedInPostCard
                  key={post.id}
                  post={post}
                  onToggleApplied={handleToggleApplied}
                  onSetVerdict={handleSetVerdict}
                  onDelete={handleDelete}
                  onGoToPost={p =>
                    window.open(p.post_link, '_blank', 'noopener,noreferrer')
                  }
                  isLoading={loadingStates[post.id]}
                />
              ))}
            </div>
          ) : (
            <TableView
              posts={filteredPosts}
              onPostUpdate={onPostUpdate}
              onPostDelete={onPostDelete}
            />
          )}
        </section>
      </main>
    </div>
  )
}

export default App
