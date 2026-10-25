# Performance Fixes

## Implemented changes

| Area | Change | Purpose |
| --- | --- | --- |
| Database/API | Cursor pagination: default 25, maximum 100 releases; retrieve one extra row to detect the next page | Bound list query results and response sizes |
| Database | Reuse `(due_at, id)` index and compare the same columns in the cursor predicate | Avoid increasing OFFSET work on later pages |
| Database | Preserve PostgreSQL microseconds in cursors and use UUID as tie breaker | Avoid skipping releases with equal or closely spaced dates |
| Network | List summaries exclude notes and steps; fetch one selected release separately | Avoid transferring unused detail data |
| Frontend | Previous/Next controls render one page at a time | Bound list DOM size |
| Frontend | Cache up to 50 details with a 30-second freshness window | Reduce repeated selection requests while bounding cache memory |
| Frontend | Abort obsolete page/detail reads; ignore stale responses; 10-second fetch timeout | Avoid wasted work and stale detail rendering |
| Mutations | Update list summaries and cached details locally; refresh page boundaries after create/delete | Preserve updates without full-dataset refetches |
| Static assets | One-year immutable cache for Vite hashed assets; HTML revalidation | Reduce repeat asset downloads |
| GraphQL | Limit parsing tokens, expanded fields, root fields, and nesting depth, including fragment expansion | Bound work requested by aliases and fragments |
| PostgreSQL pool | Configurable connection count, connection timeout, idle timeout, and server-side statement timeout | Bound connection waiting and long-running queries |
| Measurement | Server-Timing header and opt-in structured request/query logs with pool counts | Support subsequent bottleneck investigation |

## Compatibility and deployment

- `releases` changes from an array to `{ nodes, endCursor, hasNextPage }`. Frontend and backend must deploy together; external clients and load-test scripts must update their queries.
- No schema migration or additional index is required. Existing atomic step updates remain in use.
- The hosting proxy already supplies Brotli compression; no duplicate application compression layer was added.
- No shared result cache was introduced. Detail caching is browser-local and may show another client's changes for up to 30 seconds on repeat selection; no live synchronization is provided.
- GraphQL work limits operate per request. They are not aggregate rate limiting or a guarantee of capacity under sustained high traffic.
- Request cancellation stops obsolete frontend work; it does not guarantee cancellation of a query already running on PostgreSQL. Statement timeout bounds database execution.
- Browser request timeouts do not guarantee a mutation failed to commit. Mutations are not automatically retried.
- No deployment or new production capacity claim is implied by these source changes.

## Validation scope

Run `npm test` and `npm run build`. Tests cover input/status rules, cursor validation and microsecond preservation, page limits, SQL query arguments, summary payload shape, empty/final pages, detail lookup, and GraphQL demand limits including fragments. Resolver tests mock PostgreSQL and do not validate a live database execution plan.

A staging browser check and populated-database load test remain necessary to measure actual latency, throughput, and query plans. The original report used an empty database and cannot establish the improvement from pagination. Retest both list and detail requests with representative data and the same infrastructure and load profile.
