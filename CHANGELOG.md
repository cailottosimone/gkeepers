# CHANGELOG

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
