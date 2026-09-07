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
clears its local session, and sets the status back to disconnected.

## Hosting (must run 24/7)

This process must stay running around the clock. Good options:

- **Railway / Render / Fly.io** — deploy this folder as a worker/background
  service (start command `npm start`).
- **A small VPS** — run it under a process manager so it restarts on crash/reboot:
  - `pm2 start index.mjs --name nahla-whatsapp`
  - a `systemd` service, or
  - `screen` / `tmux` for a quick-and-dirty setup.

### Persist the `auth/` folder

The `auth/` folder holds the WhatsApp session (created by
`useMultiFileAuthState`). **Persist it across restarts** (e.g. a mounted volume
on Railway/Render/Fly, or just a stable directory on a VPS). If it is lost, the
worker has to be re-linked by scanning a new QR code.

## Security

The `service_role` key bypasses Row Level Security and has full admin access to
your database. Keep it **only** in this worker's `.env` file. Never commit it,
never ship it to the browser or the Next.js app, and never expose it publicly.
`.env` and `auth/` are already git-ignored.
