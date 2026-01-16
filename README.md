# Bluephes Company — Web Application

This repository contains a scaffold for Bluephes company: a Next.js frontend and an Express backend.

- `client/` — Next.js frontend (port 3000)
- `server/` — Express backend (port 4000)

Local setup (monorepo):

```powershell
npm run bootstrap
npm run start:dev
```

Note: Stripe dependencies were removed in favor of Paystack. If you still see Stripe packages installed locally, run `npm ci` in the `client` and `server` directories to refresh `node_modules` and `package-lock.json`.

Run the two apps locally (see `client/README.md` and `server/README.md`).
