// ============================================================================
// Phobs Import — domain types
// ============================================================================

export type PreviewAction = 'new' | 'update' | 'cancel' | 'skip'

export type SkipReason =
  | 'pending_status'
  | 'unmapped_room_type'
  | 'invalid_data'
  | 'unknown_status'

// ---------------------------------------------------------------------------
// Raw parsed row straight from the HTML table
// ---------------------------------------------------------------------------
export type PhobsParsedRow = {
  /** Human-readable row index (title=1, header=2, data starts at 3) */
  rowIndex: number
  /** Phobs internal row ID from column 0 ("#" / "Br. #"). Used to build composite phobs_reservation_id. */
  internalId: string
  code: string
  origin: string
  dolazak: string
  odlazak: string
  nositeljRezervacije: string
  drzava: string
  smjestaj: string
  odraslih: string
  djeca: string
  valuta: string
  ukupno: string
  status: string
  datumNastanka: string
  bookiranoUnaprijed: string
  /** All cells in the row, for raw_payload storage */
  allCells: string[]
}

// ---------------------------------------------------------------------------
// Preview row after column mapping, validation, and DB classification
// ---------------------------------------------------------------------------
export type PreviewRow = {
  rowIndex: number
  action: PreviewAction
  skipReason?: SkipReason
  skipDetail?: string
  // Mapped fields
  phobs_reservation_id: string
  channel: string
  check_in_date: string
  check_out_date: string
  booked_date: string
  guest_name: string
  guest_country: string | null
  room_type_id: string | null
  room_type_name: string | null
  adults: number
  children: number
  guest_count: number
  currency: string
  total_amount: number | null
  nights: number | null
  /** Derived: total_amount / nights — preview display only */
  adr_per_night: number | null
  status: 'confirmed' | 'cancelled' | null
  cancellation_date: string | null
  // Raw strings for warnings
  smjestaj_raw: string
  status_raw: string
  raw_payload: Record<string, string>
}

// ---------------------------------------------------------------------------
// Summary counts for the preview bar
// ---------------------------------------------------------------------------
export type ImportSummaryStats = {
  newCount: number
  updateCount: number
  cancelCount: number
  skipCount: number
}

// ---------------------------------------------------------------------------
// Result after commit
// ---------------------------------------------------------------------------
export type CommitResult = {
  inserted: number
  updated: number
  cancelled: number
  skipped: number
  errors: string[]
}

export type ImportStep = 'upload' | 'parsing' | 'preview' | 'executing' | 'result'

// ============================================================================
// Occupancy Import — domain types
// ============================================================================

/** One parsed row from the Navis Popunjenost xlsx */
export type OccupancyParsedRow = {
  /** 1-based row number in the xlsx (header rows count) */
  rowIndex: number
  /** YYYY-MM-DD */
  date: string
  /** Croatian day abbreviation, e.g. "Pet" */
  day: string
  free_sup: number
  free_exe: number
  free_sui: number
  occ_sup: number
  occ_exe: number
  occ_sui: number
  occ_total: number
  /** 0..1 */
  pct: number
}

export type OccupancyValidationError = {
  rowIndex: number
  date: string
  reason: string
}

/** One row in the before/after comparison table shown in preview */
export type OccupancyComparisonRow = {
  date: string
  /** null when no existing snapshot exists for this date */
  oldSold: number | null
  oldCap: number | null
  newSold: number
  newCap: number
}

export type OccupancyCommitResult = {
  inserted: number
  skipped: number
  errors: string[]
}

export type OccupancyImportStep = 'upload' | 'parsing' | 'preview' | 'executing' | 'result'
