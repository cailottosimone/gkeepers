# CHANGELOG

## v0.16.0 — 2026-08-20 — Colore stagione scelto, correzione ordine portiere

1. **Corretto per davvero l'ordine nella card portiere**: l'ultima volta
   avevo sistemato solo la vista aperta, non la riga in elenco — lì lo
   stato veniva ancora prima di squadra/categoria. Ora l'ordine è coerente
   ovunque: nome, squadra-categoria, stato, azioni.
2. **Colore della stagione, a scelta**: alla creazione o modifica di una
   stagione si sceglie ora anche un colore (selettore colore nativo),
   usato — come richiesto — solo nel Calendario allenatore, al posto di
   quello generato automaticamente. Le stagioni già esistenti senza un
   colore scelto continuano a usare quello automatico come prima, nessuna
   differenza per chi non tocca questo campo.

### Verifiche fatte

Verificato che nella riga portiere in elenco squadra-categoria preceda
davvero il pallino di stato nel markup (non solo che siano entrambi
presenti, controllo che mi aveva ingannato la volta scorsa). Per il
colore: creata una stagione, scelto un colore specifico, verificato che
venga salvato e che il chip nel Calendario allenatore lo usi esattamente
(non un colore approssimato o quello automatico). Rieseguiti tutti e tre
gli smoke test (mobile/desktop/sync), nessuna regressione.

## v0.15.0 — 2026-08-20 — Nome stagione nel calendario, sync non invadente

1. **Calendario allenatore: nome stagione scritto nel chip**, non più
   affidato al solo colore del bordo (senza una legenda accanto, il
   colore da solo non bastava a capire quale stagione fosse). Il nome
   compare come riga propria, colorata con lo stesso colore del bordo per
   rinforzare l'associazione. Celle e chip ingranditi di conseguenza (in
   settimana e mese, desktop e mobile) per fare spazio senza affollarsi.
2. **Il sync automatico non ti sposta più da dove sei**. Il problema:
   ogni sync in background (all'avvio, periodico, al ritorno in primo
   piano) ridisegnava da zero la sezione che stavi guardando — se eri su
   Impostazioni → Dizionario, tornavi a Liste personalizzate, perché ogni
   sezione riparte dalla propria scheda di default quando viene
   ricreata da zero. Tolto il refresh della vista dal sync automatico: i
   dati continuano a sincronizzarsi in background come prima, ma la
   vista che stai guardando non viene più toccata. Li vedrai aggiornati
   al prossimo cambio di sezione, o subito con "Sincronizza ora".

### Verifiche fatte

Verificato che il nome stagione compaia nel chip (non vuoto, colorato).
Per il sync, simulato l'esatto scenario descritto: aperta la scheda
Dizionario dentro Impostazioni, eseguito un sync completo (con lo stesso
finto server PostgREST già usato per i test di sincronizzazione, per non
dipendere dalla rete reale), verificato che la scheda Dizionario resti
attiva invece di tornare a Liste personalizzate. Rieseguiti tutti e tre
gli smoke test (mobile/desktop/sync), nessuna regressione.

## v0.14.0 — 2026-08-20 — Stagione modificabile, coerenza Squadre/Stagioni, ordine vista portiere

1. **Stagioni: ora modificabile**, non solo creabile ed eliminabile —
   nome, inizio, fine e note si possono cambiare dopo la creazione (il
   form era già pronto per farlo, mancava solo il tasto per aprirlo
   pre-compilato).
2. **Tasto "Nuovo" nella stessa posizione** tra Squadre e Stagioni: prima
   in Squadre stava in alto a destra nel section-head, in Stagioni sotto
   su una riga a sé (per far posto al tasto Indietro). Ora "Nuova
   stagione" occupa lo stesso slot di "Nuova squadra", con Indietro
   accanto anziché al posto suo.
3. **Vista portiere: Squadra e Categoria prima dello Stato**, non più
   dopo.

### Verifiche fatte

Aggiunti test specifici: il tasto "Nuovo" verificato nella stessa
posizione strutturale in entrambe le schermate; la modifica di una
stagione verificata sia per il campo aggiornato sia per il fatto che non
crei un duplicato; l'ordine dei campi nella vista portiere verificato per
posizione nel markup, non solo per presenza. Rieseguiti tutti e tre gli
smoke test (mobile/desktop/sync), nessuna regressione.

## v0.13.0 — 2026-08-20 — Tabelle al posto delle card, drawer mobile, bug ID

Riscrittura sostanziale della presentazione degli elenchi, dopo due giri
di correzioni sulle card che non convincevano.

### Bug corretti

1. **La migrazione degli ID non funzionava per tutti i record vecchi**: il
   controllo era "se manca il numero, assegnane uno" — ma un vecchio
   `numero: 1` è truthy, veniva scambiato per "già a posto" e restava nel
   vecchio formato incrementale. Corretto: ora la migrazione verifica che
   il codice sia nel formato giusto (`XX-#####`), non solo che esista.
2. **Prefisso seduta cambiato da `SE` a `SD`**: si confondeva a colpo
   d'occhio con `ES` (esercizio).

### Tabelle al posto delle card

Esercizi, Sedute, Portieri, Squadre, Stagioni, ed elenco eventi nel
calendario: tutti convertiti da griglie di card a righe tabellari (un
unico contenitore con bordo, righe separate da una linea sottile) — più
leggibile, più compatto, niente più titoli schiacciati da poco spazio.
L'ID (dove c'è) è stato spostato a destra con meno peso visivo, non più a
fianco del titolo a competere con lui.

### Click sulla riga apre la vista, ovunque abbia senso

- **Esercizi**: prima non esisteva una vista in sola lettura, solo
  modifica — aggiunta (sequenza, note, materiali, tag, schema).
- **Portieri**: il tasto "storico" separato è sparito. Ora una sola vista
  unisce le informazioni anagrafiche (squadra, categoria, note) e lo
  storico qualità allenate, aperta cliccando la riga.
- **Sedute**: già presente dal giro precedente, confermata.
- **Squadre e Stagioni**: qui il click continua a *navigare* (apre le
  stagioni di una squadra, gli eventi di una stagione) invece di aprire un
  modale — è una scelta deliberata: trasformarlo in un modale avrebbe
  aggiunto un passaggio inutile a un'azione che è già "vedere cosa c'è
  dentro". I tasti azione (elimina) restano comunque specifici e hanno
  sempre la priorità sul click della riga.

In tutti i casi, i tasti azione specifici (modifica, duplica, elimina)
hanno sempre la priorità sul click della riga — stessa logica di delega
degli eventi già in uso, nessun codice nuovo per gestire il conflitto.

### Portiere: pallino di stato coerente con lo stile dei tasti

Non più una forma a pillola arrotondata: stesso raggio dei tasti icona
usati in tutta la app.

### Nav mobile: drawer a hamburger, non più barra in basso

La barra in basso (con "Altro" per le sezioni meno usate) è stata
sostituita da un drawer laterale a scomparsa, aperto da un bottone
hamburger nell'intestazione. Tutte le sezioni sono mostrate direttamente
nel drawer, nessuna raggruppata: con lo spazio verticale di un drawer non
serve più nascondere nulla dietro un tap in più.

### Verifiche fatte

Riscritto buona parte dello smoke test mobile per riflettere la nuova
struttura (righe tabellari al posto di card, drawer al posto di
bottom bar/"Altro", tasto "indietro" della vista distinto da quello del
form). In questo giro di correzioni ho anche trovato un piccolo bug reale
nel mio codice: il tasto "indietro" della vista in sola lettura e quello
del form di modifica condividevano lo stesso `data-action="back"`,
causando un conflitto nella logica di gestione click su mobile — corretto
rinominando quello della vista in `back-view`, sia per Esercizi che per
Sedute. Rieseguiti anche gli smoke test desktop e sync, nessuna
regressione.

## v0.12.0 — 2026-08-20 — Card riviste da zero, ID non incrementali

1. **Card Esercizi**: tolta del tutto la sequenza di step, tornata a una
   riga sola con titolo (troncato con "…" se lungo) e i tasti azione — la
   sequenza restava confusa in una card così compatta, soprattutto ora che
   le note dei singoli step sono sempre visibili nell'editor.
2. **ID non più incrementali**: `#1`, `#2`... sostituiti da un codice
   tipo `ES-48213` per gli esercizi e `SE-90274` per le sedute — prefisso
   per tipo (leggibile a colpo d'occhio) + 5 cifre casuali, mai
   sequenziali, mai riassegnate (nemmeno ai cancellati).
3. **Migrazione**: aggiunta una funzione che assegna il codice ai record
   creati prima di questa funzionalità (non toccava quelli che già ce
   l'avevano), eseguita in automatico all'avvio.
4. **Card Seduta**: tolto il tasto "occhio" — ora l'intera card apre la
   vista in sola lettura al click; i tasti specifici (Modifica, Duplica,
   Elimina) restano espliciti e hanno sempre la priorità sul click della
   card, grazie alla stessa logica di delega degli eventi già in uso
   altrove.
5. **Barra "variante"**: compressa da un paragrafo su due righe + bottone
   esteso a una singola riga sottile con testo breve e bottone a sola
   icona.
6. **Card Portiere riscritta da zero**, seguendo lo schema esatto
   richiesto: riga 1 nome e cognome a sinistra, pill di stato a destra
   (solo icona, non più cerchio ma forma a pillola); riga 2
   "Squadra - Categoria" a sinistra, tasti azione a destra. Entrambe le
   righe troncano con "…" in caso di testo lungo, con lo stesso
   meccanismo — coerenza garantita indipendentemente dalla lunghezza dei
   nomi.

### Verifiche fatte

Smoke test esteso: formato del nuovo codice verificato per esercizi e
sedute, migrazione testata esplicitamente (un record senza codice ne
riceve uno nel formato corretto, i record che già ce l'avevano restano
identici), card seduta verificata cliccabile ovunque tranne che sui tasti
specifici (che restano prioritari), card esercizio verificata a riga
singola senza sequenza, card portiere verificata riga per riga contro lo
schema richiesto. Un fallimento isolato di timing durante lo sviluppo
(non riproducibile su tre esecuzioni consecutive successive) è stato
verificato e non è un bug dell'applicazione. Rieseguiti anche gli smoke
test desktop e sync, nessuna regressione.

## v0.11.0 — 2026-08-20 — Card più ordinate

1. **Portieri**: nella card in elenco lo stato non è più un badge con
   testo (che a volte spezzava il nome, anche dopo poche lettere) — ora è
   un pallino colorato con solo l'icona, che non contende mai spazio al
   nome. Il testo per esteso ("In salute", "Infortunato"...) resta dove
   serve davvero leggerlo: nella scheda aperta per modificare.
2. **Sedute ed Esercizi**: nuovo layout a due righe — il titolo ha sempre
   tutta la larghezza della card sopra, sotto una riga con le informazioni
   sintetiche a sinistra e i 4 pulsanti di azione a destra, con più
   respiro (tocco più comodo, non più stretti in verticale contro il
   titolo).
3. **Card esercizio**: tolte le note dalla card in elenco — con le note
   sempre visibili sullo step, la sequenza intera in una card compatta
   diventava confusa. Le note restano ovunque servono davvero: nella
   costruzione dell'esercizio, nel riepilogo della seduta, nel riepilogo
   del form evento.
4. **Variante in seduta**: la nota di adattamento ora compare subito dopo
   la sequenza, non più in fondo dopo materiali e tag.

### Verifiche fatte

Smoke test esteso con controlli specifici: pallino di stato al posto del
badge testuale nella card portiere (badge testuale confermato assente
lì), nuovo layout a due righe per sedute ed esercizi con le azioni sulla
riga inferiore, note confermate assenti dalla card esercizio, posizione
della nota verificata (dopo la sequenza, prima di materiali) nel pannello
variante. Rieseguiti anche gli smoke test desktop e sync, nessuna
regressione.

## v0.10.0 — 2026-08-20 — Aggregazioni intelligenti, "variante", storico in modale

1. **Materiali della seduta: il massimo, non la somma**. Due esercizi nello
   stesso blocco che usano 3 e 5 palloni servivano prima 8 palloni
   nell'aggregato — sbagliato, gli esercizi si susseguono, non si
   sovrappongono: gli stessi palloni si riusano da un esercizio all'altro.
   Ora il totale è il massimo richiesto da un singolo esercizio (5, in
   quell'esempio), calcolato su tutta la seduta (non solo per blocco,
   visto che anche i blocchi si susseguono).
2. **"personalizzata" → "variante"**, ovunque: badge nella voce, nel
   riepilogo seduta, nel riepilogo del form evento, testo dei pulsanti
   ("Crea una variante di questo esercizio per questa seduta" invece di
   "Personalizza..."), messaggio di conferma del ripristino.
3. **Storico qualità: conteggio consapevole delle varianti**. Prima, ogni
   voce contava i suoi gesti/qualità per conto proprio — se lo stesso
   esercizio compariva più volte nella stessa seduta (originale + una o
   più varianti), la stessa qualità veniva contata più volte come se
   fossero allenamenti distinti. Ora le varianti dello STESSO esercizio
   (stesso id) si uniscono: l'insieme dei loro gesti/qualità conta una
   volta sola per quella seduta. Un esercizio DIVERSO (id diverso) che
   allena lo stesso gesto continua a contare a parte, perché è davvero un
   esercizio in più svolto. Esempio verificato: due varianti dello stesso
   esercizio, una con Equilibrio+Coordinazione, l'altra con
   Reattività+Coordinazione, più un esercizio diverso con Coordinazione →
   risultato Equilibrio 1, Reattività 1, Coordinazione 2 (una per il
   gruppo di varianti, una per l'esercizio a parte).
4. **Storico qualità: ora è sempre un modale**, non più una scheda che si
   espande dentro la card del portiere.

### Verifiche fatte

Aggiunti test mirati che costruiscono lo scenario esatto descritto (due
esercizi con materiali diversi nello stesso blocco; due varianti dello
stesso esercizio con gesti/qualità in parte sovrapposti più un esercizio
indipendente) e verificano il risultato numerico preciso, non solo che il
codice giri senza errori. Confermato lo storico in modale. Rieseguiti
anche gli smoke test desktop e sync, nessuna regressione.

## v0.9.0 — 2026-08-19 — ID, note evidenti, categorie, correzioni

1. **"bloccho" → "blocco"**: non era un problema di plurale/singolare in
   sé (quello lo avevo gestito bene), ma un errore letterale — lo stem
   usato era "blocch" + "o" = "bloccho". Corretto in tutti e tre i punti:
   lo stem giusto è "bloc" + "co"/"chi".
2. **ID per esercizi e sedute**: nuovo numero breve e stabile (#1, #2...),
   assegnato una volta alla creazione e mai riassegnato (nemmeno ai
   cancellati), mostrato come `#N - Titolo` negli elenchi e nei selettori
   (scelta esercizio in un blocco, scelta seduta in un evento) — per
   trovarle quando sono tante, senza dover ricordare il nome esatto. La
   ricerca funziona anche digitando solo il numero. Duplicare un
   esercizio/seduta assegna un numero nuovo, non riusa quello originale.
3. **Step: "ruolo" rimosso, nota sempre evidente**: tolto il campo ruolo
   dall'editor step (non serviva). La nota non è più nascosta dietro un
   click per espandere: è un campo sempre visibile subito sotto lo step —
   pensato per il caso che mi hai descritto, riusare lo stesso esercizio
   più volte in una seduta cambiando solo la nota ("piedi pari", "un piede
   solo"...). Aggiunto anche un campo Note a livello di esercizio intero
   (non solo per singolo step).
4. **Le note ora si vedono anche nei riepiloghi compatti**: prima, guardando
   la sequenza di una voce personalizzata dalla vista Seduta o dal form
   Evento, si vedevano solo le etichette degli step — due step con la
   stessa etichetta ma note diverse risultavano indistinguibili. Ora il
   riepilogo mostra "Scaletta *(piedi pari)*" invece di solo "Scaletta",
   in tutti e tre i punti dove la sequenza viene riassunta (elenco
   esercizi, riepilogo seduta, riepilogo nel form evento).
5. **Categorie**: nuova lista personalizzabile in Impostazioni (Prima
   Squadra, Juniores, Allievi, Giovanissimi di default, come le altre
   liste — rinominabile, eliminabile con avviso se in uso), assegnabile a
   ogni portiere.
6. **Card portiere: nome e badge di stato ora coerenti**: prima un nome
   corto restava in linea col badge, uno più lungo andava a capo
   allungando la card in modo incoerente da un portiere all'altro. Ora
   nome e badge stanno sempre sulla stessa riga: il nome tronca con "…" se
   troppo lungo, il badge resta fisso a destra — stesso comportamento per
   tutti, indipendentemente dalla lunghezza del nome.

### Verifiche fatte

Smoke test mobile esteso con controlli specifici per ciascun punto:
numero assegnato e mostrato correttamente, numero nuovo dopo duplicazione
(nessun doppione), assenza del campo ruolo, presenza del campo nota
sempre visibile (sia nel catalogo sia nella personalizzazione in seduta),
nota effettivamente visibile nel riepilogo compatto, lista Categorie con
le voci di default, categoria salvata e mostrata sul portiere, nome e
badge sulla stessa riga strutturale. Rieseguiti anche gli smoke test
desktop e sync, nessuna regressione.

## v0.8.0 — 2026-08-19 — Sync automatico, nav mobile snellita, correzioni

1. **Aggiornamento automatico**: la sincronizzazione non parte più solo al
   click su "Sincronizza ora" — un tentativo silenzioso all'avvio, uno
   periodico (ogni 60 secondi) mentre la app resta aperta, e uno quando
   torna in primo piano (cambio scheda/app). La vista che stai guardando si
   aggiorna da sola quando arrivano dati nuovi — **a meno che tu non stia
   scrivendo in un campo o non abbia un modale di modifica aperto**: in quel
   caso il refresh automatico si ferma, apposta, per non farti perdere una
   modifica in corso.
2. **"Il singolare di blocchi è blocco"**: trovato. Non era "blocco/blocchi"
   in sé (quello lo avevo già gestito bene) — era "esercizi", scritto
   sempre al plurale nella stessa riga, anche con un solo esercizio. Corretto
   in tre punti (riepilogo seduta, riepilogo nel form evento, elenco
   sedute), più due casi analoghi trovati cercando lo stesso tipo di
   errore ("eventi" sempre al plurale nel dialogo di "cancella tutti" e
   nello storico portiere).
3. **Nav mobile snellita**: sei sezioni in una bottom bar le rendevano
   tutte piccole e strette. Ora la barra mostra le quattro più usate
   (Esercizi, Sedute, Calendario, Portieri) più una voce "Altro" che apre
   un popup con Stagioni e Impostazioni — un tap in più per le due sezioni
   meno frequenti, ma le altre quattro tornano leggibili. Su desktop,
   dove lo spazio in verticale non manca, la sidebar continua a mostrarle
   tutte e sei dirette.

### Verifiche fatte

Smoke test mobile esteso: il popup "Altro" elenca correttamente le due
sezioni ripiegate e naviga bene; `refreshIfSafe()` verificato in entrambi
i casi (con un campo attivo non tocca nulla, senza un campo attivo
aggiorna la vista). Rieseguiti anche gli smoke test desktop e sync, nessuna
regressione.

## v0.7.0 — 2026-08-18 — Riordino voci, sincronizzazione Supabase

### Riordino esercizi in un blocco

Aggiunte le frecce ↑/↓ alle voci di un blocco in Seduta — stessa logica già
usata per riordinare gli step di un esercizio, non un meccanismo nuovo.
Ho scelto le frecce invece del trascinamento (che pure uso già nel
calendario) perché il drag-and-drop nativo HTML5 funziona solo con il
mouse: su schermo touch — cioè probabilmente il caso più comune per
costruire una seduta al campo — non avrebbe funzionato affatto, mentre le
frecce sono identiche su mobile e desktop.

### Sincronizzazione cloud (Supabase)

Stesso progetto Supabase delle altre app (URL fornito), ma **senza
login**: nessun account, un unico spazio dati condiviso protetto solo dalla
policy di accesso — non multi-utente. Differenze rispetto al sistema con
account visto in repository-portieri:

- **Nessuna schermata di accesso.** Un solo interruttore "Attiva
  sincronizzazione cloud" in Impostazioni.
- **Vince il più recente**, record per record, confrontando la data di
  ultima modifica locale e cloud. Il caso "dispositivo nuovo sovrascritto
  dal cloud" non è un percorso a parte: è semplicemente cosa succede
  quando questo stesso confronto avviene con uno storage locale vuoto — il
  cloud vince sempre perché non c'è nulla in locale con cui competere.
  Niente più domanda "sei il primo dispositivo o uno successivo?".
- **Le cancellazioni sono soft-delete**: `storage.remove()` ora marca il
  record come cancellato invece di eliminarlo fisicamente (`getAll()` lo
  esclude comunque di default, quindi per il resto della app è come se non
  esistesse più) — necessario perché una cancellazione possa propagarsi
  agli altri dispositivi allo stesso modo di qualsiasi altra modifica.
- **Manuale**, non in tempo reale: si sincronizza attivando l'opzione,
  premendo "Sincronizza ora", o silenziosamente all'avvio della app se è
  già attiva (nessun errore mostrato se fallisce in quel momento, "Sincronizza ora" resta sempre disponibile).

Nuovi file: `js/data/{config,cloud,sync}.js`, `supabase/schema.sql` (da
eseguire una volta nell'SQL Editor di Supabase — crea uno schema dedicato
`gkeepers`, non tocca gli schemi di altre app), `supabase/README.md` con
le istruzioni di configurazione.

**Limite dichiarato**: senza login, chiunque avesse la stessa chiave e
conoscesse lo schema potrebbe leggere/scrivere questi dati — per uso
personale è un compromesso accettabile, ma vale la pena saperlo (lo dico
anche nell'interfaccia, non solo qui).

### Verifiche fatte

Non posso raggiungere `supabase.co` da questo ambiente (dominio fuori
dalla rete consentita per gli strumenti che uso qui) — la connettività
reale va confermata da un browser vero, con le tue chiavi. Ho invece
scritto un test dedicato con un finto server PostgREST in memoria (stesso
contratto dell'API reale: GET restituisce le righe, POST con
`Prefer: resolution=merge-duplicates` fa upsert) per verificare la
*logica* di sincronizzazione: scenario "dispositivo nuovo" (locale vuoto
si allinea al cloud), push di un record solo locale, conflitto risolto a
favore del più recente in entrambe le direzioni, propagazione di una
cancellazione come soft-delete, e che un record cancellato non ricompaia
dopo altri cicli di sync. Più i soliti smoke test mobile/desktop, per
verificare che il soft-delete non abbia rotto nulla nel resto della app
(non doveva: `getAll()` filtra i cancellati allo stesso modo di prima,
quando venivano eliminati fisicamente).

## v0.6.0 — 2026-08-18 — Trascinamento, backup, layout

1. **Trascinamento eventi**: negli eventi di Stagioni e nel Calendario
   allenatore, trascina un evento da un giorno a un altro (settimana o
   calendario mensile) per cambiarne la data — niente serve riaprire il
   form per un semplice spostamento.
2. **Ricorrenza: tipo per ogni giorno**: ogni giorno della settimana
   selezionato ha ora il proprio tipo (Allenamento di default, o
   Partita), non più un tipo unico per tutta la serie.
3. **Pulsante "+" allineato in alto**: nella riga dell'etichetta del
   giorno, accanto alla data — non più in fondo alla cella.
4. **Titolo app nella sidebar**: "GKEEPERS" ora vive in cima alla barra
   di navigazione laterale su desktop (l'intestazione separata sopra il
   contenuto è stata rimossa lì); il contenuto usa lo spazio orizzontale
   reale invece di fermarsi con un margine vuoto prima del bordo.
   Conseguenza diretta: gli stati vuoti ("Nessun esercizio/seduta
   trovato") ora occupano davvero tutta la larghezza disponibile.
5. **Più respiro nelle card** degli elenchi (portieri, esercizi, sedute):
   padding e spaziatura interna aumentati.
6. **Bottoni "Nuovo..." più leggibili**: dimensione, peso e spaziatura
   rivisti sui bottoni primari.
7. **Backup in Impostazioni**: nuova sezione con Esporta (scarica un file
   JSON con tutti i dati) e Importa (da un file precedente — mostra
   un'anteprima con i conteggi per tipo prima di confermare; scrive in
   un'unica transazione IndexedDB su tutti gli store; unisce per id senza
   cancellare quello che c'è già e non è nel file).

### Verifiche fatte

Smoke test mobile e desktop estesi: tipo per-giorno nella ricorrenza
(verificato che lunedì e martedì generati abbiano tipi diversi), il
pulsante "+" nella riga dell'etichetta, trascinamento di un evento
simulando dragstart/drop con uno stub di DataTransfer (verificata la data
finale sul record), titolo app nella sidebar, ed export/import backup
(verificato che l'unione non cancelli dati esistenti non presenti nel
file importato).

## v0.5.0 — 2026-08-18 — Bug date, ricorrenza multi-giorno, popup giorno, rifiniture

Dopo un uso più reale dell'app, dodici correzioni/aggiunte, alcune delle
quali bug veri e propri.

### Bug corretti

1. **Le date erano spostate di un giorno**: causa individuata e corretta
   alla radice. Diversi punti del codice usavano `toISOString()` per
   trasformare un oggetto Date in una stringa di calendario — ma
   `toISOString()` converte in UTC, e con un fuso diverso da UTC la data
   si sposta. Aggiunta `isoLocal()` (basata su anno/mese/giorno LOCALI,
   non su UTC) e sostituiti tutti i punti che usavano `toISOString()` per
   una data di calendario (mai per i timestamp `createdAt`/`updatedAt`,
   quelli restano corretti così). Questo bug era anche la causa del
   giorno "oggi" evidenziato sempre con uno scarto di +1.
2. **Il popup "eventi del giorno" non aveva un proprio listener**: il
   modale viene aggiunto fuori dal container della sezione (è nel body),
   quindi il click su "apri"/"elimina" dentro il popup non arrivava a
   nessun gestore. Trovato scrivendo il test per la funzione appena
   aggiunta, corretto prima della consegna.

### Aggiunte

3. **Ricorrenza su più giorni + tipo di evento**: il generatore di eventi
   ricorrenti ora permette di selezionare più giorni della settimana
   insieme (non solo uno) e il tipo di evento (allenamento/partita) da
   applicare a tutta la serie generata.
4. **Pulsante "+" diretto nelle celle di settimana/calendario** (vista
   Stagioni): aggiunge un evento con la data già compilata, senza passare
   dal bottone in alto.
5. **Popup "+N" invece di righe che si allungano**: nelle viste di una
   singola stagione, al massimo 2 eventi per giorno sono mostrati
   direttamente; oltre, un "+N" apre un popup con l'elenco completo del
   giorno, ciascuno apribile o eliminabile. Il Calendario allenatore non è
   stato toccato in questo aspetto, come richiesto.
6. **Eliminazione del singolo evento** anche dal form di modifica (non
   solo dall'elenco o, ora, dal popup del giorno).
7. **Colore per stagione nel Calendario allenatore**: ogni stagione ha un
   colore stabile (calcolato dal suo id, non salvato da nessuna parte) usato
   come bordo sul chip evento — rende visibile a colpo d'occhio quali
   eventi appartengono a stagioni diverse quando sono mostrati insieme.

### Rifiniture

8. **Badge "In recupero" non va più a capo** nella card portiere.
9. **Liste personalizzate in Impostazioni**: ogni categoria (Materiali,
   Gesti, Qualità) è ora pieghevole, compressa di default.
10. **Immagine dell'esercizio a piena larghezza** nel modale, non più
    parziale e fuori centro.
11. **"Nessun esercizio/seduta trovato"** ora occupa sempre tutta la
    larghezza della griglia, non più una singola colonna in un caso e
    tutto lo schermo nell'altro.

### Verifiche fatte

Smoke test mobile e desktop estesi in modo specifico per i punti più a
rischio di regressione: date esatte generate dalla ricorrenza multi-giorno
(nessuno scarto), stessa verifica per la creazione manuale di un evento,
pulsante "+" con data pre-compilata, popup "+N" con eliminazione,
eliminazione dal form, colore per stagione presente nel markup, categorie
delle liste pieghevoli compresse di default. Il test ha permesso di
trovare e correggere il bug del popup del giorno prima della consegna.

## v0.4.0 — 2026-08-18 — Immagine, spazio desktop, orari, Calendario allenatore

1. **Immagine sull'esercizio**: la sezione Schema ora permette di caricare
   un'immagine reale (SVG resta da fare). Ridimensionata/compressa lato
   client via canvas prima del salvataggio (stesso principio del vecchio
   repository), salvata come parte del record esercizio. Mostrata come
   miniatura nella card dell'elenco Esercizi — visibile senza doverla
   aprire — e in anteprima nella sezione Schema mentre la modifichi.
2. **Spazio desktop**: il contenuto era troppo stretto e centrato rispetto
   allo spazio reale accanto alla sidebar. Ora usa fino al 94% della
   larghezza disponibile (fino a 1360px), allineato a sinistra invece che
   centrato — le griglie di Esercizi/Sedute/Portieri e le viste
   Settimana/Calendario ne beneficiano parecchio. Non ho toccato la
   sidebar in sé: il problema era la gestione dello spazio del contenuto,
   non la sidebar.
3. **Orari**: nuovo campo Ora su ogni Evento (allenamento o partita),
   incluso nel generatore di eventi ricorrenti (un solo orario per tutta
   la serie generata). Mostrato in tutte le viste (settimana, calendario,
   elenco).
4. **Calendario allenatore**: nuova sezione in nav, stesse tre viste
   (Settimana/Calendario/Elenco) di Stagioni ma con gli eventi di TUTTE le
   stagioni e squadre insieme, ciascuno etichettato con la squadra di
   appartenenza. Cliccando un evento si apre lo stesso form di modifica
   usato in Stagioni.

### Refactor di supporto

Per evitare di duplicare la logica tra Stagioni e il nuovo Calendario
allenatore, estratti due moduli condivisi: `calendar-views.js` (rendering
puro delle viste Settimana/Calendario/Elenco) e `evento-editor.js` (il
form di creazione/modifica Evento per intero, comprese seduta collegata +
riepilogo, presenze, dettagli partita). `stagioni.js` ora è più snello e
usa entrambi.

### Verifiche fatte

Smoke test mobile e desktop estesi: miniatura immagine in elenco (il
resize via canvas non è testabile in headless Node/jsdom — nessuna vera
decodifica immagine disponibile — verificato quindi solo il rendering
della miniatura con un'immagine già presente sul record; la pipeline di
compressione va confermata in un browser vero), orario salvato e mostrato
in tutte le viste, orario applicato alla ricorrenza, Calendario allenatore
che mostra e permette di modificare un evento creato da Stagioni con lo
stesso controllo anti-accumulo-di-listener già usato per gli altri modali.

## v0.3.0 — 2026-08-18 — Tema chiaro, Font Awesome, modali, calendario

Revisione grafica e di interazione ampia.

1. **Font Awesome**: integrato via Kit (`<script src="https://kit.fontawesome.com/75d8a5f1bd.js">`
   nell'head) — l'integrazione corretta per un progetto vanilla senza framework.
   Tutte le icone unicode/emoji usate finora sono state sostituite con icone
   Font Awesome (`<i class="fa-solid fa-...">`) in ogni modulo.
2. **Tema chiaro**: sfondo bianco/quasi bianco, testo scuro leggibile,
   accenti (ambra/verde) ricalibrati per restare leggibili su sfondo
   chiaro. Non è più la "lavagna" scura — quella era un fraintendimento
   della richiesta precedente, corretto qui.
3. **Liste e tabelle al posto delle pillole**: materiali (elenco con select
   per aggiungere), tag (elenco con checkbox, raggruppato Gesti/Qualità),
   stato portiere (elenco con radio), convocati/presenti (elenco con
   checkbox), dizionario termini in Impostazioni (tabella con colonne
   Termine/Usi/Gruppo). Nessuna pillola rimasta per elenchi di selezione.
4. **Seduta: vista sola lettura con statistiche d'uso**: nuova azione
   "occhio" nell'elenco Sedute — apre la seduta senza editarla, mostra il
   contenuto (blocchi/esercizi/step) e quante volte è usata (eventi
   collegati, distinti svolti/pianificati, con data/stagione/squadra).
5. **Stagioni: vista Settimana (default), Calendario e Elenco**: tre
   viste selezionabili per gli eventi di una stagione — Settimana (griglia
   7 giorni navigabile, apre di default), Calendario (griglia mensile,
   alternativa), Elenco (la vista cronologica di prima, mantenuta).
6. **Azioni in modale su desktop**: "nuovo/modifica" per Esercizi, Sedute,
   Portieri ed Evento (in Stagioni) aprono un modale su schermi ≥860px,
   lasciando visibile l'elenco sotto — su mobile restano a sezione intera
   come prima (più comodo su schermo stretto). Creazione rapida di
   Squadra/Stagione resta un form inline anche su desktop: sono form
   minimi (poco più di un nome e due date), non sembrava valesse la pena
   di un modale dedicato.
7. **Menu di navigazione ripensato**: sidebar verticale a sinistra su
   desktop (icona + etichetta, riga con indicatore a bordo, non pillola),
   barra in basso su mobile (icona sopra etichetta, pattern standard e
   comodo per il pollice).

### Nota tecnica

Il pattern per i modali evita di accumulare listener a ogni apertura: le
azioni del form sono gestite dal listener già presente sul container
(mobile, form dentro il container) oppure da un listener montato una sola
volta sul corpo del modale (desktop, smontato automaticamente alla
chiusura) — mai su `document`, per lo stesso motivo per cui in v0.1.0 era
stato corretto il bug del contenitore condiviso tra sezioni.

### Verifiche fatte

Due smoke test separati: uno per il percorso mobile (form a sezione
intera, viste Settimana/Calendario/Elenco, elenchi a checkbox/select),
uno per il percorso desktop (apertura/chiusura modali su Esercizi, Sedute,
Portieri, Evento — incluso un controllo esplicito che aprire il modale due
volte di seguito non produca submit duplicati da listener accumulati).
Entrambi verdi, nessun errore catturato.

## v0.2.0 — 2026-08-18 — Otto correzioni dal primo utilizzo

Revisione ampia dopo la prima prova pratica dell'app.

1. **Interfaccia desktop**: prima era pensata solo mobile-first. Ora da
   860px in su il contenuto usa più spazio orizzontale (fino a 1000px),
   gli elenchi (Esercizi/Sedute/Portieri) passano a griglia invece di lista
   impilata, e la palette si schiarisce leggermente (meno scura del verde
   lavagna originale) per essere più leggibile su schermo grande. Il layout
   mobile non è stato toccato.
2. **Materiali con quantità**: nuovo editor condiviso (`editors.js`) che
   mostra i materiali selezionati con un campo quantità modificabile,
   invece del semplice on/off di prima.
3. **Parametri rimossi**: tolti del tutto da Esercizio (niente più
   serie/ripetizioni/lavoro/recupero). Rimossi anche i riferimenti
   nell'adattamento in seduta.
4. **Personalizzazione completa in seduta**: prima si poteva solo
   sostituire il testo di un singolo step. Ora "Personalizza questo
   esercizio solo per questa seduta" apre una copia editabile per intero
   (step con lo stesso editor del catalogo, materiali, tag) — l'esercizio
   originale non viene mai toccato. "Ripristina originale" annulla la
   personalizzazione.
5. **Cancella tutti gli eventi**: bottone nella vista Eventi di una
   stagione, con conferma che mostra quanti verranno eliminati.
6. **Riepilogo della seduta collegata**: nel form Evento, selezionando una
   seduta compare un riepilogo (blocchi, esercizi con relativa sequenza —
   tenendo conto delle personalizzazioni —, materiali aggregati, numero
   minimo di portieri necessari).
7. **Stato del portiere**: nuovo campo con tre valori (In salute /
   Infortunato / In recupero), mostrato come badge colorato nell'elenco.
8. **Squadra sul portiere**: nuovo campo, collegato alle squadre create in
   Stagioni. La lista convocabili in un Evento ora si filtra per squadra
   (i portieri senza squadra assegnata restano comunque selezionabili
   ovunque, per non rompere l'uso senza multi-squadra).

### Refactor di supporto

Estratto un modulo condiviso `editors.js` (sequenza di step, materiali con
quantità, tag) usato sia da Esercizi sia dalla personalizzazione in Seduta
— elimina la duplicazione che si sarebbe creata tra i due editor.

### Verifiche fatte

Smoke test riscritto ed esteso: creazione squadra → portiere con stato e
squadra → esercizio con step e materiale a quantità → riuso dizionario →
seduta con personalizzazione completa di una voce (verificato che
l'esercizio originale in catalogo resti intatto) → evento con riepilogo
seduta e convocati filtrati per squadra → ricorrenza → cancella tutti →
storico portiere → dizionario in impostazioni. Tutto verde, nessun errore
catturato.

## v0.1.1 — 2026-08-18 — Storico portiere + adattamento strutturato

Due dei punti lasciati aperti nella v0.1.0 sono stati completati:

- **Storico qualità per portiere in UI**: la funzione esisteva già
  (`presenze.storicoPortiere`) ma non era collegata a nessuna schermata.
  Ora c'è un pulsante "◷" nella lista Portieri che mostra, per quel
  portiere, quante volte ha allenato ciascun gesto/qualità — calcolato al
  volo dagli eventi svolti in cui risulta presente, nessun dato duplicato.
- **Adattamento strutturato della voce in seduta**: prima era solo una nota
  libera. Ora ogni voce ha un pannello "⚙" che permette di sostituire, solo
  per quella seduta, la label di uno o più step e/o i parametri
  (serie/ripetizioni/lavoro/recupero) — l'esercizio originale nel catalogo
  non viene mai toccato. La nota libera resta disponibile per tutto il
  resto. Aggiunte due funzioni di lettura (`stepEffettivi`,
  `parametriEffettivi` in sedute.js) che calcolano il risultato finale
  (originale + override) senza duplicare i dati.

Verificato con smoke test esteso: sostituzione di uno step in una voce,
salvataggio, e controllo esplicito che l'esercizio originale in catalogo
resti invariato dopo l'adattamento locale.

### Ancora aperto

- Scelta del modello tecnico di Variante (catena vs famiglia piatta) —
  "Usa come punto di partenza" resta una copia indipendente.
- Schema spaziale: solo link, SVG/immagine da costruire.
- Calendario stagione come elenco cronologico, non griglia mensile.
- Sincronizzazione cloud, esclusa su richiesta.

## v0.1.0 — 2026-08-18 — Prima stesura

Prima implementazione di GKEEPERS, dopo la fase di sola discussione
concettuale. Progetto nuovo e separato da repository-portieri; stesso stack
(vanilla JS/HTML/IndexedDB, no build step), modello dati ripensato da zero.

### Incluso

- **Esercizi**: editor a sequenza di step (una riga = uno step, con incolla
  multi-riga), dizionario dei termini con suggerimenti live, alternative di
  gruppo mostrate in fase di adattamento di uno step, materiali, tag
  manuali, parametri, schema (solo campo link per ora).
- **Dizionario/Impostazioni**: Unifica (termini identici scritti diverso) e
  Raggruppa (termini distinti ma alternativi) come due azioni separate;
  eliminazione di un termine con avviso su quanti esercizi lo usano
  (gli step coinvolti restano testo libero, non perdono il contenuto);
  rename di un termine con propagazione a tutti gli step collegati.
- **Liste personalizzate** (materiali/gesti/qualità): referenziate per
  chiave dagli esercizi (mai duplicate come testo), quindi il rename è
  automatico ovunque; l'eliminazione avvisa se la voce è in uso.
- **Sedute**: blocchi liberi con voci che referenziano un Esercizio del
  catalogo + nota di adattamento libera per quella seduta specifica.
  "Usa come punto di partenza" per creare una seduta a partire da un'altra
  (copia indipendente).
- **Stagioni**: Squadra → Stagione → Evento. Generatore di eventi ricorrenti
  (giorno della settimana + intervallo date) che crea solo gli eventi del
  calendario, mai il contenuto. Evento "allenamento" collega una Seduta +
  gestisce convocati/presenti; evento "partita" ha dettagli propri
  (avversario, casa/trasferta, risultato) e nessuna seduta collegata.
- **Presenze**: convocati (prima) e presenti (appello, dopo) sull'Evento.
  Storico qualità/gesti per portiere calcolato al volo dagli eventi svolti
  con presenza effettiva — nessun dato ridondante salvato.
- **Portieri**: anagrafica di base (nome, cognome, data di nascita, note).

### Deliberatamente rimandato / semplificato in questa stesura

- **Sincronizzazione cloud**: esclusa su richiesta esplicita, da introdurre
  in una fase successiva.
- **Variante di esercizio**: il comportamento tecnico (catena
  parentId→diff vs famiglia piatta) era rimasto volutamente indeciso nella
  fase di discussione. In questa stesura "Usa come punto di partenza" crea
  una copia indipendente, senza legame registrato con l'originale — scelta
  provvisoria, meno rischiosa di un modello che avremmo dovuto rifare.
- **Schema spaziale**: solo campo link funzionante. SVG (editor da
  riadattare da repository-portieri) e upload immagine restano da
  costruire — il dato li prevede già come alternative equivalenti.
- **Calendario stagione**: elenco cronologico degli eventi, non vista a
  griglia mensile/settimanale.
- **Adattamento di una voce in seduta**: nota libera testuale, non un
  override strutturato campo per campo (es. sostituzione di singoli step
  dell'esercizio per quella sola seduta). Il modello dati (`overrides`)
  discusso in fase concettuale non è stato implementato in questa stesura.

### Verifiche fatte

- `node --check` su tutti i file JS (via copie `.mjs`), nessun errore di
  sintassi.
- Bilanciamento graffe CSS verificato via `awk`.
- Smoke test funzionale headless (jsdom + fake-indexeddb): navigazione tra
  tutte le sezioni, creazione portiere/esercizio/seduta/squadra/stagione/
  evento, riuso di un termine del dizionario (verificato l'incremento del
  contatore), generazione di eventi ricorrenti, storico portiere. Il test
  ha permesso di trovare e correggere due bug reali prima della consegna:
  contenitore DOM condiviso tra sezioni senza pulizia dei listener (azioni
  di un modulo intercettate da un altro dopo il cambio sezione), e bottone
  "Salva" della seduta privo di `data-action` che lo rendeva inerte.
