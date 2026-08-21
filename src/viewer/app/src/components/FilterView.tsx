import React from 'react'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { AppliedFilterType, PayFilterType, VerdictFilterType } from '../App'

interface FilterViewProps {
  keywordFilter: string
  setKeywordFilter: (value: string) => void
  appliedFilter: AppliedFilterType
  setAppliedFilter: (value: AppliedFilterType) => void
  verdictFilter: VerdictFilterType
  setVerdictFilter: (value: VerdictFilterType) => void
  payFilter: PayFilterType
  setPayFilter: (value: PayFilterType) => void
  uniqueKeywords: string[]
  countryFilter: string
  setCountryFilter: (value: string) => void
  uniqueCountries: string[]
  onReset: () => void
}

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

/** Mutually exclusive states read faster as buttons than as a select. */
function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segment">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`segment-item ${value === option.value ? 'segment-item-active' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export const FilterView: React.FC<FilterViewProps> = ({
  keywordFilter,
  setKeywordFilter,
  appliedFilter,
  setAppliedFilter,
  verdictFilter,
  setVerdictFilter,
  payFilter,
  setPayFilter,
  uniqueKeywords,
  countryFilter,
  setCountryFilter,
  uniqueCountries,
  onReset,
}) => {
  // Summarised as removable pills so an active filter is never invisible.
  const active: Array<{ label: string; clear: () => void }> = []
  if (keywordFilter) active.push({ label: keywordFilter, clear: () => setKeywordFilter('') })
  if (countryFilter) active.push({ label: countryFilter, clear: () => setCountryFilter('') })
  if (verdictFilter !== 'all') {
    const labels: Record<VerdictFilterType, string> = {
      all: '',
      yes: 'Interested',
      maybe: 'Maybe',
      no: 'Not interested',
      unrated: 'Not rated',
    }
    active.push({ label: labels[verdictFilter], clear: () => setVerdictFilter('all') })
  }
  if (appliedFilter !== 'all') {
    active.push({
      label: appliedFilter === 'applied' ? 'Applied' : 'Not applied',
      clear: () => setAppliedFilter('all'),
    })
  }
  if (payFilter !== 'all') {
    active.push({ label: 'Pay quoted', clear: () => setPayFilter('all') })
  }

  return (
    <div className="border-b border-line bg-surface/60 px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal size={15} className="text-faint" />
          Filters
        </div>
        {active.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium
                       text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <RotateCcw size={13} />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="keyword-filter" className="field-label">
            Search keyword
          </label>
          <select
            id="keyword-filter"
            value={keywordFilter}
            onChange={e => setKeywordFilter(e.target.value)}
            className="field"
          >
            <option value="">All keywords</option>
            {uniqueKeywords.map(kw => (
              <option key={kw} value={kw}>
                {kw}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="country-filter" className="field-label">
            Market
          </label>
          <select
            id="country-filter"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="field"
          >
            <option value="">All markets</option>
            {/* A selected market whose last post was deleted has no option left
                to render, which would blank the select while still filtering
                everything out - keep it listed instead. */}
            {countryFilter && !uniqueCountries.includes(countryFilter) && (
              <option value={countryFilter}>{countryFilter} (no posts)</option>
            )}
            {uniqueCountries.map(country => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="field-label">Verdict</span>
          <Segmented
            value={verdictFilter}
            onChange={setVerdictFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unrated', label: 'New' },
              { value: 'yes', label: 'Ok' },
              { value: 'maybe', label: 'Maybe' },
              { value: 'no', label: 'No' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="field-label">Applied</span>
            <Segmented
              value={appliedFilter}
              onChange={setAppliedFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'applied', label: 'Yes' },
                { value: 'not-applied', label: 'No' },
              ]}
            />
          </div>
          <div>
            <span className="field-label">Pay</span>
            <Segmented
              value={payFilter}
              onChange={setPayFilter}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'with-pay', label: 'Quoted' },
              ]}
            />
          </div>
        </div>
      </div>

      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {active.map(({ label, clear }) => (
            <button
              key={label}
              type="button"
              onClick={clear}
              className="chip bg-brand-soft text-brand transition-opacity hover:opacity-75"
              title="Remove filter"
            >
              <span className="max-w-[16rem] truncate">{label}</span>
              <X size={12} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
