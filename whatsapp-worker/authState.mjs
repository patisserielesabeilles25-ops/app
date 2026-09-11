// Supabase Storage-backed Baileys auth state.
//
// Baileys' bundled `useMultiFileAuthState` writes the session to the local
// filesystem, which is lost whenever the worker restarts, redeploys, or runs on
// a host with an ephemeral disk — forcing a fresh QR scan every time. Storing
// the session in Supabase Storage instead makes the link durable: the worker
// reconnects the SAME account automatically on boot, anywhere it runs.
//
// The whole state ({ creds, keys }) is kept as one JSON object in a private
// bucket and rewritten (serialized with Baileys' BufferJSON so Buffers survive
// the round-trip) whenever it changes. Writes are serialized to avoid clobbering.

import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';

/**
 * @param supabase  service-role Supabase client
 * @param bucket    storage bucket name (e.g. 'whatsapp-auth')
 * @param objectPath object key for this connection (e.g. 'default.json')
 */
export async function useSupabaseAuthState(supabase, bucket, objectPath) {
  let creds;
  let keys = {};

  // Load any existing session.
  try {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (!error && data) {
      const text = await data.text();
      const parsed = JSON.parse(text, BufferJSON.reviver);
      creds = parsed.creds;
      keys = parsed.keys || {};
    }
  } catch {
    // No/invalid session — start fresh below.
  }
  if (!creds) creds = initAuthCreds();

  // Serialize writes so overlapping saves never clobber each other.
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(async () => {
      const body = JSON.stringify({ creds, keys }, BufferJSON.replacer);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, new Blob([body], { type: 'application/json' }), {
          upsert: true,
          contentType: 'application/json',
        });
      if (error) throw error;
    });
    return writeChain;
  };

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const out = {};
        const typeMap = keys[type] || {};
        for (const id of ids) {
          let value = typeMap[id];
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          out[id] = value;
        }
        return out;
      },
      set: async (data) => {
        for (const type of Object.keys(data)) {
          keys[type] = keys[type] || {};
          for (const id of Object.keys(data[type])) {
            const value = data[type][id];
            if (value) keys[type][id] = value;
            else delete keys[type][id];
          }
        }
        await persist();
      },
    },
  };

  const saveCreds = () => persist();

  // Clears the stored session (used on an intentional logout/disconnect).
  const clearState = async () => {
    keys = {};
    creds = initAuthCreds();
    state.creds = creds;
    try {
      await supabase.storage.from(bucket).remove([objectPath]);
    } catch {
      // best-effort
    }
  };

  return { state, saveCreds, clearState };
}
