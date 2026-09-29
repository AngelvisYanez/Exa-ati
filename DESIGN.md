# DESIGN.md — OFSERCONT IA / EXA-ATI

Generated for Impeccable Operate mode. Source of truth alongside `PRODUCT.md` and `src/app/globals.css`.

## Mode

**Operate** — task-first product UI. Clarity and density over marketing expression.

## Visual identity

| Token | Value | Use |
|-------|-------|-----|
| Brand accent | `#a02525` (`brand-red`) | Primary CTAs, active nav, focus |
| Neutrals | `brand-gray-*` | Text, borders, surfaces |
| Success / warning | semantic greens / ambers | Status only |
| Surface | White / light gray | Cards and tables on light office lighting |
| Radius | ~8–12px (`rounded-lg` / `rounded-xl`) | Controls and panels |
| Shadow | `shadow-2xs` / `shadow-sm` | Subtle elevation only |

**Do not use:** purple/indigo gradients, glassmorphism, dark mode as default, nested cards, decorative glow.

## Typography

- UI: **DM Sans** (sans)
- Mono (RUC, claves): **DM Mono**
- Scale: tight ~1.125 ratio; page titles ~base–lg semibold; labels 10–12px uppercase for section eyebrows

## Layout patterns

- App shell: `Sidebar` + `Topbar` + content (`ui-page` padding)
- Prefer shared primitives: `PageHeader`, `EmptyState`, `Button`, `Input`, `StatusBadge`, `KpiCard`
- One H1 per page (`PageHeader`); Topbar title = context/breadcrumb, avoid duplicating the same string as a second H1
- Tables are first-class; empty states explain the next action

## Navigation by plan

| Plan | Nav emphasis |
|------|----------------|
| Emprendedor | Dashboard, Emitir, Documentos, Contactos, CxC/CxP, Inventario/POS, Chat, Config |
| Contador | + Contabilidad, Control tributario, Declaraciones, eCommerce/Guías |
| Despacho | + Nómina, Auditoría IA, Admin roles/usuarios |

Hidden modules must not appear as dead links. Upgrade copy when a cupo or module is blocked.

## Motion

150–250ms, state-driven (hover, open, active). No orchestrated page-load choreography.

## Components checklist (ola 1+)

- [x] Filter featured modules by `hasModule` / plan
- [x] Logout via `AuthContext.logout` everywhere
- [ ] Adopt `PageHeader` on remaining hub pages
- [ ] BottomNav: Emitir for Emprendedor
- [ ] Plan badge in Topbar user menu
