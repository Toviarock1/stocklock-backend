# StockLock

A high-concurrency limited-stock product drop system. Built to handle the "100 users, 3 units" problem — where simultaneous requests must never oversell stock, reservations expire automatically, and every stock movement is audited.

**Live:** https://stocklock-backend-mxos.onrender.com  
**Loom walkthrough:** `https://loom.com/...`

---

## Tech Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Runtime    | Node.js 20 + TypeScript (strict) |
| Framework  | Express 5                        |
| ORM        | Prisma 7 + PostgreSQL (Supabase) |
| Validation | Zod 4                            |
| Auth       | JWT (jsonwebtoken + bcrypt)      |
| Logging    | Winston                          |
| Testing    | Jest + ts-jest                   |
| Hosting    | Render + UptimeRobot             |

---

## How Race Conditions Are Handled

The core problem: 100 users click "Reserve" at the same millisecond. Without protection, all 100 reads see `availableStock: 3`, all 100 writes decrement it, and you end up with `availableStock: -97`.

### Solution: Optimistic Locking via Version Field

Every `Product` row has a `version: Int` field. The reservation flow uses a Prisma `$transaction` with an atomic `updateMany` that includes the version in its `WHERE` clause:

```sql
UPDATE "Product"
SET "availableStock" = "availableStock" - $qty,
    "version"        = "version" + 1
WHERE "id"      = $productId
  AND "version" = $currentVersion       -- ← the lock
  AND "availableStock" >= $qty
```

Mapped to Prisma:

```typescript
const updated = await tx.product.updateMany({
  where: {
    id: input.productId,
    version: product.version, // must still match what we read
    availableStock: { gte: input.quantity },
  },
  data: {
    availableStock: { decrement: input.quantity },
    version: { increment: 1 },
  },
});

if (updated.count === 0) {
  throw new ApiError(409, "Product unavailable or conflict — please retry");
}
```

**Why this works:** PostgreSQL serialises the row-level `UPDATE` lock. The first request to execute the UPDATE wins and increments `version`. Every concurrent request that read the same `version` will find `updated.count === 0` and receive a `409`. No overselling is possible because the `WHERE availableStock >= qty` check is inside the atomic write.

**Why not pessimistic locking (`SELECT FOR UPDATE`)?**  
Pessimistic locking holds a row lock for the duration of the transaction. Under 100 concurrent requests this creates a lock queue — requests serialize completely and throughput collapses. Optimistic locking fails fast (immediate 409) and lets the client retry rather than queuing indefinitely.

---

## Schema Decisions

### Why `version` on Product?

The `version` field is the compare-and-swap token. Without it, you could check `availableStock` in the `WHERE` clause alone — but between the read and the write, another transaction could decrement stock to exactly `qty`, making the check pass twice. The version guarantees each successful write is the unique writer for that generation of the row.

### Why separate `totalStock` and `availableStock`?

- `totalStock` = how many units exist in total (never changes after creation)
- `availableStock` = how many units are currently not reserved or sold

This lets the UI show "5 of 50 left" without computing it from reservations. It also means the inventory audit is a check: `totalStock - availableStock` should equal the sum of active reservations + completed orders.

### Why `InventoryLog` as a separate model?

Every stock movement (reservation, expiry restore, checkout) writes an `InventoryLog` row. This is the audit trail — if a customer disputes "I never got my item", you can trace exactly when stock was deducted, by which reservation, and whether it was restored. High-value drops (sneakers, electronics) legally require this.

### Why `Reservation` between User and Order?

The two-step flow (Reserve → Checkout) requires a holding state. A `Reservation` with `status: PENDING` and `expiresAt` represents "stock is held for this user for 5 minutes". When checkout completes it becomes `COMPLETED` and an `Order` is created. This prevents a user from holding stock indefinitely without paying.

### Why `expiresAt` as a column instead of a TTL?

Most databases don't have native TTL on rows. Storing `expiresAt` as a `DateTime` lets the cron query `WHERE expiresAt < now()` efficiently (indexed scan), and lets the frontend compute a live countdown from the value returned at reservation time.

---

## API Endpoints

Base URL: `/api/v1`

| Method | Endpoint                     | Auth | Description                                 |
| ------ | ---------------------------- | ---- | ------------------------------------------- |
| POST   | `/users/register`            | —    | Create account                              |
| POST   | `/users/login`               | —    | Get JWT token                               |
| GET    | `/products`                  | —    | List products (paginated, filtered, sorted) |
| GET    | `/products/:id`              | —    | Single product                              |
| POST   | `/reservations/reserve`      | JWT  | Reserve a product                           |
| POST   | `/reservations/:id/checkout` | JWT  | Complete purchase                           |
| GET    | `/metrics`                   | —    | Live system metrics                         |
| GET    | `/health`                    | —    | Health check                                |

### Query Parameters for `GET /products`

| Param     | Type                                                 | Default     | Description                |
| --------- | ---------------------------------------------------- | ----------- | -------------------------- |
| `page`    | number                                               | 1           | Page number                |
| `limit`   | number                                               | 20          | Results per page (max 100) |
| `name`    | string                                               | —           | Search by name             |
| `inStock` | `"true"` \| `"false"`                                | —           | Filter by availability     |
| `sortBy`  | `name` \| `price` \| `availableStock` \| `createdAt` | `createdAt` | Sort field                 |
| `order`   | `asc` \| `desc`                                      | `desc`      | Sort direction             |

---

## Running Locally

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase free tier works)

### Setup

```bash
git clone https://github.com/Toviarock1/stocklock
cd stocklock
npm install
```

Create a `.env` file:

```env
NODE_ENV=development
PORT=5050
DATABASE_URL=postgresql://user:password@host:5432/db?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/db
JWT_SECRET=your-secret-at-least-32-characters-long
JWT_EXPIRES_IN=7d
```

Run migrations and seed:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Start the server:

```bash
npm run dev
```

### Running Tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

---

## Trade-offs

### Optimistic vs Pessimistic Locking

Optimistic locking (our approach) is fast under low contention — most requests succeed on the first try. Under high contention (many users, very few units), many requests get 409s and must retry, which can frustrate users. Pessimistic locking would queue them instead of rejecting them, but collapses throughput. For a drop system where failure is expected and retries are cheap, optimistic locking is the right call.

### In-process Cron vs External Job

The expiry cron runs inside the Express process via `node-cron`. This is simpler (no separate infrastructure) but means if the server is down, reservations don't expire until it restarts. For this project that's acceptable. A production system would use a separate worker process or a managed scheduler (AWS EventBridge, Render Cron Jobs) so expiry is independent of web server uptime.

### JWT vs Sessions

JWTs are stateless — no database lookup on every request. The trade-off is that you can't immediately invalidate a token (e.g., on logout). For a drop system where sessions are short-lived and security requirements are moderate, this is an acceptable trade-off.

### No Retry Logic on the Client

The API returns `409` on a version conflict and tells the client to retry. The current implementation doesn't auto-retry on the server side. A production system might add 1–2 automatic retries inside `reserveProduct` before surfacing the 409, which would increase success rates under burst load without changing the safety guarantees.

---

## What Would Break at 10,000 Concurrent Users

### 1. The Database Becomes the Bottleneck

At 10k concurrent requests, the Postgres connection pool (`max: 10` in our config) would saturate immediately. Most requests would queue waiting for a connection. Response times would spike to seconds.

**Fix:** Use a connection pooler like **PgBouncer** (Supabase's pooler mode) set to transaction-mode pooling. This multiplexes thousands of app connections over a small number of actual database connections.

### 2. Optimistic Lock Contention Explodes

With 10k users competing for 3 units, ~9997 requests get `409`. Under this load, even the failed path is expensive — each failed request still hits the database for the `findUnique` and the `updateMany`.

**Fix:** Move the stock counter to **Redis** with a Lua script for atomic decrement:

```lua
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock >= tonumber(ARGV[1]) then
  redis.call('DECRBY', KEYS[1], ARGV[1])
  return 1
else
  return 0
end
```

Redis processes ~1M ops/sec in memory. The check-and-decrement never touches Postgres unless it succeeds. Failed requests are rejected at the Redis layer in microseconds. Only successful reservations write to Postgres.

### 3. Single Server Is a Single Point of Failure

One Node.js process handles all requests. A crash or deploy takes down the entire system during the drop.

**Fix:** Run multiple instances behind a load balancer (Render auto-scaling, AWS ECS, etc.). Because our state is in Postgres/Redis (not in-memory), any instance can handle any request.

### 4. The Cron Job Runs on Every Instance

With multiple servers, every instance runs its own `node-cron` expiry job — the same expired reservations would be processed multiple times.

**Fix:** The `updateMany` guard (`WHERE status = 'PENDING'`) already prevents double-processing (idempotent), but it's wasteful. The correct fix is to elect a single leader for the cron (using a distributed lock in Redis) or move it to a dedicated worker process entirely.

---

## How to Scale It

| Concern            | Current                         | At Scale                                       |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| Stock counter      | Postgres `updateMany` + version | Redis Lua atomic decrement                     |
| Connection pooling | pg.Pool (max 10)                | PgBouncer transaction mode                     |
| Servers            | Single process                  | Multiple instances + load balancer             |
| Cron               | In-process node-cron            | Dedicated worker + Redis distributed lock      |
| Auth               | Stateless JWT                   | Same (scales naturally)                        |
| Observability      | Winston file logs               | Centralised log aggregation (Datadog, Logtail) |

---

## Architecture Diagram

```
                        ┌─────────────┐
                        │  Client     │
                        │  (Browser)  │
                        └──────┬──────┘
                               │ HTTPS
                        ┌──────▼──────┐
                        │  Render     │
                        │  Web Service│
                        │             │
                        │  Express 5  │
                        │  ┌────────┐ │
                        │  │ Routes │ │
                        │  └───┬────┘ │
                        │  ┌───▼────┐ │
                        │  │Services│ │
                        │  └───┬────┘ │
                        │  ┌───▼────┐ │
                        │  │ Prisma │ │
                        │  └───┬────┘ │
                        │      │      │
                        │  node-cron  │
                        │  (expiry)   │
                        └──────┬──────┘
                               │
                  ┌────────────▼────────────┐
                  │      Supabase           │
                  │      PostgreSQL         │
                  │                         │
                  │  Users                  │
                  │  Products (+ version)   │
                  │  Reservations           │
                  │  Orders                 │
                  │  InventoryLogs          │
                  └─────────────────────────┘
```
