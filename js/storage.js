// storage.js
// Unico punto di accesso a IndexedDB per GKEEPERS. Nessun altro modulo tocca
// indexedDB direttamente: tutti passano da qui (stesso principio del vecchio
// repository-portieri).

const DB_NAME = 'gkeepers-db';
const DB_VERSION = 1;

const STORE_NAMES = [
  'portieri', 'squadre', 'stagioni', 'eventi',
  'esercizi', 'sedute', 'termini', 'gruppi',
  'customLists', 'profile',
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function txStore(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAll(storeName) {
  const store = await txStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function get(storeName, id) {
  if (!id) return null;
  const store = await txStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function put(storeName, record) {
  const store = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName, id) {
  const store = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function now() {
  return new Date().toISOString();
}

// Inizializza le liste personalizzate di default SOLO se non esistono già.
// Non sovrascrive mai liste già presenti/personalizzate (vedi nota di progetto:
// non ripopolare le customLists su un pacchetto già in uso).
export async function ensureDefaults(defaultsMap) {
  for (const [id, items] of Object.entries(defaultsMap)) {
    const existing = await get('customLists', id);
    if (!existing) {
      await put('customLists', { id, items, updatedAt: now() });
    }
  }
  const profile = await get('profile', 'profile');
  if (!profile) {
    await put('profile', { id: 'profile', nome: '', createdAt: now(), updatedAt: now() });
  }
}

// Esporta tutti gli store in un unico oggetto backup.
export async function exportAll() {
  const stores = {};
  for (const name of STORE_NAMES) {
    stores[name] = await getAll(name);
  }
  return { exportedAt: now(), stores };
}

// Importa un backup: un'UNICA transazione IndexedDB su tutti gli store
// (stesso principio del vecchio repository-portieri) — o va tutto a buon
// fine o niente viene scritto. Scrive per "put" (aggiunge/aggiorna per id),
// non svuota gli store prima: un import non cancella dati non presenti nel
// backup, si limita a unire/sovrascrivere quelli con lo stesso id.
export async function importAll(backup) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const names = Object.keys(backup.stores || {}).filter((n) => STORE_NAMES.includes(n));
    const tx = db.transaction(names, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    for (const name of names) {
      const store = tx.objectStore(name);
      for (const record of backup.stores[name]) store.put(record);
    }
  });
}

// Conteggio record per store, usato per l'anteprima prima di confermare
// un import.
export function countByStore(backup) {
  const out = {};
  for (const [name, records] of Object.entries(backup.stores || {})) {
    out[name] = Array.isArray(records) ? records.length : 0;
  }
  return out;
}
