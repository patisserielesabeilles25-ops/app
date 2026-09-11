// Nahla Cake Panel — standalone WhatsApp worker (Baileys)
//
// This is a SEPARATE always-on service. It is NOT part of the Next.js app:
// a WhatsApp socket must live in a long-running process, which Vercel's
// serverless functions cannot provide. It talks to the app's Supabase
// database using the service role key.

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import pino from 'pino';
import { useSupabaseAuthState } from './authState.mjs';

// ---------------------------------------------------------------------------
// Config & clients
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5000;

const CONNECTION_ID = 'default';
const MESSAGE_BATCH = 10;
const SEND_DELAY_MS = 1500; // small delay between sends to avoid rate-limiting/bans

// Durable auth session lives in Supabase Storage (survives restarts / new hosts).
const AUTH_BUCKET = 'whatsapp-auth';
const AUTH_OBJECT = `${CONNECTION_ID}.json`;

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
// A second, quiet logger for Baileys itself — it is extremely chatty.
const baileysLogger = pino({ level: 'silent' });

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  log.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let sock = null;
let saveCreds = null;
let clearAuthState = null; // wipes the stored Supabase session on intentional logout
let isConnected = false;
let connecting = false;
let processingQueue = false;
let manualLogout = false; // set true while we intentionally log out (skip auto-reconnect)
let manualRestart = false; // set true while we intentionally tear down to emit a fresh QR

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function updateConnection(fields) {
  try {
    const { error } = await supabase
      .from('whatsapp_connection')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', CONNECTION_ID);
    if (error) log.error({ err: error, fields }, 'Failed to update whatsapp_connection');
  } catch (err) {
    log.error({ err }, 'Unexpected error updating whatsapp_connection');
  }
}

// ---------------------------------------------------------------------------
// WhatsApp connection
// ---------------------------------------------------------------------------

async function connectToWhatsApp() {
  if (connecting) {
    log.warn('connectToWhatsApp() called while already connecting — ignoring.');
    return;
  }
  connecting = true;

  try {
    const { state, saveCreds: save, clearState } = await useSupabaseAuthState(
      supabase,
      AUTH_BUCKET,
      AUTH_OBJECT,
    );
    saveCreds = save;
    clearAuthState = clearState;

    const { version } = await fetchLatestBaileysVersion();
    log.info({ version }, 'Using Baileys version');

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr);
          log.info('QR code received — mirroring to Supabase for the panel to display.');
          await updateConnection({ status: 'connecting', qr_code: dataUrl });
        } catch (err) {
          log.error({ err }, 'Failed to convert/store QR code');
        }
      }

      if (connection === 'open') {
        isConnected = true;
        connecting = false;
        const rawJid = sock.user?.id || '';
        // JID looks like "21377xxxxxxx:12@s.whatsapp.net" — keep just the digits.
        const phoneNumber = rawJid.split(':')[0].split('@')[0] || null;
        log.info({ phoneNumber }, 'WhatsApp connection open.');
        await updateConnection({
          status: 'connected',
          phone_number: phoneNumber,
          qr_code: null,
          last_connected_at: new Date().toISOString(),
        });
      }

      if (connection === 'close') {
        isConnected = false;
        connecting = false;

        // Intentional teardown to emit a fresh QR — the new socket is already
        // starting, so ignore this close (no status change, no reconnect).
        if (manualRestart) {
          manualRestart = false;
          return;
        }

        // lastDisconnect.error is a Boom error; read its HTTP-ish status code.
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        log.warn({ statusCode, loggedOut, manualLogout }, 'WhatsApp connection closed.');

        if (loggedOut || manualLogout) {
          manualLogout = false;
          await updateConnection({ status: 'disconnected', qr_code: null });
          // Do NOT auto-reconnect after a logout; a fresh QR scan is required.
          return;
        }

        // Standard Baileys reconnect for any non-logout close.
        log.info('Attempting reconnect...');
        await sleep(2000);
        connectToWhatsApp().catch((err) => log.error({ err }, 'Reconnect failed'));
      }
    });
  } catch (err) {
    connecting = false;
    log.error({ err }, 'connectToWhatsApp() failed');
  }
}

// ---------------------------------------------------------------------------
// Command handling (poll whatsapp_connection.command)
// ---------------------------------------------------------------------------

async function handleCommands() {
  try {
    const { data, error } = await supabase
      .from('whatsapp_connection')
      .select('command')
      .eq('id', CONNECTION_ID)
      .single();

    if (error) {
      log.error({ err: error }, 'Failed to read command');
      return;
    }

    const command = data?.command;
    if (!command) return;

    log.info({ command }, 'Received command');

    if (command === 'disconnect') {
      try {
        manualLogout = true;
        if (sock) {
          try {
            await sock.logout();
          } catch (err) {
            log.warn({ err }, 'logout() threw (continuing to clear auth)');
          }
        }
        sock = null;
        isConnected = false;
        // Clear the stored session so the next connect starts fresh.
        if (clearAuthState) await clearAuthState();
        await updateConnection({ status: 'disconnected', qr_code: null, command: null });
      } catch (err) {
        log.error({ err }, 'Error handling disconnect command');
        await updateConnection({ command: null });
      }
      return;
    }

    if (command === 'connect') {
      // Clear command first so we don't reprocess it while connecting.
      await updateConnection({ command: null });
      if (isConnected) {
        log.info('Connect command ignored — already connected.');
        return;
      }
      // If a socket is mid-handshake, tear it down so we emit a brand-new QR
      // (this is what the panel's "Refresh QR" button triggers).
      if (sock) {
        manualRestart = true;
        try {
          sock.end(undefined);
        } catch (err) {
          log.warn({ err }, 'sock.end() threw during QR refresh (continuing)');
        }
        sock = null;
      }
      connecting = false;
      await connectToWhatsApp();
      return;
    }

    // Unknown command — clear it so we don't loop.
    log.warn({ command }, 'Unknown command — clearing.');
    await updateConnection({ command: null });
  } catch (err) {
    log.error({ err }, 'Unexpected error in handleCommands');
  }
}

// ---------------------------------------------------------------------------
// Outbound message queue (whatsapp_messages)
// ---------------------------------------------------------------------------

async function markMessage(id, fields) {
  const { error } = await supabase.from('whatsapp_messages').update(fields).eq('id', id);
  if (error) log.error({ err: error, id, fields }, 'Failed to update whatsapp_messages row');
}

async function sendOne(row) {
  const jid = `${row.to_phone}@s.whatsapp.net`;

  // Optionally verify the number is on WhatsApp.
  try {
    const results = await sock.onWhatsApp(jid);
    const exists = Array.isArray(results) && results.some((r) => r?.exists);
    if (!exists) {
      log.warn({ id: row.id, to: row.to_phone }, 'Number not on WhatsApp');
      await markMessage(row.id, { status: 'failed', error: 'not on WhatsApp' });
      return;
    }
  } catch (err) {
    log.warn({ err, id: row.id }, 'onWhatsApp() check failed — proceeding with send anyway');
  }

  let content;
  if (row.media_url) {
    const res = await fetch(row.media_url);
    if (!res.ok) throw new Error(`Failed to fetch media (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const caption = row.body || undefined;

    if (row.media_type === 'video') {
      content = { video: buffer, caption };
    } else {
      // Default to image for anything else (or explicit 'image').
      content = { image: buffer, caption };
    }
  } else {
    content = { text: row.body || '' };
  }

  await sock.sendMessage(jid, content);
  await markMessage(row.id, { status: 'sent', sent_at: new Date().toISOString() });
  log.info({ id: row.id, to: row.to_phone }, 'Message sent');
}

async function processQueue() {
  if (processingQueue || !isConnected || !sock) return;
  processingQueue = true;

  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(MESSAGE_BATCH);

    if (error) {
      log.error({ err: error }, 'Failed to fetch pending messages');
      return;
    }

    if (!data || data.length === 0) return;

    log.info({ count: data.length }, 'Processing pending messages');

    for (const row of data) {
      if (!isConnected || !sock) break; // stop if we dropped mid-batch
      try {
        await sendOne(row);
      } catch (err) {
        const message = err?.message || String(err);
        log.error({ err, id: row.id }, 'Failed to send message');
        await markMessage(row.id, { status: 'failed', error: message });
      }
      await sleep(SEND_DELAY_MS);
    }
  } catch (err) {
    log.error({ err }, 'Unexpected error in processQueue');
  } finally {
    processingQueue = false;
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function tick() {
  await handleCommands();
  await processQueue();
}

async function main() {
  log.info({ POLL_INTERVAL_MS }, 'Nahla WhatsApp worker starting');

  // If a session already exists on disk, reconnect automatically on boot.
  try {
    await connectToWhatsApp();
  } catch (err) {
    log.error({ err }, 'Initial connect failed (will still poll for commands)');
  }

  // Poll loop — sequential (no overlap): wait for each tick before scheduling next.
  const loop = async () => {
    try {
      await tick();
    } catch (err) {
      log.error({ err }, 'Unexpected error in main tick');
    } finally {
      setTimeout(loop, POLL_INTERVAL_MS);
    }
  };
  loop();
}

// Never let a stray rejection/exception crash the process.
process.on('unhandledRejection', (err) => log.error({ err }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => log.error({ err }, 'Uncaught exception'));

main().catch((err) => {
  log.error({ err }, 'Fatal error in main()');
  process.exit(1);
});
