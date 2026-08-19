-- GKEEPERS — schema di sincronizzazione cloud
-- Da eseguire UNA VOLTA nell'SQL Editor del progetto Supabase
-- (https://xnkkacszdmrigudkwcio.supabase.co), poi:
--   Project Settings → API → "Exposed schemas" → aggiungi "gkeepers"
-- (senza questo passaggio PostgREST non espone lo schema e la app non
-- riesce a leggerlo/scriverlo).
--
-- Nessun login: le tabelle sono accessibili dal ruolo "anon" (la chiave
-- pubblica usata dalla app). Non c'è un concetto di utente proprietario dei
-- dati — è un unico spazio condiviso, come già indicato nella app.

create schema if not exists gkeepers;
grant usage on schema gkeepers to anon;

-- Una tabella per ogni "store" locale, tutte con la stessa forma:
--   id          uguale all'id locale (generato dalla app)
--   payload     il record intero, così com'è in locale
--   updated_at  usato per il confronto "chi vince" tra locale e cloud
--   deleted     soft delete, per propagare le cancellazioni tra dispositivi
do $$
declare
  t text;
begin
  foreach t in array array[
    'portieri', 'squadre', 'stagioni', 'eventi',
    'esercizi', 'sedute', 'termini', 'gruppi', 'custom_lists'
  ]
  loop
    execute format('
      create table if not exists gkeepers.%I (
        id text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now(),
        deleted boolean not null default false
      );
    ', t);

    execute format('alter table gkeepers.%I enable row level security;', t);

    execute format('drop policy if exists "anon full access" on gkeepers.%I;', t);
    execute format('
      create policy "anon full access" on gkeepers.%I
      for all to anon using (true) with check (true);
    ', t);

    execute format('grant select, insert, update, delete on gkeepers.%I to anon;', t);
  end loop;
end $$;

-- Utile in fase di verifica: elenco tabelle create nello schema.
-- select table_name from information_schema.tables where table_schema = 'gkeepers';
