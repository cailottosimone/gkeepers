// ui.js
// Guscio dell'app: barra di navigazione laterale, sempre visibile su
// desktop; su mobile è un drawer a scomparsa, aperto/chiuso dal bottone
// hamburger nell'header — non più una bottom bar (con 6 sezioni diventava
// tutto troppo piccolo per un pollice, e "Altro" era comunque un tap in
// più per due sezioni). Il drawer mostra tutte le sezioni direttamente,
// senza bisogno di raggrupparne alcuna.

import * as esercizi from './esercizi.js';
import * as sedute from './sedute.js';
import * as stagioni from './stagioni.js';
import * as calendario from './calendario.js';
import * as portieri from './portieri.js';
import * as settings from './settings.js';

const SECTIONS = [
  { key: 'esercizi', label: 'Esercizi', icon: 'fa-list-check', mod: esercizi },
  { key: 'sedute', label: 'Sedute', icon: 'fa-clipboard-list', mod: sedute },
  { key: 'stagioni', label: 'Stagioni', icon: 'fa-users-rectangle', mod: stagioni },
  { key: 'calendario', label: 'Calendario', icon: 'fa-calendar-check', mod: calendario },
  { key: 'portieri', label: 'Portieri', icon: 'fa-user-group', mod: portieri },
  { key: 'settings', label: 'Impostazioni', icon: 'fa-gear', mod: settings },
];

let currentKey = null;
let navEl = null;
let contentEl = null;
let hamburgerEl = null;
let backdropEl = null;

export function init() {
  navEl = document.getElementById('gk-nav');
  contentEl = document.getElementById('gk-content');
  hamburgerEl = document.getElementById('gk-hamburger');
  backdropEl = document.getElementById('gk-drawer-backdrop');

  navEl.innerHTML = `
    <div class="gk-nav-title"><i class="fa-solid fa-shield-halved"></i> GKEEPERS</div>
  ` + SECTIONS.map((s) => `
    <button class="gk-nav-btn" data-key="${s.key}"><i class="fa-solid ${s.icon}"></i><span>${s.label}</span></button>
  `).join('');

  navEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.gk-nav-btn');
    if (!btn) return;
    activate(btn.dataset.key);
    closeDrawer();
  });

  hamburgerEl?.addEventListener('click', toggleDrawer);
  backdropEl?.addEventListener('click', closeDrawer);

  activate('esercizi');
}

function openDrawer() {
  navEl.classList.add('open');
  backdropEl?.classList.add('open');
}
function closeDrawer() {
  navEl.classList.remove('open');
  backdropEl?.classList.remove('open');
}
function toggleDrawer() {
  navEl.classList.contains('open') ? closeDrawer() : openDrawer();
}

function activate(key) {
  currentKey = key;
  navEl.querySelectorAll('.gk-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.key === key));
  // Contenitore nuovo a ogni cambio sezione: evita che i listener di un
  // modulo (attaccati direttamente sul contenitore) restino attivi e
  // intercettino i data-action di un altro modulo dopo il cambio sezione.
  const fresh = document.createElement('div');
  contentEl.replaceChildren(fresh);
  const section = SECTIONS.find((s) => s.key === key);
  section.mod.render(fresh);
  window.scrollTo({ top: 0 });
}

// Richiamato dopo una sincronizzazione automatica in background: aggiorna
// la sezione corrente SOLO se è sicuro farlo — mai mentre l'utente sta
// scrivendo in un campo o ha un modale di modifica aperto, altrimenti
// rischierebbe di far perdere una modifica in corso.
export function refreshIfSafe() {
  if (!currentKey) return;
  const active = document.activeElement;
  if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
  if (document.querySelector('.gk-modal-backdrop')) return;
  activate(currentKey);
}
