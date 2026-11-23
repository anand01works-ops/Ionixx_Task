# Ionixx Order Splitter API

A strict TypeScript/Node.js order-splitting API for BUY and SELL notional orders. It uses Decimal.js for financial arithmetic, Luxon for America/New_York market scheduling, Zod for validation, and process-memory repositories.

## Features

- BUY and SELL order splitting
- Exact 100% allocation and duplicate-symbol validation
- Configurable quantity precision from 1 through 7 decimal places (default 3)
- $100 default stock price with per-stock override
- ROUND_DOWN quantities and unallocated residual reporting
- New York market execution scheduling with DST-aware Luxon calculations
- Atomic in-memory idempotency reservation scoped by partner/client
- Paginated and filtered order history
- Helmet security headers and centralized errors
- Request timing middleware

## Technology stack

Node.js, TypeScript strict mode, Express, Zod, Decimal.js, Luxon, UUID, Jest, Supertest, and Helmet.

## Architecture

- `controllers/`: HTTP orchestration
- `services/`: order, splitting, and scheduling logic
- `repositories/`: in-memory `Map` data stores
- `validators/`: Zod request schemas
- `middlewares/`: validation, errors, security, and performance
- `routes/`: REST routes
- `types/`: shared DTOs

Business calculations do not depend on Express.

## Folder structure

```text
src/
  config/
  controllers/
  middlewares/
  repositories/
  routes/
  services/
  types/
  utils/
  validators/
tests/
  unit/
  integration/
```

## Installation

```powershell
git clone <repository-url>
cd Ionixx_Task
npm install
```

## Environment configuration

| Variable | Default | Meaning |
|---|---:|---|
| `PORT` | `3000` | HTTP listen port |
| `QUANTITY_PRECISION` | `3` | Quantity precision, capped at 7 |
| `NODE_ENV` | unset | Set to `production` for production error behavior |

## Run and test

```powershell
npm run build
npm start
npm run dev
npm test
```

## API endpoints

Success responses use `success: true`. Errors use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload.",
    "details": []
  }
}
```

### POST /api/v1/orders

`Idempotency-Key` and `X-Partner-ID` are optional. If a key is provided, it enables duplicate-request protection; `X-Partner-ID` scopes the key and defaults to `default`. Requests without an idempotency key create a new order each time and return 201.

```json
{
  "type": "BUY",
  "totalAmount": 1000,
  "portfolio": [
    { "symbol": "AAPL", "allocation": 60 },
    { "symbol": "TSLA", "allocation": 40, "marketPrice": 200 }
  ]
}
```

```powershell
curl -X POST "http://localhost:3000/api/v1/orders" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: order-001" `
  -H "X-Partner-ID: partner-a" `
  -d '{\"type\":\"BUY\",\"totalAmount\":1000,\"portfolio\":[{\"symbol\":\"AAPL\",\"allocation\":60},{\"symbol\":\"TSLA\",\"allocation\":40,\"marketPrice\":200}]}'
```

### GET /api/v1/orders

Query parameters: `page` (default 1), `limit` (default 20, maximum 100), `type=BUY|SELL`, and `date=YYYY-MM-DD`.

### GET /api/v1/orders/:id

Returns 404 when the order is not in memory.

### GET /api/v1/config

Returns quantity precision and default stock price.

### GET /api/v1/health

Returns service health and UTC timestamp.

## Financial calculation

```text
allocatedAmount = totalAmount * allocation / 100
quantity = ROUND_DOWN(allocatedAmount / stockPrice, quantityPrecision)
cost = quantity * stockPrice
unallocatedAmount = totalAmount - sum(cost)
```

Decimal.js prevents binary floating-point drift. Amount and price strings use two decimal places; quantities use configured precision. Monetary residual is rounded down to cents. The implementation never uses a quantity whose cost exceeds the allocated amount.

## Market scheduling

Always calculates in `America/New_York`:

- Before 09:30: schedule same trading day at 09:30
- 09:30 to before 16:00: execute immediately
- After 16:00: schedule next trading day at 09:30
- Saturday/Sunday: schedule Monday at 09:30
- Luxon applies DST offsets from the reference timestamp

Exchange holidays are outside scope.

## Idempotency

When supplied, the key is namespaced by `X-Partner-ID` and atomically reserved in memory before order creation. Matching payloads return the original completed order. Different payloads return 409. Concurrent matching requests wait for the original reservation and receive the same result. If no key is supplied, idempotency protection is skipped and each request creates a new order. `X-Partner-ID` is optional and defaults to `default`.

In-memory entries and history are cleared on restart and are not sufficient for a multi-instance production deployment.

## Assumptions and limitations

- No holdings ledger is provided, so SELL does not validate holdings.
- Prices are supplied market prices or the $100 default.
- No fees, tax, settlement, lot, or broker fill model is included.
- Exchange holidays are not implemented.
- Execution timestamps are policy timestamps, not guaranteed broker fills.
