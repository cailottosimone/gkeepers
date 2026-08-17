// defaults.js
// Liste precaricate e simboli SVG dei materiali di default.
// I materiali di default hanno un simbolo SVG "bloccato" (isDefault:true),
// non modificabile né eliminabile. I materiali custom ricevono un simbolo
// generico con etichetta in fase di creazione (vedi settings.js).

export const SCHEMA_VERSION = "2.4";

// --- Simboli SVG dei materiali (disegnati centrati attorno a 0,0, footprint ~40x40) ---
// Vengono usati sia nella palette dell'editor sia nel canvas.
export const MATERIAL_SYMBOLS = {
  porta: `<g>
    <rect x="-34" y="-8" width="68" height="16" fill="none" stroke="#f4f4f0" stroke-width="3"/>
    <path d="M-34 -8 L-28 -2 M-22 -8 L-16 -2 M-10 -8 L-4 -2 M2 -8 L8 -2 M14 -8 L20 -2 M26 -8 L32 -2
             M-34 0 L-28 6 M-22 0 L-16 6 M-10 0 L-4 6 M2 0 L8 6 M14 0 L20 6 M26 0 L32 6"
          stroke="#f4f4f0" stroke-width="1" opacity="0.6"/>
    <circle cx="-34" cy="0" r="3" fill="#f4f4f0"/>
    <circle cx="34" cy="0" r="3" fill="#f4f4f0"/>
  </g>`,

  portiere: `<g>
    <circle cx="0" cy="0" r="14" fill="#f5b301" stroke="#6b4e00" stroke-width="2.5"/>
    <text x="0" y="5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="#3a2c00">P</text>
  </g>`,

  giocatore: `<g>
    <circle cx="0" cy="0" r="13" fill="#1f6f54" stroke="#0d3d2c" stroke-width="2.5"/>
    <text x="0" y="5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#eafff5">G</text>
  </g>`,

  pallone: `<g>
    <circle cx="0" cy="0" r="8" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
    <path d="M0 -8 L4 -2 L2 5 L-2 5 L-4 -2 Z" fill="#222"/>
  </g>`,

  cono: `<g>
    <path d="M0 -15 L11 12 L-11 12 Z" fill="#ff6b1a" stroke="#a83d00" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-7 0 L7 0" stroke="#fff" stroke-width="2.5"/>
  </g>`,

  cinesino: `<g>
    <ellipse cx="0" cy="0" rx="13" ry="6" fill="none" stroke="#ff6b1a" stroke-width="4"/>
    <ellipse cx="0" cy="0" rx="6" ry="2.6" fill="#ff6b1a"/>
  </g>`,

  scaletta: `<g>
    <rect x="-9" y="-26" width="18" height="52" fill="none" stroke="#f4f4f0" stroke-width="2.5"/>
    <line x1="-9" y1="-15" x2="9" y2="-15" stroke="#f4f4f0" stroke-width="2.5"/>
    <line x1="-9" y1="-4" x2="9" y2="-4" stroke="#f4f4f0" stroke-width="2.5"/>
    <line x1="-9" y1="7" x2="9" y2="7" stroke="#f4f4f0" stroke-width="2.5"/>
    <line x1="-9" y1="18" x2="9" y2="18" stroke="#f4f4f0" stroke-width="2.5"/>
  </g>`,

  ostacolo_basso: `<g>
    <line x1="-15" y1="6" x2="15" y2="6" stroke="#e63946" stroke-width="4"/>
    <line x1="-13" y1="6" x2="-15" y2="13" stroke="#9a1c25" stroke-width="3"/>
    <line x1="13" y1="6" x2="15" y2="13" stroke="#9a1c25" stroke-width="3"/>
  </g>`,

  ostacolo_alto: `<g>
    <line x1="-15" y1="-10" x2="15" y2="-10" stroke="#e63946" stroke-width="4"/>
    <line x1="-15" y1="-2" x2="15" y2="-2" stroke="#e63946" stroke-width="3" opacity="0.7"/>
    <line x1="-14" y1="-10" x2="-15" y2="13" stroke="#9a1c25" stroke-width="3"/>
    <line x1="14" y1="-10" x2="15" y2="13" stroke="#9a1c25" stroke-width="3"/>
  </g>`,

  paletto: `<g>
    <circle cx="0" cy="0" r="9" fill="none" stroke="#2b7de9" stroke-width="3"/>
    <circle cx="0" cy="0" r="3" fill="#2b7de9"/>
  </g>`
};

// Simbolo generico per i materiali custom: riquadro con sigla.
// shape: "square" | "horizontal" | "vertical" — risolve oggetti lunghi e stretti.
export const GENERIC_SHAPES = {
  square:     { w: 26, h: 26, fs: 11 },
  horizontal: { w: 42, h: 15, fs: 10 },
  vertical:   { w: 15, h: 42, fs: 9 }
};
export function genericMaterialSymbol(label, shape = "square") {
  let s;
  if (shape && typeof shape === "object" && Number.isFinite(shape.w) && Number.isFinite(shape.h)) {
    const w = Math.max(8, Math.min(80, Math.round(shape.w)));
    const h = Math.max(8, Math.min(80, Math.round(shape.h)));
    const fs = Math.max(7, Math.min(15, Math.round(Math.min(w, h) * 0.45)));
    s = { w, h, fs };
  } else {
    s = GENERIC_SHAPES[shape] || GENERIC_SHAPES.square;
  }
  const max = s.h > s.w * 1.5 ? 2 : 3;
  const short = (label || "?").trim().slice(0, max).toUpperCase();
  return `<g>
    <rect x="${-s.w / 2}" y="${-s.h / 2}" width="${s.w}" height="${s.h}" rx="4" fill="#5a4a7a" stroke="#2e2347" stroke-width="2"/>
    <text x="0" y="${s.fs / 3 + 1}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${s.fs}" font-weight="700" fill="#f3ecff">${escapeXml(short)}</text>
  </g>`;
}

// --- Normalizzazione / posizionamento simboli materiale ---
// FOOTPRINT: i simboli occupano un riquadro ~36x36 centrato sull'origine quando
// posizionati sul campo. Il footprint è fisso; il simbolo si adatta via viewBox.
const SYM_FOOT = 36;

function sanitizeSymbol(raw) {
  return String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

// Normalizza un markup SVG salvato come simbolo (da "Inserisci codice" o "Carica SVG").
// Produce un <svg> autonomo con viewBox coerente, width/height 100% e
// preserveAspectRatio, così il rendering è indipendente dal contesto.
export function normalizeSvgSymbol(raw) {
  const s = sanitizeSymbol(raw).trim();
  if (!s) return null;
  const open = s.match(/<svg\b[^>]*>/i);
  if (open) {
    const attrs = open[0];
    let vb = (attrs.match(/viewBox\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!vb) {
      const w = (attrs.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i) || [])[1];
      const h = (attrs.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i) || [])[1];
      vb = (w && h) ? `0 0 ${w} ${h}` : "0 0 40 40";
    }
    const startIdx = s.indexOf(open[0]) + open[0].length;
    const endIdx = s.lastIndexOf("</svg>");
    const inner = (endIdx > startIdx ? s.slice(startIdx, endIdx) : "").trim();
    if (!inner) return null;
    return `<svg viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }
  // nessun root <svg>: frammento autorato in spazio top-left 0..40 (default da specifica)
  return `<svg viewBox="0 0 40 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

// Wrappa un simbolo per il posizionamento sul campo (slot fisso centrato sull'origine).
// I simboli <svg> normalizzati (width/height 100%) vengono inseriti in uno slot 36x36;
// i frammenti <g> (default/generico/legacy) sono già disegnati attorno all'origine.
export function placeSymbol(symbol) {
  const s = String(symbol || "").trim();
  if (!s) return removedSymbolPlaceholder();
  if (/^<svg[\s>]/i.test(s)) {
    const o = -SYM_FOOT / 2;
    return `<svg x="${o}" y="${o}" width="${SYM_FOOT}" height="${SYM_FOOT}" overflow="visible">${s}</svg>`;
  }
  return s;
}

// Segnaposto per un materiale eliminato/non trovato: nessun simbolo originale,
// marcatore tenue + (se disponibile) nome/key per riconoscerlo.
export function removedSymbolPlaceholder(label) {
  const t = String(label || "").trim().slice(0, 16);
  const txt = t ? `<text x="0" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="6" fill="#c0392b">${escapeXml(t)}</text>` : "";
  return `<g>
    <circle r="11" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="3 3" opacity="0.85"/>
    <line x1="-5.5" y1="-5.5" x2="5.5" y2="5.5" stroke="#c0392b" stroke-width="2"/>
    <line x1="5.5" y1="-5.5" x2="-5.5" y2="5.5" stroke="#c0392b" stroke-width="2"/>
    ${txt}
  </g>`;
}

// Codice da mostrare in "Mostra codice SVG": forma normalizzata e ripristinabile via copia-incolla.
export function toDisplayCode(symbol) {
  const s = String(symbol || "").trim();
  if (!s) return "";
  if (/^<svg[\s>]/i.test(s)) return normalizeSvgSymbol(s) || s;
  // frammento <g> centrato sull'origine -> viewBox centrato coerente col footprint
  const h = SYM_FOOT / 2;
  return `<svg viewBox="${-h} ${-h} ${SYM_FOOT} ${SYM_FOOT}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

// --- Materiali di default (bloccati) ---
export const DEFAULT_MATERIALS = [
  { key: "porta",          label: "Porta",            isDefault: true, svgSymbol: MATERIAL_SYMBOLS.porta },
  { key: "portiere",       label: "Portiere",         isDefault: true, svgSymbol: MATERIAL_SYMBOLS.portiere },
  { key: "giocatore",      label: "Giocatore",        isDefault: true, svgSymbol: MATERIAL_SYMBOLS.giocatore },
  { key: "pallone",        label: "Pallone",          isDefault: true, svgSymbol: MATERIAL_SYMBOLS.pallone },
  { key: "cono",           label: "Cono",             isDefault: true, svgSymbol: MATERIAL_SYMBOLS.cono },
  { key: "cinesino",       label: "Cinesino",         isDefault: true, svgSymbol: MATERIAL_SYMBOLS.cinesino },
  { key: "scaletta",       label: "Scaletta a pioli", isDefault: true, svgSymbol: MATERIAL_SYMBOLS.scaletta },
  { key: "ostacolo_basso", label: "Ostacolo basso",   isDefault: true, svgSymbol: MATERIAL_SYMBOLS.ostacolo_basso },
  { key: "ostacolo_alto",  label: "Ostacolo alto",    isDefault: true, svgSymbol: MATERIAL_SYMBOLS.ostacolo_alto },
  { key: "paletto",        label: "Paletto",          isDefault: true, svgSymbol: MATERIAL_SYMBOLS.paletto }
];

// Icona della "freccia" mostrata nella palette dell'editor (strumento, non materiale).
export const ARROW_TOOL_ICON = `<g>
  <line x1="-15" y1="10" x2="11" y2="-9" stroke="#16242b" stroke-width="3" stroke-linecap="round"/>
  <polygon points="16,-12 6,-12 13,-3" fill="#16242b"/>
</g>`;

// Stili di tratto disponibili per le frecce: chiave -> stroke-dasharray (in unità del viewBox).
export const ARROW_STYLES = {
  solido:        "",
  tratteggiato:  "12 9",
  punteggiato:   "1 9",
  tratto_punto:  "16 8 1 8"
};
export const ARROW_STYLE_LABELS = {
  solido: "Solido",
  tratteggiato: "Tratteggiato",
  punteggiato: "Punteggiato",
  tratto_punto: "Tratto-punto"
};

// Stile delle punte (inizio/fine linea): "none" nessuna punta, "arrow" triangolo pieno,
// "arrow_open" freccia aperta a V. Ordine anche per popolare i dropdown ovunque compaiano.
export const ARROW_CAP_KEYS = ["none", "arrow", "arrow_open"];
export const ARROW_CAP_LABELS = {
  none: "Nessuna",
  arrow: "Freccia",
  arrow_open: "Freccia aperta"
};

// Tipi di freccia di default (precaricati, bloccati). L'utente può aggiungerne altri.
// Migrazione: i tipi già esistenti (creati prima dell'introduzione di startCap/endCap/capScale)
// assumono implicitamente startCap:"none", endCap:"arrow", capScale:1 — il comportamento che
// avevano finora — sia qui per i default sia a runtime per i tipi custom già salvati (fallback
// difensivo alla lettura).
export const DEFAULT_ARROW_TYPES = [
  { key: "passaggio",   name: "Passaggio",   color: "#f5b301", style: "solido",       startCap: "none", endCap: "arrow", capScale: 1, description: "Passaggio di palla",          isDefault: true },
  { key: "tiro",        name: "Tiro",        color: "#e63946", style: "solido",       startCap: "none", endCap: "arrow", capScale: 1, description: "Conclusione verso la porta",  isDefault: true },
  { key: "spostamento", name: "Spostamento", color: "#ffffff", style: "tratteggiato", startCap: "none", endCap: "arrow", capScale: 1, description: "Movimento del portiere",       isDefault: true },
  { key: "conduzione",  name: "Conduzione",  color: "#ff6b1a", style: "punteggiato",  startCap: "none", endCap: "arrow", capScale: 1, description: "Guida/conduzione della palla", isDefault: true }
];

export const DEFAULT_TECHNICAL_GESTURES = [
  "Presa alta", "Presa bassa", "Presa a terra", "Tuffo", "Respinta di pugni",
  "Respinta di piede", "Uscita alta", "Uscita bassa", "Rinvio dalle mani",
  "Rilancio coi piedi", "Deviazione in corner", "Bloccaggio", "Posizionamento",
  "Gioco coi piedi", "Presa in elevazione"
];

export const DEFAULT_BASE_SETUP = [
  "Posizione di base", "Spostamenti laterali", "Lavoro di gambe (footwork)",
  "Riscaldamento specifico", "Mobilità articolare", "Attivazione",
  "Coordinazione", "Spinte e recuperi"
];

export const DEFAULT_TRAINED_QUALITIES = [
  "Reattività", "Esplosività", "Coordinazione", "Forza", "Resistenza",
  "Agilità", "Lettura e anticipo", "Concentrazione", "Tecnica di presa",
  "Tecnica di tuffo", "Gioco aereo", "Gioco coi piedi", "Velocità di spostamento"
];

export const DEFAULT_TRAINING_PERIODS = [
  "Prestagione", "Preparazione fisica generale", "Stagione regolare — infrasettimanale",
  "Vigilia di partita", "Riscaldamento pre-partita", "Scarico post-partita",
  "Pausa invernale", "Ritiro / Training camp", "Ripresa da infortunio", "Fuori stagione"
];

// --- Liste configurabili dei Portieri (schema 2.2) ---
export const DEFAULT_GOALKEEPER_CATEGORIES = [
  "Primavera", "Prima Squadra", "Under 17", "Under 15", "Settore Giovanile"
];
export const DEFAULT_TECHNICAL_NOTE_TAGS = [
  "Gioco coi piedi da migliorare", "Buona presa alta", "Tuffo laterale da lavorare", "Buon posizionamento"
];
export const DEFAULT_MENTAL_NOTE_TAGS = [
  "Buona concentrazione", "Da motivare", "Gestisce bene la pressione", "Tende a innervosirsi"
];
export const DEFAULT_MEDICAL_NOTE_TAGS = [
  "Nessuna criticità", "Da monitorare", "In recupero da infortunio", "Limitazioni di carico"
];

// Etichette piede preferito (chiave salvata -> etichetta IT).
export const PREFERRED_FOOT_LABELS = {
  left: "Sinistro",
  right: "Destro",
  ambidextrous: "Ambidestro"
};

// Tag di stato salute portiere (schema 2.4) — un solo valore, sempre visibile in evidenza.
// Non sostituisce le note mediche (diario dettagliato): è il colpo d'occhio immediato.
export const HEALTH_STATUS_ORDER = ["healthy", "injured", "recovering"];
export const HEALTH_STATUS_LABELS = {
  healthy: "In salute",
  injured: "Infortunato",
  recovering: "In recupero"
};

export function buildDefaultCustomLists() {
  // Schema 2.0: "baseSetup" è fuso in "trainedQualities" (un'unica lista).
  const qualities = [...DEFAULT_TRAINED_QUALITIES];
  DEFAULT_BASE_SETUP.forEach(v => { if (!qualities.includes(v)) qualities.push(v); });
  return {
    technicalGestures: [...DEFAULT_TECHNICAL_GESTURES],
    trainedQualities: qualities,
    trainingPeriods: [...DEFAULT_TRAINING_PERIODS],
    materials: DEFAULT_MATERIALS.map(m => ({ ...m })),
    arrowTypes: DEFAULT_ARROW_TYPES.map(a => ({ ...a })),
    goalkeeperCategories: [...DEFAULT_GOALKEEPER_CATEGORIES],
    technicalNoteTags: [...DEFAULT_TECHNICAL_NOTE_TAGS],
    mentalNoteTags: [...DEFAULT_MENTAL_NOTE_TAGS],
    medicalNoteTags: [...DEFAULT_MEDICAL_NOTE_TAGS]
  };
}

// Slot del microciclo (informativo, usato solo a scopo etichetta nelle sedute importate)
export const MICROCYCLE_SLOTS = ["Seduta 1", "Seduta 2", "Pre-partita", "Partita", "Recupero"];
