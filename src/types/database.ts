// ============================================================================
// Konats — Database Types (hand-written from supabase/schema.sql)
// ============================================================================

export type ReservationSource =
  | 'phobs_excel'
  | 'phobs_api'
  | 'laserline_legacy'
  | 'manual'

export type ReservationStatus =
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'checked_in'
  | 'checked_out'

export type AuditAction =
  | 'insert'
  | 'update'
  | 'soft_delete'
  | 'status_change'
  | 'restore'

export type DemandLevel = 'low' | 'normal' | 'high' | 'peak'

export type BackupType = 'auto_daily' | 'manual'

export type ImportStatus = 'preview' | 'committed' | 'rolled_back'

// ----------------------------------------------------------------------------
// Tables
// ----------------------------------------------------------------------------

export interface RoomType {
  id: string
  name: string
  code: string
  default_room_count: number
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface RoomInventory {
  id: string
  date: string
  room_type_id: string
  total_rooms: number
  out_of_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  source: ReservationSource
  phobs_reservation_id: string | null
  external_reservation_id: string | null
  booked_date: string
  check_in_date: string
  check_out_date: string
  cancellation_date: string | null
  /** generated always: check_out_date - check_in_date */
  nights: number
  /** generated always: check_in_date - booked_date */
  booking_window: number
  room_type_id: string
  rooms_count: number
  guest_name: string | null
  guest_country: string | null
  guest_count: number | null
  channel: string
  total_amount: number
  currency: string
  /** generated always: total_amount / nights / rooms_count */
  adr: number
  status: ReservationStatus
  notes: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PriceChange {
  id: string
  changed_at: string
  applied_for_date: string
  room_type_id: string
  channel: string | null
  old_price: number | null
  new_price: number
  currency: string
  changed_by: string
  reason: string | null
  created_at: string
}

export interface Restriction {
  id: string
  date: string
  room_type_id: string
  min_los: number
  cta: boolean
  ctd: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DemandMarker {
  id: string
  date_from: string
  date_to: string
  label: string
  level: DemandLevel
  color: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Import {
  id: string
  imported_at: string
  file_name: string
  file_hash: string
  source: ReservationSource
  records_total: number
  records_new: number
  records_updated: number
  records_unchanged: number
  records_skipped: number
  status: ImportStatus
  preview_payload: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface Backup {
  id: string
  created_at: string
  type: BackupType
  storage_path: string
  size_bytes: number | null
  reservation_count: number | null
  notes: string | null
}

export interface AuditLog {
  id: string
  occurred_at: string
  table_name: string
  record_id: string
  action: AuditAction
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  actor: string
}

// ----------------------------------------------------------------------------
// Views
// ----------------------------------------------------------------------------

/** active_reservations — non-deleted, non-cancelled reservations */
export type ActiveReservation = Reservation

/** stay_nights — one row per night per reservation per room sold */
export interface StayNight {
  reservation_id: string
  room_type_id: string
  channel: string
  rooms_count: number
  adr: number
  total_amount: number
  nights: number
  stay_date: string
}

/** daily_occupancy — aggregated per date per room type */
export interface DailyOccupancy {
  stay_date: string
  room_type_id: string
  room_type_name: string
  total_rooms: number
  sold_rooms: number
  free_rooms: number
  occupancy_pct: number
  room_revenue: number
}

/** adr_by_booked_date — aggregated by booking date */
export interface AdrByBookedDate {
  booked_date: string
  bookings_count: number
  room_nights: number
  total_revenue: number
  avg_adr: number
}

// ----------------------------------------------------------------------------
// Supabase Database shape (for typed client)
// ----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      room_types: {
        Row: RoomType
        Insert: Omit<RoomType, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RoomType, 'id' | 'created_at'>>
      }
      room_inventory: {
        Row: RoomInventory
        Insert: Omit<RoomInventory, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RoomInventory, 'id' | 'created_at'>>
      }
      reservations: {
        Row: Reservation
        Insert: Omit<Reservation, 'id' | 'nights' | 'booking_window' | 'adr' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Reservation, 'id' | 'nights' | 'booking_window' | 'adr' | 'created_at'>>
      }
      price_changes: {
        Row: PriceChange
        Insert: Omit<PriceChange, 'id' | 'created_at'>
        Update: Partial<Omit<PriceChange, 'id' | 'created_at'>>
      }
      restrictions: {
        Row: Restriction
        Insert: Omit<Restriction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Restriction, 'id' | 'created_at'>>
      }
      demand_markers: {
        Row: DemandMarker
        Insert: Omit<DemandMarker, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DemandMarker, 'id' | 'created_at'>>
      }
      imports: {
        Row: Import
        Insert: Omit<Import, 'id' | 'created_at'>
        Update: Partial<Omit<Import, 'id' | 'created_at'>>
      }
      backups: {
        Row: Backup
        Insert: Omit<Backup, 'id' | 'created_at'>
        Update: Partial<Omit<Backup, 'id' | 'created_at'>>
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'occurred_at'>
        Update: never
      }
    }
    Views: {
      active_reservations: {
        Row: ActiveReservation
      }
      stay_nights: {
        Row: StayNight
      }
      daily_occupancy: {
        Row: DailyOccupancy
      }
      adr_by_booked_date: {
        Row: AdrByBookedDate
      }
    }
    Functions: Record<string, never>
    Enums: {
      reservation_source: ReservationSource
      reservation_status: ReservationStatus
      audit_action: AuditAction
      demand_level: DemandLevel
      backup_type: BackupType
      import_status: ImportStatus
    }
  }
}
