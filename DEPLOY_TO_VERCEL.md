# Deploying Bluephes client to Vercel (serverless)

This guide steps through connecting the repo to Vercel and configuring serverless API routes.

1. Make sure `client` is pushed into GitHub.

2. On Vercel (https://vercel.com):

   - Click "Import" -> select GitHub repo.
   - For the Project Root/path, choose `client` (so Vercel builds the Next app in `client`).
   - Configure environment variables (Settings > Environment Variables):
     - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (frontend public key)
     - `PAYSTACK_SECRET` (server secret used serverless; optional if you prefer backend)
     - `NEXT_PUBLIC_USE_SERVERLESS_API=true` (make the frontend call the serverless API endpoints)
     - `NEXT_PUBLIC_FRONTEND_URL` set to your Vercel app URL (e.g. `https://your-app.vercel.app`)
     - Other OAuth envs (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`) as needed
     - `DATABASE_URL` or Prisma Data Proxy (optional if your serverless functions need DB access)

3. Trigger a deploy from Vercel. The build will run `npm run build` in the `client` folder.

4. Check the API endpoints in Vercel (for serverless APIs):
   - `https://your-app.vercel.app/api/paystack/initialize`
   - `https://your-app.vercel.app/api/paystack/verify`
   - `https://your-app.vercel.app/api/paystack/webhook` (proxy/verify behavior — see `client/pages/api/paystack/webhook.js`)

Notes:

- If you need a backend Express server (e.g. for WebSockets or long-running processes), host it on Render, Railway, or Heroku and set `NEXT_PUBLIC_API_URL` to the backend URL.
- For webhook persistence and Prisma usage in Vercel, prefer Prisma Data Proxy or external hosting for the backend to avoid connection pooling.

## Automating deploy via GitHub Actions

1. Add the following repository secrets under Settings > Secrets > Actions:

   - `VERCEL_TOKEN` (generate from your Vercel account settings)
   - `VERCEL_ORG_ID` (Vercel organization ID)
   - `VERCEL_PROJECT_ID` (Vercel project ID for the `client` app)

2. Once secrets are added, you can trigger the `deploy-vercel.yml` GitHub Action manually (Actions tab), or by pushing to `main`.

3. If you prefer to deploy locally, install Vercel CLI and run:
   - `npm i -g vercel`
   - `cd client`
   - `vercel login`
   - `vercel --prod --confirm`

If you want me to trigger the GH Action deploy automatically, please add the `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets to the repository and let me know.

### Quick CLI script

I added two helper scripts to make updating repository secrets easier:

- `scripts/set-github-secrets.ps1` (PowerShell)
- `scripts/set-github-secrets.sh` (macOS / Linux / WSL)

Usage (PowerShell - Windows):

```powershell
cd <repo-root>
.
\scripts\set-github-secrets.ps1
```

Usage (Bash / WSL / Git Bash):

```bash
cd <repo-root>
./scripts/set-github-secrets.sh
```

These scripts use the GitHub CLI (`gh`) and will prompt for values interactively if values aren't supplied via environment variables. They will set secrets in the context of the repo you run them in.

Notes:

- On Windows use `PowerShell` and the `.\scripts\set-github-secrets.ps1` script.
- If you're running `scripts/set-github-secrets.sh` on Windows, run it inside WSL, Git Bash, or a Unix-like shell (e.g., `bash ./scripts/set-github-secrets.sh`) — `./scripts/set-github-secrets.sh` won't work in regular PowerShell without an interpreter like `bash` or `wsl`.
