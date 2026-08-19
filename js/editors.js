// editors.js
// Editor riusabili, "montabili" dentro un qualunque contenitore: la
// sequenza di step (con dizionario/suggerimenti/alternative), i materiali
// con quantità (elenco, con select per aggiungere), i tag (elenco con
// checkbox). Usati sia da esercizi.js (catalogo) sia da sedute.js
// (personalizzazione di un esercizio solo per una seduta).

import * as storage from './storage.js';
import * as dizionario from './dizionario.js';
import { escapeHtml, debounce } from './dom-utils.js';

export function mountStepEditor(container, { steps, onChange }) {
  let stepInput = '';
  let pickedSuggestion = null;
  let expandedStep = null;

  function emit() { onChange(steps); }

  async function commit(raw, chosen) {
    const text = raw.trim();
    if (!text) return;
    const resolved = await dizionario.risolviTermine(text, chosen ? chosen.id : null);
    steps.push({ id: storage.uid(), label: resolved.label, note: '', ruolo: '', termRef: resolved.termRef });
    emit();
    renderSteps();
  }

  function renderSuggestions(list) {
    const slot = container.querySelector('.se-suggestions');
    if (!slot) return;
    if (list.length === 0) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div class="gk-suggestions">${
      list.map((s) => `<div class="gk-suggestion-item" data-sugg-id="${s.id}" data-sugg-label="${escapeHtml(s.label)}">
        <span><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--amber);margin-right:6px"></i>${escapeHtml(s.label)}</span><span class="gk-suggestion-count">usato ×${s.count}</span>
      </div>`).join('')
    }</div>`;
    slot.querySelectorAll('[data-sugg-id]').forEach((item) => {
      item.addEventListener('click', () => {
        const inputEl = container.querySelector('.se-input');
        inputEl.value = item.dataset.suggLabel;
        stepInput = item.dataset.suggLabel;
        pickedSuggestion = { id: item.dataset.suggId, label: item.dataset.suggLabel };
        slot.innerHTML = '';
        inputEl.focus();
      });
    });
  }

  async function renderSteps() {
    const cont = container.querySelector('.se-steps');
    if (!cont) return;
    if (steps.length === 0) {
      cont.innerHTML = `<div class="gk-empty">Ancora nessuno step. Scrivine uno qui sopra.</div>`;
      return;
    }
    const rows = await Promise.all(steps.map(async (s, i) => {
      const { gruppo, alternative } = await dizionario.alternativePer(s.termRef);
      const expanded = expandedStep === i;
      return `
        <div class="gk-step">
          <div class="gk-step-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="gk-step-body">
            <div class="gk-step-main">
              ${s.termRef ? '<i class="fa-solid fa-link gk-step-link" title="Collegato al dizionario"></i>' : ''}
              <span class="gk-step-label" data-se-expand="${i}">${escapeHtml(s.label)}</span>
              <div class="gk-step-actions">
                <button class="gk-icon-btn" data-se-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="gk-icon-btn" data-se-move="${i}" data-dir="1" ${i === steps.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="gk-icon-btn" data-se-expand="${i}"><i class="fa-solid fa-pen"></i></button>
                <button class="gk-icon-btn danger" data-se-delete="${i}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            ${expanded ? `
              <div class="gk-step-expand">
                ${alternative.length > 0 ? `
                  <div>
                    <div class="gk-mini-label">Alternative nel gruppo "${escapeHtml(gruppo.nome)}"</div>
                    <div class="gk-alt-row">
                      ${alternative.map((a) => `<div class="gk-alt-chip" data-se-alt="${i}" data-term="${a.id}" data-label="${escapeHtml(a.label)}"><i class="fa-solid fa-shuffle"></i>${escapeHtml(a.label)}</div>`).join('')}
                    </div>
                  </div>` : ''}
                <div>
                  <div class="gk-mini-label">Nota (opzionale)</div>
                  <input class="gk-input" data-se-note="${i}" value="${escapeHtml(s.note)}" />
                </div>
                <div>
                  <div class="gk-mini-label">Ruolo (solo esercizi multi-portiere)</div>
                  <input class="gk-input" data-se-ruolo="${i}" placeholder="Es. Porta 1, Porta 2..." value="${escapeHtml(s.ruolo)}" />
                </div>
              </div>` : ''}
          </div>
        </div>
      `;
    }));
    cont.innerHTML = rows.join('');

    cont.querySelectorAll('[data-se-note]').forEach((inp) => {
      inp.addEventListener('input', (e) => { steps[+e.target.dataset.seNote].note = e.target.value; emit(); });
    });
    cont.querySelectorAll('[data-se-ruolo]').forEach((inp) => {
      inp.addEventListener('input', (e) => { steps[+e.target.dataset.seRuolo].ruolo = e.target.value; emit(); });
    });
    cont.querySelectorAll('[data-se-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.seMove, dir = +btn.dataset.dir, j = i + dir;
        if (j < 0 || j >= steps.length) return;
        [steps[i], steps[j]] = [steps[j], steps[i]];
        emit(); renderSteps();
      });
    });
    cont.querySelectorAll('[data-se-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        steps.splice(+btn.dataset.seDelete, 1);
        expandedStep = null;
        emit(); renderSteps();
      });
    });
    cont.querySelectorAll('[data-se-expand]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = +(el.dataset.seExpand);
        expandedStep = expandedStep === i ? null : i;
        renderSteps();
      });
    });
    cont.querySelectorAll('[data-se-alt]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = +el.dataset.seAlt;
        steps[i].label = el.dataset.label;
        steps[i].termRef = el.dataset.term;
        emit(); renderSteps();
      });
    });
  }

  container.innerHTML = `
    <div class="gk-step-add-row">
      <input class="gk-input se-input" placeholder="Scrivi un passaggio e premi Invio..." />
      <button class="gk-add-btn se-add-btn"><i class="fa-solid fa-plus"></i></button>
      <div class="se-suggestions"></div>
    </div>
    <div class="gk-hint">Puoi anche incollare più righe insieme: ognuna diventa uno step.</div>
    <div class="se-steps"></div>
  `;
  const inputEl = container.querySelector('.se-input');
  inputEl.addEventListener('input', debounce(async (e) => {
    stepInput = e.target.value;
    pickedSuggestion = null;
    renderSuggestions(await dizionario.suggerimenti(stepInput, 4));
  }, 120));
  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await commit(inputEl.value, pickedSuggestion);
      inputEl.value = ''; stepInput = ''; pickedSuggestion = null;
      renderSuggestions([]);
    }
  });
  inputEl.addEventListener('paste', async (e) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\n')) {
      e.preventDefault();
      for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) await commit(line, null);
      inputEl.value = '';
    }
  });
  container.querySelector('.se-add-btn').addEventListener('click', async () => {
    await commit(inputEl.value, pickedSuggestion);
    inputEl.value = ''; stepInput = ''; pickedSuggestion = null;
    renderSuggestions([]);
    inputEl.focus();
  });

  renderSteps();
}

// Materiali: elenco (righe) di quelli selezionati con quantità modificabile
// + un <select> per aggiungerne altri — niente pillole.
export function mountMaterialiEditor(container, { materiali, materialiList, onChange }) {
  function draw() {
    const selectedKeys = new Set(materiali.map((m) => m.key));
    const disponibili = materialiList.filter((m) => !selectedKeys.has(m.key));
    container.innerHTML = `
      <div class="gk-mat-list">
        ${materiali.map((m) => {
          const info = materialiList.find((x) => x.key === m.key);
          return `
          <div class="gk-mat-row">
            <i class="fa-solid fa-box" style="color:var(--chalk-dim)"></i>
            <span class="gk-mat-label">${escapeHtml(info?.label || m.key)}</span>
            <input class="gk-input gk-inline-input gk-mat-qty" type="number" min="1" data-mat-qty="${m.key}" value="${m.qty || 1}" />
            <button class="gk-icon-btn danger" data-mat-remove="${m.key}"><i class="fa-solid fa-trash"></i></button>
          </div>`;
        }).join('')}
        ${materiali.length === 0 ? '<div class="gk-hint">Nessun materiale selezionato.</div>' : ''}
      </div>
      ${disponibili.length > 0 ? `
        <div class="gk-add-row" style="margin-top:8px">
          <select class="gk-input" data-mat-select>
            <option value="">+ Aggiungi materiale...</option>
            ${disponibili.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join('')}
          </select>
        </div>` : ''}
    `;
    container.querySelectorAll('[data-mat-qty]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const item = materiali.find((m) => m.key === e.target.dataset.matQty);
        if (item) item.qty = Math.max(1, +e.target.value || 1);
        onChange(materiali);
      });
    });
    container.querySelectorAll('[data-mat-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = materiali.findIndex((m) => m.key === btn.dataset.matRemove);
        if (idx >= 0) materiali.splice(idx, 1);
        onChange(materiali);
        draw();
      });
    });
    const sel = container.querySelector('[data-mat-select]');
    if (sel) sel.addEventListener('change', (e) => {
      if (!e.target.value) return;
      materiali.push({ key: e.target.value, qty: 1 });
      onChange(materiali);
      draw();
    });
  }
  draw();
}

// Tag: elenco con checkbox, raggruppato per lista di provenienza — niente pillole.
export function mountTagEditor(container, { tag, tagGroups, onChange }) {
  // tagGroups: [{ label, options: [{key,label}] }]
  function draw() {
    container.innerHTML = tagGroups.map((g) => `
      <div class="gk-mini-label" style="margin-top:8px">${escapeHtml(g.label)}</div>
      <div class="gk-opt-list">
        ${g.options.map((t) => `
          <label class="gk-opt-row ${tag.includes(t.key) ? 'active' : ''}">
            <input type="checkbox" data-tag-toggle="${t.key}" ${tag.includes(t.key) ? 'checked' : ''} />
            <span class="gk-opt-label">${escapeHtml(t.label)}</span>
          </label>
        `).join('')}
      </div>
    `).join('');
    container.querySelectorAll('[data-tag-toggle]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.tagToggle;
        const idx = tag.indexOf(key);
        if (idx >= 0) tag.splice(idx, 1); else tag.push(key);
        onChange(tag);
        draw();
      });
    });
  }
  draw();
}
