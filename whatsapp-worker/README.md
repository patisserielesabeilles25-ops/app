# Nahla WhatsApp Worker

A standalone, always-on Node.js service that connects the Nahla Cake Panel to
WhatsApp using [Baileys](https://github.com/WhiskeySockets/Baileys)
(`@whiskeysockets/baileys`, the maintained fork).

## Why is this a separate service?

WhatsApp (via Baileys) requires a **persistent WebSocket connection** held open
by a **long-running process**. The Nahla Cake Panel runs on Vercel, whose
serverless functions are short-lived and cannot hold a socket open. So the
WhatsApp connection lives here, in its own always-on process, and communicates
with the panel **only through the shared Supabase database**:

- The worker mirrors its connection status into the `whatsapp_connection` table
  (single row, `id = 'default'`) — including a QR-code PNG for the panel to show.
- The panel writes commands (`connect` / `disconnect`) into that same row.
- The panel queues outbound messages into `whatsapp_messages`; the worker sends
  them and updates each row's status.

## Setup

```bash
cd whatsapp-worker
npm install
cp .env.example .env   # then edit .env
npm start
```

Fill in `.env`:

- `SUPABASE_URL` — your project URL (Supabase dashboard → Project Settings → API).
- `SUPABASE_SERVICE_KEY` — the **service_role** key (Supabase dashboard →
  Project Settings → API → `service_role` key). This is a secret admin key.
- `POLL_INTERVAL_MS` — how often to poll for commands and messages (default 5000).

## Connecting

1. Start the worker (`npm start`).
2. In the panel, open the **WhatsApp** tab and click **"Connecter"**.
3. The worker picks up the `connect` command and generates a QR code, which the
   panel displays.
4. On your phone open **WhatsApp → Settings → Linked devices → Link a device**
   and scan the QR.
5. Once linked, the panel shows **"Connecté"** and queued messages start sending.

To disconnect, click the disconnect action in the panel — the worker logs out,
clears its stored session, and sets the status back to disconnected.

## The session is durable (no re-linking)

The WhatsApp session is stored in the **Supabase Storage** bucket
`whatsapp-auth` (object `default.json`), not on the local disk — see
`authState.mjs`. This means:

- The worker **reconnects the same account automatically on boot**, on any host.
- Restarts, redeploys, crashes, or moving to a new machine do **not** require a
  new QR scan. You link once; it stays linked until you explicitly disconnect.

You therefore do **not** need to persist any local folder or mount a volume.
(The old on-disk `auth/` folder is no longer used.)

## Hosting (must run 24/7)

WhatsApp needs a persistent socket, so this process must stay running around the
clock on an always-on host (Vercel cannot do this). Pick one:

- **Railway / Render / Fly.io** — deploy this `whatsapp-worker/` folder as a
  *worker / background service* (no public port needed). Set the two env vars
  (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`); start command `node index.mjs`. A
  `Dockerfile` is included, so these platforms can build it directly.
- **A small VPS / always-on PC** — run it under a process manager so it restarts
  on crash and on reboot:
  - `pm2 start index.mjs --name nahla-whatsapp && pm2 save && pm2 startup`
  - or a `systemd` service.

Because the session is in Supabase, you can redeploy or move hosts freely — the
worker comes back connected on its own.

## Run with Docker

```bash
docker build -t nahla-whatsapp ./whatsapp-worker
docker run -d --restart unless-stopped --name nahla-whatsapp \
  -e SUPABASE_URL="https://xxxx.supabase.co" \
  -e SUPABASE_SERVICE_KEY="your-service-role-key" \
  nahla-whatsapp
```

`--restart unless-stopped` keeps it alive across crashes and machine reboots.

## Security

The `service_role` key bypasses Row Level Security and has full admin access to
your database. Keep it **only** in this worker's `.env` file (or your host's
secret manager). Never commit it, never ship it to the browser or the Next.js
app, and never expose it publicly. `.env` and `auth/` are already git-ignored.
