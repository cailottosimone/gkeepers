// esercizi.js
// Esercizio = titolo + sequenza di step (label, note?, ruolo?, termRef?) +
// materiali (con quantità) + tag (manuali) + schema (link, SVG/immagine da
// costruire in seguito). Nessun parametro di serie/tempistiche.

import * as storage from './storage.js';
import { escapeHtml, debounce, resizeImageFile, stepSummary } from './dom-utils.js';
import { mountStepEditor, mountMaterialiEditor, mountTagEditor } from './editors.js';
import { openModal, closeModal, isDesktop } from './modal.js';

export async function listEsercizi() {
  const items = await storage.getAll('esercizi');
  return items.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || '', 'it'));
}

export function emptyEsercizio() {
  return { id: null, numero: null, titolo: '', note: '', steps: [], materiali: [], tag: [], schemaLink: '', schemaImage: '' };
}

export async function salvaEsercizio(draft) {
  const record = {
    id: draft.id || storage.uid(),
    numero: draft.numero || await storage.generateCode('esercizi', 'ES'),
    titolo: draft.titolo.trim(),
    note: draft.note || '',
    steps: draft.steps,
    materiali: draft.materiali,
    tag: draft.tag,
    schemaLink: draft.schemaLink || '',
    schemaImage: draft.schemaImage || '',
    createdAt: draft.createdAt || storage.now(),
    updatedAt: storage.now(),
  };
  await storage.put('esercizi', record);
  return record;
}

export async function eliminaEsercizio(id) {
  await storage.remove('esercizi', id);
}

export function render(container) {
  let draft = emptyEsercizio();
  let openSection = null;
  let searchTerm = '';
  let listi = null;
  let formTarget = null; // container (mobile) o corpo del modale (desktop)
  let usingModal = false;

  async function loadListi() {
    listi = {
      materiali: (await storage.get('customLists', 'materiali'))?.items || [],
      gesti: (await storage.get('customLists', 'gesti'))?.items || [],
      qualita: (await storage.get('customLists', 'qualita'))?.items || [],
    };
  }

  async function drawList() {
    const all = await listEsercizi();
    const filtered = searchTerm
      ? all.filter((e) => e.titolo.toLowerCase().includes(searchTerm.toLowerCase())
          || String(e.numero).toLowerCase().includes(searchTerm.toLowerCase().replace('#', ''))
          || (e.steps || []).some((s) => s.label.toLowerCase().includes(searchTerm.toLowerCase())))
      : all;

    container.innerHTML = `
      <div class="gk-section-head">
        <h2>Esercizi</h2>
        <button class="gk-btn primary" data-action="new"><i class="fa-solid fa-plus"></i>Nuovo esercizio</button>
      </div>
      <input class="gk-input" id="gk-search" placeholder="Cerca per # codice, titolo o step..." value="${escapeHtml(searchTerm)}" />
      ${filtered.length === 0 ? `<div class="gk-empty" style="margin-top:12px">Nessun esercizio trovato.</div>` : `
        <div class="gk-rows" style="margin-top:12px">
          ${filtered.map((e) => `
            <div class="gk-row gk-clickable" data-action="view" data-id="${e.id}">
              ${e.schemaImage ? `<img class="gk-thumb" src="${e.schemaImage}" alt="" />` : ''}
              <span class="gk-row-title">${escapeHtml(e.titolo)}</span>
              <span class="gk-row-id">#${escapeHtml(e.numero || '')}</span>
              <div class="gk-row-actions">
                <button class="gk-icon-btn" data-action="edit" data-id="${e.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
                <button class="gk-icon-btn" data-action="duplicate" data-id="${e.id}" title="Usa come punto di partenza"><i class="fa-solid fa-copy"></i></button>
                <button class="gk-icon-btn danger" data-action="delete" data-id="${e.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
    const search = document.getElementById('gk-search');
    search.addEventListener('input', debounce((e) => { searchTerm = e.target.value; drawList(); }, 250));
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }

  // ---------- vista sola lettura ----------
  async function viewEsercizio(es) {
    const [materialiList, gesti, qualita] = await Promise.all([
      storage.get('customLists', 'materiali'),
      storage.get('customLists', 'gesti'),
      storage.get('customLists', 'qualita'),
    ]);
    const labelMat = (key) => materialiList?.items?.find((m) => m.key === key)?.label || key;
    const labelTag = (key) => (gesti?.items || []).concat(qualita?.items || []).find((t) => t.key === key)?.label || key;

    const html = `
      <div class="gk-section-head"><h2>${escapeHtml(es.titolo)}</h2></div>
      ${es.schemaImage ? `<div class="gk-card"><img src="${es.schemaImage}" alt="" style="width:100%;border-radius:10px" /></div>` : ''}
      ${es.note ? `<div class="gk-card"><div class="gk-label"><i class="fa-solid fa-note-sticky"></i>Note</div>${escapeHtml(es.note)}</div>` : ''}
      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-list-ol"></i>Sequenza</div>
        <div class="gk-riepilogo-steps">${(es.steps || []).map((s) => stepSummary(s)).join(' → ')}</div>
      </div>
      ${es.materiali?.length ? `
        <div class="gk-card">
          <div class="gk-label"><i class="fa-solid fa-box"></i>Materiali</div>
          ${es.materiali.map((m) => `${escapeHtml(labelMat(m.key))} ×${m.qty}`).join(', ')}
        </div>` : ''}
      ${es.tag?.length ? `
        <div class="gk-card">
          <div class="gk-label"><i class="fa-solid fa-tags"></i>Tag</div>
          ${es.tag.map((t) => escapeHtml(labelTag(t))).join(', ')}
        </div>` : ''}
      ${es.schemaLink ? `
        <div class="gk-card">
          <div class="gk-label"><i class="fa-solid fa-link"></i>Link</div>
          <a href="${escapeHtml(es.schemaLink)}" target="_blank" rel="noopener">${escapeHtml(es.schemaLink)}</a>
        </div>` : ''}
    `;
    if (isDesktop()) {
      openModal((target) => { target.innerHTML = html; }, { size: 'lg', label: 'Dettaglio esercizio' });
    } else {
      container.innerHTML = `<button class="gk-btn" data-action="back-view" style="margin-bottom:12px"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` + html;
    }
  }

  function startEdit(esOrNull) {
    draft = esOrNull ? structuredCloneSafe(esOrNull) : emptyEsercizio();
    openSection = null;
    if (isDesktop()) {
      usingModal = true;
      const { container: modalBody } = openModal(
        (target) => { formTarget = target; target.addEventListener('click', onFormClick); drawForm(); },
        { size: 'lg', label: draft.id ? 'Modifica esercizio' : 'Nuovo esercizio' }
      );
    } else {
      usingModal = false;
      formTarget = container;
      drawForm();
    }
  }

  function closeEditor() {
    formTarget = null;
    if (usingModal) closeModal();
    drawList();
  }

  async function drawForm() {
    await loadListi();
    formTarget.innerHTML = `
      <div class="gk-section-head">
        <h2>${draft.id ? 'Modifica esercizio' : 'Nuovo esercizio'}</h2>
        ${!usingModal ? `<button class="gk-btn" data-action="back"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` : ''}
      </div>

      <div class="gk-card">
        <div class="gk-label">Titolo</div>
        <input class="gk-input gk-title-input" id="f-titolo" placeholder="Es. Circuito presa e tuffi" value="${escapeHtml(draft.titolo)}" />
        <div class="gk-label" style="margin-top:12px">Note</div>
        <textarea class="gk-input" id="f-esercizio-note" rows="2" placeholder="Note generali sull'esercizio (opzionale)">${escapeHtml(draft.note)}</textarea>
      </div>

      <div class="gk-card">
        <div class="gk-label">Sequenza — uno step per riga</div>
        <div id="gk-step-editor"></div>
      </div>

      ${accordionHtml('materiali', 'Materiali', 'fa-box', draft.materiali.length)}
      ${accordionHtml('tag', 'Tag (gesti / qualità)', 'fa-tags', draft.tag.length)}
      ${accordionHtml('schema', 'Schema spaziale', 'fa-diagram-project', null)}

      <div class="gk-save-row">
        <button class="gk-btn primary" id="f-save" data-action="save" ${(!draft.titolo.trim() || draft.steps.length === 0) ? 'disabled' : ''}>
          <i class="fa-solid fa-floppy-disk"></i>${draft.id ? 'Aggiorna esercizio' : 'Salva esercizio'}
        </button>
      </div>
    `;

    formTarget.querySelector('#f-titolo').addEventListener('input', (e) => {
      draft.titolo = e.target.value;
      refreshSaveState();
    });
    formTarget.querySelector('#f-esercizio-note').addEventListener('input', (e) => {
      draft.note = e.target.value;
    });

    mountStepEditor(formTarget.querySelector('#gk-step-editor'), {
      steps: draft.steps,
      onChange: () => refreshSaveState(),
    });

    if (openSection) drawAccordionBody(openSection);
  }

  function refreshSaveState() {
    const btn = formTarget.querySelector('#f-save');
    if (btn) btn.disabled = !draft.titolo.trim() || draft.steps.length === 0;
  }

  function accordionHtml(key, label, icon, badge) {
    return `
      <div class="gk-card">
        <div class="gk-section-toggle" data-action="toggle-section" data-section="${key}">
          <div class="gk-label"><i class="fa-solid ${icon}"></i>${label} ${badge ? `<span class="gk-badge">${badge}</span>` : ''}</div>
          <i class="fa-solid fa-chevron-down gk-chevron ${openSection === key ? 'open' : ''}"></i>
        </div>
        <div id="gk-section-${key}"></div>
      </div>
    `;
  }

  function drawAccordionBody(key) {
    const slot = formTarget.querySelector(`#gk-section-${key}`);
    if (!slot) return;
    if (openSection !== key) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div class="gk-section-body"></div>`;
    const body = slot.querySelector('.gk-section-body');

    if (key === 'materiali') {
      mountMaterialiEditor(body, {
        materiali: draft.materiali,
        materialiList: listi.materiali,
        onChange: () => refreshBadge('materiali'),
      });
    } else if (key === 'tag') {
      mountTagEditor(body, {
        tag: draft.tag,
        tagGroups: [{ label: 'Gesti', options: listi.gesti }, { label: 'Qualità', options: listi.qualita }],
        onChange: () => refreshBadge('tag'),
      });
    } else if (key === 'schema') {
      body.innerHTML = `
        <div class="gk-schema-hint">Facoltativo. Immagine e link disponibili; l'editor SVG
        resta da costruire in una fase successiva.</div>
        <div class="gk-mini-label">Link (video, riferimento esterno...)</div>
        <input class="gk-input" id="f-schema-link" placeholder="https://..." value="${escapeHtml(draft.schemaLink)}" />
        <div class="gk-mini-label" style="margin-top:8px">Immagine</div>
        ${draft.schemaImage ? `
          <div class="gk-image-preview">
            <img src="${draft.schemaImage}" alt="" />
            <button class="gk-icon-btn danger" data-action="remove-image" title="Rimuovi immagine"><i class="fa-solid fa-trash"></i></button>
          </div>` : `
          <label class="gk-btn" style="cursor:pointer;display:inline-flex">
            <i class="fa-solid fa-image"></i> Carica immagine
            <input type="file" accept="image/*" id="f-schema-file" style="display:none" />
          </label>`}
        <button class="gk-schema-btn" disabled><i class="fa-solid fa-pen-ruler"></i> Editor SVG — non incluso in questa stesura</button>
      `;
      body.querySelector('#f-schema-link').addEventListener('input', (e) => { draft.schemaLink = e.target.value; });
      const fileInput = body.querySelector('#f-schema-file');
      if (fileInput) fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        draft.schemaImage = await resizeImageFile(file);
        drawAccordionBody('schema');
      });
      const removeBtn = body.querySelector('[data-action="remove-image"]');
      if (removeBtn) removeBtn.addEventListener('click', () => {
        draft.schemaImage = '';
        drawAccordionBody('schema');
      });
    }
  }

  function refreshBadge(section) {
    const slot = formTarget.querySelector(`[data-section="${section}"] .gk-label`);
    if (!slot) return;
    const count = section === 'materiali' ? draft.materiali.length : draft.tag.length;
    let badge = slot.querySelector('.gk-badge');
    if (count > 0 && !badge) {
      badge = document.createElement('span'); badge.className = 'gk-badge'; slot.appendChild(badge);
    }
    if (badge) { if (count > 0) badge.textContent = count; else badge.remove(); }
  }

  // Azioni del form (back/save/toggle-section): gestite qui, richiamate sia
  // dal listener sul container (mobile, form dentro il container) sia da
  // quello montato sul corpo del modale (desktop) — mai su document, per
  // non accumulare listener a ogni cambio sezione.
  async function onFormClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'back') { closeEditor(); }
    else if (action === 'save') {
      await salvaEsercizio(draft);
      draft = emptyEsercizio();
      openSection = null;
      closeEditor();
    }
    else if (action === 'toggle-section') {
      const section = btn.dataset.section;
      openSection = openSection === section ? null : section;
      ['materiali', 'tag', 'schema'].forEach(drawAccordionBody);
      formTarget.querySelectorAll('.gk-chevron').forEach((c) => c.classList.remove('open'));
      if (openSection) btn.querySelector('.gk-chevron')?.classList.add('open');
    }
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'new') { startEdit(null); }
    else if (action === 'view') { await viewEsercizio(await storage.get('esercizi', btn.dataset.id)); }
    else if (action === 'edit') { startEdit(await storage.get('esercizi', btn.dataset.id)); }
    else if (action === 'duplicate') {
      const orig = await storage.get('esercizi', btn.dataset.id);
      const copy = structuredCloneSafe(orig);
      copy.id = null;
      copy.numero = null;
      copy.titolo = orig.titolo + ' (copia)';
      startEdit(copy);
    }
    else if (action === 'delete') {
      if (!window.confirm('Eliminare questo esercizio?')) return;
      await eliminaEsercizio(btn.dataset.id);
      drawList();
    }
    else if (action === 'back-view') { drawList(); }
    else if (!usingModal) { await onFormClick(e); }
  });

  drawList();
}

export function structuredCloneSafe(obj) {
  return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}
