import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRoomTypesList } from '../hooks/useRoomTypes'
import { RoomTypeList } from '../components/RoomTypeList'
import { RoomTypeFormDialog } from '../components/RoomTypeFormDialog'
import { DeleteRoomTypeDialog } from '../components/DeleteRoomTypeDialog'
import { EmptyState } from '../components/EmptyState'
import type { RoomType } from '@/types/database'

export function RoomTypesTab() {
  const { data: roomTypes, isLoading, error, refetch } = useRoomTypesList()

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RoomType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoomType | null>(null)

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(rt: RoomType) {
    setEditTarget(rt)
    setFormOpen(true)
  }

  function openDelete(rt: RoomType) {
    setDeleteTarget(rt)
  }

  function closeForm() {
    setFormOpen(false)
    setEditTarget(null)
  }

  function closeDelete() {
    setDeleteTarget(null)
  }

  const isEmpty = !isLoading && !error && (roomTypes?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-white">Room Types</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Define the room categories and default inventory counts.
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={openCreate}
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-[#1A472A] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2D5A3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] md:sticky md:top-6"
          >
            <Plus className="h-4 w-4" />
            Add room type
          </button>
        )}
      </div>

      {/* Mobile: full-width add button when list has items */}
      {!isEmpty && (
        <div className="md:hidden">
          <button
            onClick={openCreate}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#1A472A] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2D5A3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Plus className="h-4 w-4" />
            Add room type
          </button>
        </div>
      )}

      {/* Content */}
      {isEmpty ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <RoomTypeList
          roomTypes={roomTypes ?? []}
          isLoading={isLoading}
          error={error}
          onEdit={openEdit}
          onDelete={openDelete}
          onRetry={() => void refetch()}
        />
      )}

      {/* Dialogs */}
      <RoomTypeFormDialog
        open={formOpen}
        onClose={closeForm}
        editTarget={editTarget}
      />
      <DeleteRoomTypeDialog target={deleteTarget} onClose={closeDelete} />
    </div>
  )
}
