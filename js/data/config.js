// data/config.js
// Configurazione della sincronizzazione cloud. Stesso progetto Supabase
// della suite (URL/chiave forniti direttamente, come per le altre app),
// ma schema Postgres dedicato a GKEEPERS.
//
// IMPORTANTE — nessun accesso/login: la chiave "anon" qui sotto è pensata
// per essere pubblica (è così che funziona Supabase), ma senza un sistema
// di account gli unici a proteggere i dati sono lo schema dedicato e la
// policy che consente l'accesso al ruolo "anon". Chiunque avesse questa
// stessa chiave e conoscesse lo schema potrebbe leggere/scrivere questi
// dati. Per uso personale è un compromesso ragionevole; da tenere presente.

export const SUPABASE_URL = 'https://xnkkacszdmrigudkwcio.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_z16j13lRrbWvtAISvx4ssQ_zqNBEckf';
export const SUPABASE_SCHEMA = 'gkeepers';

// Nome store locale (IndexedDB) -> nome tabella cloud (snake_case dove serve).
// "profile" non è incluso: contiene preferenze locali del dispositivo
// (se la sincronizzazione è attiva, ultimo sync), non dati da condividere.
export const TABLE_MAP = {
  portieri: 'portieri',
  squadre: 'squadre',
  stagioni: 'stagioni',
  eventi: 'eventi',
  esercizi: 'esercizi',
  sedute: 'sedute',
  termini: 'termini',
  gruppi: 'gruppi',
  customLists: 'custom_lists',
};
