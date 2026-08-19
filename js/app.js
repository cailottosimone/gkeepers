// app.js — entry point
import * as storage from './storage.js';
import { CUSTOM_LISTS_DEFAULTS } from './defaults.js';
import * as ui from './ui.js';

async function main() {
  await storage.ensureDefaults(CUSTOM_LISTS_DEFAULTS);
  ui.init();
}

main().catch((err) => {
  console.error('Errore di avvio GKEEPERS:', err);
  document.getElementById('gk-content').innerHTML =
    `<div class="gk-empty">Errore di avvio: ${err.message}. Controlla la console.</div>`;
});
