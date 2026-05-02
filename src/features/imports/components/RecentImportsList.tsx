import { format } from 'date-fns'
import { FileSpreadsheet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { Import } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  imports: Import[]
  isLoading: boolean
}

function statusBadge(status: Import['status']) {
  if (status === 'committed') {
    return (
      <span className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider bg-[rgba(15,61,62,0.1)] text-[#0F3D3E]">
        Done
      </span>
    )
  }
  if (status === 'rolled_back') {
    return (
      <span className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-600">
        Rolled back
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider bg-[rgba(26,26,26,0.06)] text-[rgba(26,26,26,0.45)]">
      Preview
    </span>
  )
}

export function RecentImportsList({ imports, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-[#D8DEDE]" />
        ))}
      </div>
    )
  }

  if (imports.length === 0) {
    return (
      <p className="font-sans text-sm text-[rgba(26,26,26,0.4)]">
        No imports yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-[#E8EEEE] rounded-xl border border-[#D8DEDE] bg-white overflow-hidden">
      {imports.map((imp, idx) => (
        <div
          key={imp.id}
          className={cn(
            'flex items-center gap-4 px-5 py-3.5',
            idx === 0 && 'rounded-t-xl'
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#E8EEEE]">
            <FileSpreadsheet className="h-4 w-4 text-[#0F3D3E]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate font-sans text-sm font-medium text-[#1A1A1A]"
                title={imp.file_name}
              >
                {imp.file_name}
              </span>
              {statusBadge(imp.status)}
            </div>
            <div className="mt-0.5 flex items-center gap-3 font-sans text-xs text-[rgba(26,26,26,0.45)]">
              <span>{format(new Date(imp.imported_at), 'dd.MM.yyyy HH:mm')}</span>
              <span className="text-[#0F3D3E]">{imp.records_new} new</span>
              {imp.records_updated > 0 && (
                <span className="text-[#C9A227]">{imp.records_updated} updated</span>
              )}
              {imp.records_skipped > 0 && <span>{imp.records_skipped} skipped</span>}
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <span className="font-display text-lg font-semibold tabular-nums text-[#1A1A1A]">
              {imp.records_total}
            </span>
            <p className="font-sans text-[10px] text-[rgba(26,26,26,0.4)] uppercase tracking-wider">
              rows
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
