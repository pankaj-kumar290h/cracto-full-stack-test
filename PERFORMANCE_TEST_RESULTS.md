# Performance Test Results — Before Optimization

## Summary

The deployed app handled **50 simulated read-only users at approximately 33 requests per second** during a short load stage with an empty database. **Maximum sustainable capacity remains unverified.**

## Test environment and method

- **Target:** https://cracto-full-stack-test.onrender.com/
- **Test date:** October 25, 2026 (UTC)
- **Test start:** 09:37:41 UTC
- **Load generator:** Node.js v24.20.0 using native `fetch`, from one test location.
- **Workload:** Read-only `POST /graphql` requests using the frontend's full release-list query.
- **Model:** Closed-loop simulated users; each waits one second after a request completes before starting another.
- **Stages:** 1, 5, 10, 25, and 50 users, each with a 15-second request-start window. Actual elapsed time includes completing requests and worker waits.
- **Ramp:** User starts staggered across one second, with two seconds between stages.
- **Request timeout:** 10 seconds during load stages; 45 seconds for initial baseline requests.
- **Stop rule:** Stop after a stage if its failure rate exceeds 2% or p95 latency exceeds 3 seconds.
- **Dataset:** Zero releases; successful GraphQL responses contained 24 uncompressed bytes.
- **Data changes:** None. No create, update, or delete mutations were executed.

Query used:

```graphql
query Releases {
  releases {
    id
    name
    dueAt
    additionalInfo
    status
    steps {
      id
      label
      completed
    }
  }
}
```

Each response was checked for HTTP success, valid JSON, an array at `data.releases`, and absence of GraphQL errors. Latencies include failed attempts. Response byte counts refer to decoded response bodies, not compressed network transfer sizes.

## Baseline observations

| Request | HTTP status | Duration | Decoded body size |
| --- | --- | --- | --- |
| `GET /` | 200 | 589.1 ms | 402 bytes |
| `POST /graphql` | 200 | 779.5 ms | 24 bytes |

Both responses advertised Brotli compression (`content-encoding: br`) and `server: cloudflare`. HTML returned `cache-control: public, max-age=0`; the GraphQL response had no observed Cache-Control header. These isolated baseline requests do not establish cold-start performance.

## Load test results

| Simulated users | Elapsed | Requests | Requests/sec | Median | p95 | p99 | Maximum | Failures |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 15.05 s | 12 | 0.80 | 328.5 ms | 437.9 ms | 437.9 ms | 437.9 ms | 0 (0%) |
| 5 | 15.89 s | 58 | 3.65 | 294.3 ms | 444.9 ms | 845.3 ms | 845.3 ms | 0 (0%) |
| 10 | 15.83 s | 115 | 7.27 | 295.7 ms | 421.7 ms | 708.1 ms | 950.0 ms | 0 (0%) |
| 25 | 15.98 s | 282 | 17.65 | 319.4 ms | 534.3 ms | 967.1 ms | 1,090.0 ms | 5 (1.77%) |
| 50 | 16.00 s | 532 | 33.25 | 366.4 ms | 712.6 ms | 943.2 ms | 1,282.7 ms | 0 (0%) |

**p95** means 95% of measured attempts completed within that duration. Percentiles use the nearest-rank method. Requests per second equals all completed attempts divided by stage elapsed time. Simulated users include time spent waiting; they are not the number of simultaneously in-flight requests.

The five failures at 25 users were fetch-level `TypeError` exceptions without an HTTP response status. The underlying cause was not captured, so they cannot be attributed to the app, database, hosting provider, or test network. The remaining 277 requests in that stage returned HTTP 200. Every request in the other stages returned HTTP 200 and passed response validation.

## Recovery check

After the final stage, a release-list request succeeded with HTTP 200 in **371.6 ms**, returning zero releases. This confirms responsiveness at that moment; it is not a sustained recovery or availability test.

## Interpretation

- The highest tested stage was 50 simulated users, with 532 successful requests and approximately 33 requests per second.
- Latency increased under the highest tested load: median 366.4 ms and p95 712.6 ms.
- The isolated failures at 25 users did not recur at 50 users. They require investigation before making a reliability claim.
- The test did not identify a saturation point. It does not establish that 50 users is the maximum capacity or certify that load for production use.
- Brotli compression is already active on the deployed service, despite not being explicitly configured in the reviewed Express code.

## Limitations

1. **Empty database:** The current API retrieves every release, including notes and checklist steps. A populated database can produce much more database work, serialization, transfer, and browser rendering than this 24-byte result.
2. **Short duration:** Approximately 15 seconds per load stage is insufficient to establish sustainable capacity, memory stability, or long-running connection behavior.
3. **Read-only workload:** No writes, row contention, mixed read/write traffic, or concurrent edits were tested.
4. **API-level test:** Repeated page navigation, static asset loading, JavaScript execution, rendering, and browser performance were not measured.
5. **Single test location:** Network distance and load-generator constraints may influence the measurements.
6. **No infrastructure telemetry:** CPU, memory, event-loop delay, pool wait time, query timings, database resource usage, instance specifications, and hosting limits were unavailable.
7. **No controlled cold-start test:** Initial response times must not be presented as cold-start timings.
8. **Baseline identification:** This report records the deployed endpoint observed at test time; the deployed commit was not independently verified.

## Recommended next capacity test

1. Use a staging deployment matching production infrastructure and record its deployed commit, instance size, database tier, and region.
2. Seed representative datasets, such as 100, 10,000, and 100,000 releases, including realistic notes.
3. Measure server CPU/memory, event-loop delay, database query duration, connection-pool wait time, and database resource usage alongside client latency.
4. Run each load level for 5–10 minutes with a documented mix of reads and writes, then perform a longer soak test at the candidate operating load.
5. Agree on acceptance criteria before testing; suggested starting targets are p95 below 1 second and failed requests below 1%.
6. Investigate fetch failures and distinguish load-generator/network failures from application errors.
7. Report capacity as the highest sustained workload meeting the agreed targets, including requests per second, user pacing, dataset size, and infrastructure configuration.
8. Repeat the same workload after optimization to produce a comparable before/after report.
