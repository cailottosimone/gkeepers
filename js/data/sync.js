// data/sync.js
// Sincronizzazione bidirezionale per confronto data di modifica (LWW —
// last write wins), senza login: non c'è un concetto di "utente proprietario",
// solo un unico spazio dati condiviso nello schema cloud dedicato.
//
// Il caso "nuovo dispositivo sovrascritto dal cloud" non è un percorso a
// parte: è semplicemente cosa succede quando applichi questo stesso
// algoritmo a un dispositivo con storage locale vuoto — ogni record cloud
// vince perché in locale non c'è nulla con cui confrontarlo. Stesso
// algoritmo, nessuna domanda "primo dispositivo o successivo" da fare.
//
// Le cancellazioni sono soft-delete (storage.remove marca deleted, non
// rimuove) — indispensabile per propagare una cancellazione fatta su un
// dispositivo agli altri: un record sparito del tutto non lascia traccia
// da sincronizzare.

import * as storage from '../storage.js';
import { TABLE_MAP } from './config.js';
import { fetchTable, upsertRows } from './cloud.js';

export async function isSyncEnabled() {
  const profile = await storage.get('profile', 'profile');
  return !!profile?.syncEnabled;
}

export async function setSyncEnabled(enabled) {
  const profile = (await storage.get('profile', 'profile')) || { id: 'profile', createdAt: storage.now() };
  await storage.put('profile', { ...profile, syncEnabled: enabled, updatedAt: storage.now() });
}

export async function lastSyncInfo() {
  const profile = await storage.get('profile', 'profile');
  return { lastSyncAt: profile?.lastSyncAt || null, lastSyncError: profile?.lastSyncError || null };
}

// Sincronizza tutti gli store. Ritorna { storeName: { scaricati, caricati } }.
// Se qualcosa va storto (rete assente, Supabase irraggiungibile...) l'errore
// viene registrato su profile.lastSyncError e ripropagato al chiamante, che
// decide come mostrarlo.
export async function syncAll() {
  const risultati = {};
  try {
    for (const storeName of Object.keys(TABLE_MAP)) {
      risultati[storeName] = await syncStore(storeName);
    }
    const profile = (await storage.get('profile', 'profile')) || { id: 'profile', createdAt: storage.now() };
    await storage.put('profile', { ...profile, lastSyncAt: storage.now(), lastSyncError: null, updatedAt: storage.now() });
    return risultati;
  } catch (err) {
    const profile = (await storage.get('profile', 'profile')) || { id: 'profile', createdAt: storage.now() };
    await storage.put('profile', { ...profile, lastSyncError: String(err.message || err), updatedAt: storage.now() });
    throw err;
  }
}

async function syncStore(storeName) {
  const table = TABLE_MAP[storeName];
  const [locali, remoti] = await Promise.all([
    storage.getAll(storeName, { includeDeleted: true }),
    fetchTable(table),
  ]);
  const localiById = Object.fromEntries(locali.map((r) => [r.id, r]));
  const remotiById = Object.fromEntries(remoti.map((r) => [r.id, r]));

  let scaricati = 0;
  let caricati = 0;

  // Cloud -> locale: vince il più recente. Un locale assente perde sempre
  // (è il caso "dispositivo nuovo, sovrascritto dal cloud").
  for (const remote of remoti) {
    const locale = localiById[remote.id];
    const remoteUpdated = new Date(remote.updated_at).getTime();
    const localUpdated = locale ? new Date(locale.updatedAt).getTime() : -Infinity;
    if (!locale || remoteUpdated > localUpdated) {
      await storage.put(storeName, { ...remote.payload, id: remote.id, deleted: !!remote.deleted, updatedAt: remote.updated_at });
      scaricati++;
    }
  }

  // Locale -> cloud: stessa logica, all'inverso.
  const daCaricare = [];
  for (const locale of locali) {
    const remote = remotiById[locale.id];
    const localUpdated = new Date(locale.updatedAt).getTime();
    const remoteUpdated = remote ? new Date(remote.updated_at).getTime() : -Infinity;
    if (!remote || localUpdated > remoteUpdated) {
      const { id, updatedAt, deleted, ...rest } = locale;
      daCaricare.push({
        id, updated_at: updatedAt, deleted: !!deleted,
        payload: { ...rest, id, updatedAt },
      });
      caricati++;
    }
  }
  await upsertRows(table, daCaricare);

  return { scaricati, caricati };
}
