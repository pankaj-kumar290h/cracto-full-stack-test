# Release checklist

A single-page app using React, Node.js/Express, GraphQL, and PostgreSQL. Create and delete releases, toggle eight fixed steps, and edit additional information. Status is calculated from completed steps: none → planned, some → ongoing, all → done. No user accounts.

## Run with Docker

```sh
docker compose up --build -d
```

Open **http://localhost:4000**. The container creates the database table before starting. Database data is kept in a named volume; `docker compose down` preserves it.

## Local development

Requires Node.js 22.12+ and Docker (or your own PostgreSQL database).

```sh
npm ci
cp .env.example .env
docker compose up db -d
npm run db:migrate
```

Run `npm run dev:api` and `npm run dev` in separate terminals. Open **http://localhost:5173**. Vite forwards GraphQL requests to Express on port 4000. PostgreSQL is exposed on host port **5433**; containers use `db:5432`.

```sh
npm test       # Domain, pagination, resolver, and GraphQL demand-control tests
npm run build  # Type-check and build frontend/backend
npm start      # Serve the production app on port 4000
```

## API

- `POST /graphql`: JSON body containing `query` and optional `variables` and `operationName`.
- `GET /`: production SPA.

| GraphQL operation | Arguments |
| --- | --- |
| Query `releases` | `first` (default 25, maximum 100), `after` cursor; returns `nodes`, `endCursor`, `hasNextPage` |
| Query `release` | `id`; returns one release with notes and steps |
| Mutation `createRelease` | `input: { name, dueAt, additionalInfo? }` |
| Mutation `setReleaseStep` | `id`, `stepId`, `completed` |
| Mutation `updateReleaseInfo` | `id`, `additionalInfo` (null/empty clears it) |
| Mutation `deleteRelease` | `id` |

```sh
curl http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ releases(first: 25) { nodes { id name dueAt status } endCursor hasNextPage } }"}'
```

Dates are ISO 8601 strings with a timezone, for example `2026-11-01T12:00:00Z`. The browser converts local input to UTC. Names are required (1–200 characters); notes are optional (up to 10,000 characters).

## Database schema

Defined in `server/database.sql`. Setup creates missing tables and indexes without deleting existing releases.

| `releases` column | Type |
| --- | --- |
| `id` | UUID primary key |
| `name` | TEXT NOT NULL |
| `due_at` | TIMESTAMPTZ NOT NULL |
| `additional_info` | TEXT, nullable |
| `completed_step_ids` | TEXT[] NOT NULL, default empty array |
| `created_at` | TIMESTAMPTZ NOT NULL, default now |
| `updated_at` | TIMESTAMPTZ NOT NULL, default now |

An index on `(due_at, id)` supports listing. Step definitions live in `shared/release.ts`; there is no steps table or stored status field.

For hosted PostgreSQL, set `DATABASE_URL` to the provider's TLS-enabled connection string. With Compose, use `DOCKER_DATABASE_URL` instead. Hosted infrastructure has not been provisioned.

## Performance

The list uses cursor pagination over the existing `(due_at, id)` index. Notes and checklist steps load only when a release is selected. Details are cached in the browser for 30 seconds, with at most 50 entries. Mutations update the current list and detail cache; create/delete refresh the current page to keep page boundaries correct. Newly created releases remain selectable even when they sort outside the first page.

**API change:** `releases` now returns a page object rather than an array. Deploy the frontend and backend together and update external clients. The historical load-test query in `PERFORMANCE_TEST_RESULTS.md` must be updated to the new list query before retesting. A selected release adds a separate detail request.

Database settings are documented in `.env.example`: `DB_POOL_MAX` (10), `DB_CONNECT_TIMEOUT_MS` (3000), `DB_IDLE_TIMEOUT_MS` (30000), and `DB_STATEMENT_TIMEOUT_MS` (5000). Budget total connections across replicas. Pass overrides through your deployment environment; Compose does not automatically forward these settings from `.env` into its app container.

GraphQL requests are limited to 2,000 tokens, 200 expanded field selections, five root field selections, and 12 nested field levels. Invalid operations are rejected before execution. GraphQL responses are not HTTP-cached. Hashed build assets receive one-year immutable caching; HTML revalidates. The deployed proxy already provides Brotli compression.

Set `PERF_LOGGING=true` to emit structured GraphQL request and database-call timings plus pool counts. Database-call duration includes acquiring a pooled connection. Responses also expose GraphQL execution duration via `Server-Timing`. Query variables and notes are not logged by this instrumentation. Client requests time out after 10 seconds and obsolete page/detail reads are cancelled.

See [PERFORMANCE_FIXES.md](./PERFORMANCE_FIXES.md) for changes and validation scope, and [PERFORMANCE_TEST_RESULTS.md](./PERFORMANCE_TEST_RESULTS.md) for the pre-optimization measurements.
