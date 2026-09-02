# Feature Flag Admin Panel

TypeScript admin panel for managing feature flags in Postgres: create flags, toggle them,
set percentage rollouts, delete them, and review an audit trail of every change.

- **API**: Express + `pg`, request validation with zod
- **UI**: React + Vite single page app
- **Storage**: any Postgres 13+ instance reachable via `DATABASE_URL`

## Quickstart

Requires Node.js 20+ and a Postgres database.

```bash
git clone https://github.com/Benler123/power-apps.git
cd power-apps
npm install
cp .env.example .env
```

Open `.env` and set `DATABASE_URL` to your database, for example:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/feature_flags
```

Then start it:

```bash
npm run dev
```

Open **http://localhost:5173**. The tables are created automatically on first start.

That's it — create a flag with a key like `checkout.new-cart`, hit **Enable**, and use **Edit**
to lower its rollout percentage for a gradual release.

### No Postgres handy?

Any Postgres works. A throwaway local one:

```bash
docker run -d --name ffdb -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=feature_flags postgres:16
```

That matches the `DATABASE_URL` shown above. Remove it later with `docker rm -f ffdb`.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PORT` | no | `3001` | API port (the UI dev server proxies `/api` here) |
| `PGSSLMODE` | no | — | Connections are plaintext by default; set to `require` only for managed Postgres that enforces TLS |
| `FIREBASE_PROJECT_ID` | no | — | Enables Google sign-in enforcement on the API |
| `VITE_FIREBASE_API_KEY` | with auth | — | Firebase web API key (public client config) |
| `VITE_FIREBASE_AUTH_DOMAIN` | with auth | — | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | with auth | — | Firebase project ID |
| `ALLOWED_EMAIL_DOMAIN` | no | — | Only allow accounts on this domain, e.g. `example.com` |
| `ALLOWED_EMAILS` | no | — | Comma-separated allow-list, takes precedence over the domain |

### Google sign-in

Auth is off until you set the Firebase variables — the panel runs unauthenticated for local work.

1. In the [Firebase console](https://console.firebase.google.com), create a project, add a **Web app**,
   and copy the `apiKey`, `authDomain`, and `projectId` into `.env` as the `VITE_FIREBASE_*` values.
2. Enable **Authentication → Sign-in method → Google**.
3. Add the host you serve from (`localhost` is pre-authorized) under **Authentication → Settings → Authorized domains**.
4. Set `FIREBASE_PROJECT_ID` to the same project ID so the API rejects requests without a valid token.

The browser gets a Firebase ID token and sends it as `Authorization: Bearer <token>`. The API verifies it
against Google's public keys (no service-account key needed), requires a verified email that signed in
through the Google provider (tokens from any other Firebase provider are rejected), and records that
email as the actor in the audit log. Restrict who can get in with `ALLOWED_EMAIL_DOMAIN` or `ALLOWED_EMAILS`.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API on `:3001` + UI on `:5173` with hot reload |
| `npm run migrate` | Applies the schema (optional — `dev`/`start` do it too) |
| `npm run build` | Builds the API and the UI |
| `npm start` | Serves the API and the built UI from `:3001` |
| `npm run lint` / `npm run typecheck` | Lint and type check |

### Troubleshooting

- **`DATABASE_URL is not set`** — you skipped `cp .env.example .env`, or the file isn't in the repo root.
- **`ECONNREFUSED` on startup** — Postgres isn't running or the host/port in `DATABASE_URL` is wrong.
  Confirm the app's view of it with `curl localhost:3001/api/health`.
- **`password authentication failed`** — credentials in `DATABASE_URL` don't match the server.
- **UI loads but shows a request error** — the API isn't up; check the `api` output of `npm run dev`.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness plus a Postgres connectivity check (never authenticated) |
| `GET` | `/api/flags` | List all flags |
| `POST` | `/api/flags` | Create a flag (`key`, `description`, `enabled`, `rolloutPercentage`) |
| `PATCH` | `/api/flags/:key` | Update description / enabled / rollout |
| `DELETE` | `/api/flags/:key` | Delete a flag |
| `GET` | `/api/flags/:key/evaluate?subject=<id>` | Evaluate a flag for a subject |
| `GET` | `/api/audit?flagKey=&limit=` | Recent audit entries |

Every `/api` route except `/api/health` requires `Authorization: Bearer <firebase-id-token>` once
`FIREBASE_PROJECT_ID` is set.

Checking a flag from your own service:

```bash
curl 'http://localhost:3001/api/flags/checkout.new-cart/evaluate?subject=user-42'
# {"key":"checkout.new-cart","enabled":true,"reason":"rollout_included"}
```

Evaluation is deterministic: a subject is bucketed by `sha1(flagKey:subject) % 100` and is
included when that bucket is below the flag's rollout percentage, so the same subject always
gets the same answer for a given flag and rollout.

Mutating requests may set an `X-Actor` header; it is stored on the audit entry
(defaults to `admin-panel`).

## Schema

`src/server/schema.sql` is the single source of truth and is idempotent (`CREATE TABLE IF NOT EXISTS`).
