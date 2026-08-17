// materialFilter.js
// Filtro materiali con operatore di confronto + quantità, riusabile (indice e selettore seduta).
// Ogni voce selezionata: { key, op, qty } con op in { eq, gte, gt, lte, lt }.
// Default all'aggiunta: op "gte", qty 1 (identico al vecchio "materiale presente").
// API: new MaterialQtyPicker(container, { getMaterials, selected, onChange, placeholder })
//   getMaterials: () => [{ key, label }]
//   onChange: (Array<{key,op,qty}>) => void

const MAX_SHOWN = 80;
export const MAT_OPS = [
  { code: "eq",  sym: "=", title: "esattamente" },
  { code: "gte", sym: "≥", title: "almeno" },
  { code: "gt",  sym: ">", title: "più di" },
  { code: "lte", sym: "≤", title: "al massimo" },
  { code: "lt",  sym: "<", title: "meno di" }
];
const OP_CODES = new Set(MAT_OPS.map(o => o.code));

// Verifica se una quantità soddisfa (op, N). Caso speciale: gte con N=0 = "presenza"
// (materiale presente in qualsiasi quantità), non "tutti".
export function materialQtyMatches(op, n, qty) {
  const N = Number.isFinite(n) ? n : 0;
  const Q = Number.isFinite(qty) ? qty : 0;
  if (op === "gte" && N === 0) return Q >= 1;
  switch (op) {
    case "eq":  return Q === N;
    case "gte": return Q >= N;
    case "gt":  return Q > N;
    case "lte": return Q <= N;
    case "lt":  return Q < N;
    default:    return Q >= N;
  }
}

export class MaterialQtyPicker {
  constructor(container, opts = {}) {
    this.container = container;
    this.getMaterials = opts.getMaterials || (() => []);
    this.selected = (opts.selected || []).map(e => ({
      key: e.key,
      op: OP_CODES.has(e.op) ? e.op : "gte",
      qty: Number.isFinite(e.qty) ? Math.max(0, Math.trunc(e.qty)) : 1
    }));
    this.onChange = opts.onChange || (() => {});
    this.placeholder = opts.placeholder || "Aggiungi materiale…";
    this.open = false;
    this.activeIndex = 0;
    this._build();
  }

  _labelFor(key) { const m = this.getMaterials().find(x => x.key === key); return m ? m.label : key; }

  _build() {
    this.container.classList.add("matfilter");
    this.container.innerHTML = `
      <div class="mf-rows"></div>
      <div class="tp-control mf-control">
        <input type="text" class="tp-input mf-input" placeholder="${escapeAttr(this.placeholder)}" autocomplete="off">
      </div>
      <div class="tp-menu mf-menu" hidden></div>
    `;
    this.rowsEl = this.container.querySelector(".mf-rows");
    this.control = this.container.querySelector(".mf-control");
    this.input = this.container.querySelector(".mf-input");
    this.menu = this.container.querySelector(".mf-menu");

    this.input.addEventListener("focus", () => this._openMenu());
    this.input.addEventListener("input", () => { this.activeIndex = 0; this._openMenu(); });
    this.input.addEventListener("keydown", (e) => this._onKey(e));
    this.control.addEventListener("click", (e) => { if (e.target === this.control) this.input.focus(); });
    this._onDocClick = (e) => { if (!this.container.contains(e.target)) this._closeMenu(); };
    document.addEventListener("click", this._onDocClick);

    this._renderRows();
  }

  _available() {
    const sel = new Set(this.selected.map(e => e.key));
    const q = this.input.value.trim().toLowerCase();
    return this.getMaterials()
      .filter(m => m && !sel.has(m.key))
      .filter(m => !q || (m.label || "").toLowerCase().includes(q));
  }

  _openMenu() { this.open = true; this._renderMenu(); }
  _closeMenu() { this.open = false; this.menu.hidden = true; }

  _renderMenu() {
    if (!this.open) { this.menu.hidden = true; return; }
    const all = this._available();
    const shown = all.slice(0, MAX_SHOWN);
    if (!shown.length) {
      this.menu.innerHTML = `<div class="tp-empty">${this.input.value.trim() ? "Nessun materiale corrispondente" : "Nessun materiale disponibile"}</div>`;
      this.menu.hidden = false;
      return;
    }
    if (this.activeIndex >= shown.length) this.activeIndex = 0;
    this.menu.innerHTML = shown.map((m, i) =>
      `<button type="button" class="tp-opt${i === this.activeIndex ? ' is-active' : ''}" data-key="${escapeAttr(m.key)}">${escapeHtml(m.label)}</button>`
    ).join("") + (all.length > shown.length ? `<div class="tp-more">…altri ${all.length - shown.length}, affina la ricerca</div>` : "");
    this.menu.hidden = false;
    this.menu.querySelectorAll(".tp-opt").forEach(btn =>
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); this.add(btn.dataset.key); }));
  }

  _onKey(e) {
    const shown = this._available().slice(0, MAX_SHOWN);
    if (e.key === "ArrowDown") { e.preventDefault(); this.activeIndex = Math.min(this.activeIndex + 1, shown.length - 1); this._renderMenu(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.activeIndex = Math.max(this.activeIndex - 1, 0); this._renderMenu(); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[this.activeIndex]) this.add(shown[this.activeIndex].key); }
    else if (e.key === "Escape") { this.input.value = ""; this._closeMenu(); }
  }

  add(key) {
    if (!key || this.selected.some(e => e.key === key)) return;
    this.selected.push({ key, op: "gte", qty: 1 });   // default: ≥ 1 = "presente"
    this.input.value = "";
    this.activeIndex = 0;
    this._renderRows();
    this._renderMenu();
    this._emit();
    this.input.focus();
  }
  remove(key) {
    this.selected = this.selected.filter(e => e.key !== key);
    this._renderRows();
    if (this.open) this._renderMenu();
    this._emit();
  }
  _setOp(key, op) {
    const e = this.selected.find(x => x.key === key);
    if (e && OP_CODES.has(op)) { e.op = op; this._emit(); }
  }
  _setQty(key, val) {
    const e = this.selected.find(x => x.key === key);
    if (!e) return;
    let n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    e.qty = n;
    this._emit();
  }

  _renderRows() {
    this.rowsEl.innerHTML = this.selected.map(e => {
      const opts = MAT_OPS.map(o => `<option value="${o.code}" ${o.code === e.op ? "selected" : ""}>${o.sym}</option>`).join("");
      return `<div class="mf-row" data-key="${escapeAttr(e.key)}">
          <span class="mf-name" title="${escapeAttr(this._labelFor(e.key))}">${escapeHtml(this._labelFor(e.key))}</span>
          <select class="mf-op" aria-label="Operatore" title="Operatore di confronto">${opts}</select>
          <input type="number" class="mf-qty" min="0" step="1" inputmode="numeric" value="${e.qty}" aria-label="Quantità">
          <button type="button" class="mf-x" data-key="${escapeAttr(e.key)}" title="Rimuovi" aria-label="Rimuovi">×</button>
        </div>`;
    }).join("");
    this.rowsEl.querySelectorAll(".mf-row").forEach(row => {
      const key = row.dataset.key;
      row.querySelector(".mf-op").addEventListener("change", (ev) => this._setOp(key, ev.target.value));
      const qtyInput = row.querySelector(".mf-qty");
      qtyInput.addEventListener("input", (ev) => this._setQty(key, ev.target.value));
      qtyInput.addEventListener("blur", (ev) => { if (ev.target.value === "" || parseInt(ev.target.value, 10) < 0) ev.target.value = "0"; });
      row.querySelector(".mf-x").addEventListener("click", (ev) => { ev.stopPropagation(); this.remove(key); });
    });
  }

  _emit() { this.onChange(this.selected.map(e => ({ key: e.key, op: e.op, qty: e.qty }))); }
  getSelected() { return this.selected.map(e => ({ ...e })); }
  destroy() { document.removeEventListener("click", this._onDocClick); }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
