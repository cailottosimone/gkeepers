// seasonLogic.js
// Helper PURI per la sezione Stagione (nessun DOM, nessun IndexedDB): matematica
// delle date, generazione settimane dal template, normalizzazione della forma
// della settimana. La settimana mantiene i campi fissi dello schema 2.2
// (assignedSessionIds / assignedEventIds) come UNIONE canonica e aggiunge in modo
// additivo la mappa per-giorno `days` (1=lun … 7=dom): ogni giorno può avere un
// segnaposto `dayType` (indicatore visivo dal template) + assegnazioni reali
// (sessionIds / eventIds). Il flag additivo `manual` marca le settimane extra
// aggiunte a mano (rimovibili, mai rigenerate dal template).

export const DAY_LABELS = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
export const DAY_LABELS_SHORT = ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
export const MONTH_LABELS = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
export const MONTH_LABELS_SHORT = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

// eventType include ora "training" (schema additivo): un evento può essere di tipo Allenamento.
export const EVENT_TYPE_LABELS = { training: "Allenamento", match: "Partita", tournament: "Torneo", test: "Test", other: "Altro" };

// Tipi di giorno del template (fissi, NON configurabili). Mappano a match/tournament/other
// dello schema, con l'aggiunta di training e rest (rest è solo un segnaposto, non un evento).
export const DAY_TYPES = [
  { key: "training", label: "Allenamento" },
  { key: "match", label: "Partita" },
  //{ key: "tournament", label: "Torneo" },
  //{ key: "rest", label: "Riposo" },
  { key: "other", label: "Altro" }
];
export const DAY_TYPE_LABELS = { training: "Allenamento", match: "Partita", tournament: "Torneo", rest: "Riposo", other: "Altro" };
const DAY_TYPE_KEYS = new Set(DAY_TYPES.map(t => t.key));

// --- Date (locali, mezzanotte) ---
export function parseDateISO(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
export function toISODate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// Lunedì della settimana che contiene d (settimana ISO, lun=inizio).
export function mondayOf(d) {
  const x = new Date(d);
  const wd = x.getDay();                 // 0=dom … 6=sab
  const diff = (wd === 0 ? -6 : 1 - wd); // arretra fino a lunedì
  return addDays(x, diff);
}
// Giorno ISO 1..7 (lun..dom) da una Date.
export function isoWeekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }

// Data (Date) del giorno dayNum (1..7) di una settimana dato il suo lunedì ISO.
export function dayDate(weekStartISO, dayNum) {
  const mon = parseDateISO(weekStartISO);
  if (!mon) return null;
  return addDays(mon, dayNum - 1);
}

// Elenco dei lunedì (ISO) che coprono [startISO, endISO] inclusi, una voce per settimana.
export function generateWeekStartDates(startISO, endISO) {
  const s = parseDateISO(startISO), e = parseDateISO(endISO);
  if (!s || !e || e < s) return [];
  let cur = mondayOf(s);
  const end = mondayOf(e);
  const out = [];
  let guard = 0;
  while (cur <= end && guard < 1040) { out.push(toISODate(cur)); cur = addDays(cur, 7); guard++; }
  return out;
}

// --- Forma della settimana ---
export function emptyDays() {
  const days = {};
  for (let d = 1; d <= 7; d++) days[d] = { dayType: null, sessionIds: [], eventIds: [] };
  return days;
}

// Quanti elementi ha un giorno (segnaposto tipo-giorno + sedute + eventi).
export function dayItemCount(dayObj) {
  if (!dayObj) return 0;
  return (dayObj.dayType ? 1 : 0) + (dayObj.sessionIds ? dayObj.sessionIds.length : 0) + (dayObj.eventIds ? dayObj.eventIds.length : 0);
}

// Normalizza una settimana (additivo e difensivo).
export function ensureWeekShape(w, genId) {
  const x = (w && typeof w === "object") ? w : {};
  const days = emptyDays();
  for (let d = 1; d <= 7; d++) {
    const src = (x.days && typeof x.days === "object" && x.days[d]) ? x.days[d] : null;
    if (src) {
      days[d].dayType = (typeof src.dayType === "string" && DAY_TYPE_KEYS.has(src.dayType)) ? src.dayType : null;
      days[d].sessionIds = Array.isArray(src.sessionIds) ? src.sessionIds.filter(v => typeof v === "string") : [];
      days[d].eventIds = Array.isArray(src.eventIds) ? src.eventIds.filter(v => typeof v === "string") : [];
    }
  }
  const anyS = Object.keys(days).some(k => days[k].sessionIds.length);
  const anyE = Object.keys(days).some(k => days[k].eventIds.length);
  const flatS = Array.isArray(x.assignedSessionIds) ? x.assignedSessionIds.filter(v => typeof v === "string") : [];
  const flatE = Array.isArray(x.assignedEventIds) ? x.assignedEventIds.filter(v => typeof v === "string") : [];
  if (!anyS && flatS.length) days[1].sessionIds = [...flatS];
  if (!anyE && flatE.length) days[1].eventIds = [...flatE];
  const _manual = (typeof x.isManuallyAdded === "boolean" ? x.isManuallyAdded : false) || !!x.manual;
  const out = {
    id: (typeof x.id === "string" && x.id) ? x.id : (genId ? genId() : "w-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
    weekStartDate: typeof x.weekStartDate === "string" ? x.weekStartDate : null,
    isOverride: !!x.isOverride,
    manual: _manual,
    // schema 2.3: campo canonico per le settimane aggiunte a mano (specchio di `manual`).
    isManuallyAdded: _manual,
    notes: typeof x.notes === "string" ? x.notes : "",
    days
  };
  syncWeekFlats(out);
  return out;
}

// Ricalcola i flat canonici come unione dei giorni (chiamare dopo ogni modifica).
export function syncWeekFlats(w) {
  const uS = [], uE = [];
  for (let d = 1; d <= 7; d++) {
    (w.days[d].sessionIds || []).forEach(s => { if (!uS.includes(s)) uS.push(s); });
    (w.days[d].eventIds || []).forEach(e => { if (!uE.includes(e)) uE.push(e); });
  }
  w.assignedSessionIds = uS;
  w.assignedEventIds = uE;
  return w;
}

// Costruisce una settimana generata dal template (isOverride:false, manual:false).
// Ogni giorno attivo del template genera un SEGNAPOSTO dayType (nessuna seduta/evento reale).
export function buildWeekFromTemplate(weekStartISO, template, genId) {
  const w = ensureWeekShape({ weekStartDate: weekStartISO, isOverride: false, manual: false }, genId);
  const wp = (template && Array.isArray(template.weekPattern)) ? template.weekPattern : [];
  wp.forEach(p => {
    const d = Number(p.dayOfWeek);
    if (d >= 1 && d <= 7 && typeof p.dayType === "string" && DAY_TYPE_KEYS.has(p.dayType)) {
      w.days[d].dayType = p.dayType;
    }
  });
  syncWeekFlats(w);
  return w;
}

// Rigenerazione: conserva le settimane in override E quelle aggiunte manualmente
// (per weekStartDate, anche fuori dal range), rigenera dal template tutte le altre.
export function regenerateWeeks(existingWeeks, weekStartDates, template, genId) {
  const kept = (existingWeeks || []).filter(w => w && (w.isOverride || w.manual) && w.weekStartDate);
  const keptDates = new Set(kept.map(w => w.weekStartDate));
  const generated = weekStartDates
    .filter(ds => !keptDates.has(ds))
    .map(ds => buildWeekFromTemplate(ds, template, genId));
  return [...kept, ...generated].sort((a, b) => (a.weekStartDate || "").localeCompare(b.weekStartDate || ""));
}

// Conta le settimane "pianificate" (con almeno un elemento: segnaposto, seduta, evento, nota o override).
export function countPlannedWeeks(weeks) {
  return (weeks || []).filter(w => {
    if (!w) return false;
    const anyPlaceholder = w.days && Object.keys(w.days).some(k => w.days[k] && w.days[k].dayType);
    return anyPlaceholder ||
      (w.assignedSessionIds && w.assignedSessionIds.length) ||
      (w.assignedEventIds && w.assignedEventIds.length) ||
      (w.notes && w.notes.trim()) || w.isOverride || w.manual;
  }).length;
}
