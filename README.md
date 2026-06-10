# SocialReviewCard

Micro-SaaS that turns customer reviews into beautiful, shareable images for
Instagram Stories (9:16) and Posts (1:1). Images are rendered **client-side**
with `html2canvas`; the backend only handles auth, card metadata, and Stripe
billing.

This repo implements the **ReviewCraft** design handed off from Claude Design.

```
socialreviewcard/
├── backend/    # .NET 8 Minimal API + PostgreSQL + Identity + Stripe
└── frontend/   # React + Vite + TypeScript + Tailwind (the ReviewCraft studio)
```

---

## Frontend (`/frontend`)

React 18 + Vite + TypeScript + Tailwind recreation of the ReviewCraft studio:

- Two-column studio: live control panel (left) + scaled live preview (right).
- 5 platforms, clickable star rating, avatar mode, Story/Post aspect ratios.
- 4 card styles (Glassmorphism, Stark White, Dark Sleek, Neo-Brutalism), 5
  backgrounds (3 gradients + 2 solids), grain toggle, serif/sans typography.
- **Export** rasterizes the full-resolution card with `html2canvas` and downloads a PNG.
- **Auth** (sign in / register) against the backend Identity API.
- **Save to cloud** persists the card config; **My saved cards** lists/loads/deletes them.
- **Upgrade to Pro** ($1.99/mo) starts a Stripe Checkout session.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxies /api -> http://localhost:5080)
npm run build    # type-check + production build to dist/
```

Configure the API origin for production builds via `frontend/.env`
(`VITE_API_BASE`, see `.env.example`). In dev the Vite proxy forwards `/api`.

---

## Backend (`/backend`)

.NET 8 Web API (Minimal APIs, single-project monolith).

- **PostgreSQL** via EF Core (`Npgsql`).
- **Auth**: native `MapIdentityApi<ApplicationUser>()` mounted under `/api/auth`.
- **Cards**: `GET/POST /api/cards`, `DELETE /api/cards/{id}` (all `[Authorize]`).
- **Billing**: `POST /api/billing/checkout` (`[Authorize]`) and
  `POST /api/billing/webhook` (anonymous, Stripe-signature verified).
- Migrations are applied automatically on startup.

```bash
cd backend
dotnet restore
dotnet run        # http://localhost:5080
```

### Configuration (`backend/appsettings.json`)

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string |
| `Cors:AllowedOrigins` | Allowed frontend origins |
| `Stripe:SecretKey` | Stripe secret key (`sk_...`) |
| `Stripe:WebhookSecret` | Webhook signing secret (`whsec_...`) |
| `Stripe:PriceId` | Recurring price id for the $1.99/mo plan |
| `Stripe:SuccessUrl` / `CancelUrl` | Post-checkout redirect URLs |
| `Anthropic:ApiKey` | Anthropic API key (`sk-ant-...`) for screenshot import; empty disables the feature |
| `Anthropic:Model` | Vision model for review extraction (default `claude-haiku-4-5-20251001`) |
| `Anthropic:FreeDailyScanLimit` / `ProDailyScanLimit` | Per-user daily screenshot scans (default 5 / 50) |

Use user-secrets or environment variables for real keys; never commit them.

### API surface

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login → bearer + refresh token |
| POST | `/api/auth/refresh` | — | Refresh tokens |
| GET | `/api/cards` | ✅ | List the caller's cards |
| POST | `/api/cards` | ✅ | Create / update a card config |
| DELETE | `/api/cards/{id}` | ✅ | Delete an owned card |
| POST | `/api/scan/review` | ✅ | Extract review fields from a screenshot (vision LLM, daily-capped) |
| POST | `/api/billing/checkout` | ✅ | Start Stripe Checkout → `{ url }` |
| POST | `/api/billing/webhook` | — | Stripe webhook (signature verified) |
| GET | `/health` | — | Liveness probe |

### Stripe webhooks handled

- `checkout.session.completed` → stores `StripeCustomerId`, sets status `active`.
- `customer.subscription.updated` → syncs status + period end date.
- `customer.subscription.deleted` → status `canceled`.

---

## Local end-to-end

1. Start PostgreSQL and set `DefaultConnection`.
2. `cd backend && dotnet run` (migrations apply automatically).
3. `cd frontend && npm run dev`, open http://localhost:5173.
4. (Optional) `stripe listen --forward-to localhost:5080/api/billing/webhook`
   and put the resulting `whsec_...` in `Stripe:WebhookSecret`.
