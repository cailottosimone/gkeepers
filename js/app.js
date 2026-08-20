// app.js — entry point
import * as storage from './storage.js';
import { CUSTOM_LISTS_DEFAULTS } from './defaults.js';
import * as ui from './ui.js';
import * as sync from './data/sync.js';

const AUTO_SYNC_INTERVAL_MS = 60000;

async function tentaSyncAutomatico() {
  if (!(await sync.isSyncEnabled())) return;
  try {
    await sync.syncAll();
    ui.refreshIfSafe();
  } catch (err) {
    // Silenzioso di proposito: un tentativo automatico che fallisce (rete
    // assente, per esempio) non deve interrompere né avvisare — "Sincronizza
    // ora" in Impostazioni resta sempre disponibile, e mostra l'errore lì.
    console.warn('Sync automatico non riuscito:', err.message);
  }
}

async function main() {
  await storage.ensureDefaults(CUSTOM_LISTS_DEFAULTS);
  await storage.ensureCodes();
  ui.init();

  // Aggiornamento automatico: non solo su "Sincronizza ora" — un tentativo
  // silenzioso all'avvio, uno periodico mentre la app resta aperta, e uno
  // quando torna in primo piano (cambio scheda/app, riapertura). La vista
  // corrente si aggiorna da sola quando arrivano dati nuovi, a meno che tu
  // non sia in quel momento a scrivere in un campo o con un modale aperto
  // (in quel caso non tocca nulla, per non farti perdere una modifica).
  tentaSyncAutomatico();
  setInterval(tentaSyncAutomatico, AUTO_SYNC_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tentaSyncAutomatico();
  });
  window.addEventListener('focus', tentaSyncAutomatico);
}

main().catch((err) => {
  console.error('Errore di avvio GKEEPERS:', err);
  document.getElementById('gk-content').innerHTML =
    `<div class="gk-empty">Errore di avvio: ${err.message}. Controlla la console.</div>`;
});
