# Spec — Settings: Room Types (Phase 1, Feature 1)

## Pregled
Settings stranica s tab strukturom. Prvi tab radimo sada (Room Types), ostali tabovi su placeholderi. CRUD nad `room_types` tablicom, soft delete, RHF + Zod, TanStack Query, mobile-responsive.

## Tab struktura
Tabs (shadcn `Tabs`):
1. **Room Types** — implementiramo
2. **Hotel Info** — placeholder card "Coming in Phase 2"
3. **Integrations** — placeholder (Phobs API, SmartPricing — Phase 3)

URL: `/settings/room-types`, `/settings/hotel-info`, `/settings/integrations`. Default `/settings` → redirect na `/settings/room-types`.

## Inicijalni podaci (seed kroz UI)
Hotel ima 44 sobe:

| Name | Code | Default Count | Sort Order |
|------|------|---------------|------------|
| Superior | SUP | 23 | 1 |
| Executive | EXE | 17 | 2 |
| Suite | SUI | 4 | 3 |

David ručno unosi kroz aplikaciju da odmah testira create flow.

## Polja
- `name` — string, 2–50 chars, unique među non-deleted (client-side check)
- `code` — string, 2–10 chars, uppercase only (regex `/^[A-Z0-9]{2,10}$/`), unique global (DB constraint), auto-uppercase u inputu
- `default_room_count` — integer 1–500
- `sort_order` — non-negative integer, default 0
- `notes` — optional text, max 500 chars
- `id`, `created_at`, `updated_at`, `deleted_at` — auto/system

## List view

**Desktop:** tablica sortirana po `sort_order ASC, name ASC`. Kolone: Name, Code (gold badge), Default Count, Notes (truncated 60 chars), Actions (Edit, Delete ikone).

**Mobile (<768px):** kartice umjesto tablice, svaki room type kao `Card` s padding-om i Edit/Delete kao icon buttons u gornjem desnom kutu.

**Sticky "Add Room Type" gumb** gore desno na desktopu, full-width na vrhu sekcije na mobile-u.

**Empty state:** centriran, kratki CTA "Add your first room type" + dark-green primary gumb. Bez emoji ikona — koristi `lucide-react` ikone (`BedDouble`).

**Loading:** shadcn `Skeleton` redovi (3 placeholder rows).

**Error:** shadcn `Alert variant="destructive"` s retry gumbom.

## Add / Edit forma

Komponenta:
- Desktop: shadcn `Dialog` (centrirani modal)
- Mobile: shadcn `Sheet` (bottom drawer, full-width)

Polja redom: Name → Code → Default Room Count → Sort Order → Notes.

**Zod validacija** (`src/features/settings/schemas/roomType.schema.ts`):

```ts
z.object({
  name: z.string().trim().min(2).max(50),
  code: z.string().regex(/^[A-Z0-9]{2,10}$/),
  default_room_count: z.number().int().min(1).max(500),
  sort_order: z.number().int().min(0),
  notes: z.string().max(500).optional().or(z.literal('')),
})
```

Unique check za `code` se rješava na backend-u. Ako Postgres vrati 23505 (unique violation), forma prikaže field-level error: "A room type with this code already exists." (Napomena: code unique constraint je global, uključuje soft-deleted recorde.)

**Submit:** toast "Room type created" / "Room type updated", dialog/sheet se zatvara.

**Cancel / Esc / klik izvan:** zatvara se bez save-a; ako je form dirty pita confirmation "Discard changes?".

## Delete flow

Klik na trash ikonu → shadcn `AlertDialog`:
- Title: "Delete '{name}'?"
- Description: "This room type will be hidden from the system. Existing reservations referencing it will not be affected."
- **Reservation check:** prije otvaranja dialoga, query `reservations` tablicu za `WHERE room_type_id = ? AND deleted_at IS NULL AND check_out_date >= today`. Ako postoje aktivne rezervacije, dodaj warning u description: "This room type has X active reservation(s). Deleting is not recommended." (koristi `AlertTriangle` ikonu, ne emoji).
- Buttons: "Cancel" (secondary) | "Delete" (destructive variant)
- Soft delete: `UPDATE room_types SET deleted_at = now() WHERE id = ?`
- Toast: "Room type deleted"

**Bez restore UI-a u Phase 1.** Restore ide direktno preko Supabase SQL editor-a ako zatreba.

## Folder struktura

```
src/features/settings/
  pages/
    SettingsPage.tsx              # tabs wrapper s React Router Outlet
    RoomTypesTab.tsx
    HotelInfoTab.tsx              # placeholder
    IntegrationsTab.tsx           # placeholder
  components/
    RoomTypeList.tsx              # responsive: table desktop, cards mobile
    RoomTypeFormDialog.tsx        # responsive: Dialog desktop, Sheet mobile
    DeleteRoomTypeDialog.tsx
    EmptyState.tsx                # reusable
  hooks/
    useRoomTypes.ts               # all 4 query/mutation hooks
  schemas/
    roomType.schema.ts            # Zod
```

## TanStack Query hooks (`useRoomTypes.ts`)

- `useRoomTypesList()` — query, key `['roomTypes', 'list']`, returns non-deleted sorted po `sort_order ASC, name ASC`
- `useCreateRoomType()` — mutation, on success invalidate `['roomTypes']`
- `useUpdateRoomType()` — mutation, optimistic update s rollback on error
- `useSoftDeleteRoomType()` — mutation, optimistic remove iz cache-a, rollback on error
- `useRoomTypeReservationCount(id)` — query za delete confirmation, returns count of active reservations

Sve mutations imaju `onError` handler koji parse-a Postgres error code i vraća user-friendly message.

## Brand styling (kritično — ne smije izgledati AI-generirano)

- Primary buttons: bg `#1A472A`, hover `#2D5A3D`, text white
- Code badge: bg `#C9A227`, text `#1A472A`, font Rajdhani Bold tracking-wide
- Headings (h1, h2, tab triggers): Rajdhani Bold
- Body, table, form labels: Work Sans
- Borders, dividers: subtle, low-contrast
- Spacing: generozni padding (24px desktop, 16px mobile), nikad cramped
- Bez gradient backgrounds, bez emoji ikona, bez "modern startup" pattern-a

## Mobile responsive checklist
- 375px viewport mora biti čitljiv
- Touch targets min 44×44px
- Sheet (bottom drawer) ima drag handle na vrhu
- Tablica → kartice transition na 768px breakpoint-u
- Sticky elementi ne smiju zauzimati >25% viewport visine

## Acceptance criteria
- [ ] `/settings` redirecta na `/settings/room-types`
- [ ] Tab navigacija bez full page reload-a, URL se ažurira
- [ ] Mogu dodati Superior (23), Executive (17), Suite (4) → ukupno 44
- [ ] Form validacija blokira invalid input s field-level error porukama
- [ ] Duplicate `code` → friendly error
- [ ] Edit perzistira promjene, lista se invalidira
- [ ] Soft delete sakriva entry, ne briše iz baze (verifikacija direktno u Supabase)
- [ ] Audit log dobiva entry za svaki INSERT/UPDATE/DELETE (već postavljen u schemi)
- [ ] Aktivne rezervacije generiraju warning u delete dialogu
- [ ] Mobile layout testiran na 375px (iPhone SE)
- [ ] Loading, error, empty stateovi implementirani
- [ ] Vitest unit testovi za Zod schemu (valid + invalid cases)
