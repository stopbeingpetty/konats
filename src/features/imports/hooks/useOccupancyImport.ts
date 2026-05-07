import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { RoomType } from '@/types/database'
import type {
  OccupancyParsedRow,
  OccupancyValidationError,
  OccupancyComparisonRow,
  OccupancyCommitResult,
  OccupancyImportStep,
} from '../types'
import { parseOccupancyXlsx } from '../lib/parseOccupancyXlsx'
import { validateOccupancyRows, ROOM_CAPACITY } from '../lib/validateOccupancy'
import { matchRoomType } from '../lib/mapPhobsRow'
import { deduplicateByLatestSnapshot } from '@/features/calendar/lib/deduplicateOverrides'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOccupancyImport(roomTypes: RoomType[]) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<OccupancyImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [validRows, setValidRows] = useState<OccupancyParsedRow[]>([])
  const [validationErrors, setValidationErrors] = useState<OccupancyValidationError[]>([])
  const [comparisonRows, setComparisonRows] = useState<OccupancyComparisonRow[]>([])
  const [commitResult, setCommitResult] = useState<OccupancyCommitResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setValidRows([])
    setValidationErrors([])
    setComparisonRows([])
    setCommitResult(null)
    setParseError(null)
  }, [])

  const processFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
        setParseError('Please select a .xlsx file.')
        return
      }

      setFile(selectedFile)
      setStep('parsing')
      setParseError(null)

      try {
        const buffer = await selectedFile.arrayBuffer()
        const parseResult = parseOccupancyXlsx(buffer)

        if (!parseResult.ok) {
          setParseError(parseResult.error)
          setStep('upload')
          return
        }

        const { validRows: parsed, errors } = validateOccupancyRows(parseResult.rows)
        setValidRows(parsed)
        setValidationErrors(errors)

        // Fetch comparison data for the first 5 unique dates in the upload
        const first5Dates = [...new Set(parsed.map((r) => r.date))].slice(0, 5)

        let comparison: OccupancyComparisonRow[] = []

        if (first5Dates.length > 0) {
          const { data: existingRows } = await supabase
            .from('daily_occupancy_override')
            .select('date, room_type_id, sold_rooms, capacity, snapshot_date')
            .in('date', first5Dates)

          const deduplicated = deduplicateByLatestSnapshot(
            (existingRows ?? []).map((r) => ({
              ...r,
              id: '',
              source: '',
              import_id: null,
              notes: null,
              created_at: null,
              updated_at: null,
            }))
          )

          // Total sold/capacity across all room types per date
          const existingByDate = new Map<string, { sold: number; cap: number }>()
          for (const row of deduplicated) {
            const entry = existingByDate.get(row.date) ?? { sold: 0, cap: 0 }
            existingByDate.set(row.date, {
              sold: entry.sold + row.sold_rooms,
              cap: entry.cap + row.capacity,
            })
          }

          comparison = first5Dates.map((date) => {
            const existing = existingByDate.get(date) ?? null
            const newRow = parsed.find((r) => r.date === date)
            const newSold = newRow ? newRow.occ_sup + newRow.occ_exe + newRow.occ_sui : 0
            const newCap = ROOM_CAPACITY.sup + ROOM_CAPACITY.exe + ROOM_CAPACITY.sui

            return {
              date,
              oldSold: existing?.sold ?? null,
              oldCap: existing?.cap ?? null,
              newSold,
              newCap,
            }
          })
        }

        setComparisonRows(comparison)
        setStep('preview')
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to process file')
        setStep('upload')
      }
    },
    // roomTypes not used in processFile directly, but included for re-creation
    // if the user changes room types between uploads (unlikely but safe)
    []
  )

  const confirmImport = useCallback(async () => {
    if (!file) return

    setStep('executing')

    // Resolve room type IDs by keyword matching
    const supMatch = matchRoomType('superior', roomTypes)
    const exeMatch = matchRoomType('executive', roomTypes)
    const suiMatch = matchRoomType('suite', roomTypes)

    if (!supMatch.ok || !exeMatch.ok || !suiMatch.ok) {
      const missing = [
        !supMatch.ok && 'Superior',
        !exeMatch.ok && 'Executive',
        !suiMatch.ok && 'Suite',
      ]
        .filter(Boolean)
        .join(', ')
      setCommitResult({
        inserted: 0,
        skipped: validRows.length,
        errors: [`Cannot resolve room types: ${missing}. Check room type names in Settings.`],
      })
      setStep('result')
      return
    }

    const errors: string[] = []
    let inserted = 0

    try {
      // Single snapshot_date for the entire batch (all rows from this upload)
      const snapshotDate = new Date().toISOString()

      const buffer = await file.arrayBuffer()
      const fileHash = await computeFileHash(buffer)

      // Insert import audit record first (in preview status)
      const { data: importRow, error: importInsertError } = await supabase
        .from('imports')
        .insert({
          imported_at: snapshotDate,
          file_name: file.name,
          file_hash: fileHash,
          source: 'occupancy_excel',
          records_total: validRows.length + validationErrors.length,
          records_new: validRows.length * 3, // 3 room types per day
          records_updated: 0,
          records_unchanged: 0,
          records_skipped: validationErrors.length,
          status: 'preview',
          preview_payload: {
            file_size_bytes: file.size,
            validation_errors:
              validationErrors.length > 0
                ? validationErrors.map((e) => `Row ${e.rowIndex} (${e.date}): ${e.reason}`)
                : null,
          },
          notes: null,
        })
        .select('id')
        .single()

      if (importInsertError) {
        errors.push(`Failed to create import record: ${importInsertError.message}`)
      }

      const importId = importRow?.id ?? null

      // Build insert rows: 3 per valid day (superior, executive, suite)
      const insertRows: Array<{
        date: string
        room_type_id: string
        sold_rooms: number
        capacity: number
        source: string
        snapshot_date: string
        import_id: string | null
        notes: null
      }> = []

      for (const row of validRows) {
        insertRows.push({
          date: row.date,
          room_type_id: supMatch.id,
          sold_rooms: row.occ_sup,
          capacity: ROOM_CAPACITY.sup,
          source: 'occupancy_excel',
          snapshot_date: snapshotDate,
          import_id: importId,
          notes: null,
        })
        insertRows.push({
          date: row.date,
          room_type_id: exeMatch.id,
          sold_rooms: row.occ_exe,
          capacity: ROOM_CAPACITY.exe,
          source: 'occupancy_excel',
          snapshot_date: snapshotDate,
          import_id: importId,
          notes: null,
        })
        insertRows.push({
          date: row.date,
          room_type_id: suiMatch.id,
          sold_rooms: row.occ_sui,
          capacity: ROOM_CAPACITY.sui,
          source: 'occupancy_excel',
          snapshot_date: snapshotDate,
          import_id: importId,
          notes: null,
        })
      }

      // Insert in batches of 100 (3 room types × ~33 dates)
      const batches = chunkArray(insertRows, 100)

      for (let i = 0; i < batches.length; i++) {
        const { error: batchError } = await supabase
          .from('daily_occupancy_override')
          .insert(batches[i])

        if (batchError) {
          errors.push(`Batch ${i + 1}: ${batchError.message}`)
        } else {
          inserted += batches[i].length
        }
      }

      // Update import record with final status
      if (importId) {
        await supabase
          .from('imports')
          .update({
            records_new: inserted,
            status: errors.length > 0 ? 'preview' : 'committed',
            notes: errors.length > 0 ? errors.join(' | ') : null,
          })
          .eq('id', importId)
      }

      setCommitResult({
        inserted,
        skipped: validationErrors.length,
        errors,
      })
      setStep('result')

      void queryClient.invalidateQueries({ queryKey: ['imports'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar', 'occupancyOverrides'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed unexpectedly'
      setCommitResult({ inserted, skipped: validationErrors.length, errors: [message] })
      setStep('result')
    }
  }, [file, validRows, validationErrors, roomTypes, queryClient])

  return {
    step,
    file,
    validRows,
    validationErrors,
    comparisonRows,
    commitResult,
    parseError,
    processFile,
    confirmImport,
    reset,
  }
}
