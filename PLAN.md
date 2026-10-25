# Release checklist plan

Scope: implement [requirment.md](./requirment.md) with Node.js and Express.

1. Store releases and their completed step IDs in PostgreSQL. Keep eight fixed step definitions in code and calculate status from completion.
2. Provide a GraphQL API to list, create, update step completion, edit additional information, and delete releases.
3. Build a responsive React SPA with a creation form, release list, and checklist/details view. Use basic CSS and normal form controls.
4. Supply Dockerfile/Compose configuration and a short README covering local startup, API operations, and database schema.
5. Include two automated tests for status calculation and required input validation.

No accounts, search, filters, dashboards, custom checklists, browser test framework, or CI setup.

Hosted PostgreSQL and publishing require deployment configuration. Local database/runtime verification depends on access to Docker or a PostgreSQL instance.
