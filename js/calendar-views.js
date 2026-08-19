// calendar-views.js
// Helper di date + rendering condivisi tra Stagioni (eventi di una singola
// stagione) e il Calendario Allenatore (eventi di tutte le stagioni/squadre
// insieme). Funzioni pure: producono HTML, non toccano lo storage.

import { escapeHtml, fmtDate, isoLocal } from './dom-utils.js';

export const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function mondayOf(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
export function isoOf(d) { return isoLocal(d); }
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// Colore pseudo-casuale ma stabile per id (stessa stagione = sempre lo
// stesso colore, senza doverlo salvare da nessuna parte).
export function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 62%, 45%)`;
}

// opts.showSquadra: antepone il nome squadra (calendario aggregato)
// opts.colorBySeason: bordo colorato per stagione, per distinguere eventi
// di stagioni/squadre diverse quando sono mostrati insieme
export function eventoChipHtml(e, opts = {}) {
  const orario = e.ora ? `${e.ora} · ` : '';
  const squadra = opts.showSquadra && e.squadraNome ? `${escapeHtml(e.squadraNome)} · ` : '';
  const label = e.tipo === 'partita'
    ? `<i class="fa-solid fa-futbol"></i> ${squadra}${orario}vs ${escapeHtml(e.partita?.avversario || '?')}`
    : `<i class="fa-solid fa-dumbbell"></i> ${squadra}${orario}Allenamento`;
  const colorStyle = opts.colorBySeason && e.stagioneId ? ` style="border-left-color:${colorForId(e.stagioneId)}"` : '';
  return `<div class="gk-evt-chip ${e.tipo} ${e.svolto ? 'svolto' : ''}" data-action="open-evento" data-id="${e.id}"${colorStyle}>${label}</div>`;
}

function dayCellEvents(dayEventi, iso, opts) {
  const cap = opts.capPerDay;
  if (!cap || dayEventi.length <= cap) {
    return dayEventi.map((e) => eventoChipHtml(e, opts)).join('');
  }
  const visibili = dayEventi.slice(0, cap);
  const resto = dayEventi.length - cap;
  const more = opts.dayPopup
    ? `<button class="gk-day-more" data-action="show-day-events" data-date="${iso}">+${resto}</button>`
    : `<div class="gk-hint">+${resto}</div>`;
  return visibili.map((e) => eventoChipHtml(e, opts)).join('') + more;
}

function dayLabelRow(labelText, iso, opts, labelClass) {
  const addBtn = opts.allowAdd ? `<button class="gk-day-add" data-action="add-evento-day" data-date="${iso}" title="Aggiungi evento"><i class="fa-solid fa-plus"></i></button>` : '';
  return `<div class="gk-day-label-row"><span class="${labelClass}">${labelText}</span>${addBtn}</div>`;
}

// Da chiamare dopo aver inserito l'HTML di weekHtml/calendarHtml nel DOM:
// abilita il trascinamento degli eventi da un giorno a un altro.
// onMove(eventId, nuovaDataIso) viene chiamata al rilascio.
export function wireDragDrop(root, onMove) {
  root.querySelectorAll('.gk-evt-chip').forEach((chip) => {
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.id);
    });
  });
  root.querySelectorAll('[data-day-drop]').forEach((cell) => {
    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) onMove(id, cell.dataset.dayDrop);
    });
  });
}

export function weekHtml(eventi, weekRef, todayISO, opts = {}) {
  const monday = mondayOf(weekRef);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return `
    <div class="gk-week-nav">
      <button class="gk-icon-btn" data-action="week-prev"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="gk-label" style="margin:0"><i class="fa-solid fa-calendar-week"></i> ${fmtDate(isoOf(monday))} → ${fmtDate(isoOf(addDays(monday, 6)))}</div>
      <div>
        <button class="gk-icon-btn" data-action="week-today" title="Questa settimana"><i class="fa-solid fa-calendar-day"></i></button>
        <button class="gk-icon-btn" data-action="week-next"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    </div>
    <div class="gk-week-grid">
      ${days.map((d) => {
        const iso = isoOf(d);
        const dayEventi = eventi.filter((e) => e.data === iso).sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
        return `
        <div class="gk-week-day ${iso === todayISO ? 'today' : ''}" data-day-drop="${iso}">
          ${dayLabelRow(`${GIORNI[d.getDay() === 0 ? 6 : d.getDay() - 1].slice(0, 3)} ${d.getDate()}`, iso, opts, 'gk-week-day-label')}
          ${dayCellEvents(dayEventi, iso, opts)}
        </div>`;
      }).join('')}
    </div>
  `;
}

export function calendarHtml(eventi, calRef, todayISO, opts = {}) {
  const first = new Date(calRef.getFullYear(), calRef.getMonth(), 1);
  const startOffset = (first.getDay() === 0 ? 6 : first.getDay() - 1);
  const gridStart = addDays(first, -startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const capMese = opts.capPerDay ?? 3;
  return `
    <div class="gk-week-nav">
      <button class="gk-icon-btn" data-action="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="gk-label" style="margin:0"><i class="fa-solid fa-calendar-days"></i> ${MESI[calRef.getMonth()]} ${calRef.getFullYear()}</div>
      <button class="gk-icon-btn" data-action="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="gk-cal-grid">
      ${GIORNI.map((g) => `<div class="gk-cal-dow">${g.slice(0, 3)}</div>`).join('')}
      ${cells.map((d) => {
        const iso = isoOf(d);
        const out = d.getMonth() !== calRef.getMonth();
        const dayEventi = eventi.filter((e) => e.data === iso).sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
        return `
        <div class="gk-cal-day ${out ? 'out' : ''} ${iso === todayISO ? 'today' : ''}" data-day-drop="${iso}">
          ${dayLabelRow(String(d.getDate()), iso, opts, 'gk-cal-daynum')}
          ${dayCellEvents(dayEventi, iso, { ...opts, capPerDay: capMese })}
        </div>`;
      }).join('')}
    </div>
  `;
}

export function elencoHtml(eventi, opts = {}) {
  if (eventi.length === 0) return '<div class="gk-empty">Nessun evento.</div>';
  return `<div class="gk-list" style="margin-top:4px">
    ${eventi.map((e) => `
      <div class="gk-list-item" data-action="open-evento" data-id="${e.id}" style="cursor:pointer">
        <div>
          <div class="gk-list-title">${fmtDate(e.data)}${e.ora ? ' · ' + e.ora : ''} — ${e.tipo === 'partita' ? 'Partita' : 'Allenamento'}</div>
          <div class="gk-list-sub">${opts.showSquadra ? escapeHtml(e.squadraNome || '') + ' · ' : ''}${eventoSubtitle(e)}</div>
        </div>
        <div class="gk-list-actions">
          ${e.svolto ? '<span class="gk-badge">svolto</span>' : ''}
          ${opts.showDelete !== false ? `<button class="gk-icon-btn danger" data-action="delete-evento" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function eventoSubtitle(e) {
  if (e.tipo === 'partita') {
    return `vs ${escapeHtml(e.partita?.avversario || '?')} (${e.partita?.casaTrasferta === 'casa' ? 'casa' : 'trasferta'})`;
  }
  return `${e.presenti.length}/${e.convocati.length} presenti`;
}

// Popup con l'elenco completo degli eventi di un giorno (usato dal "+N").
export function dayPopupHtml(dataIso, dayEventi, opts = {}) {
  return `
    <div class="gk-modal-title">${fmtDate(dataIso)}</div>
    <div class="gk-usi-list">
      ${dayEventi.map((e) => `
        <div class="gk-usi-row">
          <span style="cursor:pointer" data-action="open-evento" data-id="${e.id}">
            ${e.tipo === 'partita' ? `<i class="fa-solid fa-futbol"></i> vs ${escapeHtml(e.partita?.avversario || '?')}` : `<i class="fa-solid fa-dumbbell"></i> Allenamento`}
            ${e.ora ? ' · ' + e.ora : ''} ${opts.showSquadra && e.squadraNome ? '· ' + escapeHtml(e.squadraNome) : ''}
          </span>
          <button class="gk-icon-btn danger" data-action="delete-evento-popup" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      `).join('')}
    </div>
  `;
}
