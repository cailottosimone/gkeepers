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

function statoBadge(stato) {
  const info = STATI.find((s) => s.key === stato) || STATI[0];
  return `<span class="gk-stato-badge ${info.cls}"><i class="fa-solid ${info.icon}"></i> ${escapeHtml(info.label)}</span>`;
}

// Versione compatta per la card in elenco: solo un pallino colorato con
// l'icona, senza testo — non deve mai contendere spazio al nome. Il testo
// completo resta nella scheda aperta (form di modifica, già con etichette
// per esteso).
function statoDot(stato) {
  const info = STATI.find((s) => s.key === stato) || STATI[0];
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

  async function storicoHtml(portiere) {
    const [{ numEventi, conteggi }, gesti, qualita] = await Promise.all([
      storicoPortiere(portiere.id),
      storage.get('customLists', 'gesti'),
      storage.get('customLists', 'qualita'),
    ]);
    const labelOf = (key) =>
      (gesti?.items || []).concat(qualita?.items || []).find((i) => i.key === key)?.label || key;
    const voci = Object.entries(conteggi).sort((a, b) => b[1] - a[1]);
    return `
      <div class="gk-section-head"><h2>${escapeHtml(portiere.cognome)} ${escapeHtml(portiere.nome)}</h2></div>
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
      <div class="gk-list gk-grid">
        ${portieri.length === 0 ? `<div class="gk-empty">Nessun portiere in rosa.</div>` : ''}
        ${portieri.map((p) => {
          const squadraTesto = squadraNome(p.squadraId) || 'Nessuna squadra';
          const categoriaTesto = categoriaLabel(p.categoriaKey) || 'Nessuna categoria';
          return `
          <div class="gk-list-item gk-portiere-card">
            <div class="gk-portiere-row">
              <span class="gk-portiere-name gk-truncate">${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</span>
              ${statoDot(p.stato)}
            </div>
            <div class="gk-portiere-row">
              <span class="gk-portiere-sub gk-truncate">${escapeHtml(squadraTesto)} - ${escapeHtml(categoriaTesto)}</span>
              <div class="gk-list-actions">
                <button class="gk-icon-btn" data-action="storico" data-id="${p.id}" title="Storico qualità"><i class="fa-solid fa-clock-rotate-left"></i></button>
                <button class="gk-icon-btn" data-action="edit" data-id="${p.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
                <button class="gk-icon-btn danger" data-action="delete" data-id="${p.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
        `; }).join('')}
      </div>
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
    else if (action === 'edit') { startEdit(await storage.get('portieri', btn.dataset.id)); }
    else if (action === 'storico') {
      const portiere = await storage.get('portieri', btn.dataset.id);
      openModal(async (target) => { target.innerHTML = await storicoHtml(portiere); }, { size: 'md', label: 'Storico qualità' });
    } else if (action === 'delete') {
      if (!window.confirm('Eliminare questo portiere dalla rosa?')) return;
      await eliminaPortiere(btn.dataset.id);
      await draw();
    } else if (!usingModal) { await onFormClick(e); }
  });

  draw();
}
