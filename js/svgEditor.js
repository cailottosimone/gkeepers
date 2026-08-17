// svgEditor.js
// Editor SVG interno top-down. Crea nuovi schemi e modifica SVG importati.
// Elementi di due tipi (campo "kind"):
//   - symbol: materiale posizionato { id, kind:'symbol', key, x, y, rot, scale }
//   - arrow:  freccia punta-a-punta { id, kind:'arrow', x1,y1,x2,y2, color, style, label }
// Serializza in una stringa SVG autonoma con <metadata> (base64) per re-import lossless.

import { ARROW_STYLES, ARROW_STYLE_LABELS, ARROW_CAP_KEYS, ARROW_CAP_LABELS, ARROW_TOOL_ICON, placeSymbol, removedSymbolPlaceholder } from "./defaults.js";

const VW = 800, VH = 600;
const GRID = 20;
const FREE = "__free__";
const MIN_ARROW = 16;

function genId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "e-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function pitchMarkup() {
  return `
    <rect x="0" y="0" width="${VW}" height="${VH}" fill="#1f7a4d"/>
    <rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#repStripes)"/>
    <g stroke="#eafff5" stroke-width="3" fill="none" opacity="0.92">
      <rect x="30" y="20" width="${VW-60}" height="${VH-50}"/>
      <rect x="${VW/2-180}" y="20" width="360" height="160"/>
      <rect x="${VW/2-90}" y="20" width="180" height="70"/>
      <rect x="${VW/2-55}" y="8" width="110" height="14" fill="#eafff5" opacity="0.85"/>
      <circle cx="${VW/2}" cy="140" r="4" fill="#eafff5"/>
      <path d="M ${VW/2-70} 180 A 90 90 0 0 0 ${VW/2+70} 180"/>
    </g>`;
}

function gridMarkup() {
  let lines = "";
  for (let x = GRID; x < VW; x += GRID) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${VH}"/>`;
  for (let y = GRID; y < VH; y += GRID) lines += `<line x1="0" y1="${y}" x2="${VW}" y2="${y}"/>`;
  return `<g stroke="#ffffff" stroke-width="0.5" opacity="0.18">${lines}</g>`;
}

// --- Defs condivisi (pattern strisce campo + marker punte frecce usati nel documento) ---
function defsMarkup(elements, arrowTypes) {
  return `<defs>
    <pattern id="repStripes" width="${VW}" height="80" patternUnits="userSpaceOnUse">
      <rect width="${VW}" height="40" fill="#ffffff" opacity="0.04"/>
    </pattern>
    <clipPath id="repFieldClip"><rect x="0" y="0" width="${VW}" height="${VH}"/></clipPath>
    ${collectArrowMarkerDefs(elements, arrowTypes)}
  </defs>`;
}

// --- helpers frecce ---
// Marker SVG riutilizzabili per le punte (inizio/fine linea): un <marker> per ogni combinazione
// (tipo punta, colore, dimensione) effettivamente usata nel documento, referenziato via
// marker-start/marker-end sulla <line>. orient="auto-start-reverse" fa sì che lo STESSO marker si
// specchi automaticamente quando usato come punta iniziale, quindi non serve duplicarlo per le due
// estremità. markerUnits="userSpaceOnUse": la dimensione della punta è un valore assoluto fisso,
// NON un multiplo dello stroke-width della linea (che resta un controllo separato, mai toccato qui).
const ARROW_CAP_BASE_SIZE = 15; // dimensione (in unità del canvas) della punta con capScale=1.0: ~3.3x lo stroke-width(4.5) della linea, compatta come prima dell'introduzione di startCap/endCap
function arrowCapMarkerId(cap, color, capScale) {
  const scale = clampCapScale(capScale);
  return `mk-${cap}-${String(color || "").replace(/[^0-9a-fA-F]/g, "") || "000000"}-${Math.round(scale * 10)}`;
}
function clampCapScale(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0.5, Math.min(2, n)) : 1;
}
function arrowCapMarkerDef(cap, color, capScale) {
  const id = arrowCapMarkerId(cap, color, capScale);
  const c = escapeAttr(color);
  const size = (ARROW_CAP_BASE_SIZE * clampCapScale(capScale)).toFixed(2);
  if (cap === "arrow") {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="${size}" markerHeight="${size}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,0.4 L9.6,5 L0,9.6 Z" fill="${c}"/>
    </marker>`;
  }
  if (cap === "arrow_open") {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="7.6" refY="5" markerWidth="${size}" markerHeight="${size}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M1.2,1 L8.6,5 L1.2,9" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>`;
  }
  return "";
}
// Raccoglie (deduplicati) i <marker> realmente necessari per l'insieme di frecce fornito.
function collectArrowMarkerDefs(elements, arrowTypes) {
  const seen = new Map();
  (elements || []).forEach(el => {
    if (el.kind !== "arrow") return;
    const eff = effectiveArrow(el, arrowTypes);
    [eff.startCap, eff.endCap].forEach(cap => {
      if (cap === "none" || !cap) return;
      const id = arrowCapMarkerId(cap, eff.color, eff.capScale);
      if (!seen.has(id)) seen.set(id, arrowCapMarkerDef(cap, eff.color, eff.capScale));
    });
  });
  return [...seen.values()].join("");
}
function arrowLabelMarkup(a) {
  if (!a.label) return "";
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  return `<text x="${mx.toFixed(1)}" y="${(my - 8).toFixed(1)}" text-anchor="middle"
    font-family="system-ui, sans-serif" font-size="19" font-weight="700"
    fill="#ffffff" stroke="#14241c" stroke-width="3.5" paint-order="stroke"
    style="paint-order:stroke">${escapeHtml(a.label)}</text>`;
}
// Markup visibile della freccia (linea + punte + etichetta), usato sia a schermo sia in export.
// Le punte sono marker SVG (vedi sopra), condizionali per estremità in base a startCap/endCap,
// scalate da capScale (dimensione della punta, indipendente dallo stroke-width della linea).
function arrowVisualMarkup(a) {
  const dash = ARROW_STYLES[a.style] || "";
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const startCap = a.startCap || "none";
  const endCap = a.endCap || "arrow"; // fallback prudente per dati non ancora migrati
  const capScale = clampCapScale(a.capScale);
  const ms = startCap !== "none" ? ` marker-start="url(#${arrowCapMarkerId(startCap, a.color, capScale)})"` : "";
  const me = endCap !== "none" ? ` marker-end="url(#${arrowCapMarkerId(endCap, a.color, capScale)})"` : "";
  return `<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${a.x2.toFixed(1)}" y2="${a.y2.toFixed(1)}"
      stroke="${escapeAttr(a.color)}" stroke-width="4.5" stroke-linecap="round"${dashAttr}${ms}${me}/>
    ${arrowLabelMarkup(a)}`;
}

// Risoluzione a runtime del tipo di freccia (analoga ai materiali):
// - typeKey assente/FREE  -> freccia "libera": colore/stile/punte/dimensione come salvati sull'elemento.
// - typeKey valido        -> colore/stile/punte/dimensione dal tipo corrente in customLists.
// - typeKey non più esistente -> stile neutro (grigio, solido, punta finale) + flag removed.
// startCap/endCap hanno sempre un fallback "none"/"arrow", capScale un fallback 1.0 (il
// comportamento implicito di prima di queste funzionalità), così i tipi/frecce creati prima delle
// rispettive migrazioni restano invariati senza bisogno di alcuna azione manuale né riscrittura dei dati salvati.
function effectiveArrow(el, arrowTypes) {
  const tk = el.typeKey;
  if (!tk || tk === FREE) return { color: el.color, style: el.style, label: el.label, typeKey: null, removed: false, startCap: el.startCap || "none", endCap: el.endCap || "arrow", capScale: clampCapScale(el.capScale) };
  const t = (arrowTypes || []).find(x => x.key === tk);
  if (!t) return { color: "#9aa0a6", style: "solido", label: el.label, typeKey: tk, removed: true, startCap: "none", endCap: "arrow", capScale: 1 };
  return { color: t.color, style: t.style, label: el.label, typeKey: tk, removed: false, startCap: t.startCap || "none", endCap: t.endCap || "arrow", capScale: clampCapScale(t.capScale) };
}
// Attributi + markup risolti per una freccia (riusato da editor, export e compose).
function arrowResolvedParts(el, arrowTypes) {
  const eff = effectiveArrow(el, arrowTypes);
  const visual = arrowVisualMarkup({ ...el, color: eff.color, style: eff.style, label: eff.label, startCap: eff.startCap, endCap: eff.endCap, capScale: eff.capScale });
  const typeAttr = eff.typeKey ? ` data-arrow-type="${escapeAttr(eff.typeKey)}"` : "";
  const title = eff.removed ? `<title>(tipo rimosso)</title>` : "";
  return { dataStyle: eff.style, typeAttr, title, visual };
}

export class SvgEditor {
  constructor(container, opts = {}) {
    this.container = container;
    this.getMaterials = opts.getMaterials || (() => []);
    this.getArrowTypes = opts.getArrowTypes || (() => []);
    this.model = { background: null, elements: [] };
    this.selectedId = null;
    this.tool = "select";        // 'select' | 'symbol' | 'arrow'
    this.armedKey = null;        // chiave materiale quando tool === 'symbol'
    this.snap = true;
    this.showGrid = true;
    this.dragging = null;
    this.undoStack = [];
    this.view = { x: 0, y: 0, w: VW, h: VH }; // stato visivo zoom/pan (non tocca le coordinate salvate)
    this.arrowSettings = this._defaultArrowSettings();
    this._build();
  }

  _defaultArrowSettings() {
    const types = this.getArrowTypes();
    const first = types[0];
    return first
      ? { mode: "type", typeKey: first.key, color: first.color, style: first.style, startCap: first.startCap || "none", endCap: first.endCap || "arrow", capScale: clampCapScale(first.capScale), label: "" }
      : { mode: "free", typeKey: FREE, color: "#f5b301", style: "solido", startCap: "none", endCap: "arrow", capScale: 1, label: "" };
  }

  _build() {
    this.container.innerHTML = "";
    this.container.classList.add("svg-editor");

    const toolbar = document.createElement("div");
    toolbar.className = "se-toolbar";
    toolbar.innerHTML = `
      <div class="se-tb-group" role="group" aria-label="Vista">
        <span class="se-tb-label">Vista</span>
        <div class="se-tb-btns">
          <button type="button" data-act="snap" class="se-btn"></button>
          <button type="button" data-act="grid" class="se-btn"></button>
        </div>
      </div>
      <div class="se-tb-group" role="group" aria-label="Trasforma">
        <span class="se-tb-label">Trasforma</span>
        <div class="se-tb-btns">
          <button type="button" data-act="rotL" class="se-btn se-btn-icon" title="Ruota -15° (solo materiali)">⟲</button>
          <button type="button" data-act="rotR" class="se-btn se-btn-icon" title="Ruota +15° (solo materiali)">⟳</button>
          <button type="button" data-act="bigger" class="se-btn se-btn-icon" title="Ingrandisci (solo materiali)">＋</button>
          <button type="button" data-act="smaller" class="se-btn se-btn-icon" title="Rimpicciolisci (solo materiali)">－</button>
        </div>
      </div>
      <div class="se-tb-group" role="group" aria-label="Zoom">
        <span class="se-tb-label">Zoom</span>
        <div class="se-tb-btns">
          <button type="button" data-act="zoomout" class="se-btn se-btn-icon" title="Riduci zoom">－</button>
          <button type="button" data-act="zoomin" class="se-btn se-btn-icon" title="Aumenta zoom">＋</button>
          <button type="button" data-act="zoomfit" class="se-btn" title="Adatta alla vista">Adatta</button>
        </div>
      </div>
      <div class="se-tb-group" role="group" aria-label="Modifica">
        <span class="se-tb-label">Modifica</span>
        <div class="se-tb-btns">
          <button type="button" data-act="undo" class="se-btn" title="Annulla l'ultima azione">Annulla</button>
          <button type="button" data-act="delete" class="se-btn se-danger" title="Elimina selezionato">Elimina</button>
          <button type="button" data-act="clear" class="se-btn se-danger" title="Svuota tutto">Svuota</button>
          <button type="button" data-act="dropbg" class="se-btn se-danger se-hidden" title="Rimuovi sfondo importato">Rimuovi sfondo</button>
        </div>
      </div>`;
    this.toolbar = toolbar;

    const palette = document.createElement("div");
    palette.className = "se-palette";
    this.palette = palette;

    // Barra configurazione freccia
    const arrowBar = document.createElement("div");
    arrowBar.className = "se-arrowbar se-hidden";
    arrowBar.innerHTML = `
      <span class="se-arrowbar-title">Freccia</span>
      <label class="se-ab-field">Tipo
        <select class="se-ab-type"></select>
      </label>
      <label class="se-ab-field">Colore
        <input type="color" class="se-ab-color" value="#f5b301">
      </label>
      <label class="se-ab-field">Stile
        <select class="se-ab-style">
          ${Object.keys(ARROW_STYLES).map(k => `<option value="${k}">${ARROW_STYLE_LABELS[k] || k}</option>`).join("")}
        </select>
      </label>
      <label class="se-ab-field">Punta inizio
        <select class="se-ab-startcap">
          ${ARROW_CAP_KEYS.map(k => `<option value="${k}">${ARROW_CAP_LABELS[k] || k}</option>`).join("")}
        </select>
      </label>
      <label class="se-ab-field">Punta fine
        <select class="se-ab-endcap">
          ${ARROW_CAP_KEYS.map(k => `<option value="${k}">${ARROW_CAP_LABELS[k] || k}</option>`).join("")}
        </select>
      </label>
      <label class="se-ab-field">Dimensione punta
        <input type="number" class="se-ab-capscale" min="0.5" max="2" step="0.1" value="1">
      </label>
      <label class="se-ab-field se-ab-label-field">Etichetta
        <input type="text" class="se-ab-label" placeholder="es. passaggio, tiro…" maxlength="24">
      </label>`;
    this.arrowBar = arrowBar;

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "se-canvas-wrap";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.setAttribute("class", "se-canvas");
    svg.setAttribute("tabindex", "0");
    canvasWrap.appendChild(svg);
    this.svg = svg;

    this.container.appendChild(toolbar);
    this.container.appendChild(palette);
    this.container.appendChild(arrowBar);
    this.container.appendChild(canvasWrap);

    this._wireToolbar();
    this._wireArrowBar();
    this._wireCanvas();
    this.renderPalette();
    this.render();
    this._updateToggles();
    this._syncArrowBar();
  }

  // ---------- Palette ----------
  renderPalette() {
    const mats = this.getMaterials();
    this.palette.innerHTML = "";

    // Strumento Freccia (in testa, evidenziato)
    const arrowBtn = document.createElement("button");
    arrowBtn.type = "button";
    arrowBtn.className = "se-mat se-tool-arrow" + (this.tool === "arrow" ? " is-armed" : "");
    arrowBtn.innerHTML = `<svg viewBox="-22 -22 44 44" class="se-mat-icon" aria-hidden="true">${ARROW_TOOL_ICON}</svg>
      <span class="se-mat-label">Freccia</span>`;
    arrowBtn.addEventListener("click", () => {
      this.tool = (this.tool === "arrow") ? "select" : "arrow";
      this.armedKey = null;
      if (this.tool === "arrow") this.selectedId = null;
      this.renderPalette(); this.render(); this._syncArrowBar();
    });
    this.palette.appendChild(arrowBtn);

    mats.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "se-mat" + (this.tool === "symbol" && this.armedKey === m.key ? " is-armed" : "");
      btn.dataset.key = m.key;
      btn.innerHTML = `
        <svg viewBox="-36 -36 72 72" class="se-mat-icon" aria-hidden="true">${placeSymbol(m.svgSymbol)}</svg>
        <span class="se-mat-label">${escapeHtml(m.label)}</span>`;
      btn.addEventListener("click", () => {
        if (this.tool === "symbol" && this.armedKey === m.key) { this.tool = "select"; this.armedKey = null; }
        else { this.tool = "symbol"; this.armedKey = m.key; }
        this.renderPalette(); this.render(); this._syncArrowBar();
      });
      this.palette.appendChild(btn);
    });

    const hint = document.createElement("p");
    hint.className = "se-hint";
    if (this.tool === "arrow") hint.textContent = "Trascina sul campo per disegnare una freccia. Imposta tipo/colore/stile qui sopra. Esc per uscire.";
    else if (this.tool === "symbol") hint.textContent = "Clicca sul campo per posizionare. Premi ancora il materiale o Esc per uscire.";
    else hint.textContent = "Scegli Freccia o un materiale, poi agisci sul campo. Clicca un elemento per selezionarlo, trascina per spostarlo.";
    this.palette.appendChild(hint);
  }

  // ---------- Barra freccia ----------
  _wireArrowBar() {
    this.abType = this.arrowBar.querySelector(".se-ab-type");
    this.abColor = this.arrowBar.querySelector(".se-ab-color");
    this.abStyle = this.arrowBar.querySelector(".se-ab-style");
    this.abStartCap = this.arrowBar.querySelector(".se-ab-startcap");
    this.abEndCap = this.arrowBar.querySelector(".se-ab-endcap");
    this.abCapScale = this.arrowBar.querySelector(".se-ab-capscale");
    this.abLabel = this.arrowBar.querySelector(".se-ab-label");

    this.abType.addEventListener("change", () => {
      const target = this._arrowTarget();
      if (!target) return;
      const val = this.abType.value;
      if (val === FREE) {
        if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
        else { delete target.typeKey; }   // freccia selezionata: diventa libera
      } else {
        const t = this.getArrowTypes().find(x => x.key === val);
        if (t) {
          target.color = t.color; target.style = t.style;
          target.startCap = t.startCap || "none"; target.endCap = t.endCap || "arrow";
          target.capScale = clampCapScale(t.capScale);
          target.typeKey = t.key;
          if (target.mode !== undefined) target.mode = "type";
        }
      }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abColor.addEventListener("input", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.color = this.abColor.value;
      if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
      else { delete target.typeKey; }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abStyle.addEventListener("change", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.style = this.abStyle.value;
      if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
      else { delete target.typeKey; }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abStartCap.addEventListener("change", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.startCap = this.abStartCap.value;
      if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
      else { delete target.typeKey; }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abEndCap.addEventListener("change", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.endCap = this.abEndCap.value;
      if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
      else { delete target.typeKey; }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abCapScale.addEventListener("input", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.capScale = clampCapScale(this.abCapScale.value);
      if (target.mode !== undefined) { target.mode = "free"; target.typeKey = FREE; }
      else { delete target.typeKey; }
      this._syncArrowBar();
      if (this._selectedArrow()) this.render();
    });
    this.abLabel.addEventListener("input", () => {
      const target = this._arrowTarget(); if (!target) return;
      target.label = this.abLabel.value;
      if (this._selectedArrow()) this.render();
    });
  }

  // Oggetto che la barra sta editando: la freccia selezionata, oppure i settaggi per la prossima.
  _arrowTarget() {
    const sel = this._selectedArrow();
    if (sel) return sel;
    if (this.tool === "arrow") return this.arrowSettings;
    return null;
  }
  _selectedArrow() {
    const el = this._sel();
    return el && el.kind === "arrow" ? el : null;
  }

  _syncArrowBar() {
    const target = this._arrowTarget();
    if (!target) { this.arrowBar.classList.add("se-hidden"); return; }
    this.arrowBar.classList.remove("se-hidden");

    // opzioni tipo
    const types = this.getArrowTypes();
    const opts = [`<option value="${FREE}">Libero (colore+stile)</option>`]
      .concat(types.map(t => `<option value="${escapeAttr(t.key)}">${escapeHtml(t.name)}</option>`));
    this.abType.innerHTML = opts.join("");

    let matched;
    if (target.mode === undefined) {
      // freccia selezionata: usa la typeKey se ancora valida, altrimenti prova il match per colore
      matched = (target.typeKey && types.some(t => t.key === target.typeKey)) ? target.typeKey : this._matchesType(target);
    } else {
      matched = (target.mode === "type") ? target.typeKey : null;
    }
    this.abType.value = (target.mode === "free") ? FREE : (matched || FREE);

    const matchedType = matched ? types.find(t => t.key === matched) : null;
    this.abColor.value = toHexColor(matchedType ? matchedType.color : target.color);
    this.abStyle.value = (matchedType ? matchedType.style : target.style) || "solido";
    this.abStartCap.value = (matchedType ? matchedType.startCap : target.startCap) || "none";
    this.abEndCap.value = (matchedType ? matchedType.endCap : target.endCap) || "arrow";
    this.abCapScale.value = clampCapScale(matchedType ? matchedType.capScale : target.capScale);
    this.abLabel.value = target.label || "";

    const free = this.abType.value === FREE;
    this.abColor.disabled = !free;
    this.abStyle.disabled = !free;
    this.abStartCap.disabled = !free;
    this.abEndCap.disabled = !free;
    this.abCapScale.disabled = !free;
  }
  _matchesType(arrow) {
    const t = this.getArrowTypes().find(x => x.color && arrow.color &&
      x.color.toLowerCase() === String(arrow.color).toLowerCase() && x.style === arrow.style &&
      (x.startCap || "none") === (arrow.startCap || "none") && (x.endCap || "arrow") === (arrow.endCap || "arrow") &&
      clampCapScale(x.capScale) === clampCapScale(arrow.capScale));
    return t ? t.key : null;
  }

  // ---------- Toolbar ----------
  _wireToolbar() {
    this.toolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      switch (btn.dataset.act) {
        case "snap": this.snap = !this.snap; this._updateToggles(); break;
        case "grid": this.showGrid = !this.showGrid; this._updateToggles(); this.render(); break;
        case "rotL": this._rotateSelected(-15); break;
        case "rotR": this._rotateSelected(15); break;
        case "bigger": this._scaleSelected(1.15); break;
        case "smaller": this._scaleSelected(1 / 1.15); break;
        case "delete": this._deleteSelected(); break;
        case "undo": this.undo(); break;
        case "clear": this._clearAll(); break;
        case "dropbg": this._dropBackground(); break;
        case "zoomin": this._zoomAtCenter(1.2); break;
        case "zoomout": this._zoomAtCenter(1 / 1.2); break;
        case "zoomfit": this._fitView(); break;
      }
    });
  }
  _updateToggles() {
    const snapBtn = this.toolbar.querySelector('[data-act="snap"]');
    const gridBtn = this.toolbar.querySelector('[data-act="grid"]');
    snapBtn.textContent = this.snap ? "Aggancio: ON" : "Aggancio: OFF";
    snapBtn.classList.toggle("is-on", this.snap);
    gridBtn.textContent = this.showGrid ? "Griglia: ON" : "Griglia: OFF";
    gridBtn.classList.toggle("is-on", this.showGrid);
    this.toolbar.querySelector('[data-act="dropbg"]').classList.toggle("se-hidden", !this.model.background);
  }

  // ---------- Canvas ----------
  _wireCanvas() {
    this.svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.svg.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.svg.addEventListener("pointercancel", () => { this.dragging = null; });
    // zoom con rotellina (attorno al cursore)
    this.svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      this._zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });
    this.svg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.tool = "select"; this.armedKey = null; this.selectedId = null;
        this.renderPalette(); this.render(); this._syncArrowBar();
      } else if ((e.key === "Delete" || e.key === "Backspace") && this.selectedId) {
        e.preventDefault(); this._deleteSelected();
      } else if (e.key.startsWith("Arrow") && this.selectedId) {
        e.preventDefault();
        const el = this._sel(); if (!el) return;
        const step = e.shiftKey ? 10 : 2;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        this._nudge(el, dx, dy);
        this.render();
      }
    });
  }

  // ---------- Zoom / Pan (solo visivo: agisce sul viewBox, non sulle coordinate salvate) ----------
  _applyView() {
    const v = this.view;
    this.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  }
  _clampView() {
    const v = this.view;
    v.w = Math.max(VW / 8, Math.min(VW, v.w));
    v.h = v.w * (VH / VW);
    v.x = Math.max(0, Math.min(VW - v.w, v.x));
    v.y = Math.max(0, Math.min(VH - v.h, v.y));
  }
  _zoomAt(factor, clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const v = this.view;
    const pointX = v.x + px * v.w;
    const pointY = v.y + py * v.h;
    let newW = v.w / factor;
    newW = Math.max(VW / 8, Math.min(VW, newW));
    const newH = newW * (VH / VW);
    v.x = pointX - px * newW;
    v.y = pointY - py * newH;
    v.w = newW; v.h = newH;
    this._clampView();
    this._applyView();
    this._updateZoomLabel();
  }
  _zoomAtCenter(factor) {
    const rect = this.svg.getBoundingClientRect();
    this._zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  _fitView() {
    this.view = { x: 0, y: 0, w: VW, h: VH };
    this._applyView();
    this._updateZoomLabel();
  }
  _isZoomed() { return this.view.w < VW - 0.5; }
  _updateZoomLabel() {
    const btn = this.toolbar && this.toolbar.querySelector('[data-act="zoomfit"]');
    if (btn) btn.textContent = this._isZoomed() ? `Adatta (${Math.round(VW / this.view.w * 100)}%)` : "Adatta";
  }

  _nudge(el, dx, dy) {
    if (el.kind === "arrow") { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy; }
    else { el.x += dx; el.y += dy; }
  }

  _toSvgPoint(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  _snap(v) { return this.snap ? Math.round(v / GRID) * GRID : Math.round(v); }

  _onPointerDown(e) {
    const p = this._toSvgPoint(e);
    const handle = e.target.closest("circle.rep-handle");
    const arrowG = e.target.closest("g.rep-arrow");
    const symG = e.target.closest("g.rep-el");

    // 1) trascinamento estremo freccia
    if (handle) {
      this.selectedId = handle.dataset.id;
      this._pushUndo();
      this.dragging = { type: "arrowEnd", id: handle.dataset.id, end: handle.dataset.end };
      this.svg.setPointerCapture(e.pointerId);
      this.render();
      return;
    }

    // 2) disegno nuova freccia
    if (this.tool === "arrow" && !arrowG && !symG) {
      this._pushUndo();
      const s = this.arrowSettings;
      let color = s.color, style = s.style, startCap = s.startCap || "none", endCap = s.endCap || "arrow", capScale = clampCapScale(s.capScale);
      if (s.mode === "type") {
        const t = this.getArrowTypes().find(x => x.key === s.typeKey);
        if (t) { color = t.color; style = t.style; startCap = t.startCap || "none"; endCap = t.endCap || "arrow"; capScale = clampCapScale(t.capScale); }
      }
      const x = clamp(this._snap(p.x), 0, VW), y = clamp(this._snap(p.y), 0, VH);
      const arrow = { id: genId(), kind: "arrow", x1: x, y1: y, x2: x, y2: y, color, style, startCap, endCap, capScale, label: s.label || "" };
      if (s.mode === "type" && s.typeKey && s.typeKey !== FREE) arrow.typeKey = s.typeKey;
      this.model.elements.push(arrow);
      this.selectedId = arrow.id;
      this.dragging = { type: "arrowEnd", id: arrow.id, end: "2", isNew: true };
      this.svg.setPointerCapture(e.pointerId);
      this.render(); this._syncArrowBar();
      return;
    }

    // 3) selezione/sposta freccia
    if (arrowG) {
      const a = this.model.elements.find(x => x.id === arrowG.dataset.id);
      if (a) {
        this.tool = "select"; this.armedKey = null;
        this.selectedId = a.id;
        this._pushUndo();
        this.dragging = { type: "arrowMove", id: a.id, ox: p.x, oy: p.y };
        this.svg.setPointerCapture(e.pointerId);
        this.renderPalette(); this.render(); this._syncArrowBar();
      }
      return;
    }

    // 4) posiziona materiale
    if (this.tool === "symbol" && this.armedKey && !symG) {
      this._pushUndo();
      const el = { id: genId(), kind: "symbol", key: this.armedKey, x: clamp(this._snap(p.x), 0, VW), y: clamp(this._snap(p.y), 0, VH), rot: 0, scale: 1 };
      this.model.elements.push(el);
      this.selectedId = el.id;
      this.render(); this._syncArrowBar();
      return;
    }

    // 5) selezione/sposta materiale
    if (symG) {
      this.tool = "select"; this.armedKey = null;
      this.selectedId = symG.dataset.id;
      const el = this._sel();
      if (el) {
        this._pushUndo();
        this.dragging = { type: "symbolMove", id: el.id, offX: p.x - el.x, offY: p.y - el.y };
        this.svg.setPointerCapture(e.pointerId);
        this.renderPalette(); this.render(); this._syncArrowBar();
      }
      return;
    }

    // 6) vuoto: avvia pan (se non si trascina, sarà una deselezione)
    this.dragging = { type: "pan", startCX: e.clientX, startCY: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    this.svg.setPointerCapture(e.pointerId);
  }

  _onPointerMove(e) {
    if (!this.dragging) return;
    if (this.dragging.type === "pan") {
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width) return;
      const scale = this.view.w / rect.width;
      const dx = (e.clientX - this.dragging.startCX) * scale;
      const dy = (e.clientY - this.dragging.startCY) * scale;
      if (Math.abs(e.clientX - this.dragging.startCX) > 3 || Math.abs(e.clientY - this.dragging.startCY) > 3) this.dragging.moved = true;
      this.view.x = this.dragging.vx - dx;
      this.view.y = this.dragging.vy - dy;
      this._clampView();
      this._applyView();
      return;
    }
    const p = this._toSvgPoint(e);
    const el = this.model.elements.find(x => x.id === this.dragging.id);
    if (!el) return;
    if (this.dragging.type === "symbolMove") {
      el.x = clamp(this._snap(p.x - this.dragging.offX), 0, VW);
      el.y = clamp(this._snap(p.y - this.dragging.offY), 0, VH);
    } else if (this.dragging.type === "arrowEnd") {
      const x = clamp(this._snap(p.x), 0, VW), y = clamp(this._snap(p.y), 0, VH);
      if (this.dragging.end === "1") { el.x1 = x; el.y1 = y; } else { el.x2 = x; el.y2 = y; }
    } else if (this.dragging.type === "arrowMove") {
      const dx = p.x - this.dragging.ox, dy = p.y - this.dragging.oy;
      el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy;
      this.dragging.ox = p.x; this.dragging.oy = p.y;
      // aggancio: snap del primo estremo
      if (this.snap) {
        const sx = this._snap(el.x1) - el.x1, sy = this._snap(el.y1) - el.y1;
        el.x1 += sx; el.y1 += sy; el.x2 += sx; el.y2 += sy;
      }
      // mantieni la freccia dentro il campo
      el.x1 = clamp(el.x1, 0, VW); el.y1 = clamp(el.y1, 0, VH);
      el.x2 = clamp(el.x2, 0, VW); el.y2 = clamp(el.y2, 0, VH);
    }
    this.render();
  }

  _onPointerUp(e) {
    if (!this.dragging) return;
    try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
    if (this.dragging.type === "pan") {
      const wasClick = !this.dragging.moved;
      this.dragging = null;
      if (wasClick && this.selectedId) { this.selectedId = null; this.render(); this._syncArrowBar(); }
      return;
    }
    const el = this.model.elements.find(x => x.id === this.dragging.id);
    // freccia troppo corta -> annulla
    if (el && el.kind === "arrow" && this.dragging.isNew) {
      const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
      if (len < MIN_ARROW) {
        this.model.elements = this.model.elements.filter(x => x.id !== el.id);
        this.selectedId = null;
        this.undoStack.pop();
      }
    }
    this.dragging = null;
    this.render(); this._syncArrowBar();
  }

  // ---------- Mutazioni ----------
  _sel() { return this.model.elements.find(x => x.id === this.selectedId); }
  _rotateSelected(deg) { const el = this._sel(); if (!el || el.kind !== "symbol") return; this._pushUndo(); el.rot = (el.rot + deg) % 360; this.render(); }
  _scaleSelected(f) { const el = this._sel(); if (!el || el.kind !== "symbol") return; this._pushUndo(); el.scale = clamp(el.scale * f, 0.4, 3); this.render(); }
  _deleteSelected() {
    if (!this.selectedId) return;
    this._pushUndo();
    this.model.elements = this.model.elements.filter(x => x.id !== this.selectedId);
    this.selectedId = null;
    this.render(); this._syncArrowBar();
  }
  _clearAll() {
    if (this.model.elements.length === 0 && !this.model.background) return;
    if (!confirm("Svuotare tutto lo schema?")) return;
    this._pushUndo();
    this.model.elements = []; this.model.background = null; this.selectedId = null;
    this.render(); this._updateToggles(); this._syncArrowBar();
  }
  _dropBackground() {
    if (!this.model.background) return;
    if (!confirm("Rimuovere lo sfondo importato? Gli elementi aggiunti restano.")) return;
    this._pushUndo();
    this.model.background = null;
    this.render(); this._updateToggles();
  }
  _pushUndo() {
    this.undoStack.push(JSON.stringify(this.model));
    if (this.undoStack.length > 40) this.undoStack.shift();
  }
  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    try { this.model = JSON.parse(prev); } catch (_) {}
    this.selectedId = null;
    this.render(); this._updateToggles(); this._syncArrowBar();
  }

  // ---------- Rendering ----------
  _symbolFor(key) {
    const m = this.getMaterials().find(x => x.key === key);
    return m ? placeSymbol(m.svgSymbol) : removedSymbolPlaceholder(key);
  }
  _defs() { return defsMarkup(this.model.elements, this.getArrowTypes()); }
  _elementsMarkup(forExport) {
    return this.model.elements.map(el => {
      if (el.kind === "arrow") {
        const { dataStyle, typeAttr, title, visual } = arrowResolvedParts(el, this.getArrowTypes());
        if (forExport) return `<g class="rep-arrow" data-style="${escapeAttr(dataStyle)}"${typeAttr}>${title}${visual}</g>`;
        const sel = el.id === this.selectedId ? " is-selected" : "";
        return `<g class="rep-arrow${sel}" data-id="${escapeAttr(el.id)}"${typeAttr}>
            <line class="rep-hit" x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="transparent" stroke-width="20"/>
            ${title}${visual}
          </g>`;
      }
      // symbol: simbolo risolto a runtime dalla customLists e posizionato (placeSymbol)
      const inner = this._symbolFor(el.key);
      if (forExport) return `<g class="rep-el" data-key="${escapeAttr(el.key)}" data-material-key="${escapeAttr(el.key)}" transform="${symTransform(el)}">${inner}</g>`;
      const sel = el.id === this.selectedId ? " is-selected" : "";
      return `<g class="rep-el${sel}" data-id="${escapeAttr(el.id)}" data-key="${escapeAttr(el.key)}" data-material-key="${escapeAttr(el.key)}" transform="${symTransform(el)}">${inner}</g>`;
    }).join("");
  }
  _handlesMarkup() {
    const el = this._sel();
    if (!el) return "";
    if (el.kind === "arrow") {
      return `<g pointer-events="all">
        <circle class="rep-handle" data-id="${escapeAttr(el.id)}" data-end="1" cx="${el.x1}" cy="${el.y1}" r="9" fill="#fff" stroke="#f5b301" stroke-width="3"/>
        <circle class="rep-handle" data-id="${escapeAttr(el.id)}" data-end="2" cx="${el.x2}" cy="${el.y2}" r="9" fill="#f5b301" stroke="#fff" stroke-width="3"/>
      </g>`;
    }
    return `<g id="rep-selection" transform="translate(${el.x} ${el.y})" pointer-events="none">
      <circle r="26" fill="none" stroke="#f5b301" stroke-width="2" stroke-dasharray="5 4"/></g>`;
  }
  render() {
    const base = this.model.background ? `<g class="rep-bg">${nestForeign(this.model.background)}</g>` : pitchMarkup();
    const grid = this.showGrid ? gridMarkup() : "";
    // Gli elementi (simboli/frecce) sono clippati ai confini del campo: ciò che finisce
    // fuori dal rettangolo verde non è visibile né cliccabile. Gli handle di selezione
    // restano fuori dal clip per restare sempre manovrabili.
    this.svg.innerHTML = this._defs() + base + grid
      + `<g clip-path="url(#repFieldClip)">${this._elementsMarkup(false)}</g>`
      + this._handlesMarkup();
    this._applyView();
  }

  // ---------- API pubblica ----------
  loadFromSvg(svgString) {
    this.undoStack = []; this.selectedId = null; this.tool = "select"; this.armedKey = null;
    this.model = parseEditorSvg(svgString);
    this._fitView();
    this.renderPalette(); this.render(); this._updateToggles(); this._syncArrowBar();
  }
  reset() {
    this.model = { background: null, elements: [] };
    this.selectedId = null; this.tool = "select"; this.armedKey = null; this.undoStack = [];
    this._fitView();
    this.renderPalette(); this.render(); this._updateToggles(); this._syncArrowBar();
  }
  refreshMaterials() {
    this.arrowSettings = this._reconcileArrowSettings();
    this.renderPalette(); this.render(); this._syncArrowBar();
  }
  _reconcileArrowSettings() {
    const s = this.arrowSettings;
    if (s.mode === "type" && !this.getArrowTypes().find(t => t.key === s.typeKey)) return this._defaultArrowSettings();
    return s;
  }

  toSvgString() {
    const base = this.model.background ? `<g class="rep-bg">${nestForeign(this.model.background)}</g>` : pitchMarkup();
    const els = this._elementsMarkup(true);
    const meta = b64encode(JSON.stringify({ v: 1, model: this.model }));
    const metadata = `<metadata data-rep="1">${meta}</metadata>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">${metadata}${this._defs()}${base}${els}</svg>`;
  }
  hasContent() { return this.model.elements.length > 0 || !!this.model.background; }
}

// ---------- Helpers ----------
function symTransform(el) { return `translate(${el.x} ${el.y}) rotate(${el.rot}) scale(${el.scale})`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function toHexColor(c) {
  if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (typeof c === "string" && /^#[0-9a-fA-F]{3}$/.test(c)) {
    return "#" + c.slice(1).split("").map(ch => ch + ch).join("");
  }
  return "#f5b301";
}
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str))); }

function nestForeign(foreignSvgString) {
  let vb = "0 0 800 600";
  const m = foreignSvgString.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (m) vb = m[1];
  const inner = foreignSvgString.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  return `<svg x="0" y="0" width="${VW}" height="${VH}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

// Normalizza un elemento del modello (retrocompatibilità: senza "kind").
function normalizeEl(el) {
  if (!el || typeof el !== "object") return null;
  if (el.kind === "arrow" || (el.x1 !== undefined && el.x2 !== undefined)) {
    const cap = (v, fallback) => ARROW_CAP_KEYS.includes(v) ? v : fallback;
    const out = {
      id: el.id || genId(), kind: "arrow",
      x1: num(el.x1), y1: num(el.y1), x2: num(el.x2), y2: num(el.y2),
      color: typeof el.color === "string" ? el.color : "#f5b301",
      style: typeof el.style === "string" ? el.style : "solido",
      // fallback "none"/"arrow"/1: comportamento implicito delle frecce create prima di queste funzionalità
      startCap: cap(el.startCap, "none"),
      endCap: cap(el.endCap, "arrow"),
      capScale: clampCapScale(el.capScale),
      label: typeof el.label === "string" ? el.label : ""
    };
    if (typeof el.typeKey === "string" && el.typeKey && el.typeKey !== FREE) out.typeKey = el.typeKey;
    return out;
  }
  return {
    id: el.id || genId(), kind: "symbol", key: el.key,
    x: num(el.x), y: num(el.y), rot: num(el.rot), scale: el.scale ? num(el.scale) : 1
  };
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Parsing di una stringa SVG -> modello editor (con metadati = lossless; senza = sfondo importato).
export function parseEditorSvg(svgString) {
  if (!svgString || typeof svgString !== "string") return { background: null, elements: [] };
  try {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    const err = doc.querySelector("parsererror");
    const metaEl = doc.querySelector('metadata[data-rep="1"]');
    if (!err && metaEl && metaEl.textContent) {
      const json = JSON.parse(b64decode(metaEl.textContent.trim()));
      if (json && json.model) {
        return {
          background: json.model.background || null,
          elements: (Array.isArray(json.model.elements) ? json.model.elements : []).map(normalizeEl).filter(Boolean)
        };
      }
    }
  } catch (_) { /* fall through */ }
  return { background: svgString, elements: [] };
}

export function svgPreviewMarkup(svgString) { return svgString || ""; }

// Rendering COMPOSITO a runtime: legge il modello dai metadati e ridisegna gli elementi
// risolvendo i simboli materiale CORRENTI dalla customLists. Non altera mai l'SVG salvato.
// Gli SVG senza metadati editor (es. sfondi importati/legacy) sono restituiti invariati.
export function composeExerciseSvg(svgString, materials, arrowTypes) {
  if (!svgString || typeof svgString !== "string") return svgString || "";
  if (svgString.indexOf('data-rep="1"') === -1) return svgString;
  let model;
  try { model = parseEditorSvg(svgString); } catch (_) { return svgString; }
  const base = model.background ? `<g class="rep-bg">${nestForeign(model.background)}</g>` : pitchMarkup();
  const els = (model.elements || []).map(el => {
    if (el.kind === "arrow") {
      const { dataStyle, typeAttr, title, visual } = arrowResolvedParts(el, arrowTypes || []);
      return `<g class="rep-arrow" data-style="${escapeAttr(dataStyle)}"${typeAttr}>${title}${visual}</g>`;
    }
    const m = (materials || []).find(x => x.key === el.key);
    const inner = m ? placeSymbol(m.svgSymbol) : removedSymbolPlaceholder(el.key);
    return `<g class="rep-el" data-key="${escapeAttr(el.key)}" data-material-key="${escapeAttr(el.key)}" transform="${symTransform(el)}">${inner}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">${defsMarkup(model.elements, arrowTypes)}${base}<g clip-path="url(#repFieldClip)">${els}</g></svg>`;
}
