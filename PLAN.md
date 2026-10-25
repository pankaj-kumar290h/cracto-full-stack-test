# Release checklist application plan

## Goal and scope

Build a single-page release checklist application from [requirment.md](./requirment.md). Users can list, create, and delete releases, toggle checklist steps, and edit additional information. Release status is calculated automatically. No accounts, authentication flows, or user management are required.

The repository currently contains the requirements only. This document proposes the implementation; no application code exists yet.

## Proposed architecture

- **Frontend:** React, TypeScript, and Vite, with Apollo Client for GraphQL requests and plain CSS for a simple responsive interface.
- **Backend:** Node.js, TypeScript, and GraphQL Yoga, with Prisma for database access and migrations.
- **Database:** PostgreSQL. Use a local container for development and an online PostgreSQL instance for the deployed application.
- **Repository:** npm workspaces containing `apps/web`, `apps/api`, and `packages/shared`. Keep fixed step definitions and status calculation in the shared package.
- **Runtime:** A backend Dockerfile and root `docker-compose.yaml` provide the API and local database. Configure the frontend API URL and backend database connection through environment variables.

These choices are implementation defaults, not additional assignment requirements. Pin compatible package versions when scaffolding.

## Release model and status rules

Define eight fixed steps with stable identifiers: prepare changes, review code, pass automated tests, update documentation, prepare release notes, deploy to staging, verify staging, and deploy to production. All releases use this same checklist; there is no step management screen or database table for step definitions.

| Database field | PostgreSQL type | Rules |
| --- | --- | --- |
| `id` | UUID | Primary key, generated on creation |
| `name` | TEXT | Required; reject blank or whitespace-only values |
| `due_at` | TIMESTAMPTZ | Required valid date and time |
| `additional_info` | TEXT, nullable | Optional plain text |
| `completed_step_ids` | TEXT[] | Required, defaults to an empty array; only fixed step IDs are accepted |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Updated whenever the release changes |

Expose `status` as a computed GraphQL field rather than storing it:

- Zero completed steps: `planned`.
- Some, but fewer than eight, completed steps: `ongoing`.
- All eight completed steps: `done`.

Derive completed counts from unique valid step IDs. Unchecking a step must also recalculate status. Use UTC for persistence and API timestamps, display local time in the browser, and label the date input's timezone. Do not reject past dates unless the requirements change.

## GraphQL contract

Use `/graphql` as the frontend/backend API endpoint. Do not add a parallel REST release API.

| Operation | Purpose |
| --- | --- |
| `releases: [Release!]!` | List releases in a deterministic order, by due date and then ID |
| `release(id: ID!): Release` | Retrieve one release; return null when absent |
| `createRelease(input: CreateReleaseInput!): Release!` | Create a release with name, due date, optional information, and no completed steps |
| `setReleaseStep(id: ID!, stepId: ID!, completed: Boolean!): Release!` | Set one step's completion state and return the updated release |
| `updateReleaseInfo(id: ID!, additionalInfo: String): Release!` | Replace or clear additional information |
| `deleteRelease(id: ID!): ID!` | Delete a release and return its ID |

`Release` exposes its stored fields, computed `status`, and `steps`, each containing `id`, `label`, and `completed`. Use a `DateTime` scalar with ISO 8601 values and a status enum with `planned`, `ongoing`, and `done` values.

Validate inputs in the backend, including required fields, date parsing, and step IDs. Return consistent GraphQL error codes for invalid input, missing mutation targets, and unexpected failures. Do not expose database details in error messages. Step updates set an explicit boolean, making retries idempotent; update the stored array atomically to avoid losing concurrent changes to different steps.

## Interface and behavior

- Show a release list with name, due date, status, and completed-step count. Include an empty state and a prominent create action.
- Open a release detail view within the SPA, with its checklist, additional information editor, and delete action. Keep list summaries synchronized after successful mutations.
- Provide a creation form with a name, local date/time input, and optional additional information. Display field errors and preserve input after failures.
- Persist each checkbox change through GraphQL. Disable the affected control while saving and show a retryable error if saving fails.
- Save additional information explicitly, showing pending, success, and failure feedback.
- Confirm deletion using the release name, then remove the deleted release from the list and close its detail view.
- Support loading, empty, error, and saving states. Use keyboard-accessible controls, associated labels, visible focus states, and text labels alongside status colors.
- Use a compact desktop list/detail layout and a stacked mobile layout without horizontal scrolling.

Review the mockup before implementing layout: https://public-swap.s3.us-east-1.amazonaws.com/releasecheck.png. The image could not be retrieved during planning, so visual fidelity has not yet been assessed.

## Implementation phases

### 1. Scaffold and persistence

- Create the workspace structure, TypeScript configuration, development scripts, linting, and `.env.example` files.
- Add PostgreSQL configuration, the Prisma release model, and an initial committed migration.
- Define the fixed checklist and pure status calculation in the shared package.
- Add the backend Dockerfile and `docker-compose.yaml`, including a database health check and persistent volume. Provide an explicit migration command for local startup.

**Complete when:** a fresh checkout can start PostgreSQL and the API locally, apply migrations, and retain release data across container restarts.

### 2. GraphQL backend

- Implement the schema, resolvers, validation, and database access for all operations above.
- Implement atomic, idempotent step updates and computed release status.
- Configure environment-based CORS for the frontend and structured server logging.

**Complete when:** every required action works through GraphQL and invalid requests produce useful errors without corrupting persisted data.

### 3. Single-page frontend

- Build the release list, create form, release detail checklist, information editor, and delete confirmation.
- Connect GraphQL operations and synchronize client data after mutations.
- Add responsive CSS, accessibility basics, and loading/error feedback.

**Complete when:** users can perform the full release workflow on desktop and mobile, and a page reload preserves saved changes.

### 4. Automated verification

- Unit-test all status boundaries, including the transition from done back to ongoing after unchecking a step.
- Integration-test GraphQL against a separate PostgreSQL test database: create, toggle, edit information, list, retrieve, and delete a release. Include invalid step IDs, blank names, malformed dates, and missing mutation targets.
- Verify that repeated step updates do not create duplicates and concurrent updates to different steps retain both changes.
- Add a browser smoke test for creating a release, completing its checklist, editing information, reloading, and deleting it.
- Run type checking, linting, tests, and a production build in CI. Manually verify narrow-screen layout and keyboard operation.

**Complete when:** required workflows and status rules pass automated checks and the responsive interface passes manual review.

### 5. Documentation and hosted delivery

- Add a concise `README.md` covering prerequisites, installation, environment variables, local frontend startup, Docker API/database startup, migration commands, tests, and production build commands.
- Document `/graphql`, each query and mutation with sample requests, the database schema, fixed checklist, and status calculation.
- Document connecting to hosted PostgreSQL, required TLS settings, and deployment migration steps. Keep credentials out of source control.
- Publish the single repository on GitHub and deploy the frontend/API with an online PostgreSQL database using the selected hosting accounts.
- Verify the deployed workflow end to end and include the repository and live application URLs in the README.

**Complete when:** a reviewer can run the application from the README and use the deployed app with persistent hosted database storage.

## Final acceptance checklist

- [ ] Releases can be listed, created, and deleted.
- [ ] Every release has the same eight toggleable steps.
- [ ] Status always reflects persisted step completion.
- [ ] Additional information can be updated and cleared.
- [ ] Data persists in PostgreSQL locally and in an online database for deployment.
- [ ] Frontend and backend communicate through GraphQL.
- [ ] The app works as a responsive SPA without user management.
- [ ] The backend runs locally with the provided Dockerfile and Compose file.
- [ ] Automated tests cover the core workflow and status rules.
- [ ] A single GitHub repository contains the code, migrations, and setup instructions.
- [ ] README documents API operations and the database schema.

Hosting provider selection and credentials are delivery dependencies. Search, pagination, custom checklists, authentication, release-name/date editing, and advanced styling are outside the required scope.
