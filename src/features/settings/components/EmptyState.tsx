import { BedDouble } from 'lucide-react'

interface EmptyStateProps {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 rounded-full bg-[#1A472A]/20 p-4">
        <BedDouble className="h-8 w-8 text-[#C9A227]" />
      </div>
      <h3 className="mb-1 font-heading text-xl font-bold text-white">No room types yet</h3>
      <p className="mb-6 max-w-xs text-sm text-gray-400">
        Add your first room type to start tracking occupancy and revenue.
      </p>
      <button
        onClick={onAdd}
        className="min-h-[44px] min-w-[44px] rounded-md bg-[#1A472A] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2D5A3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
      >
        Add your first room type
      </button>
    </div>
  )
}
