import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { RoomType } from '@/types/database'
import type {
  PreviewRow,
  ImportStep,
  ImportSummaryStats,
  CommitResult,
} from '../types'
import { parsePhobsXls } from '../lib/parsePhobsXls'
import { mapPhobsRow, mapStatus, parseHrDecimal } from '../lib/mapPhobsRow'
import { validatePhobsRow } from '../lib/validation'
import { buildUpsertPayload } from '../lib/buildUpsertPayload'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeFileHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function computeStats(rows: PreviewRow[]): ImportSummaryStats {
  return rows.reduce<ImportSummaryStats>(
    (acc, row) => {
      switch (row.action) {
        case 'new':
          acc.newCount++
          break
        case 'update':
          acc.updateCount++
          break
        case 'cancel':
          acc.cancelCount++
          break
        case 'skip':
          acc.skipCount++
          break
      }
      return acc
    },
    { newCount: 0, updateCount: 0, cancelCount: 0, skipCount: 0 }
  )
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function makeInvalidSkipRow(
  raw: Parameters<typeof mapPhobsRow>[0],
  reason: string,
): PreviewRow {
  return {
    rowIndex: raw.rowIndex,
    action: 'skip',
    skipReason: 'invalid_data',
    skipDetail: reason,
    phobs_reservation_id: raw.code,
    channel: raw.origin,
    check_in_date: raw.dolazak,
    check_out_date: raw.odlazak,
    booked_date: raw.datumNastanka.slice(0, 10),
    guest_name: raw.nositeljRezervacije,
    guest_country: raw.drzava || null,
    room_type_id: null,
    room_type_name: null,
    adults: 0,
    children: 0,
    guest_count: 0,
    currency: raw.valuta || 'EUR',
    total_amount: null,
    nights: null,
    adr_per_night: null,
    status: null,
    cancellation_date: null,
    smjestaj_raw: raw.smjestaj,
    status_raw: raw.status,
    raw_payload: {},
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePhobsImport(roomTypes: RoomType[]) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileHash, setFileHash] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [summaryStats, setSummaryStats] = useState<ImportSummaryStats>({
    newCount: 0,
    updateCount: 0,
    cancelCount: 0,
    skipCount: 0,
  })
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setFileHash(null)
    setPreviewRows([])
    setSummaryStats({ newCount: 0, updateCount: 0, cancelCount: 0, skipCount: 0 })
    setCommitResult(null)
    setParseError(null)
    setProgress(0)
  }, [])

  const processFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.name.toLowerCase().endsWith('.xls')) {
        setParseError('Please select a .xls file.')
        return
      }

      setFile(selectedFile)
      setStep('parsing')
      setParseError(null)

      try {
        const text = await selectedFile.text()
        const hash = await computeFileHash(text)
        setFileHash(hash)

        const parseResult = parsePhobsXls(text)
        if (!parseResult.ok) {
          setParseError(parseResult.error)
          setStep('upload')
          return
        }

        const today = new Date().toISOString().slice(0, 10)

        // Map rows — status check first, then validation, then full mapping
        const mapped = parseResult.rows.map((raw) => {
          // If status is skip (Na čekanju / unknown), skip validation entirely
          const statusMap = mapStatus(raw.status)
          if (statusMap.action !== 'skip') {
            const totalAmount = parseHrDecimal(raw.ukupno)
            const validation = validatePhobsRow(raw, totalAmount)
            if (!validation.ok) {
              return makeInvalidSkipRow(raw, validation.reason)
            }
          }
          return mapPhobsRow(raw, roomTypes, today)
        })

        // DB lookup: find which phobs_reservation_ids already exist
        const importableCodes = mapped
          .filter((r) => r.action !== 'skip')
          .map((r) => r.phobs_reservation_id)
          .filter(Boolean)

        let existingIds = new Set<string>()
        if (importableCodes.length > 0) {
          const { data } = await supabase
            .from('reservations')
            .select('phobs_reservation_id')
            .in('phobs_reservation_id', importableCodes)

          existingIds = new Set(
            (data ?? [])
              .map((r) => r.phobs_reservation_id)
              .filter((id): id is string => id !== null)
          )
        }

        // Classify new vs update (cancel stays cancel)
        const classified = mapped.map((row) => {
          if (row.action === 'new' && existingIds.has(row.phobs_reservation_id)) {
            return { ...row, action: 'update' as const }
          }
          return row
        })

        const stats = computeStats(classified)
        setPreviewRows(classified)
        setSummaryStats(stats)
        setStep('preview')
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to process file')
        setStep('upload')
      }
    },
    [roomTypes]
  )

  const confirmImport = useCallback(async () => {
    if (!file || !fileHash) return

    setStep('executing')
    setProgress(0)

    const actionableRows = previewRows.filter((r) => r.action !== 'skip')
    const skippedCount = previewRows.filter((r) => r.action === 'skip').length
    const errors: string[] = []
    let inserted = 0
    let updated = 0
    let cancelled = 0

    try {
      // Fetch existing cancellation_dates for cancellation_date preservation
      const codes = actionableRows.map((r) => r.phobs_reservation_id)
      const { data: existingData } =
        codes.length > 0
          ? await supabase
              .from('reservations')
              .select('phobs_reservation_id, cancellation_date')
              .in('phobs_reservation_id', codes)
          : { data: [] as Array<{ phobs_reservation_id: string | null; cancellation_date: string | null }> }

      const existingMap = new Map(
        (existingData ?? []).map((r) => [
          r.phobs_reservation_id,
          { cancellation_date: r.cancellation_date },
        ])
      )

      // Build upsert payloads
      const payloads = actionableRows.map((row) =>
        buildUpsertPayload(row, existingMap.get(row.phobs_reservation_id) ?? undefined)
      )

      // Process in batches of 50
      const batches = chunkArray(payloads, 50)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]

        const { error: batchError } = await supabase
          .from('reservations')
          .upsert(batch, { onConflict: 'phobs_reservation_id', ignoreDuplicates: false })

        if (batchError) {
          errors.push(`Batch ${i + 1}: ${batchError.message}`)
        } else {
          for (const payload of batch) {
            const row = actionableRows.find(
              (r) => r.phobs_reservation_id === payload.phobs_reservation_id
            )
            if (!row) continue
            if (row.action === 'cancel') cancelled++
            else if (row.action === 'update') updated++
            else inserted++
          }
        }

        setProgress(Math.round(((i + 1) / batches.length) * 100))
      }

      // Record import in the audit log table
      await supabase.from('imports').insert({
        imported_at: new Date().toISOString(),
        file_name: file.name,
        file_hash: fileHash,
        source: 'phobs_excel',
        records_total: previewRows.length,
        records_new: inserted,
        records_updated: updated,
        records_unchanged: 0,
        records_skipped: skippedCount + errors.length,
        status: errors.length > 0 ? 'preview' : 'committed',
        preview_payload: {
          file_size_bytes: file.size,
          cancelled,
          errors: errors.length > 0 ? errors : null,
        },
        notes: errors.length > 0 ? errors.join(' | ') : null,
      })

      setCommitResult({ inserted, updated, cancelled, skipped: skippedCount, errors })
      setStep('result')

      void queryClient.invalidateQueries({ queryKey: ['imports'] })
      void queryClient.invalidateQueries({ queryKey: ['reservations'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed unexpectedly'
      setCommitResult({
        inserted,
        updated,
        cancelled,
        skipped: skippedCount,
        errors: [message],
      })
      setStep('result')
    }
  }, [file, fileHash, previewRows, queryClient])

  return {
    step,
    file,
    fileHash,
    previewRows,
    summaryStats,
    commitResult,
    parseError,
    progress,
    processFile,
    confirmImport,
    reset,
  }
}
