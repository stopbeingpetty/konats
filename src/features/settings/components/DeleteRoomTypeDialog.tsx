import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSoftDeleteRoomType, useRoomTypeReservationCount } from '../hooks/useRoomTypes'
import type { RoomType } from '@/types/database'

interface DeleteRoomTypeDialogProps {
  target: RoomType | null
  onClose: () => void
}

export function DeleteRoomTypeDialog({ target, onClose }: DeleteRoomTypeDialogProps) {
  const deleteMutation = useSoftDeleteRoomType()

  const { data: reservationCount, isLoading: countLoading } = useRoomTypeReservationCount(
    target?.id ?? null
  )

  const hasActiveReservations = (reservationCount ?? 0) > 0

  async function handleDelete() {
    if (!target) return
    try {
      await deleteMutation.mutateAsync(target.id)
      toast.success('Room type deleted')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete room type'
      toast.error(message)
      onClose()
    }
  }

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent className="border-[#2D5A3D] bg-[#111d14]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl text-white">
            Delete &lsquo;{target?.name ?? ''}&rsquo;?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            This room type will be hidden from the system. Existing reservations
            referencing it will not be affected.
          </AlertDialogDescription>
          {countLoading && (
            <p className="text-sm text-gray-500">Checking active reservations…</p>
          )}
          {!countLoading && hasActiveReservations && (
            <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-900/20 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <p className="text-sm text-amber-300">
                This room type has {reservationCount} active reservation
                {reservationCount !== 1 ? 's' : ''}. Deleting is not recommended.
              </p>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#2D5A3D] bg-transparent text-gray-300 hover:bg-[#1a2f20] hover:text-white">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending || countLoading}
            className="bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
