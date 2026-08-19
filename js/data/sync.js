// js/data/sync.js — orchestratore della sincronizzazione. È l'unico file che ui.js dovrebbe mai
// avere bisogno di conoscere oltre a data/auth.js: non tocca mai direttamente Supabase (passa da
// cloud.js) né mai IndexedDB con query dirette (passa da storage.js). Stessa architettura di
// Vacation Builder, adattata alla forma di storage.js di questa app (funzioni per-store dedicate
// invece di un accesso generico "Store", più la sincronizzazione a parte di customLists/profile —
// vedi pushSettingsIfNeeded/pullSettings più sotto).

import { storage, ALL_STORES } from '../storage.js';
import { pushRecord, pullChanges, pushCustomLists, pullCustomLists, pushProfile, pullProfile } from './cloud.js';
import { getCurrentUser, onAuthChange, initAuth } from './auth.js';

const PUSH_INTERVAL_MS = 5000; // drena l'outbox quando online
const PULL_INTERVAL_MS = 60000; // controlla novità dal cloud

const listeners = new Set();
export const state = {
  status: 'offline', // 'offline' | 'disconnesso' (nessun account collegato) | 'da_collegare' | 'idle' | 'syncing' | 'error'
  pendingCount: 0,
  lastError: null,
  lastSyncedAt: null,
};

function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function onSyncStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function refreshPendingCount() {
  setState({ pendingCount: await storage.outboxCount() });
}

/* ---------------------------------------------------------------------- */
/* Push: svuota l'outbox verso il cloud (store applicativi "entità")       */
/* ---------------------------------------------------------------------- */

async function pushPending() {
  const user = getCurrentUser();
  if (!user) return;
  const pending = await storage.outboxList();
  if (!pending.length) return;

  for (const entry of pending) {
    if (!ALL_STORES.includes(entry.store)) {
      // Voce di outbox per uno store non sincronizzabile (residuo di una versione precedente):
      // non esiste una tabella cloud per cui provare a inviarla, la si toglie e basta.
      await storage.outboxRemove(entry.id);
      continue;
    }
    const record = await storage.syncGetRecord(entry.store, entry.recordId); // include i tombstone (deletedAt): anche le eliminazioni vanno inviate
    if (!record) {
      // Il record non esiste più nemmeno in forma di tombstone (caso limite): la voce di
      // outbox non ha più senso, va tolta comunque per non restare bloccata per sempre.
      await storage.outboxRemove(entry.id);
      continue;
    }
    const ok = await pushRecord(entry.store, record);
    if (ok) await storage.outboxRemove(entry.id);
    // se fallisce, la voce resta in coda e si ritenta al giro successivo
  }
  await refreshPendingCount();
}

/* ---------------------------------------------------------------------- */
/* Pull: applica le novità dal cloud, con risoluzione dei conflitti (LWW)  */
/* ---------------------------------------------------------------------- */

/** Un record remoto vince su quello locale solo se: (a) non esiste ancora in locale, oppure
 * (b) è più recente di quello locale E quel record non ha una modifica locale ancora in coda
 * verso il cloud (altrimenti si rischierebbe di sovrascrivere una modifica fatta offline con
 * una versione più vecchia arrivata da un altro dispositivo: la modifica in coda vince sempre
 * fino a quando non è lei stessa ad essere stata inviata). */
async function applyRemote(storeName, remote, pendingKeys) {
  const key = `${storeName}::${remote.id}`;
  if (pendingKeys.has(key)) return; // modifica locale non ancora inviata: vince lei, per ora

  const locale = await storage.syncGetRecord(storeName, remote.id);
  if (!locale || new Date(remote.updatedAt) > new Date(locale.updatedAt)) {
    await storage.syncPutFromCloud(storeName, remote);
  }
}

async function pullNovita() {
  const user = getCurrentUser();
  if (!user) return;

  const meta = await storage.getSyncMeta();
  const pendingKeys = new Set((await storage.outboxList()).map((e) => e.id));
  let piuRecente = meta.lastPulledAt;

  for (const storeName of ALL_STORES) {
    const novita = await pullChanges(storeName, meta.lastPulledAt);
    if (!novita) continue; // cloud non raggiungibile ora: si riprova al prossimo giro
    for (const remote of novita) {
      await applyRemote(storeName, remote, pendingKeys);
      if (!piuRecente || remote.updatedAt > piuRecente) piuRecente = remote.updatedAt;
    }
  }
  await storage.setSyncMeta({ lastPulledAt: piuRecente });
}

/* ---------------------------------------------------------------------- */
/* Impostazioni (customLists/profile): singleton per utente, LWW dedicato, */
/* NON passa dall'outbox generico (vedi cloud.js pushCustomLists/Profile). */
/* ---------------------------------------------------------------------- */

/** Registra che la versione datata `updatedAt` di questa chiave (customLists|profile) è nota per
 * essere allineata al cloud: evita di ri-inviare (o ri-applicare) la stessa identica versione a
 * ogni giro, sia dopo un push riuscito sia dopo un pull che l'ha già applicata. */
async function _markSettingsInSync(key, updatedAt) {
  if (!updatedAt) return;
  const meta = await storage.getSyncMeta();
  const pushedAt = { ...(meta.settingsPushedAt || {}), [key]: updatedAt };
  await storage.setSyncMeta({ settingsPushedAt: pushedAt });
}

async function pushSettingsIfNeeded() {
  const user = getCurrentUser();
  if (!user) return;
  const meta = await storage.getSyncMeta();
  const pushedAt = meta.settingsPushedAt || {};

  const lists = await storage.getCustomLists();
  if (lists.updatedAt && lists.updatedAt !== pushedAt.customLists) {
    if (await pushCustomLists(user.id, lists)) await _markSettingsInSync('customLists', lists.updatedAt);
  }

  const profile = await storage.getProfile();
  if (profile && profile.updatedAt && profile.updatedAt !== pushedAt.profile) {
    if (await pushProfile(user.id, profile)) await _markSettingsInSync('profile', profile.updatedAt);
  }
}

/** Scarica customLists/profilo dal cloud e li applica in locale.
 * force=false (default, ciclo di sync normale): applica il cloud solo se il suo `updatedAt` è
 *   più recente di quello locale (LWW) — comportamento corretto quando entrambi i lati possono
 *   contenere modifiche reali dell'utente da preservare.
 * force=true (solo collegamento esplicito "dispositivo successivo", vedi linkPullingFromCloud):
 *   applica SEMPRE il cloud se una riga esiste, ignorando il confronto per data. Necessario perché
 *   le liste/il profilo di un dispositivo mai collegato prima hanno un `updatedAt` "fresco" (fissato
 *   al primo avvio dell'app, vedi storage.js getCustomLists) che le farebbe sembrare più recenti di
 *   dati cloud reali ma più vecchi, bloccando lo scarico proprio quando l'utente lo ha chiesto
 *   esplicitamente. Se il cloud non ha ancora nessuna riga, non fa nulla: restano i dati locali
 *   (anche se sono i default), che il ciclo di sync successivo caricherà sul cloud per seminarlo. */
async function pullSettings(force = false) {
  const user = getCurrentUser();
  if (!user) return;

  const remoteLists = await pullCustomLists(user.id);
  if (remoteLists) {
    const local = await storage.getCustomLists();
    const shouldApply = force || !local.updatedAt || new Date(remoteLists.updatedAt) > new Date(local.updatedAt);
    if (shouldApply) {
      // silent: applicare una versione arrivata dal cloud non è una "modifica dell'utente da
      // ripubblicare"; _markSettingsInSync sotto la segna comunque come già allineata.
      await storage.saveCustomLists({ ...remoteLists.value, updatedAt: remoteLists.updatedAt }, { silent: true });
    }
    await _markSettingsInSync('customLists', remoteLists.updatedAt);
  }

  const remoteProfile = await pullProfile(user.id);
  if (remoteProfile) {
    const local = await storage.getProfile();
    const shouldApply = force || !local || !local.updatedAt || new Date(remoteProfile.updatedAt) > new Date(local.updatedAt);
    if (shouldApply) {
      // Il blocco PIN (appLock/pinHash) NON arriva mai dal cloud (cloud.js non lo invia mai):
      // resta sempre quello già presente su questo dispositivo, o disattivato se è il primo
      // collegamento. id/createdAt del profilo restano quelli locali se già esistenti.
      const merged = {
        ...remoteProfile.value,
        updatedAt: remoteProfile.updatedAt,
        id: (local && local.id) || remoteProfile.value.id,
        createdAt: (local && local.createdAt) || remoteProfile.value.createdAt,
        appLock: (local && local.appLock) || { enabled: false, pinHash: null, lockOnStart: false },
      };
      await storage.saveProfile(merged);
    }
    await _markSettingsInSync('profile', remoteProfile.updatedAt);
  }
}

/* ---------------------------------------------------------------------- */
/* Ciclo di sincronizzazione e collegamento iniziale di un dispositivo     */
/* ---------------------------------------------------------------------- */

let running = false;
async function doSyncCycle() {
  if (running || !navigator.onLine) return;
  const user = getCurrentUser();
  if (!user) {
    setState({ status: 'disconnesso' });
    return;
  }
  // Loggato ma questo dispositivo non ha ancora deciso come collegarsi (push o pull iniziale,
  // vedi linkPushingLocalData/linkPullingFromCloud): non sincronizzare automaticamente nel
  // frattempo, altrimenti un pull userebbe un cursore lastPulledAt ereditato da un account
  // diverso eventualmente usato in precedenza su questo stesso dispositivo.
  if (await needsLinkDecision()) {
    setState({ status: 'da_collegare' });
    return;
  }
  running = true;
  setState({ status: 'syncing', lastError: null });
  try {
    await pushPending();
    await pullNovita();
    await pushSettingsIfNeeded();
    await pullSettings();
    setState({ status: 'idle', lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Sync: ciclo fallito:', err);
    setState({ status: 'error', lastError: err.message || String(err) });
  } finally {
    running = false;
    await refreshPendingCount();
  }
}

/** true se questo dispositivo non è mai stato collegato a un account cloud (o lo è stato per
 * un utente diverso da quello ora loggato): la vista Account deve chiedere esplicitamente
 * all'utente come comportarsi, invece di indovinare (vedi linkPushingLocalData/linkPullingFromCloud). */
export async function needsLinkDecision() {
  const user = getCurrentUser();
  if (!user) return false;
  const meta = await storage.getSyncMeta();
  return meta.linkedUserId !== user.id;
}

/** Primo dispositivo: manda tutto ciò che è già in locale verso il cloud. */
export async function linkPushingLocalData() {
  const user = getCurrentUser();
  if (!user) throw new Error('Devi essere autenticato.');
  await storage.outboxEnqueueAll();
  await storage.setSyncMeta({ linkedUserId: user.id, lastPulledAt: null, settingsPushedAt: {} });
  await doSyncCycle();
}

/** Dispositivo successivo: scarica tutto ciò che è già sul cloud (da un altro dispositivo).
 * Il pull di customLists/profilo è FORZATO (vedi pullSettings) ed eseguito PRIMA di qualunque
 * altra cosa: se lo si lasciasse al ciclo normale (che invia prima di scaricare), le liste/il
 * profilo di default appena creati su questo dispositivo (mai toccati dall'utente, ma con un
 * `updatedAt` "fresco") verrebbero inviati per primi, rischiando di sovrascrivere sul cloud i
 * dati reali di chi ha già usato l'app altrove — esattamente il contrario di quello che l'utente
 * ha chiesto scegliendo questa opzione. Se il cloud non ha ancora nessuna riga (nessuno l'ha mai
 * sincronizzata), pullSettings non fa nulla: restano i default locali, che il ciclo normale
 * successivo caricherà sul cloud per seminarlo. */
export async function linkPullingFromCloud() {
  const user = getCurrentUser();
  if (!user) throw new Error('Devi essere autenticato.');
  await storage.setSyncMeta({ linkedUserId: user.id, lastPulledAt: null, settingsPushedAt: {} });
  await pullSettings(/* force */ true);
  await doSyncCycle();
}

let pushTimer = null;
let pullTimer = null;

function startLoops() {
  stopLoops();
  pushTimer = setInterval(() => doSyncCycle(), PUSH_INTERVAL_MS);
  pullTimer = setInterval(pullNovita, PULL_INTERVAL_MS);
}

function stopLoops() {
  if (pushTimer) clearInterval(pushTimer);
  if (pullTimer) clearInterval(pullTimer);
  pushTimer = null;
  pullTimer = null;
}

/** Va chiamata una volta all'avvio dell'app. Non richiede login: se l'utente non si collega mai
 * al cloud, l'app si comporta esattamente come prima (solo IndexedDB), a parte l'outbox che
 * cresce inutilizzata (dimensione trascurabile, e comunque svuotata da storage.wipeAll). */
export async function initSync() {
  setState({ status: navigator.onLine ? 'disconnesso' : 'offline' });
  await refreshPendingCount();

  window.addEventListener('online', () => doSyncCycle());
  window.addEventListener('offline', () => setState({ status: 'offline' }));

  await initAuth();
  onAuthChange(() => doSyncCycle());

  startLoops();
  doSyncCycle();
}
