// app.js — entry point
import * as storage from './storage.js';
import { CUSTOM_LISTS_DEFAULTS } from './defaults.js';
import * as ui from './ui.js';
import * as sync from './data/sync.js';

async function main() {
  await storage.ensureDefaults(CUSTOM_LISTS_DEFAULTS);
  ui.init();

  // Se la sincronizzazione è già attiva, un tentativo silenzioso all'avvio
  // (non blocca l'interfaccia, non mostra nulla se fallisce — è solo un
  // "controlla se c'è di nuovo", non l'unico modo per sincronizzare: c'è
  // sempre "Sincronizza ora" in Impostazioni).
  if (await sync.isSyncEnabled()) {
    sync.syncAll().catch((err) => console.warn('Sync automatico non riuscito:', err.message));
  }
}

main().catch((err) => {
  console.error('Errore di avvio GKEEPERS:', err);
  document.getElementById('gk-content').innerHTML =
    `<div class="gk-empty">Errore di avvio: ${err.message}. Controlla la console.</div>`;
});
