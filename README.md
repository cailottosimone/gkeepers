# Repository Esercizi Portieri — ramo "snella" (v1.0)

> **Nota**: questo pacchetto è un **ramo di sviluppo separato** ("snella"), nato da
> `repository-portieri-v2.4-001` con l'obiettivo di semplificare l'uso quotidiano
> (modalità Semplice/Completa, sedute a blocchi liberi, tag stato salute portiere,
> orari multipli in Stagione, tempi esercizi nascosti di default). Vedi CHANGELOG.md
> per il dettaglio. Il ramo originale resta disponibile e recuperabile in caso questo
> lavoro non convincesse — nessuna delle due linee di sviluppo sovrascrive l'altra.

Archivio **locale, offline e senza AI** per gestire i tuoi esercizi di
allenamento per portieri. Vanilla JavaScript + IndexedDB, nessuna dipendenza
esterna obbligatoria, interfaccia interamente in italiano.

È il "gemello offline" dell'artefatto Claude: i due strumenti condividono lo
**schema JSON v2.2**, quindi puoi esportare da qui e importare nell'artefatto
(e viceversa) senza perdere dati.

---

## Come avviarlo

L'app usa moduli ES e IndexedDB: va aperta tramite **server http**, non con
doppio clic sul file (`file://` non funziona).

### Con VS Code + Live Server (consigliato su MacBook Air)
1. Apri la cartella del progetto in Visual Studio Code.
2. Installa l'estensione **Live Server** (Ritwick Dey).
3. Clic destro su `index.html` → **Open with Live Server**.
4. Si apre su `http://127.0.0.1:5500/` (o porta simile).

### In alternativa, da terminale
```bash
cd repository-esercizi-portieri
python3 -m http.server 5500
# poi apri http://localhost:5500/
```

I dati restano nel database del browser (IndexedDB), sul tuo computer.
Usa lo stesso browser per ritrovarli. Per spostarli su un altro dispositivo,
usa l'export/import dalle Impostazioni.

---

## Funzionalità

- **Navigazione**: barra superiore con le sezioni Esercizi, Sedute, Portieri,
  Stagione, Presenze, Impostazioni, Profilo (le tre centrali sono segnaposto "in
  arrivo"); su schermi stretti collassa in un menu hamburger con drawer laterale.
  Il logo del profilo, se caricato, è sempre visibile nell'angolo della barra.
- **Profilo locale**: nome, ruolo, squadra/e, logo, contatti. Include un *blocco
  app con PIN* opzionale (hash SHA-256 nativo) — è un **deterrente locale, non una
  protezione crittografica**: il PIN non viene mai esportato e va reimpostato su
  ogni dispositivo. Reset di emergenza via `?resetlock=true`.
- **Esercizi**: titolo, descrizione, immagini allegate, link video (con range
  temporale e descrizione), note, gesti tecnici, qualità allenate, periodo di
  allenamento, materiali con quantità, e una sezione *Struttura dell'esercizio*
  (serie, ripetizioni, recupero e tempo di lavoro inteso **per serie** o **per
  ripetizione**) con durata totale calcolata e anteprima in tempo reale; stato
  (Preferito / In memoria). Il campo `timeMode` è "per_series" di default
  (retrocompatibile con gli esercizi esistenti).
- **Editor SVG interno**: tavolo tattico top-down con palette dei materiali,
  posizionamento a clic, trascinamento, aggancio alla griglia, rotazione,
  ridimensionamento, annulla. Crea nuovi schemi o modifica quelli importati.
- **Frecce con significato**: strumento Freccia nell'editor (disegno a
  trascinamento) con colore, stile (solido/tratteggiato/punteggiato/tratto-punto)
  ed etichetta. Puoi usare un "colore + stile liberi" oppure scegliere un **tipo
  di freccia** predefinito. I tipi si gestiscono in Impostazioni (sezione *Tipi
  di freccia*: nome, colore, stile, descrizione) e viaggiano nell'export JSON
  come le altre liste configurabili. Come i materiali, le frecce tipizzate sono
  **risolte a runtime**: se cambi un tipo nelle impostazioni gli esercizi salvati
  mostrano subito il nuovo stile; se elimini il tipo, la freccia diventa neutra
  con "(tipo rimosso)". Le frecce "libere" restano come disegnate.
- **Modifica degli esercizi importati**: un esercizio importato è segnalato da un
  banner. Salvandone le modifiche diventa una versione locale; in alternativa puoi
  creare una *copia locale modificabile* mantenendo intatto l'originale. Il flag
  "importato" è interno a IndexedDB e non entra mai nell'export.
- **Sedute**: componi una seduta selezionando gli esercizi (con la stessa barra
  filtri dell'indice, in versione compatta, sulla lista dei disponibili). Il
  *Riepilogo Seduta* mostra durata totale (somma) e, per i materiali, il **massimo**
  necessario tra gli esercizi (i materiali si riusano tra un esercizio e l'altro,
  non si sommano). Le sedute restano esportabili/importabili.
- **Indice a card**: griglia responsive (3 colonne fino a 1400px, 4 oltre) con
  toggle 2/3/4 colonne in alto a destra (ricordato per la sessione). Ogni card
  mostra l'anteprima dello schema, titolo, primi gesti/qualità su una sola riga
  (max 2 + "+X altri", adattati allo spazio), e un footer con portieri, palloni
  (se presenti) e durata in formato MM:SS. Clic ovunque sulla card = apri;
  passando sull'anteprima compaiono le azioni modifica / duplica / elimina.
  Aggiungere ai preferiti non riordina l'elenco.
- **Filtri** (esercizi e sedute): ricerca testuale, multi-selezione per
  gesti/qualità/periodi e stato, con contatore e "Cancella filtri".
  Con ≥2 voci selezionate compare una riga "Cerca esercizi che includono
  [almeno uno / tutti questi]" che commuta tra OR e AND; filtri diversi si
  combinano sempre in AND. Il filtro **materiali**
  (indice e selettore seduta) supporta operatore e quantità per voce
  (=, ≥, >, ≤, <; default ≥ 1 = "presente"); nella sezione sedute resta a sola
  presenza.
- **Portiere predefinito**: ogni nuovo esercizio — e ogni esercizio importato che
  non lo abbia già — parte con *Portiere ×1* (quantità modificabile o rimovibile);
  non vale per i duplicati, che ereditano i materiali dell'originale.
- **Liste configurabili**: gesti, qualità, periodi, materiali e tipi di freccia.
  Ogni materiale è rinominabile, con simbolo SVG modificabile (proporzioni, file
  .svg o markup incollato, con anteprima live e codice normalizzato) ed eliminabile.
  I simboli sono risolti a runtime dalla configurazione: gli SVG degli esercizi
  salvati restano intatti e, se un materiale viene eliminato, lì compare
  "(materiale rimosso)" senza rompere l'esercizio.
- **Granularità**: oltre al backup completo, export/import del singolo esercizio
  e della sola configurazione (liste), più duplicazione rapida di un esercizio.
- **Backup e interoperabilità**: export/import JSON (schema v2.2, con migrazione automatica dalle versioni precedenti),
  bidirezionale con l'artefatto.
- **Stampa / PDF**: scheda esercizio stampabile (Salva come PDF dal browser),
  con export PDF in un clic se aggiungi la libreria opzionale (vedi `lib/`).
- **Sincronizzazione cloud (facoltativa)**: da Impostazioni → *Account e sincronizzazione*, collega
  un account per tenere esercizi, sedute, portieri, stagioni, presenze e liste configurabili
  allineati tra più dispositivi (stesso sistema usato da Vacation Builder: Supabase, un account
  personale, nessun backend da gestire). Senza account collegato l'app resta **esattamente come
  prima**: solo IndexedDB locale, nessuna dipendenza dal cloud. Vedi `supabase/README.md` per la
  configurazione (una tantum, sul progetto Supabase). Il PIN del blocco app non viene mai
  sincronizzato: resta sempre e solo locale a ciascun dispositivo, come nell'export JSON.

---

## Struttura

```
repository-esercizi-portieri/
├── index.html
├── css/
│   ├── style.css        # stile principale
│   └── print.css        # stampa / PDF
├── js/
│   ├── app.js           # avvio
│   ├── defaults.js      # liste e simboli SVG di default
│   ├── storage.js       # wrapper IndexedDB (soft delete + outbox per la sincronizzazione)
│   ├── importExport.js  # schema v2.2, import/export, migrazione, compressione immagini
│   ├── session.js       # aggregazione sedute
│   ├── seasonLogic.js   # logica pura Stagione (date, generazione settimane)
│   ├── svgEditor.js     # editor tattico SVG
│   ├── settings.js      # liste configurabili
│   ├── ui.js            # interfaccia e navigazione
│   ├── data/            # sincronizzazione cloud (facoltativa)
│   │   ├── config.js    # configurazione Supabase (URL/anon key/schema, campi immagine)
│   │   ├── auth.js      # login/logout, stato sessione
│   │   ├── cloud.js      # unico file che parla con Supabase (tabelle + Storage)
│   │   └── sync.js      # orchestratore: outbox, pull, conflitti LWW, collegamento dispositivo
│   └── components/
│       └── sync-indicator.js  # pallino di stato sincronizzazione nella barra
├── supabase/
│   ├── schema.sql        # schema Postgres "portieri" + RLS + bucket Storage (da eseguire una volta)
│   └── README.md         # istruzioni di configurazione Supabase
├── lib/                 # librerie opzionali (html2pdf, vedi README.txt)
└── assets/
    └── favicon.svg
```

---

## Schema JSON v2.2 (interoperabilità)

L'export è un oggetto con `schemaVersion`, `exportedAt`, `customLists`
(le liste configurabili) e `items`. Gli `items` includono esercizi, sedute,
portieri e — come solo dato, in attesa della relativa UI — stagioni, eventi e
presenze. In import, le voci non più presenti nelle liste vengono segnalate
come *"personalizzato / fuori lista"* senza bloccare nulla, e gli eventuali
campi extra dell'artefatto (es. periodizzazione) vengono preservati nel
round-trip.

**Migrazione da v1.0:** nello schema 2.0 la categoria *preparazione base*
(`baseSetup`) è stata fusa in *qualità allenate* (`trainedQualities`). Gli
esercizi e le liste in schema 1.0 (sia quelli già salvati in IndexedDB sia
quelli importati) vengono migrati automaticamente, unendo le due liste senza
duplicati e rimuovendo `baseSetup`.

**Schema 2.1:** aggiunto il campo `trainingPeriod` (array) all'esercizio, la
lista configurabile `trainingPeriods` e l'aggregato `periodsCovered` nelle
sedute. La migrazione è automatica: gli esercizi ricevono `trainingPeriod: []`
e le sedute `aggregated.periodsCovered: []` se mancanti.

**Schema 2.2:** aggiunta la sezione **Portieri** (anagrafica completa: nome,
data di nascita, categoria, piede preferito, altezza, foto e note tecniche /
mentali / mediche con tag + testo libero) con nuovi store IndexedDB
`goalkeepers`, `seasons`, `events`, `attendances` e le liste configurabili
`goalkeeperCategories`, `technicalNoteTags`, `mentalNoteTags`,
`medicalNoteTags`. Le sedute hanno un nuovo campo `goalkeeperIds` (portieri
coinvolti) che alimenta lo storico nella scheda portiere. *Stagione* e
*Presenze* restano in arrivo: in 2.2 ne esiste solo la struttura dati
(`season`, `event`, `attendance`), senza interfaccia. La migrazione è
puramente additiva: i nuovi store partono vuoti per le installazioni esistenti
e nessun dato precedente viene toccato. Su installazioni già esistenti le nuove
liste configurabili partono **vuote** (i default si scrivono solo al primo
avvio assoluto) e si popolano da *Impostazioni → Categorie / Note Portiere*.

**Sezione Stagione (schema 2.3):** pianificazione basata su **GenericEvent**
(un evento per giorno, con tipo, portieri coinvolti, note, override e
`linkedItems` verso sedute/eventi specifici) e **SpecificEvent** (partita/torneo/
test/altro, con avversario/luogo/orario, senza portieri). In creazione un toggle
*"Rendi ciclica?"* (mappa su `isCyclic`): se on si definisce un template di
microciclo per-giorno (tipo giorno + portieri di default) e "Genera settimane"
crea i GenericEvent dall'inizio alla fine propagando i portieri di default; gli
eventi in `isOverride` non vengono sovrascritti da una rigenerazione. Il
calendario ha tre viste — **Settimana**, **Mese** (griglia 7×N a celle uniformi
fisse) e **Solo giorni con attività** — e il pannello giorno è diviso in due
sezioni: l'evento generico (tipo, portieri con picker filtrabile, note, override/
ripristina) e gli elementi collegati (sedute + eventi specifici, con creazione al
volo). Una funzione di **modifica massiva** aggiorna i portieri su un intervallo
di date (e opzionale tipo evento). La tab **Eventi specifici** elenca gli
SpecificEvent con filtri, CRUD ed export singolo. Export/import di una stagione
include i suoi GenericEvent e gli SpecificEvent collegati.
