# GKEEPERS — prima stesura

App di gestione allenamenti portieri. Progetto nuovo e separato da
`repository-portieri`: stesso stack tecnico (vanilla JS/HTML, IndexedDB,
nessun build step), modello dati ripensato da zero secondo i principi
discussi (esercizio come sequenza di step, seduta come pianificazione
ragionata, stagione come calendario non prescrittivo).

## Avvio

Nessuna installazione. Serve solo un server statico locale (IndexedDB non
funziona su `file://`):

```
npx serve .
```
oppure l'estensione "Live Server" di VS Code, come per repository-portieri.

Database IndexedDB: `gkeepers-db` (nome distinto da repository-portieri, per
poter tenere entrambi i progetti nello stesso browser senza conflitti).

## Struttura

```
index.html
css/style.css
js/
  storage.js       — unico punto di accesso a IndexedDB
  defaults.js       — liste personalizzate di default (scritte solo al primo avvio)
  dom-utils.js       — utility di rendering condivise
  editors.js       — editor condivisi: sequenza di step, materiali con quantità, tag
  modal.js       — modale generico riusabile (azioni di modifica/vedi su desktop)
  calendar-views.js  — rendering condiviso viste Settimana/Calendario/Elenco
  evento-editor.js  — form Evento condiviso tra Stagioni e Calendario allenatore
  dizionario.js       — termini step + gruppi di alternative (unifica/raggruppa/elimina)
  esercizi.js       — CRUD esercizi (titolo, step, materiali, tag, schema — niente parametri)
  sedute.js       — CRUD sedute (blocchi liberi + voci, personalizzabili per intero)
  stagioni.js       — squadre, stagioni, eventi (allenamento/partita, con orario), ricorrenza
  calendario.js       — "Calendario allenatore": eventi di tutte le stagioni/squadre insieme
  presenze.js       — widget convocati/presenti + storico qualità per portiere
  portieri.js       — anagrafica portieri
  settings.js       — liste personalizzate + gestione dizionario
  ui.js       — guscio/navigazione
  app.js       — entry point
```

Ogni modulo espone `render(container)` ed è indipendente dagli altri; solo
`storage.js` tocca `indexedDB`.

## Modello dati (sintesi)

- **Esercizio**: titolo + sequenza di `step` (`{ label, note?, ruolo?, termRef? }`,
  lunghezza libera) + materiali con quantità + tag (manuali) + schema
  (per ora solo link; SVG/immagine da costruire). Nessun parametro di
  serie/tempistiche.
- **Termine / Gruppo**: dizionario piatto di frasi già usate come step, non
  una tassonomia. I Gruppi collegano termini che sono *alternative* tra loro
  (es. "presa alta"/"presa bassa"/"presa al petto"), distinti da *Unifica*
  che fonde termini che sono *lo stesso concetto* scritto diverso.
- **Seduta**: titolo + blocchi liberi → voci che referenziano un Esercizio.
  Ogni voce può avere una personalizzazione completa (step/materiali/tag)
  valida solo per quella seduta, costruita a partire da una copia
  dell'esercizio — l'originale nel catalogo non viene mai toccato.
  Riutilizzabile, indipendente da data/squadra — nessuna presenza qui.
- **Squadra → Stagione → Evento**: la Stagione è un calendario, non un
  generatore di contenuto. Un Evento di tipo "allenamento" collega una
  Seduta già pronta (con riepilogo visibile) + convocati/presenti filtrati
  per squadra; un Evento "partita" ha dettagli propri (avversario,
  casa/trasferta, risultato), nessuna seduta collegata. Ogni evento ha
  data e ora. Nelle viste Settimana/Calendario di una stagione, al massimo
  2 eventi per giorno sono mostrati direttamente: oltre, un "+N" apre un
  popup con l'elenco completo (e l'eliminazione rapida). Nel Calendario
  allenatore questo limite non c'è di proposito: lì la vista aggregata
  può crescere liberamente.
- **Presenze**: vivono sull'Evento (convocati prima, appello dopo). Lo
  storico qualità per portiere si calcola al volo dagli eventi svolti con
  presenza effettiva — non è un dato salvato e ridondante.
- **Portiere**: anagrafica + stato (in salute/infortunato/in recupero) +
  squadra collegata.

- **Backup**: in Impostazioni, esporta tutti i dati in un file JSON ed
  importa da un file precedente (unione per id, non cancella l'esistente,
  scrittura in un'unica transazione IndexedDB — o va tutto a buon fine o
  niente viene scritto).

## Semplificazioni note di questa prima stesura

Vedi CHANGELOG.md per il dettaglio — in sintesi: nessuna sincronizzazione
cloud (rimandata), nessun modello tecnico di "variante" con parentela tra
esercizi (duplicazione = copia indipendente, per ora), schema spaziale
solo come link (SVG/immagine da costruire), calendario stagione come
elenco cronologico (non vista a griglia mensile), adattamento di una voce
in seduta come nota libera (non override strutturato campo per campo).
