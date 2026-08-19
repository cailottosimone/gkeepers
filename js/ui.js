// ui.js
// Guscio dell'app: barra di navigazione (sidebar su desktop, bottom bar su
// mobile — vedi css) + contenitore. Ogni sezione è un modulo indipendente
// con il proprio render(container).

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

export function init() {
  const nav = document.getElementById('gk-nav');
  const content = document.getElementById('gk-content');

  nav.innerHTML = `
    <div class="gk-nav-title"><i class="fa-solid fa-shield-halved"></i> GKEEPERS</div>
  ` + SECTIONS.map((s) => `
    <button class="gk-nav-btn" data-key="${s.key}"><i class="fa-solid ${s.icon}"></i><span>${s.label}</span></button>
  `).join('');

  function activate(key) {
    nav.querySelectorAll('.gk-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    // Contenitore nuovo a ogni cambio sezione: evita che i listener di un
    // modulo (attaccati direttamente sul contenitore) restino attivi e
    // intercettino i data-action di un altro modulo dopo il cambio sezione.
    const fresh = document.createElement('div');
    content.replaceChildren(fresh);
    const section = SECTIONS.find((s) => s.key === key);
    section.mod.render(fresh);
    window.scrollTo({ top: 0 });
  }

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.gk-nav-btn');
    if (btn) activate(btn.dataset.key);
  });

  activate('esercizi');
}
