LIBRERIE OPZIONALI (offline)
============================

Questa cartella è pensata per librerie facoltative usate in locale.

html2pdf.bundle.min.js  (OPZIONALE)
-----------------------------------
Serve SOLO se vuoi l'export PDF "in un clic" dalla scheda esercizio.
Senza questa libreria, il pulsante "Stampa / PDF" usa comunque la
stampa del browser (Cmd/Ctrl+P → "Salva come PDF"), che con il foglio
css/print.css produce già una scheda pulita.

Per attivarla:
  1. Scarica html2pdf.bundle.min.js (progetto html2pdf.js) e copialo qui:
       lib/html2pdf.bundle.min.js
  2. In index.html togli il commento alla riga:
       <!-- <script src="lib/html2pdf.bundle.min.js" defer></script> -->
  3. Ricarica la pagina. Il pulsante "Stampa / PDF" genererà direttamente
     un file PDF dell'esercizio.

Nota: l'app funziona completamente offline. Nessuna libreria è obbligatoria.
