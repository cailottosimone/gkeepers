// tagPicker.js
// Selettore di tag con ricerca, riutilizzabile (form esercizio e filtri).
// - input di testo che filtra in tempo reale (case-insensitive, match parziale)
// - menu a tendina cliccabile con le opzioni filtrate (escluse quelle già scelte)
// - tag rimovibili con "x"
// - scala bene con 100+ opzioni (mostra un sottoinsieme dei risultati)
// API: new TagPicker(container, { getOptions, selected, onChange, placeholder })

const MAX_SHOWN = 80;

export class TagPicker {
  constructor(container, opts = {}) {
    this.container = container;
    this.getOptions = opts.getOptions || (() => []);
    this.selected = [...(opts.selected || [])];
    this.onChange = opts.onChange || (() => {});
    this.placeholder = opts.placeholder || "Cerca e aggiungi…";
    this.open = false;
    this.activeIndex = 0;
    this._build();
  }

  _build() {
    this.container.classList.add("tagpicker");
    this.container.innerHTML = `
      <div class="tp-control">
        <span class="tp-tags"></span>
        <input type="text" class="tp-input" placeholder="${escapeAttr(this.placeholder)}" autocomplete="off">
      </div>
      <div class="tp-menu" hidden></div>
    `;
    this.control = this.container.querySelector(".tp-control");
    this.tagsEl = this.container.querySelector(".tp-tags");
    this.input = this.container.querySelector(".tp-input");
    this.menu = this.container.querySelector(".tp-menu");

    this.input.addEventListener("focus", () => this._openMenu());
    this.input.addEventListener("input", () => { this.activeIndex = 0; this._openMenu(); });
    this.input.addEventListener("keydown", (e) => this._onKey(e));
    this.control.addEventListener("click", (e) => { if (e.target === this.control || e.target === this.tagsEl) this.input.focus(); });
    // chiusura su click esterno
    this._onDocClick = (e) => { if (!this.container.contains(e.target)) this._closeMenu(); };
    document.addEventListener("click", this._onDocClick);

    this._renderTags();
  }

  _filtered() {
    const q = this.input.value.trim().toLowerCase();
    const sel = new Set(this.selected);
    return this.getOptions()
      .filter(o => !sel.has(o))
      .filter(o => !q || o.toLowerCase().includes(q));
  }

  _openMenu() {
    this.open = true;
    this._renderMenu();
  }
  _closeMenu() {
    this.open = false;
    this.menu.hidden = true;
  }

  _renderMenu() {
    if (!this.open) { this.menu.hidden = true; return; }
    const all = this._filtered();
    const shown = all.slice(0, MAX_SHOWN);
    if (!shown.length) {
      this.menu.innerHTML = `<div class="tp-empty">${this.input.value.trim() ? "Nessuna opzione corrispondente" : "Nessuna opzione disponibile"}</div>`;
      this.menu.hidden = false;
      return;
    }
    if (this.activeIndex >= shown.length) this.activeIndex = 0;
    this.menu.innerHTML = shown.map((o, i) =>
      `<button type="button" class="tp-opt${i === this.activeIndex ? ' is-active' : ''}" data-val="${escapeAttr(o)}">${escapeHtml(o)}</button>`
    ).join("") + (all.length > shown.length ? `<div class="tp-more">…altre ${all.length - shown.length}, affina la ricerca</div>` : "");
    this.menu.hidden = false;
    this.menu.querySelectorAll(".tp-opt").forEach(btn =>
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); this.add(btn.dataset.val); }));
  }

  _onKey(e) {
    const shown = this._filtered().slice(0, MAX_SHOWN);
    if (e.key === "ArrowDown") { e.preventDefault(); this.activeIndex = Math.min(this.activeIndex + 1, shown.length - 1); this._renderMenu(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.activeIndex = Math.max(this.activeIndex - 1, 0); this._renderMenu(); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[this.activeIndex]) this.add(shown[this.activeIndex]); }
    else if (e.key === "Escape") { this.input.value = ""; this._closeMenu(); }
    else if (e.key === "Backspace" && !this.input.value && this.selected.length) { this.remove(this.selected[this.selected.length - 1]); }
  }

  add(value) {
    if (!value || this.selected.includes(value)) return;
    this.selected.push(value);
    this.input.value = "";
    this.activeIndex = 0;
    this._renderTags();
    this._renderMenu();
    this.onChange([...this.selected]);
    this.input.focus();
  }

  remove(value) {
    this.selected = this.selected.filter(v => v !== value);
    this._renderTags();
    if (this.open) this._renderMenu();
    this.onChange([...this.selected]);
  }

  _renderTags() {
    this.tagsEl.innerHTML = this.selected.map(v =>
      `<span class="tp-tag">${escapeHtml(v)}<button type="button" class="tp-tag-x" data-val="${escapeAttr(v)}" title="Rimuovi" aria-label="Rimuovi ${escapeAttr(v)}">×</button></span>`
    ).join("");
    this.tagsEl.querySelectorAll(".tp-tag-x").forEach(b =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this.remove(b.dataset.val); }));
  }

  getSelected() { return [...this.selected]; }

  destroy() { document.removeEventListener("click", this._onDocClick); }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
