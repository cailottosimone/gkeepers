// sedute.js
// Seduta = titolo + blocchi liberi (titolo, note, voci). Ogni voce
// referenzia un Esercizio del catalogo e può avere una personalizzazione
// COMPLETA valida solo per questa seduta (step/materiali/tag propri,
// costruiti a partire da una copia dell'esercizio originale, che non viene
// mai toccato). La Seduta è riutilizzabile, indipendente da data/squadra:
// le presenze vivono sull'Evento, non qui.

import * as storage from './storage.js';
import { escapeHtml, fmtDate } from './dom-utils.js';
import { mountStepEditor, mountMaterialiEditor, mountTagEditor } from './editors.js';
import { structuredCloneSafe } from './esercizi.js';
import { openModal, closeModal, isDesktop } from './modal.js';

export async function listSedute() {
  const items = await storage.getAll('sedute');
  return items.sort((a, b) => (a.titolo || '').localeCompare(b.titolo || '', 'it'));
}

function emptySeduta() {
  return { id: null, titolo: '', note: '', blocchi: [] };
}

async function salvaSeduta(draft) {
  const record = {
    id: draft.id || storage.uid(),
    titolo: draft.titolo.trim(),
    note: draft.note || '',
    blocchi: draft.blocchi,
    createdAt: draft.createdAt || storage.now(),
    updatedAt: storage.now(),
  };
  await storage.put('sedute', record);
  return record;
}

export async function eliminaSeduta(id) {
  await storage.remove('sedute', id);
}

// Esercizio "effettivo" per una voce: la personalizzazione locale se
// presente, altrimenti l'esercizio del catalogo così com'è.
export function esercizioEffettivo(esercizio, voce) {
  if (!voce.override) return esercizio;
  return {
    ...esercizio,
    steps: voce.override.steps,
    materiali: voce.override.materiali,
    tag: voce.override.tag,
  };
}

// Aggregazione automatica: materiali (unione, tenendo conto delle
// personalizzazioni) e portieri implicati (dai ruoli usati negli esercizi).
export async function aggregatoSeduta(seduta) {
  const esercizi = await storage.getAll('esercizi');
  const byId = Object.fromEntries(esercizi.map((e) => [e.id, e]));
  const materiali = {};
  let numPortieri = 1;
  const dettaglioBlocchi = [];
  for (const b of seduta.blocchi) {
    const voci = [];
    for (const v of b.voci) {
      const es = byId[v.esercizioId];
      if (!es) continue;
      const eff = esercizioEffettivo(es, v);
      for (const m of eff.materiali || []) {
        materiali[m.key] = (materiali[m.key] || 0) + (m.qty || 1);
      }
      const ruoli = new Set((eff.steps || []).map((s) => s.ruolo).filter(Boolean));
      if (ruoli.size > numPortieri) numPortieri = ruoli.size;
      voci.push({ titolo: es.titolo, steps: eff.steps, personalizzata: !!v.override });
    }
    dettaglioBlocchi.push({ titolo: b.titolo, note: b.note, voci });
  }
  return { materiali, numPortieri, dettaglioBlocchi };
}

// Quante volte / dove è usata una seduta — eventi collegati, distinti tra
// svolti e pianificati, con stagione e squadra per contesto.
export async function usiSeduta(sedutaId) {
  const [eventi, stagioni, squadre] = await Promise.all([
    storage.getAll('eventi'), storage.getAll('stagioni'), storage.getAll('squadre'),
  ]);
  const stagioniById = Object.fromEntries(stagioni.map((s) => [s.id, s]));
  const squadreById = Object.fromEntries(squadre.map((s) => [s.id, s]));
  const collegati = eventi
    .filter((e) => e.sedutaId === sedutaId)
    .map((e) => ({
      ...e,
      stagioneNome: stagioniById[e.stagioneId]?.nome || '—',
      squadraNome: squadreById[e.squadraId]?.nome || '—',
    }))
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  return {
    totale: collegati.length,
    svolti: collegati.filter((e) => e.svolto).length,
    pianificati: collegati.filter((e) => !e.svolto).length,
    eventi: collegati,
  };
}

export function render(container) {
  let draft = emptySeduta();
  let expandedVoce = null; // "bi-vi"
  let listi = null;
  let formTarget = null;
  let usingModal = false;

  async function loadListi() {
    listi = {
      materiali: (await storage.get('customLists', 'materiali'))?.items || [],
      gesti: (await storage.get('customLists', 'gesti'))?.items || [],
      qualita: (await storage.get('customLists', 'qualita'))?.items || [],
    };
  }

  async function drawList() {
    const sedute = await listSedute();
    container.innerHTML = `
      <div class="gk-section-head">
        <h2>Sedute</h2>
        <button class="gk-btn primary" data-action="new"><i class="fa-solid fa-plus"></i>Nuova seduta</button>
      </div>
      <div class="gk-list gk-grid">
        ${sedute.length === 0 ? `<div class="gk-empty">Nessuna seduta creata.</div>` : ''}
        ${sedute.map((s) => `
          <div class="gk-list-item">
            <div>
              <div class="gk-list-title">${escapeHtml(s.titolo)}</div>
              <div class="gk-list-sub">${s.blocchi.length} blocch${s.blocchi.length === 1 ? 'o' : 'i'}, ${s.blocchi.reduce((n, b) => n + b.voci.length, 0)} esercizi</div>
            </div>
            <div class="gk-list-actions">
              <button class="gk-icon-btn" data-action="view" data-id="${s.id}" title="Apri (sola lettura)"><i class="fa-solid fa-eye"></i></button>
              <button class="gk-icon-btn" data-action="edit" data-id="${s.id}" title="Modifica"><i class="fa-solid fa-pen"></i></button>
              <button class="gk-icon-btn" data-action="duplicate" data-id="${s.id}" title="Usa come punto di partenza"><i class="fa-solid fa-copy"></i></button>
              <button class="gk-icon-btn danger" data-action="delete" data-id="${s.id}" title="Elimina"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ---------- vista sola lettura + quanto è usata ----------
  async function viewSeduta(seduta) {
    const [{ dettaglioBlocchi, materiali, numPortieri }, uso] = await Promise.all([
      aggregatoSeduta(seduta), usiSeduta(seduta.id),
    ]);
    const materialiList = (await storage.get('customLists', 'materiali'))?.items || [];
    const labelMat = (key) => materialiList.find((m) => m.key === key)?.label || key;

    const html = `
      <div class="gk-section-head"><h2>${escapeHtml(seduta.titolo)}</h2></div>
      ${seduta.note ? `<div class="gk-card"><div class="gk-label"><i class="fa-solid fa-note-sticky"></i>Note</div>${escapeHtml(seduta.note)}</div>` : ''}

      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-list-ol"></i>Contenuto</div>
        <div class="gk-riepilogo-riga"><b>${dettaglioBlocchi.length}</b> blocch${dettaglioBlocchi.length === 1 ? 'o' : 'i'} ·
          <b>${dettaglioBlocchi.reduce((n, b) => n + b.voci.length, 0)}</b> esercizi ·
          almeno <b>${numPortieri}</b> portier${numPortieri === 1 ? 'e' : 'i'}</div>
        ${dettaglioBlocchi.map((b) => `
          <div class="gk-riepilogo-blocco">
            <div class="gk-riepilogo-blocco-titolo">${escapeHtml(b.titolo || '(blocco senza titolo)')}</div>
            ${b.voci.map((v) => `
              <div class="gk-riepilogo-esercizio">
                ${escapeHtml(v.titolo)} ${v.personalizzata ? '<span class="gk-badge">personalizzata</span>' : ''}
                <div class="gk-riepilogo-steps">${v.steps.map((s) => escapeHtml(s.label)).join(' → ')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        ${Object.keys(materiali).length > 0 ? `
          <div class="gk-riepilogo-riga" style="margin-top:6px"><b>Materiali:</b> ${
            Object.entries(materiali).map(([k, q]) => `${escapeHtml(labelMat(k))} ×${q}`).join(', ')
          }</div>` : ''}
      </div>

      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-chart-simple"></i>Quanto è usata</div>
        <div class="gk-riepilogo-riga"><b>${uso.totale}</b> event${uso.totale === 1 ? 'o' : 'i'} collegat${uso.totale === 1 ? 'o' : 'i'} —
          ${uso.svolti} svolt${uso.svolti === 1 ? 'o' : 'i'}, ${uso.pianificati} pianificat${uso.pianificati === 1 ? 'o' : 'i'}</div>
        ${uso.eventi.length === 0 ? '<div class="gk-hint">Non ancora collegata a nessun evento.</div>' : `
          <div class="gk-usi-list">
            ${uso.eventi.map((e) => `
              <div class="gk-usi-row">
                <span>${fmtDate(e.data)} · ${escapeHtml(e.squadraNome)} · ${escapeHtml(e.stagioneNome)}</span>
                <span class="gk-badge" style="${e.svolto ? '' : 'opacity:.6'}">${e.svolto ? 'svolto' : 'pianificato'}</span>
              </div>
            `).join('')}
          </div>`}
      </div>
    `;

    if (isDesktop()) {
      openModal((target) => { target.innerHTML = html; }, { size: 'lg', label: 'Dettaglio seduta' });
    } else {
      container.innerHTML = `<button class="gk-btn" data-action="back" style="margin-bottom:12px"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` + html;
    }
  }

  function startEdit(sOrNull) {
    draft = sOrNull ? structuredCloneSafe(sOrNull) : emptySeduta();
    expandedVoce = null;
    if (isDesktop()) {
      usingModal = true;
      openModal((target) => {
        formTarget = target; target.addEventListener('click', onFormClick);
        loadListi().then(drawForm);
      }, { size: 'lg', label: draft.id ? 'Modifica seduta' : 'Nuova seduta' });
    } else {
      usingModal = false;
      formTarget = container;
      loadListi().then(drawForm);
    }
  }

  function closeEditor() {
    formTarget = null;
    if (usingModal) closeModal();
    drawList();
  }

  async function drawForm() {
    const esercizi = await storage.getAll('esercizi');
    const byId = Object.fromEntries(esercizi.map((e) => [e.id, e]));

    formTarget.innerHTML = `
      <div class="gk-section-head">
        <h2>${draft.id ? 'Modifica seduta' : 'Nuova seduta'}</h2>
        ${!usingModal ? `<button class="gk-btn" data-action="back"><i class="fa-solid fa-arrow-left"></i>Elenco</button>` : ''}
      </div>
      <div class="gk-card">
        <div class="gk-label">Titolo</div>
        <input class="gk-input gk-title-input" id="f-titolo" value="${escapeHtml(draft.titolo)}" placeholder="Es. Seduta tipo — settimana pre-partita" />
        <div class="gk-label" style="margin-top:12px">Note</div>
        <textarea class="gk-input" id="f-note" rows="2">${escapeHtml(draft.note)}</textarea>
      </div>

      <div id="gk-blocchi"></div>
      <button class="gk-btn" data-action="add-blocco"><i class="fa-solid fa-plus"></i>Aggiungi blocco</button>

      <div class="gk-save-row">
        <button class="gk-btn primary" id="f-save" data-action="save-seduta" ${(!draft.titolo.trim() || draft.blocchi.length === 0) ? 'disabled' : ''}>
          <i class="fa-solid fa-floppy-disk"></i>${draft.id ? 'Aggiorna seduta' : 'Salva seduta'}
        </button>
      </div>
    `;

    formTarget.querySelector('#f-titolo').addEventListener('input', (e) => { draft.titolo = e.target.value; refreshSaveState(); });
    formTarget.querySelector('#f-note').addEventListener('input', (e) => { draft.note = e.target.value; });

    drawBlocchi(byId);
  }

  function refreshSaveState() {
    const btn = formTarget.querySelector('#f-save');
    if (btn) btn.disabled = !draft.titolo.trim() || draft.blocchi.length === 0;
  }

  function drawBlocchi(byId) {
    const cont = formTarget.querySelector('#gk-blocchi');
    if (!cont) return;
    cont.innerHTML = draft.blocchi.map((b, bi) => `
      <div class="gk-card">
        <div class="gk-field">
          <input class="gk-input" data-action="blocco-titolo" data-b="${bi}" placeholder="Titolo blocco (es. Riscaldamento)" value="${escapeHtml(b.titolo)}" />
        </div>
        <div class="gk-field">
          <textarea class="gk-input" data-action="blocco-note" data-b="${bi}" rows="1" placeholder="Note libere (opzionale)">${escapeHtml(b.note)}</textarea>
        </div>
        <div class="gk-voci">
          ${b.voci.map((v, vi) => {
            const es = byId[v.esercizioId];
            const key = `${bi}-${vi}`;
            return `
            <div class="gk-voce-wrap">
              <div class="gk-voce">
                <div class="gk-voce-title">${escapeHtml(es?.titolo || '(esercizio eliminato)')} ${v.override ? '<span class="gk-badge">personalizzata</span>' : ''}</div>
                <button class="gk-icon-btn" data-action="move-voce" data-b="${bi}" data-v="${vi}" data-dir="-1" ${vi === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="gk-icon-btn" data-action="move-voce" data-b="${bi}" data-v="${vi}" data-dir="1" ${vi === b.voci.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="gk-icon-btn" data-action="toggle-voce" data-b="${bi}" data-v="${vi}" title="Personalizza per questa seduta"><i class="fa-solid fa-sliders"></i></button>
                <button class="gk-icon-btn danger" data-action="remove-voce" data-b="${bi}" data-v="${vi}"><i class="fa-solid fa-trash"></i></button>
              </div>
              ${expandedVoce === key && es ? `<div class="gk-voce-adatta" id="gk-voce-panel-${key}"></div>` : ''}
            </div>
          `; }).join('')}
        </div>
        <div class="gk-picker-row">
          <select class="gk-input" data-action="picker-select" data-b="${bi}">
            <option value="">+ Aggiungi esercizio al blocco...</option>
            ${Object.values(byId).map((e) => `<option value="${e.id}">${escapeHtml(e.titolo)}</option>`).join('')}
          </select>
          <button class="gk-icon-btn danger" data-action="remove-blocco" data-b="${bi}" title="Rimuovi blocco"><i class="fa-solid fa-trash"></i> blocco</button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-action="blocco-titolo"]').forEach((inp) => {
      inp.addEventListener('input', (e) => { draft.blocchi[+e.target.dataset.b].titolo = e.target.value; });
    });
    cont.querySelectorAll('[data-action="blocco-note"]').forEach((inp) => {
      inp.addEventListener('input', (e) => { draft.blocchi[+e.target.dataset.b].note = e.target.value; });
    });
    cont.querySelectorAll('[data-action="picker-select"]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const bi = +e.target.dataset.b;
        if (!e.target.value) return;
        draft.blocchi[bi].voci.push({ id: storage.uid(), esercizioId: e.target.value, adattamentoNote: '', override: null });
        e.target.value = '';
        drawBlocchi(byId);
        refreshSaveState();
      });
    });

    if (expandedVoce) {
      const [bi, vi] = expandedVoce.split('-').map(Number);
      const v = draft.blocchi[bi]?.voci[vi];
      const es = v && byId[v.esercizioId];
      if (v && es) mountVocePanel(formTarget.querySelector(`#gk-voce-panel-${expandedVoce}`), es, v);
    }
  }

  function mountVocePanel(panel, es, v) {
    if (!panel) return;
    panel.innerHTML = `
      ${!v.override ? `
        <button class="gk-btn" data-action="start-override"><i class="fa-solid fa-sliders"></i>Personalizza questo esercizio solo per questa seduta</button>
      ` : `
        <div class="gk-hint" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>Le modifiche valgono solo per questa seduta — l'esercizio nel catalogo resta invariato.</span>
          <button class="gk-btn" data-action="reset-override"><i class="fa-solid fa-rotate-left"></i>Ripristina originale</button>
        </div>
        <div class="gk-mini-label" style="margin-top:10px">Sequenza</div>
        <div id="gk-voce-steps"></div>
        <div class="gk-mini-label" style="margin-top:10px">Materiali</div>
        <div id="gk-voce-materiali"></div>
        <div class="gk-mini-label" style="margin-top:10px">Tag</div>
        <div id="gk-voce-tag"></div>
      `}
      <div class="gk-mini-label" style="margin-top:10px">Nota di adattamento (libera)</div>
      <input class="gk-input" id="gk-voce-nota" placeholder="Es. condizione del portiere, motivo dell'adattamento..." value="${escapeHtml(v.adattamentoNote || '')}" />
    `;

    panel.querySelector('#gk-voce-nota').addEventListener('input', (e) => { v.adattamentoNote = e.target.value; });

    const startBtn = panel.querySelector('[data-action="start-override"]');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        v.override = {
          steps: structuredCloneSafe(es.steps || []),
          materiali: structuredCloneSafe(es.materiali || []),
          tag: [...(es.tag || [])],
        };
        rerenderVoceOnly();
      });
    }
    const resetBtn = panel.querySelector('[data-action="reset-override"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!window.confirm('Ripristinare la versione originale? Le personalizzazioni per questa seduta andranno perse.')) return;
        v.override = null;
        rerenderVoceOnly();
      });
    }

    if (v.override) {
      mountStepEditor(panel.querySelector('#gk-voce-steps'), { steps: v.override.steps, onChange: () => {} });
      mountMaterialiEditor(panel.querySelector('#gk-voce-materiali'), {
        materiali: v.override.materiali, materialiList: listi.materiali, onChange: () => {},
      });
      mountTagEditor(panel.querySelector('#gk-voce-tag'), {
        tag: v.override.tag,
        tagGroups: [{ label: 'Gesti', options: listi.gesti }, { label: 'Qualità', options: listi.qualita }],
        onChange: () => {},
      });
    }
  }

  function rerenderVoceOnly() {
    storage.getAll('esercizi').then((esercizi) => {
      const byId = Object.fromEntries(esercizi.map((e) => [e.id, e]));
      drawBlocchi(byId);
    });
  }

  async function onFormClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const esercizi = await storage.getAll('esercizi');
    const byId = Object.fromEntries(esercizi.map((x) => [x.id, x]));

    if (action === 'back') { closeEditor(); }
    else if (action === 'add-blocco') {
      draft.blocchi.push({ id: storage.uid(), titolo: '', note: '', voci: [] });
      drawBlocchi(byId);
      refreshSaveState();
    }
    else if (action === 'remove-blocco') {
      draft.blocchi.splice(+btn.dataset.b, 1);
      drawBlocchi(byId);
      refreshSaveState();
    }
    else if (action === 'remove-voce') {
      draft.blocchi[+btn.dataset.b].voci.splice(+btn.dataset.v, 1);
      drawBlocchi(byId);
    }
    else if (action === 'move-voce') {
      const bi2 = +btn.dataset.b, vi = +btn.dataset.v, dir = +btn.dataset.dir, target = vi + dir;
      const voci = draft.blocchi[bi2].voci;
      if (target < 0 || target >= voci.length) return;
      [voci[vi], voci[target]] = [voci[target], voci[vi]];
      if (expandedVoce === `${bi2}-${vi}`) expandedVoce = `${bi2}-${target}`;
      else if (expandedVoce === `${bi2}-${target}`) expandedVoce = `${bi2}-${vi}`;
      drawBlocchi(byId);
    }
    else if (action === 'toggle-voce') {
      const key = `${btn.dataset.b}-${btn.dataset.v}`;
      expandedVoce = expandedVoce === key ? null : key;
      drawBlocchi(byId);
    }
    else if (action === 'save-seduta') {
      await salvaSeduta(draft);
      draft = emptySeduta();
      expandedVoce = null;
      closeEditor();
    }
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'new') { startEdit(null); }
    else if (action === 'edit') { startEdit(await storage.get('sedute', btn.dataset.id)); }
    else if (action === 'view') { await viewSeduta(await storage.get('sedute', btn.dataset.id)); }
    else if (action === 'duplicate') {
      const orig = await storage.get('sedute', btn.dataset.id);
      const copy = structuredCloneSafe(orig);
      copy.id = null;
      copy.titolo = orig.titolo + ' (copia)';
      startEdit(copy);
    }
    else if (action === 'delete') {
      if (!window.confirm('Eliminare questa seduta?')) return;
      await eliminaSeduta(btn.dataset.id);
      drawList();
    }
    else if (action === 'back' && !isDesktop()) { drawList(); }
    else if (!usingModal) { await onFormClick(e); }
  });

  drawList();
}
