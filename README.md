# DesMind Lands

**lands.desmindlabs.com**: land sold directly between its owner and a buyer, with witnesses, a signed agreement and
every payment on record. No agents, and no 5–10% commission taken from either side.

Same stack as DesMind Homes (lodge-platform): an npm-workspaces monorepo with a Fastify + Drizzle API on Postgres
(isolation by row-level security), a Next.js 16 + Tailwind 4 web app, a background worker for email, S3-compatible
storage, and one Railway container (`scripts/start.mjs`).

## How a sale works

| Stage | Who does what |
| --- | --- |
| **Listing** | The seller lists the land: location, size, use, title (C of O, Governor's Consent…), photos, title papers. Staff review it (`/admin`) before it goes live. |
| **Offer** | A buyer's offer opens a private **deal room**. Offers and counter-offers until one is accepted; the land goes *under offer*. |
| **Checks** | The buyer now sees the exact address and papers, inspects, and ticks their checks (visit is required). The seller gives the bank account; both agree a completion date and special terms. |
| **Agreement** | The buyer prepares the Contract of Sale. It is fixed and SHA-256 fingerprinted. Seller, buyer, and **at least one witness for each side** sign it. Witnesses sign through a private link (email or WhatsApp), with no account. Changing any term lapses every signature. |
| **Payment** | The buyer pays the seller **directly** (the platform never holds money), records each payment with its receipt, and the seller confirms it arrived. |
| **Handover** | Seller confirms handover, buyer confirms receipt: the land is **sold**, other deals on it close, and the signed agreement downloads as a PDF with a certificate of who signed, when and from where. |

The rules live in the database as well as the API: `backend/migrations/0001_core.sql` (policies, and the
`SECURITY DEFINER` functions for listing status, witness signing and stage advancement).

## Run it locally

```sh
npm install
npm run dev:db            # Postgres on :5433 (no Docker), migrated; leave it running
cp backend/.env.example backend/.env
npm run dev:backend       # API on :4000
npm run dev:worker        # emails (printed to the console without RESEND_API_KEY / SMTP_URL)
npm run dev:frontend      # http://localhost:3000
npm run seed:demo --workspace @lands/backend   # demo land and accounts (password "demo password 123")
```

Make someone staff: `npm run admin:grant --workspace @lands/backend -- person@example.com`.

## Checks

```sh
npm run lint && npm run typecheck && npm test
```

`backend/test/deal-flow.test.ts` takes a sale through every stage against a real Postgres, as seller, buyer, rival
buyer, staff and witnesses, including what each is refused.

## Deploy (Railway)

`railway.json` and `.railway/railway.ts` deploy one service to **lands.desmindlabs.com**. Variables:
`SYSTEM_DATABASE_URL` (Neon, owner), `API_DB_PASSWORD`, `SITE_URL=https://lands.desmindlabs.com`, the `S3_*` storage
keys, `RESEND_API_KEY`, `EMAIL_FROM="DesMind Lands <lands@desmindlabs.com>"`, and `SEED_DEMO=0`.
