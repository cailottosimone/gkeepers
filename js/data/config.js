// js/data/config.js — unico punto di configurazione del cloud. Stessa architettura di
// Vacation Builder (stesso progetto Supabase condiviso, riusato: vedi commento sotto),
// adattata qui con un punto specifico di questa app: IMAGE_FIELDS ha una forma diversa
// perché le immagini non sono sempre "array di stringhe data URL" (vedi sotto e
// js/data/cloud.js).
//
// SUPABASE_URL e SUPABASE_ANON_KEY sono pensate da Supabase per essere pubbliche nel client (non
// sono un segreto): la sicurezza reale è nelle policy RLS del database e dello storage, non nel
// nascondere questi due valori. Sono le stesse identiche di Vacation Builder e Preventivi Stampa
// 3D: stesso progetto Supabase condiviso dall'intera suite personale, con uno schema dedicato per
// app (vedi SUPABASE_SCHEMA sotto e supabase/schema.sql) per non far collidere le tabelle restando
// dentro ai limiti del piano gratuito.

export const SUPABASE_URL = 'https://xnkkacszdmrigudkwcio.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhua2thY3N6ZG1yaWd1ZGt3Y2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTYxMjQsImV4cCI6MjEwMjAzMjEyNH0.RSHH4-ltIWiMoNOfhcXi-Wfk8aoz2gg_oGZzAuyEQzA';

// Schema Postgres dedicato a questa app dentro al progetto Supabase condiviso (vedi
// supabase/schema.sql): stesso account/progetto di Vacation Builder e Preventivi Stampa 3D,
// schema diverso.
export const SUPABASE_SCHEMA = 'portieri';

// Store applicativi da sincronizzare: uno-a-uno con le tabelle dello schema cloud (stesso nome,
// stessi campi in camelCase — vedi supabase/schema.sql). Import statico da storage.js: se in
// futuro si aggiunge uno store applicativo, questa lista si aggiorna da sola. NB: "settings"
// (customLists/profile) NON ne fa parte — è un singleton per utente, sincronizzato a parte
// (vedi pushCustomLists/pushProfile in cloud.js e sync.js).
export { ALL_STORES as SYNCABLE_STORES } from '../storage.js';

// Chiave/i di conflitto per l'upsert su Supabase, per store. Tutti gli store di questa app usano
// "id" (UUID generati dal client): nessuno store è un singleton per utente (quello è gestito a
// parte, vedi sopra), quindi qui non serve nessuna eccezione — la mappa resta vuota, mostra solo
// il punto di estensione futuro (stessa scelta di Vacation Builder).
export const CONFLICT_KEYS = {};
export function conflictKeyFor(storeName) {
  return CONFLICT_KEYS[storeName] || 'id';
}

// ----------------------------------------------------------------------------
// Immagini: a differenza di Vacation Builder (dove ogni campo-immagine è sempre un array di
// data URL), qui le immagini si presentano in forme diverse:
//   - exercises.attachments: array di OGGETTI {type,name,dataUrl} — l'immagine è dentro la
//     proprietà "dataUrl" di ciascun oggetto, il resto (type/name) va preservato così com'è.
//   - goalkeepers.photo: UNA SINGOLA stringa (non un array).
// Ogni voce qui sotto descrive come trovare/sostituire il data URL in quel campo:
//   { path, kind: 'string' }                    -> record[path] è una stringa (o null)
//   { path, kind: 'array-of-object', key }       -> record[path] è un array di oggetti,
//                                                    l'immagine è in oggetto[key]
// Il profilo (campo "logo", anch'esso una stringa singola) NON passa da qui: non è uno store di
// ALL_STORES ma un singleton sincronizzato a parte (vedi js/data/sync.js pushProfile/pullProfile),
// che riusa comunque le stesse funzioni di upload/download per-hash di cloud.js.
export const IMAGE_FIELDS = {
  exercises: [{ path: 'attachments', kind: 'array-of-object', key: 'dataUrl' }],
  goalkeepers: [{ path: 'photo', kind: 'string' }],
};
export function imageFieldsFor(storeName) {
  return IMAGE_FIELDS[storeName] || [];
}

// Bucket Supabase Storage dedicato alle immagini di questa app (vedi supabase/README.md per la
// creazione). Percorso di ogni file dentro al bucket: "{userId}/{hashContenuto}.{ext}" —
// organizzato per utente (le policy RLS dello storage verificano che il primo segmento del
// percorso combaci con auth.uid()) e indicizzato per contenuto (lo stesso file, byte per byte,
// produce sempre lo stesso percorso: un'immagine identica non viene mai caricata due volte, anche
// se usata in più record — esercizio, portiere, profilo — o su dispositivi diversi).
export const STORAGE_BUCKET = 'portieri-immagini';
