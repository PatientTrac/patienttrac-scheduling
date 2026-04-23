# PatientTrac Scheduling

Foundation scheduling app for the PatientTrac EMR platform.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS — deep navy HUD aesthetic (Rajdhani / DM Sans / DM Mono)
- **State**: TanStack Query + Zustand
- **Backend**: Supabase (project `mskormozwekezjmtcylv`) — `cr` schema
- **Deploy**: Netlify → `patienttrac-scheduling.netlify.app`

## Modules

| Module | Status | Sprint |
|---|---|---|
| Patient Registration | ✅ Scaffold | 1 |
| Appointment Calendar | 🔲 Shell | 2 |
| Encounter Creation | 🔲 Planned | 2 |
| Insurance / Eligibility | 🔲 Planned | 2 |
| Billing / A/R | 🔲 Planned | 3 |
| Settings / Admin | 🔲 Planned | 4 |

## encounter_id

Every completed appointment creates a `cr.encounter` row. The `encounter_id` UUID is the cross-app key consumed by:
- **Revela** — plastic surgery clinical module
- **Mental Health** — behavioral health clinical module

## Dev Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled for dev
npm run dev
```

## Deploy

Netlify auto-deploys on push to `main`. Branch previews on PRs.
