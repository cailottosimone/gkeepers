// stagioni.js
// Squadra -> Stagione (calendario, non contenuto) -> Evento (allenamento
// collegato a una Seduta pronta, oppure partita con dettagli propri).
// Le presenze vivono sull'Evento (vedi presenze.js). Rendering degli eventi
// (settimana/calendario/elenco) e form evento condivisi rispettivamente con
// calendar-views.js e evento-editor.js — riusati anche dal Calendario
// Allenatore.

import * as storage from './storage.js';
import { escapeHtml, fmtDate, todayISO, isoLocal } from './dom-utils.js';
import { weekHtml, calendarHtml, elencoHtml, dayPopupHtml, wireDragDrop, GIORNI, mondayOf, addDays } from './calendar-views.js';
import { emptyEvento, mountEventoForm } from './evento-editor.js';
import { openModal, closeModal, isDesktop } from './modal.js';

// Colore di partenza per una nuova stagione: una tinta casuale, in
// esadecimale (l'input color non accetta hsl). Solo un punto di partenza
// comodo — l'allenatore può sempre scegliere un colore diverso.
function defaultStagioneColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 0.62, l = 0.45;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// Nella settimana/calendario di UNA stagione: al massimo 2 eventi visibili
// per giorno, poi "+N" apre il popup — evita che la riga si allunghi.
const CAP_GIORNO = 2;

async function listSquadre() {
  const items = await storage.getAll('squadre');
  return items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
}
async function listStagioni(squadraId) {
  const items = await storage.getAll('stagioni');
  return items.filter((s) => s.squadraId === squadraId)
    .sort((a, b) => (b.dataInizio || '').localeCompare(a.dataInizio || ''));
}
async function listEventi(stagioneId) {
  const items = await storage.getAll('eventi');
  return items.filter((e) => e.stagioneId === stagioneId)
    .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.ora || '').localeCompare(b.ora || ''));
}

export function render(container) {
  let squadraCorrente = null;
  let stagioneCorrente = null;
  let stagioneDraft = null;
  let eventiView = 'settimana'; // settimana | calendario | elenco
  let weekRef = new Date();
  let calRef = new Date();
  let formTarget = null;

  // ---------- SQUADRE ----------
  async function drawSquadre() {
    const squadre = await listSquadre();
    container.innerHTML = `
      <div class="gk-section-head"><h2>Squadre</h2><button class="gk-btn primary" data-action="new-squadra"><i class="fa-solid fa-plus"></i>Nuova squadra</button></div>
      <div id="gk-squadra-form-slot"></div>
      ${squadre.length === 0 ? '<div class="gk-empty">Nessuna squadra. Creane una per iniziare a pianificare le stagioni.</div>' : `
        <div class="gk-rows">
          ${squadre.map((s) => `
            <div class="gk-row gk-clickable" data-action="open-squadra" data-id="${s.id}">
              <span class="gk-row-title">${escapeHtml(s.nome)}</span>
              <div class="gk-row-actions">
                <button class="gk-icon-btn danger" data-action="delete-squadra" data-id="${s.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  // ---------- STAGIONI ----------
  async function drawStagioni() {
    const stagioni = await listStagioni(squadraCorrente.id);
    container.innerHTML = `
      <div class="gk-section-head">
        <h2><i class="fa-solid fa-users"></i> ${escapeHtml(squadraCorrente.nome)}</h2>
        <div class="gk-row-btns">
          <button class="gk-btn" data-action="back-squadre"><i class="fa-solid fa-arrow-left"></i>Squadre</button>
          <button class="gk-btn primary" data-action="new-stagione"><i class="fa-solid fa-plus"></i>Nuova stagione</button>
        </div>
      </div>
      ${stagioni.length === 0 ? '<div class="gk-empty" style="margin-top:12px">Nessuna stagione per questa squadra.</div>' : `
        <div class="gk-rows" style="margin-top:12px">
          ${stagioni.map((s) => `
            <div class="gk-row gk-clickable" data-action="open-stagione" data-id="${s.id}">
              <span class="gk-row-title">${escapeHtml(s.nome)}</span>
              <span class="gk-row-sub">${fmtDate(s.dataInizio)} → ${fmtDate(s.dataFine)}</span>
              <div class="gk-row-actions">
                <button class="gk-icon-btn" data-action="edit-stagione" data-id="${s.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
                <button class="gk-icon-btn danger" data-action="delete-stagione" data-id="${s.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
      <div id="gk-stagione-form-slot"></div>
    `;
  }

  function stagioneFormHtml(s = {}) {
    return `
      <div class="gk-card gk-form">
        <div class="gk-field"><label>Nome stagione</label><input class="gk-input" id="fs-nome" value="${escapeHtml(s.nome || '')}" placeholder="Es. Stagione 2026/27" /></div>
        <div class="gk-field"><label>Inizio</label><input class="gk-input" type="date" id="fs-inizio" value="${s.dataInizio || ''}" /></div>
        <div class="gk-field"><label>Fine</label><input class="gk-input" type="date" id="fs-fine" value="${s.dataFine || ''}" /></div>
        <div class="gk-field">
          <label>Colore <span class="gk-hint">(usato solo nel Calendario allenatore, per distinguerla dalle altre stagioni)</span></label>
          <input class="gk-color-input" type="color" id="fs-colore" value="${s.colore || defaultStagioneColor()}" />
        </div>
        <div class="gk-field"><label>Note</label><textarea class="gk-input" id="fs-note" rows="2">${escapeHtml(s.note || '')}</textarea></div>
        <div class="gk-form-actions">
          <button class="gk-btn" data-action="cancel-stagione">Annulla</button>
          <button class="gk-btn primary" data-action="save-stagione"><i class="fa-solid fa-floppy-disk"></i>Salva</button>
        </div>
      </div>
    `;
  }

  // ---------- EVENTI: guscio con selettore vista ----------
  async function drawEventi() {
    const eventi = await listEventi(stagioneCorrente.id);
    container.innerHTML = `
      <div class="gk-section-head">
        <h2><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(stagioneCorrente.nome)}</h2>
        <button class="gk-btn" data-action="back-stagioni"><i class="fa-solid fa-arrow-left"></i>Stagioni</button>
      </div>
      <div class="gk-row-btns" style="margin-bottom:10px">
        <button class="gk-btn primary" data-action="new-evento"><i class="fa-solid fa-plus"></i>Evento</button>
        <button class="gk-btn" data-action="open-ricorrenza"><i class="fa-solid fa-repeat"></i>Genera eventi ricorrenti</button>
        ${eventi.length > 0 ? `<button class="gk-btn danger-outline" data-action="cancella-tutti-eventi"><i class="fa-solid fa-trash"></i>Cancella tutti (${eventi.length})</button>` : ''}
      </div>
      <div id="gk-ricorrenza-slot"></div>
      <div class="gk-view-switch">
        <button class="gk-tab ${eventiView === 'settimana' ? 'active' : ''}" data-action="view-settimana"><i class="fa-solid fa-calendar-week"></i> Settimana</button>
        <button class="gk-tab ${eventiView === 'calendario' ? 'active' : ''}" data-action="view-calendario"><i class="fa-solid fa-calendar-days"></i> Calendario</button>
        <button class="gk-tab ${eventiView === 'elenco' ? 'active' : ''}" data-action="view-elenco"><i class="fa-solid fa-list"></i> Elenco</button>
      </div>
      <div id="gk-eventi-view"></div>
    `;
    await drawEventiView(eventi);
  }

  async function drawEventiView(eventi) {
    const slot = document.getElementById('gk-eventi-view');
    if (!slot) return;
    const today = todayISO();
    const opts = { capPerDay: CAP_GIORNO, dayPopup: true, allowAdd: true };
    if (eventiView === 'settimana') slot.innerHTML = weekHtml(eventi, weekRef, today, opts);
    else if (eventiView === 'calendario') slot.innerHTML = calendarHtml(eventi, calRef, today, opts);
    else { slot.innerHTML = elencoHtml(eventi); return; }
    wireDragDrop(slot, async (eventId, nuovaData) => {
      const ev = await storage.get('eventi', eventId);
      if (!ev || ev.data === nuovaData) return;
      ev.data = nuovaData;
      ev.updatedAt = storage.now();
      await storage.put('eventi', ev);
      drawEventiView(await listEventi(stagioneCorrente.id));
    });
  }

  function ricorrenzaHtml() {
    return `
      <div class="gk-card gk-form">
        <div class="gk-hint" style="margin-bottom:8px">Genera solo gli EVENTI del calendario (il "quando") — la seduta si assegna dopo, evento per evento. Per ogni giorno selezionato puoi scegliere il tipo.</div>
        <div class="gk-field"><label>Giorni della settimana</label>
          <div class="gk-opt-list">
            ${GIORNI.map((g, i) => {
              const val = i === 6 ? 0 : i + 1;
              return `
                <div class="gk-opt-row" style="justify-content:space-between;cursor:default">
                  <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
                    <input type="checkbox" name="fr-giorno" value="${val}" />
                    <span class="gk-opt-label">${g}</span>
                  </label>
                  <select class="gk-input gk-inline-input" name="fr-tipo-giorno" data-day="${val}" style="width:150px">
                    <option value="allenamento" selected>Allenamento</option>
                    <option value="partita">Partita</option>
                  </select>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="gk-field"><label>Ora</label><input class="gk-input" type="time" id="fr-ora" /></div>
        <div class="gk-field"><label>Dal</label><input class="gk-input" type="date" id="fr-dal" value="${stagioneCorrente.dataInizio || todayISO()}" /></div>
        <div class="gk-field"><label>Al</label><input class="gk-input" type="date" id="fr-al" value="${stagioneCorrente.dataFine || todayISO()}" /></div>
        <div class="gk-form-actions">
          <button class="gk-btn" data-action="cancel-ricorrenza">Annulla</button>
          <button class="gk-btn primary" data-action="genera-ricorrenza"><i class="fa-solid fa-repeat"></i>Genera eventi</button>
        </div>
      </div>
    `;
  }

  // ---------- EVENTO (form condiviso) ----------
  function startEvento(draft) {
    if (isDesktop()) {
      openModal((target) => {
        formTarget = target;
        mountEventoForm(target, draft, {
          onSaved: () => { formTarget = null; closeModal(); drawEventi(); },
          onCancel: () => { formTarget = null; closeModal(); drawEventi(); },
          onDeleted: () => { formTarget = null; closeModal(); drawEventi(); },
        });
      }, { size: 'lg', label: draft.id ? 'Modifica evento' : 'Nuovo evento' });
    } else {
      container.innerHTML = '';
      const wrapper = document.createElement('div');
      container.appendChild(wrapper);
      formTarget = wrapper;
      mountEventoForm(wrapper, draft, {
        showBackButton: true,
        onSaved: () => { formTarget = null; drawEventi(); },
        onCancel: () => { formTarget = null; drawEventi(); },
        onDeleted: () => { formTarget = null; drawEventi(); },
      });
    }
  }

  async function showDayPopup(dataIso) {
    const eventi = (await listEventi(stagioneCorrente.id)).filter((e) => e.data === dataIso);
    openModal((target) => {
      target.innerHTML = dayPopupHtml(dataIso, eventi);
      target.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'open-evento') {
          closeModal();
          startEvento(structuredCloneSafe(await storage.get('eventi', btn.dataset.id)));
        } else if (btn.dataset.action === 'delete-evento-popup') {
          if (!window.confirm('Eliminare questo evento?')) return;
          await storage.remove('eventi', btn.dataset.id);
          closeModal();
          drawEventi();
        }
      });
    }, { size: 'md', label: 'Eventi del giorno' });
  }

  // ---------- eventi click (guscio squadre/stagioni/eventi) ----------
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const slotSquadra = document.getElementById('gk-squadra-form-slot');

    if (action === 'new-squadra') { slotSquadra.innerHTML = `
      <div class="gk-card gk-form">
        <div class="gk-field"><label>Nome squadra</label><input class="gk-input" id="fq-nome" /></div>
        <div class="gk-form-actions">
          <button class="gk-btn" data-action="cancel-squadra">Annulla</button>
          <button class="gk-btn primary" data-action="save-squadra"><i class="fa-solid fa-floppy-disk"></i>Salva</button>
        </div>
      </div>`; }
    else if (action === 'cancel-squadra') { slotSquadra.innerHTML = ''; }
    else if (action === 'save-squadra') {
      const nome = document.getElementById('fq-nome').value.trim();
      if (!nome) return;
      await storage.put('squadre', { id: storage.uid(), nome, createdAt: storage.now(), updatedAt: storage.now() });
      drawSquadre();
    }
    else if (action === 'delete-squadra') {
      if (!window.confirm('Eliminare questa squadra? Le stagioni collegate restano ma andranno gestite a parte.')) return;
      await storage.remove('squadre', btn.dataset.id);
      drawSquadre();
    }
    else if (action === 'open-squadra') { squadraCorrente = await storage.get('squadre', btn.dataset.id); drawStagioni(); }
    else if (action === 'back-squadre') { drawSquadre(); }

    else if (action === 'new-stagione') {
      stagioneDraft = { squadraId: squadraCorrente.id };
      document.getElementById('gk-stagione-form-slot').innerHTML = stagioneFormHtml();
    }
    else if (action === 'edit-stagione') {
      stagioneDraft = await storage.get('stagioni', btn.dataset.id);
      document.getElementById('gk-stagione-form-slot').innerHTML = stagioneFormHtml(stagioneDraft);
    }
    else if (action === 'cancel-stagione') { document.getElementById('gk-stagione-form-slot').innerHTML = ''; }
    else if (action === 'save-stagione') {
      const nome = document.getElementById('fs-nome').value.trim();
      if (!nome) return;
      await storage.put('stagioni', {
        id: stagioneDraft.id || storage.uid(), squadraId: squadraCorrente.id, nome,
        dataInizio: document.getElementById('fs-inizio').value,
        dataFine: document.getElementById('fs-fine').value,
        colore: document.getElementById('fs-colore').value,
        note: document.getElementById('fs-note').value,
        createdAt: stagioneDraft.createdAt || storage.now(), updatedAt: storage.now(),
      });
      stagioneDraft = null;
      drawStagioni();
    }
    else if (action === 'delete-stagione') {
      if (!window.confirm('Eliminare questa stagione? Gli eventi collegati resteranno orfani.')) return;
      await storage.remove('stagioni', btn.dataset.id);
      drawStagioni();
    }
    else if (action === 'open-stagione') {
      stagioneCorrente = await storage.get('stagioni', btn.dataset.id);
      weekRef = new Date(); calRef = new Date(); eventiView = 'settimana';
      drawEventi();
    }
    else if (action === 'back-stagioni') { drawStagioni(); }

    else if (action === 'new-evento') { startEvento(emptyEvento(stagioneCorrente.id, squadraCorrente.id)); }
    else if (action === 'add-evento-day') { startEvento(emptyEvento(stagioneCorrente.id, squadraCorrente.id, btn.dataset.date)); }
    else if (action === 'open-evento') { startEvento(structuredCloneSafe(await storage.get('eventi', btn.dataset.id))); }
    else if (action === 'delete-evento') {
      if (!window.confirm('Eliminare questo evento?')) return;
      await storage.remove('eventi', btn.dataset.id);
      drawEventi();
    }
    else if (action === 'show-day-events') { await showDayPopup(btn.dataset.date); }
    else if (action === 'cancella-tutti-eventi') {
      const eventi = await listEventi(stagioneCorrente.id);
      if (!window.confirm(`Eliminare tutti i ${eventi.length} event${eventi.length === 1 ? 'o' : 'i'} di questa stagione? L'operazione non è reversibile.`)) return;
      for (const ev of eventi) await storage.remove('eventi', ev.id);
      drawEventi();
    }
    else if (action === 'open-ricorrenza') { document.getElementById('gk-ricorrenza-slot').innerHTML = ricorrenzaHtml(); }
    else if (action === 'cancel-ricorrenza') { document.getElementById('gk-ricorrenza-slot').innerHTML = ''; }
    else if (action === 'genera-ricorrenza') {
      const giorni = Array.from(document.querySelectorAll('input[name="fr-giorno"]:checked')).map((c) => +c.value);
      if (giorni.length === 0) { window.alert('Seleziona almeno un giorno della settimana.'); return; }
      const tipoPerGiorno = {};
      document.querySelectorAll('select[name="fr-tipo-giorno"]').forEach((sel) => {
        tipoPerGiorno[+sel.dataset.day] = sel.value;
      });
      const ora = document.getElementById('fr-ora').value;
      const dal = document.getElementById('fr-dal').value;
      const al = document.getElementById('fr-al').value;
      if (!dal || !al) return;
      let cur = new Date(dal + 'T00:00:00');
      const fine = new Date(al + 'T00:00:00');
      while (cur <= fine) {
        if (giorni.includes(cur.getDay())) {
          await storage.put('eventi', {
            ...emptyEvento(stagioneCorrente.id, squadraCorrente.id),
            id: storage.uid(), data: isoLocal(cur), ora, tipo: tipoPerGiorno[cur.getDay()] || 'allenamento',
            createdAt: storage.now(), updatedAt: storage.now(),
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
      document.getElementById('gk-ricorrenza-slot').innerHTML = '';
      drawEventi();
    }

    else if (action === 'view-settimana' || action === 'view-calendario' || action === 'view-elenco') {
      eventiView = action.replace('view-', '');
      drawEventi();
    }
    else if (action === 'week-prev') { weekRef = addDays(mondayOf(weekRef), -7); drawEventiView(await listEventi(stagioneCorrente.id)); }
    else if (action === 'week-next') { weekRef = addDays(mondayOf(weekRef), 7); drawEventiView(await listEventi(stagioneCorrente.id)); }
    else if (action === 'week-today') { weekRef = new Date(); drawEventiView(await listEventi(stagioneCorrente.id)); }
    else if (action === 'cal-prev') { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); drawEventiView(await listEventi(stagioneCorrente.id)); }
    else if (action === 'cal-next') { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); drawEventiView(await listEventi(stagioneCorrente.id)); }
  });

  drawSquadre();
}

function structuredCloneSafe(obj) {
  return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}
