# Lucky Reels

Buy a pack of spins with a card; once the payment clears, play the reels.

A React SPA and a NestJS API, both deployed as separate projects. Payments run
through a **stubbed** card gateway behind a port — no external provider is
called; see [Settlement](#settlement). The card is tokenised in the browser, so
the number never reaches this API and is never stored here.

## Live

| | URL |
|---|---|
| Frontend | https://lucky-reels-andremovs-projects.vercel.app |
| API | https://lucky-reels-api-andremovs-projects.vercel.app |
| API docs (Swagger) | https://lucky-reels-api-andremovs-projects.vercel.app/docs |
| API docs (Postman) | [`postman/lucky-reels.postman_collection.json`](postman/lucky-reels.postman_collection.json) |

These are stable production domains, not per-deployment URLs, so they survive
redeploys. Each was checked signed-out: the frontend serves the app, `/health`
returns `{"status":"ok","database":"up"}`, and `/docs` renders Swagger UI in a
browser with a clean console. The raw OpenAPI document is at `/docs-json`.

Swagger UI is served from the app itself rather than a CDN, so the strict
content-security policy needs no exception and the page has no third-party
runtime dependency.

The Postman collection is runnable end to end, not a static dump: set `baseUrl`
and `productId`, then run the **Checkout** folder in order. Creating a
transaction captures the `reference` into a collection variable, and polling the
transaction captures the `playerToken` once the payment is `APPROVED`, which the
**Game** requests then use automatically.

## Trying it

The deployed frontend talks to the deployed API. Buying a pack really creates a
transaction, really reserves stock, and really grants credits you can spend on
the reels.

Payments run against a **stub gateway**, so you can force any outcome from the
card form. The branch is chosen by the payment token, which the browser builds
from the card number — use these test cards:

| Card number | Outcome |
|---|---|
| `4242 4242 4242 4242` | `APPROVED` — credits granted, stock committed |
| `4000 0000 0000 0002` | `DECLINED` — nothing charged, stock released |
| `4000 0000 0000 0119` | `ERROR` — nothing charged, stock released |

Any card passing the Luhn check works; expiry `12/30` and any 3-digit CVV are
fine. Calling the API directly, the same rule applies to `paymentToken`: a token
containing `decline` declines, one containing `error` errors, anything else
approves. Case-insensitive, and `error` wins if a token asks for both.

## Stack

- **Frontend** — React 19, Redux Toolkit, Tailwind v4, Vite. Mobile-first. No
  other framework: the brief allows React only.
- **Backend** — NestJS, PostgreSQL on Supabase, hexagonal layering.
- **Tests** — Jest with React Testing Library on the frontend, Jest on the API.

## Running locally

Built and verified on Node 24 with npm. Earlier Node versions are untested.

### API

```bash
cd api
npm install
cp .env.example .env    # then fill in DATABASE_URL
npm run start:dev       # http://localhost:3000
```

`.env` needs a `DATABASE_URL` pointing at the Postgres instance. It is
gitignored and must stay that way — no credentials belong in this repo.

**The database connection needs a CA certificate.** `api/certs/supabase-ca.crt`
is committed, and it is required, not optional. Supabase's pooler serves a
certificate chain that is self-signed at the root, so the root is not in Node's
bundled trust store; connecting with `rejectUnauthorized: true` and nothing else
fails with `verify code 19 (self signed certificate in certificate chain)`. The
committed CA is what lets strict verification actually succeed. The certificate
is Supabase's public root (`CN = Supabase Root 2021 CA`, valid to 2031), so it
is safe to commit — it is not a secret.

### Frontend

```bash
cd web
npm install
cp .env.example .env    # optional
npm run dev             # http://localhost:5173
```

`VITE_API_URL` points the app at the API, and is set to the deployed API in
production. **Leave it unset and the app runs against a complete in-memory
stub** — every checkout screen works end to end, including reservations, polling
and settlement, with no backend running. The stub implements the same interface
as the real client, so switching between them is this one variable and no code
change. Note Vite bakes it in at build time, so changing it needs a rebuild.

### Tests

```bash
cd web && npm test        # or npm run test:cov
cd api && npm test
```

> **The API suite writes to the database `DATABASE_URL` points at.** Its
> repository tests are integration tests: they insert products, customers and
> transactions, mutate stock, and delete rows on teardown. Point `DATABASE_URL`
> at a scratch database before running them, never at anything you care about.
> With the variable unset those tests skip — you get 215 passing, 10 skipped and
> one failure, because `app.module.spec` boots a module that requires the
> variable. That failure is environmental, not a regression.

Run `npx tsc -b` too. Jest transpiles each file without whole-project type
checking, so a green suite does **not** mean the project type-checks — that gap
hid two real type errors here until `tsc` was run separately.

## Test coverage

Frontend, verified by `npm run test:cov` in `web/` with `tsc -b` clean:

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All files | 93.73% | 82.31% | 90.56% | 94.73% |
| `features/checkout` | 92.63% | 81.07% | 89.47% | 93.71% |
| `features/game` | 98.95% | 93.10% | 95.45% | 100% |

126 tests across 13 suites.

Backend, verified by `npm run test:cov` in `api/` with `tsc -b --force` clean:

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All files | 87.07% | 81.41% | 83.41% | 86.80% |

226 tests across 21 suites. Above 80% on every metric on both sides, with no
coverage exclusions.

## The checkout

Five steps, each a distinct screen backed by one Redux slice.

1. **Pack** — choose a pack. Stock is refetched on every visit.
2. **Details** — name, email, phone, delivery address, validated per field.
   Continuing creates the transaction as `PENDING` and reserves the stock.
3. **Review** — the order alongside the product amount, base fee, delivery fee
   and total exactly as the server computed them.
4. **Payment** — a *Pay with credit card* button opens a modal for the card,
   validated locally (Luhn, brand-aware CVV length, expiry) before anything is
   sent.
5. **Result** — polls until the gateway decides, then reports the outcome and
   credits the spins.

Three behaviours are worth calling out, because each is a place the obvious
implementation is wrong:

**The server computes the fees, and the client never adds anything up.** Base
and delivery fees come back from `POST /transactions` alongside the product
amount and the total, and the summary renders that response verbatim. This is
why the reservation happens on the way *into* the summary rather than on the way
out — the figures cannot be shown before the server has produced them, and
summing the parts locally would eventually show a customer a total different
from the one they were charged.

Stepping back to edit and returning reuses the existing reservation rather than
taking a second one; changing pack or quantity discards it and reserves afresh,
leaving the abandoned one to lapse at `expiresAt`.

**`reference` is the idempotency key and is persisted the instant it returns.**
That is what makes a refresh resumable and what stops a retried payment charging
twice. On load, a stored reference is treated as the source of truth: the app
asks the API what actually happened rather than trusting the step it left off
on, so a tab that died at step 2 lands on the real outcome.

**Stock can go up.** Reservations are released when someone else's payment
fails, so a rising number is not a bug and product stock is never cached across
screens.

### Reservations and concurrency

`POST /transactions` reserves stock; approval commits it, and a decline or an
error returns it. An expiry does not — see the limitation noted below. The
invariant that matters is that the last unit cannot be sold twice. A
`SELECT … FOR UPDATE` row lock is what enforces it, and the aggregate's own
rules are unit-tested. On top of that, an integration test
against the real database issues two reservations for the last unit
concurrently and asserts exactly one succeeds, the other fails with
`OUT_OF_STOCK`, and the final state is `available` 0 / `reserved` 1. Settling
the same transaction twice leaves the first outcome standing.

To be precise about what that test does and does not show: it issues both
requests without awaiting the first, but it cannot force Postgres to interleave
them on any given run, so a run where the first commits first passes for the
weaker reason that stock was simply exhausted. The lock is what makes the
genuinely interleaved case safe; the test demonstrates the outcome rather than
reproducing the race deterministically.

### Settlement

The result screen polls `GET /transactions/{reference}` every 2s and stops at
60s, showing pending copy rather than a failure — a slow settlement is not a
failed one. Settlement is deliberately **polled, not webhook-driven**: a signed
gateway callback needs a publicly reachable endpoint and secret verification
that could not be honestly proven in the time available, so the webhook path is
left unbuilt rather than half-built.

**The gateway is stubbed, and the provider's sandbox API is not called.**
Payments settle through `StubGateway`, one implementation of the
`PaymentGateway` port; the card is tokenised in the browser and the token
decides the outcome, which is what makes the approved, declined and errored
branches all reachable from the card form above. No request is made to an
external payment provider. Substituting a real one is a new adapter and one
binding in the module — no use case, controller or frontend code changes — but
that adapter is not written, and this README should not be read as claiming a
live provider integration.

**Abandoned reservations are never released.** A pending transaction carries an
`expiresAt`, and paying after it lapses is correctly refused — but nothing
sweeps the expired ones, so the units they hold stay reserved indefinitely
rather than returning to the shelf. In production that would let abandoned
carts drain a catalogue over time. The fix is a scheduled job, or releasing
lazily when stock is read; neither is built. It is a real gap in the backend
rather than an oversight in the data, and it is recorded here for the same
reason as the webhook: a limitation you can read is worth more than one you
have to infer.

## Data model

Restated here so this README stands alone. All money is **integer cents in COP**
— never floats, never decimal strings.

### Product

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `description` | string | |
| `priceCents` | int | |
| `currency` | string | `COP` |
| `imageUrl` | string | |
| `spinsGranted` | int | credits granted per unit |
| `stock.available` | int | reserved units already subtracted |

Only `available` crosses the API boundary; reservation counts never do.

### Transaction

| Field | Type | Notes |
|---|---|---|
| `reference` | string | idempotency key for the whole flow |
| `status` | enum | `PENDING` / `APPROVED` / `DECLINED` / `ERROR` |
| `amounts` | object | `productCents`, `baseFeeCents`, `deliveryFeeCents`, `totalCents`, `currency` — all server-computed |
| `expiresAt` | ISO 8601 | when the stock reservation lapses |
| `creditsGranted` | int | `APPROVED` only |
| `playerToken` | string | `APPROVED` only; opaque bearer token |

| Status | Meaning | Terminal |
|---|---|---|
| `PENDING` | Created, stock reserved, outcome unknown | no |
| `APPROVED` | Paid. Stock committed, credits granted | yes |
| `DECLINED` | Gateway refused. Stock released | yes |
| `ERROR` | Gateway or internal failure. Stock released | yes |

Anything unrecognised is treated as `ERROR`.

### Customer / Delivery

`customer`: `email`, `fullName`, `phone`.
`delivery`: `addressLine`, `city`, `region`, `postalCode`, plus `feeCents` and a
`status` once assigned.

### Endpoints

```
GET  /products                       list packs with live stock
GET  /products/:id
POST /transactions                   create PENDING, reserve stock, return reference + amounts
POST /transactions/:reference/pay    submit gateway token; 202, outcome not yet decided
GET  /transactions/:reference        poll for the outcome
GET  /deliveries/:reference
GET  /balances/me                    game endpoints; require the player token
POST /spins
GET  /spins?limit=20
```

Errors share one envelope, and clients switch on `code`, never on `message`:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Only 2 packs left" } }
```

`VALIDATION_FAILED` additionally carries `details[]` of per-field errors. Other
codes: `PRODUCT_NOT_FOUND`, `TRANSACTION_NOT_FOUND`,
`TRANSACTION_ALREADY_SETTLED`, `TRANSACTION_EXPIRED`, `PAYMENT_REJECTED`,
`DELIVERY_NOT_FOUND`, `UNAUTHORIZED`, `INSUFFICIENT_CREDITS`, `INTERNAL_ERROR`.

### Paytable

Symbols: `cherry`, `lemon`, `bell`, `star`, `diamond`. Only the middle row pays.

| Combination | Payout |
|---|---|
| Three diamonds | 100 |
| Three stars | 50 |
| Three bells | 25 |
| Three lemons | 15 |
| Three cherries | 10 |
| Any two matching | 2 |
| Otherwise | 0 |

The server decides every outcome; the client only animates the result it is
given and cannot influence it.

## Beyond the brief

**Hexagonal architecture** on the API — domain logic sits behind ports, with
adapters for HTTP, persistence and the gateway, so the database and the payment
provider are swappable without touching use cases.

**The payment gateway is a port, not a hard-coded call.** `PaymentGateway` is an
interface with `StubGateway` as one implementation; swapping in a real provider
is one adapter and one binding in the module, with no use case touched. The stub
is a seam, not a shortcut — which is also why the outcome is steerable from a
test card rather than random.

**Railway-oriented programming** — a `Result`/`ResultAsync` type carries expected
failures as values through the use-case layer instead of throwing, so every
error path is visible in the type signature rather than discovered at runtime.

**Mobile-first responsive CSS** — Tailwind, built narrow and widened, not the
reverse.

**Security.** Three specific things, none of them incidental:

- *Verified TLS against a pinned Supabase root CA.* The database connection
  verifies the full chain against the committed CA rather than disabling
  verification with `rejectUnauthorized: false`. As above, this endpoint's chain
  is self-signed at the root, so strict verification only works *because* the CA
  is pinned — the certificate is load-bearing, not decorative.
- *Card data never enters application state.* Card number, CVV and expiry live
  in component state on the payment step and die with it. They are never
  dispatched into Redux, never written to storage, and never sent to this API —
  the gateway tokenises in the browser. A test asserts that nothing resembling a
  card number, CVV or payment token reaches persisted storage.
- *Amounts are server-authoritative.* The client cannot influence what it is
  charged, because it never computes it.
- *CORS is an exact-match allowlist, tested against origin-prefix spoofing.* The
  API echoes `Access-Control-Allow-Origin` only for the frontend origin and
  `localhost:5173`. It refuses `https://evil.example.com`, and — the case that
  actually matters — it also refuses
  `https://lucky-reels-andremovs-projects.vercel.app.evil.com`. An allowlist
  implemented with `startsWith` or `includes` passes the first two checks while
  granting an attacker-controlled subdomain suffix full access; this one does
  not.

No credentials are in this repository or its history: `.env` is gitignored and
only empty `.env.example` files have ever been committed.

## Notes

Written with AI assistance, which the brief encourages.
