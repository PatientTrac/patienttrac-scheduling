# PatientTracForge

**https://patienttracforge.com**

Foundation scheduling and EMR platform for PatientTrac Corp.

## Stack

- **Frontend**: React 18 + TypeScript + Vite 5
- **Styling**: Tailwind CSS — deep navy HUD aesthetic (Rajdhani / DM Sans / DM Mono)
- **State**: TanStack Query + Zustand
- **Backend**: Supabase (`mskormozwekezjmtcylv`) — `cr` + `saas` + `terms` schemas
- **Deploy**: Netlify → `patienttracforge.com`
- **Admin**: `/admin` — RBAC + TOTP/MFA (Google Authenticator)

## Modules

| Module | Status | Sprint |
|---|---|---|
| Patient Registration | ✅ Live | 1 |
| Smart Address (US + International) | ✅ Live | 1 |
| Photo Upload | ✅ Live | 1 |
| Admin Portal + RBAC | ✅ Live | 2 |
| Appointment Types + CPT | ✅ Live | 2 |
| User Management + MFA | ✅ Live | 2 |
| Appointment Calendar | 🔲 Planned | 3 |
| Encounter Creation | 🔲 Planned | 3 |
| Insurance / Eligibility | 🔲 Planned | 3 |
| Billing / A/R | 🔲 Planned | 4 |

## Multi-App Integration

`encounter_id` is the cross-app contract:
- **PatientTracForge** — creates encounters, owns scheduling + billing
- **Revela** — plastic surgery clinical module, reads `cr.revela_encounter_view`
- **Mental Health** — behavioral health, reads `cr.mental_health_encounter_view`

## Dev Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Schemas

- `cr` — 51 clinical tables (patient, encounter, appointments, providers, facilities, billing)
- `saas` — organizations, members, roles, appointment types, audit log
- `terms` — ICD, CPT, reference data
