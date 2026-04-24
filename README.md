# PatientTracForge

**Live:** https://patienttracforge.com  
**Admin:** https://patienttracforge.com/admin  
**Repo:** github.com/PatientTrac/patienttrac-scheduling  
**Deployed:** Netlify → auto-deploy on push to `master`  
**Database:** Supabase `mskormozwekezjmtcylv` · us-east-1 · PatientTrac Corp org

---

## Overview

PatientTracForge is the foundation EMR scheduling platform for PatientTrac Corp. It handles patient registration, demographics, insurance, appointment scheduling, encounter creation, and billing — and routes patients to specialty clinical modules (Revela for plastic surgery, Mental Health for behavioral health) via a shared `encounter_id` key.

Built as a SaaS platform with multi-tenant isolation (org_id + Row Level Security on every table), HIPAA-compliant audit logging, and AI-powered scheduling intelligence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS · Rajdhani / DM Sans / DM Mono · HUD aesthetic |
| State | TanStack Query v5 + Zustand |
| Backend | Supabase PostgreSQL · PostgREST API · Realtime |
| Auth | Supabase Auth + custom TOTP MFA (Google Authenticator) |
| AI | Claude Sonnet 4.6 via Anthropic API (Edge Functions) |
| Edge Functions | Deno / Supabase Edge (5 AI functions deployed) |
| Hosting | Netlify Pro · patienttracforge.com |
| CI/CD | GitHub → Netlify auto-deploy |

---

## Database Architecture

### Schemas

| Schema | Tables | Purpose |
|---|---|---|
| `cr` | 51 tables | Clinical Repository — all patient/clinical data |
| `saas` | 8 tables | SaaS layer — orgs, users, roles, config |
| `terms` | 17+ tables | Reference data — CPT, ICD-10, DSM-5, modifiers |

### Migration History

| # | Name | Description |
|---|---|---|
| 001 | init_schemas_extensions | cr + terms schemas, uuid-ossp, pg_trgm |
| 002 | cr_patient_demographics | Patient table, related persons, contacts |
| 003 | cr_encounters_notes | Encounter, notes, annotations |
| 004 | cr_diagnosis_mental_status | Diagnosis, MSE, treatment plans |
| 005 | cr_plastic_surgery_breast_exam | Surgical, breast, operative notes |
| 006 | cr_medications_prescriptions | Medications, prescriptions, Rx history |
| 007 | cr_appointments_scheduling | Appointments, blocks, resources |
| 008 | cr_billing_insurance | Patient insurance, invoices, payments, superbill |
| 009 | cr_providers_facilities | Providers, facilities, referrals |
| 010 | cr_proposals_care_plans | Care plans, goals, interventions |
| 011 | terms_database | ICD templates, surgical codes, reference data |
| 012 | indexes_rls_performance | Search indexes, RLS policies |
| 013 | seed_terms_data | Initial reference data |
| 014 | saas_organizations | Organizations, modules, org_facilities |
| 015 | add_org_id_to_cr_tables | org_id on all cr.* tables + indexes |
| 016 | rls_policies | Row Level Security + module-gated access |
| 017 | cross_app_encounter_views | encounter_summary, revela_view, mental_health_view |
| 018 | international_fields | US/non-US resident, country, province, tax ID types |
| 019 | admin_rbac_totp_appointment_types | Role permissions, MFA, 23 appointment types + CPT |
| 020 | seed_facilities | 4 facilities seeded |
| 021 | code_tables_cpt_icd_dsm | 114 CPT, 95 ICD-10, 46 DSM-5, 26 modifiers + search functions |
| 022 | encounter_routing_insurance | App routing, workflow log, eligibility checks, 10 insurers |
| 023 | ai_features_schema | No-show scores, wait time tracking, intake, billing AI, comms log |

### Key Tables

```
cr.patient          — Master patient record (55 columns, US + international)
cr.encounter        — Encounter record (encounter_id = cross-app key)
cr.appointments     — Scheduling with wait time timestamps
cr.providers        — Provider credentials, specialties, NPI
cr.facilities       — Multi-site facility management
cr.patient_insurance — Primary/secondary/tertiary coverage
cr.superbill        — CPT/ICD billing records
cr.noshow_risk_scores — AI no-show predictions
cr.patient_intake   — AI pre-visit intake with triage
cr.billing_ai_suggestions — AI CPT/ICD coding suggestions
cr.communications_log — Email/SMS send log
cr.encounter_workflow — Check-in step audit trail

saas.organizations  — Tenant orgs
saas.org_members    — Users with roles, MFA state
saas.role_permissions — RBAC permission matrix (6 roles × 8 resources)
saas.appointment_types — 23 appt types with CPT codes, fees, POS codes
saas.app_routing    — Specialty → clinical app routing map
saas.auth_audit_log — HIPAA login/MFA audit trail
saas.config         — API key configuration

terms.cpt_codes     — 114 CPT codes with RVU, fee, POS
terms.icd10_codes   — 95 ICD-10-CM codes (59 flagged is_dsm5)
terms.dsm5_codes    — 46 DSM-5 diagnoses with specifiers/severity levels
terms.cpt_modifiers — 26 CPT modifiers
```

---

## Role-Based Access Control

| Role | Facilities | Users | Patients | Insurance | Appointments | Billing | Reports | System |
|---|---|---|---|---|---|---|---|---|
| super_admin | Full | Full | Full | Full | Full | Full | Full | Full |
| admin | View | Full | Create/Edit | Full | Full | Create/Edit | View | — |
| provider | View | — | Create/Edit | View | Create/Edit | View | View | — |
| billing | View | — | View | Full | View | Full | View | — |
| staff | View | — | Create/Edit | Create | Create/Edit | View | — | — |
| readonly | View | — | View | View | View | View | View | — |

MFA (Google Authenticator TOTP) is required for all admin and provider roles.

---

## AI Features

### Edge Functions Deployed

| Function | Trigger | What it does |
|---|---|---|
| `noshow-predict` | On appointment booking | Scores 1–10 no-show risk, identifies risk factors, recommends action |
| `wait-time-track` | On check-in steps (arrived/seen/departed) | Records timestamps, calculates wait, queues apology SMS if >20 min |
| `smart-schedule` | On new appointment modal | Suggests optimal slots, flags conflicts, checks insurance visit intervals |
| `patient-intake` | Pre-visit via token link | AI chat collects chief complaint/meds/symptoms, flags red flags, suggests ICD codes |
| `billing-ai` | On encounter close | Suggests CPT codes, ICD codes, modifiers, scores denial risk, estimates reimbursement |
| `totp-setup` | Admin MFA enrollment | Generates QR code for Google Authenticator, verifies token |

### No-Show Prediction

Called at booking. Returns risk_score (1–10), risk_label, risk_factors array, and recommendation. Factors analyzed: prior no-show rate, self-pay status, appointment day/time, visit type, insurance type, time since last visit, new vs established patient.

High-risk (7+): staff sees alert on calendar, system queues extra reminder SMS. Critical (9–10): recommended double-booking slot.

### Wait Time Tracking

Four timestamps on each appointment:
- `arrived_at` — staff clicks "Patient Arrived" in check-in
- `called_back_at` — staff calls patient to exam room  
- `seen_at` — provider opens encounter (auto-set by `cr.open_encounter()`)
- `departed_at` — staff marks visit complete

`wait_time_mins` = `seen_at` - `arrived_at`. Surfaced on dashboard by provider, day of week, hour of day. Automatic apology SMS queued if wait > 20 minutes.

### Smart Scheduling

When booking, Claude analyzes the provider's 14-day schedule and returns 3 optimal slots ranked by score (1–10) with reasons. Checks: existing schedule conflicts, patient no-show risk (avoids Monday AM for high-risk), insurance visit interval requirements, provider specialty patterns.

### AI Intake

Patient receives a tokenized link (expires 48h) before their visit. They answer: chief complaint, duration, severity (1–10), current medications, allergies, recent changes. Claude returns: clinical summary for provider, suggested ICD-10 codes, red flag alerts (emergent/urgent/routine triage), which pre-fills the encounter chief complaint field.

### Billing AI

After encounter close, Claude reads: chief complaint, provider specialty, appointment type, patient insurance, intake summary. Returns: suggested CPT codes with confidence scores, ICD codes, modifiers, denial risk score (1–10) with specific risk factors, estimated reimbursement. Biller reviews and accepts/rejects.

---

## Cross-App Integration

`encounter_id` is the universal key across all PatientTracForge apps.

```
PatientTracForge Scheduling
  └── cr.open_encounter() → encounter_id
        ├── Revela (plastic surgery)
        │     URL: https://revela.patienttracforge.com?encounter_id=X&patient_id=Y
        │     Reads: cr.revela_encounter_view
        │     Writes: cr.surgical_prognote, cr.operative_notes, cr.postop_plan
        │
        └── Mental Health
              URL: https://mentalhealth.patienttracforge.com?encounter_id=X&patient_id=Y
              Reads: cr.mental_health_encounter_view
              Writes: cr.evaluation_management, cr.patient_mental_status, cr.patient_careplan
```

Routing logic: `cr.checkin_and_route(appointment_id)` queries `saas.app_routing` joined against `saas.org_modules` to return app URLs for the provider's specialty, with `encounter_id`, `patient_id`, and `provider_id` pre-embedded.

---

## Development Setup

```bash
git clone https://github.com/PatientTrac/patienttrac-scheduling
cd patienttrac-scheduling
npm install
cp .env.example .env.local   # pre-filled with dev Supabase URL + anon key
npm run dev                   # http://localhost:5173
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://mskormozwekezjmtcylv.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Netlify Environment Variables (set in dashboard)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
NPM_FLAGS=--legacy-peer-deps
```

---

## Routes

### Main Application

| Route | Component | Description |
|---|---|---|
| `/dashboard` | Dashboard | KPI cards, activity feed, system status |
| `/patients` | Patients | Patient list with live Supabase data |
| `/patients/new` | NewPatient | Multi-section registration (demographics, residency, address, contact) |
| `/patients/:id` | PatientDetail | Tabbed patient profile |
| `/schedule` | Schedule | Multi-provider weekly/day calendar with drag-and-drop |
| `/schedule/checkin/:id` | CheckIn | 4-step check-in: arrival → insurance → encounter → route |
| `/insurance` | Insurance | Primary/secondary/tertiary coverage management |
| `/encounters` | Encounters | Encounter list (stub — Sprint 3) |
| `/billing` | Billing | Billing module (stub — Sprint 4) |
| `/providers/new` | NewProvider | Provider registration with smart address |
| `/facilities/new` | NewFacility | Facility registration |
| `/settings` | Settings | Admin link + system settings (stub) |

### Admin Portal

| Route | Component | Access |
|---|---|---|
| `/admin/login` | AdminLogin | All roles |
| `/admin/mfa-setup` | MfaSetup | All roles (required on first login) |
| `/admin` | AdminOverview | All roles |
| `/admin/users` | UserManagement | admin, super_admin |
| `/admin/facilities` | AdminFacilities | super_admin only |
| `/admin/appt-types` | AppointmentTypes | admin, super_admin |
| `/admin/roles` | AdminRoles | super_admin only |
| `/admin/audit` | AdminAudit | admin, super_admin |
| `/admin/settings` | AdminSettings | super_admin only |

### Patient-Facing (no auth)

| Route | Description |
|---|---|
| `/intake?token=<token>` | AI intake form (48h tokenized link) |

---

## Appointment Types + CPT Mapping

23 appointment types seeded. Each maps to:
- `primary_cpt_code` — auto-populates superbill on encounter close
- `additional_cpt_codes` — add-on codes (e.g. 90833 with E&M)
- `default_icd_codes` — pre-fill diagnosis fields
- `default_fee` — starting fee for billing
- `default_pos_code` — Place of Service (11=Office, 02=Telehealth, 24=ASC)
- `duration_mins` — calendar slot sizing
- `color` — calendar display color

---

## Code Reference Tables

| Table | Count | Coverage |
|---|---|---|
| `terms.cpt_codes` | 114 | E&M (99201–99215), Psychiatry/Psychology, Plastic Surgery, Injections, Labs, Radiology |
| `terms.icd10_codes` | 95 | Cardiovascular, Endocrine, Mental Health, MSK, Respiratory, Plastic Surgery, Preventive |
| `terms.dsm5_codes` | 46 | Depressive, Anxiety, Trauma, Bipolar, Schizophrenia, OCD, Eating, Personality, ADHD, Substance Use |
| `terms.cpt_modifiers` | 26 | 25, 26, TC, 59, GT, 95, GQ, bilateral, laterality, mental health, therapy, surgical |

Full-text search functions: `terms.search_cpt()`, `terms.search_icd10()`, `terms.search_dsm5()`

---

## International Patient Support

- 16 countries with correct phone format, postal label, state/province label, tax ID type
- ZIP lookup via `api.zippopotam.us` → auto-fills city + state/province
- Phone formatting per country as you type
- Tax ID: SSN (US), ITIN, EIN, NIT (Colombia), RFC (Mexico), CPF (Brazil), RIF (Venezuela), etc.
- Passport number + country for non-US residents
- US Resident toggle changes form fields, tax ID options, insurance requirements

---

## Communications Infrastructure (configured, not yet active)

Email (Resend) and SMS (Twilio) are architected and logged via `cr.communications_log`. API keys stored in `saas.config`. Edge functions queue messages; delivery requires Resend and Twilio account setup.

### Message Types

| Type | Channel | Trigger |
|---|---|---|
| `confirmation` | Email + SMS | Appointment booked |
| `reminder_24h` | Email + SMS | 24 hours before |
| `reminder_2h` | SMS | 2 hours before |
| `noshow_risk` | Internal | Risk score ≥ 7 |
| `wait_apology` | SMS | Wait time > 20 min |
| `intake_link` | Email | 48h before visit |
| `billing_statement` | Email | Invoice created |

---

## Security

- Supabase Row Level Security on all `cr.*` and `saas.*` tables
- org_id isolation — practices cannot see each other's data
- Module-gated access — Revela tables require `revela` module entitlement
- TOTP MFA required for admin/provider roles
- All auth events logged to `saas.auth_audit_log`
- HIPAA notice displayed on all admin pages
- `.env.local` excluded from git (anon key is public-safe by Supabase design)
- Service role key is only in Edge Functions (Supabase environment, never in frontend)

---

## Seed Data

| Entity | Count | Notes |
|---|---|---|
| Patients | 15 | 11 US, 4 international (Colombia, Venezuela, Brazil) |
| Providers | 8 | Plastic Surgery (2), Psychiatry (2), Psychology (2), Family Med (2) |
| Facilities | 4 | Main Clinic, Behavioral Health, Plastic Surgery Center, Telehealth |
| Appointments | 15 | 8 today, 4 tomorrow, 3 past completed |
| Encounters | 4 | 3 closed with superbills, 1 open |
| Insurance records | 12 | Primary/secondary, Aetna, BCBS, UHC, Medicare, Medicaid, self-pay |
| Insurance companies | 10 | Major US payers + self-pay |
| Users | 8 | super_admin (Wayne Hayes), admin, 3 providers, billing, 2 staff |
| Appointment types | 23 | E&M 1–5, psychiatry, psychology, plastic surgery, procedures |

---

## Sprint Completion

| Sprint | Status | Features |
|---|---|---|
| 1 | ✅ Complete | Patient registration, smart address (US+intl), photo upload, HUD design system |
| 2 | ✅ Complete | Admin portal, RBAC, MFA/TOTP, appointment types + CPT, calendar, check-in, insurance, encounter routing |
| 3 | ✅ Complete | AI features: no-show prediction, wait time tracking, smart scheduling, intake assistant, billing AI |
| 4 | 🔲 Next | Email/SMS confirmations (Resend + Twilio), billing module, A/R aging |
| 5 | 🔲 Planned | Patient portal, full analytics dashboard, provider performance reports |
| 6 | 🔲 Planned | Revela integration finalization, Mental Health integration finalization |

---

## PatientTracForge Platform Map

```
patienttracforge.com          ← This repo (scheduling foundation)
revela.patienttracforge.com   ← Plastic surgery clinical module
mentalhealth.patienttracforge.com ← Behavioral health module
[future].patienttracforge.com ← Cardiology, Ortho, Addiction Medicine...

All apps share:
  - Same Supabase project (mskormozwekezjmtcylv)
  - Same cr.* + saas.* schemas
  - encounter_id as cross-app key
  - org_id RLS for tenant isolation
```

---

*PatientTracForge — Built by PatientTrac Corp · HIPAA Compliant · v0.3.0*
