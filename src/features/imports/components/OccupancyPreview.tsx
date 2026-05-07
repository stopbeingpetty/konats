import { format, parseISO } from 'date-fns'
import type { OccupancyParsedRow, OccupancyValidationError, OccupancyComparisonRow } from '../types'
import { ROOM_CAPACITY } from '../lib/validateOccupancy'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd.MM.yyyy')
  } catch {
    return iso
  }
}

function pct(sold: number, cap: number): string {
  return cap > 0 ? `${Math.round((sold / cap) * 100)}%` : '—'
}

function delta(oldSold: number | null, newSold: number): React.ReactNode {
  if (oldSold === null) return <span className="text-[rgba(26,26,26,0.35)]">—</span>
  const diff = newSold - oldSold
  if (diff === 0) return <span className="text-[rgba(26,26,26,0.35)]">—</span>
  const cls = diff > 0 ? 'text-emerald-600' : 'text-red-600'
  return <span className={cls}>{diff > 0 ? `+${diff}` : diff} sold</span>
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FileSummary({
  fileName,
  fileSize,
  totalRows,
  validRows,
  errorCount,
  dateRange,
}: {
  fileName: string
  fileSize: number
  totalRows: number
  validRows: number
  errorCount: number
  dateRange: string
}) {
  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="rounded-xl border border-[#D8DEDE] bg-white">
      <div className="flex flex-wrap items-center gap-6 px-6 py-4">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.4)]">
            File
          </p>
          <p className="mt-0.5 font-sans text-sm font-medium text-[#1A1A1A]">{fileName}</p>
          <p className="font-sans text-xs text-[rgba(26,26,26,0.45)]">{formatBytes(fileSize)}</p>
        </div>

        <div className="h-10 w-px bg-[#E8EEEE]" />

        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.4)]">
            Date range
          </p>
          <p className="mt-0.5 font-sans text-sm font-medium text-[#1A1A1A]">{dateRange}</p>
        </div>

        <div className="h-10 w-px bg-[#E8EEEE]" />

        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.4)]">
            Rows
          </p>
          <p className="mt-0.5 font-sans text-sm font-medium text-[#1A1A1A]">
            <span className="text-[#0F3D3E]">{validRows} valid</span>
            {errorCount > 0 && (
              <span className="ml-2 text-red-600">{errorCount} skipped</span>
            )}
            <span className="ml-1 text-[rgba(26,26,26,0.35)]">/ {totalRows} total</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function ValidationErrors({ errors }: { errors: OccupancyValidationError[] }) {
  if (errors.length === 0) return null

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="font-sans text-sm font-semibold text-red-700">
        {errors.length} row{errors.length !== 1 ? 's' : ''} skipped due to validation errors
      </p>
      <ul className="mt-2 space-y-1 font-sans text-xs text-red-600">
        {errors.map((e) => (
          <li key={e.rowIndex}>
            Row {e.rowIndex} ({formatDate(e.date)}): {e.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ComparisonTable({ rows }: { rows: OccupancyComparisonRow[] }) {
  if (rows.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
        Comparison with current snapshot
      </h3>
      <div className="overflow-hidden rounded-xl border border-[#D8DEDE] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EEEE]">
              <th className="px-4 py-2.5 text-left font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
                Date
              </th>
              <th className="px-4 py-2.5 text-right font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
                Current (sold/cap)
              </th>
              <th className="px-4 py-2.5 text-right font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
                New (sold/cap)
              </th>
              <th className="px-4 py-2.5 text-right font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4F4]">
            {rows.map((row) => (
              <tr key={row.date}>
                <td className="px-4 py-2.5 font-sans text-sm text-[#1A1A1A]">
                  {formatDate(row.date)}
                </td>
                <td className="px-4 py-2.5 text-right font-sans text-sm text-[rgba(26,26,26,0.55)] tabular-nums">
                  {row.oldSold !== null && row.oldCap !== null
                    ? `${row.oldSold}/${row.oldCap} (${pct(row.oldSold, row.oldCap)})`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#1A1A1A]">
                  {row.newSold}/{row.newCap} ({pct(row.newSold, row.newCap)})
                </td>
                <td className="px-4 py-2.5 text-right font-sans text-sm font-medium tabular-nums">
                  {delta(row.oldSold, row.newSold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PreviewRows({ rows }: { rows: OccupancyParsedRow[] }) {
  // First 10 + last 5 (deduplicated if overlap)
  const totalCap = ROOM_CAPACITY.sup + ROOM_CAPACITY.exe + ROOM_CAPACITY.sui

  const head = rows.slice(0, 10)
  const tail = rows.slice(-5).filter((r) => !head.includes(r))
  const showEllipsis = head.length + tail.length < rows.length

  return (
    <div>
      <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
        Data preview
      </h3>
      <div className="overflow-x-auto rounded-xl border border-[#D8DEDE] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EEEE]">
              {['Date', 'Day', 'Occ Sup', 'Occ Exe', 'Occ Sui', 'Total', 'Occ %'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-right font-sans text-[10px] font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)] first:text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4F4]">
            {head.map((row) => (
              <PreviewRow key={row.rowIndex} row={row} totalCap={totalCap} />
            ))}
            {showEllipsis && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-2 text-center font-sans text-xs text-[rgba(26,26,26,0.35)]"
                >
                  … {rows.length - head.length - tail.length} more rows …
                </td>
              </tr>
            )}
            {tail.map((row) => (
              <PreviewRow key={row.rowIndex} row={row} totalCap={totalCap} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PreviewRow({ row, totalCap }: { row: OccupancyParsedRow; totalCap: number }) {
  const totalSold = row.occ_sup + row.occ_exe + row.occ_sui
  const occPct = Math.round((totalSold / totalCap) * 100)

  return (
    <tr>
      <td className="px-3 py-2 font-sans text-sm text-[#1A1A1A]">{formatDate(row.date)}</td>
      <td className="px-3 py-2 text-right font-sans text-sm text-[rgba(26,26,26,0.55)]">
        {row.day}
      </td>
      <td className="px-3 py-2 text-right font-display text-sm font-semibold tabular-nums text-[#1A1A1A]">
        {row.occ_sup}
      </td>
      <td className="px-3 py-2 text-right font-display text-sm font-semibold tabular-nums text-[#1A1A1A]">
        {row.occ_exe}
      </td>
      <td className="px-3 py-2 text-right font-display text-sm font-semibold tabular-nums text-[#1A1A1A]">
        {row.occ_sui}
      </td>
      <td className="px-3 py-2 text-right font-display text-sm font-semibold tabular-nums text-[#1A1A1A]">
        {totalSold}
      </td>
      <td className="px-3 py-2 text-right font-sans text-sm tabular-nums text-[rgba(26,26,26,0.65)]">
        {occPct}%
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface Props {
  file: File
  validRows: OccupancyParsedRow[]
  validationErrors: OccupancyValidationError[]
  comparisonRows: OccupancyComparisonRow[]
  onCancel: () => void
  onConfirm: () => void
}

export function OccupancyPreview({
  file,
  validRows,
  validationErrors,
  comparisonRows,
  onCancel,
  onConfirm,
}: Props) {
  const totalRows = validRows.length + validationErrors.length

  // Date range string
  let dateRange = '—'
  if (validRows.length > 0) {
    const dates = validRows.map((r) => r.date).sort()
    dateRange = `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}, ${validRows.length} days`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b border-[#D8DEDE] bg-white px-8 py-5">
        <h1 className="font-display text-[26px] font-bold text-[#1A1A1A]">
          Preview Occupancy Upload
        </h1>
        <p className="mt-0.5 font-sans text-sm text-[rgba(26,26,26,0.55)]">
          Review data before creating a new snapshot.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-6">
        <FileSummary
          fileName={file.name}
          fileSize={file.size}
          totalRows={totalRows}
          validRows={validRows.length}
          errorCount={validationErrors.length}
          dateRange={dateRange}
        />

        <ValidationErrors errors={validationErrors} />

        {comparisonRows.length > 0 && <ComparisonTable rows={comparisonRows} />}

        <PreviewRows rows={validRows} />
      </div>

      {/* Footer */}
      <div className="border-t border-[#D8DEDE] bg-white px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[#D8DEDE] px-5 py-2.5 font-sans text-sm font-medium text-[rgba(26,26,26,0.65)] transition-colors hover:border-[#BFC8C8] hover:text-[#1A1A1A]"
          >
            Cancel
          </button>

          <div className="flex items-center gap-4">
            <p className="font-sans text-xs text-[rgba(26,26,26,0.45)]">
              Confirming will create a new snapshot.{' '}
              <span className="text-[rgba(26,26,26,0.35)]">Previous snapshots remain in history.</span>
            </p>
            <button
              onClick={onConfirm}
              disabled={validRows.length === 0}
              className="rounded-lg bg-[#C9A227] px-6 py-2.5 font-sans text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B8911F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
