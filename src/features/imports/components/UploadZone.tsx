import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onFileSelect: (file: File) => void
  parseError: string | null
}

export function UploadZone({ onFileSelect, parseError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear drag state when leaving the zone itself (not child elements)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    // Reset so the same file can be re-selected after an error
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xls"
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
            className={cn(
              'h-6 w-6 transition-colors',
              isDragging ? 'text-[#C9A227]' : 'text-[#0F3D3E]'
            )}
          />
        </div>

        <p className="mt-4 font-display text-[18px] font-semibold text-[#1A1A1A]">
          Drop your Phobs export here
        </p>
        <p className="mt-1 font-sans text-sm text-[rgba(26,26,26,0.55)]">
          or click to browse files — .xls only
        </p>

        {parseError && (
          <div className="mt-4 max-w-md rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {parseError}
          </div>
        )}

        <p className="mt-8 max-w-sm font-sans text-xs text-[rgba(26,26,26,0.4)] leading-relaxed">
          Konats accepts Phobs HTML-formatted .xls exports. Files are validated before any data is
          changed.
        </p>
      </div>
    </div>
  )
}
