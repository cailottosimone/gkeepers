// presenze.js
// Le presenze (convocati/appello) vivono sull'Evento, non sulla Seduta (che
// resta un template puro e riutilizzabile). Questo modulo offre:
//  - un widget riusabile per gestire convocati/presenti dentro un Evento
//  - lo storico qualità/gesti "assorbiti" da un portiere, calcolato al volo
//    (mai salvato come dato ridondante) solo dagli eventi svolti con appello.

import * as storage from './storage.js';
import { escapeHtml } from './dom-utils.js';

export function renderConvocatiPresenti(container, evento, portieri, onChange) {
  container.innerHTML = `
    <div class="gk-mini-label"><i class="fa-solid fa-clipboard-user"></i> Convocati (previsti)</div>
    <div class="gk-opt-list">
      ${portieri.map((p) => `
        <label class="gk-opt-row ${evento.convocati.includes(p.id) ? 'active' : ''}">
          <input type="checkbox" data-action="toggle-convocato" data-id="${p.id}" ${evento.convocati.includes(p.id) ? 'checked' : ''} />
          <span class="gk-opt-label">${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</span>
        </label>
      `).join('')}
      ${portieri.length === 0 ? '<div class="gk-hint" style="padding:10px">Nessun portiere in rosa.</div>' : ''}
    </div>
    <div class="gk-mini-label" style="margin-top:10px"><i class="fa-solid fa-clipboard-check"></i> Presenti (appello)</div>
    <div class="gk-opt-list">
      ${evento.convocati.map((id) => {
        const p = portieri.find((x) => x.id === id);
        if (!p) return '';
        return `<label class="gk-opt-row ${evento.presenti.includes(p.id) ? 'active' : ''}">
          <input type="checkbox" data-action="toggle-presente" data-id="${p.id}" ${evento.presenti.includes(p.id) ? 'checked' : ''} />
          <span class="gk-opt-label">${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</span>
        </label>`;
      }).join('')}
      ${evento.convocati.length === 0 ? '<div class="gk-hint" style="padding:10px">Convoca prima qualcuno.</div>' : ''}
    </div>
  `;

  container.querySelectorAll('[data-action="toggle-convocato"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      evento.convocati = evento.convocati.includes(id)
        ? evento.convocati.filter((x) => x !== id)
        : [...evento.convocati, id];
      if (!evento.convocati.includes(id)) evento.presenti = evento.presenti.filter((x) => x !== id);
      renderConvocatiPresenti(container, evento, portieri, onChange);
      onChange();
    });
  });
  container.querySelectorAll('[data-action="toggle-presente"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      evento.presenti = evento.presenti.includes(id)
        ? evento.presenti.filter((x) => x !== id)
        : [...evento.presenti, id];
      renderConvocatiPresenti(container, evento, portieri, onChange);
      onChange();
    });
  });
}

// Storico qualità/gesti allenati da un portiere: solo eventi di allenamento,
// svolti, con appello che lo segna presente. Relazione a senso unico — la
// Seduta/Esercizio non sa nulla del portiere, qui solo si legge.
export async function storicoPortiere(portiereId) {
  const [eventi, sedute, esercizi] = await Promise.all([
    storage.getAll('eventi'), storage.getAll('sedute'), storage.getAll('esercizi'),
  ]);
  const seduteById = Object.fromEntries(sedute.map((s) => [s.id, s]));
  const eserciziById = Object.fromEntries(esercizi.map((e) => [e.id, e]));

  const conteggi = {};
  let numEventi = 0;

  for (const ev of eventi) {
    if (ev.tipo !== 'allenamento' || !ev.svolto) continue;
    if (!ev.presenti.includes(portiereId)) continue;
    const seduta = seduteById[ev.sedutaId];
    if (!seduta) continue;
    numEventi++;
    for (const b of seduta.blocchi) {
      for (const v of b.voci) {
        const es = eserciziById[v.esercizioId];
        if (!es) continue;
        for (const tag of es.tag || []) conteggi[tag] = (conteggi[tag] || 0) + 1;
      }
    }
  }
  return { numEventi, conteggi };
}
