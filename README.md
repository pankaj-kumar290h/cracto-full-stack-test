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
npm test       # Two focused tests: status rules and required input validation
npm run build  # Type-check and build frontend/backend
npm start      # Serve the production app on port 4000
```

## API

- `POST /graphql`: JSON body containing `query` and optional `variables` and `operationName`.
- `GET /`: production SPA.

| GraphQL operation | Arguments |
| --- | --- |
| Query `releases` | None; returns every release sorted by due date |
| Mutation `createRelease` | `input: { name, dueAt, additionalInfo? }` |
| Mutation `setReleaseStep` | `id`, `stepId`, `completed` |
| Mutation `updateReleaseInfo` | `id`, `additionalInfo` (null/empty clears it) |
| Mutation `deleteRelease` | `id` |

```sh
curl http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ releases { id name dueAt status additionalInfo steps { id label completed } } }"}'
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
