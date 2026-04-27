import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { roomTypeSchema, type RoomTypeFormValues } from '../schemas/roomType.schema'
import { useCreateRoomType, useUpdateRoomType } from '../hooks/useRoomTypes'
import type { RoomType } from '@/types/database'

interface RoomTypeFormDialogProps {
  open: boolean
  onClose: () => void
  editTarget?: RoomType | null
}

const defaultValues: RoomTypeFormValues = {
  name: '',
  code: '',
  default_room_count: 1,
  sort_order: 0,
  notes: '',
}

function FormBody({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
  isEdit,
}: {
  form: ReturnType<typeof useForm<RoomTypeFormValues>>
  onSubmit: (values: RoomTypeFormValues) => void
  onCancel: () => void
  isSubmitting: boolean
  isEdit: boolean
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-300 text-sm">Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Superior"
                  className="min-h-[44px] border-[#2D5A3D] bg-[#0f1f15] text-white placeholder:text-gray-600 focus-visible:ring-[#C9A227]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Code */}
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-300 text-sm">Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="SUP"
                  className="min-h-[44px] border-[#2D5A3D] bg-[#0f1f15] font-mono uppercase tracking-widest text-[#C9A227] placeholder:text-gray-600 placeholder:normal-case placeholder:tracking-normal focus-visible:ring-[#C9A227]"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Room count + Sort order — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="default_room_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300 text-sm">Default Room Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    className="min-h-[44px] border-[#2D5A3D] bg-[#0f1f15] text-white focus-visible:ring-[#C9A227]"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sort_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300 text-sm">Sort Order</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    className="min-h-[44px] border-[#2D5A3D] bg-[#0f1f15] text-white focus-visible:ring-[#C9A227]"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-300 text-sm">Notes <span className="text-gray-500">(optional)</span></FormLabel>
              <FormControl>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Any relevant notes…"
                  className="w-full min-h-[80px] rounded-md border border-[#2D5A3D] bg-[#0f1f15] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#C9A227] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-md border border-[#2D5A3D] px-5 text-sm text-gray-300 transition-colors hover:bg-[#1a2f20] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] rounded-md bg-[#1A472A] px-6 text-sm font-medium text-white transition-colors hover:bg-[#2D5A3D] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create room type'}
          </button>
        </div>
      </form>
    </Form>
  )
}

export function RoomTypeFormDialog({ open, onClose, editTarget }: RoomTypeFormDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isEdit = editTarget != null

  const createMutation = useCreateRoomType()
  const updateMutation = useUpdateRoomType()
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const form = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues,
  })

  // Populate form when editing
  useEffect(() => {
    if (editTarget) {
      form.reset({
        name: editTarget.name,
        code: editTarget.code,
        default_room_count: editTarget.default_room_count,
        sort_order: editTarget.sort_order,
        notes: editTarget.notes ?? '',
      })
    } else {
      form.reset(defaultValues)
    }
  }, [editTarget, form])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) form.reset(defaultValues)
  }, [open, form])

  function handleCancel() {
    if (form.formState.isDirty) {
      if (!window.confirm('Discard changes?')) return
    }
    onClose()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) handleCancel()
  }

  async function onSubmit(values: RoomTypeFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, values })
        toast.success('Room type updated')
      } else {
        await createMutation.mutateAsync(values)
        toast.success('Room type created')
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      if (message.includes('code already exists')) {
        form.setError('code', { message })
      } else {
        toast.error(message)
      }
    }
  }

  const title = isEdit ? `Edit ${editTarget?.name ?? 'room type'}` : 'Add room type'

  const bodyProps = {
    form,
    onSubmit,
    onCancel: handleCancel,
    isSubmitting,
    isEdit,
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="border-[#2D5A3D] bg-[#111d14] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white">{title}</DialogTitle>
          </DialogHeader>
          <FormBody {...bodyProps} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-xl border-[#2D5A3D] bg-[#111d14] px-6 pb-8 pt-2"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#2D5A3D]" />
        <SheetHeader className="mb-5 p-0">
          <SheetTitle className="font-heading text-xl text-white">{title}</SheetTitle>
        </SheetHeader>
        <FormBody {...bodyProps} />
      </SheetContent>
    </Sheet>
  )
}
