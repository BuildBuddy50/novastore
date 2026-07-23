# Nova Store API

A complete REST API for the Nova Store e-commerce site: products, customers, orders, authentication, and stats. No native dependencies — runs anywhere Node runs. Data persists to a `db.json` file.

## Run it

```bash
npm install
npm start
# → Nova Store API running at http://localhost:4000/api
```

On first run it seeds an admin account and 3 products:

- **Admin login:** `admin@nova.com` / `admin123`

Set a real secret before deploying:

```bash
JWT_SECRET="your-long-random-secret" PORT=4000 npm start
```

## Authentication

Most write endpoints require a **Bearer token**. Get one from `/auth/login` or `/auth/register`, then send it in the header:

```
Authorization: Bearer <token>
```

Tokens are JWTs valid for 7 days. Admin-only routes require an account with `role: "admin"`.

---

## Endpoints

### Auth

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ name, email, password }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| GET | `/api/auth/me` | user | — |

### Products

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products` | — | Query: `?category=&search=&featured=true&sort=price_asc\|price_desc\|rating` |
| GET | `/api/products/:id` | — | |
| POST | `/api/products` | admin | `{ name, price, oldPrice?, category?, stock?, image?, description?, featured? }` |
| PUT | `/api/products/:id` | admin | Partial update — send only fields to change |
| DELETE | `/api/products/:id` | admin | |

### Customers

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/customers` | admin | Add a customer directly. `{ name, email, password, role? }` |
| GET | `/api/customers` | admin | List with order counts + total spent |
| GET | `/api/customers/:id` | admin | Customer + their orders |
| DELETE | `/api/customers/:id` | admin | |

### Orders

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/orders` | — | Totals are recomputed **server-side**. `{ customer, items:[{id,qty}], coupon?, payment?, cardLast4?, userId? }` |
| GET | `/api/orders` | admin | Query: `?status=Shipped` |
| GET | `/api/orders/mine` | user | Current user's orders |
| PATCH | `/api/orders/:id/status` | admin | `{ status }` — Pending / Processing / Shipped / Delivered / Cancelled |
| DELETE | `/api/orders/:id` | admin | |

### Stats & health

| Method | Path | Auth |
|---|---|---|
| GET | `/api/stats` | admin |
| GET | `/api/health` | — |

---

## Examples (curl)

**Log in as admin, capture the token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nova.com","password":"admin123"}' | jq -r .token)
```

**Add a product:**
```bash
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Bluetooth Speaker","price":39.99,"category":"Electronics","stock":50,"featured":true}'
```

**Register a customer:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"secret123"}'
```

**Add a customer as admin:**
```bash
curl -X POST http://localhost:4000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Carl","email":"carl@example.com","password":"secret123"}'
```

**Place an order:**
```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name":"Jane Doe","email":"jane@example.com","address":"1 Main St","city":"Metropolis"},
    "items": [{"id":1,"qty":2}],
    "coupon": "SAVE10",
    "payment": "card",
    "cardLast4": "4242"
  }'
```

**Update order status:**
```bash
curl -X PATCH http://localhost:4000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"Shipped"}'
```

---

## Validation rules

- **Email** must match a standard email pattern.
- **Password** ≥ 6 characters.
- **Product price** must be a number > 0; **stock** ≥ 0.
- **Orders** require customer name, valid email, address, city, and at least one item; each item must exist and have enough stock. Order totals, discount, shipping, and tax are always calculated on the server.

## Errors

All errors return JSON `{ "error": "message" }` with an appropriate status code (400 validation, 401 missing/invalid token, 403 not admin, 404 not found, 409 conflict).

## Deploy for free

This API needs a Node host (not a static host). Free options:

- **Render** (render.com) — free web service, connect a GitHub repo, build `npm install`, start `npm start`.
- **Railway** (railway.app) — free starter, deploy from repo.
- **Fly.io** — free allowance, `fly launch`.
- **Cyclic / Glitch** — quick Node hosting.

Note: on free hosts with ephemeral disks, the `db.json` file may reset on redeploy. For durable production data, swap the storage layer in `db.js` for a hosted database (Postgres via Supabase/Neon, or MongoDB Atlas — all have free tiers). The rest of the code stays the same.

---

## Connected frontend (`frontend.html`)

`frontend.html` is the storefront + admin panel wired to this API. Every action — browsing products, signing in, placing orders, managing the catalog, adding customers, updating order status — goes through the endpoints above. No data lives in the browser except the cart, wishlist, and your login token.

### Run the whole thing locally

1. Start the API:
   ```bash
   npm install
   npm start          # http://localhost:4000/api
   ```
2. Open `frontend.html` in your browser (double-click it, or serve it):
   ```bash
   npx serve .        # then open the printed URL and click frontend.html
   ```
3. Sign in as admin (`admin@nova.com` / `admin123`) to manage the store, or register a customer account to shop.

### Pointing the frontend at a deployed API

The frontend has a small **⚙️ API** button in the bottom-left corner. Click it, paste your deployed API URL (e.g. `https://your-api.onrender.com/api`), and hit **Save & reload**. That's stored in the browser, so you don't need to edit code.

You can also change the default directly at the top of the file:
```js
const API_BASE = localStorage.getItem("ns_api_base") || "http://localhost:4000/api";
```

### Deploying both

- **Frontend** (`frontend.html`) → any static host: Netlify Drop, Cloudflare Pages, GitHub Pages, Vercel.
- **API** (`server.js`) → a Node host: Render, Railway, or Fly.io.
- After deploying the API, set its public URL in the frontend via the ⚙️ button.
- **CORS** is already enabled on the API (`app.use(cors())`), so the two can live on different domains.
