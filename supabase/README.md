# GKEEPERS — sincronizzazione cloud

## Passi da fare (una volta sola)

1. Apri il progetto Supabase: https://supabase.com/dashboard/project/xnkkacszdmrigudkwcio
2. **SQL Editor** → incolla il contenuto di `schema.sql` → esegui.
3. **Project Settings → API → Exposed schemas** → aggiungi `gkeepers` (di
   default Supabase espone solo `public`; senza questo passo l'app non può
   parlare con lo schema appena creato).
4. Nella app: Impostazioni → Sincronizzazione → attiva. Al primo avvio su
   ciascun dispositivo, se il cloud ha già dei dati, quelli locali vengono
   sovrascritti (vedi sotto il perché).

## Come funziona (in breve)

- **Nessun login.** Non ci sono account: la app si collega allo schema
  dedicato con una chiave pubblica ("anon"). È un unico spazio dati
  condiviso, non multi-utente.
- **Vince il più recente.** Ogni record locale e cloud ha una data di
  ultima modifica; ad ogni sincronizzazione, per ciascun record vince chi è
  più recente, nell'uno o nell'altro verso. Un dispositivo nuovo (storage
  locale vuoto) non ha nulla con cui competere: il cloud vince sempre,
  cioè il dispositivo si allinea a quello che c'è già in cloud.
- **Le cancellazioni si propagano.** Eliminare un elemento non lo rimuove
  subito del tutto: lo marca come cancellato, cosicché la cancellazione
  possa sincronizzarsi verso gli altri dispositivi allo stesso modo di
  qualunque altra modifica.
- **Manuale, non automatica.** La sincronizzazione parte quando la attivi e
  quando premi "Sincronizza ora" (più un tentativo silenzioso all'avvio
  della app, se è già attiva) — non c'è sincronizzazione continua in
  background o in tempo reale tra dispositivi aperti contemporaneamente.

## Limite noto

Senza login, i dati sono protetti solo dalla policy di accesso e dal fatto
che schema e chiave non sono pubblicizzati altrove — chiunque li avesse
potrebbe leggerli o scriverli. Per un uso personale è un compromesso
ragionevole, ma è bene saperlo.
