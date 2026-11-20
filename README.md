# DealerFlow · Vehicle Management System

A fictional multi-branch dealership demonstration built with React, TypeScript, Vite, Tailwind, Express and PostgreSQL. This is not a production ERP, accounting system or regulatory verification service.

## Setup

Requires Node.js 22.12+ and PostgreSQL 14+. Current package versions are pinned in package-lock.json. No other application database is supported.

```sh
npm ci
cp .env.example .env
# Supply DATABASE_URL, a separate TEST_DATABASE_URL, and a strong DEMO_PASSWORD.
npm run db:migrate
npm run db:seed
npm run dev
```

For local PostgreSQL with Docker, set POSTGRES_USER and POSTGRES_PASSWORD and run `docker compose up -d`. Create a separate database ending in `_test` with the same owner for tests. The approved sandbox provisioner `npm run db:provision` creates private PostgreSQL data under ignored `.data/postgres`, app/test databases and a mode-0600 `.env` with random credentials. It requires PostgreSQL binaries and passwordless sudo for the local postgres account; it refuses an external DATABASE_URL.

The explicit fictional seed creates `admin@dealerflow.demo`, `sales@dealerflow.demo`, `inventory@dealerflow.demo` and `manager@dealerflow.demo`. Their initial password is the private DEMO_PASSWORD supplied in `.env`; it is never committed or printed. Rotate/remove demo accounts before any real use. Seed never runs on app startup. Rerunning a completed seed preserves existing records. An interrupted seed must be investigated; it does not reset data automatically.

The preview contract is `.revolte/preview.json`. In a managed session start only with `revolte-preview ensure --wait`; the frontend listens on port 4173 and proxies `/api` to port 4174. Production serves the built SPA from Express on API_PORT. `.env` and private document/database bytes are ignored and must not be committed.

## Commands

```sh
npm run format
npm run typecheck
npm run lint
npm test
npm run build
# Production after migrations, with production environment and injected DATABASE_URL:
NODE_ENV=production API_PORT=4173 npm start
```

The test runner refuses the application database and requires TEST_DATABASE_URL to name a distinct database ending in `_test`. Tests recreate only their own dealerflow_test_suite schema in that isolated database. Never point it at data you need. Files used by tests are isolated under `.data/test-documents`.

## Workflows and authorization

All authenticated employees have operational read access across branches. Sales/Admin manage customers, VIN bookings, payment requests and uploads; Inventory/Admin manage models and uncommitted stock; Manager/Admin settle requests, review documents and complete deliveries. Presets and branch filters do not change authorization.

Session tokens expire after ten hours, are hashed in PostgreSQL and retained only in browser sessionStorage for reload continuity. Logout invalidates the server session and clears frontend data. Layout metadata alone uses versioned employee/role/preset-scoped localStorage.

Money is exact integer paise, serialized as strings. Pending requests reserve payment capacity but are not collected cash. The invoice is an immutable snapshot, not recognized revenue. Delivery requires a reserved VIN, zero outstanding and latest verified Identity and Address documents. Insurance/Registration are optional.

## Documentation and evidence

Setup, the API reference, walkthrough and requirement traceability are consolidated below. New standalone Markdown documents were blocked by this session's file tool. Generated verification exports are kept in `.revolte/artifacts/`, not committed.

There was no legacy application/database in this repository. Consequently there are no existing transactions or legacy URLs to migrate; supplied operational API nouns and `/overview` are supported. CSV bulk import, external payments, OEM integrations and compliance verification are intentionally excluded.

## API reference

All endpoints begin `/api`. Except `/health` and `/auth/login`, send the session token in the Authorization Bearer header. UUID IDs, UTC ISO timestamps, exact decimal integer paise strings. JSON errors are `{error:{message,fields?}}`; codes are 401 absent/expired session, 403 role forbidden, 404 absent, 409 state conflict/duplicate, 413 oversized, 422 invalid and 500 safe unexpected failure.

| Verb        | Route                                      | Input / result                                                                           |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| POST        | /auth/login                                | email,password → token,employee; 10-hour session                                         |
| GET / POST  | /auth/me / /auth/logout                    | Current employee / invalidate token                                                      |
| GET         | /health                                    | Actual PostgreSQL readiness; 503 if unavailable                                          |
| GET         | /branches, /employees                      | Bounded active lookup lists; no password fields                                          |
| GET / POST  | /models                                    | Paginated list / brand,name,variant,fuel,transmission,base_price_paise,image_key,active? |
| GET / PATCH | /models/:id                                | Detail / full mutable model fields; never reprices existing order                        |
| GET / POST  | /vehicles                                  | List / vin,model_id,branch_id,color,status=available or in_transit                       |
| GET / PATCH | /vehicles/:id                              | Detail with bookings / edit only uncommitted stock                                       |
| GET / POST  | /customers                                 | List / name,phone,email?,address?                                                        |
| GET / PATCH | /customers/:id                             | Detail with bookings/orders / basic contact fields                                       |
| GET / POST  | /bookings                                  | List / customer_id,vehicle_id,notes?,booked_at?; salesperson from session                |
| GET         | /bookings/:id                              | Booking with VIN/model/customer/branch/order links                                       |
| POST        | /bookings/:id/cancel                       | Empty object; confirmed/unconverted only, releases VIN                                   |
| POST        | /bookings/:id/convert                      | extras_paise?,tax_paise? → one immutable order and invoice                               |
| GET         | /orders, /orders/:id                       | List / complete facts, immutable snapshot, payments/docs/readiness                       |
| GET         | /orders/:id/invoice                        | Protected JSON for browser-printable React /orders/:id/invoice                           |
| GET / POST  | /orders/:id/payments                       | Bounded list / amount_paise; reserves unpaid capacity                                    |
| POST        | /orders/:id/payments/:paymentId/settle     | Pending request once, Manager/Admin                                                      |
| GET / POST  | /orders/:id/documents                      | Metadata / multipart category,file; PDF/JPEG/PNG up to 4 MiB                             |
| GET         | /orders/:id/documents/:documentId/download | Authenticated attachment, no token URLs                                                  |
| POST        | /orders/:id/documents/:documentId/review   | status=verified/rejected,reason?; rejection reason required                              |
| POST        | /orders/:id/deliver                        | Empty object; atomically Delivered/Sold when gate passes                                 |
| GET         | /dashboard                                 | Operational summary alias                                                                |
| GET         | /analytics/summary                         | Six KPIs, secondary blockers/status counts, definitions                                  |
| GET         | /analytics/stock                           | Complete stock distributions, branch/model aggregates                                    |
| GET         | /analytics/exceptions                      | Paginated deterministic action reasons and priorities                                    |
| GET         | /analytics/trends                          | Actual zero-filled day buckets; max 366 days                                             |
| GET         | /analytics/records                         | Exact metric drilldown records and totals                                                |
| GET         | /analytics/journeys/:orderId               | Authorized bounded order/VIN/payment/document lineage                                    |
| GET         | /analytics/search                          | Min 2 characters, max 5 per entity group                                                 |
| GET         | /analytics/activity                        | Eight derived order/delivery events, not complete audit history                          |

Lists return items,total,page,limit. Default page 1 and limit 20; maximum limit 100. q max 120 characters; sort allowlist created_at/name/vin/status/total_paise, direction asc/desc. Stock supports VIN/model/brand/variant/branch/status/color/fuel/transmission filters. Analytics supports branch_id/model_id and period=today/7d/30d/custom/all; custom start/end are inclusive local dates converted to UTC [start,end), max 366 days. All-time trend charts explicitly show the last 30 days. Current stock/open blockers are snapshots, not historical counts. Payments use paid_at. Metric keys are available,active_bookings,open_orders,payments,outstanding,ready,in_transit,delivered,payment,documents,combined,pending,aged. Event drilldowns explicitly pass event=bookings/orders/payments/deliveries. Metadata includes asOf,timezone,effectiveFilters,units,calculationVersion,historyNote,window. Parent histories are bounded to 100.

## Demo walkthrough

1. Inventory/Admin: create a model and an Available VIN, or choose seeded stock.
2. Sales/Admin: create a customer, select one available VIN in Add booking and reserve. Branch/model derive from the VIN and the employee is the salesperson.
3. Convert the booking with explicit non-negative demo extras/tax; inspect the immutable invoice and use Print → Save as PDF.
4. Sales/Admin creates a full payment request. Manager/Admin settles it. Pending does not count as paid.
5. Sales/Admin uploads real supported Identity and Address files; Manager/Admin verifies them. Rejection or a new pending replacement blocks readiness.
6. Manager/Admin confirms delivery. Order becomes Delivered, VIN Sold, and KPIs refresh from the server.
7. Executive: filter branches/models/event dates, inspect KPI definitions/drilldowns, resolve an Action Center blocker through the source order, inspect a VIN journey, compare branches and actual trends.
8. Switch presets; Customize with drag handles or Move up/down, resize/hide, Save/reload, Cancel or Reset. Permissions do not change.

## Deployment and recovery

The Dockerfile builds Vite and serves the SPA through Express (one production HTTP entrypoint). Inject DATABASE_URL and persistent DOCUMENT_ROOT; run migrations as a controlled release job before starting. Seed only explicitly. Local sandbox PostgreSQL uses ssl:false on loopback; remote PostgreSQL requires a private network or certificate-verifying TLS tunnel/proxy. Remote connectivity/TLS is not proven by a local test. Backup PostgreSQL and private document bytes consistently, test restore to a separate environment, then migrate. If schema rollback is unsafe, restore to a new database and cut over after validation; never overwrite the main DB silently.

`revolte.yml` is a template, not deployment evidence. Assumed project/app names are DealerFlow/dealerflow. qa/staging branch existence, platform validation, secret injection, database network/TLS and persistent document volume mapping require deployment access. The session preview requires 4173–4273; if the deployment platform requires 8080, change API_PORT, EXPOSE and deployment port together, not the session preview contract. Do not enable multiple app replicas with container-local documents: provision shared durable private storage first. The production scaling declaration does not prove shared storage exists.

Showcase requires a different SHOWCASE_DATABASE_URL containing showcase in its database name, created before invoking db:showcase. The main DB is never reset. Interrupted seed needs investigation and intentionally does not auto-reset. No legacy data conversion is necessary for this initially empty repository.

## Requirement traceability

Source paths below are relative to apps/api/src or apps/web/src unless prefixed scripts/. Stable test titles are in API workflow.test.ts and UI dashboard/layout.test.tsx. Source implementation is not proof of a passed release gate; actual command evidence is reported separately.

| FR ID       | Source                               | Test/evidence                                     | Unverified boundary                    |
| ----------- | ------------------------------------ | ------------------------------------------------- | -------------------------------------- |
| FR-OPS-001  | lib/auth.ts, app.ts; login/main      | Auth/role/logout tests                            | Enterprise identity excluded           |
| FR-OPS-010  | stock.ts; resource-form/list/detail  | Persistent models; invoice immutability           | Browser interaction                    |
| FR-OPS-020  | SQL schema; stock.ts; inventory      | Unique VIN/concurrent reservation/committed edit  | Visual review                          |
| FR-OPS-030  | customerSchema; customer screens     | Normalized phone/create/edit                      | Browser interaction                    |
| FR-OPS-040  | stock.ts; booking screens            | Reservation concurrency/cancel/converted conflict | Full UI smoke                          |
| FR-OPS-050  | orders.ts; order-detail              | Convert once/forged totals/immutable snapshot     | Full UI smoke                          |
| FR-OPS-060  | invoice.tsx; SQL immutable triggers  | Snapshot amount assertion                         | Actual Print/PDF                       |
| FR-OPS-070  | orders.ts; payments.tsx              | Capacity concurrency/pending/double settlement    | Real gateway excluded                  |
| FR-OPS-080  | documents.ts; documents.tsx          | Size/signature/auth/rejection/replacement         | Storage fault/ACL injection            |
| FR-OPS-090  | order_facts; orders.ts               | Premature/concurrent delivery/Sold rebooking      | Full UI smoke                          |
| FR-OPS-100  | scripts/seed.ts/showcase.ts          | Explicit seed and DB command evidence             | Interrupted-seed recovery              |
| FR-CC-001   | theme/shell/dashboard                | Static structure/build                            | Visual density and contrast            |
| FR-CC-002   | Select; context-bar                  | Label/one-chevron/padding test                    | Breakpoint/zoom screenshots            |
| FR-CC-010   | context-bar; businessWindow          | Kolkata half-open date test                       | Browser interaction                    |
| FR-CC-020   | analytics.ts; kpis                   | Summary vs SQL/drilldown                          | Extended fixture/filter matrix         |
| FR-CC-030   | journey.tsx                          | Shared summary predicates                         | Visual connector/focus review          |
| FR-CC-040   | journey-drawer; Dialog               | Journey API read                                  | Real-browser focus trapping            |
| FR-CC-050   | exceptions; action-center            | Exceptions API read                               | Complete priority fixtures             |
| FR-CC-060   | stock/model-widget; vehicle manifest | Stock API; original local assets                  | Image render/CLS                       |
| FR-CC-070   | insights; trend/branch-widget        | Trend API/date tests                              | Chart/keyboard tooltips                |
| FR-CC-080   | insights; shell search               | Search/activity API                               | Debounce/cancel interaction            |
| FR-CC-090   | layout/customize/dashboard           | Save/Cancel/Reset/reload/corrupt/storage tests    | Real drag/touch                        |
| FR-CC-100   | State/Empty/Badge/Dialog             | Static states and component assertions            | Screen reader/stale isolation          |
| FR-DB-001   | db.ts; compose; preview              | Actual PostgreSQL tests/health                    | Remote deployment                      |
| FR-DB-002   | 001_initial.sql                      | FK/check/unique/transaction assertions            | No legacy IDs exist                    |
| FR-DB-003   | stock/orders/documents               | Parallel reservation/conversion/payments/delivery | Broader load testing                   |
| FR-DB-004   | scripts/migrate/provision            | Migration/seed/persistence commands               | External restore drill                 |
| FR-API-001  | routes.ts                            | Reads and mutation regressions                    | No prior API existed                   |
| FR-API-002  | analytics/insights                   | Analytics reads                                   | Extended metadata fixture assertions   |
| FR-API-003  | app.ts; contracts                    | 401/403/409/413/422/injection tests               | Broader fault injection                |
| FR-DATA-001 | scripts/seed/showcase                | Fictional dated fixture commands                  | Isolated showcase provision            |
| FR-DATA-002 | order_facts; analytics/lists         | Payment/readiness/drilldown/date assertions       | Full cross-filter matrix               |
| FR-QA-001   | workflow tests                       | Happy/rejection/concurrency/RBAC                  | Full real-API browser journey          |
| FR-QA-002   | component tests; UI source           | Layout/select/money/date/static review            | All screenshot/zoom gates              |
| FR-QA-003   | test isolation guard/config          | Format/types/lint/tests/build/HTTP evidence       | Docker/deploy/reconnect/storage faults |

## Outstanding browser release gates

No browser tooling is available in this session. Screenshot and interaction review remains required at 390×844, 768×1024, 1280×800 and 1440×900 at 100/125/200% zoom. Check long dropdown labels, right-aligned centered chevrons, menu edge clipping, desktop header grid, mobile filters, overflow, keyboard/Escape/focus return, accessible chart tables, real drag/touch, reduced motion, image fallbacks and the complete UI workflow including Print. Build or component tests cannot certify these visual gates. No screenshots or successful production deploy are fabricated.
