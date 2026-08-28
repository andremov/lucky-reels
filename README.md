# Lucky Reels

Buy a pack of spins with a card; once the payment clears, play the reels.

A React SPA and a NestJS API, both deployed as separate projects. Payments run
through a card gateway in test mode: the card is tokenised in the browser, so the
number never reaches this API and is never stored here.

## Live

| | URL |
|---|---|
| Frontend | _pending — link added once the deployment is verified reachable_ |
| API | _pending_ |
| API docs | _pending — Swagger URL, plus the Postman collection at [`postman/lucky-reels.postman_collection.json`](postman/lucky-reels.postman_collection.json)_ |

Links are deliberately left blank rather than guessed. An unreachable URL in a
README is worse than an absent one, so each is filled in only after it has been
loaded.

## Stack

- **Frontend** — React 19, Redux Toolkit, Tailwind v4, Vite. Mobile-first. No
  other framework: the brief allows React only.
- **Backend** — NestJS, PostgreSQL on Supabase, hexagonal layering.
- **Tests** — Jest with React Testing Library on the frontend, Jest on the API.

## Running locally

Requires Node 22+ (developed on 24) and npm.

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

`VITE_API_URL` points the app at the API. **Leave it unset and the app runs
against a complete in-memory stub** of the API — every checkout screen works
end-to-end, including reservations, polling and settlement, with no backend
running. That stub is the same interface the real client implements, so swapping
between them touches one line.

### Tests

```bash
cd web && npm test        # or npm run test:cov
cd api && npm test
```

Run `npx tsc -b` too. Jest transpiles each file without whole-project type
checking, so a green suite does **not** mean the project type-checks — that gap
hid two real type errors here until `tsc` was run separately.

## Test coverage

Frontend, verified by `npm run test:cov` in `web/` with `tsc -b` clean:

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All files | 93.55% | 82.82% | 89.58% | 94.59% |
| `features/checkout` | 92.19% | 81.38% | 88.13% | 93.31% |
| `features/game` | 98.95% | 96.55% | 95.45% | 100% |

98 tests across 10 suites.

Backend coverage: _pending — filled in from a verified run, not quoted second-hand._

## The checkout

Five steps, each a distinct screen backed by one Redux slice.

1. **Pack** — choose a pack. Stock is refetched on every visit.
2. **Details** — name, email, phone, delivery address, validated per field.
3. **Review** — confirm the order. Creates the transaction as `PENDING` and
   reserves stock.
4. **Payment** — card details, validated locally (Luhn, brand-aware CVV length,
   expiry) before anything is sent.
5. **Result** — polls until the gateway decides, then reports the outcome and
   credits the spins.

Three behaviours are worth calling out, because each is a place the obvious
implementation is wrong:

**The server computes the fees, and the client never adds anything up.** Step 3
shows no total at all. Base and delivery fees are returned by
`POST /transactions` alongside the product amount and the total, and the
breakdown is rendered verbatim from that response on step 4. Summing the parts
client-side would eventually show a customer a figure different from the one
they were charged.

**`reference` is the idempotency key and is persisted the instant it returns.**
That is what makes a refresh resumable and what stops a retried payment charging
twice. On load, a stored reference is treated as the source of truth: the app
asks the API what actually happened rather than trusting the step it left off
on, so a tab that died at step 2 lands on the real outcome.

**Stock can go up.** Reservations are released when someone else's payment
fails, so a rising number is not a bug and product stock is never cached across
screens.

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

No credentials are in this repository or its history: `.env` is gitignored and
only empty `.env.example` files have ever been committed.

## Notes

Written with AI assistance, which the brief encourages.
