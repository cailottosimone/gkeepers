// settings.js
// Pannello impostazioni per le liste configurabili (schema 2.0):
//  - Gesti tecnici e Qualità allenate: COMPLETAMENTE liberi (aggiungi, rinomina,
//    elimina qualsiasi voce, anche le preimpostate). Nessun blocco.
//  - Materiali: i default hanno simbolo bloccato e non eliminabile; i custom si
//    possono eliminare e personalizzare (forma rapida oppure SVG su misura).
//  - Tipi di freccia: come prima.

import { genericMaterialSymbol, DEFAULT_ARROW_TYPES, ARROW_STYLES, ARROW_STYLE_LABELS, ARROW_CAP_KEYS, ARROW_CAP_LABELS, normalizeSvgSymbol, placeSymbol, toDisplayCode } from "./defaults.js";

const DEFAULT_ARROW_KEYS = new Set(DEFAULT_ARROW_TYPES.map(a => a.key));

export class SettingsPanel {
  constructor(container, { storage, onChange, onRecordsChanged, notify }) {
    this.container = container;
    this.storage = storage;
    this.onChange = onChange || (() => {});
    this.onRecordsChanged = onRecordsChanged || (async () => {});
    this.notify = notify || (() => {});
    this.lists = null;
    this.openSymbolKey = null; // materiale con editor simbolo aperto
  }

  async init() {
    this.lists = await this.storage.getCustomLists();
    this.render();
  }

  async _persist() {
    await this.storage.saveCustomLists(this.lists);
    this.onChange(this.lists);
  }

  render() {
    if (!this.lists) return;
    this.container.innerHTML = `
      <div class="settings-grid">
        ${this._editableStringSection("Gesti tecnici", "technicalGestures", "Aggiungi un gesto tecnico…")}
        ${this._editableStringSection("Qualità allenate", "trainedQualities", "Aggiungi una qualità…")}
        ${this._editableStringSection("Periodi di allenamento", "trainingPeriods", "Aggiungi un periodo…")}
        ${this._editableStringSection("Categorie Portiere", "goalkeeperCategories", "Aggiungi una categoria…")}
        ${this._editableStringSection("Note Portiere · Tecniche (tag)", "technicalNoteTags", "Aggiungi un tag tecnico…")}
        ${this._editableStringSection("Note Portiere · Mentali (tag)", "mentalNoteTags", "Aggiungi un tag mentale…")}
        ${this._editableStringSection("Note Portiere · Mediche (tag)", "medicalNoteTags", "Aggiungi un tag medico…")}
        ${this._materialsSection()}
        ${this._arrowTypesSection()}
      </div>
    `;
    this._wire();
  }

  // Sezione stringhe completamente editabile (rinomina inline + elimina qualsiasi voce).
  _editableStringSection(title, field, placeholder) {
    const items = this.lists[field] || [];
    const rows = items.map((v, i) => `<li class="cfg-row cfg-strrow">
        <input type="text" class="cfg-strinput" data-field="${field}" data-idx="${i}" value="${escapeAttr(v)}" aria-label="Voce">
        <button type="button" class="cfg-del" data-field="${field}" data-idx="${i}" title="Elimina">✕</button>
      </li>`).join("");
    return `
      <section class="cfg-card">
        <h3>${title}</h3>
        <p class="cfg-note">Aggiungi, rinomina o elimina liberamente qualsiasi voce.</p>
        <ul class="cfg-list">${rows || `<li class="cfg-empty">Nessuna voce.</li>`}</ul>
        <div class="cfg-add">
          <input type="text" class="cfg-input" data-add-field="${field}" placeholder="${escapeAttr(placeholder)}" />
          <button type="button" class="cfg-add-btn" data-add-field="${field}">Aggiungi</button>
        </div>
      </section>`;
  }

  _materialsSection() {
    const mats = this.lists.materials || [];
    const rows = mats.map(m => {
      const editor = this.openSymbolKey === m.key ? this._symbolEditor(m) : "";
      return `<li class="cfg-row cfg-mat cfg-mat-row" data-key="${escapeHtml(m.key)}">
          <svg viewBox="-36 -36 72 72" class="cfg-mat-icon" aria-hidden="true">${placeSymbol(m.svgSymbol)}</svg>
          <input type="text" class="cfg-mat-name" data-key="${escapeHtml(m.key)}" value="${escapeAttr(m.label)}" aria-label="Nome materiale">
          <button type="button" class="cfg-mat-symbtn" data-key="${escapeHtml(m.key)}" title="Modifica simbolo">Simbolo…</button>
          <button type="button" class="cfg-del" data-field="materials" data-key="${escapeHtml(m.key)}" title="Elimina">✕</button>
        </li>${editor}`;
    }).join("");
    return `
      <section class="cfg-card cfg-card-wide">
        <h3>Materiali</h3>
        <p class="cfg-note">Tutti i materiali sono rinominabili, con simbolo modificabile ed eliminabili. Usa "Simbolo…" per ridimensionare il simbolo generico (Proporzioni), caricare un file .svg o incollare markup, con anteprima live. Se elimini un materiale ancora usato in qualche esercizio, lì comparirà come "(materiale rimosso)" senza rompere nulla.</p>
        <ul class="cfg-list cfg-list-materials">${rows}</ul>
        <div class="cfg-add">
          <input type="text" class="cfg-input" data-add-field="materials" placeholder="Nuovo materiale (es. Elastico)…" />
          <button type="button" class="cfg-add-btn" data-add-field="materials">Aggiungi</button>
        </div>
      </section>`;
  }

  _symbolEditor(m) {
    const dims = m.symbolDims && Number.isFinite(m.symbolDims.w) ? m.symbolDims : { w: 26, h: 26 };
    return `<li class="cfg-symbol-editor" data-key="${escapeHtml(m.key)}">
      <div class="cfg-sym-grid">
        <div class="cfg-sym-previewbox">
          <span class="field-label">Anteprima</span>
          <svg class="cfg-sym-preview" viewBox="-36 -36 72 72" aria-hidden="true">${placeSymbol(m.svgSymbol)}</svg>
          <button type="button" class="btn btn-soft cfg-sym-showcode">Mostra codice SVG</button>
        </div>
        <div class="cfg-sym-controls">
          <div class="seg cfg-sym-modes">
            <button type="button" class="seg-btn is-on" data-mode="prop">Proporzioni</button>
            <button type="button" class="seg-btn" data-mode="upload">Carica SVG</button>
            <button type="button" class="seg-btn" data-mode="code">Inserisci codice</button>
          </div>

          <div class="cfg-sym-pane" data-pane="prop">
            <div class="cfg-sym-dims">
              <label>Larghezza (px)<input type="number" class="input cfg-sym-w" min="8" max="80" value="${dims.w}"></label>
              <label>Altezza (px)<input type="number" class="input cfg-sym-h" min="8" max="80" value="${dims.h}"></label>
            </div>
            <p class="hint">Genera un riquadro con la sigla del materiale alle proporzioni scelte (utile per oggetti stretti e lunghi).</p>
          </div>

          <div class="cfg-sym-pane" data-pane="upload" hidden>
            <label class="upload"><input type="file" accept=".svg,image/svg+xml" class="cfg-sym-file" hidden><span class="btn btn-soft">Scegli un file .svg…</span></label>
            <p class="hint">Il contenuto del file viene caricato nel campo "Inserisci codice".</p>
          </div>

          <div class="cfg-sym-pane" data-pane="code" hidden>
            <textarea class="cfg-sym-text input" rows="5" placeholder="Incolla o scrivi qui il markup SVG (anche un &lt;svg&gt; completo)"></textarea>
          </div>

          <textarea class="cfg-sym-codeview input" rows="4" readonly hidden></textarea>
          <p class="cfg-sym-error" role="alert" hidden></p>

          <div class="cfg-sym-actions">
            <button type="button" class="btn cfg-sym-cancel">Annulla</button>
            <button type="button" class="btn btn-primary cfg-sym-apply">Usa questo simbolo</button>
          </div>
        </div>
      </div>
    </li>`;
  }

  _arrowTypesSection() {
    const types = this.lists.arrowTypes || [];
    const styleOptions = (sel) => Object.keys(ARROW_STYLE_LABELS).map(k =>
      `<option value="${k}" ${k === sel ? "selected" : ""}>${ARROW_STYLE_LABELS[k]}</option>`).join("");
    const capOptions = (sel, fallback) => ARROW_CAP_KEYS.map(k =>
      `<option value="${k}" ${k === (sel || fallback) ? "selected" : ""}>${ARROW_CAP_LABELS[k]}</option>`).join("");
    const rows = types.map(a => {
      const locked = a.isDefault && DEFAULT_ARROW_KEYS.has(a.key);
      return `<li class="cfg-row cfg-arrow" data-akey="${escapeHtml(a.key)}">
        <span class="cfg-arrow-prev">${arrowPreview(a.color, a.style, a.startCap, a.endCap, a.capScale)}</span>
        <span class="cfg-name">${escapeHtml(a.name)}${locked ? ` <span class="cfg-tag">default</span>` : ""}</span>
        <input type="color" class="cfg-arrow-color" data-akey="${escapeHtml(a.key)}" value="${escapeAttr(toHexColor(a.color))}" title="Colore">
        <select class="cfg-arrow-style" data-akey="${escapeHtml(a.key)}" title="Stile">${styleOptions(a.style)}</select>
        <span class="cfg-arrow-caps">
          <select class="cfg-arrow-startcap" data-akey="${escapeHtml(a.key)}" title="Punta inizio linea">${capOptions(a.startCap, "none")}</select>
          <select class="cfg-arrow-endcap" data-akey="${escapeHtml(a.key)}" title="Punta fine linea">${capOptions(a.endCap, "arrow")}</select>
        </span>
        <input type="number" class="cfg-arrow-capscale" data-akey="${escapeHtml(a.key)}" min="0.5" max="2" step="0.1" value="${escapeAttr(clampCapScale(a.capScale))}" title="Dimensione punta (0.5–2.0)">
        <input type="text" class="cfg-arrow-desc" data-akey="${escapeHtml(a.key)}" value="${escapeAttr(a.description || "")}" placeholder="Descrizione (facoltativa)">
        ${locked ? `<span class="cfg-arrow-spacer"></span>` : `<button type="button" class="cfg-del" data-field="arrowTypes" data-key="${escapeHtml(a.key)}" title="Rimuovi">✕</button>`}
      </li>`;
    }).join("");
    return `
      <section class="cfg-card cfg-card-wide">
        <h3>Tipi di freccia</h3>
        <p class="cfg-note">Definisci frecce con significato (passaggio, tiro, spostamento…). Colore, stile e punte diventano i valori di default quando scegli quel tipo nell'editor. "Punta inizio"/"Punta fine" controllano se la linea ha una freccia a ciascuna estremità (nessuna, freccia piena o freccia aperta) — utile per frecce bidirezionali o semplici linee di delimitazione. "Dimensione punta" scala solo la punta (0.5 piccola – 2.0 grande, 1.0 default), mai lo spessore della linea. Nell'editor puoi sempre usare "colore + stile liberi".</p>
        <ul class="cfg-list cfg-list-arrows">${rows || `<li class="cfg-empty">Nessun tipo di freccia.</li>`}</ul>
        <div class="cfg-arrow-add">
          <input type="text" class="cfg-input cfg-arrow-newname" placeholder="Nome tipo (es. Cross)">
          <input type="color" class="cfg-arrow-newcolor" value="#2b7de9" title="Colore">
          <select class="cfg-arrow-newstyle" title="Stile">${styleOptions("solido")}</select>
          <span class="cfg-arrow-caps">
            <select class="cfg-arrow-newstartcap" title="Punta inizio linea">${capOptions(null, "none")}</select>
            <select class="cfg-arrow-newendcap" title="Punta fine linea">${capOptions(null, "arrow")}</select>
          </span>
          <input type="number" class="cfg-arrow-newcapscale" min="0.5" max="2" step="0.1" value="1" title="Dimensione punta (0.5–2.0)">
          <input type="text" class="cfg-input cfg-arrow-newdesc" placeholder="Descrizione (facoltativa)">
          <button type="button" class="cfg-add-btn cfg-arr-add-btn" id="cfg-arrow-add-btn">Aggiungi</button>
        </div>
      </section>`;
  }

  _wire() {
    // aggiunta voce (stringhe e materiali)
    this.container.querySelectorAll(".cfg-add-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.addField;
        if (!field) return;
        const input = this.container.querySelector(`.cfg-input[data-add-field="${cssEsc(field)}"]`);
        const val = (input.value || "").trim();
        if (!val) return;
        this._addItem(field, val);
      });
    });
    this.container.querySelectorAll(".cfg-input[data-add-field]").forEach(inp => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const val = (inp.value || "").trim();
          if (val) this._addItem(inp.dataset.addField, val);
        }
      });
    });

    // rinomina stringhe (gesti/qualità/periodi/categorie/tag note)
    this.container.querySelectorAll(".cfg-strinput").forEach(inp => {
      inp.addEventListener("change", () => this._renameString(inp.dataset.field, parseInt(inp.dataset.idx, 10), inp.value, inp));
    });

    // eliminazione
    this.container.querySelectorAll(".cfg-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.field;
        if (field === "materials") this._removeMaterial(btn.dataset.key);
        else if (field === "arrowTypes") this._removeArrowType(btn.dataset.key);
        else this._removeStringByIdx(field, parseInt(btn.dataset.idx, 10));
      });
    });

    this._wireMaterials();
    this._wireArrows();
  }

  _wireMaterials() {
    // rinomina materiale (label) — su tutti
    this.container.querySelectorAll(".cfg-mat-name").forEach(inp =>
      inp.addEventListener("change", () => this._renameMaterial(inp.dataset.key, inp.value, inp)));
    // apertura editor simbolo
    this.container.querySelectorAll(".cfg-mat-symbtn").forEach(btn =>
      btn.addEventListener("click", () => {
        this.openSymbolKey = (this.openSymbolKey === btn.dataset.key) ? null : btn.dataset.key;
        this.render();
      }));

    const ed = this.container.querySelector(".cfg-symbol-editor");
    if (!ed) return;
    const key = ed.dataset.key;
    const mat = (this.lists.materials || []).find(x => x.key === key);
    if (!mat) return;

    const preview = ed.querySelector(".cfg-sym-preview");
    const text = ed.querySelector(".cfg-sym-text");
    const wIn = ed.querySelector(".cfg-sym-w");
    const hIn = ed.querySelector(".cfg-sym-h");
    const errEl = ed.querySelector(".cfg-sym-error");
    const codeView = ed.querySelector(".cfg-sym-codeview");
    let mode = "prop";

    const showError = (msg) => { if (!errEl) return; if (msg) { errEl.textContent = msg; errEl.hidden = false; } else { errEl.hidden = true; } };
    // Anteprima con lo STESSO rendering dell'editor: placeSymbol nel medesimo viewBox centrato.
    const showPreview = (symbol) => { preview.innerHTML = placeSymbol(symbol); };
    const previewProp = () => {
      const w = clampDim(wIn.value), h = clampDim(hIn.value);
      showPreview(genericMaterialSymbol(mat.label, { w, h }));
      showError(null);
    };
    const previewCode = () => {
      const sym = normalizeSvgSymbol(text.value);
      if (sym) { showPreview(sym); showError(null); }
      else { showError(text.value.trim() ? "Markup SVG non valido." : "Inserisci del markup SVG."); }
    };
    const refreshPreview = () => { mode === "prop" ? previewProp() : previewCode(); };

    // selezione modalità
    ed.querySelectorAll(".cfg-sym-modes .seg-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        ed.querySelectorAll(".cfg-sym-modes .seg-btn").forEach(b => b.classList.toggle("is-on", b === btn));
        ed.querySelectorAll(".cfg-sym-pane").forEach(p => { p.hidden = (p.dataset.pane !== mode); });
        refreshPreview();
      }));

    if (wIn) wIn.addEventListener("input", previewProp);
    if (hIn) hIn.addEventListener("input", previewProp);
    if (text) text.addEventListener("input", previewCode);

    // carica file -> riempi il campo codice e passa a modalità "code"
    ed.querySelector(".cfg-sym-file").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try {
        text.value = await f.text();
        mode = "code";
        ed.querySelectorAll(".cfg-sym-modes .seg-btn").forEach(b => b.classList.toggle("is-on", b.dataset.mode === "code"));
        ed.querySelectorAll(".cfg-sym-pane").forEach(p => { p.hidden = (p.dataset.pane !== "code"); });
        previewCode();
      } catch (_) { showError("Impossibile leggere il file."); }
    });

    // mostra/nascondi codice SVG attuale (forma NORMALIZZATA, pronta al copia-incolla)
    ed.querySelector(".cfg-sym-showcode").addEventListener("click", (e) => {
      if (codeView.hidden) { codeView.value = toDisplayCode(mat.svgSymbol); codeView.hidden = false; e.target.textContent = "Nascondi codice SVG"; }
      else { codeView.hidden = true; e.target.textContent = "Mostra codice SVG"; }
    });

    ed.querySelector(".cfg-sym-apply").addEventListener("click", () => {
      if (mode === "prop") this._applyProportions(key, clampDim(wIn.value), clampDim(hIn.value));
      else {
        const sym = normalizeSvgSymbol(text.value);
        if (!sym) { showError(text.value.trim() ? "Markup SVG non valido: controlla il codice." : "Inserisci del markup SVG."); return; }
        this._applyCustomSymbol(key, text.value);
      }
    });
    ed.querySelector(".cfg-sym-cancel").addEventListener("click", () => { this.openSymbolKey = null; this.render(); });
  }

  _wireArrows() {
    this.container.querySelectorAll(".cfg-arrow-color").forEach(inp =>
      inp.addEventListener("change", () => this._updateArrowType(inp.dataset.akey, { color: inp.value })));
    this.container.querySelectorAll(".cfg-arrow-style").forEach(sel =>
      sel.addEventListener("change", () => this._updateArrowType(sel.dataset.akey, { style: sel.value })));
    this.container.querySelectorAll(".cfg-arrow-startcap").forEach(sel =>
      sel.addEventListener("change", () => this._updateArrowType(sel.dataset.akey, { startCap: sel.value })));
    this.container.querySelectorAll(".cfg-arrow-endcap").forEach(sel =>
      sel.addEventListener("change", () => this._updateArrowType(sel.dataset.akey, { endCap: sel.value })));
    this.container.querySelectorAll(".cfg-arrow-capscale").forEach(inp =>
      inp.addEventListener("change", () => { inp.value = clampCapScale(inp.value); this._updateArrowType(inp.dataset.akey, { capScale: clampCapScale(inp.value) }); }));
    this.container.querySelectorAll(".cfg-arrow-desc").forEach(inp =>
      inp.addEventListener("change", () => this._updateArrowType(inp.dataset.akey, { description: inp.value.trim() }, false)));
    const addBtn = this.container.querySelector("#cfg-arrow-add-btn");
    if (addBtn) addBtn.addEventListener("click", () => {
      const name = (this.container.querySelector(".cfg-arrow-newname").value || "").trim();
      if (!name) return;
      const color = this.container.querySelector(".cfg-arrow-newcolor").value || "#2b7de9";
      const style = this.container.querySelector(".cfg-arrow-newstyle").value || "solido";
      const startCap = this.container.querySelector(".cfg-arrow-newstartcap").value || "none";
      const endCap = this.container.querySelector(".cfg-arrow-newendcap").value || "arrow";
      const capScale = clampCapScale(this.container.querySelector(".cfg-arrow-newcapscale").value);
      const description = (this.container.querySelector(".cfg-arrow-newdesc").value || "").trim();
      this._addArrowType({ name, color, style, startCap, endCap, capScale, description });
    });
  }

  // --- stringhe ---
  async _addItem(field, val) {
    if (field === "materials") {
      const key = uniqueKey(slug(val), this.lists.materials.map(m => m.key));
      this.lists.materials.push({ key, label: val, isDefault: false, symbolMode: "generic", symbolDims: { w: 26, h: 26 }, svgSymbol: genericMaterialSymbol(val, { w: 26, h: 26 }) });
    } else {
      if (!Array.isArray(this.lists[field])) this.lists[field] = [];
      if (!this.lists[field].includes(val)) this.lists[field].push(val);
    }
    await this._persist();
    this.render();
  }

  // Mappa lista configurabile -> come propagarne la rinomina sui record.
  _propagationTarget(field) {
    switch (field) {
      case "technicalGestures": return { kind: "exercise", exField: "technicalGestures", noun: "esercizi" };
      case "trainedQualities": return { kind: "exercise", exField: "trainedQualities", noun: "esercizi" };
      case "trainingPeriods": return { kind: "exercise", exField: "trainingPeriod", noun: "esercizi" };
      case "goalkeeperCategories": return { kind: "gkCategory", noun: "portieri" };
      case "technicalNoteTags": return { kind: "gkNote", block: "technical", noun: "portieri" };
      case "mentalNoteTags": return { kind: "gkNote", block: "mental", noun: "portieri" };
      case "medicalNoteTags": return { kind: "gkNote", block: "medical", noun: "portieri" };
      // materials/arrowTypes: referenziati per key, risolti a runtime -> nessuna propagazione
      default: return null;
    }
  }
  async _propagateRename(field, oldVal, newVal) {
    const t = this._propagationTarget(field);
    if (!t) return { count: 0, noun: "esercizi" };
    let count = 0;
    if (t.kind === "exercise") count = await this.storage.renameExerciseArrayValue(t.exField, oldVal, newVal);
    else if (t.kind === "gkCategory") count = await this.storage.renameGoalkeeperCategory(oldVal, newVal);
    else if (t.kind === "gkNote") count = await this.storage.renameGoalkeeperNoteTag(t.block, oldVal, newVal);
    return { count, noun: t.noun };
  }
  _hasDuplicateString(field, value, exceptIdx) {
    const arr = this.lists[field] || [];
    const norm = value.trim().toLowerCase();
    return arr.some((v, i) => i !== exceptIdx && String(v).trim().toLowerCase() === norm);
  }
  _hasDuplicateMaterialLabel(value, exceptKey) {
    const norm = value.trim().toLowerCase();
    return (this.lists.materials || []).some(m => m.key !== exceptKey && String(m.label).trim().toLowerCase() === norm);
  }
  _clearInlineError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove("cfg-input-invalid");
    const row = inputEl.closest(".cfg-row") || inputEl.parentElement;
    const sib = row && row.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("cfg-inline-err")) sib.remove();
  }
  _showInlineError(inputEl, msg) {
    if (!inputEl) { this.notify(msg, "error"); return; }
    const row = inputEl.closest(".cfg-row") || inputEl.parentElement;
    if (!row || !row.parentNode) { this.notify(msg, "error"); return; }
    let err = row.nextElementSibling;
    if (!err || !err.classList || !err.classList.contains("cfg-inline-err")) {
      err = document.createElement("li");
      err.className = "cfg-inline-err";
      err.setAttribute("role", "alert");
      row.parentNode.insertBefore(err, row.nextSibling);
    }
    err.textContent = msg;
    inputEl.classList.add("cfg-input-invalid");
    inputEl.focus();
    if (inputEl.select) inputEl.select();
  }

  async _renameString(field, idx, newVal, inputEl) {
    const arr = this.lists[field];
    if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return;
    this._clearInlineError(inputEl);
    const v = (newVal || "").trim();
    const old = arr[idx];
    if (!v) { this.render(); return; }          // vuoto: ripristina
    if (v === old) return;                       // invariato
    // Blocco duplicati (case-insensitive, dopo trim): non salvare nulla.
    if (this._hasDuplicateString(field, v, idx)) {
      if (inputEl) inputEl.value = old;
      this._showInlineError(inputEl, `Il nome "${v}" esiste già in questa lista. Scegli un nome diverso.`);
      return;
    }
    // Propagazione atomica sui record PRIMA di toccare la lista: se fallisce, nulla cambia.
    let result;
    try { result = await this._propagateRename(field, old, v); }
    catch (_) { this.notify("Rinomina non riuscita: nessuna modifica applicata.", "error"); return; }
    arr[idx] = v;
    await this._persist();
    this.render();
    await this.onRecordsChanged();
    if (result.count > 0) this.notify(`Voce aggiornata in ${result.count} ${result.noun}.`);
  }

  async _removeStringByIdx(field, idx) {
    const arr = this.lists[field];
    if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return;
    arr.splice(idx, 1);
    await this._persist();
    this.render();
  }

  // --- materiali (tutti modificabili ed eliminabili: nessuna distinzione default) ---
  async _removeMaterial(key) {
    this.lists.materials = (this.lists.materials || []).filter(m => m.key !== key);
    if (this.openSymbolKey === key) this.openSymbolKey = null;
    await this._persist();
    this.render();
  }
  async _renameMaterial(key, newLabel, inputEl) {
    const m = (this.lists.materials || []).find(x => x.key === key);
    if (!m) return;
    this._clearInlineError(inputEl);
    const v = (newLabel || "").trim();
    if (!v) { this.render(); return; }
    if (v === m.label) return;
    if (this._hasDuplicateMaterialLabel(v, key)) {
      if (inputEl) inputEl.value = m.label;
      this._showInlineError(inputEl, `Il nome "${v}" esiste già in questa lista. Scegli un nome diverso.`);
      return;
    }
    m.label = v;
    await this._persist();
    this.render();
    // Materiali referenziati per key negli esercizi: l'etichetta si risolve a runtime,
    // quindi la rinomina è già propagata ovunque senza toccare i record.
  }
  async _applyProportions(key, w, h) {
    const m = (this.lists.materials || []).find(x => x.key === key);
    if (!m) return;
    m.symbolMode = "generic";
    m.symbolDims = { w, h };
    m.svgSymbol = genericMaterialSymbol(m.label, { w, h }); // frammento <g> centrato: reso a dimensione nativa
    await this._persist();
    this.render();
  }
  async _applyCustomSymbol(key, raw) {
    const m = (this.lists.materials || []).find(x => x.key === key);
    if (!m) return;
    const sym = normalizeSvgSymbol(raw);   // normalizza viewBox + width/height 100% + preserveAspectRatio
    if (!sym) return;
    m.svgSymbol = sym;
    m.symbolMode = "custom";
    delete m.symbolDims;
    this.openSymbolKey = null;
    await this._persist();
    this.render();
  }

  // --- frecce ---
  async _addArrowType({ name, color, style, startCap, endCap, capScale, description }) {
    if (!Array.isArray(this.lists.arrowTypes)) this.lists.arrowTypes = [];
    const key = uniqueKey(slug(name), this.lists.arrowTypes.map(a => a.key));
    this.lists.arrowTypes.push({ key, name, color, style, startCap: startCap || "none", endCap: endCap || "arrow", capScale: clampCapScale(capScale), description: description || "", isDefault: false });
    await this._persist();
    this.render();
  }
  async _updateArrowType(key, patch, reRender = true) {
    const a = (this.lists.arrowTypes || []).find(x => x.key === key);
    if (!a) return;
    Object.assign(a, patch);
    await this._persist();
    if (reRender) this.render();
  }
  async _removeArrowType(key) {
    if (DEFAULT_ARROW_KEYS.has(key)) return;
    this.lists.arrowTypes = (this.lists.arrowTypes || []).filter(a => a.key !== key);
    await this._persist();
    this.render();
  }
}

// --- helpers ---
function slug(s) {
  return String(s).toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "mat";
}
function uniqueKey(base, existing) {
  let k = base, i = 2;
  while (existing.includes(k)) { k = base + "_" + i; i++; }
  return k;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }
function clampDim(v) { const n = parseInt(v, 10); return Math.max(8, Math.min(80, Number.isFinite(n) ? n : 26)); }

// Anteprima compatta della freccia (colore + stile + punte + dimensione) per la lista impostazioni.
function arrowPreview(color, style, startCap, endCap, capScale) {
  const dash = ARROW_STYLES[style] || "";
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const c = escapeAttr(color || "#2b7de9");
  const sc = startCap || "none", ec = endCap || "arrow";
  const scale = clampCapScale(capScale);
  const cap = (kind, atStart) => {
    if (kind === "none") return "";
    const cx = atStart ? 13 : 41, cy = 9;
    const shape = kind === "arrow_open"
      ? (atStart
          ? `<path d="M14,4.5 5,9 14,13.5" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<path d="M40,4.5 49,9 40,13.5" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`)
      : (atStart
          ? `<polygon points="4,9 13,4.5 13,13.5" fill="${c}"/>`
          : `<polygon points="50,9 41,4.5 41,13.5" fill="${c}"/>`);
    return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">${shape}</g>`;
  };
  const x1 = sc === "none" ? 4 : 13, x2 = ec === "none" ? 50 : 41;
  return `<svg viewBox="0 0 64 18" width="64" height="18" aria-hidden="true">
    <line x1="${x1}" y1="9" x2="${x2}" y2="9" stroke="${c}" stroke-width="3" stroke-linecap="round"${dashAttr}/>
    ${cap(sc, true)}${cap(ec, false)}
  </svg>`;
}
function toHexColor(c) {
  if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (typeof c === "string" && /^#[0-9a-fA-F]{3}$/.test(c)) {
    return "#" + c.slice(1).split("").map(ch => ch + ch).join("");
  }
  return "#2b7de9";
}
// Dimensione della punta: moltiplicatore 0.5–2.0, default 1.0 (stessa regola usata dall'editor SVG).
function clampCapScale(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.max(0.5, Math.min(2, n)) * 10) / 10 : 1;
}
