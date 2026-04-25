# Konats — Master Specification

> **This document is the single source of truth for the Konats project.**
> Claude Code reads this every session before making changes.
> Update this file whenever architectural decisions change.

---

## 1. Project context

Konats is a custom revenue management tool built for a single 5-star luxury hotel in Croatia (44 rooms, 2–3 room categories). The hotel uses **Phobs** as its Channel Manager (CMS) and previously used **LaserLine** as its PMS. SmartPricing was the planned RMS, but the integration with Phobs failed because Phobs cannot push occupancy and reservation data to SmartPricing.

Konats fills that gap. It is a manually-fed and (in Phase 3) API-fed revenue intelligence system that lets the operator make pricing decisions in Phobs based on accurate, real-time occupancy, ADR, pace, and channel mix data.

**Owner / sole user:** David Atlija (Revenue Wolves)
**Hotel scale:** 44 rooms across 2–3 room types
**Mission criticality:** HIGH — every booking represents real revenue. Data integrity is non-negotiable.

---

## 2. Constraints and principles

1. **Zero data loss tolerance.** No hard deletes anywhere. Every mutation is logged.
2. **Idempotent imports.** Re-importing the same Phobs Excel file must never create duplicate reservations.
3. **No artificial limits.** No row caps, no pagination ceilings, no record limits anywhere in the codebase.
4. **Premium UX.** Konats represents Revenue Wolves quality. The interface must look like a premium SaaS product, not an internal tool. No emoji clutter, no AI-template aesthetics.
5. **Mobile-first responsive.** David needs phone access for quick checks during meetings.
6. **Phased migration path.** Phase 1 uses Excel imports. Phase 3 swaps to Phobs API without rewriting core domain logic. Architecture must accommodate both data sources behind the same interfaces.

---

## 3. Tech stack (locked decisions)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | Strict TS mode |
| Styling | TailwindCSS + shadcn/ui | Brand colors below |
| Routing | React Router v6 | |
| Server state | TanStack Query v5 | |
| Forms | React Hook Form + Zod | Validation everywhere |
| Charts | Recharts | |
| Calendar UI | Custom — built on date-fns | No heavy calendar libs |
| Excel I/O | SheetJS (xlsx) | Import + export |
| Backend | Supabase (PostgreSQL + Auth + Storage) | EU region |
| Hosting | Netlify | Auto-deploy from GitHub main branch |
| Testing | Vitest + React Testing Library | Domain logic must have tests |

**Brand palette (Revenue Wolves):**
- Primary dark green: `#1A472A`
- Mid green: `#2D5A3D`
- Gold accent: `#C9A227`
- Backgrounds: off-white / very dark green for dark mode
- Fonts: Rajdhani Bold (headings), Work Sans (body)

---

## 4. Domain model

See `supabase/schema.sql` for the canonical schema. Summary:

- **room_types** — 2–3 categories. Each has a name and a base room count.
- **room_inventory** — daily room counts per room type (allows out-of-order tracking per date).
- **reservations** — every booking. Soft-deleted. Deduplicated by `phobs_reservation_id`.
- **price_changes** — log of every price change applied (manual entry by David for now).
- **restrictions** — MinLOS, CTA, CTD per date per room type.
- **demand_markers** — manual annotations of high-demand periods (events, festivals).
- **imports** — log of every Excel import with file hash to prevent re-importing identical files unintentionally.
- **audit_log** — every insert/update/delete on critical tables.
- **backups** — metadata for JSON snapshots stored in Supabase Storage.

**Key derived metrics (computed in views or app layer):**
- `nights = check_out_date - check_in_date`
- `adr = total_amount / nights / rooms_count`
- `revpar = total_room_revenue / available_rooms` (per date or period)
- `occupancy_pct = sold_rooms / available_rooms`

---

## 5. Feature roadmap

### Phase 1 — Operational MVP (target: 1–2 weeks)
Goal: David can run the hotel from Konats from day one.

- [ ] Auth (Supabase, single user)
- [ ] Room types setup (UI to define and edit categories + room counts)
- [ ] Excel import from Phobs reservations export
  - File hash check (warn if re-importing)
  - Diff preview before commit (new / updated / unchanged counts)
  - Idempotent on `phobs_reservation_id`
  - Source tag = `phobs_excel`
- [ ] Manual reservation entry and edit form
- [ ] Calendar view (month grid)
  - Per day: occupancy %, sold/free rooms, total revenue
  - Color intensity reflects occupancy
  - Click day → drawer with stay-night detail (who's in, ADR, channel)
  - Toggle: All room types vs single room type
- [ ] Reservations tab
  - Columns: Booked date, Check-in, Check-out, Nights, Booking window, Channel, Room type, ADR, Total, Status
  - Filters: date range (booked or stay), channel, room type, status
  - Sort on every column
  - CSV export of filtered view
- [ ] ADR by booked date tab (chart + table)
- [ ] JSON export ALL — full database snapshot download
- [ ] Daily auto-backup to Supabase Storage (cron-like via Supabase Edge Function)
- [ ] Audit log viewer (read-only)

### Phase 2 — RMS Intelligence (2–3 weeks after Phase 1)
- [ ] LaserLine legacy import (separate route, source = `laserline_legacy`)
- [ ] Pace report — bookings on the books for each future date vs. lookback
- [ ] Pickup report — new bookings in last 1/3/7/14/30 days, with heatmap
- [ ] RevPAR + Total Room Revenue dashboard
- [ ] Channel mix analysis (% revenue and % bookings per channel, monthly + cumulative)
- [ ] Cancellation tracking (rate by channel, average lead-time-to-cancel, lost revenue)
- [ ] Stay-night detail panel (full guest list per date with revenue breakdown)
- [ ] Restrictions tracking (MinLOS, CTA, CTD log per date per room type)
- [ ] Demand calendar (manual high/peak demand markers, color-coded)
- [ ] Price change log + UI to record changes pushed to Phobs

### Phase 3 — Phobs API + Advanced (after Phobs grants API access)
- [ ] Phobs API client module (replaces Excel import)
- [ ] Real-time reservation sync (webhook or polling)
- [ ] STLY (Same Time Last Year) comparison overlays
- [ ] Forecast vs actual tracking
- [ ] Rules-based price recommendations (e.g. "if 30-day occupancy > 70%, suggest +10%")
- [ ] Compset price tracking (manual entry for now)

---

## 6. Reliability requirements

These are non-negotiable. Every PR that touches data must respect them.

1. **Soft deletes only.** All deletable tables have `deleted_at` and a status field. No `DELETE` SQL ever runs from app code.
2. **Audit log triggers.** Every INSERT/UPDATE on `reservations`, `price_changes`, `room_inventory`, `restrictions` writes a row to `audit_log` via Postgres trigger.
3. **Idempotent imports.** Excel imports use `INSERT ... ON CONFLICT (phobs_reservation_id) DO UPDATE`. Track in `imports` table with file hash.
4. **Three backup layers:**
   - Supabase native daily backup (platform level)
   - Auto JSON dump to Supabase Storage every 24h via Edge Function
   - Manual "Export ALL JSON" download button in app
5. **Validation:**
   - `check_in_date < check_out_date` enforced in DB CHECK constraint
   - `total_amount > 0` for non-cancelled reservations
   - Room type FK must exist
   - Currency must be ISO 4217
6. **Diff preview before destructive operations.** Any import or batch change shows preview before commit, with "Apply" and "Cancel" actions.
7. **Optimistic concurrency.** When updating a reservation, include `updated_at` check to avoid race conditions if David edits from two devices.
8. **Tests for domain logic.** ADR, occupancy, RevPAR, pace, pickup, deduplication — all covered by unit tests with edge cases (zero-night stays, cancellations, multi-room reservations).

---

## 7. UX principles

- **Information density over decorative space.** This is a working tool, not a marketing site.
- **Calendar is the home screen.** First thing David sees on login is current month with today highlighted.
- **Keyboard shortcuts** for power use: `g c` for calendar, `g r` for reservations, `n` for new reservation, `i` for import, `/` for global search.
- **No modals for primary workflows.** Use drawers/sheets. Modals reserved for confirmations.
- **Always show source of data.** Every reservation row indicates whether it came from Phobs Excel, Phobs API, LaserLine legacy, or manual entry.
- **Money formatting:** EUR with comma decimal separator (Croatian convention), e.g. `€ 1.234,56`.
- **Date formatting:** `DD.MM.YYYY` (Croatian convention).
- **Dark mode required.** David works late.

---

## 8. Folder structure

```
src/
  components/         # shadcn/ui + custom presentational
  features/
    calendar/         # Calendar grid, day drawer, occupancy heatmap
    reservations/     # List, filters, edit form
    imports/          # Excel import flow + diff preview
    metrics/          # ADR, RevPAR, pace, pickup, channel mix
    settings/         # Room types, restrictions, demand markers
    backups/          # Manual export, backup history
  lib/
    supabase/         # Supabase client + typed queries
    domain/           # Pure functions: occupancy calc, ADR, pace logic
    excel/            # SheetJS adapters for Phobs and LaserLine formats
    phobs-api/        # Phase 3: Phobs API client (placeholder until ready)
  hooks/              # TanStack Query hooks
  pages/              # Route components
  types/              # Generated from Supabase + domain types
  styles/             # Tailwind config, brand variables
supabase/
  schema.sql          # Canonical schema
  migrations/         # Versioned migrations
  functions/          # Edge functions (daily backup)
tests/
  domain/             # Unit tests for pure logic
  integration/        # End-to-end critical flows
```

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **ADR** | Average Daily Rate = Total Room Revenue / Room Nights Sold |
| **RevPAR** | Revenue per Available Room = Total Room Revenue / Available Rooms |
| **ALOS** | Average Length of Stay |
| **Occupancy %** | Sold Rooms / Available Rooms |
| **Pace** | Bookings on the books for a future date, tracked over time |
| **Pickup** | Net new bookings gained in a window |
| **Booking window / lead time** | Days between booked date and check-in date |
| **MLOS / MinLOS** | Minimum Length of Stay restriction |
| **CTA** | Closed To Arrival (no new check-ins permitted that day) |
| **CTD** | Closed To Departure |
| **STLY** | Same Time Last Year — pace comparison anchor |
| **Stay-night** | A single night of a single room sold (one reservation across N nights = N stay-nights) |
| **Net rate** | Rate received by hotel after OTA commission |

---

## 10. Working with this spec in Claude Code

When starting a new Claude Code session:
1. Open the project folder.
2. Tell Claude Code: "Read KONATS_SPEC.md before making any changes."
3. State the task scoped to a specific feature or phase item.
4. Request that any deviation from this spec be flagged before implementation.

When this spec is updated:
- Bump the date below.
- Note the change in CHANGELOG.md.

---

_Last updated: 2026-04-25_
