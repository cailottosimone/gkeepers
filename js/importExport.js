// importExport.js
// Serializzazione/deserializzazione secondo lo SCHEMA JSON CONDIVISO corrente (v2.2).
// L'export è il vero sistema di backup ed è bidirezionale con l'artefatto Claude.
// Import robusto: JSON malformato o schema non riconosciuto vengono gestiti con grazia.

import { SCHEMA_VERSION, MATERIAL_SYMBOLS, DEFAULT_MATERIALS } from "./defaults.js";
import { ensureWeekShape } from "./seasonLogic.js";

const DEFAULT_MATERIAL_KEYS = new Set(DEFAULT_MATERIALS.map(m => m.key));

// --- EXPORT ---
// Serializza le customLists in forma schema (riusata da buildExport e dall'export configurazione).
export function serializeCustomLists(customLists) {
  const cl = customLists || {};
  return {
    technicalGestures: [...(cl.technicalGestures || [])],
    trainedQualities: [...(cl.trainedQualities || [])],
    trainingPeriods: [...(cl.trainingPeriods || [])],
    materials: (cl.materials || []).map(m => ({
      key: m.key,
      label: m.label,
      isDefault: !!m.isDefault,
      // schema 2.1: anche i default possono avere un simbolo personalizzato -> esporta quello corrente
      svgSymbol: m.svgSymbol || (m.isDefault ? (MATERIAL_SYMBOLS[m.key] || null) : null)
    })),
    arrowTypes: (cl.arrowTypes || []).map(a => ({
      key: a.key, name: a.name, color: a.color, style: a.style,
      startCap: a.startCap || "none", endCap: a.endCap || "arrow", capScale: clampArrowCapScale(a.capScale),
      description: a.description || "", isDefault: !!a.isDefault
    })),
    goalkeeperCategories: [...(cl.goalkeeperCategories || [])],
    technicalNoteTags: [...(cl.technicalNoteTags || [])],
    mentalNoteTags: [...(cl.mentalNoteTags || [])],
    medicalNoteTags: [...(cl.medicalNoteTags || [])]
  };
}

// Costruisce l'oggetto export completo a partire da items (exercise|session) e customLists.
// profile è OPZIONALE: se passato viene incluso senza pinHash/appLock.
export function buildExport(items, customLists, profile) {
  const out = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    customLists: serializeCustomLists(customLists),
    // gli oggetti sono già in forma schema; rimuoviamo solo i flag interni (es. "importato")
    items: items.map(stripInternalFields)
  };
  if (profile) out.profile = stripProfileForExport(profile);
  return out;
}

// --- Export/Import granulare (feature locale, schema invariato) ---
// Export di un singolo esercizio: niente customLists, solo l'oggetto.
export function buildSingleExerciseExport(exercise) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items: [stripInternalFields(exercise)]
  };
}

// Export della sola configurazione (customLists).
export function buildConfigExport(customLists) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    customLists: serializeCustomLists(customLists)
  };
}

// --- Profilo locale ---
// IMPORTANTE: pinHash e appLock NON vengono MAI esportati. Il blocco con PIN è un
// deterrente LOCALE legato al singolo dispositivo, non una credenziale trasferibile.
export function stripProfileForExport(profile) {
  if (!profile || typeof profile !== "object") return null;
  return {
    type: "profile",
    id: profile.id || null,
    createdAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null,
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    role: profile.role ?? null,
    clubs: Array.isArray(profile.clubs) ? profile.clubs.filter(c => typeof c === "string") : [],
    logo: typeof profile.logo === "string" ? profile.logo : null,
    contactEmail: profile.contactEmail ?? null,
    contactPhone: profile.contactPhone ?? null
    // appLock / pinHash volutamente OMESSI
  };
}

// Normalizza un profilo in arrivo da import: scarta SEMPRE pinHash/appLock (vanno
// reimpostati localmente sul nuovo dispositivo) e riempie i campi mancanti con valori neutri.
export function normalizeProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    type: "profile",
    id: typeof p.id === "string" && p.id ? p.id : null,  // l'app assegnerà un id se manca
    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null,
    firstName: typeof p.firstName === "string" ? p.firstName : "",
    lastName: typeof p.lastName === "string" ? p.lastName : "",
    role: typeof p.role === "string" ? p.role : null,
    clubs: Array.isArray(p.clubs) ? p.clubs.filter(c => typeof c === "string") : [],
    logo: typeof p.logo === "string" ? p.logo : null,
    contactEmail: typeof p.contactEmail === "string" ? p.contactEmail : null,
    contactPhone: typeof p.contactPhone === "string" ? p.contactPhone : null
    // nessun appLock/pinHash: il blocco è sempre locale, mai importato
  };
}

// Export del solo profilo (stesso pattern degli altri export singoli).
export function buildProfileExport(profile) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: stripProfileForExport(profile)
  };
}

// Import del solo profilo. Ritorna { ok, error?, profile } (senza pinHash/appLock).
export function parseProfileImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  const raw = data.profile || (data.type === "profile" ? data : null);
  if (!raw) return { ok: false, error: "Il file non contiene un profilo." };
  return { ok: true, profile: normalizeProfile(raw) };
}

// Import di un singolo esercizio. Valida: JSON corretto, esattamente UN item di tipo exercise.
// Applica le migrazioni esistenti (via normalizeExercise). Ritorna { ok, error?, exercise }.
export function parseSingleExerciseImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  if (!Array.isArray(data.items)) return { ok: false, error: "Il file non contiene la lista 'items'." };
  const exercises = data.items.filter(it => it && it.type === "exercise");
  if (data.items.length === 0) return { ok: false, error: "Il file non contiene alcun elemento." };
  if (exercises.length !== 1 || data.items.length !== 1) {
    return { ok: false, error: "Il file deve contenere esattamente un esercizio." };
  }
  const exercise = normalizeExercise(exercises[0]);
  return { ok: true, exercise };
}

// Import della sola configurazione. Valida: customLists presente e NESSUN item.
// Ritorna { ok, error?, customLists } (liste normalizzate e migrate, pronte a SOVRASCRIVERE).
export function parseConfigImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  if (!data.customLists || typeof data.customLists !== "object") {
    return { ok: false, error: "Il file non contiene il campo 'customLists'." };
  }
  if (Array.isArray(data.items) && data.items.length > 0) {
    return { ok: false, error: "Questo file contiene anche esercizi/sedute: usa 'Importa archivio'. L'import configurazione accetta solo le liste." };
  }
  const migrated = migrateCustomListsToV2(data.customLists).lists;
  const customLists = normalizeIncomingCustomLists(migrated);
  return { ok: true, customLists };
}

// Normalizza le customLists in arrivo garantendo la forma schema corrente (v2.2, overwrite-safe).
function normalizeIncomingCustomLists(cl) {
  const c = cl || {};
  return {
    technicalGestures: safeArrayOfStrings(c.technicalGestures),
    trainedQualities: safeArrayOfStrings(c.trainedQualities),
    trainingPeriods: safeArrayOfStrings(c.trainingPeriods),
    materials: Array.isArray(c.materials)
      ? c.materials.filter(m => m && typeof m.key === "string").map(m => ({
          key: m.key,
          label: typeof m.label === "string" ? m.label : m.key,
          isDefault: !!m.isDefault,
          svgSymbol: m.svgSymbol || (m.isDefault ? (MATERIAL_SYMBOLS[m.key] || null) : null)
        }))
      : [],
    arrowTypes: Array.isArray(c.arrowTypes)
      ? c.arrowTypes.filter(a => a && typeof a.key === "string").map(a => ({
          key: a.key, name: typeof a.name === "string" ? a.name : a.key,
          color: a.color || "#2b7de9", style: a.style || "solido",
          startCap: a.startCap || "none", endCap: a.endCap || "arrow", capScale: clampArrowCapScale(a.capScale),
          description: a.description || "", isDefault: !!a.isDefault
        }))
      : [],
    goalkeeperCategories: safeArrayOfStrings(c.goalkeeperCategories),
    technicalNoteTags: safeArrayOfStrings(c.technicalNoteTags),
    mentalNoteTags: safeArrayOfStrings(c.mentalNoteTags),
    medicalNoteTags: safeArrayOfStrings(c.medicalNoteTags)
  };
}

// Campi solo-interni a IndexedDB, mai esportati (non fanno parte dello schema v1.0).
function stripInternalFields(it) {
  if (!it || typeof it !== "object") return it;
  const clone = { ...it };
  delete clone.importato;
  return clone;
}

// --- MIGRAZIONE schema 1.0 -> 2.0 ---
// Fonde baseSetup in trainedQualities (senza duplicati) e rimuove baseSetup.
// Usata su esercizi già in IndexedDB e su customLists, in modo idempotente.
export function migrateExerciseToV2(ex) {
  if (!ex || typeof ex !== "object") return { item: ex, changed: false };
  if (!("baseSetup" in ex)) return { item: ex, changed: false };
  const out = { ...ex };
  const tq = Array.isArray(out.trainedQualities) ? [...out.trainedQualities] : [];
  (Array.isArray(out.baseSetup) ? out.baseSetup : []).forEach(v => { if (v && !tq.includes(v)) tq.push(v); });
  out.trainedQualities = tq;
  delete out.baseSetup;
  return { item: out, changed: true };
}

export function migrateCustomListsToV2(lists) {
  if (!lists || typeof lists !== "object") return { lists, changed: false };
  if (!("baseSetup" in lists)) return { lists, changed: false };
  const out = { ...lists };
  const tq = Array.isArray(out.trainedQualities) ? [...out.trainedQualities] : [];
  (Array.isArray(out.baseSetup) ? out.baseSetup : []).forEach(v => { if (v && !tq.includes(v)) tq.push(v); });
  out.trainedQualities = tq;
  delete out.baseSetup;
  return { lists: out, changed: true };
}

// Migrazione completa di un esercizio allo schema corrente (2.2):
//  v1.0 -> v2.0 (baseSetup -> trainedQualities) -> aggiunge trainingPeriod = []
//  v2.0 -> aggiunge trainingPeriod = []
//  (2.1 -> 2.2 è solo un bump di etichetta: nessun cambiamento strutturale)
export function migrateExerciseToCurrent(ex) {
  if (!ex || typeof ex !== "object") return { item: ex, changed: false };
  let changed = false;
  let out = ex;
  const v2 = migrateExerciseToV2(ex);
  if (v2.changed) { out = v2.item; changed = true; }
  if (!Array.isArray(out.trainingPeriod)) {
    out = { ...out, trainingPeriod: [] };
    changed = true;
  }
  return { item: out, changed };
}

// Migrazione di una seduta allo schema corrente: aggiunge aggregated.periodsCovered = []
export function migrateSessionToCurrent(s) {
  if (!s || typeof s !== "object") return { item: s, changed: false };
  const agg = (s.aggregated && typeof s.aggregated === "object") ? s.aggregated : {};
  if (Array.isArray(agg.periodsCovered)) return { item: s, changed: false };
  return { item: { ...s, aggregated: { ...agg, periodsCovered: [] } }, changed: true };
}

export function exportToJsonString(items, customLists, profile) {
  return JSON.stringify(buildExport(items, customLists, profile), null, 2);
}

// --- IMPORT ---
// Valida e normalizza un oggetto importato. Restituisce:
// { ok, error?, exercises, sessions, mergedCustomLists, warnings }
export function parseImport(rawText, currentCustomLists) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, error: "Il file non è un JSON valido. Controlla che non sia danneggiato." };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Struttura del file non riconosciuta." };
  }
  // schemaVersion mancante o non riconosciuta NON blocca: si tenta comunque la migrazione
  // dai campi noti (i formati v1.0/v2.0/v2.1 sono retro/avanti compatibili per i campi conosciuti).

  const warnings = [];

  // Regola difensiva: "items" mancante o non-array non è un errore. Un file di sola
  // configurazione (solo customLists) è valido: importa 0 elementi e unisce le liste.
  let rawItems = data.items;
  if (!Array.isArray(rawItems)) {
    if (rawItems !== undefined) warnings.push("Campo \"items\" ignorato: non è un elenco valido.");
    rawItems = [];
  }

  // 1) Merge delle customLists (unione non distruttiva: non sovrascrive dati esistenti)
  const merged = mergeCustomLists(currentCustomLists || {}, data.customLists || {});

  // 2) Separazione e normalizzazione degli items
  const exercises = [];
  const sessions = [];
  const goalkeepers = [];
  const seasons = [];
  const events = [];
  const attendances = [];
  const genericEvents = [];
  const specificEvents = [];

  rawItems.forEach((it, idx) => {
    if (!it || typeof it !== "object") {
      warnings.push(`Voce #${idx + 1} ignorata: formato non valido.`);
      return;
    }
    if (it.type === "exercise") {
      exercises.push(normalizeExercise(it));
    } else if (it.type === "session") {
      sessions.push(normalizeSession(it));
    } else if (it.type === "goalkeeper") {
      goalkeepers.push(normalizeGoalkeeper(it));
    } else if (it.type === "season") {
      seasons.push(normalizeSeason(it));
    } else if (it.type === "event") {
      events.push(normalizeEvent(it));
    } else if (it.type === "attendance") {
      attendances.push(normalizeAttendance(it));
    } else if (it.type === "generic_event") {
      genericEvents.push(normalizeGenericEvent(it));
    } else if (it.type === "specific_event") {
      specificEvents.push(normalizeSpecificEvent(it));
    } else if (it.type === undefined && (it.svg !== undefined || Array.isArray(it.materials) || Array.isArray(it.trainedQualities))) {
      // type assente ma "sembra" un esercizio (formati molto vecchi): lo trattiamo come tale
      exercises.push(normalizeExercise(it));
      warnings.push(`Voce #${idx + 1}: tipo assente, interpretata come esercizio.`);
    } else {
      warnings.push(`Voce #${idx + 1} ignorata: tipo sconosciuto "${it.type}".`);
    }
  });

  return {
    ok: true, exercises, sessions, goalkeepers, seasons, events, attendances, genericEvents, specificEvents,
    mergedCustomLists: merged, warnings,
    profile: data.profile ? normalizeProfile(data.profile) : null
  };
}

function mergeCustomLists(current, incoming) {
  const out = {
    technicalGestures: [...(current.technicalGestures || [])],
    trainedQualities: [...(current.trainedQualities || [])],
    trainingPeriods: [...(current.trainingPeriods || [])],
    materials: (current.materials || []).map(m => ({ ...m })),
    arrowTypes: (current.arrowTypes || []).map(a => ({ ...a })),
    goalkeeperCategories: [...(current.goalkeeperCategories || [])],
    technicalNoteTags: [...(current.technicalNoteTags || [])],
    mentalNoteTags: [...(current.mentalNoteTags || [])],
    medicalNoteTags: [...(current.medicalNoteTags || [])]
  };

  const unionStrings = (target, src) => {
    (src || []).forEach(v => { if (v && !target.includes(v)) target.push(v); });
  };
  // schema 2.0: eventuale baseSetup (corrente o in arrivo, v1.0) confluisce in trainedQualities
  unionStrings(out.trainedQualities, current.baseSetup);
  unionStrings(out.technicalGestures, incoming.technicalGestures);
  unionStrings(out.trainedQualities, incoming.trainedQualities);
  unionStrings(out.trainedQualities, incoming.baseSetup);
  unionStrings(out.trainingPeriods, incoming.trainingPeriods);
  unionStrings(out.goalkeeperCategories, incoming.goalkeeperCategories);
  unionStrings(out.technicalNoteTags, incoming.technicalNoteTags);
  unionStrings(out.mentalNoteTags, incoming.mentalNoteTags);
  unionStrings(out.medicalNoteTags, incoming.medicalNoteTags);

  const existingKeys = new Set(out.materials.map(m => m.key));
  (incoming.materials || []).forEach(m => {
    if (!m || !m.key) return;
    if (existingKeys.has(m.key)) return; // non sovrascriviamo i default né i custom già presenti
    out.materials.push({
      key: m.key,
      label: m.label || m.key,
      isDefault: !!m.isDefault && DEFAULT_MATERIAL_KEYS.has(m.key),
      svgSymbol: DEFAULT_MATERIAL_KEYS.has(m.key)
        ? (MATERIAL_SYMBOLS[m.key] || m.svgSymbol || null)
        : (m.svgSymbol || null)
    });
    existingKeys.add(m.key);
  });

  // arrowTypes: unione per chiave (non sovrascriviamo quelli già presenti)
  const arrowKeys = new Set(out.arrowTypes.map(a => a.key));
  (incoming.arrowTypes || []).forEach(a => {
    if (!a || !a.key || arrowKeys.has(a.key)) return;
    out.arrowTypes.push({
      key: a.key, name: a.name || a.key, color: a.color || "#f5b301",
      style: a.style || "solido", startCap: a.startCap || "none", endCap: a.endCap || "arrow", capScale: clampArrowCapScale(a.capScale),
      description: a.description || "", isDefault: !!a.isDefault
    });
    arrowKeys.add(a.key);
  });

  return out;
}

function safeString(v, fallback = "") { return typeof v === "string" ? v : fallback; }
// Dimensione punta freccia: stesso clamp 0.5–2.0 usato dall'editor SVG e da Impostazioni, con
// fallback 1.0 per i tipi importati da backup creati prima di questa funzionalità.
function clampArrowCapScale(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0.5, Math.min(2, n)) : 1;
}
function safeArrayOfStrings(v) { return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; }
function nowIso() { return new Date().toISOString(); }
function genId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function normalizeExercise(it) {
  // Preserviamo eventuali campi extra (es. periodization dell'artefatto) con lo spread iniziale.
  const ex = { ...it };
  delete ex.importato; // il flag è solo interno: lo imposta l'import, mai il file
  ex.type = "exercise";
  ex.id = safeString(it.id) || genId();
  ex.createdAt = safeString(it.createdAt) || nowIso();
  ex.updatedAt = safeString(it.updatedAt) || ex.createdAt;
  ex.title = safeString(it.title, "Esercizio senza titolo");
  ex.description = safeString(it.description);
  ex.svg = safeString(it.svg);
  ex.attachments = Array.isArray(it.attachments)
    ? it.attachments.filter(a => a && a.type === "image" && typeof a.dataUrl === "string")
        .map(a => ({ type: "image", name: safeString(a.name, "immagine"), dataUrl: a.dataUrl }))
    : [];
  ex.links = Array.isArray(it.links)
    ? it.links.filter(l => l && typeof l.url === "string").map(l => ({
        url: l.url,
        label: safeString(l.label, l.url),
        timeRange: l.timeRange && typeof l.timeRange === "object"
          ? { start: numOrNull(l.timeRange.start), end: numOrNull(l.timeRange.end) }
          : null
      }))
    : [];
  ex.notes = safeString(it.notes);
  ex.technicalGestures = safeArrayOfStrings(it.technicalGestures);
  // schema 2.0: baseSetup (v1.0) confluisce in trainedQualities, senza duplicati
  const _tq = safeArrayOfStrings(it.trainedQualities);
  safeArrayOfStrings(it.baseSetup).forEach(v => { if (!_tq.includes(v)) _tq.push(v); });
  ex.trainedQualities = _tq;
  delete ex.baseSetup;
  ex.trainingPeriod = safeArrayOfStrings(it.trainingPeriod);
  ex.materials = Array.isArray(it.materials)
    ? it.materials.filter(m => m && typeof m.key === "string")
        .map(m => ({ key: m.key, qty: Number(m.qty) || 1 }))
    : [];
  // Portiere predefinito: in import, se manca una voce con key "portiere" (case-insensitive),
  // la aggiunge con qty 1. Se è già presente (qualsiasi quantità) non si tocca.
  if (!ex.materials.some(m => typeof m.key === "string" && m.key.toLowerCase() === "portiere")) {
    ex.materials.push({ key: "portiere", qty: 1 });
  }
  const p = it.parameters || {};
  ex.parameters = {
    series: intOr(p.series, 0),
    reps: intOr(p.reps, 0),
    workSeconds: intOr(p.workSeconds, 0),
    recoverySeconds: intOr(p.recoverySeconds, 0),
    estimatedTotalSeconds: intOr(p.estimatedTotalSeconds, 0)
  };
  ex.status = (it.status === "favorite" || it.status === "memory") ? it.status : "memory";
  return ex;
}

function normalizeSession(it) {
  const s = { ...it }; // preserva eventuale periodizationSuggestion dall'artefatto
  s.type = "session";
  s.id = safeString(it.id) || genId();
  s.createdAt = safeString(it.createdAt) || nowIso();
  s.updatedAt = safeString(it.updatedAt) || s.createdAt;
  s.title = safeString(it.title, "Seduta senza titolo");
  s.exerciseIds = Array.isArray(it.exerciseIds) ? it.exerciseIds.filter(x => typeof x === "string") : [];
  // schema 2.2: portieri coinvolti nella seduta (alimenta lo storico nella scheda portiere)
  s.goalkeeperIds = Array.isArray(it.goalkeeperIds) ? it.goalkeeperIds.filter(x => typeof x === "string") : [];
  const a = it.aggregated || {};
  s.aggregated = {
    totalDurationSeconds: intOr(a.totalDurationSeconds, 0),
    qualitiesCovered: safeArrayOfStrings(a.qualitiesCovered),
    periodsCovered: safeArrayOfStrings(a.periodsCovered),
    materialsAggregated: Array.isArray(a.materialsAggregated)
      ? a.materialsAggregated.filter(m => m && typeof m.key === "string")
          .map(m => ({ key: m.key, qty: Number(m.qty) || 0 }))
      : []
  };
  s.status = (it.status === "favorite" || it.status === "memory") ? it.status : "memory";
  return s;
}

// --- Entità schema 2.2 ---
const NOTE_BLOCK_KEYS = ["technical", "mental", "medical"];
function normalizeNoteBlock(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  return { tags: safeArrayOfStrings(b.tags), freeText: safeString(b.freeText) };
}
function normalizeGoalkeeper(it) {
  const g = {};
  g.type = "goalkeeper";
  g.id = safeString(it.id) || genId();
  g.createdAt = safeString(it.createdAt) || nowIso();
  g.updatedAt = safeString(it.updatedAt) || g.createdAt;
  g.firstName = safeString(it.firstName);
  g.lastName = safeString(it.lastName);
  g.birthDate = safeString(it.birthDate) || null;
  g.category = safeString(it.category) || null;
  g.preferredFoot = ["left", "right", "ambidextrous"].includes(it.preferredFoot) ? it.preferredFoot : null;
  g.height = numOrNull(it.height);
  g.photo = typeof it.photo === "string" ? it.photo : null;
  const n = it.notes && typeof it.notes === "object" ? it.notes : {};
  g.notes = {};
  NOTE_BLOCK_KEYS.forEach(k => { g.notes[k] = normalizeNoteBlock(n[k]); });
  g.active = it.active === undefined ? true : !!it.active;
  return g;
}
const _DAY_TYPE_KEYS = ["training", "match", "tournament", "rest", "other"];
function normalizeCyclicTemplate(t) {
  if (!t || typeof t !== "object") return null;
  const wp = Array.isArray(t.weekPattern) ? t.weekPattern : [];
  // weekPattern: modello attuale (giorni attivi con dayType), tenuto per l'UI esistente.
  const weekPattern = wp
    .filter(p => p && Number.isFinite(Number(p.dayOfWeek)))
    .map(p => {
      // dayType è il nuovo modello; fallback per template salvati prima (avevano
      // trainingPeriod/sessionIdPlaceholder): giorno attivo -> "training".
      let dayType = (typeof p.dayType === "string" && _DAY_TYPE_KEYS.includes(p.dayType)) ? p.dayType : null;
      if (!dayType && (typeof p.trainingPeriod === "string" || typeof p.sessionIdPlaceholder === "string")) dayType = "training";
      if (!dayType) dayType = "training";
      return { dayOfWeek: Number(p.dayOfWeek), dayType };
    });

  // days: struttura canonica schema 2.3 (una voce per ogni giorno 1..7 con active/eventType/defaultGoalkeeperIds).
  // Se già presente e valida la si normalizza, altrimenti la si deriva da weekPattern (idempotente).
  const byDay = new Map();
  if (Array.isArray(t.days) && t.days.length) {
    t.days.forEach(d => {
      if (!d || !Number.isFinite(Number(d.dayOfWeek))) return;
      const dow = Number(d.dayOfWeek);
      const et = _DAY_TYPE_KEYS.includes(d.eventType) ? d.eventType : "training";
      byDay.set(dow, {
        dayOfWeek: dow,
        active: !!d.active,
        eventType: et,
        defaultGoalkeeperIds: Array.isArray(d.defaultGoalkeeperIds) ? d.defaultGoalkeeperIds.filter(x => typeof x === "string") : []
      });
    });
  } else {
    weekPattern.forEach(p => byDay.set(p.dayOfWeek, { dayOfWeek: p.dayOfWeek, active: true, eventType: p.dayType, defaultGoalkeeperIds: [] }));
  }
  const days = [];
  for (let dow = 1; dow <= 7; dow++) {
    days.push(byDay.get(dow) || { dayOfWeek: dow, active: false, eventType: "training", defaultGoalkeeperIds: [] });
  }
  return { weekPattern, days };
}
function normalizeSeason(it) {
  const s = {};
  s.type = "season";
  s.id = safeString(it.id) || genId();
  s.createdAt = safeString(it.createdAt) || nowIso();
  s.updatedAt = safeString(it.updatedAt) || s.createdAt;
  s.title = safeString(it.title);
  s.startDate = safeString(it.startDate) || null;
  s.endDate = safeString(it.endDate) || null;
  // Modalità unificate: "mixed" (vecchie stagioni) viene trattata come "cyclic".
  s.mode = it.mode === "free" ? "free" : (it.mode === "cyclic" || it.mode === "mixed") ? "cyclic" : "free";
  // schema 2.3: isCyclic è il campo canonico (deprecato `mode`, mantenuto sopra).
  // Idempotente: se isCyclic è già booleano lo si rispetta, altrimenti si deriva da mode.
  s.isCyclic = (typeof it.isCyclic === "boolean") ? it.isCyclic : (s.mode !== "free");
  s.cyclicTemplate = normalizeCyclicTemplate(it.cyclicTemplate);
  // Le settimane mantengono i flat canonici (assignedSessionIds/assignedEventIds) come
  // unione, la mappa per-giorno `days` (additiva) e i flag manual/isManuallyAdded.
  s.weeks = Array.isArray(it.weeks) ? it.weeks.map(w => ensureWeekShape(w, genId)) : [];
  return s;
}
function normalizeEvent(it) {
  const e = { ...it };
  e.type = "event";
  e.id = safeString(it.id) || genId();
  e.createdAt = safeString(it.createdAt) || nowIso();
  e.updatedAt = safeString(it.updatedAt) || e.createdAt;
  e.title = safeString(it.title);
  e.eventType = ["training", "match", "tournament", "test", "other"].includes(it.eventType) ? it.eventType : "other";
  e.date = safeString(it.date) || null;
  e.opponent = safeString(it.opponent) || null;
  e.notes = safeString(it.notes);
  e.goalkeeperIds = Array.isArray(it.goalkeeperIds) ? it.goalkeeperIds.filter(x => typeof x === "string") : [];
  return e;
}
function normalizeAttendance(it) {
  const a = { ...it };
  a.type = "attendance";
  a.id = safeString(it.id) || genId();
  a.createdAt = safeString(it.createdAt) || nowIso();
  a.updatedAt = safeString(it.updatedAt) || a.createdAt;
  // schema 2.3: genericEventId è il nuovo campo principale. I vecchi occasionType/
  // occasionId restano per retrocompatibilità (deprecati, non usati dalla nuova logica).
  a.genericEventId = safeString(it.genericEventId) || null;
  a.occasionType = ["session", "event"].includes(it.occasionType) ? it.occasionType : "session";
  a.occasionId = safeString(it.occasionId) || null;
  a.goalkeeperId = safeString(it.goalkeeperId) || null;
  a.status = ["present", "absent", "excused"].includes(it.status) ? it.status : "present";
  a.notes = typeof it.notes === "string" ? it.notes : null;
  return a;
}

// --- GenericEvent (schema 2.3) ---
const _GE_TYPES = ["training", "match", "tournament", "rest", "other"];
function normalizeGenericEvent(it) {
  const g = {};
  g.type = "generic_event";
  g.id = safeString(it.id) || genId();
  g.createdAt = safeString(it.createdAt) || nowIso();
  g.updatedAt = safeString(it.updatedAt) || g.createdAt;
  g.seasonId = safeString(it.seasonId) || null;
  g.weekId = safeString(it.weekId) || null;
  g.date = safeString(it.date) || null;
  g.eventType = _GE_TYPES.includes(it.eventType) ? it.eventType : "other";
  g.goalkeeperIds = Array.isArray(it.goalkeeperIds) ? it.goalkeeperIds.filter(x => typeof x === "string") : [];
  g.linkedItems = Array.isArray(it.linkedItems)
    ? it.linkedItems
        .filter(li => li && (li.type === "session" || li.type === "specific_event") && typeof li.id === "string")
        .map(li => ({ type: li.type, id: li.id }))
    : [];
  g.notes = typeof it.notes === "string" ? it.notes : "";
  g.isOverride = !!it.isOverride;
  return g;
}

// --- SpecificEvent (schema 2.3) --- NB: nessun goalkeeperIds (stanno sul GenericEvent).
const _SE_TYPES = ["match", "tournament", "test", "other"];
function normalizeSpecificEvent(it) {
  const s = {};
  s.type = "specific_event";
  s.id = safeString(it.id) || genId();
  s.createdAt = safeString(it.createdAt) || nowIso();
  s.updatedAt = safeString(it.updatedAt) || s.createdAt;
  s.eventType = _SE_TYPES.includes(it.eventType) ? it.eventType : "other";
  s.title = safeString(it.title);
  s.date = safeString(it.date) || null;
  s.opponent = safeString(it.opponent) || null;
  s.location = safeString(it.location) || null;
  s.time = safeString(it.time) || null;
  s.notes = safeString(it.notes);
  return s;
}

// Espone i normalizzatori all'app (per creazione/aggiornamento puliti).
export { normalizeGoalkeeper, normalizeSeason, normalizeEvent, normalizeGenericEvent, normalizeSpecificEvent };

// Export/Import singolo GenericEvent (schema 2.3).
export function buildSingleGenericEventExport(genericEvent) {
  return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), items: [stripInternalFields(genericEvent)] };
}
export function parseSingleGenericEventImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) return { ok: false, error: "Struttura del file non riconosciuta." };
  const list = data.items.filter(it => it && it.type === "generic_event");
  if (list.length !== 1 || data.items.length !== 1) return { ok: false, error: "Il file deve contenere esattamente un evento generico." };
  return { ok: true, genericEvent: normalizeGenericEvent(list[0]) };
}

// Export/Import singolo SpecificEvent (schema 2.3).
export function buildSingleSpecificEventExport(specificEvent) {
  return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), items: [stripInternalFields(specificEvent)] };
}
export function parseSingleSpecificEventImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) return { ok: false, error: "Struttura del file non riconosciuta." };
  const list = data.items.filter(it => it && it.type === "specific_event");
  if (list.length !== 1 || data.items.length !== 1) return { ok: false, error: "Il file deve contenere esattamente un evento specifico." };
  return { ok: true, specificEvent: normalizeSpecificEvent(list[0]) };
}

// Export di un singolo portiere (stesso pattern dell'esercizio singolo: solo l'oggetto).
export function buildSingleGoalkeeperExport(goalkeeper) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items: [stripInternalFields(goalkeeper)]
  };
}

// Export di una singola stagione + gli eventi ad essa collegati (items: [season, ...events]).
export function buildSingleSeasonExport(season, linkedEvents) {
  const items = [stripInternalFields(season)];
  (linkedEvents || []).forEach(ev => items.push(stripInternalFields(ev)));
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items
  };
}

// Import di una stagione singola: esattamente UNA season, più eventuali elementi collegati
// (eventi legacy, eventi generici, eventi specifici). Ritorna { ok, error?, season, events, genericEvents, specificEvents }.
export function parseSingleSeasonImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  if (!Array.isArray(data.items)) return { ok: false, error: "Il file non contiene la lista 'items'." };
  const seasons = data.items.filter(it => it && it.type === "season");
  if (seasons.length !== 1) return { ok: false, error: "Il file deve contenere esattamente una stagione." };
  const events = data.items.filter(it => it && it.type === "event").map(normalizeEvent);
  const genericEvents = data.items.filter(it => it && it.type === "generic_event").map(normalizeGenericEvent);
  const specificEvents = data.items.filter(it => it && it.type === "specific_event").map(normalizeSpecificEvent);
  return { ok: true, season: normalizeSeason(seasons[0]), events, genericEvents, specificEvents };
}

// Export di un singolo evento.
export function buildSingleEventExport(event) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items: [stripInternalFields(event)]
  };
}
export function parseSingleEventImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  if (!Array.isArray(data.items)) return { ok: false, error: "Il file non contiene la lista 'items'." };
  const evs = data.items.filter(it => it && it.type === "event");
  if (evs.length !== 1 || data.items.length !== 1) {
    return { ok: false, error: "Il file deve contenere esattamente un evento." };
  }
  return { ok: true, event: normalizeEvent(evs[0]) };
}

// Import di un singolo portiere: esattamente UN item di tipo goalkeeper.
export function parseSingleGoalkeeperImport(rawText) {
  let data;
  try { data = JSON.parse(rawText); }
  catch (_) { return { ok: false, error: "Il file non è un JSON valido." }; }
  if (!data || typeof data !== "object") return { ok: false, error: "Struttura del file non riconosciuta." };
  if (!Array.isArray(data.items)) return { ok: false, error: "Il file non contiene la lista 'items'." };
  const gks = data.items.filter(it => it && it.type === "goalkeeper");
  if (data.items.length === 0) return { ok: false, error: "Il file non contiene alcun elemento." };
  if (gks.length !== 1 || data.items.length !== 1) {
    return { ok: false, error: "Il file deve contenere esattamente un portiere." };
  }
  return { ok: true, goalkeeper: normalizeGoalkeeper(gks[0]) };
}
function intOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

// --- Helpers file ---
export function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lettura del file non riuscita"));
    reader.readAsText(file);
  });
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lettura dell'immagine non riuscita"));
    reader.readAsDataURL(file);
  });
}

// Ridimensiona/comprime un'immagine lato client prima di salvarla come data URL in
// IndexedDB: una foto da smartphone può pesare diversi MB, e senza questo passaggio finisce
// intera in RAM/IndexedDB a ogni avvio (rallentamenti) e, con la sincronizzazione cloud
// attiva, anche intera in upload verso Supabase Storage a ogni dispositivo. Ridisegna su
// canvas al massimo lato indicato (mantenendo le proporzioni) e ricodifica in JPEG (o PNG
// se l'originale può avere trasparenza), alla qualità indicata. Se il file è già piccolo, o
// non decodificabile dal canvas (formato non supportato), o la ricompressione non porta
// benefici, ricade sul data URL originale: non blocca mai il caricamento di un'immagine.
export function resizeImageFile(file, { maxSize = 1600, quality = 0.82, skipUnderBytes = 400 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura dell'immagine non riuscita"));
    reader.onload = () => {
      const original = reader.result;
      if (typeof file.size === "number" && file.size <= skipUnderBytes) { resolve(original); return; }
      const img = new Image();
      img.onerror = () => resolve(original); // non decodificabile dal canvas (es. SVG): usa l'originale
      img.onload = () => {
        try {
          const { width, height } = img;
          const scale = Math.min(1, maxSize / Math.max(width, height));
          const w = Math.max(1, Math.round(width * scale));
          const h = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(original); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const mime = /png|gif|webp/.test(file.type || "") ? "image/png" : "image/jpeg";
          const out = canvas.toDataURL(mime, mime === "image/jpeg" ? quality : undefined);
          resolve(out && out.length < original.length ? out : original);
        } catch (_) { resolve(original); }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
