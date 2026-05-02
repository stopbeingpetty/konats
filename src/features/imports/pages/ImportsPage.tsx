import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useRoomTypesList } from '@/features/settings/hooks/useRoomTypes'
import { usePhobsImport } from '../hooks/usePhobsImport'
import { useRecentImports } from '../hooks/useRecentImports'
import { UploadZone } from '../components/UploadZone'
import { ImportSummary } from '../components/ImportSummary'
import { PreviewTable } from '../components/PreviewTable'
import { RecentImportsList } from '../components/RecentImportsList'

export default function ImportsPage() {
  const navigate = useNavigate()
  const { data: roomTypes = [] } = useRoomTypesList()
  const { data: recentImports = [], isLoading: recentLoading } = useRecentImports()

  const {
    step,
    file,
    previewRows,
    summaryStats,
    commitResult,
    parseError,
    progress,
    processFile,
    confirmImport,
    reset,
  } = usePhobsImport(roomTypes)

  // ── Step 1 — Upload ────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="border-b border-[#D8DEDE] bg-white px-8 py-5">
          <h1 className="font-display text-[26px] font-bold text-[#1A1A1A]">
            Import Reservations
          </h1>
          <p className="mt-0.5 font-sans text-sm text-[rgba(26,26,26,0.55)]">
            Upload a Phobs reservations export (.xls file)
          </p>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-8">
          <UploadZone onFileSelect={processFile} parseError={parseError} />

          {/* Recent imports */}
          <div>
            <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
              Recent Imports
            </h2>
            <RecentImportsList imports={recentImports} isLoading={recentLoading} />
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2 — Parsing ───────────────────────────────────────────────────────
  if (step === 'parsing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3D3E]" />
        <p className="font-sans text-sm font-medium text-[rgba(26,26,26,0.65)]">
          Parsing file…
        </p>
      </div>
    )
  }

  // ── Step 3 — Preview ───────────────────────────────────────────────────────
  if (step === 'preview') {
    const actionableCount =
      summaryStats.newCount + summaryStats.updateCount + summaryStats.cancelCount

    return (
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="border-b border-[#D8DEDE] bg-white px-8 py-5">
          <h1 className="font-display text-[26px] font-bold text-[#1A1A1A]">
            Preview Import
          </h1>
          <p className="mt-0.5 font-sans text-sm text-[rgba(26,26,26,0.55)]">
            Review all changes before writing to the database.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-5">
          {/* Summary bar */}
          <ImportSummary
            stats={summaryStats}
            fileName={file?.name}
            fileSize={file?.size}
          />

          {/* Preview table */}
          <PreviewTable rows={previewRows} />
        </div>

        {/* Footer actions */}
        <div className="border-t border-[#D8DEDE] bg-white px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={reset}
              className="rounded-lg border border-[#D8DEDE] px-5 py-2.5 font-sans text-sm font-medium text-[rgba(26,26,26,0.65)] transition-colors hover:border-[#BFC8C8] hover:text-[#1A1A1A]"
            >
              Cancel
            </button>

            <div className="flex items-center gap-4">
              {actionableCount > 0 && (
                <p className="font-sans text-xs text-[rgba(26,26,26,0.45)]">
                  Confirming will write{' '}
                  <span className="font-medium text-[#1A1A1A]">
                    {summaryStats.newCount} new
                  </span>
                  {summaryStats.updateCount > 0 && (
                    <>
                      {' + '}
                      <span className="font-medium text-[#1A1A1A]">
                        {summaryStats.updateCount} updates
                      </span>
                    </>
                  )}
                  {summaryStats.cancelCount > 0 && (
                    <>
                      {' + '}
                      <span className="font-medium text-[#1A1A1A]">
                        {summaryStats.cancelCount} cancellations
                      </span>
                    </>
                  )}{' '}
                  to the database.
                </p>
              )}
              <button
                onClick={() => void confirmImport()}
                disabled={actionableCount === 0}
                className="rounded-lg bg-[#C9A227] px-6 py-2.5 font-sans text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B8911F] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4 — Executing ────────────────────────────────────────────────────
  if (step === 'executing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3D3E]" />
        <div className="text-center">
          <p className="font-sans text-sm font-medium text-[#1A1A1A]">Importing…</p>
          <p className="mt-1 font-sans text-xs text-[rgba(26,26,26,0.45)]">
            {progress}% complete
          </p>
        </div>
        {/* Progress bar */}
        <div className="h-1 w-64 overflow-hidden rounded-full bg-[#E8EEEE]">
          <div
            className="h-full rounded-full bg-[#C9A227] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // ── Step 5 — Result ───────────────────────────────────────────────────────
  if (step === 'result' && commitResult) {
    const hasErrors = commitResult.errors.length > 0

    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Icon */}
          <div className="flex justify-center">
            {hasErrors ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(15,61,62,0.08)]">
                <CheckCircle className="h-8 w-8 text-[#0F3D3E]" />
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1A1A]">
              {hasErrors ? 'Import completed with warnings' : 'Imported successfully'}
            </h1>
          </div>

          {/* Tally */}
          <div className="rounded-xl border border-[#D8DEDE] bg-white px-6 py-5 text-left space-y-2">
            <TallyRow label="New reservations" value={commitResult.inserted} />
            <TallyRow label="Reservations updated" value={commitResult.updated} />
            <TallyRow label="Cancellations recorded" value={commitResult.cancelled} />
            <TallyRow label="Rows skipped" value={commitResult.skipped} muted />
          </div>

          {/* Errors */}
          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 space-y-1">
              {commitResult.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => void navigate('/calendar')}
              className="rounded-lg bg-[#C9A227] px-6 py-2.5 font-sans text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B8911F]"
            >
              View Calendar
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-[#D8DEDE] px-5 py-2.5 font-sans text-sm font-medium text-[rgba(26,26,26,0.65)] transition-colors hover:border-[#BFC8C8] hover:text-[#1A1A1A]"
            >
              Import another file
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function TallyRow({
  label,
  value,
  muted = false,
}: {
  label: string
  value: number
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`font-sans text-sm ${muted ? 'text-[rgba(26,26,26,0.45)]' : 'text-[rgba(26,26,26,0.7)]'}`}
      >
        {label}
      </span>
      <span
        className={`font-display text-lg font-semibold tabular-nums ${muted ? 'text-[rgba(26,26,26,0.35)]' : 'text-[#1A1A1A]'}`}
      >
        {value}
      </span>
    </div>
  )
}
