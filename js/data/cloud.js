// js/data/cloud.js — unico file che sa dell'esistenza di Supabase (database E storage). Il resto
// dell'app (ui.js, storage.js) non lo importa mai direttamente: passa sempre da data/sync.js. Se
// in futuro si cambiasse provider cloud, o si aggiungesse un campo immagine a un nuovo store
// (vedi js/data/config.js IMAGE_FIELDS), è questo l'unico file da riscrivere.
//
// Le immagini (allegati esercizio, foto portiere, logo profilo) non viaggiano mai come base64
// dentro la riga della tabella: vengono caricate su Supabase Storage una sola volta per contenuto
// (percorso = hash SHA-256 del data URL, così la stessa immagine — anche riusata su record
// diversi, o arrivata da un altro dispositivo — non viene mai ricaricata due volte) e nella riga
// resta solo il percorso. Vedi resolveImagesForUpload/resolveImagesForDownload più sotto.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SCHEMA, STORAGE_BUCKET, conflictKeyFor, imageFieldsFor } from './config.js';
import { storage } from '../storage.js';
import { stripProfileForExport } from '../importExport.js';

let clientPromise = null;

/** Crea il client Supabase al primo utilizzo (import dinamico da CDN: nessuna dipendenza da
 * npm/build step, coerente con il resto dell'app). Se il caricamento fallisce (es. app aperta
 * offline la primissima volta, prima che lo script sia mai stato in cache del browser) ritorna
 * null: chi chiama deve trattarlo come "cloud non disponibile ora", mai come errore fatale. */
export function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: SUPABASE_SCHEMA } });
    } catch (err) {
      console.warn('Client Supabase non disponibile (probabilmente offline):', err);
      clientPromise = null; // permette di riprovare al prossimo giro, non blocca per sempre
      return null;
    }
  })();
  return clientPromise;
}

function tableNameFor(storeName) {
  return storeName; // stesso nome dello store IndexedDB, stessa forma dei campi (camelCase)
}

/* ---------------------------------------------------------------------- */
/* Immagini: upload/download su Supabase Storage, con dedup per contenuto  */
/* ---------------------------------------------------------------------- */

const EXT_PER_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function extForDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,/.exec(dataUrl || '');
  return (match && EXT_PER_MIME[match[1]]) || 'jpg';
}

async function hashDataUrl(dataUrl) {
  const bytes = new TextEncoder().encode(dataUrl);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File non leggibile'));
    reader.readAsDataURL(blob);
  });
}

/** Carica un singolo data URL su Storage se non già presente (stesso hash = stesso contenuto: se
 * era già stato caricato, in questa sessione o in una precedente, salta l'upload). Ritorna il
 * percorso Storage, o null se il caricamento fallisce (il valore resta il suo data URL originale:
 * vedi resolveFieldForUpload, che in quel caso non lo sostituisce). */
async function ensureImageUploaded(client, userId, dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl; // già un percorso risolto o valore anomalo: passa oltre così com'è

  const hash = await hashDataUrl(dataUrl);
  const cached = await storage.imageUploadGet(hash);
  if (cached) return cached.storagePath;

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const path = `${userId}/${hash}.${extForDataUrl(dataUrl)}`;
    const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true, // idempotente: stesso hash = stesso contenuto, un secondo device può ricaricarla senza errore "già esistente"
    });
    if (error) throw error;
    await storage.imageUploadPut(hash, path);
    return path;
  } catch (err) {
    console.warn('Sync: upload immagine fallito, resta in coda al prossimo giro:', err.message || err);
    return null; // segnala al chiamante di non sostituire questo valore nel payload
  }
}

/** Scarica un singolo percorso Storage e lo converte in data URL, pronto da salvare in locale
 * esattamente come le immagini create su questo stesso dispositivo. Ritorna null se il download
 * fallisce (rete assente a metà pull, file non ancora propagato...): chi chiama deve trattare il
 * campo come "non disponibile per ora", senza bloccare il resto del record. */
async function downloadImageAsDataUrl(client, storagePath) {
  if (typeof storagePath !== 'string' || storagePath.startsWith('data:')) return storagePath; // già un data URL (caso limite): passa oltre
  try {
    const { data, error } = await client.storage.from(STORAGE_BUCKET).download(storagePath);
    if (error) throw error;
    const dataUrl = await blobToDataUrl(data);
    // Anche l'immagine appena scaricata entra nella cache locale hash→percorso: se poi la si
    // modifica su QUESTO dispositivo e la si ricarica identica altrove, non viene ricaricata di
    // nuovo (è già nota come "già su Storage a questo percorso").
    const hash = await hashDataUrl(dataUrl);
    await storage.imageUploadPut(hash, storagePath);
    return dataUrl;
  } catch (err) {
    console.warn(`Sync: download immagine fallito per ${storagePath}, riproverà al prossimo pull che tocchi questo record:`, err.message || err);
    return null;
  }
}

/** Risolve UN campo-immagine per l'upload, in base al suo "kind" (vedi config.js IMAGE_FIELDS):
 * "string" (un solo data URL, es. goalkeeper.photo/profile.logo) oppure "array-of-object" (es.
 * exercise.attachments, dove l'immagine è nella proprietà [key] di ciascun oggetto). Ritorna
 * { value, ok }: ok=false se almeno un'immagine non è ancora caricabile (il chiamante deve
 * rimandare l'INTERO record, non solo il campo: vedi resolveImagesForUpload/pushRecord). */
async function resolveFieldForUpload(client, userId, spec, rawValue) {
  if (spec.kind === 'string') {
    if (typeof rawValue !== 'string' || !rawValue) return { value: rawValue ?? null, ok: true };
    const path = await ensureImageUploaded(client, userId, rawValue);
    return path === null ? { value: rawValue, ok: false } : { value: path, ok: true };
  }
  if (spec.kind === 'array-of-object') {
    const arr = Array.isArray(rawValue) ? rawValue : [];
    if (!arr.length) return { value: arr, ok: true };
    const out = [];
    for (const item of arr) {
      const dataUrl = item && item[spec.key];
      if (typeof dataUrl !== 'string' || !dataUrl) { out.push(item); continue; }
      const path = await ensureImageUploaded(client, userId, dataUrl);
      if (path === null) return { value: arr, ok: false }; // rimanda l'intero record
      out.push({ ...item, [spec.key]: path });
    }
    return { value: out, ok: true };
  }
  return { value: rawValue, ok: true };
}

/** Sostituisce, in una copia del record, ogni campo-immagine con la sua forma "risolta" per il
 * cloud (percorsi Storage al posto dei data URL). Se un'immagine non riesce a caricarsi, l'INTERO
 * record resta "da riprovare": non va sincronizzato solo a metà (vedi pushRecord). */
async function resolveImagesForUpload(client, userId, storeName, record) {
  const specs = imageFieldsFor(storeName);
  if (!specs.length) return record;

  const payload = { ...record };
  for (const spec of specs) {
    const res = await resolveFieldForUpload(client, userId, spec, record[spec.path]);
    if (!res.ok) return null;
    payload[spec.path] = res.value;
  }
  return payload;
}

/** Risolve UN campo-immagine per il download (percorso Storage -> data URL locale). Le immagini
 * non scaricabili in questo giro vengono omesse (array-of-object) o azzerate (string): non
 * bloccano il resto del record, a differenza dell'upload — un record arrivato dal cloud va
 * comunque reso visibile anche con un'immagine in meno per ora. */
async function resolveFieldForDownload(client, spec, rawValue) {
  if (spec.kind === 'string') {
    if (typeof rawValue !== 'string' || !rawValue) return rawValue ?? null;
    return downloadImageAsDataUrl(client, rawValue); // null se il download fallisce
  }
  if (spec.kind === 'array-of-object') {
    const arr = Array.isArray(rawValue) ? rawValue : [];
    if (!arr.length) return arr;
    const out = [];
    for (const item of arr) {
      const path = item && item[spec.key];
      if (typeof path !== 'string' || !path) { out.push(item); continue; }
      const dataUrl = await downloadImageAsDataUrl(client, path);
      if (dataUrl) out.push({ ...item, [spec.key]: dataUrl });
      // se il download fallisce, questo allegato viene omesso dall'array per questo giro
    }
    return out;
  }
  return rawValue;
}

/** Sostituisce, in una copia del record remoto, ogni campo-immagine (percorsi Storage) con i data
 * URL scaricati, pronti per l'uso locale. */
async function resolveImagesForDownload(client, storeName, remote) {
  const specs = imageFieldsFor(storeName);
  if (!specs.length) return remote;

  const record = { ...remote };
  for (const spec of specs) {
    record[spec.path] = await resolveFieldForDownload(client, spec, remote[spec.path]);
  }
  return record;
}

/* ---------------------------------------------------------------------- */
/* Push / pull dei record (store applicativi "entità": vedi storage.js     */
/* ALL_STORES — esercizi, sedute, portieri, stagioni, eventi, presenze...) */
/* ---------------------------------------------------------------------- */

/** Invia (upsert) un singolo record verso la tabella cloud corrispondente allo store. Le eventuali
 * immagini vengono prima caricate su Storage (solo quelle non ancora presenti). Ritorna true se
 * andato a buon fine, false se va ritentato più tardi (errore di rete/temporaneo, oppure
 * un'immagine non ancora caricabile). */
export async function pushRecord(storeName, record) {
  const client = await getClient();
  if (!client) return false;

  const specs = imageFieldsFor(storeName);
  let payload = record;
  if (specs.length) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) return false;
    payload = await resolveImagesForUpload(client, session.user.id, storeName, record);
    if (!payload) return false; // almeno un'immagine non ancora caricabile: si riprova al prossimo giro
  }

  // Copia mutabile: se lo schema cloud non conosce ancora un campo del record locale (perché
  // l'app è evoluta più dello schema Supabase, o perché è un campo tecnico rimasto da una
  // versione precedente), lo si toglie SOLO da questo invio e si ritenta — il resto del record
  // arriva comunque, invece di restare bloccato per sempre in coda per colpa di un unico campo
  // sconosciuto. Non tocca mai l'oggetto locale (record): solo questa copia.
  payload = { ...payload };
  for (let tentativo = 0; tentativo < 8; tentativo++) {
    const { error } = await client
      .from(tableNameFor(storeName))
      .upsert(payload, { onConflict: conflictKeyFor(storeName) });
    if (!error) return true;

    const campoSconosciuto = /Could not find the '([^']+)' column/.exec(error.message || '')?.[1];
    if (campoSconosciuto && campoSconosciuto in payload) {
      console.warn(
        `Sync: la colonna "${campoSconosciuto}" non esiste (ancora) nello schema cloud di ${storeName}: questo campo non si sincronizza finché non aggiungi la colonna in supabase/schema.sql. Il resto del record procede comunque.`
      );
      delete payload[campoSconosciuto];
      continue;
    }

    console.warn(`Sync: push fallito per ${storeName}/${record.id}:`, error.message);
    return false;
  }
  console.warn(`Sync: push fallito per ${storeName}/${record.id}: troppi campi sconosciuti allo schema cloud.`);
  return false;
}

/** Recupera dal cloud tutti i record di uno store modificati dopo `sinceISO` (null = da sempre,
 * per il primo popolamento di un dispositivo nuovo), con le eventuali immagini già riportate a
 * data URL locali. RLS garantisce che tornino solo i record dell'utente autenticato: nessun
 * filtro per utente da scrivere qui. */
export async function pullChanges(storeName, sinceISO) {
  const client = await getClient();
  if (!client) return null; // null = "non disponibile ora", distinto da [] = "nessuna novità"
  let query = client.from(tableNameFor(storeName)).select('*').order('updatedAt', { ascending: true });
  if (sinceISO) query = query.gt('updatedAt', sinceISO);
  const { data, error } = await query;
  if (error) {
    console.warn(`Sync: pull fallito per ${storeName}:`, error.message);
    return null;
  }

  const specs = imageFieldsFor(storeName);
  if (!specs.length || !data.length) return data;
  return Promise.all(data.map((remote) => resolveImagesForDownload(client, storeName, remote)));
}

/* ---------------------------------------------------------------------- */
/* Impostazioni (customLists/profile): singleton per utente, UNA riga per */
/* chiave nella tabella "settings" (colonna "value" jsonb) — non passano  */
/* dall'outbox generico: vedi js/data/sync.js per l'orchestrazione LWW.   */
/* ---------------------------------------------------------------------- */

/** Invia le liste configurabili (gesti, qualità, materiali, frecce...) come riga singleton
 * dell'utente. Nessuna immagine qui dentro (i simboli SVG dei materiali sono markup testuale, non
 * immagini raster): upsert semplice dell'intero blob. */
export async function pushCustomLists(userId, lists) {
  const client = await getClient();
  if (!client) return false;
  const { error } = await client
    .from('settings')
    .upsert({ userId, key: 'customLists', value: lists, updatedAt: lists.updatedAt || new Date().toISOString() }, { onConflict: 'userId,key' });
  if (error) { console.warn('Sync: push configurazione fallito:', error.message); return false; }
  return true;
}

/** Ritorna { value, updatedAt } o null se non ancora presente sul cloud per questo utente
 * (dispositivo mai collegato prima, o account nuovo). */
export async function pullCustomLists(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('settings').select('value,updatedAt').eq('userId', userId).eq('key', 'customLists').maybeSingle();
  if (error) { console.warn('Sync: pull configurazione fallito:', error.message); return null; }
  return data || null;
}

/** Invia il profilo locale come riga singleton dell'utente. IMPORTANTE: pinHash/appLock non
 * lasciano MAI questo dispositivo (stesso principio già in uso per l'export JSON, vedi
 * importExport.js stripProfileForExport) — il blocco app resta sempre e solo locale, anche con la
 * sincronizzazione attiva. Il logo (data URL) viene caricato su Storage come le altre immagini. */
export async function pushProfile(userId, profile) {
  const client = await getClient();
  if (!client) return false;
  const stripped = stripProfileForExport(profile) || {};
  let logo = stripped.logo;
  if (typeof logo === 'string' && logo.startsWith('data:')) {
    const path = await ensureImageUploaded(client, userId, logo);
    if (path === null) return false; // logo non ancora caricabile: si riprova al prossimo giro
    logo = path;
  }
  const value = { ...stripped, logo };
  const { error } = await client
    .from('settings')
    .upsert({ userId, key: 'profile', value, updatedAt: profile.updatedAt || new Date().toISOString() }, { onConflict: 'userId,key' });
  if (error) { console.warn('Sync: push profilo fallito:', error.message); return false; }
  return true;
}

/** Ritorna { value, updatedAt } (con il logo già riportato a data URL locale) o null. */
export async function pullProfile(userId) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.from('settings').select('value,updatedAt').eq('userId', userId).eq('key', 'profile').maybeSingle();
  if (error) { console.warn('Sync: pull profilo fallito:', error.message); return null; }
  if (!data) return null;
  let logo = data.value && data.value.logo;
  if (typeof logo === 'string' && logo && !logo.startsWith('data:')) {
    logo = await downloadImageAsDataUrl(client, logo); // null se il download fallisce per ora
  }
  return { value: { ...data.value, logo }, updatedAt: data.updatedAt };
}
