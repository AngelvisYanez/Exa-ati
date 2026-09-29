# OFSERCONT IA — Operar el negocio y cumplir con el SRI

## Product

Product suite for Ecuadorian **entrepreneurs** and **accountants / small firms** who manage 1–5 businesses. Core jobs: issue and organize electronic documents, track receivables, run day-to-day ops — and, on higher plans, sync with SRI, prepare ATS/declarations, and keep books.

## Audience

Two primary personas:

1. **Emprendedor** — one business; needs invoicing, collections, inventory/POS, and simple AI help. Does **not** need to file SRI declarations in-app.
2. **Contador / Despacho** — manages 1–5 client RUCs; needs SRI sync, tax control, ATS, and accounting workflows.

## Subscription plans

| Plan | Max empresas (RUCs) | Opens |
|------|---------------------|--------|
| Emprendedor | 1 | Emitir, documentos, CxC/CxP, inventario, POS, chat |
| Contador | 3 | + sync SRI, declaraciones/ATS, control tributario, contabilidad |
| Despacho | 5 | + nómina, auditoría IA, admin de equipo |

Effective access = role modules ∩ plan modules. See `docs/PLAN_SUBSCRIPTION_UX.md` and `src/lib/plans.ts`.

## Brand

- **Name:** OFSERCONT IA (branded as EXA-ATI)
- **Lane:** Product (Operate mode — design serves the task)
- **Tone:** Professional, trustworthy, efficient. Money and compliance require clarity, not decoration. For entrepreneurs, lead with “ventas y cobros”; for accountants, lead with “cumplimiento y sync”.
- **Visual system:** Clean, restrained, data-dense. Cards, tables, charts, and forms are the primary surfaces. Color is used sparingly for state (success/warning/error) and brand accent (burgundy red #a02525).
- **Anti-references:** Over-decorated fintech dashboards, dark mode as default, purple/blue gradient accents, glassmorphism, card-nested-in-card layouts.

## Design constraints

- Operate mode: users are in a task. Familiarity and consistency matter more than surprise.
- Light theme only (Ecuadorian offices are brightly lit; dark mode is not the primary use scene).
- Data density is a feature for Contador/Despacho; Emprendedor surfaces stay simpler (fewer nav groups, business KPIs first).
- Motion at 150–250ms, state-driven only (no orchestrated page-load sequences).
- Typography: one sans family (DM Sans), fixed rem scale, tight ratio (1.125). Mono for RUC/claves: DM Mono.
- Navigation and dashboard must reflect the active plan — never show locked SRI/declaration modules as if available.
