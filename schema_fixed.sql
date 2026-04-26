-- ============================================================================
-- Konats — Database Schema (Supabase / PostgreSQL)
-- ============================================================================
-- Run this in Supabase SQL Editor on a fresh project.
-- All deletable tables use soft deletes (deleted_at).
-- All critical mutations are logged to audit_log via triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type reservation_source as enum (
  'phobs_excel',
  'phobs_api',
  'laserline_legacy',
  'manual'
);

create type reservation_status as enum (
  'confirmed',
  'cancelled',
  'no_show',
  'checked_in',
  'checked_out'
);

create type audit_action as enum (
  'insert',
  'update',
  'soft_delete',
  'status_change',
  'restore'
);

create type demand_level as enum (
  'low',
  'normal',
  'high',
  'peak'
);

create type backup_type as enum (
  'auto_daily',
  'manual'
);

create type import_status as enum (
  'preview',
  'committed',
  'rolled_back'
);

-- ----------------------------------------------------------------------------
-- Helper: generic updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- Table: room_types
-- ----------------------------------------------------------------------------
create table room_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,                  -- short code, e.g. 'CLS', 'SUP', 'DLX'
  default_room_count int not null check (default_room_count > 0),
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_room_types_active on room_types(deleted_at) where deleted_at is null;

create trigger trg_room_types_updated_at
  before update on room_types
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: room_inventory
-- Daily room counts per room_type. Allows out-of-order tracking per date.
-- If no row exists for a (date, room_type), use room_types.default_room_count.
-- ----------------------------------------------------------------------------
create table room_inventory (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_type_id uuid not null references room_types(id),
  total_rooms int not null check (total_rooms >= 0),
  out_of_order int not null default 0 check (out_of_order >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_type_id),
  check (out_of_order <= total_rooms)
);

create index idx_room_inventory_date on room_inventory(date);

create trigger trg_room_inventory_updated_at
  before update on room_inventory
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: reservations
-- ----------------------------------------------------------------------------
create table reservations (
  id uuid primary key default uuid_generate_v4(),

  -- Source tracking
  source reservation_source not null,
  phobs_reservation_id text,                  -- nullable for manual entries
  external_reservation_id text,               -- LaserLine ID or others

  -- Dates
  booked_date date not null,
  check_in_date date not null,
  check_out_date date not null,
  cancellation_date date,

  -- Computed: number of nights
  nights int generated always as (check_out_date - check_in_date) stored,

  -- Computed: booking window (lead time in days)
  booking_window int generated always as (check_in_date - booked_date) stored,

  -- Inventory linkage
  room_type_id uuid not null references room_types(id),
  rooms_count int not null default 1 check (rooms_count > 0),

  -- Guest (optional, GDPR-light)
  guest_name text,
  guest_country text,                         -- ISO-2 code
  guest_count int check (guest_count is null or guest_count > 0),

  -- Channel & money
  channel text not null,                      -- 'Booking.com', 'Direct', 'Expedia', etc.
  total_amount numeric(12,2) not null,
  currency char(3) not null default 'EUR',

  -- Computed ADR — per room per night
  adr numeric(12,2) generated always as (
    case
      when (check_out_date - check_in_date) > 0 and rooms_count > 0
      then total_amount / (check_out_date - check_in_date) / rooms_count
      else 0
    end
  ) stored,

  -- Status
  status reservation_status not null default 'confirmed',

  -- Misc
  notes text,
  raw_payload jsonb,                          -- preserve original Excel/API row for audit

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Constraints
  check (check_out_date > check_in_date),
  check (total_amount >= 0),

  -- Dedup: only one active row per phobs_reservation_id
  -- (Phase 1 imports rely on this for idempotency)
  unique (phobs_reservation_id)
);

create index idx_reservations_check_in on reservations(check_in_date);
create index idx_reservations_check_out on reservations(check_out_date);
create index idx_reservations_booked on reservations(booked_date);
create index idx_reservations_room_type on reservations(room_type_id);
create index idx_reservations_status on reservations(status);
create index idx_reservations_channel on reservations(channel);
create index idx_reservations_active on reservations(deleted_at) where deleted_at is null;
-- For stay-night queries (date ranges)
create index idx_reservations_stay_range on reservations using gist (
  daterange(check_in_date, check_out_date, '[)')
);

create trigger trg_reservations_updated_at
  before update on reservations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: price_changes
-- Log of every price change applied to Phobs.
-- ----------------------------------------------------------------------------
create table price_changes (
  id uuid primary key default uuid_generate_v4(),
  changed_at timestamptz not null default now(),
  applied_for_date date not null,
  room_type_id uuid not null references room_types(id),
  channel text,                               -- null = applies to all channels
  old_price numeric(12,2),
  new_price numeric(12,2) not null check (new_price >= 0),
  currency char(3) not null default 'EUR',
  changed_by text not null default 'david',
  reason text,
  created_at timestamptz not null default now()
);

create index idx_price_changes_date on price_changes(applied_for_date);
create index idx_price_changes_room_type on price_changes(room_type_id);

-- ----------------------------------------------------------------------------
-- Table: restrictions
-- ----------------------------------------------------------------------------
create table restrictions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  room_type_id uuid not null references room_types(id),
  min_los int not null default 1 check (min_los >= 1),
  cta boolean not null default false,
  ctd boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, room_type_id)
);

create index idx_restrictions_date on restrictions(date);

create trigger trg_restrictions_updated_at
  before update on restrictions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: demand_markers
-- ----------------------------------------------------------------------------
create table demand_markers (
  id uuid primary key default uuid_generate_v4(),
  date_from date not null,
  date_to date not null,
  label text not null,
  level demand_level not null default 'high',
  color text,                                 -- hex, optional override
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (date_to >= date_from)
);

create index idx_demand_markers_dates on demand_markers(date_from, date_to);
create index idx_demand_markers_active on demand_markers(deleted_at) where deleted_at is null;

create trigger trg_demand_markers_updated_at
  before update on demand_markers
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: imports
-- Track Excel imports for idempotency and audit.
-- ----------------------------------------------------------------------------
create table imports (
  id uuid primary key default uuid_generate_v4(),
  imported_at timestamptz not null default now(),
  file_name text not null,
  file_hash text not null,                    -- sha256 of the file
  source reservation_source not null,
  records_total int not null default 0,
  records_new int not null default 0,
  records_updated int not null default 0,
  records_unchanged int not null default 0,
  records_skipped int not null default 0,
  status import_status not null default 'preview',
  preview_payload jsonb,                      -- diff preview details
  notes text,
  created_at timestamptz not null default now()
);

create index idx_imports_hash on imports(file_hash);
create index idx_imports_status on imports(status);

-- ----------------------------------------------------------------------------
-- Table: backups
-- Metadata for JSON snapshots stored in Supabase Storage bucket 'backups'.
-- ----------------------------------------------------------------------------
create table backups (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  type backup_type not null,
  storage_path text not null,                 -- path within 'backups' bucket
  size_bytes bigint,
  reservation_count int,
  notes text
);

create index idx_backups_created on backups(created_at desc);

-- ----------------------------------------------------------------------------
-- Table: audit_log
-- Every mutation on critical tables.
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  occurred_at timestamptz not null default now(),
  table_name text not null,
  record_id uuid not null,
  action audit_action not null,
  old_values jsonb,
  new_values jsonb,
  actor text not null default 'david'
);

create index idx_audit_table_record on audit_log(table_name, record_id);
create index idx_audit_occurred on audit_log(occurred_at desc);

-- ----------------------------------------------------------------------------
-- Audit triggers
-- ----------------------------------------------------------------------------
create or replace function log_audit()
returns trigger as $$
declare
  v_action audit_action;
  v_old jsonb;
  v_new jsonb;
begin
  if (tg_op = 'INSERT') then
    v_action := 'insert';
    v_new := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    if (old.deleted_at is null and new.deleted_at is not null) then
      v_action := 'soft_delete';
    elsif (old.deleted_at is not null and new.deleted_at is null) then
      v_action := 'restore';
    elsif tg_table_name = 'reservations' and old.status is distinct from new.status then
      v_action := 'status_change';
    else
      v_action := 'update';
    end if;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  insert into audit_log(table_name, record_id, action, old_values, new_values)
  values (tg_table_name, new.id, v_action, v_old, v_new);

  return new;
end;
$$ language plpgsql;

create trigger trg_audit_reservations
  after insert or update on reservations
  for each row execute function log_audit();

create trigger trg_audit_price_changes
  after insert on price_changes
  for each row execute function log_audit();

create trigger trg_audit_room_inventory
  after insert or update on room_inventory
  for each row execute function log_audit();

create trigger trg_audit_restrictions
  after insert or update on restrictions
  for each row execute function log_audit();

create trigger trg_audit_room_types
  after insert or update on room_types
  for each row execute function log_audit();

-- ----------------------------------------------------------------------------
-- Views: reporting helpers
-- ----------------------------------------------------------------------------

-- All non-deleted, non-cancelled reservations
create or replace view active_reservations as
select * from reservations
where deleted_at is null
  and status not in ('cancelled', 'no_show');

-- Stay-night exploded view: one row per night per reservation per room sold
create or replace view stay_nights as
select
  r.id as reservation_id,
  r.room_type_id,
  r.channel,
  r.rooms_count,
  r.adr,
  r.total_amount,
  r.nights,
  d::date as stay_date
from active_reservations r
cross join lateral generate_series(r.check_in_date, r.check_out_date - interval '1 day', interval '1 day') as d;

-- Daily occupancy summary across all room types
create or replace view daily_occupancy as
select
  gs.stay_date::date as stay_date,
  rt.id as room_type_id,
  rt.name as room_type_name,
  coalesce(ri.total_rooms, rt.default_room_count) as total_rooms,
  coalesce(sum(d.rooms_count), 0)::int as sold_rooms,
  coalesce(ri.total_rooms, rt.default_room_count) - coalesce(sum(d.rooms_count), 0)::int as free_rooms,
  case
    when coalesce(ri.total_rooms, rt.default_room_count) > 0
    then round(100.0 * coalesce(sum(d.rooms_count), 0) / coalesce(ri.total_rooms, rt.default_room_count), 2)
    else 0
  end as occupancy_pct,
  coalesce(sum(d.adr * d.rooms_count), 0)::numeric(12,2) as room_revenue
from room_types rt
cross join generate_series(
  coalesce((select min(check_in_date) from active_reservations), current_date),
  coalesce((select max(check_out_date) from active_reservations), current_date),
  interval '1 day'
) as gs(stay_date)
left join stay_nights d on d.stay_date = gs.stay_date::date and d.room_type_id = rt.id
left join room_inventory ri on ri.date = gs.stay_date::date and ri.room_type_id = rt.id
where rt.deleted_at is null
group by gs.stay_date, rt.id, rt.name, rt.default_room_count, ri.total_rooms;

-- ADR by booked date
create or replace view adr_by_booked_date as
select
  booked_date,
  count(*) as bookings_count,
  sum(rooms_count * nights)::int as room_nights,
  sum(total_amount)::numeric(12,2) as total_revenue,
  case
    when sum(rooms_count * nights) > 0
    then round(sum(total_amount) / sum(rooms_count * nights), 2)
    else 0
  end as avg_adr
from active_reservations
group by booked_date
order by booked_date;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Single-user app for now. Enable RLS, allow all to authenticated users.
-- (We can tighten later for multi-tenant.)
-- ----------------------------------------------------------------------------
alter table room_types       enable row level security;
alter table room_inventory   enable row level security;
alter table reservations     enable row level security;
alter table price_changes    enable row level security;
alter table restrictions     enable row level security;
alter table demand_markers   enable row level security;
alter table imports          enable row level security;
alter table backups          enable row level security;
alter table audit_log        enable row level security;

create policy authenticated_full_access_room_types on room_types
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_room_inventory on room_inventory
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_reservations on reservations
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_price_changes on price_changes
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_restrictions on restrictions
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_demand_markers on demand_markers
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_imports on imports
  for all to authenticated using (true) with check (true);
create policy authenticated_full_access_backups on backups
  for all to authenticated using (true) with check (true);
create policy authenticated_read_audit on audit_log
  for select to authenticated using (true);
-- Audit log is INSERT-only from triggers, no policy needed for INSERT (security definer)

-- ----------------------------------------------------------------------------
-- Storage bucket for backups (run separately in Supabase dashboard or via SQL)
-- ----------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('backups', 'backups', false);

-- ============================================================================
-- End of schema
-- ============================================================================
