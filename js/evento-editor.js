// evento-editor.js
// Form di creazione/modifica di un Evento (allenamento o partita), estratto
// da stagioni.js per essere riusabile anche dal Calendario Allenatore (che
// mostra e permette di aprire eventi di stagioni/squadre diverse).

import * as storage from './storage.js';
import { escapeHtml, todayISO, idPrefix, stepSummary } from './dom-utils.js';
import { aggregatoSeduta } from './sedute.js';
import { renderConvocatiPresenti } from './presenze.js';

export function emptyEvento(stagioneId, squadraId, data) {
  return {
    id: null, stagioneId, squadraId, data: data || todayISO(), ora: '', tipo: 'allenamento',
    sedutaId: '', convocati: [], presenti: [], note: '', svolto: false,
    partita: { avversario: '', casaTrasferta: 'casa', risultatoNoi: '', risultatoAvversario: '' },
  };
}

// target: elemento dove disegnare il form. onSaved/onCancel/onDeleted: callback.
export function mountEventoForm(target, eventoDraft, { showBackButton = false, onSaved, onCancel, onDeleted } = {}) {
  draw();

  async function draw() {
    const [sedute, portieri] = await Promise.all([storage.getAll('sedute'), storage.getAll('portieri')]);
    target.innerHTML = `
      <div class="gk-section-head">
        <h2>${eventoDraft.id ? 'Modifica evento' : 'Nuovo evento'}</h2>
        ${showBackButton ? `<button class="gk-btn" data-ev-action="back"><i class="fa-solid fa-arrow-left"></i>Indietro</button>` : ''}
      </div>
      <div class="gk-card">
        <div class="gk-field"><label>Data</label><input class="gk-input" type="date" id="fe-data" value="${eventoDraft.data}" /></div>
        <div class="gk-field"><label>Ora</label><input class="gk-input" type="time" id="fe-ora" value="${eventoDraft.ora || ''}" /></div>
        <div class="gk-field">
          <label>Tipo</label>
          <select class="gk-input" id="fe-tipo">
            <option value="allenamento" ${eventoDraft.tipo === 'allenamento' ? 'selected' : ''}>Allenamento</option>
            <option value="partita" ${eventoDraft.tipo === 'partita' ? 'selected' : ''}>Partita</option>
          </select>
        </div>
        <label class="gk-checkbox-row"><input type="checkbox" id="fe-svolto" ${eventoDraft.svolto ? 'checked' : ''} /> Evento già svolto</label>
      </div>

      <div id="gk-evento-tipo-slot"></div>

      <div class="gk-card">
        <div class="gk-label">Note</div>
        <textarea class="gk-input" id="fe-note" rows="2">${escapeHtml(eventoDraft.note)}</textarea>
      </div>

      <div class="gk-save-row">
        <button class="gk-btn primary" data-ev-action="save"><i class="fa-solid fa-floppy-disk"></i>Salva evento</button>
        ${eventoDraft.id ? `<button class="gk-btn danger-outline" data-ev-action="delete"><i class="fa-solid fa-trash"></i>Elimina</button>` : ''}
      </div>
    `;

    target.querySelector('#fe-data').addEventListener('input', (e) => { eventoDraft.data = e.target.value; });
    target.querySelector('#fe-ora').addEventListener('input', (e) => { eventoDraft.ora = e.target.value; });
    target.querySelector('#fe-svolto').addEventListener('change', (e) => { eventoDraft.svolto = e.target.checked; });
    target.querySelector('#fe-note').addEventListener('input', (e) => { eventoDraft.note = e.target.value; });
    target.querySelector('#fe-tipo').addEventListener('change', (e) => { eventoDraft.tipo = e.target.value; drawTipo(sedute, portieri); });

    drawTipo(sedute, portieri);
  }

  function drawTipo(sedute, portieri) {
    const slot = target.querySelector('#gk-evento-tipo-slot');
    if (eventoDraft.tipo === 'allenamento') {
      const portieriSquadra = portieri.filter((p) => !p.squadraId || p.squadraId === eventoDraft.squadraId);
      slot.innerHTML = `
        <div class="gk-card">
          <div class="gk-label">Seduta collegata</div>
          <select class="gk-input" id="fe-seduta">
            <option value="">— nessuna, da assegnare dopo —</option>
            ${sedute.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || '', 'it')).map((s) => `<option value="${s.id}" ${eventoDraft.sedutaId === s.id ? 'selected' : ''}>${idPrefix(s.numero)}${escapeHtml(s.titolo)}</option>`).join('')}
          </select>
          <div id="gk-seduta-riepilogo"></div>
        </div>
        <div class="gk-card" id="gk-presenze-slot"></div>
      `;
      slot.querySelector('#fe-seduta').addEventListener('change', (e) => {
        eventoDraft.sedutaId = e.target.value;
        drawRiepilogo(sedute);
      });
      drawRiepilogo(sedute);
      renderConvocatiPresenti(slot.querySelector('#gk-presenze-slot'), eventoDraft, portieriSquadra, () => {});
    } else {
      const p = eventoDraft.partita;
      slot.innerHTML = `
        <div class="gk-card">
          <div class="gk-field"><label>Avversario</label><input class="gk-input" id="fe-avversario" value="${escapeHtml(p.avversario)}" /></div>
          <div class="gk-field"><label>Casa / Trasferta</label>
            <select class="gk-input" id="fe-casatrasferta">
              <option value="casa" ${p.casaTrasferta === 'casa' ? 'selected' : ''}>Casa</option>
              <option value="trasferta" ${p.casaTrasferta === 'trasferta' ? 'selected' : ''}>Trasferta</option>
            </select>
          </div>
          <div class="gk-field"><label>Risultato (noi — loro)</label>
            <div style="display:flex;gap:8px">
              <input class="gk-input" id="fe-ris-noi" style="width:70px" value="${escapeHtml(p.risultatoNoi)}" />
              <input class="gk-input" id="fe-ris-loro" style="width:70px" value="${escapeHtml(p.risultatoAvversario)}" />
            </div>
          </div>
        </div>
      `;
      slot.querySelector('#fe-avversario').addEventListener('input', (e) => { eventoDraft.partita.avversario = e.target.value; });
      slot.querySelector('#fe-casatrasferta').addEventListener('change', (e) => { eventoDraft.partita.casaTrasferta = e.target.value; });
      slot.querySelector('#fe-ris-noi').addEventListener('input', (e) => { eventoDraft.partita.risultatoNoi = e.target.value; });
      slot.querySelector('#fe-ris-loro').addEventListener('input', (e) => { eventoDraft.partita.risultatoAvversario = e.target.value; });
    }
  }

  async function drawRiepilogo(sedute) {
    const slot = target.querySelector('#gk-seduta-riepilogo');
    if (!slot) return;
    if (!eventoDraft.sedutaId) { slot.innerHTML = ''; return; }
    const seduta = sedute.find((s) => s.id === eventoDraft.sedutaId);
    if (!seduta) { slot.innerHTML = ''; return; }
    const { materiali, numPortieri, dettaglioBlocchi } = await aggregatoSeduta(seduta);
    const materialiList = (await storage.get('customLists', 'materiali'))?.items || [];
    const labelMat = (key) => materialiList.find((m) => m.key === key)?.label || key;

    slot.innerHTML = `
      <div class="gk-riepilogo">
        <div class="gk-riepilogo-riga"><b>${dettaglioBlocchi.length}</b> bloc${dettaglioBlocchi.length === 1 ? 'co' : 'chi'} ·
          <b>${dettaglioBlocchi.reduce((n, b) => n + b.voci.length, 0)}</b> eserciz${dettaglioBlocchi.reduce((n, b) => n + b.voci.length, 0) === 1 ? 'io' : 'i'} ·
          almeno <b>${numPortieri}</b> portier${numPortieri === 1 ? 'e' : 'i'}</div>
        ${dettaglioBlocchi.map((b) => `
          <div class="gk-riepilogo-blocco">
            <div class="gk-riepilogo-blocco-titolo">${escapeHtml(b.titolo || '(blocco senza titolo)')}</div>
            ${b.voci.map((v) => `
              <div class="gk-riepilogo-esercizio">
                ${escapeHtml(v.titolo)} ${v.variante ? '<span class="gk-badge">variante</span>' : ''}
                <div class="gk-riepilogo-steps">${v.steps.map((s) => stepSummary(s)).join(' → ')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        ${Object.keys(materiali).length > 0 ? `
          <div class="gk-riepilogo-riga" style="margin-top:6px"><b>Materiali:</b> ${
            Object.entries(materiali).map(([k, q]) => `${escapeHtml(labelMat(k))} ×${q}`).join(', ')
          }</div>` : ''}
      </div>
    `;
  }

  target.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ev-action]');
    if (!btn) return;
    if (btn.dataset.evAction === 'back') { onCancel && onCancel(); }
    else if (btn.dataset.evAction === 'delete') {
      if (!window.confirm('Eliminare questo evento?')) return;
      await storage.remove('eventi', eventoDraft.id);
      onDeleted ? onDeleted() : (onSaved && onSaved(eventoDraft));
    }
    else if (btn.dataset.evAction === 'save') {
      eventoDraft.updatedAt = storage.now();
      eventoDraft.createdAt = eventoDraft.createdAt || storage.now();
      eventoDraft.id = eventoDraft.id || storage.uid();
      await storage.put('eventi', eventoDraft);
      onSaved && onSaved(eventoDraft);
    }
  });
}
