// js/components/sync-indicator.js — pulsante nella barra con lo stato della sincronizzazione
// cloud. Puramente presentazionale: legge solo js/data/sync.js, non conosce i dati applicativi.
// Riceve un callback `onOpen` (per aprire la tab "Account e sincronizzazione" di Impostazioni)
// invece di importare direttamente ui.js: evita una dipendenza circolare (ui.js importa questo
// modulo per montarlo nella barra).

import { state as syncState, onSyncStateChange } from '../data/sync.js';

const _svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICO_OFFLINE = _svg('<path d="M3 3l18 18M8.5 8.5A10 10 0 0 1 19 12M5 12a10 10 0 0 1 2.3-3.2M12 19h.01"/>');
const ICO_CLOUD = _svg('<path d="M17.5 19H7a4.5 4.5 0 0 1-1-8.9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 9.5Z"/>');
const ICO_WARN = _svg('<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>');
const ICO_SYNC = _svg('<path d="M21 12a9 9 0 0 1-15.3 6.4M3 12a9 9 0 0 1 15.3-6.4M21 3v6h-6M3 21v-6h6"/>');
const ICO_OK = _svg('<path d="M17.5 19H7a4.5 4.5 0 0 1-1-8.9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 9.5Z"/><path d="m9 13 2 2 4-4"/>');

const CONFIG = {
  offline: { icon: ICO_OFFLINE, label: 'Offline', cls: 'is-offline' },
  disconnesso: { icon: ICO_CLOUD, label: 'Cloud non collegato', cls: 'is-muto' },
  da_collegare: { icon: ICO_WARN, label: 'Da collegare', cls: 'is-attenzione' },
  syncing: { icon: ICO_SYNC, label: 'Sincronizzazione…', cls: 'is-attivo' },
  idle: { icon: ICO_OK, label: 'Sincronizzato', cls: 'is-ok' },
  error: { icon: ICO_WARN, label: 'Errore di sync', cls: 'is-errore' },
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render(el) {
  const c = CONFIG[syncState.status] || CONFIG.disconnesso;
  const badge = syncState.pendingCount > 0 && syncState.status !== 'syncing'
    ? `<span class="sync-badge-count">${syncState.pendingCount}</span>` : '';
  el.className = `sync-indicator ${c.cls} ${syncState.status === 'syncing' ? 'is-spinning' : ''}`;
  el.title = `Sincronizzazione — ${c.label} — apri Account e sincronizzazione`;
  el.setAttribute('aria-label', el.title);
  el.innerHTML = `<span class="sync-ico">${c.icon}</span>${badge}`;
}

/** Monta il pulsante nell'elemento passato (vedi ui.js _buildShell) e resta aggiornato da solo
 * finché la pagina resta aperta: non richiede di essere richiamato dopo ogni render. */
export function mountSyncIndicator(el, onOpen) {
  if (!el) return;
  render(el);
  onSyncStateChange(() => render(el));
  el.addEventListener('click', () => { if (typeof onOpen === 'function') onOpen(); });
}
