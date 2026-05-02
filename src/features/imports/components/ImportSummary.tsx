import type { ImportSummaryStats } from '../types'

interface Props {
  stats: ImportSummaryStats
  fileName?: string
  fileSize?: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface StatCellProps {
  label: string
  value: number
  color: string
}

function StatCell({ label, value, color }: StatCellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-display text-3xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <span className="font-sans text-xs font-medium uppercase tracking-widest text-[rgba(26,26,26,0.5)]">
        {label}
      </span>
    </div>
  )
}

export function ImportSummary({ stats, fileName, fileSize }: Props) {
  return (
    <div className="rounded-xl border border-[#D8DEDE] bg-white">
      {fileName && (
        <div className="flex items-center gap-3 border-b border-[#E8EEEE] px-6 py-3">
          <span className="font-sans text-sm font-medium text-[#1A1A1A]">{fileName}</span>
          {fileSize !== undefined && (
            <span className="font-sans text-xs text-[rgba(26,26,26,0.45)]">
              {formatBytes(fileSize)}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-4 divide-x divide-[#E8EEEE] px-2 py-5">
        <StatCell label="New" value={stats.newCount} color="#0F3D3E" />
        <StatCell label="Updates" value={stats.updateCount} color="#C9A227" />
        <StatCell label="Cancellations" value={stats.cancelCount} color="#DC2626" />
        <StatCell label="Skipped" value={stats.skipCount} color="rgba(26,26,26,0.35)" />
      </div>
    </div>
  )
}
