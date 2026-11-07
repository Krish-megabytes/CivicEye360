# CivicEye 360

A civic issue reporting and response application for residents, municipal administrators and field teams. The codebase is a full-stack TypeScript app: React/Vite client, Express REST API and MongoDB/Mongoose persistence.

## What is implemented

- Secure cookie-based session auth, password hashing, role/permission checks on server routes, ownership and department scope.
- Report creation with location, category, optional validated image, AI advisory classification/fallback, duplicate hints, unguessable guest tracking code and persisted reference.
- Citizen report lists/details, citizen-visible history and comments, feedback, follow-up image and staff-reviewed reopening requests.
- Admin overview and server-derived analytics, report queue/detail operations, assignment, category/priority/status updates, notes, audit records, CSV export and map-point APIs.
- Field staff tasks, work notes, evidence upload and resolution summaries.
- In-app notification records/read state, profile editing, password change and notification preferences.
- Public information pages and secure guest report tracking (reference + tracking code).
- Seed fixtures are fictional and visibly labelled as development data; seed refuses production by default.

The remaining administration configuration areas (categories/departments/users/routing/SLA CRUD) are available through the backend API but are not all represented by a dedicated client management UI yet. Map visualization uses OpenStreetMap/Leaflet; check the provider’s terms and availability before operating publicly. SMTP and OpenAI are optional. Without those providers, explicit development fallbacks are used; AI fallbacks are rules-based, not model responses.

## Requirements

- Node.js `>=20.19` (Vite 8 and the workspace toolchain require modern Node).
- npm.
- A MongoDB server. For local development, `npm run dev` starts a project-local MongoDB binary and stores data in `.data/mongo`; alternatively run MongoDB yourself and set `MONGODB_URI`.

## Setup

```sh
npm install
cp .env.example .env
```

Set `JWT_SECRET` to a random value with at least 32 characters. For a local start, `npm run dev` launches MongoDB, API (`http://127.0.0.1:4000`) and web client (`http://127.0.0.1:5199`). The first local MongoDB run may download its binary; no hosted database account is required.

To run against an existing MongoDB, set `MONGODB_URI`, then start the processes individually:

```sh
npm run dev:server
npm run dev:client
```

The frontend proxies `/api` to `127.0.0.1:4000`. The API waits up to 60 seconds for MongoDB when it boots, so a cold start where mongod is still coming up does not crash the server. If a MongoDB instance is already listening on `MONGO_DEV_PORT` (default `27017`), `npm run dev:mongo` reuses it instead of failing, so a leftover dev session no longer blocks `npm run dev`.

Connection state is part of the health check: `curl http://127.0.0.1:4000/api/health` reports `"database":"connected"` once Mongoose is attached.

## Seed/demo accounts

Start MongoDB and the API, then in another terminal run:

```sh
npm run seed
```

The safe seed refuses to replace existing reports. `npm run seed:reset` deletes application collections and recreates fictional records; **only run it against disposable development data**. It does not target production unless someone explicitly sets `ALLOW_DEMO_SEED=true` (do not do that for a real database).

All demo users use the same development-only password printed by the seed script. Accounts include `admin@civiceye.local`, `city.admin@civiceye.local`, `roads.manager@civiceye.local`, `field.ali@civiceye.local`, `field.jo@civiceye.local`, and `citizen@civiceye.local`. Replace/remove demo users and change credentials before any real deployment. The demo credentials are not production-safe.

## Environment variables

See [.env.example](.env.example) for the authoritative template.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test` or `production` |
| `PORT` | Express API port (default 4000) |
| `CLIENT_ORIGIN` | Allowed client origin(s), comma-separated |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Session signing secret; required (32+ chars) in production; dev can use an ephemeral secret |
| `SESSION_TTL_HOURS` | Session lifetime |
| `COOKIE_SECURE` | Set true for HTTPS; production forces secure cookies |
| `OPENAI_API_KEY` | Optional server-only OpenAI key; otherwise rules-based category/summarization fallback |
| `OPENAI_MODEL` | OpenAI model name |
| `AI_TIMEOUT_MS` | AI request timeout |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | Optional SMTP; without host, email is reported as unconfigured and reset links are development-only |
| `UPLOAD_DIR` | Local attachment storage directory |
| `MAX_UPLOAD_MB` | Upload size limit |
| `LOG_LEVEL` | Structured logger level |
| `RATE_LIMIT_DISABLED` | Development/test escape hatch; never disable for public production |
| `VITE_API_URL` | Optional client API base (default `/api`) |
| `VITE_MAP_ENABLED` | Set `false` to suppress Leaflet maps |
| `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION` | Map tile endpoint and attribution |

Never put API keys in client `VITE_` variables. OpenAI and SMTP settings are server-side only. Use a production secret manager, HTTPS, managed MongoDB credentials with least privilege, backups and a defined retention policy.

## Commands

```sh
npm run dev            # local MongoDB + API + Vite client
npm run dev:server      # API only
npm run dev:client      # client only
npm run seed            # seed if app collections are empty
npm run seed:reset      # reset disposable app data and reseed
npm run typecheck       # TypeScript checks for server and client
npm test                # server and client tests
npm run build           # compile API and production client
npm start               # start compiled API (serve client separately/reverse proxy)
npm run lint            # TypeScript checks (current lint script)
npm run format          # Prettier sources and Markdown
```

## API and security notes

API endpoints are under `/api`. See the route modules in `server/src/routes`. All report access is checked on the server; staff visibility derives from role and department membership. Guest tracking requires both a reference and a code and returns only citizen-visible data. Attachments are authenticated and visibility-scoped. Uploads are limited and validated. Status changes and assignments produce history/audit records; rejected, closed and reopening transitions are reasoned and server-validated. AI suggestions are advisory only.

Password reset delivery depends on SMTP. In development without SMTP, the API exposes a development-only reset URL; do not use this mode in a production environment. Email delivery is not configured merely by setting user preferences.

## Verification

Current automated checks:

- Server: 41 tests across auth, report ownership/workflow, admin analytics and unit utilities.
- Client: 2 tests verifying secure tracking form requirements and no pre-verification disclosure.
- TypeScript checks and production builds for both workspaces.

MongoDB integration tests use `mongodb-memory-server`; this environment may print a system binary version warning when it falls back to an installed MongoDB 7.0 binary. Tests passed with that fallback. The production client build currently warns that its combined JS bundle exceeds Vite’s 500 kB advisory threshold; code splitting can be added as the product surface grows.

## Operational readiness

This is a runnable development/pilot foundation, not a claim of production certification. Before public launch: conduct security review and penetration testing; configure a managed MongoDB/secret manager/SMTP; review the draft privacy and terms copy with counsel; finalize retention, moderation, emergency and service-level policies; verify map tile licensing; remove demo data/accounts; validate backups, monitoring, rate limits and upload storage; and test account isolation with deployment-specific configuration.
