# Technical Challenge Answers

## 1. What was your approach and thought process?

I separated pure financial and scheduling behavior from Express-facing orchestration. The order splitter and market scheduler are independently injectable services, repositories contain only in-memory state, Zod validates HTTP payload shape and allocations, and Decimal.js provides explicit ROUND_DOWN behavior.

I reserved idempotency state synchronously before calculation or storage. Matching concurrent callers wait for the first reservation to complete instead of performing a find-then-create check.

## 2. What assumptions did you make?

- BUY and SELL use the same notional allocation and quantity formula.
- SELL is a calculation request; no holdings data is validated.
- Market prices are decimal US-dollar values.
- Symbols are case-insensitive identifiers.
- The allocation check uses decimal arithmetic and exact equality to 100.
- Allocated stock cost is rounded down to cents.
- Exchange holidays are unavailable and outside scope.
- `X-Partner-ID` optionally identifies idempotency scope; absent values use `default`. An idempotency key is optional, and requests without one are not deduplicated.

## 3. What challenges did you face?

The main challenge was preserving cents and quantity precision under repeated rounding. I avoided native floating-point allocation and used Decimal.js with explicit precision and ROUND_DOWN. I also needed a safe concurrent idempotency model rather than a simple Map lookup followed by insertion.

Timezone scheduling required explicit Luxon handling for America/New_York and DST-derived offsets instead of server-local timezone behavior.

## 4. How would you migrate this application to production, including security controls?

Replace Maps with a transactional relational database and distributed idempotency store. Reserve partner/key and hash in the database transaction, then persist the completed response atomically.

Production controls should include authentication and partner authorization, TLS, Helmet/CSP, rate limits, strict request limits, secrets managed outside source code, centralized structured logging and tracing, metrics and alerts, correlation IDs, database migrations, backups, and graceful shutdown.

The service should integrate live market data and holdings where required, add exchange holiday calendars, broker cutoffs, fees, taxes, settlement, stale-price checks, readiness probes, audit logs, replay protection, and horizontal-scaling controls.

## 5. How did you use LLMs, and what specific benefits did they provide?

I used an LLM as an implementation and verification assistant to translate the challenge into strict TypeScript interfaces and services, generate Zod/Decimal.js/Luxon/Express/Jest implementations, identify compatibility issues, create focused tests, and prepare documentation.

Generated code was verified by compilation and test execution rather than assumed correct.
