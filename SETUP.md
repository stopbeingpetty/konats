# Konats — Setup Guide

This guide gets you from zero to a working development environment.
Follow steps in order. Estimated time: 30–45 minutes.

---

## Step 1 — Create the GitHub repo

1. Go to https://github.com/new
2. Repo name: `konats`
3. **Private** (this is internal hotel data)
4. Initialize with a README — uncheck (we provide one)
5. Click **Create repository**
6. On your laptop:
   ```bash
   mkdir -p ~/projects/konats && cd ~/projects/konats
   git init -b main
   git remote add origin git@github.com:<your-username>/konats.git
   ```
7. Copy `KONATS_SPEC.md`, `supabase/schema.sql`, `SETUP.md`, and `.env.example` from this starter package into the repo root.
8. First commit:
   ```bash
   git add .
   git commit -m "chore: initial project spec and schema"
   git push -u origin main
   ```

---

## Step 2 — Set up Supabase

1. Go to https://supabase.com → **New project**
2. Project name: `konats-prod`
3. Region: **Frankfurt (eu-central-1)** — closest to Croatia, GDPR
4. Database password — generate strong, save in your password manager
5. Wait ~2 minutes for provisioning.

### Run the schema

1. Open the project → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**. You should see "Success. No rows returned."
4. Verify in **Table Editor** — you should see: `room_types`, `room_inventory`, `reservations`, `price_changes`, `restrictions`, `demand_markers`, `imports`, `backups`, `audit_log`.

### Create the backups storage bucket

1. **Storage** → **New bucket**
2. Name: `backups`
3. Public: **No**
4. Create.

### Grab your credentials

1. **Project Settings** → **API**
2. Copy:
   - Project URL (e.g. `https://xxxxxxx.supabase.co`)
   - `anon` public key
   - `service_role` key (for the daily backup Edge Function — keep secret)

### Create your auth user

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. Email: `david.atlija96@gmail.com`
3. Password: strong, save in password manager
4. Email confirmed: **Yes**

---

## Step 3 — Set up Netlify

1. Go to https://app.netlify.com/start
2. **Import from Git** → choose GitHub → select the `konats` repo
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Don't deploy yet — we have no app code. Save and skip first deploy.

### Add environment variables

In **Site configuration** → **Environment variables**, add:

```
VITE_SUPABASE_URL = https://xxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY = <your anon key>
```

(You'll add `SUPABASE_SERVICE_ROLE_KEY` later for the Edge Function — not for the frontend.)

---

## Step 4 — Local environment

Make sure you have:
- Node.js 20 LTS or newer (check: `node --version`)
- npm 10+ (check: `npm --version`)
- Git
- Claude Code installed (https://docs.claude.com/en/docs/claude-code)

Create your local `.env` from the template:

```bash
cd ~/projects/konats
cp .env.example .env
```

Fill in the values from Supabase.

---

## Step 5 — Open in Claude Code and bootstrap

```bash
cd ~/projects/konats
claude
```

In Claude Code, give it this exact starting prompt:

> Read KONATS_SPEC.md carefully. Then bootstrap the project per the spec:
> 1. Initialize Vite + React + TypeScript with strict mode.
> 2. Install all dependencies listed in the tech stack section of the spec.
> 3. Set up Tailwind with the brand palette and fonts (Rajdhani Bold, Work Sans).
> 4. Install and configure shadcn/ui.
> 5. Create the folder structure exactly as specified in section 8.
> 6. Set up the Supabase client in `src/lib/supabase/client.ts` reading from `import.meta.env.VITE_SUPABASE_*`.
> 7. Set up TanStack Query with a QueryClientProvider.
> 8. Set up React Router with placeholder routes for `/`, `/calendar`, `/reservations`, `/imports`, `/settings`, `/backups`.
> 9. Generate TypeScript types from the Supabase schema using `supabase gen types typescript`.
> 10. Create a basic auth layout (login screen + protected route wrapper).
> 11. Add Vitest and React Testing Library configured.
> 12. Stop after bootstrap is complete and verified with `npm run build` and `npm run test` both passing. Report back what was set up.

After this, every feature is built one at a time, starting with **Phase 1 → Room types setup** (the simplest feature, gives you something to see, validates the full stack).

---

## Step 6 — First deploy

After Claude Code finishes bootstrap and you confirm `npm run dev` works locally:

```bash
git add .
git commit -m "chore: bootstrap Vite + React + Supabase + Tailwind + shadcn"
git push
```

Netlify will auto-deploy. Visit your Netlify URL — you should see the login screen.

---

## Step 7 — Email Phobs about API access

Send your Phobs Account Manager:

> Subject: API access for custom revenue management tool
>
> Hi [name],
>
> We're building an internal revenue management dashboard for [hotel name] that will pull reservation data directly from Phobs. Could you provide:
>
> 1. API documentation
> 2. Test credentials for our hotel account
> 3. Any partner agreement we'd need to sign
>
> We'll be happy to integrate via REST or whatever connectivity standard you prefer. The tool is for internal use only — no resale or third-party distribution.
>
> Thanks,
> David Atlija
> Revenue Wolves

This kicks off Phase 3 work in the background while you build Phase 1 with Excel imports.

---

## Step 8 — Verify everything before shipping Phase 1 features

Before any feature is "done":
- [ ] Unit tests pass (`npm run test`)
- [ ] Production build passes (`npm run build`)
- [ ] Manual QA on desktop
- [ ] Manual QA on mobile (use your phone, not just devtools)
- [ ] Test data restore from JSON backup at least once before Phase 1 ships

---

## Common issues

**Supabase types not generating**
You need the Supabase CLI: `npm install -g supabase` then `supabase login`. Run `supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts`.

**RLS policy blocking queries**
The schema includes broad policies for `authenticated` users. If you're getting empty results, confirm you're logged in (check `supabase.auth.getUser()`).

**Edge Function for daily backup**
Add this in Phase 1 final week. Schedule: cron `0 3 * * *` (3 AM Croatia time). Function reads all tables, writes JSON to `backups` bucket, inserts row in `backups` table.
