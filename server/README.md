# Bluephes Server (Express)

Quick scaffold for the Express backend. To run locally:

```powershell
cd server
npm install
npm run dev
```

Set environment variables from `.env.example` and configure your database and payment/Zoom credentials.

Additional setup notes:

- Prisma (for local dev using SQLite):

  - After `npm install`, run:
    ```powershell
    npx prisma generate
    # If you've updated the schema (e.g., added reminder models), push the schema or run migrations:
    npx prisma db push
    # For migrations in dev, you can also run:
    npx prisma migrate dev --name init
    ```
  - This will create `dev.db` in `server/prisma` and generate the Prisma client used by the app.

  ### Local network (LAN) testing

  If you want to test the frontend from a phone or another device on the same network, bind the frontend to 0.0.0.0 and set `NEXT_PUBLIC_API_URL` to your machine's LAN IP (for example `http://192.168.1.24:4000`). On the server, start the server will banner with `0.0.0.0` and prints the local network IP. Ensure firewall rules permit incoming connections for the ports you are using (3000 for frontend, 4000 for backend by default).

  ### OAuth redirect notes for LAN testing

  When testing Google or Apple OAuth from another device on your local network, register the redirect URIs in the provider console and set the corresponding server env vars (`GOOGLE_OAUTH_REDIRECT`, `APPLE_OAUTH_REDIRECT`). Example:

  - `GOOGLE_OAUTH_REDIRECT=http://<YOUR_SERVER_IP>:4000/auth/oauth/google/callback`
  - `APPLE_OAUTH_REDIRECT=http://<YOUR_SERVER_IP>:4000/auth/oauth/apple/callback`

  Also ensure `NEXT_PUBLIC_FRONTEND_URL` points to the frontend LAN address so the OAuth flow can redirect back to the browser.

- Environment variables (see `.env.example`):
  - `JWT_SECRET` — secret for signing JWTs
  - `STRIPE_SECRET` — optional Stripe secret key for payments (legacy; Paystack is the default in this repo)
  - `PAYSTACK_SECRET` — Paystack secret key for payments
  - `PAYSTACK_PUBLIC_KEY` — Paystack public key (frontend use)
  - `NEXT_PUBLIC_FRONTEND_URL` — public frontend URL used for OAuth redirects and webhooks
  - Apple/Google OAuth (optional - for social sign-in):
    - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth app credentials
    - `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` — Apple Sign In credentials
  - `DATABASE_URL` — optional for Postgres in production

Endpoints added:

- `POST /auth/register` — { email, password, name }
- `POST /auth/login` — { email, password }
- `GET /auth/me` — requires `Authorization: Bearer <token>`
- `POST /payments/initialize` — { amount } (Paystack initialize endpoint)
- `POST /payments/verify` — verify payment by reference
- `POST /recordings/upload` — multipart form file upload (field `file`)
- `GET /reminders?sessionId=...` — get reminders for a session
- `POST /reminders` — create reminder: { sessionId, text, time, repeat }
- `PUT /reminders/:id` — update reminder fields
- `DELETE /reminders/:id` — delete reminder
- `POST /reminders/:id/snooze` — snooze a reminder by minutes
- `POST /push/subscribe` — save Push subscription
- `POST /push/unsubscribe` — remove subscription

Bot (Virtual events tracking):

- `GET /bot/events` — list virtual events
- `POST /bot/events` — create a virtual event: { title, sport, start (ISO), duration (min), remoteId }
- `GET /bot/events/:id` — get event details and updates
- `POST /bot/events/:id/update` — add manual update: { payload }
- `POST /bot/events/:id/trigger` — manually trigger an event update

WebSockets (Socket.IO):

- The server exposes a Socket.IO endpoint on the same port. Clients should connect with the JWT token as a query param: `io(API_URL, { query: { token: '<JWT>' } })`.
- The messaging feature emits `new_message` events to connected recipients when messages are created.

Prisma migrations after messaging schema change:

- If you added the `Message` model, run:
  ```powershell
  npx prisma generate
  npx prisma migrate dev --name add_messages
  ```

## Deploying backend for production

This Express backend is designed to run as a Node process. For production consider using Render, Railway, DigitalOcean App Platform, or a VPS. If using Vercel for the frontend, you'll need to host the backend elsewhere or convert routes to serverless functions.

Key steps when deploying:

1. Set environment variables on the host (e.g. `DATABASE_URL`, `JWT_SECRET`, `PAYSTACK_SECRET`, OAuth credentials, `SMTP_*`, and `FRONTEND_URL` / `NEXT_PUBLIC_FRONTEND_URL`).
2. Install dependencies and generate Prisma client:

```powershell
npm install
npx prisma generate
```

3. Apply Prisma migrations on the production database:

```powershell
npx prisma migrate deploy
```

4. Start the server using a process manager (e.g. PM2) or a managed service:

```powershell
pm2 start src/index.js --name bluephes-server
```

If you prefer serverless, convert API routes to serverless functions and adjust Prisma for serverless (deploy considerations for datastores and connection pooling).

Vercel serverless tip:

- You can keep the frontend on Vercel and use the serverless API routes that live under `client/pages/api/paystack` to host `initialize` and `verify` functions on Vercel.
- Set `NEXT_PUBLIC_USE_SERVERLESS_API=true` in your Vercel environment to make the client prefer the serverless API endpoints.

### Quick Render (or Railway) deployment

Render and Railway are managed platforms that let you deploy a Node process easily:

1. Create a new service and choose the Node environment.
2. Connect your Git repository and set the build command to `npm install && npx prisma generate && npm run build` (if you have server build step) and the start command to `node src/index.js`.
3. Configure environment variables in the Render or Railway dashboard (DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET, SMTP credentials, Google/Apple OAuth keys, FRONTEND_URL, etc.).
4. Make sure you configure the `PORT` and `HOST` settings or leave defaults; Render will provide a dynamic port via `PORT` env var.
5. Add a health check route `/health` so the platform can monitor your app.

Note: Prisma connections in serverless and containerized environments may require extra pooling (e.g., using `pgbouncer` for Postgres) or using Prisma Data Proxy if using large-scale serverless.

Included Render template:

This repository includes a simple `render.yaml` service template for deploying the backend on Render. It defines a Node web service that runs `node src/index.js` and allows the platform to manage environment variables.

### Converting to serverless functions (Vercel)

Vercel prefers serverless functions. If you want to host the backend on Vercel:

1. Move routes under `api/` and export handler functions as serverless functions.
2. Use `@prisma/client` with `preview` environment settings updated for serverless or use Prisma Data Proxy.
3. Convert any long-lived resources (Socket.IO, file uploads) to managed services (e.g., third-party file storage like S3). Socket.IO is stateful and may not fit serverless well.
4. Configure `vercel.json` to expose any necessary environment variables and rewrites for your frontend to call the serverless functions.

If you'd like, I can prepare a `serverless/` conversion template for Vercel and update the routes into serverless functions. Also, I can prepare a Render/Railway `render.yaml` or `service.json` template for automatic deploys.

## Local Paystack development (no keys)

Serverless / Vercel deployment notes:

- This repo includes serverless API routes in the `client` (Next.js) app to handle Paystack initialize and verify as Next API routes (`/api/paystack/initialize`, `/api/paystack/verify`). These are suitable for Vercel or any Next serverless environment. When deployed to Vercel or using `NEXT_PUBLIC_USE_SERVERLESS_API=true`, the client will use the serverless API endpoints.
- If you host the backend as a Node process (e.g., Render), the frontend should continue to use `NEXT_PUBLIC_API_URL` to reach `http://<backend-host>/payments/initialize` and `.../verify`.

If you don't have a Paystack account for local development, the app includes a development fallback to simulate checkout and verification. When `PAYSTACK_SECRET` is not set in the environment (and NODE_ENV !== 'production'), the `/payments/initialize` endpoint will return an `authorization_url` that points to a local mock checkout page (e.g. `http://HOST:PORT/payments/mock/DEV-xxxxx`). Open the mock URL and click "Complete payment (mock)" to mark the payment as completed in the local DB.

You can also call `/payments/verify?reference=DEV-xxxxx` to confirm the payment status in the local database during testing.

Example cURL commands for testing:

```powershell
# Initialize a DEV payment with a deterministic reference
curl -X POST http://localhost:4000/payments/initialize -H "Content-Type: application/json" -d '{"email":"test@example.com","amount":100,"reference":"DEV-TEST-123"}'

# Open the mock page in your browser or complete via POST
curl -X POST http://localhost:4000/payments/mock/complete/DEV-TEST-123

# Verify payment
curl "http://localhost:4000/payments/verify?reference=DEV-TEST-123"
```

## Running tests (server)

We added an automated test suite that verifies Paystack mock initialize/complete flow and webhook persistence using Jest and Supertest. To run the tests:

```powershell
cd server
npm install
# Ensure prisma client and DB schema are initialized for tests
npx prisma generate
NPM_CONFIG_UNSAFE_PERM=true npx prisma db push
npm test
```

The tests use a `prisma/test.db` file as a SQLite DB and will create and remove it during the test run.
