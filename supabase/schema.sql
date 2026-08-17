-- ============================================================================
-- Repository Esercizi Portieri — schema cloud per la sincronizzazione multi-dispositivo
-- ============================================================================
-- Da eseguire UNA VOLTA nell'SQL Editor del progetto Supabase condiviso della suite
-- (lo stesso già usato da Vacation Builder / Preventivi Stampa 3D: xnkkacszdmrigudkwcio —
-- stesso account, schema diverso, per non far collidere le tabelle restando dentro ai limiti
-- del piano gratuito). Idempotente: si può rieseguire senza effetti collaterali distruttivi
-- (usa "if not exists" ovunque possibile).
--
-- Convenzione deliberata: nomi di colonna in camelCase tra virgolette doppie, identici ai
-- campi usati lato client (js/storage.js, js/importExport.js). Evita un livello di mappatura
-- camelCase <-> snake_case nel client: un record IndexedDB si invia/riceve così com'è, senza
-- trasformazioni — tranne i campi immagine (vedi sotto), che nella riga contengono percorsi
-- Supabase Storage invece dei data URL locali.
--
-- Id: "text" (non "uuid") per tutte le chiavi primarie applicative — gli id sono generati dal
-- client con crypto.randomUUID() (già un UUID valido, quindi comunque compatibile), con un
-- fallback testuale non-UUID per i rarissimi contesti senza Web Crypto (vedi js/importExport.js
-- genId()): "text" evita che quel caso limite faccia fallire un push.
--
-- Dopo aver eseguito questo script, un passaggio manuale nel pannello (vedi anche
-- supabase/README.md): Project Settings -> Data API -> "Exposed schemas" -> aggiungi "portieri"
-- (per default Supabase espone via API solo lo schema "public"; se hai già collegato Vacation
-- Builder o Preventivi Stampa 3D sullo stesso progetto, i loro schemi saranno già presenti:
-- aggiungi "portieri" accanto, senza toccare le altre righe).
-- ============================================================================

create schema if not exists portieri;

-- Permette al ruolo delle richieste autenticate (quello usato dal client con la sessione
-- utente) di vedere lo schema; l'accesso riga per riga resta comunque filtrato dalle policy
-- RLS sotto, questo grant apre solo la "porta dello schema".
grant usage on schema portieri to authenticated;

-- ----------------------------------------------------------------------------
-- Funzione di appoggio: timestamp "updatedAt" sempre autorevole lato server, per non
-- dipendere dall'orologio (potenzialmente sfasato) di ciascun dispositivo nel confronto
-- "chi ha l'ultima modifica" usato dal client per i conflitti (last-write-wins).
-- ----------------------------------------------------------------------------
create or replace function portieri.set_updated_at()
returns trigger language plpgsql as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Macro per non ripetere lo stesso boilerplate su ogni tabella.
-- Eseguita più sotto per ciascuna tabella (entità + "settings").
-- ----------------------------------------------------------------------------
create or replace function portieri._abilita_rls(nome_tabella text)
returns void language plpgsql as $$
begin
  execute format('alter table portieri.%I enable row level security', nome_tabella);

  execute format('drop policy if exists "solo i propri dati" on portieri.%I', nome_tabella);
  execute format(
    'create policy "solo i propri dati" on portieri.%I for all using ("userId" = auth.uid()) with check ("userId" = auth.uid())',
    nome_tabella
  );

  execute format('drop trigger if exists trg_updated_at on portieri.%I', nome_tabella);
  execute format(
    'create trigger trg_updated_at before insert or update on portieri.%I for each row execute function portieri.set_updated_at()',
    nome_tabella
  );

  execute format('create index if not exists %I on portieri.%I ("userId", "updatedAt")', 'idx_' || nome_tabella || '_user_updated', nome_tabella);

  execute format('grant select, insert, update, delete on portieri.%I to authenticated', nome_tabella);
end;
$$;

-- ============================================================================
-- Tabelle: una per store IndexedDB sincronizzabile (vedi js/storage.js ALL_STORES).
-- Nessun vincolo di foreign key tra tabelle applicative (solo verso auth.users): stessa scelta
-- di Vacation Builder, per restare robusti rispetto all'ordine con cui le righe arrivano
-- durante un ciclo di sincronizzazione e al soft delete ("deletedAt" tiene le righe cancellate
-- come tombstone invece di rimuoverle davvero, così l'eliminazione si propaga agli altri
-- dispositivi anziché sparire solo in locale).
--
-- Campi immagine: "attachments" (esercizi) e "photo" (portieri) contengono, lato cloud, dei
-- PERCORSI Supabase Storage (stringhe brevi, dentro "attachments" nella proprietà "dataUrl" di
-- ciascun oggetto), mai i data URL base64 usati in locale — vedi js/data/cloud.js e
-- supabase/README.md per il bucket dedicato.
--
-- Nota: se un campo locale non esiste ancora in una di queste tabelle (perché l'app è evoluta
-- più dello schema, es. un campo aggiunto di recente), il push di quel campo fallisce con un
-- errore "colonna non trovata" gestito in modo difensivo dal client (vedi js/data/cloud.js
-- pushRecord): il campo in questione resta non sincronizzato finché non aggiungi la colonna qui
-- sotto, ma il resto del record si sincronizza comunque. Il campo interno "importato" (solo
-- esercizi, mai esportato nemmeno nel backup JSON) è omesso di proposito da questa tabella per
-- lo stesso motivo: resta locale a ciascun dispositivo.
-- ============================================================================

create table if not exists portieri.exercises (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  title text,
  description text,
  svg text,
  attachments jsonb,
  links jsonb,
  notes text,
  "technicalGestures" jsonb,
  "trainedQualities" jsonb,
  "trainingPeriod" jsonb,
  materials jsonb,
  parameters jsonb,
  status text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri.sessions (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  title text,
  "exerciseIds" jsonb,
  "goalkeeperIds" jsonb,
  aggregated jsonb,
  status text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri.goalkeepers (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  "firstName" text,
  "lastName" text,
  "birthDate" text,
  category text,
  "preferredFoot" text,
  height numeric,
  photo text,
  notes jsonb,
  active boolean,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri.seasons (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  title text,
  "startDate" text,
  "endDate" text,
  mode text,
  "isCyclic" boolean,
  "cyclicTemplate" jsonb,
  weeks jsonb,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri.events (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  title text,
  "eventType" text,
  date text,
  opponent text,
  notes text,
  "goalkeeperIds" jsonb,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri.attendances (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  "genericEventId" text,
  "occasionType" text,
  "occasionId" text,
  "goalkeeperId" text,
  status text,
  notes text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri."genericEvents" (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  "seasonId" text,
  "weekId" text,
  date text,
  "eventType" text,
  "goalkeeperIds" jsonb,
  "linkedItems" jsonb,
  notes text,
  "isOverride" boolean,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists portieri."specificEvents" (
  id text primary key,
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text,
  "eventType" text,
  title text,
  date text,
  opponent text,
  location text,
  time text,
  notes text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "deletedAt" timestamptz
);

-- ============================================================================
-- "settings": singleton per utente per le liste configurabili (customLists) e il profilo
-- locale (profile). NON fa parte del giro outbox/pull generico (vedi js/data/sync.js
-- pushSettingsIfNeeded/pullSettings): una sola riga per (userId, key), sincronizzata a parte
-- con la stessa logica LWW su "updatedAt". Il profilo qui dentro NON contiene mai pinHash/
-- appLock (rimossi lato client prima dell'invio, vedi js/importExport.js
-- stripProfileForExport): il blocco con PIN resta sempre e solo locale al dispositivo, anche
-- con la sincronizzazione attiva.
-- ============================================================================
create table if not exists portieri.settings (
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  "updatedAt" timestamptz,
  primary key ("userId", key)
);

-- ============================================================================
-- RLS + trigger + indici: applicati a tutte le tabelle (entità + settings) in un colpo solo.
-- ============================================================================
select portieri._abilita_rls(t) from unnest(array[
  'exercises', 'sessions', 'goalkeepers', 'seasons', 'events', 'attendances',
  'genericEvents', 'specificEvents', 'settings'
]) as t;

-- ============================================================================
-- Storage: bucket per le immagini (allegati esercizio, foto portiere, logo profilo — vedi
-- js/data/cloud.js). Privato (non "public"): l'accesso passa sempre dalla sessione autenticata
-- del client, mai da un URL pubblico indovinabile. Percorso di ogni file: "{userId}/{hash}.
-- {ext}" — la policy sotto verifica che il primo segmento del percorso combaci con l'utente
-- autenticato, stesso principio "solo i propri dati" delle tabelle sopra.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('portieri-immagini', 'portieri-immagini', false)
on conflict (id) do nothing;

drop policy if exists "solo le proprie immagini portieri" on storage.objects;
create policy "solo le proprie immagini portieri" on storage.objects
for all
using (bucket_id = 'portieri-immagini' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'portieri-immagini' and (storage.foldername(name))[1] = auth.uid()::text);
