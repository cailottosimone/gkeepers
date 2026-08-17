# Setup Supabase — Repository Esercizi Portieri

Da fare una volta sola, nel pannello dello **stesso progetto Supabase già usato da Vacation
Builder** (`xnkkacszdmrigudkwcio`): un solo account, schemi diversi per app, per restare dentro
ai limiti del piano gratuito. Se invece preferisci un progetto Supabase separato solo per questa
app, crealo prima e poi sostituisci `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `js/data/config.js` con
quelli del nuovo progetto — il resto della procedura è identico.

## 1. Esegui lo schema

Dashboard → **SQL Editor** → New query → incolla tutto il contenuto di `schema.sql` → **Run**.

Crea:
- lo schema `portieri` con le 9 tabelle (una per store IndexedDB sincronizzabile, più la riga
  singleton `settings` per liste configurabili e profilo), la sicurezza per riga (RLS: ogni
  utente vede solo i propri dati) e un trigger che tiene `updatedAt` autorevole lato server
  (evita problemi di orologi non allineati tra i tuoi dispositivi);
- il bucket Storage `portieri-immagini` (privato) per gli allegati degli esercizi, le foto dei
  portieri e il logo del profilo, con la sua policy "solo i propri file".

## 2. Esponi lo schema via API — passaggio che si dimentica facilmente

Dashboard → **Project Settings** → **Data API** → sezione **Exposed schemas** → aggiungi
`portieri` alla lista (di default Supabase espone via API solo lo schema `public`; se hai già
collegato Vacation Builder o Preventivi Stampa 3D sullo stesso progetto, i loro schemi saranno
già presenti: aggiungi `portieri` accanto, senza toccare quelle righe).

Senza questo passaggio, ogni chiamata dal client fallisce con un errore tipo `schema "portieri"
not found` — è la causa più probabile se qualcosa non funziona al primo collegamento.

## 3. (Facoltativo, solo se scegli di usare la registrazione via app)

Dashboard → **Authentication** → **Providers** → verifica che "Email" sia attivo (lo è di
default). Se vuoi disattivare la conferma via email al primo `Crea account` (comodo per un uso
solo personale, un account che crei una volta e usi sempre): **Authentication** → **Sign In /
Providers** → Email → disattiva "Confirm email". Se hai già fatto questo passaggio per un'altra
app sullo stesso progetto, vale anche qui: è un'impostazione del progetto, non dello schema.

## 4. Verifica

Dopo il primo collegamento dall'app (Impostazioni → **Account e sincronizzazione**):
- Dashboard → **Table Editor** → schema `portieri` → dovresti vedere righe comparire nelle
  tabelle via via che salvi/modifichi esercizi, sedute, portieri...
- Dashboard → **Storage** → bucket `portieri-immagini` → dovresti vedere comparire un file per
  ogni immagine caricata la prima volta (organizzati in una cartella per utente).

## Note

- Il piano gratuito mette in pausa il progetto dopo 7 giorni senza query: la prima
  sincronizzazione dopo una pausa richiede qualche secondo in più per il "risveglio", nessun dato
  viene perso.
- Nessuna chiave privata è presente nel codice: `js/data/config.js` contiene solo l'URL del
  progetto e la chiave `anon`, entrambe pubbliche per design — la sicurezza è nelle policy RLS
  create da `schema.sql` (sia sulle tabelle, sia sullo storage).
- **Quota**: il piano gratuito Supabase dà 500 MB di database e 1 GB di file Storage, condivisi
  fra tutti gli schemi/bucket dello stesso progetto (quindi anche con le altre app della suite,
  se usi lo stesso account). Le immagini di questa app pesano solo sulla quota Storage, non su
  quella database: ogni immagine viene caricata una sola volta (per contenuto: la stessa immagine
  riusata altrove non occupa spazio una seconda volta) e non viene mai rimandata al cloud solo
  perché hai modificato un altro campo del record — vedi `js/data/cloud.js`. Le immagini
  caricate lato client sono inoltre ridimensionate/compresse prima di finire in IndexedDB (vedi
  `js/importExport.js` `resizeImageFile`), quindi anche più leggere in partenza.
- **Il PIN dell'app (Impostazioni → Profilo → Blocco app) non viene mai sincronizzato**: resta
  un deterrente locale a ciascun dispositivo, esattamente come nell'export/import JSON. Il resto
  del profilo (nome, ruolo, squadre, logo, contatti) segue invece l'utente sui suoi dispositivi.
- Le immagini restano comunque disponibili anche senza account collegato: il backup manuale
  (Impostazioni → Esporta tutto, JSON) le include sempre, essendo un backup completo
  dell'archivio locale.
