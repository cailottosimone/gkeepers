// calendario.js
// "Calendario Allenatore": stesse viste (Settimana/Calendario/Elenco) di
// Stagioni, ma qui gli eventi vengono da TUTTE le stagioni e squadre
// insieme — un unico sguardo d'insieme sull'attività pianificata. Apre lo
// stesso form evento (evento-editor.js) di Stagioni; salvando si torna qui.

import * as storage from './storage.js';
import { todayISO } from './dom-utils.js';
import { weekHtml, calendarHtml, elencoHtml, mondayOf, addDays, wireDragDrop } from './calendar-views.js';
import { mountEventoForm } from './evento-editor.js';
import { openModal, closeModal, isDesktop } from './modal.js';

async function eventiConContesto() {
  const [eventi, stagioni, squadre] = await Promise.all([
    storage.getAll('eventi'), storage.getAll('stagioni'), storage.getAll('squadre'),
  ]);
  const stagioniById = Object.fromEntries(stagioni.map((s) => [s.id, s]));
  const squadreById = Object.fromEntries(squadre.map((s) => [s.id, s]));
  return eventi.map((e) => ({
    ...e,
    stagioneNome: stagioniById[e.stagioneId]?.nome || '—',
    squadraNome: squadreById[e.squadraId]?.nome || '—',
  }));
}

export function render(container) {
  let view = 'settimana'; // settimana | calendario | elenco
  let weekRef = new Date();
  let calRef = new Date();
  let formTarget = null;

  async function draw() {
    const eventi = await eventiConContesto();
    container.innerHTML = `
      <div class="gk-section-head"><h2><i class="fa-solid fa-calendar-check"></i> Calendario allenatore</h2></div>
      <div class="gk-hint" style="margin-bottom:10px">Tutte le attività pianificate, di tutte le squadre e stagioni insieme.</div>
      <div class="gk-view-switch">
        <button class="gk-tab ${view === 'settimana' ? 'active' : ''}" data-action="view-settimana"><i class="fa-solid fa-calendar-week"></i> Settimana</button>
        <button class="gk-tab ${view === 'calendario' ? 'active' : ''}" data-action="view-calendario"><i class="fa-solid fa-calendar-days"></i> Calendario</button>
        <button class="gk-tab ${view === 'elenco' ? 'active' : ''}" data-action="view-elenco"><i class="fa-solid fa-list"></i> Elenco</button>
      </div>
      <div id="gk-cal-view"></div>
    `;
    drawView(eventi);
  }

  function drawView(eventi) {
    const slot = document.getElementById('gk-cal-view');
    if (!slot) return;
    const today = todayISO();
    const opts = { showSquadra: true, colorBySeason: true };
    if (view === 'settimana') slot.innerHTML = weekHtml(eventi, weekRef, today, opts);
    else if (view === 'calendario') slot.innerHTML = calendarHtml(eventi, calRef, today, opts);
    else { slot.innerHTML = elencoHtml(eventi, { ...opts, showDelete: false }); return; }
    wireDragDrop(slot, async (eventId, nuovaData) => {
      const ev = await storage.get('eventi', eventId);
      if (!ev || ev.data === nuovaData) return;
      ev.data = nuovaData;
      ev.updatedAt = storage.now();
      await storage.put('eventi', ev);
      drawView(await eventiConContesto());
    });
  }

  function openEvento(evento) {
    if (isDesktop()) {
      openModal((target) => {
        formTarget = target;
        mountEventoForm(target, evento, {
          onSaved: () => { formTarget = null; closeModal(); draw(); },
          onCancel: () => { formTarget = null; closeModal(); draw(); },
          onDeleted: () => { formTarget = null; closeModal(); draw(); },
        });
      }, { size: 'lg', label: 'Evento' });
    } else {
      container.innerHTML = '';
      const wrapper = document.createElement('div');
      container.appendChild(wrapper);
      formTarget = wrapper;
      mountEventoForm(wrapper, evento, {
        showBackButton: true,
        onSaved: () => { formTarget = null; draw(); },
        onCancel: () => { formTarget = null; draw(); },
        onDeleted: () => { formTarget = null; draw(); },
      });
    }
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'view-settimana' || action === 'view-calendario' || action === 'view-elenco') {
      view = action.replace('view-', '');
      draw();
    }
    else if (action === 'open-evento') {
      const evento = await storage.get('eventi', btn.dataset.id);
      if (evento) openEvento(evento);
    }
    else if (action === 'week-prev') { weekRef = addDays(mondayOf(weekRef), -7); drawView(await eventiConContesto()); }
    else if (action === 'week-next') { weekRef = addDays(mondayOf(weekRef), 7); drawView(await eventiConContesto()); }
    else if (action === 'week-today') { weekRef = new Date(); drawView(await eventiConContesto()); }
    else if (action === 'cal-prev') { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); drawView(await eventiConContesto()); }
    else if (action === 'cal-next') { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); drawView(await eventiConContesto()); }
  });

  draw();
}
