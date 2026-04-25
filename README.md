# Konats

Custom revenue management tool for a 5-star luxury hotel running on Phobs.

Built and operated by Revenue Wolves.

---

## Quick start

1. Read [`KONATS_SPEC.md`](./KONATS_SPEC.md) — the master specification.
2. Follow [`SETUP.md`](./SETUP.md) to provision Supabase, Netlify, and the local environment.
3. Open the project in Claude Code and follow the bootstrap prompt in `SETUP.md`.

---

## Project structure

```
.
├── KONATS_SPEC.md      # Master spec — single source of truth
├── SETUP.md            # First-time setup guide
├── README.md           # This file
├── CHANGELOG.md        # Notable changes per release
├── .env.example        # Environment variable template
├── supabase/
│   └── schema.sql      # Database schema (run on fresh Supabase project)
└── src/                # Application code (created by bootstrap)
```

---

## Development

```bash
npm install
npm run dev          # local dev server on http://localhost:5173
npm run test         # unit tests
npm run test:watch   # watch mode
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

---

## Deployment

`main` branch auto-deploys to Netlify.

```bash
git push origin main
```

Database migrations are applied manually via Supabase SQL Editor for now (we're a single user; not worth tooling). Track each migration as a numbered file in `supabase/migrations/`.

---

## Working with Claude Code

Every Claude Code session should begin:

> Read KONATS_SPEC.md before making any changes.

Scope each task to a specific item from the Phase 1 / Phase 2 / Phase 3 lists in the spec. If a change requires deviating from the spec, update the spec file in the same commit.
