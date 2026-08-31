# Feature Flag Admin Panel

TypeScript admin panel for managing feature flags in Postgres: create flags, toggle them,
set percentage rollouts, delete them, and review an audit trail of every change.

- **API**: Express + `pg`, request validation with zod
- **UI**: React + Vite single page app
- **Storage**: any Postgres instance reachable via `DATABASE_URL`

## Setup

```bash
npm install
cp .env.example .env   # then point DATABASE_URL at your Postgres
npm run migrate        # creates feature_flags + feature_flag_audit
npm run dev            # API on :3001, UI on http://localhost:5173
```

`npm run dev` starts the API and the Vite dev server together; the dev server proxies `/api` to the API.
The API also applies the schema on startup, so `npm run migrate` is only needed if you want to
create the tables ahead of time.

Requires Postgres 13+ (uses `gen_random_uuid()` from the built-in `pgcrypto`/core functions).
Set `PGSSLMODE=require` for managed instances that enforce TLS.

## Production build

```bash
npm run build
npm start              # serves the API and the built UI from :3001
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness plus a Postgres connectivity check |
| `GET` | `/api/flags` | List all flags |
| `POST` | `/api/flags` | Create a flag (`key`, `description`, `enabled`, `rolloutPercentage`) |
| `PATCH` | `/api/flags/:key` | Update description / enabled / rollout |
| `DELETE` | `/api/flags/:key` | Delete a flag |
| `GET` | `/api/flags/:key/evaluate?subject=<id>` | Evaluate a flag for a subject |
| `GET` | `/api/audit?flagKey=&limit=` | Recent audit entries |

Mutating requests may set an `X-Actor` header; it is stored on the audit entry
(defaults to `admin-panel`).

Evaluation is deterministic: a subject is bucketed by `sha1(flagKey:subject) % 100` and is
included when that bucket is below the flag's rollout percentage, so the same subject always
gets the same answer for a given flag and rollout.

## Schema

`src/server/schema.sql` is the single source of truth and is idempotent (`CREATE TABLE IF NOT EXISTS`).
