# Deploying Freeroute on Render

This is the honest guide. It leads with the limitation that decides everything, because
most "deploy X to Render free" write-ups skip it and you only find out when your data
disappears.

---

## Read this first

**Render's free tier cannot host Freeroute's dashboard, and cannot keep your data.**

Three facts about the free plan, from Render's own docs:

| Render free plan | Consequence for Freeroute |
|---|---|
| No persistent disks (paid only) | `~/.freeroute/freeroute.db` and `master.key` are wiped on every deploy, restart, and spin-down |
| Spins down after 15 idle minutes; filesystem is wiped | Your providers, API keys, combos, logs and vault key are deleted **every quiet quarter-hour** |
| 512 MB RAM | The Next.js build may run out of memory during `npm run build` |

Freeroute stores everything in SQLite on local disk:

- `src/lib/db.ts:7` → `~/.freeroute/freeroute.db`
- `src/lib/secretbox.ts:12` → `~/.freeroute/master.key` (AES-256-GCM vault key)

There is no configuration flag that moves these to a free managed store. Render's free
Postgres also **expires 30 days after creation**, and Freeroute is SQLite-only — its
Prisma datasource is `provider = "sqlite"` and `src/lib/db.ts` runs raw
`ALTER TABLE` statements. Switching to Postgres is a real migration, not an env var.

**So: free Render is fine for a throwaway demo of the API gateway. It is not a home for
your real keys, combos, or usage history.**

---

## What actually works on the free tier

The **API gateway** works, because it does not use the dashboard's admin guard:

- `POST /v1/chat/completions`
- `POST /v1/messages`
- `GET /v1/models`

These authenticate with your own `xpl_…` gateway keys (`validateApiKey`), not
`adminGuard`.

The **dashboard does not work** without an extra step. All 31 dashboard routes are
wrapped in `adminGuard()`, which — when the server is bound off-loopback, as it must be
on Render — rejects every request unless `FREEROUTE_ADMIN_TOKEN` is supplied. No
front-end code sends that token (verified: zero hits for it under `src/`). You would get
a dashboard that loads and then 401s on every panel.

Section 4 covers your three options for that.

---

## 1. Prerequisites

- A Render account (no credit card needed for free services)
- This repository on GitHub — Render deploys from a Git remote
- The repo builds locally: `npm ci && npm run build`

## 2. Free deploy (gateway-only demo)

### 2a. Create the service

Render Dashboard → **New +** → **Web Service** → connect your Freeroute repo.

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npx next start -H 0.0.0.0 -p $PORT` |
| Instance Type | Free |

### 2b. Why not `npm start`

`package.json`'s `start` script runs `node scripts/start.mjs`. That wrapper:

- binds `127.0.0.1` by default (`scripts/start.mjs:33`), which Render cannot route to
- **exits with an error if `PORT` is unset** (`scripts/start.mjs:14`)

Calling `next start` directly with `-H 0.0.0.0 -p $PORT` avoids both problems.

### 2c. Environment variables

```
HOST=0.0.0.0
NODE_VERSION=20
FREEROUTE_ADMIN_TOKEN=<64+ random chars>
```

Generate a token locally — do not invent one by hand:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Notes:

- **Do not set `PORT`.** Render injects it; hard-coding it breaks routing.
- `HOST=0.0.0.0` is what tells the guard the server is network-reachable, so it stops
  trusting bare requests. Keep it paired with the token.
- `FREEROUTE_MASTER_KEY` may be left unset — the app generates `master.key` at boot.
  On free tier it is regenerated (and any vaulted secrets become undecryptable) on each
  spin-down. Set a fixed one if you care:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 2d. Create the database schema

`npm run build` runs `prisma generate && next build` — it does **not** create tables.
Push the schema on every boot, since the free disk is ephemeral:

| Setting | Value |
|---|---|
| Start Command | `npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p $PORT` |

### 2e. Get a gateway key

With the dashboard 401ing, the practical route on free tier is to run Freeroute
**locally**, create the key there, and use that key against the Render deployment's
upstream credentials. See the README's "Create a Gateway API Key".

Because the free filesystem resets, any key you create on Render is lost on the next
spin-down. Do not build anything durable on it.

### 2f. Test it

```bash
curl -X POST "https://YOUR-SERVICE.onrender.com/v1/chat/completions" \
  -H "Authorization: Bearer xpl_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"YOUR_MODEL","messages":[{"role":"user","content":"hi"}]}'
```

Expect a ~1 minute cold start on the first request after 15 idle minutes.

## 3. What you lose on free tier

Spell it out, so nothing is a surprise:

- Every provider and its API key
- Every gateway key (`xpl_…`)
- Every combo and fallback tier
- All `RequestLog` usage/cost history
- Combos' cooldown state
- The vault key, so any exported `secretEnc` blobs become unreadable

Render's terms also allow restarting a free service at any time, and suspending services
that make heavy outbound calls — which is exactly what an AI gateway does. Expect
throttling or suspension under real traffic.

---

## 4. Making the dashboard work

Pick one. Options A and B need **no code changes**.

### Option A — Cloudflare Tunnel (keeps the loopback boundary) ✅ recommended

This is the only option that leaves the security model intact. `adminGuard()` trusts a
request when `process.env.HOST` is loopback. `cloudflared` runs *inside* the container
and connects to `127.0.0.1`, so set `HOST=127.0.0.1` and let the tunnel be the only
path in:

```
HOST=127.0.0.1
PORT=3000
```

Start command:

```
npx prisma db push --skip-generate && (npx next start -H 127.0.0.1 -p 3000 & cloudflared tunnel --url http://127.0.0.1:3000)
```

Then **gate the tunnel with Cloudflare Access** (Zero Trust → Access → Application). Without
Access, you have simply published an unauthenticated admin dashboard — with every provider
credential in it — to the public internet.

Note the guard reads `HOST`, not the peer socket. So a tunnel request is indistinguishable
from a local one *by design*; the tunnel provider must do the authenticating.

### Option B — Token-injecting reverse proxy

Run a tiny sidecar that adds the admin header on the way through and exposes it on Render's
port. Same effect as A without Cloudflare, but it means any visitor to the public URL is a
full admin. Only acceptable behind Render's IP allowlist or a private service.

### Option C — Change the front end

Have the dashboard send `Authorization: Bearer <FREEROUTE_ADMIN_TOKEN>`. This needs a shared
fetch wrapper across every page and careful handling of `EventSource` (which cannot set
headers — it must use the `?admin=<token>` query parameter the guard supports). It is the
correct long-term fix for hosted use, and it is a real chunk of work, not a config tweak.

---

## 5. The supported path: paid + persistent disk

If you want this to actually hold your data, this is the configuration that works.

| Setting | Value |
|---|---|
| Instance Type | Starter — $7/mo (never spins down) |
| Disk | 1 GB at `$0.25/GB/mo`, mount path `/var/data` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p $PORT` |

Environment:

```
HOST=0.0.0.0
NODE_VERSION=20
DATABASE_URL=file:/var/data/freeroute.db
FREEROUTE_MASTER_KEY=<fixed 64-hex string, backed up somewhere safe>
FREEROUTE_ADMIN_TOKEN=<64+ random chars>
```

`src/lib/db.ts:16` accepts `DATABASE_URL` unless it contains `./dev.db` or `~`, so an
absolute path like the above is used as-is and lands on the disk.

**Back up `FREEROUTE_MASTER_KEY`.** Lose it and every vaulted provider secret in the DB is
permanently undecryptable. Treat it like a password.

Persistent disks disable zero-downtime deploys — expect a few seconds of downtime per deploy.

You still need Option A/B/C above for dashboard access, since `HOST=0.0.0.0` means the
guard requires a token.

---

## 6. Render Blueprint (optional)

Save as `render.yaml` in the repo root, then use **New + → Blueprint**:

```yaml
services:
  - type: web
    name: freeroute
    runtime: node
    plan: starter          # "free" works only for gateway-only demos
    buildCommand: npm ci && npm run build
    startCommand: npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p $PORT
    envVars:
      - key: HOST
        value: 0.0.0.0
      - key: NODE_VERSION
        value: "20"
      - key: DATABASE_URL
        value: file:/var/data/freeroute.db
      - key: FREEROUTE_MASTER_KEY
        sync: false        # prompted in the dashboard, never committed
      - key: FREEROUTE_ADMIN_TOKEN
        sync: false
    disk:
      name: freeroute-data
      mountPath: /var/data
      sizeGB: 1
```

`sync: false` keeps secrets out of the repo. Never commit real values here.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `PORT is not set` then exit | using `npm start` (`scripts/start.mjs`) | use `next start -H 0.0.0.0 -p $PORT` |
| 502 / can't connect | bound to `127.0.0.1` | `-H 0.0.0.0` |
| Every dashboard panel 401s | `adminGuard` + no token from browser | Option A, B, or C in §4 |
| `no such table: Provider` | schema never pushed | run `npx prisma db push` at start |
| Data gone after idle | free tier ephemeral disk | use a paid plan + disk (§5) |
| Build killed mid-`next build` | 512 MB free RAM | upgrade instance, or build elsewhere |
| Dashboard loads but combos are empty | DB reset, `ensureProviders()` re-seeded providers only | re-add combos via import |
| Vaulted keys won't reveal | `master.key` regenerated | pin `FREEROUTE_MASTER_KEY` |

---

## 8. Recommendation

- **Just want to try it?** Free tier, gateway-only, no real credentials in it. Accept that
  it resets.
- **Want to actually use it remotely?** $7/mo + 1 GB disk (§5), plus Cloudflare Tunnel with
  Access (§4 Option A) so the admin dashboard is not open to the world.
- **Just want remote access to your own machine?** Skip Render. Run Freeroute at home with
  its default loopback binding and reach it over Tailscale or a Cloudflare Tunnel. You keep
  the full security model, pay nothing, and keep your data.
