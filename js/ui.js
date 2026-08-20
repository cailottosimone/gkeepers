// ui.js
// Guscio dell'app: barra di navigazione (sidebar su desktop, bottom bar su
// mobile — vedi css) + contenitore. Ogni sezione è un modulo indipendente
// con il proprio render(container).
//
// Su mobile la bottom bar mostra solo le sezioni più usate: le altre
// (Stagioni, Impostazioni) finiscono sotto "Altro", altrimenti con 6 voci
// diventa tutto troppo piccolo per un pollice. Su desktop la sidebar le
// mostra tutte, c'è spazio.

import * as esercizi from './esercizi.js';
import * as sedute from './sedute.js';
import * as stagioni from './stagioni.js';
import * as calendario from './calendario.js';
import * as portieri from './portieri.js';
import * as settings from './settings.js';
import { openModal, closeModal } from './modal.js';

const SECTIONS = [
  { key: 'esercizi', label: 'Esercizi', icon: 'fa-list-check', mod: esercizi },
  { key: 'sedute', label: 'Sedute', icon: 'fa-clipboard-list', mod: sedute },
  { key: 'stagioni', label: 'Stagioni', icon: 'fa-users-rectangle', mod: stagioni, foldMobile: true },
  { key: 'calendario', label: 'Calendario', icon: 'fa-calendar-check', mod: calendario },
  { key: 'portieri', label: 'Portieri', icon: 'fa-user-group', mod: portieri },
  { key: 'settings', label: 'Impostazioni', icon: 'fa-gear', mod: settings, foldMobile: true },
];

let currentKey = null;
let navEl = null;
let contentEl = null;

export function init() {
  navEl = document.getElementById('gk-nav');
  contentEl = document.getElementById('gk-content');

  navEl.innerHTML = `
    <div class="gk-nav-title"><i class="fa-solid fa-shield-halved"></i> GKEEPERS</div>
  ` + SECTIONS.map((s) => `
    <button class="gk-nav-btn" data-key="${s.key}" ${s.foldMobile ? 'data-fold="mobile"' : ''}>
      <i class="fa-solid ${s.icon}"></i><span>${s.label}</span>
    </button>
  `).join('') + `
    <button class="gk-nav-btn gk-nav-more-btn" data-key="__more"><i class="fa-solid fa-ellipsis"></i><span>Altro</span></button>
  `;

  navEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.gk-nav-btn');
    if (!btn) return;
    if (btn.dataset.key === '__more') openMorePopup();
    else activate(btn.dataset.key);
  });

  activate('esercizi');
}

function openMorePopup() {
  const folded = SECTIONS.filter((s) => s.foldMobile);
  openModal((target) => {
    target.innerHTML = `
      <div class="gk-modal-title">Altro</div>
      <div class="gk-opt-list">
        ${folded.map((s) => `
          <div class="gk-opt-row" data-key="${s.key}"><i class="fa-solid ${s.icon}"></i><span class="gk-opt-label">${s.label}</span></div>
        `).join('')}
      </div>
    `;
    target.addEventListener('click', (e) => {
      const row = e.target.closest('[data-key]');
      if (!row) return;
      closeModal();
      activate(row.dataset.key);
    });
  }, { size: 'md', label: 'Altre sezioni' });
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
