import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewAction, PreviewRow } from '../types'

// ---------------------------------------------------------------------------
// Action pill
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<
  PreviewAction,
  { label: string; bg: string; text: string }
> = {
  new: { label: 'NEW', bg: 'bg-[rgba(15,61,62,0.1)]', text: 'text-[#0F3D3E]' },
  update: { label: 'UPDATE', bg: 'bg-[rgba(201,162,39,0.12)]', text: 'text-[#9A7A1E]' },
  cancel: { label: 'CANCEL', bg: 'bg-red-50', text: 'text-red-700' },
  skip: { label: 'SKIP', bg: 'bg-[rgba(26,26,26,0.06)]', text: 'text-[rgba(26,26,26,0.5)]' },
}

function ActionPill({ row }: { row: PreviewRow }) {
  const cfg = ACTION_CONFIG[row.action]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-widest',
        cfg.bg,
        cfg.text
      )}
      title={row.skipDetail ?? undefined}
    >
      {row.action === 'skip' && row.skipReason === 'unmapped_room_type' && (
        <AlertCircle className="h-3 w-3 flex-shrink-0" />
      )}
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortKey = 'action' | 'phobs_reservation_id' | 'channel' | 'check_in_date' | 'guest_name' | 'room_type_name' | 'adr_per_night'
type SortDir = 'asc' | 'desc'

const ACTION_ORDER: Record<PreviewAction, number> = { new: 0, update: 1, cancel: 2, skip: 3 }

function sortRows(rows: PreviewRow[], key: SortKey, dir: SortDir): PreviewRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0

    if (key === 'action') {
      cmp = ACTION_ORDER[a.action] - ACTION_ORDER[b.action]
      if (cmp === 0) cmp = a.check_in_date.localeCompare(b.check_in_date)
    } else if (key === 'adr_per_night') {
      cmp = (a.adr_per_night ?? -1) - (b.adr_per_night ?? -1)
    } else {
      const av = (a[key] ?? '') as string
      const bv = (b[key] ?? '') as string
      cmp = av.localeCompare(bv)
    }

    return dir === 'asc' ? cmp : -cmp
  })
}

function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function formatAdr(value: number | null): string {
  if (value === null) return '—'
  return `€ ${value.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: Array<{ value: PreviewAction | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'update', label: 'Updates' },
  { value: 'cancel', label: 'Cancellations' },
  { value: 'skip', label: 'Skipped' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  rows: PreviewRow[]
}

export function PreviewTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('action')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filter, setFilter] = useState<PreviewAction | 'all'>('all')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.action === filter)),
    [rows, filter]
  )

  const sorted = useMemo(
    () => sortRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  )

  return (
    <div className="overflow-hidden rounded-xl border border-[#D8DEDE] bg-white">
      {/* Filter bar */}
      <div className="flex items-center gap-1 border-b border-[#E8EEEE] px-4 py-2.5">
        {FILTER_OPTIONS.map((opt) => {
          const count =
            opt.value === 'all'
              ? rows.length
              : rows.filter((r) => r.action === opt.value).length
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded px-3 py-1 font-sans text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-[#0F3D3E] text-white'
                  : 'text-[rgba(26,26,26,0.55)] hover:bg-[#E8EEEE] hover:text-[#1A1A1A]'
              )}
            >
              {opt.label}{' '}
              <span
                className={cn(
                  'ml-0.5',
                  filter === opt.value ? 'text-[rgba(255,255,255,0.7)]' : ''
                )}
              >
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8EEEE]">
              {(
                [
                  { key: 'action', label: 'Action', w: 'w-24' },
                  { key: 'phobs_reservation_id', label: 'Code', w: 'w-32' },
                  { key: 'channel', label: 'Channel', w: 'w-28' },
                  { key: 'check_in_date', label: 'Check-in', w: 'w-24' },
                  { key: 'guest_name', label: 'Guest', w: '' },
                  { key: 'room_type_name', label: 'Room Type', w: 'w-32' },
                  { key: 'adr_per_night', label: 'ADR / night', w: 'w-28' },
                ] as Array<{ key: SortKey; label: string; w: string }>
              ).map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'cursor-pointer select-none whitespace-nowrap px-4 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)] transition-colors hover:text-[#1A1A1A]',
                    col.w
                  )}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4F4]">
            {sorted.map((row) => (
              <tr
                key={`${row.rowIndex}-${row.phobs_reservation_id}`}
                className={cn(
                  'transition-colors',
                  row.action === 'skip'
                    ? 'opacity-50 hover:opacity-70'
                    : 'hover:bg-[rgba(15,61,62,0.02)]'
                )}
              >
                <td className="px-4 py-2.5">
                  <ActionPill row={row} />
                </td>
                <td className="px-4 py-2.5 font-sans text-xs text-[rgba(26,26,26,0.6)] font-mono">
                  {row.phobs_reservation_id || '—'}
                </td>
                <td className="px-4 py-2.5 font-sans text-xs text-[#1A1A1A]">
                  {row.channel}
                </td>
                <td className="px-4 py-2.5 font-sans text-xs tabular-nums text-[#1A1A1A]">
                  {formatDate(row.check_in_date)}
                </td>
                <td className="px-4 py-2.5 font-sans text-xs text-[#1A1A1A]">
                  <span className="block truncate max-w-[200px]" title={row.guest_name}>
                    {row.guest_name || '—'}
                  </span>
                  {row.skipDetail && (
                    <span
                      className="block mt-0.5 text-[10px] text-red-500 truncate max-w-[200px]"
                      title={row.skipDetail}
                    >
                      {row.skipDetail}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-sans text-xs text-[#1A1A1A]">
                  {row.room_type_name ?? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {row.smjestaj_raw || '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-sans text-xs tabular-nums text-[#1A1A1A]">
                  {formatAdr(row.adr_per_night)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-10 text-center font-sans text-sm text-[rgba(26,26,26,0.4)]">
            No rows match the current filter.
          </div>
        )}
      </div>
    </div>
  )
}
