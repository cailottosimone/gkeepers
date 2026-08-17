// storage.js
// Wrapper IndexedDB. Store applicativi (uno-a-uno con le tabelle cloud quando la
// sincronizzazione è collegata — vedi js/data/config.js e supabase/schema.sql):
//  - exercises, sessions, goalkeepers, seasons, events, attendances, genericEvents, specificEvents
// Più due store singleton (non per-record, sincronizzati a parte da js/data/sync.js):
//  - settings (key "customLists" e key "profile")
// Tutte le operazioni restituiscono Promise; le transazioni sono gestite in modo sicuro.
//
// SOFT DELETE (dalla v2.4, prerequisito per la sincronizzazione cloud): "delete*" non
// rimuove più il record da IndexedDB, lo marca con `deletedAt` (tombstone). Questo
// permette a un'eliminazione fatta su un dispositivo di propagarsi agli altri: un hard
// delete locale non lascerebbe alcuna traccia da sincronizzare, e un pull successivo
// potrebbe "resuscitare" il record cancellato. "get*"/"getAll*" filtrano di default i
// record eliminati (isVivo); passare includeDeleted=true per includerli (uso interno
// del motore di sync e degli export di servizio, mai dalle viste).
//
// OUTBOX: ogni scrittura applicativa (put/delete) su uno store sincronizzabile accoda
// una voce in "_outbox" (una per store+id: scritture ripetute sullo stesso record prima
// del prossimo giro di sync si sovrascrivono da sole). js/data/sync.js drena la coda
// verso il cloud. "_syncMeta" tiene lo stato della sincronizzazione (collegamento
// account, ultimo pull riuscito). "_imageUploads" è la cache hash->percorso Storage
// (vedi js/data/cloud.js). Questi tre store sono stato tecnico del solo dispositivo:
// mai esportati/importati via JSON, mai sincronizzati essi stessi.

import { buildDefaultCustomLists } from "./defaults.js";
import { migrateCustomListsToV2 } from "./importExport.js";

const DB_NAME = "RepositoryPortieriDB";
const DB_VERSION = 4;
const STORE_EXERCISES = "exercises";
const STORE_SESSIONS = "sessions";
const STORE_SETTINGS = "settings";
const STORE_GOALKEEPERS = "goalkeepers";
const STORE_SEASONS = "seasons";
const STORE_EVENTS = "events";
const STORE_ATTENDANCES = "attendances";
const STORE_GENERIC_EVENTS = "genericEvents";
const STORE_SPECIFIC_EVENTS = "specificEvents";
const STORE_OUTBOX = "_outbox";
const STORE_SYNC_META = "_syncMeta";
const STORE_IMAGE_UPLOADS = "_imageUploads";
const CUSTOM_LISTS_KEY = "customLists";
const PROFILE_KEY = "profile";

// Store applicativi "entità" (record con id/createdAt/updatedAt, uno-a-uno con le
// tabelle cloud). "settings" (customLists/profile) NON ne fa parte: è un singleton per
// utente, sincronizzato con logica dedicata in js/data/sync.js. Esportato perché
// js/data/config.js lo riusa (se in futuro si aggiunge uno store, la lista dei
// sincronizzabili si aggiorna da sola).
export const ALL_STORES = [
  STORE_EXERCISES, STORE_SESSIONS, STORE_GOALKEEPERS, STORE_SEASONS,
  STORE_EVENTS, STORE_ATTENDANCES, STORE_GENERIC_EVENTS, STORE_SPECIFIC_EVENTS
];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_EXERCISES)) {
        db.createObjectStore(STORE_EXERCISES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
      // Schema 2.2 (additivo): nuovi store per Portieri/Stagione/Presenze.
      // I dati esistenti negli store precedenti restano intatti (upgrade additivo).
      if (!db.objectStoreNames.contains(STORE_GOALKEEPERS)) {
        db.createObjectStore(STORE_GOALKEEPERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SEASONS)) {
        db.createObjectStore(STORE_SEASONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_ATTENDANCES)) {
        db.createObjectStore(STORE_ATTENDANCES, { keyPath: "id" });
      }
      // Schema 2.3 (additivo): store per gli eventi generici e specifici della Stagione.
      // Nessun dato esistente viene toccato: si aggiungono solo i nuovi store.
      if (!db.objectStoreNames.contains(STORE_GENERIC_EVENTS)) {
        db.createObjectStore(STORE_GENERIC_EVENTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SPECIFIC_EVENTS)) {
        db.createObjectStore(STORE_SPECIFIC_EVENTS, { keyPath: "id" });
      }
      // v2.4 (additiva): store tecnici per la sincronizzazione cloud. Nessun record
      // esistente viene letto o modificato qui: il campo "deletedAt" che da questa
      // versione in poi distingue i record eliminati (soft delete) è semplicemente
      // assente sui record vecchi, e viene trattato come "non eliminato" (vedi isVivo).
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_META)) {
        db.createObjectStore(STORE_SYNC_META, { keyPath: "id" }).put({ id: "default", lastPulledAt: null, linkedUserId: null });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGE_UPLOADS)) {
        db.createObjectStore(STORE_IMAGE_UPLOADS, { keyPath: "hash" });
      }
    };
    req.onblocked = () => {
      reject(new Error("Un'altra scheda con l'app aperta sta bloccando l'aggiornamento del database. Chiudi tutte le altre schede/finestre e ricarica questa pagina."));
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Apertura database non riuscita"));
  });
  return _dbPromise;
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = Array.isArray(storeName) ? null : t.objectStore(storeName);
    let result;
    try {
      result = fn(store, t);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error || new Error("Transazione fallita"));
    t.onabort = () => reject(t.error || new Error("Transazione annullata"));
  }));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function nowIso() { return new Date().toISOString(); }

/** Un record è "vivo" se non ha deletedAt valorizzato. I record scritti prima
 * dell'introduzione del soft delete non hanno affatto questo campo: undefined è
 * equivalente a null, quindi restano visibili senza bisogno di migrazione dedicata. */
function isVivo(record) { return !record.deletedAt; }

/** Accoda un record nella coda di sincronizzazione (outbox), una riga per (store, id):
 * scritture ripetute sullo stesso record prima che parta il push si sovrascrivono da
 * sole. Fallisce in silenzio se lo store non esiste ancora — il sync è un livello
 * opzionale, non deve mai far fallire una scrittura locale. */
async function enqueueOutbox(storeName, id) {
  if (!ALL_STORES.includes(storeName)) return;
  try {
    const t = await tx(STORE_OUTBOX, "readwrite", store =>
      reqToPromise(store.put({ id: `${storeName}::${id}`, store: storeName, recordId: id, queuedAt: nowIso() })));
    return t;
  } catch (err) {
    console.warn("Impossibile accodare la modifica per la sincronizzazione:", err);
  }
}

// --- Esercizi ---
async function getAllExercises(includeDeleted = false) {
  return tx(STORE_EXERCISES, "readonly", store => reqToPromise(store.getAll()))
    .then(all => includeDeleted ? all : all.filter(isVivo));
}
async function getExercise(id, includeDeleted = false) {
  const rec = await tx(STORE_EXERCISES, "readonly", store => reqToPromise(store.get(id)));
  if (!rec) return rec;
  return includeDeleted || isVivo(rec) ? rec : undefined;
}
async function putExercise(exercise) {
  const record = { ...exercise, deletedAt: null };
  await tx(STORE_EXERCISES, "readwrite", store => { store.put(record); });
  await enqueueOutbox(STORE_EXERCISES, record.id);
  return record;
}
async function deleteExercise(id) {
  const existing = await tx(STORE_EXERCISES, "readonly", store => reqToPromise(store.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_EXERCISES, "readwrite", store => { store.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_EXERCISES, id);
  return id;
}

// --- Sedute ---
async function getAllSessions(includeDeleted = false) {
  return tx(STORE_SESSIONS, "readonly", store => reqToPromise(store.getAll()))
    .then(all => includeDeleted ? all : all.filter(isVivo));
}
async function getSession(id, includeDeleted = false) {
  const rec = await tx(STORE_SESSIONS, "readonly", store => reqToPromise(store.get(id)));
  if (!rec) return rec;
  return includeDeleted || isVivo(rec) ? rec : undefined;
}
async function putSession(session) {
  const record = { ...session, deletedAt: null };
  await tx(STORE_SESSIONS, "readwrite", store => { store.put(record); });
  await enqueueOutbox(STORE_SESSIONS, record.id);
  return record;
}
async function deleteSession(id) {
  const existing = await tx(STORE_SESSIONS, "readonly", store => reqToPromise(store.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_SESSIONS, "readwrite", store => { store.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_SESSIONS, id);
  return id;
}

// --- Liste configurabili (customLists) --- singleton per utente, sync dedicato (non outbox).
async function getCustomLists() {
  const rec = await tx(STORE_SETTINGS, "readonly", store => reqToPromise(store.get(CUSTOM_LISTS_KEY)));
  if (rec && rec.value) {
    // REGOLA FONDAMENTALE: se customLists esiste già NON si reinseriscono MAI i default,
    // nemmeno se una sotto-lista è assente o vuota. Si garantisce solo l'integrità strutturale
    // (ogni sotto-lista deve essere un array) usando valori NEUTRI (array vuoto), mai i default.
    let lists = rec.value;
    let changed = false;
    // Migrazione schema 2.0: baseSetup confluisce in trainedQualities (migrazione dati, non default).
    const mig = migrateCustomListsToV2(lists);
    if (mig.changed) { lists = mig.lists; changed = true; }
    for (const key of ["technicalGestures", "trainedQualities", "trainingPeriods", "materials", "arrowTypes",
                        "goalkeeperCategories", "technicalNoteTags", "mentalNoteTags", "medicalNoteTags"]) {
      if (!Array.isArray(lists[key])) { lists[key] = []; changed = true; }
    }
    if (changed) await saveCustomLists(lists, { silent: true });
    return lists;
  }
  // Primissimo avvio assoluto: nessuna chiave customLists in IndexedDB -> SOLO ora si scrivono i default.
  const defaults = buildDefaultCustomLists();
  await saveCustomLists(defaults);
  return defaults;
}
// opts.silent: true per le sole normalizzazioni difensive in lettura (non è una modifica
// dell'utente: non deve far scattare un push cloud "rumoroso" a ogni avvio). Il timestamp
// viene comunque aggiornato solo se mancante, mai retrocesso.
async function saveCustomLists(lists, opts = {}) {
  const value = opts.silent && lists.updatedAt ? lists : { ...lists, updatedAt: nowIso() };
  return tx(STORE_SETTINGS, "readwrite", store => {
    store.put({ key: CUSTOM_LISTS_KEY, value });
    return value;
  });
}

// --- Profilo locale (singleton) ---
// Salvato come singolo record nello store "settings" (key "profile"): NON richiede
// un nuovo object store né il bump di DB_VERSION. Sincronizzabile (nome/ruolo/squadre/
// logo/contatti), MA pinHash/appLock non lasciano MAI questo dispositivo — vedi
// js/data/cloud.js, che li rimuove dal payload prima di ogni upload (stesso principio
// già in uso per l'export JSON, importExport.js stripProfileForExport).
async function getProfile() {
  const rec = await tx(STORE_SETTINGS, "readonly", store => reqToPromise(store.get(PROFILE_KEY)));
  return rec && rec.value ? rec.value : null;
}
async function saveProfile(profile) {
  return tx(STORE_SETTINGS, "readwrite", store => {
    store.put({ key: PROFILE_KEY, value: profile });
    return profile;
  });
}

// --- Operazioni bulk per import/migrazione (accodano comunque in outbox: un ripristino
// da backup o una migrazione devono propagarsi al cloud come qualunque altra modifica). ---
async function bulkPutExercises(exercises) {
  const records = exercises.map(ex => ({ ...ex, deletedAt: ex.deletedAt || null }));
  await tx(STORE_EXERCISES, "readwrite", store => { records.forEach(ex => store.put(ex)); });
  for (const ex of records) await enqueueOutbox(STORE_EXERCISES, ex.id);
  return records.length;
}
async function bulkPutSessions(sessions) {
  const records = sessions.map(s => ({ ...s, deletedAt: s.deletedAt || null }));
  await tx(STORE_SESSIONS, "readwrite", store => { records.forEach(s => store.put(s)); });
  for (const s of records) await enqueueOutbox(STORE_SESSIONS, s.id);
  return records.length;
}

// --- Entità schema 2.2 (Portieri con UI; Stagione/Eventi/Presenze solo dato per ora) ---
// Stesso pattern degli store precedenti: accesso unicamente da qui.
async function getAllGoalkeepers(includeDeleted = false) {
  return tx(STORE_GOALKEEPERS, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function getGoalkeeper(id, includeDeleted = false) {
  const rec = await tx(STORE_GOALKEEPERS, "readonly", s => reqToPromise(s.get(id)));
  if (!rec) return rec;
  return includeDeleted || isVivo(rec) ? rec : undefined;
}
async function putGoalkeeper(gk) {
  const record = { ...gk, deletedAt: null };
  await tx(STORE_GOALKEEPERS, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_GOALKEEPERS, record.id);
  return record;
}
async function deleteGoalkeeper(id) {
  const existing = await tx(STORE_GOALKEEPERS, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_GOALKEEPERS, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_GOALKEEPERS, id);
  return id;
}
async function bulkPutGoalkeepers(list) {
  const records = list.map(g => ({ ...g, deletedAt: g.deletedAt || null }));
  await tx(STORE_GOALKEEPERS, "readwrite", s => { records.forEach(g => s.put(g)); });
  for (const g of records) await enqueueOutbox(STORE_GOALKEEPERS, g.id);
  return records.length;
}

async function getAllSeasons(includeDeleted = false) {
  return tx(STORE_SEASONS, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function putSeason(x) {
  const record = { ...x, deletedAt: null };
  await tx(STORE_SEASONS, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_SEASONS, record.id);
  return record;
}
async function deleteSeason(id) {
  const existing = await tx(STORE_SEASONS, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_SEASONS, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_SEASONS, id);
  return id;
}
async function bulkPutSeasons(list) {
  const records = list.map(x => ({ ...x, deletedAt: x.deletedAt || null }));
  await tx(STORE_SEASONS, "readwrite", s => { records.forEach(x => s.put(x)); });
  for (const x of records) await enqueueOutbox(STORE_SEASONS, x.id);
  return records.length;
}

async function getAllEvents(includeDeleted = false) {
  return tx(STORE_EVENTS, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function putEvent(x) {
  const record = { ...x, deletedAt: null };
  await tx(STORE_EVENTS, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_EVENTS, record.id);
  return record;
}
async function deleteEvent(id) {
  const existing = await tx(STORE_EVENTS, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_EVENTS, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_EVENTS, id);
  return id;
}
async function bulkPutEvents(list) {
  const records = list.map(x => ({ ...x, deletedAt: x.deletedAt || null }));
  await tx(STORE_EVENTS, "readwrite", s => { records.forEach(x => s.put(x)); });
  for (const x of records) await enqueueOutbox(STORE_EVENTS, x.id);
  return records.length;
}

async function getAllAttendances(includeDeleted = false) {
  return tx(STORE_ATTENDANCES, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function putAttendance(x) {
  const record = { ...x, deletedAt: null };
  await tx(STORE_ATTENDANCES, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_ATTENDANCES, record.id);
  return record;
}
async function deleteAttendance(id) {
  const existing = await tx(STORE_ATTENDANCES, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_ATTENDANCES, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_ATTENDANCES, id);
  return id;
}
async function bulkPutAttendances(list) {
  const records = list.map(x => ({ ...x, deletedAt: x.deletedAt || null }));
  await tx(STORE_ATTENDANCES, "readwrite", s => { records.forEach(x => s.put(x)); });
  for (const x of records) await enqueueOutbox(STORE_ATTENDANCES, x.id);
  return records.length;
}

// --- Propagazione rinomina voci di customLists sui record (atomica, via cursore) ---
// Sostituisce ogni occorrenza esatta di oldVal con newVal nel campo-array indicato
// di TUTTI gli esercizi VIVI, nella stessa posizione. Ritorna il numero di esercizi modificati.
async function renameExerciseArrayValue(field, oldVal, newVal) {
  const touched = await tx(STORE_EXERCISES, "readwrite", store => new Promise((resolve, reject) => {
    const touchedIds = [];
    const now = nowIso();
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) { resolve(touchedIds); return; }
      const ex = cur.value;
      if (ex && isVivo(ex)) {
        const arr = ex[field];
        if (Array.isArray(arr)) {
          let changed = false;
          for (let i = 0; i < arr.length; i++) if (arr[i] === oldVal) { arr[i] = newVal; changed = true; }
          if (changed) { ex.updatedAt = now; cur.update(ex); touchedIds.push(ex.id); }
        }
      }
      cur.continue();
    };
  }));
  for (const id of touched) await enqueueOutbox(STORE_EXERCISES, id);
  return touched.length;
}

// Rinomina la categoria (campo scalare) di tutti i portieri vivi che avevano oldVal.
async function renameGoalkeeperCategory(oldVal, newVal) {
  const touched = await tx(STORE_GOALKEEPERS, "readwrite", store => new Promise((resolve, reject) => {
    const touchedIds = [];
    const now = nowIso();
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) { resolve(touchedIds); return; }
      const gk = cur.value;
      if (gk && isVivo(gk) && gk.category === oldVal) { gk.category = newVal; gk.updatedAt = now; cur.update(gk); touchedIds.push(gk.id); }
      cur.continue();
    };
  }));
  for (const id of touched) await enqueueOutbox(STORE_GOALKEEPERS, id);
  return touched.length;
}

// Rinomina un tag nota (technical|mental|medical) di tutti i portieri vivi, stessa posizione.
async function renameGoalkeeperNoteTag(block, oldVal, newVal) {
  const touched = await tx(STORE_GOALKEEPERS, "readwrite", store => new Promise((resolve, reject) => {
    const touchedIds = [];
    const now = nowIso();
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) { resolve(touchedIds); return; }
      const gk = cur.value;
      const tags = gk && isVivo(gk) && gk.notes && gk.notes[block] && Array.isArray(gk.notes[block].tags) ? gk.notes[block].tags : null;
      if (tags) {
        let changed = false;
        for (let i = 0; i < tags.length; i++) if (tags[i] === oldVal) { tags[i] = newVal; changed = true; }
        if (changed) { gk.updatedAt = now; cur.update(gk); touchedIds.push(gk.id); }
      }
      cur.continue();
    };
  }));
  for (const id of touched) await enqueueOutbox(STORE_GOALKEEPERS, id);
  return touched.length;
}

// --- GenericEvent (schema 2.3) --- accesso unicamente da qui.
function _inRange(date, start, end) {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}
async function getAllGenericEvents(includeDeleted = false) {
  return tx(STORE_GENERIC_EVENTS, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function getGenericEvents(filters) {
  const f = filters || {};
  const all = await getAllGenericEvents();
  return all.filter(g => {
    if (f.seasonId && g.seasonId !== f.seasonId) return false;
    if (f.weekId && g.weekId !== f.weekId) return false;
    if (f.eventType && g.eventType !== f.eventType) return false;
    if ((f.startDate || f.endDate) && !_inRange(g.date, f.startDate, f.endDate)) return false;
    return true;
  });
}
async function getGenericEvent(id, includeDeleted = false) {
  const rec = await tx(STORE_GENERIC_EVENTS, "readonly", s => reqToPromise(s.get(id)));
  if (!rec) return rec;
  return includeDeleted || isVivo(rec) ? rec : undefined;
}
async function saveGenericEvent(x) {
  const record = { ...x, deletedAt: null };
  await tx(STORE_GENERIC_EVENTS, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_GENERIC_EVENTS, record.id);
  return record;
}
async function deleteGenericEvent(id) {
  const existing = await tx(STORE_GENERIC_EVENTS, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_GENERIC_EVENTS, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_GENERIC_EVENTS, id);
  return id;
}
async function bulkPutGenericEvents(list) {
  const records = list.map(x => ({ ...x, deletedAt: x.deletedAt || null }));
  await tx(STORE_GENERIC_EVENTS, "readwrite", s => { records.forEach(x => s.put(x)); });
  for (const x of records) await enqueueOutbox(STORE_GENERIC_EVENTS, x.id);
  return records.length;
}
async function getGenericEventsByDateRange(startDate, endDate, eventType) {
  const all = await getAllGenericEvents();
  return all.filter(g => _inRange(g.date, startDate, endDate) && (!eventType || g.eventType === eventType));
}
async function getGenericEventsForSession(sessionId) {
  const all = await getAllGenericEvents();
  return all.filter(g => Array.isArray(g.linkedItems) && g.linkedItems.some(li => li && li.type === "session" && li.id === sessionId));
}
// Modifica massiva dei portieri sugli eventi generici VIVI in un range di date (atomica, via cursore).
// Aggiunge addIds (senza duplicati) e rimuove removeIds; ritorna il numero di eventi modificati.
async function updateGenericEventsGoalkeeperIds(startDate, endDate, eventType, addIds, removeIds) {
  const add = Array.isArray(addIds) ? addIds : [];
  const remove = new Set(Array.isArray(removeIds) ? removeIds : []);
  const touched = await tx(STORE_GENERIC_EVENTS, "readwrite", store => new Promise((resolve, reject) => {
    const touchedIds = [];
    const now = nowIso();
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) { resolve(touchedIds); return; }
      const g = cur.value;
      if (g && isVivo(g) && _inRange(g.date, startDate, endDate) && (!eventType || g.eventType === eventType)) {
        const before = Array.isArray(g.goalkeeperIds) ? g.goalkeeperIds : [];
        const next = before.filter(id => !remove.has(id));
        add.forEach(id => { if (id && !next.includes(id)) next.push(id); });
        const changed = next.length !== before.length || next.some((v, i) => v !== before[i]);
        if (changed) { g.goalkeeperIds = next; g.updatedAt = now; cur.update(g); touchedIds.push(g.id); }
      }
      cur.continue();
    };
  }));
  for (const id of touched) await enqueueOutbox(STORE_GENERIC_EVENTS, id);
  return touched.length;
}

// --- SpecificEvent (schema 2.3) ---
async function getAllSpecificEvents(includeDeleted = false) {
  return tx(STORE_SPECIFIC_EVENTS, "readonly", s => reqToPromise(s.getAll())).then(all => includeDeleted ? all : all.filter(isVivo));
}
async function getSpecificEvents(filters) {
  const f = filters || {};
  const all = await getAllSpecificEvents();
  return all.filter(x => {
    if (f.eventType && x.eventType !== f.eventType) return false;
    if ((f.startDate || f.endDate) && !_inRange(x.date, f.startDate, f.endDate)) return false;
    return true;
  });
}
async function getSpecificEvent(id, includeDeleted = false) {
  const rec = await tx(STORE_SPECIFIC_EVENTS, "readonly", s => reqToPromise(s.get(id)));
  if (!rec) return rec;
  return includeDeleted || isVivo(rec) ? rec : undefined;
}
async function saveSpecificEvent(x) {
  const record = { ...x, deletedAt: null };
  await tx(STORE_SPECIFIC_EVENTS, "readwrite", s => { s.put(record); });
  await enqueueOutbox(STORE_SPECIFIC_EVENTS, record.id);
  return record;
}
async function deleteSpecificEvent(id) {
  const existing = await tx(STORE_SPECIFIC_EVENTS, "readonly", s => reqToPromise(s.get(id)));
  if (!existing) return id;
  const now = nowIso();
  await tx(STORE_SPECIFIC_EVENTS, "readwrite", s => { s.put({ ...existing, deletedAt: now, updatedAt: now }); });
  await enqueueOutbox(STORE_SPECIFIC_EVENTS, id);
  return id;
}
async function bulkPutSpecificEvents(list) {
  const records = list.map(x => ({ ...x, deletedAt: x.deletedAt || null }));
  await tx(STORE_SPECIFIC_EVENTS, "readwrite", s => { records.forEach(x => s.put(x)); });
  for (const x of records) await enqueueOutbox(STORE_SPECIFIC_EVENTS, x.id);
  return records.length;
}

// --- Query Attendance per la nuova logica presenze (schema 2.3) ---
async function getAttendancesByGenericEvent(genericEventId) {
  const all = await getAllAttendances();
  return all.filter(a => a.genericEventId === genericEventId);
}
// Storico presenze di un portiere; il filtro date usa la data dell'evento generico collegato.
async function getAttendancesByGoalkeeper(goalkeeperId, startDate, endDate) {
  const all = await getAllAttendances();
  let list = all.filter(a => a.goalkeeperId === goalkeeperId);
  if (startDate || endDate) {
    const events = await getAllGenericEvents();
    const dateById = new Map(events.map(g => [g.id, g.date]));
    list = list.filter(a => _inRange(dateById.get(a.genericEventId), startDate, endDate));
  }
  return list;
}

// Sedute "fatte" da un portiere: SEMPRE calcolato a runtime dalla struttura dati reale
// (Impegni + linkedItems + Attendance), MAI un dato salvato staticamente. Così, se un Impegno
// viene eliminato o un'Attendance cambia, il risultato riflette subito lo stato reale senza
// bisogno di alcuna pulizia manuale o migrazione di dati orfani.
// Una Seduta è "fatta" da un portiere se e solo se: esiste un Impegno che la contiene nei
// linkedItems, il portiere è tra i goalkeeperIds di quell'Impegno, e la sua Attendance su
// quell'Impegno ha status ESATTAMENTE "present" (non "absent", non "excused", non assente).
// filters opzionale: { seasonId } per restringere agli Impegni di una Stagione.
// Ritorna un array aggregato per Seduta: [{ session, occurrences: [{genericEventId, date,
// eventType, seasonId}, ...] }], occurrences ordinate per data decrescente. Le sedute rimosse
// (linkedItems che puntano a id non più esistenti/eliminate) sono automaticamente escluse.
async function getCompletedSessionsForGoalkeeper(goalkeeperId, filters) {
  const f = filters || {};
  const [genericEvents, attendances, sessions] = await Promise.all([
    getAllGenericEvents(), getAllAttendances(), getAllSessions()
  ]);
  const sessById = new Map(sessions.map(s => [s.id, s]));
  const bySession = new Map(); // sessionId -> { session, occurrences: [] }
  genericEvents.forEach(ge => {
    if (!Array.isArray(ge.goalkeeperIds) || !ge.goalkeeperIds.includes(goalkeeperId)) return;
    if (f.seasonId && ge.seasonId !== f.seasonId) return;
    const att = attendances.find(a => a.genericEventId === ge.id && a.goalkeeperId === goalkeeperId);
    if (!att || att.status !== "present") return; // condizione 3: presente esatto, non assente/giustificato
    (Array.isArray(ge.linkedItems) ? ge.linkedItems : []).forEach(li => {
      if (!li || li.type !== "session") return;
      const session = sessById.get(li.id);
      if (!session) return; // seduta rimossa: nessun dato orfano, semplicemente non compare
      if (!bySession.has(li.id)) bySession.set(li.id, { session, occurrences: [] });
      bySession.get(li.id).occurrences.push({ genericEventId: ge.id, date: ge.date || null, eventType: ge.eventType || null, seasonId: ge.seasonId || null });
    });
  });
  const out = [...bySession.values()];
  out.forEach(entry => entry.occurrences.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
  out.sort((a, b) => {
    const da = a.occurrences[0] ? (a.occurrences[0].date || "") : "";
    const db = b.occurrences[0] ? (b.occurrences[0].date || "") : "";
    return db.localeCompare(da);
  });
  return out;
}

// --- Import backup completo: UNA SOLA transazione multi-store per store applicativo.
// Se una singola put fallisce (es. quota storage superata) l'intera transazione IndexedDB
// si annulla e NESSUNO degli store toccati resta modificato: niente più stato "importato a
// metà". Ogni voce passa comunque per l'outbox, come un putX qualunque. ---
async function importAllAtomic(payload) {
  const groups = [
    [STORE_EXERCISES, payload.exercises],
    [STORE_SESSIONS, payload.sessions],
    [STORE_GOALKEEPERS, payload.goalkeepers],
    [STORE_SEASONS, payload.seasons],
    [STORE_EVENTS, payload.events],
    [STORE_ATTENDANCES, payload.attendances],
    [STORE_GENERIC_EVENTS, payload.genericEvents],
    [STORE_SPECIFIC_EVENTS, payload.specificEvents]
  ].filter(([, list]) => Array.isArray(list) && list.length);

  const storeNames = groups.map(([name]) => name);
  const withSettings = payload.customLists ? [...storeNames, STORE_SETTINGS] : storeNames;
  const customListsValue = payload.customLists ? { ...payload.customLists, updatedAt: nowIso() } : null;
  if (withSettings.length) {
    await tx(withSettings, "readwrite", (_ignored, t) => {
      for (const [name, list] of groups) {
        const store = t.objectStore(name);
        for (const rec of list) store.put({ ...rec, deletedAt: rec.deletedAt || null });
      }
      // Le liste configurabili entrano nella STESSA transazione IndexedDB degli altri store:
      // o l'intero import va a buon fine, o nessuno store (liste comprese) viene toccato.
      if (customListsValue) t.objectStore(STORE_SETTINGS).put({ key: CUSTOM_LISTS_KEY, value: customListsValue });
    });
    for (const [name, list] of groups) {
      for (const rec of list) await enqueueOutbox(name, rec.id);
    }
  }
  return groups.reduce((sum, [, list]) => sum + list.length, 0);
}

async function wipeAll() {
  const storeNames = [...ALL_STORES, STORE_OUTBOX, STORE_SYNC_META, STORE_IMAGE_UPLOADS];
  await tx(storeNames, "readwrite", (_ignored, t) => {
    for (const name of storeNames) t.objectStore(name).clear();
  });
  await tx(STORE_SYNC_META, "readwrite", s => { s.put({ id: "default", lastPulledAt: null, linkedUserId: null }); });
}

/* ---------------------------------------------------------------------- */
/* Accesso generico per store applicativo, usato SOLO dal motore di sync   */
/* (js/data/sync.js): i nomi store locali coincidono con i nomi usati come  */
/* chiave verso il cloud (vedi ALL_STORES sopra), quindi non serve una     */
/* mappa di traduzione.                                                    */
/* ---------------------------------------------------------------------- */
async function syncGetRecord(storeName, id) {
  if (!ALL_STORES.includes(storeName)) return undefined;
  return tx(storeName, "readonly", s => reqToPromise(s.get(id)));
}
/** Applica un record già arrivato dal cloud: a differenza di putX non tocca deletedAt
 * (arriva già corretto dal server) e non lo rimette in outbox (altrimenti un pull
 * rimanderebbe subito un push dello stesso record, un ping-pong inutile). */
async function syncPutFromCloud(storeName, record) {
  if (!ALL_STORES.includes(storeName)) return;
  await tx(storeName, "readwrite", s => { s.put(record); });
}

/* ---------------------------------------------------------------------- */
/* Outbox: coda delle modifiche in sospeso verso il cloud (uso interno di  */
/* js/data/sync.js — vedi anche enqueueOutbox sopra, chiamata da put/delete) */
/* ---------------------------------------------------------------------- */
async function outboxList() {
  const all = await tx(STORE_OUTBOX, "readonly", s => reqToPromise(s.getAll()));
  return all.sort((a, b) => (a.queuedAt || "").localeCompare(b.queuedAt || ""));
}
async function outboxCount() {
  return tx(STORE_OUTBOX, "readonly", s => reqToPromise(s.count()));
}
async function outboxRemove(outboxId) {
  return tx(STORE_OUTBOX, "readwrite", s => { s.delete(outboxId); });
}
async function outboxClear() {
  return tx(STORE_OUTBOX, "readwrite", s => { s.clear(); });
}
/** Rimette in outbox TUTTI i record attualmente presenti in locale (eliminati inclusi):
 * usato una tantum al primo collegamento di un dispositivo con dati già presenti al cloud. */
async function outboxEnqueueAll() {
  for (const name of ALL_STORES) {
    const all = await tx(name, "readonly", s => reqToPromise(s.getAll()));
    for (const r of all) await enqueueOutbox(name, r.id);
  }
}

/* ---------------------------------------------------------------------- */
/* Stato della sincronizzazione (singleton locale, mai esportato)          */
/* ---------------------------------------------------------------------- */
async function getSyncMeta() {
  const rec = await tx(STORE_SYNC_META, "readonly", s => reqToPromise(s.get("default")));
  return rec || { id: "default", lastPulledAt: null, linkedUserId: null };
}
async function setSyncMeta(patch) {
  const current = await getSyncMeta();
  const next = { ...current, ...patch, id: "default" };
  await tx(STORE_SYNC_META, "readwrite", s => { s.put(next); });
  return next;
}

/* ---------------------------------------------------------------------- */
/* Cache locale hash immagine -> percorso Storage già caricato (uso interno */
/* di js/data/cloud.js, mai esportata/sincronizzata)                       */
/* ---------------------------------------------------------------------- */
async function imageUploadGet(hash) {
  return tx(STORE_IMAGE_UPLOADS, "readonly", s => reqToPromise(s.get(hash)));
}
async function imageUploadPut(hash, storagePath) {
  return tx(STORE_IMAGE_UPLOADS, "readwrite", s => { s.put({ hash, storagePath, cachedAt: nowIso() }); });
}

export const storage = {
  getAllExercises, getExercise, putExercise, deleteExercise,
  getAllSessions, getSession, putSession, deleteSession,
  getCustomLists, saveCustomLists,
  getProfile, saveProfile,
  bulkPutExercises, bulkPutSessions,
  getAllGoalkeepers, getGoalkeeper, putGoalkeeper, deleteGoalkeeper, bulkPutGoalkeepers,
  getAllSeasons, putSeason, deleteSeason, bulkPutSeasons,
  getAllEvents, putEvent, deleteEvent, bulkPutEvents,
  getAllAttendances, putAttendance, deleteAttendance, bulkPutAttendances,
  getAllGenericEvents, getGenericEvents, getGenericEvent, saveGenericEvent, deleteGenericEvent,
  bulkPutGenericEvents, getGenericEventsByDateRange, getGenericEventsForSession, updateGenericEventsGoalkeeperIds,
  getAllSpecificEvents, getSpecificEvents, getSpecificEvent, saveSpecificEvent, deleteSpecificEvent, bulkPutSpecificEvents,
  getAttendancesByGenericEvent, getAttendancesByGoalkeeper,
  getCompletedSessionsForGoalkeeper,
  renameExerciseArrayValue, renameGoalkeeperCategory, renameGoalkeeperNoteTag,
  importAllAtomic,
  wipeAll,
  // motore di sync (js/data/*.js)
  syncGetRecord, syncPutFromCloud,
  outboxList, outboxCount, outboxRemove, outboxClear, outboxEnqueueAll,
  getSyncMeta, setSyncMeta,
  imageUploadGet, imageUploadPut
};
