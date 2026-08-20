// portieri.js
import * as storage from './storage.js';
import { escapeHtml } from './dom-utils.js';
import { storicoPortiere } from './presenze.js';
import { openModal, closeModal, isDesktop } from './modal.js';

export const STATI = [
  { key: 'in_salute', label: 'In salute', icon: 'fa-heart-pulse', cls: 'ok' },
  { key: 'infortunato', label: 'Infortunato', icon: 'fa-user-injured', cls: 'danger' },
  { key: 'in_recupero', label: 'In recupero', icon: 'fa-arrow-rotate-left', cls: 'warn' },
];

export async function listPortieri() {
  const items = await storage.getAll('portieri');
  return items.sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '', 'it'));
}

export async function salvaPortiere(data) {
  const record = {
    id: data.id || storage.uid(),
    nome: (data.nome || '').trim(),
    cognome: (data.cognome || '').trim(),
    dataNascita: data.dataNascita || '',
    stato: data.stato || 'in_salute',
    squadraId: data.squadraId || '',
    categoriaKey: data.categoriaKey || '',
    note: data.note || '',
    createdAt: data.createdAt || storage.now(),
    updatedAt: storage.now(),
  };
  await storage.put('portieri', record);
  return record;
}

export async function eliminaPortiere(id) {
  await storage.remove('portieri', id);
}

function statoInfo(stato) {
  return STATI.find((s) => s.key === stato) || STATI[0];
}

// Versione compatta per la riga in elenco: solo icona colorata, niente
// testo — non deve mai contendere spazio al nome. Il testo per esteso
// resta nella scheda aperta (vista e form di modifica). Forma coerente
// con i tasti icona dell'app (stesso raggio), non un cerchio a sé.
function statoDot(stato) {
  const info = statoInfo(stato);
  return `<span class="gk-stato-dot ${info.cls}" title="${escapeHtml(info.label)}"><i class="fa-solid ${info.icon}"></i></span>`;
}

export function render(container) {
  let squadre = [];
  let categorie = [];
  let formTarget = null;
  let usingModal = false;
  let editingId = null;

  function formHtml(p = {}) {
    return `
      <div class="gk-section-head">
        <h2>${p.id ? 'Modifica portiere' : 'Nuovo portiere'}</h2>
        ${!usingModal ? `<button class="gk-btn" data-action="cancel"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` : ''}
      </div>
      <div class="gk-card">
        <div class="gk-field"><label>Nome</label><input class="gk-input" id="f-nome" value="${escapeHtml(p.nome || '')}" /></div>
        <div class="gk-field"><label>Cognome</label><input class="gk-input" id="f-cognome" value="${escapeHtml(p.cognome || '')}" /></div>
        <div class="gk-field"><label>Data di nascita</label><input class="gk-input" type="date" id="f-data" value="${p.dataNascita || ''}" /></div>
        <div class="gk-field"><label>Squadra</label>
          <select class="gk-input" id="f-squadra">
            <option value="">— nessuna —</option>
            ${squadre.map((s) => `<option value="${s.id}" ${p.squadraId === s.id ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="gk-field"><label>Categoria</label>
          <select class="gk-input" id="f-categoria">
            <option value="">— nessuna —</option>
            ${categorie.map((c) => `<option value="${c.key}" ${p.categoriaKey === c.key ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </div>
        <div class="gk-field"><label>Stato</label>
          <div class="gk-opt-list">
            ${STATI.map((s) => `
              <label class="gk-opt-row ${((p.stato || 'in_salute') === s.key) ? 'active' : ''}">
                <input type="radio" name="f-stato-radio" value="${s.key}" ${((p.stato || 'in_salute') === s.key) ? 'checked' : ''} />
                <i class="fa-solid ${s.icon}"></i>
                <span class="gk-opt-label">${escapeHtml(s.label)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="gk-field"><label>Note</label><textarea class="gk-input" id="f-note" rows="2">${escapeHtml(p.note || '')}</textarea></div>
        <div class="gk-form-actions">
          <button class="gk-btn" data-action="cancel">Annulla</button>
          <button class="gk-btn primary" data-action="save"><i class="fa-solid fa-floppy-disk"></i>Salva</button>
        </div>
      </div>
    `;
  }

  function wireForm() {
    formTarget.querySelectorAll('input[name="f-stato-radio"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        formTarget.querySelectorAll('.gk-opt-row').forEach((row) => row.classList.remove('active'));
        radio.closest('.gk-opt-row').classList.add('active');
      });
    });
  }

  function startEdit(pOrNull) {
    editingId = pOrNull ? pOrNull.id : 'new';
    if (isDesktop()) {
      usingModal = true;
      openModal((target) => {
        formTarget = target;
        target.addEventListener('click', onFormClick);
        target.innerHTML = formHtml(pOrNull || {});
        wireForm();
      }, { size: 'md', label: pOrNull ? 'Modifica portiere' : 'Nuovo portiere' });
    } else {
      usingModal = false;
      formTarget = document.getElementById('gk-portiere-form-slot');
      formTarget.innerHTML = formHtml(pOrNull || {});
      wireForm();
    }
  }

  function closeEditor() {
    formTarget = null;
    if (usingModal) closeModal();
    else document.getElementById('gk-portiere-form-slot').innerHTML = '';
  }

  // Vista in sola lettura: info anagrafiche + storico qualità insieme,
  // un solo posto invece di un tasto "storico" separato da quello di
  // apertura — click sulla riga, fuori dai tasti azione, apre sempre
  // questa vista (stessa logica già in uso per Sedute ed Esercizi).
  async function viewPortiere(p) {
    const squadraNome = squadre.find((s) => s.id === p.squadraId)?.nome;
    const categoriaLabel = categorie.find((c) => c.key === p.categoriaKey)?.label;
    const info = statoInfo(p.stato);
    const [{ numEventi, conteggi }, gesti, qualita] = await Promise.all([
      storicoPortiere(p.id),
      storage.get('customLists', 'gesti'),
      storage.get('customLists', 'qualita'),
    ]);
    const labelOf = (key) =>
      (gesti?.items || []).concat(qualita?.items || []).find((i) => i.key === key)?.label || key;
    const voci = Object.entries(conteggi).sort((a, b) => b[1] - a[1]);

    const html = `
      <div class="gk-section-head"><h2>${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</h2></div>
      <div class="gk-card">
        <div class="gk-riepilogo-riga"><b>Squadra:</b> ${escapeHtml(squadraNome || 'Nessuna squadra')}</div>
        <div class="gk-riepilogo-riga"><b>Categoria:</b> ${escapeHtml(categoriaLabel || 'Nessuna categoria')}</div>
        <div class="gk-riepilogo-riga" style="margin-top:8px"><span class="gk-stato-badge ${info.cls}"><i class="fa-solid ${info.icon}"></i> ${escapeHtml(info.label)}</span></div>
        ${p.dataNascita ? `<div class="gk-riepilogo-riga" style="margin-top:8px"><b>Nato il:</b> ${escapeHtml(p.dataNascita)}</div>` : ''}
        ${p.note ? `<div class="gk-riepilogo-riga" style="margin-top:8px"><b>Note:</b> ${escapeHtml(p.note)}</div>` : ''}
      </div>
      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-clock-rotate-left"></i>Storico qualità allenate</div>
        <div class="gk-hint" style="margin-bottom:8px">Calcolato dagli eventi svolti in cui il portiere risulta presente (${numEventi} event${numEventi === 1 ? 'o' : 'i'}). Se lo stesso esercizio compare più volte nella stessa seduta (originale + varianti), conta una sola volta.</div>
        ${voci.length === 0 ? '<div class="gk-hint">Ancora nessun dato: mancano eventi svolti con appello.</div>' : `
          <table class="gk-table">
            <tr><th>Gesto/qualità</th><th>Volte allenata</th></tr>
            ${voci.map(([key, n]) => `<tr><td>${escapeHtml(labelOf(key))}</td><td>${n}</td></tr>`).join('')}
          </table>`}
      </div>
    `;
    if (isDesktop()) {
      openModal((target) => { target.innerHTML = html; }, { size: 'md', label: 'Dettaglio portiere' });
    } else {
      container.innerHTML = `<button class="gk-btn" data-action="back-view" style="margin-bottom:12px"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` + html;
    }
  }

  async function draw() {
    squadre = await storage.getAll('squadre');
    categorie = (await storage.get('customLists', 'categorie'))?.items || [];
    const portieri = await listPortieri();
    const squadraNome = (id) => squadre.find((s) => s.id === id)?.nome;
    const categoriaLabel = (key) => categorie.find((c) => c.key === key)?.label;
    container.innerHTML = `
      <div class="gk-section-head">
        <h2>Portieri</h2>
        <button class="gk-btn primary" data-action="new"><i class="fa-solid fa-plus"></i>Nuovo</button>
      </div>
      <div id="gk-portiere-form-slot"></div>
      ${portieri.length === 0 ? `<div class="gk-empty">Nessun portiere in rosa.</div>` : `
        <div class="gk-rows">
          ${portieri.map((p) => {
            const squadraTesto = squadraNome(p.squadraId) || 'Nessuna squadra';
            const categoriaTesto = categoriaLabel(p.categoriaKey) || 'Nessuna categoria';
            return `
            <div class="gk-row gk-clickable" data-action="view" data-id="${p.id}">
              <span class="gk-row-title">${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</span>
              <span class="gk-row-sub">${escapeHtml(squadraTesto)} - ${escapeHtml(categoriaTesto)}</span>
              ${statoDot(p.stato)}
              <div class="gk-row-actions">
                <button class="gk-icon-btn" data-action="edit" data-id="${p.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
                <button class="gk-icon-btn danger" data-action="delete" data-id="${p.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `; }).join('')}
        </div>
      `}
    `;
  }

  async function onFormClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'cancel') { closeEditor(); }
    else if (action === 'save') {
      const nome = formTarget.querySelector('#f-nome').value.trim();
      if (!nome) return;
      const statoRadio = formTarget.querySelector('input[name="f-stato-radio"]:checked');
      await salvaPortiere({
        id: editingId === 'new' ? null : editingId,
        nome,
        cognome: formTarget.querySelector('#f-cognome').value,
        dataNascita: formTarget.querySelector('#f-data').value,
        squadraId: formTarget.querySelector('#f-squadra').value,
        categoriaKey: formTarget.querySelector('#f-categoria').value,
        stato: statoRadio ? statoRadio.value : 'in_salute',
        note: formTarget.querySelector('#f-note').value,
      });
      editingId = null;
      closeEditor();
      await draw();
    }
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'new') { startEdit(null); }
    else if (action === 'view') { await viewPortiere(await storage.get('portieri', btn.dataset.id)); }
    else if (action === 'edit') { startEdit(await storage.get('portieri', btn.dataset.id)); }
    else if (action === 'back-view') { draw(); }
    else if (action === 'delete') {
      if (!window.confirm('Eliminare questo portiere dalla rosa?')) return;
      await eliminaPortiere(btn.dataset.id);
      await draw();
    } else if (!usingModal) { await onFormClick(e); }
  });

  draw();
}
