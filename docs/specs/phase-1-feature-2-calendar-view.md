# Phase 1 Feature 2 — Calendar View

## Routes
`/calendar` — default current month, custom range picker u headeru.

## Grid
7-column monthly grid, week starts Monday. Today highlighted, weekends visually distinct, days outside current month greyed.

## Cell
- Occupancy % (large, heatmap: <40 red, 40–70 amber, 70–90 green, 90+ gold)
- Sold/total + ADR (small, below)
- Demand marker dot (top-right) from demand_markers
- Restriction icon (top-left) when MLOS/CTA/CTD active in restrictions

## Drawer (on cell click — shadcn Sheet)
- Date + KPI strip (occupancy %, ADR, RevPAR, revenue)
- Per room type table (Superior/Executive/Suite: occupancy, ADR, revenue)
- Pickup: new bookings in 24h / 3d / 7d / 14d windows for this stay date
- Average lead time for reservations staying that night
- Channel mix (Booking / Direct / Expedia / Other)
- Reservations list (guest, room type, check-in, check-out, channel, ADR)

## Month header (KPI strip)
- Total occupancy %, average ADR, RevPAR, total revenue
- Pickup 24h / 3d / 7d / 14d (month aggregate)
- ALOS, average lead time
- Pace vs STLY — render skeleton block with "Awaiting historical data"

## Data sources
- daily_occupancy view (occupancy, sold/total, ADR, revenue per day per room type)
- adr_by_booked_date, stay_nights views
- reservations table (pickup counts, lead time, channel mix)
- demand_markers, restrictions tables

## Edge cases
- Empty month → 0% occupancy, 44 free, ADR/RevPAR = €0
- room_inventory overrides default_room_count (OOO rooms respected)
- Soft-deleted reservations (deleted_at IS NOT NULL) excluded everywhere

## Files
- src/features/calendar/pages/CalendarPage.tsx
- src/features/calendar/components/{CalendarGrid,DayCell,DayDrawer,MonthHeader}.tsx
- src/features/calendar/hooks/{useMonthData,useDayDetail}.ts
- src/features/calendar/lib/metrics.ts (pure functions)

## Tests
Vitest unit tests za metrics.ts: occupancy %, ADR, RevPAR, ALOS, pickup windows, lead time average. Edge cases: zero reservations, OOO override, partial range.

## Out of scope
Pace vs STLY compute (Phase 2), inline restriction/marker edit from cell, forecast layer.
