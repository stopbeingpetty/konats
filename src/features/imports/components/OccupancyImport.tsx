import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { RoomType } from '@/types/database'
import { useOccupancyImport } from '../hooks/useOccupancyImport'
import { useRecentOccupancyImports } from '../hooks/useRecentOccupancyImports'
import { OccupancyPreview } from './OccupancyPreview'
import { RecentImportsList } from './RecentImportsList'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Inline upload zone (xlsx-specific)
// ---------------------------------------------------------------------------

function OccupancyUploadZone({
  onFileSelect,
  parseError,
}: {
  onFileSelect: (file: File) => void
  parseError: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center transition-all cursor-pointer select-none',
          isDragging
            ? 'border-[#C9A227] bg-[rgba(201,162,39,0.05)]'
            : parseError
              ? 'border-red-300 bg-red-50'
              : 'border-[#D8DEDE] bg-white hover:border-[#C8D2D2] hover:bg-[rgba(15,61,62,0.02)]'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleChange}
        />

        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-[rgba(201,162,39,0.12)]' : 'bg-[#E8EEEE]'
          )}
        >
          <Upload
            className={cn('h-6 w-6 transition-colors', isDragging ? 'text-[#C9A227]' : 'text-[#0F3D3E]')}
          />
        </div>

        <p className="mt-4 font-display text-[18px] font-semibold text-[#1A1A1A]">
          Drop your Navis Popunjenost file here
        </p>
        <p className="mt-1 font-sans text-sm text-[rgba(26,26,26,0.55)]">
          or click to browse — .xlsx only
        </p>

        {parseError && (
          <div className="mt-4 max-w-md rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {parseError}
          </div>
        )}

        <p className="mt-8 max-w-sm font-sans text-xs text-[rgba(26,26,26,0.4)] leading-relaxed">
          Each upload creates a new snapshot. Previous occupancy snapshots remain in history —
          the calendar always shows the latest values.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tally row (result screen)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  roomTypes: RoomType[]
}

export function OccupancyImport({ roomTypes }: Props) {
  const navigate = useNavigate()
  const { data: recentImports = [], isLoading: recentLoading } = useRecentOccupancyImports()

  const {
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
  } = useOccupancyImport(roomTypes)

  // ── Step 1 — Upload ────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-[#D8DEDE] bg-white px-8 py-5">
          <h1 className="font-display text-[26px] font-bold text-[#1A1A1A]">
            Update Occupancy
          </h1>
          <p className="mt-0.5 font-sans text-sm text-[rgba(26,26,26,0.55)]">
            Upload a Navis Popunjenost Excel file (.xlsx). Each upload creates a new snapshot —
            older snapshots remain in history.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-8">
          <OccupancyUploadZone onFileSelect={(f) => void processFile(f)} parseError={parseError} />

          <div>
            <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-[rgba(26,26,26,0.45)]">
              Recent Occupancy Uploads
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
  if (step === 'preview' && file) {
    return (
      <OccupancyPreview
        file={file}
        validRows={validRows}
        validationErrors={validationErrors}
        comparisonRows={comparisonRows}
        onCancel={reset}
        onConfirm={() => void confirmImport()}
      />
    )
  }

  // ── Step 4 — Executing ────────────────────────────────────────────────────
  if (step === 'executing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3D3E]" />
        <p className="font-sans text-sm font-medium text-[#1A1A1A]">Saving snapshot…</p>
      </div>
    )
  }

  // ── Step 5 — Result ───────────────────────────────────────────────────────
  if (step === 'result' && commitResult) {
    const hasErrors = commitResult.errors.length > 0

    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
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

          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1A1A]">
              {hasErrors ? 'Snapshot saved with warnings' : 'Snapshot saved'}
            </h1>
          </div>

          <div className="rounded-xl border border-[#D8DEDE] bg-white px-6 py-5 text-left space-y-2">
            <TallyRow label="Rows inserted" value={commitResult.inserted} />
            <TallyRow label="Rows skipped (validation)" value={commitResult.skipped} muted />
          </div>

          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 space-y-1">
              {commitResult.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

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
              Upload another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
