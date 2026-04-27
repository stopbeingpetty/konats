import { Pencil, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import type { RoomType } from '@/types/database'

interface RoomTypeListProps {
  roomTypes: RoomType[]
  isLoading: boolean
  error: Error | null
  onEdit: (rt: RoomType) => void
  onDelete: (rt: RoomType) => void
  onRetry: () => void
}

function CodeBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 font-heading text-xs font-bold tracking-widest bg-[#C9A227] text-[#1A472A]">
      {code}
    </span>
  )
}

function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onEdit}
        aria-label="Edit"
        className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[#1a2f20] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-900/30 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md bg-[#1a2f20]" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop table
// ---------------------------------------------------------------------------

function DesktopTable({
  roomTypes,
  onEdit,
  onDelete,
}: {
  roomTypes: RoomType[]
  onEdit: (rt: RoomType) => void
  onDelete: (rt: RoomType) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#2D5A3D]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2D5A3D] bg-[#0f1f15]">
            <th className="px-6 py-3 text-left font-heading text-xs font-bold uppercase tracking-wider text-gray-400">
              Name
            </th>
            <th className="px-6 py-3 text-left font-heading text-xs font-bold uppercase tracking-wider text-gray-400">
              Code
            </th>
            <th className="px-6 py-3 text-left font-heading text-xs font-bold uppercase tracking-wider text-gray-400">
              Rooms
            </th>
            <th className="px-6 py-3 text-left font-heading text-xs font-bold uppercase tracking-wider text-gray-400">
              Notes
            </th>
            <th className="px-6 py-3 text-right font-heading text-xs font-bold uppercase tracking-wider text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2D5A3D]">
          {roomTypes.map((rt) => (
            <tr key={rt.id} className="bg-[#111d14] transition-colors hover:bg-[#0f1f15]">
              <td className="px-6 py-4 font-medium text-white">{rt.name}</td>
              <td className="px-6 py-4">
                <CodeBadge code={rt.code} />
              </td>
              <td className="px-6 py-4 text-gray-300">{rt.default_room_count}</td>
              <td className="max-w-xs px-6 py-4 text-gray-400">
                {rt.notes
                  ? rt.notes.length > 60
                    ? rt.notes.slice(0, 60) + '…'
                    : rt.notes
                  : <span className="text-gray-600">—</span>}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end">
                  <ActionButtons onEdit={() => onEdit(rt)} onDelete={() => onDelete(rt)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile cards
// ---------------------------------------------------------------------------

function MobileCards({
  roomTypes,
  onEdit,
  onDelete,
}: {
  roomTypes: RoomType[]
  onEdit: (rt: RoomType) => void
  onDelete: (rt: RoomType) => void
}) {
  return (
    <div className="space-y-3">
      {roomTypes.map((rt) => (
        <Card
          key={rt.id}
          className="relative border-[#2D5A3D] bg-[#111d14] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-medium text-white">{rt.name}</span>
                <CodeBadge code={rt.code} />
              </div>
              <p className="text-sm text-gray-400">
                {rt.default_room_count} room{rt.default_room_count !== 1 ? 's' : ''}
              </p>
              {rt.notes && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{rt.notes}</p>
              )}
            </div>
            <ActionButtons onEdit={() => onEdit(rt)} onDelete={() => onDelete(rt)} />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function RoomTypeList({
  roomTypes,
  isLoading,
  error,
  onEdit,
  onDelete,
  onRetry,
}: RoomTypeListProps) {
  if (isLoading) return <LoadingSkeleton />

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-800 bg-red-900/20">
        <AlertDescription className="flex items-center justify-between">
          <span>{error.message}</span>
          <button
            onClick={onRetry}
            className="ml-4 rounded border border-red-700 px-3 py-1 text-xs text-red-300 hover:bg-red-900/40"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* Desktop: ≥768px */}
      <div className="hidden md:block">
        <DesktopTable roomTypes={roomTypes} onEdit={onEdit} onDelete={onDelete} />
      </div>
      {/* Mobile: <768px */}
      <div className="md:hidden">
        <MobileCards roomTypes={roomTypes} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </>
  )
}
