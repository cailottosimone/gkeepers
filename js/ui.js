// ui.js
// Orchestrazione dell'interfaccia: navigazione, indice esercizi, form di
// creazione/modifica (con editor SVG), dettaglio con stampa/PDF, sedute,
// impostazioni e import/export. Interfaccia interamente in italiano.

import { storage } from "./storage.js";
import { SvgEditor, parseEditorSvg, composeExerciseSvg } from "./svgEditor.js";
import { SettingsPanel } from "./settings.js";
import { TagPicker } from "./tagPicker.js";
import { MaterialQtyPicker, materialQtyMatches } from "./materialFilter.js";
import { placeSymbol, PREFERRED_FOOT_LABELS, HEALTH_STATUS_ORDER, HEALTH_STATUS_LABELS } from "./defaults.js";
import { aggregateSession, formatDuration, estimateExerciseDuration } from "./session.js";
import { DAY_LABELS, DAY_LABELS_SHORT, MONTH_LABELS, MONTH_LABELS_SHORT, EVENT_TYPE_LABELS, DAY_TYPES, DAY_TYPE_LABELS, parseDateISO, toISODate, addDays, mondayOf, isoWeekday, dayDate, dayItemCount, generateWeekStartDates, ensureWeekShape, syncWeekFlats, buildWeekFromTemplate, regenerateWeeks, countPlannedWeeks } from "./seasonLogic.js";
import { exportToJsonString, parseImport, triggerDownload, readFileAsText, resizeImageFile, migrateExerciseToCurrent, migrateSessionToCurrent, buildSingleExerciseExport, buildConfigExport, parseSingleExerciseImport, parseConfigImport, buildProfileExport, parseProfileImport, buildSingleGoalkeeperExport, parseSingleGoalkeeperImport, normalizeGoalkeeper, buildSingleSeasonExport, parseSingleSeasonImport, buildSingleEventExport, parseSingleEventImport, normalizeSeason, normalizeEvent, buildSingleGenericEventExport, parseSingleGenericEventImport, buildSingleSpecificEventExport, parseSingleSpecificEventImport, normalizeGenericEvent, normalizeSpecificEvent } from "./importExport.js";
import { mountSyncIndicator } from "./components/sync-indicator.js";
import { initSync, state as syncState, onSyncStateChange, needsLinkDecision, linkPushingLocalData, linkPullingFromCloud } from "./data/sync.js";
import { getCurrentUser, onAuthChange, signIn, signUp, signOut } from "./data/auth.js";

const STATUS_LABEL = { favorite: "Preferito", memory: "In memoria" };

// Icone azione overlay card (stroke = currentColor)
const ICO_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICO_DUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const ICO_DEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
const ICO_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>`;
const ICO_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
// Icona a imbuto per il pattern "pannello filtri collassabile" (riutilizzata ovunque, mai la lente di ricerca).
const ICO_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6.5 7.5V19l-3 2v-8.5L4 5Z"/></svg>`;
// Placeholder campo da calcio stilizzato (grigio medio) per card senza SVG
const FIELD_PLACEHOLDER = `<svg viewBox="0 0 120 80" class="ex-ph-svg" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="8" y="8" width="104" height="64" rx="3"/><line x1="60" y1="8" x2="60" y2="72"/><circle cx="60" cy="40" r="13"/><path d="M8 26h14v28H8M112 26H98v28h14"/></svg>`;

// Icone di navigazione (outline, currentColor)
const _svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const NAV_ICONS = {
  esercizi: _svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7"/>'),
  sedute: _svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h2M14 14h2M8 17h2M14 17h2"/>'),
  portieri: _svg('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>'),
  stagione: _svg('<path d="M12 3v3M5 7l2 2M19 7l-2 2"/><circle cx="12" cy="14" r="7"/><path d="M12 11v3l2 1.5"/>'),
  presenze: _svg('<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/>'),
  report: _svg('<path d="M4 19V10M10 19V5M16 19v-7M3 19h18"/>'),
  impostazioni: _svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L16.2 2H11.8l-.4 2.4a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.4h4.4l.4-2.4a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5A7 7 0 0 0 19 12Z"/>'),
  profilo: _svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>')
};

export class UI {
  constructor(root) {
    this.root = root;
    this.exercises = [];
    this.sessions = [];
    this.goalkeepers = [];
    this.seasons = [];
    this.events = [];
    this.attendances = [];
    this.attFilter = { type: "", gkIds: [], from: "", to: "", status: "all", seasonId: "" }; // filtri vista Presenze
    this.attView = { detailId: null }; // registro presenze impegno aperto (null = vista elenco)
    this.gkAccordion = null; // stato sezioni espandibili (Storico sedute/presenze/Esercizi effettuati) della scheda portiere aperta
    this.reportState = { goalkeeperId: "", seasonId: "", from: "", to: "", result: null }; // vista Report
    this._pendingGkAccordionOpen = null; // richiesta di apertura diretta di una sezione accordion (usata da Report → "Vedi elenco completo")
    this.genericEvents = [];
    this.specificEvents = [];
    this.gkFilter = { q: "", category: "", status: "all" }; // status: "all" | "active" | "inactive"
    this.gkForm = null;        // stato transitorio del form portiere
    this.stagioneTab = "seasons"; // "seasons" | "specifics"
    this.specificFilter = { type: "", from: "", to: "" };
    this.seasonForm = null;    // stato transitorio del form stagione (metadati + template)
    this.specificForm = null;  // stato transitorio del form evento specifico
    this.seasonView = { id: null, calView: "week", weekStart: null, calMonth: null, actFrom: "", actTo: "" };
    this._pendingEventAssign = null; // contesto per assegnare un evento appena creato a un giorno
    this.customLists = null;
    this.route = "esercizi";
    this.profile = null;       // profilo locale (singleton), caricato in init
    this.editor = null;
    this.editingId = null;
    this.formState = null;     // stato transitorio del form (allegati, link, selezioni)
    this.composer = null;      // stato transitorio della seduta in composizione
    this.filter = { q: "", status: new Set(), gestures: [], qualities: [], periods: [], materials: [], logic: { gestures: "or", qualities: "or", periods: "or", materials: "or" } };
    this.sessionFilter = { q: "", status: new Set(), qualities: [], periods: [], materials: [], logic: { qualities: "or", periods: "or", materials: "or" } };
    this.composerFilter = { q: "", status: new Set(), gestures: [], qualities: [], periods: [], materials: [], logic: { gestures: "or", qualities: "or", periods: "or", materials: "or" } };
    this._pickers = [];        // TagPicker attivi, da distruggere al cambio vista
    this.gridCols = "auto";    // colonne indice esercizi: "auto" | "2" | "3" | "4" (ricordato in sessione)
    this._accountSyncUnsub = []; // listener di data/sync.js e data/auth.js attivi solo mentre Impostazioni è aperta
    this._accountDraft = null;   // stato transitorio del form login/registrazione (Account e sincronizzazione)
  }

  _destroyPickers() {
    this._pickers.forEach(p => { try { p.destroy(); } catch (_) {} });
    this._pickers = [];
    this.tpGestures = this.tpQualities = this.tpPeriods = null;
    this.fpGestures = this.fpQualities = this.fpMaterials = this.fpPeriods = null;
  }

  async init() {
    this.customLists = await storage.getCustomLists();
    this.exercises = await storage.getAllExercises();
    this.sessions = await storage.getAllSessions();
    this.goalkeepers = await storage.getAllGoalkeepers();
    this.seasons = await storage.getAllSeasons();
    this.events = await storage.getAllEvents();
    this.attendances = await storage.getAllAttendances();
    this.genericEvents = await storage.getAllGenericEvents();
    this.specificEvents = await storage.getAllSpecificEvents();
    await this._migrateExercisesIfNeeded();
    await this._recomputeSessionAggregates();
    await this._loadProfile();

    // Reset del blocco di emergenza: ?resetlock=true disattiva il PIN (da comunicare solo all'utente reale).
    if (this._hasResetLockParam()) {
      if (this.profile.appLock) { this.profile.appLock.enabled = false; this.profile.appLock.lockOnStart = false; this.profile.appLock.pinHash = null; }
      this.profile.updatedAt = new Date().toISOString();
      await storage.saveProfile(this.profile);
    }

    const lock = this.profile.appLock || {};
    if (lock.enabled && lock.lockOnStart && lock.pinHash) {
      // Schermata di blocco PRIMA di qualsiasi contenuto. NB: è un deterrente locale, non sicurezza vera.
      this._renderLockScreen(() => { this._buildShell(); this.setRoute("esercizi"); this._startSync(); });
      return;
    }
    this._buildShell();
    this.setRoute("esercizi");
    this._startSync();
  }

  // Avvia il motore di sincronizzazione cloud (facoltativo: senza account collegato l'app
  // resta esattamente come prima, solo IndexedDB locale). Aggiorna in background le collezioni
  // in memoria dopo ogni giro riuscito, così la PROSSIMA navigazione mostra dati aggiornati,
  // senza mai forzare un re-render dell'eventuale form che l'utente sta compilando in questo
  // momento (evita di perdere modifiche non salvate a causa di un pull arrivato nel frattempo).
  _startSync() {
    let wasSyncing = false;
    onSyncStateChange(async (st) => {
      if (st.status === "syncing") { wasSyncing = true; return; }
      if (wasSyncing && (st.status === "idle" || st.status === "error")) {
        wasSyncing = false;
        await this._reloadCollectionsFromStorage();
      }
    });
    initSync();
  }

  async _reloadCollectionsFromStorage() {
    this.customLists = await storage.getCustomLists();
    this.exercises = await storage.getAllExercises();
    this.sessions = await storage.getAllSessions();
    this.goalkeepers = await storage.getAllGoalkeepers();
    this.seasons = await storage.getAllSeasons();
    this.events = await storage.getAllEvents();
    this.attendances = await storage.getAllAttendances();
    this.genericEvents = await storage.getAllGenericEvents();
    this.specificEvents = await storage.getAllSpecificEvents();
    const freshProfile = await storage.getProfile();
    if (freshProfile) {
      if (freshProfile.appMode !== "semplice" && freshProfile.appMode !== "completa") freshProfile.appMode = "semplice";
      this.profile = freshProfile;
      this._refreshLogoBadge();
    }
  }

  // Carica il profilo locale; al primo avvio dopo l'aggiornamento lo crea vuoto (senza blocco).
  async _loadProfile() {
    let p = await storage.getProfile();
    if (!p) {
      const now = new Date().toISOString();
      p = {
        type: "profile", id: genId(), createdAt: now, updatedAt: now,
        firstName: "", lastName: "", role: null, clubs: [], logo: null,
        contactEmail: null, contactPhone: null,
        appLock: { enabled: false, pinHash: null, lockOnStart: false },
        appMode: "semplice"
      };
      await storage.saveProfile(p);
    }
    if (!p.appLock || typeof p.appLock !== "object") p.appLock = { enabled: false, pinHash: null, lockOnStart: false };
    // Fallback difensivo (schema pre-esistente / valore corrotto): la modalità semplificata
    // è il default per i profili creati prima di questo campo.
    if (p.appMode !== "semplice" && p.appMode !== "completa") p.appMode = "semplice";
    this.profile = p;
  }

  _hasResetLockParam() {
    try { return new URLSearchParams(window.location.search).get("resetlock") === "true"; }
    catch (_) { return false; }
  }

  // SHA-256 nativo (Web Crypto). NB: hashing di un PIN corto NON è sicurezza crittografica reale;
  // qui serve solo a non salvare il PIN in chiaro per un blocco-deterrente locale.
  async _sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // (7C) Ricalcola materialsAggregated delle sedute salvate con la logica MAX.
  // Idempotente: il MAX sullo stesso insieme di esercizi non cambia ai caricamenti successivi.
  async _recomputeSessionAggregates() {
    const byId = new Map(this.exercises.map(e => [e.id, e]));
    const norm = (arr) => [...(arr || [])].map(m => `${m.key}:${Number(m.qty) || 0}`).sort().join("|");
    const changed = [];
    this.sessions = this.sessions.map(s => {
      const exs = (s.exerciseIds || []).map(id => byId.get(id)).filter(Boolean);
      const recomputed = aggregateSession(exs).materialsAggregated;
      const current = (s.aggregated && s.aggregated.materialsAggregated) || [];
      if (norm(current) !== norm(recomputed)) {
        s.aggregated = { ...(s.aggregated || {}), materialsAggregated: recomputed };
        changed.push(s);
      }
      return s;
    });
    if (changed.length) {
      await storage.bulkPutSessions(changed);
      console.info(`Riepilogo Seduta: ricalcolo MAX materiali su ${changed.length} sedute.`);
    }
  }

  // Migrazione automatica allo schema corrente (2.1) per dati già salvati.
  async _migrateExercisesIfNeeded() {
    const migratedEx = [];
    this.exercises = this.exercises.map(ex => {
      const res = migrateExerciseToCurrent(ex);
      if (res.changed) migratedEx.push(res.item);
      return res.item;
    });
    if (migratedEx.length) await storage.bulkPutExercises(migratedEx);

    const migratedSe = [];
    this.sessions = this.sessions.map(s => {
      const res = migrateSessionToCurrent(s);
      if (res.changed) migratedSe.push(res.item);
      return res.item;
    });
    if (migratedSe.length) await storage.bulkPutSessions(migratedSe);

    if (migratedEx.length || migratedSe.length) {
      console.info(`Migrazione allo schema corrente: ${migratedEx.length} esercizi, ${migratedSe.length} sedute aggiornati.`);
    }
  }

  // ---------- Shell / navigazione (barra orizzontale superiore) ----------
  _navItems() {
    // Nota: "Profilo" NON è una voce di menu: si accede dal chip profilo nella barra.
    const isSimple = !this.profile || this.profile.appMode !== "completa";
    const full = [
      ["esercizi", "Esercizi", NAV_ICONS.esercizi],
      ["sedute", "Sedute", NAV_ICONS.sedute],
      ["portieri", "Portieri", NAV_ICONS.portieri],
      ["stagione", "Stagione", NAV_ICONS.stagione],
      ["presenze", "Presenze", NAV_ICONS.presenze],
      ["report", "Report", NAV_ICONS.report],
      ["impostazioni", "Impostazioni", NAV_ICONS.impostazioni]
    ];
    // In modalità semplice le sezioni avanzate restano nel codice ma escono dalla nav:
    // riattivabili in qualsiasi momento passando a "completa" in Impostazioni, senza
    // perdita di dati (nessun record viene toccato da questo filtro).
    return isSimple ? full.filter(([r]) => r !== "presenze" && r !== "report") : full;
  }
  _isModuleHiddenInCurrentMode(route) {
    const isSimple = !this.profile || this.profile.appMode !== "completa";
    return isSimple && (route === "presenze" || route === "report");
  }
  // Iniziali per l'avatar (es. "Simone Cailotto" -> "SC").
  _accountInitials(p) {
    const a = (p.firstName || "").trim();
    const b = (p.lastName || "").trim();
    let ini = (a[0] || "") + (b[0] || "");
    if (!ini && p.clubs && p.clubs.length) ini = (p.clubs[0][0] || "");
    return ini.toUpperCase();
  }
  // Blocco account compatto nella barra: [ testo 2 righe (dx) ][ avatar tondo 32px ].
  // Unico target cliccabile -> apre la schermata Profilo.
  _profileChipHtml() {
    const p = this.profile || {};
    const hasIdentity = !!(p.firstName || p.lastName || (p.clubs && p.clubs.length) || p.logo);
    // Avatar (elemento più a destra): SEMPRE dentro un wrapper .account-avatar 32px fisso,
    // così l'immagine caricata (anche enorme) è vincolata e ritagliata, mai a dimensione originale.
    let avatar;
    if (p.logo) {
      avatar = `<span class="account-avatar"><img src="${escapeAttr(p.logo)}" alt="Logo profilo"></span>`;
    } else if (hasIdentity) {
      const ini = this._accountInitials(p) || "?";
      avatar = `<span class="account-avatar acct-ini">${escapeHtml(ini)}</span>`;
    } else {
      avatar = `<span class="account-avatar acct-empty" aria-hidden="true">${NAV_ICONS.profilo}</span>`;
    }
    // Testo (due righe, allineate a destra). Seconda riga: SOLO la squadra/e (il ruolo
    // resta nel form profilo ma non viene mostrato qui). Senza squadre la riga non si rende.
    let line1, line2 = "";
    if (!hasIdentity) {
      line1 = "Configura profilo";
    } else {
      line1 = escapeHtml([p.firstName, p.lastName].filter(Boolean).join(" ")) || "Profilo";
      if (p.clubs && p.clubs.length) {
        const extra = p.clubs.length - 1;
        line2 = `<span class="acct-sub">${escapeHtml(p.clubs[0])}${extra > 0 ? ` +${extra} altre` : ""}</span>`;
      }
    }
    return `<button type="button" class="account-block" data-route="profilo" aria-label="${hasIdentity ? "Apri profilo" : "Configura profilo"}">
      <span class="acct-text"><span class="acct-name">${line1}</span>${line2}</span>
      ${avatar}
    </button>`;
  }
  _buildShell() {
    const items = this._navItems();
    this.root.innerHTML = `
      <header class="topbar">
        <div class="topbar-left">
          <button type="button" class="nav-hamburger" id="nav-hamburger" aria-label="Apri menu" aria-expanded="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40"><rect x="5" y="8" width="30" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M5 14h30M5 20h30M12 8v20M20 8v20M28 8v20" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>
            </span>
            <div>
              <h1>Repository Esercizi Portieri</h1>
              <p class="brand-sub">Archivio locale · offline · senza AI</p>
            </div>
          </div>
        </div>
        <div class="topbar-right">
          <nav class="app-nav" id="app-nav" aria-label="Navigazione principale">
            ${items.map(([r, label, ico]) => `<button type="button" class="nav-btn" data-route="${r}"><span class="nav-ico" aria-hidden="true">${ico}</span><span class="nav-label">${label}</span></button>`).join("")}
          </nav>
          <button type="button" class="sync-indicator" id="sync-indicator-btn" aria-label="Sincronizzazione cloud"></button>
          <div class="pf-chip-wrap" id="pf-chip-wrap">${this._profileChipHtml()}</div>
        </div>
        <div class="nav-scrim" id="nav-scrim" hidden></div>
      </header>
      <main class="app-main" id="app-main"></main>
      <div id="toast-stack" class="toast-stack" aria-live="polite"></div>
    `;
    this.main = this.root.querySelector("#app-main");
    this.root.querySelectorAll("[data-route]").forEach(b => {
      b.addEventListener("click", () => { this.setRoute(b.dataset.route); this._closeMobileNav(); });
    });
    const ham = this.root.querySelector("#nav-hamburger");
    const scrim = this.root.querySelector("#nav-scrim");
    ham.addEventListener("click", () => this._toggleMobileNav());
    scrim.addEventListener("click", () => this._closeMobileNav());
    mountSyncIndicator(this.root.querySelector("#sync-indicator-btn"), () => {
      this.setRoute("impostazioni");
      this._closeMobileNav();
      setTimeout(() => {
        const mount = this.main.querySelector("#account-sync-mount");
        if (mount) mount.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    });
  }
  _toggleMobileNav() {
    const nav = this.root.querySelector("#app-nav");
    const scrim = this.root.querySelector("#nav-scrim");
    const ham = this.root.querySelector("#nav-hamburger");
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    scrim.hidden = !open;
    ham.setAttribute("aria-expanded", open ? "true" : "false");
  }
  _closeMobileNav() {
    const nav = this.root.querySelector("#app-nav");
    if (!nav) return;
    nav.classList.remove("is-open");
    const scrim = this.root.querySelector("#nav-scrim"); if (scrim) scrim.hidden = true;
    const ham = this.root.querySelector("#nav-hamburger"); if (ham) ham.setAttribute("aria-expanded", "false");
  }
  // Aggiorna il chip profilo nella barra dopo salvataggio/import.
  _refreshLogoBadge() {
    const wrap = this.root.querySelector("#pf-chip-wrap");
    if (!wrap) return;
    wrap.innerHTML = this._profileChipHtml();
    const btn = wrap.querySelector("[data-route]");
    if (btn) {
      btn.addEventListener("click", () => { this.setRoute("profilo"); this._closeMobileNav(); });
      if (this.route === "profilo") btn.classList.add("is-active");
    }
  }

  setRoute(route, param) {
    // Guardia modalità: Presenze/Report restano nel codice ma non sono raggiungibili in
    // modalità semplice (link salvati, deep-link, tasti Indietro del browser...).
    if (this._isModuleHiddenInCurrentMode(route)) route = "esercizi";
    this.route = route;
    // Le viste editor/dettaglio appartengono alla sezione "esercizi"; le gk-* a "portieri".
    const navOf = (route === "editor" || route === "dettaglio") ? "esercizi"
      : (route === "gk-editor" || route === "gk-dettaglio") ? "portieri"
      : (route === "season-edit" || route === "season-cal" || route === "event-edit") ? "stagione"
      : route;
    this.root.querySelectorAll("[data-route]").forEach(b => {
      b.classList.toggle("is-active", b.dataset.route === navOf);
    });
    this.editor = null;
    this._destroyPickers();
    this._accountSyncUnsub.forEach(fn => { try { fn(); } catch (_) {} });
    this._accountSyncUnsub = [];
    document.body.classList.remove("printing");
    switch (route) {
      case "esercizi": this.renderEsercizi(); break;
      case "editor": this.renderEditor(param); break;
      case "dettaglio": this.renderDettaglio(param); break;
      case "sedute": this.renderSedute(); break;
      case "impostazioni": this.renderImpostazioni(); break;
      case "profilo": this.renderProfilo(); break;
      case "portieri": this.renderPortieri(); break;
      case "gk-editor": this.renderGoalkeeperEditor(param); break;
      case "gk-dettaglio": this.renderGoalkeeperDetail(param); break;
      case "stagione": this.renderStagione(); break;
      case "season-edit": this.renderSeasonEditor(param); break;
      case "season-cal": this.renderSeasonCalendar(param); break;
      case "event-edit": this.renderSpecificEditor(param); break;
      case "presenze": this.renderPresenze(param); break;
      case "report": this.renderReport(param); break;
      default: this.renderEsercizi();
    }
    window.scrollTo(0, 0);
  }

  // Segnaposto pulito per le sezioni in arrivo (Portieri, Stagione, Presenze).
  _renderPlaceholder(title, subtitle) {
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(subtitle || "")}</p></div></div>
        <div class="coming-soon">
          <span class="coming-soon-ico" aria-hidden="true">${NAV_ICONS[title.toLowerCase()] || ""}</span>
          <h3>In arrivo</h3>
          <p>Questa sezione sarà disponibile in un prossimo aggiornamento.</p>
        </div>
      </section>`;
  }

  // ---------- Indice esercizi ----------
  renderEsercizi() {
    this._destroyPickers();
    const list = this._filteredExercises();
    const statusOn = (s) => this.filter.status.has(s) ? "is-on" : "";
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head">
          <div>
            <h2>Esercizi</h2>
            <p class="muted">${this.exercises.length} in archivio</p>
          </div>
          <div class="head-actions">
            ${this._colToggleHtml()}
            <button type="button" class="btn btn-soft" id="btn-import-ex">Importa esercizio</button>
            <button type="button" class="btn btn-primary" id="btn-new">＋ Nuovo esercizio</button>
          </div>
        </div>

        <div class="filters card-soft">
          <div class="filters-topbar">
            <input type="search" id="search" class="input" placeholder="Cerca per titolo o descrizione…" value="${escapeAttr(this.filter.q)}">
            ${this._filterToggleBtnHtml("esercizi", this._esFilterCount())}
          </div>
          <div class="filters-collapse" id="fp-collapse-esercizi">
            <div class="filters-pickers">
              <div class="filter-field"><span class="field-label">Gesti tecnici</span><div id="fp-gestures"></div>${this._logicRowHtml("gestures")}</div>
              <div class="filter-field"><span class="field-label">Qualità allenate</span><div id="fp-qualities"></div>${this._logicRowHtml("qualities")}</div>
              <div class="filter-field"><span class="field-label">Periodo</span><div id="fp-periods"></div>${this._logicRowHtml("periods")}</div>
              <div class="filter-field"><span class="field-label">Materiali</span><div id="fp-materials"></div>${this._logicRowHtml("materials")}</div>
            </div>
            <div class="filters-foot">
              <div class="seg filter-status">
                <button type="button" class="seg-btn ${statusOn('favorite')}" data-fstatus="favorite">Preferiti</button>
                <button type="button" class="seg-btn ${statusOn('memory')}" data-fstatus="memory">In memoria</button>
                <button type="button" class="seg-btn ${statusOn('importato')}" data-fstatus="importato">Importati</button>
              </div>
              <div class="filters-foot-right">
                <span class="filters-count" id="filters-count">${list.length} esercizi trovati</span>
                <button type="button" class="link-btn" id="btn-clear-filters">Cancella filtri</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-grid" id="exercise-grid" data-cols="${this.gridCols}">
          ${list.length ? list.map(ex => this._exerciseCard(ex)).join("") : this._empty("Nessun esercizio. Creane uno nuovo o importa un backup dalle Impostazioni.")}
        </div>
      </section>
    `;
    this.main.querySelector("#btn-new").addEventListener("click", () => this.setRoute("editor", null));
    this.main.querySelector("#btn-import-ex").addEventListener("click", () => this._promptImportExercise());
    const search = this.main.querySelector("#search");
    search.addEventListener("input", () => { this.filter.q = search.value; this._refreshGrid(); });

    // tag picker dei filtri
    this.fpGestures = new TagPicker(this.main.querySelector("#fp-gestures"), {
      getOptions: () => this.customLists.technicalGestures || [],
      selected: this.filter.gestures,
      placeholder: "Filtra per gesto…",
      onChange: (sel) => { this.filter.gestures = sel; this._syncLogicToggles(this.main, this.filter); this._refreshGrid(); }
    });
    this.fpQualities = new TagPicker(this.main.querySelector("#fp-qualities"), {
      getOptions: () => this.customLists.trainedQualities || [],
      selected: this.filter.qualities,
      placeholder: "Filtra per qualità…",
      onChange: (sel) => { this.filter.qualities = sel; this._syncLogicToggles(this.main, this.filter); this._refreshGrid(); }
    });
    this.fpPeriods = new TagPicker(this.main.querySelector("#fp-periods"), {
      getOptions: () => this.customLists.trainingPeriods || [],
      selected: this.filter.periods,
      placeholder: "Filtra per periodo…",
      onChange: (sel) => { this.filter.periods = sel; this._syncLogicToggles(this.main, this.filter); this._refreshGrid(); }
    });
    this.fpMaterials = new MaterialQtyPicker(this.main.querySelector("#fp-materials"), {
      getMaterials: () => this.customLists.materials || [],
      selected: this.filter.materials,
      placeholder: "Filtra per materiale…",
      onChange: (sel) => { this.filter.materials = sel; this._syncLogicToggles(this.main, this.filter); this._refreshGrid(); }
    });
    this._pickers.push(this.fpGestures, this.fpQualities, this.fpPeriods, this.fpMaterials);
    this._wireLogicToggles(this.main, this.filter, () => this._refreshGrid());
    this._syncLogicToggles(this.main, this.filter);

    this.main.querySelectorAll("[data-fstatus]").forEach(b => {
      b.addEventListener("click", () => {
        const s = b.dataset.fstatus;
        if (this.filter.status.has(s)) this.filter.status.delete(s); else this.filter.status.add(s);
        b.classList.toggle("is-on");
        this._refreshGrid();
      });
    });
    this.main.querySelector("#btn-clear-filters").addEventListener("click", () => {
      this.filter = { q: "", status: new Set(), gestures: [], qualities: [], periods: [], materials: [], logic: { gestures: "or", qualities: "or", periods: "or", materials: "or" } };
      this.renderEsercizi();
    });

    this._wireCards();
    this._wireColToggle();
    this._wireFilterToggle(this.main, "esercizi");
  }

  // Conteggio filtri attivi per il badge (esclude la ricerca testuale, sempre visibile a parte).
  _esFilterCount() {
    const f = this.filter;
    return this._countActiveFilters([f.gestures.length > 0, f.qualities.length > 0, f.periods.length > 0, f.materials.length > 0, f.status.size > 0]);
  }

  // ---- Toggle colonne griglia indice (2 / 3 / 4; "auto" = 3 fino a 1400px, 4 oltre) ----
  _colToggleHtml() {
    const ico = {
      "2": '<rect x="2" y="3" width="6.5" height="14" rx="1.4"/><rect x="11.5" y="3" width="6.5" height="14" rx="1.4"/>',
      "3": '<rect x="2" y="4" width="4.4" height="12" rx="1.2"/><rect x="7.8" y="4" width="4.4" height="12" rx="1.2"/><rect x="13.6" y="4" width="4.4" height="12" rx="1.2"/>',
      "4": '<rect x="2" y="5" width="3.2" height="10" rx="1"/><rect x="6.6" y="5" width="3.2" height="10" rx="1"/><rect x="11.2" y="5" width="3.2" height="10" rx="1"/><rect x="15.8" y="5" width="3.2" height="10" rx="1"/>'
    };
    const btn = (n) => `<button type="button" class="col-btn" data-cols="${n}" title="${n} colonne" aria-label="${n} colonne"><svg viewBox="0 0 20 20" width="19" height="19" fill="currentColor">${ico[n]}</svg></button>`;
    return `<div class="col-toggle" role="group" aria-label="Numero di colonne">${btn("2")}${btn("3")}${btn("4")}</div>`;
  }
  _effectiveCols() {
    if (this.gridCols === "2" || this.gridCols === "3" || this.gridCols === "4") return this.gridCols;
    return (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width:1400px)").matches) ? "4" : "3";
  }
  _syncColToggle() {
    const active = this._effectiveCols();
    this.main.querySelectorAll(".col-btn").forEach(b => b.classList.toggle("is-on", b.dataset.cols === active));
  }
  _wireColToggle() {
    this.main.querySelectorAll(".col-btn").forEach(b =>
      b.addEventListener("click", () => {
        this.gridCols = b.dataset.cols;
        const grid = this.main.querySelector("#exercise-grid");
        if (grid) grid.dataset.cols = this.gridCols;
        this._syncColToggle();
        this._fitCardTags();   // la larghezza delle colonne è cambiata: riadatta i tag
      }));
    this._syncColToggle();
    if (!this._colResizeBound) {
      this._colResizeBound = () => { if (this.route === "esercizi" && this.gridCols === "auto") this._syncColToggle(); };
      window.addEventListener("resize", this._colResizeBound);
    }
  }

  _refreshGrid() {
    const grid = this.main.querySelector("#exercise-grid");
    if (!grid) return;
    const list = this._filteredExercises();
    grid.innerHTML = list.length ? list.map(ex => this._exerciseCard(ex)).join("")
      : this._empty("Nessun esercizio corrisponde ai filtri.");
    const count = this.main.querySelector("#filters-count");
    if (count) count.textContent = `${list.length} esercizi trovati`;
    this._updateFilterBadge(this.main, "esercizi", this._esFilterCount());
    this._wireCards();
  }

  // ---- Toggle logica AND/OR per i filtri multi-selezione (condiviso esercizi/sedute) ----
  // Riga testuale leggibile, mostrata sotto i tag selezionati solo con ≥2 voci.
  _logicRowHtml(key) {
    return `<div class="logic-row" data-logic="${key}" hidden>
      <span class="logic-pre">Cerca esercizi che includono</span>
      <button type="button" class="logic-toggle-btn" data-logic="${key}" title="Cambia tra «almeno uno» e «tutti questi»">
        <span class="logic-val">almeno uno</span><span class="logic-chev" aria-hidden="true">▾</span>
      </button>
    </div>`;
  }
  // Coppia di campi data (dal → al) affiancata e visivamente unita, coerente in tutta l'app.
  // Restituisce un unico blocco che occupa due colonne nella griglia dei filtri.
  _dateRangeHtml(fromId, toId, fromVal, toVal, label = "Intervallo date") {
    return `<div class="filter-field filter-daterange">
      <span class="field-label">${escapeHtml(label)}</span>
      <div class="filter-daterange-pair">
        <span class="fdr-field"><input type="date" class="input" id="${escapeAttr(fromId)}" value="${escapeAttr(fromVal || "")}" aria-label="Dal"></span>
        <span class="fdr-sep" aria-hidden="true">→</span>
        <span class="fdr-field"><input type="date" class="input" id="${escapeAttr(toId)}" value="${escapeAttr(toVal || "")}" aria-label="Al"></span>
      </div>
    </div>`;
  }

  // ---------- Pattern riutilizzabile: pannello filtri collassabile (icona a imbuto + badge) ----------
  // Usato ovunque i filtri non siano il fulcro della sezione (Esercizi, Sedute, Portieri, e come
  // secondo livello dentro le sezioni espandibili della scheda portiere). Non usato in Report e
  // Presenze, dove i filtri restano sempre visibili.
  _countActiveFilters(flags) { return flags.filter(Boolean).length; }

  // Pulsante a imbuto con badge numerico; panelId deve essere univoco nella vista corrente.
  _filterToggleBtnHtml(panelId, activeCount) {
    return `<button type="button" class="filter-toggle-btn" data-filtertoggle="${escapeAttr(panelId)}" aria-expanded="false" aria-controls="fp-collapse-${escapeAttr(panelId)}" title="Filtri">
      ${ICO_FILTER}
      <span class="filter-toggle-badge" ${activeCount > 0 ? "" : "hidden"}>${activeCount}</span>
    </button>`;
  }

  // Collega il click del pulsante all'apertura/chiusura del pannello (animazione max-height in CSS).
  _wireFilterToggle(scope, panelId) {
    const btn = scope.querySelector(`[data-filtertoggle="${panelId}"]`);
    const panel = scope.querySelector(`#fp-collapse-${panelId}`);
    if (!btn || !panel) return;
    btn.addEventListener("click", () => {
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      btn.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  // Aggiorna solo il badge numerico (da richiamare nei refresh parziali, senza ricostruire il pannello).
  _updateFilterBadge(scope, panelId, activeCount) {
    const btn = scope.querySelector(`[data-filtertoggle="${panelId}"]`);
    if (!btn) return;
    const badge = btn.querySelector(".filter-toggle-badge");
    if (!badge) return;
    if (activeCount > 0) { badge.textContent = String(activeCount); badge.hidden = false; }
    else badge.hidden = true;
  }

  _syncLogicToggles(root, filterObj) {
    root.querySelectorAll(".logic-row").forEach(row => {
      const key = row.dataset.logic;
      const count = (filterObj[key] || []).length;
      row.hidden = count < 2;   // con 1 sola voce AND/OR coincidono: riga nascosta
      const mode = (filterObj.logic && filterObj.logic[key]) || "or";
      const val = row.querySelector(".logic-val");
      if (val) val.textContent = mode === "and" ? "tutti questi" : "almeno uno";
      const btn = row.querySelector(".logic-toggle-btn");
      if (btn) btn.classList.toggle("is-and", mode === "and");
    });
  }
  _wireLogicToggles(root, filterObj, refreshFn) {
    root.querySelectorAll(".logic-toggle-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        const key = btn.dataset.logic;
        filterObj.logic[key] = (filterObj.logic[key] === "and") ? "or" : "and";
        this._syncLogicToggles(root, filterObj);
        refreshFn();
      }));
  }

  _filteredExercises() {
    return this._applyExerciseFilters(this.exercises, this.filter)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  // Logica di filtraggio esercizi condivisa (indice e selettore seduta).
  _applyExerciseFilters(list, f) {
    const q = (f.q || "").trim().toLowerCase();
    const statusSet = f.status;
    const matEntries = f.materials || [];   // [{ key, op, qty }]

    const matchStatus = (ex) => {
      if (!statusSet || statusSet.size === 0) return true;
      return (statusSet.has("favorite") && ex.status === "favorite")
        || (statusSet.has("memory") && ex.status === "memory")
        || (statusSet.has("importato") && ex.importato === true);
    };

    return (list || [])
      .filter(matchStatus)
      .filter(ex => !q || ((ex.title || "") + " " + (ex.description || "")).toLowerCase().includes(q))
      .filter(ex => matchMulti(ex.technicalGestures, f.gestures, f.logic.gestures))
      .filter(ex => matchMulti(ex.trainedQualities, f.qualities, f.logic.qualities))
      .filter(ex => matchMulti(ex.trainingPeriod, f.periods, f.logic.periods))
      .filter(ex => {
        if (!matEntries.length) return true;
        const exQty = new Map((ex.materials || []).map(m => [m.key, Number(m.qty) || 0]));
        const results = matEntries.map(e => materialQtyMatches(e.op, Number(e.qty) || 0, exQty.get(e.key) || 0));
        return f.logic.materials === "and" ? results.every(Boolean) : results.some(Boolean);
      });
  }

  _exerciseCard(ex) {
    const mats = new Map((ex.materials || []).map(m => [m.key, Number(m.qty) || 0]));
    const portiereQty = mats.get("portiere") || 0;
    const palloneQty = mats.get("pallone") || 0;
    const dur = formatDuration(ex.parameters?.estimatedTotalSeconds || 0);   // MM:SS compatto
    const showDuration = this.profile && this.profile.appMode === "completa";

    const tagRow = (label, arr) => {
      if (!arr || !arr.length) return "";
      // I tag effettivi vengono inseriti da _fitCardTags() in base allo spazio disponibile.
      return `<div class="ex-row" data-items="${escapeAttr(JSON.stringify(arr))}"><span class="ex-row-label">${label}</span><span class="ex-row-tags"></span></div>`;
    };
    const thumb = ex.svg
      ? safeSvg(composeExerciseSvg(ex.svg, this.customLists.materials, this.customLists.arrowTypes))
      : `<div class="ex-thumb-ph">${FIELD_PLACEHOLDER}</div>`;

    return `
      <article class="ex-card" data-id="${escapeAttr(ex.id)}" tabindex="0">
        <div class="ex-card-thumb">
          ${thumb}
          ${ex.importato ? `<span class="ex-flag" title="Esercizio importato">importato</span>` : ""}
          <button type="button" class="ex-fav ${ex.status === 'favorite' ? 'is-on' : ''}" data-fav="${escapeAttr(ex.id)}" title="Preferito" aria-label="Segna come preferito">★</button>
          <div class="ex-overlay">
            <button type="button" class="ex-ov-btn" data-edit="${escapeAttr(ex.id)}" title="Modifica esercizio" aria-label="Modifica esercizio">${ICO_EDIT}</button>
            <button type="button" class="ex-ov-btn" data-dup="${escapeAttr(ex.id)}" title="Duplica" aria-label="Duplica">${ICO_DUP}</button>
            <button type="button" class="ex-ov-btn" data-del="${escapeAttr(ex.id)}" title="Elimina" aria-label="Elimina">${ICO_DEL}</button>
          </div>
        </div>
        <div class="ex-card-body">
          <h3 class="ex-card-title">${escapeHtml(ex.title)}</h3>
          ${tagRow("Gesti", ex.technicalGestures)}
          ${tagRow("Qualità", ex.trainedQualities)}
        </div>
        <div class="ex-card-foot">
          <div class="ex-stat"><span class="ex-stat-top"><b class="ex-stat-num">${portiereQty}</b></span><span class="ex-stat-lbl">portieri</span></div>
          ${palloneQty > 0 ? `<div class="ex-stat"><span class="ex-stat-top"><b class="ex-stat-num">${palloneQty}</b></span><span class="ex-stat-lbl">palloni</span></div>` : ""}
          ${showDuration ? `<div class="ex-stat"><span class="ex-stat-top"><span class="ex-foot-ico ex-foot-clock">${ICO_CLOCK}</span><b class="ex-stat-num">${dur}</b></span><span class="ex-stat-lbl">durata</span></div>` : ""}
        </div>
      </article>`;
  }

  // Adatta i tag di "Gesti"/"Qualità" allo spazio su UNA riga: 2 tag, poi 1, poi ellissi.
  _fitCardTags() {
    const grid = this.main.querySelector("#exercise-grid");
    if (!grid) return;
    grid.querySelectorAll(".ex-row").forEach(row => {
      let items;
      try { items = JSON.parse(row.dataset.items || "[]"); } catch (_) { items = []; }
      const tagsEl = row.querySelector(".ex-row-tags");
      if (!tagsEl || !items.length) return;
      const total = items.length;
      const build = (n) => {
        const shown = items.slice(0, n).map(v => `<span class="ex-tag">${escapeHtml(v)}</span>`).join("");
        const hidden = total - n;
        return shown + (hidden > 0 ? `<span class="ex-tag-more">+${hidden} altri</span>` : "");
      };
      tagsEl.classList.remove("ex-tags-trunc");
      tagsEl.innerHTML = build(Math.min(2, total));
      if (tagsEl.scrollWidth > tagsEl.clientWidth + 1 && total > 1) tagsEl.innerHTML = build(1);
      if (tagsEl.scrollWidth > tagsEl.clientWidth + 1) tagsEl.classList.add("ex-tags-trunc");
    });
  }

  _wireCards() {
    this.main.querySelectorAll(".ex-card").forEach(card => {
      card.addEventListener("click", (e) => {
        // Apre il dettaglio ovunque tranne sulle icone azione e sulla stella.
        if (e.target.closest(".ex-ov-btn") || e.target.closest(".ex-fav")) return;
        this.setRoute("dettaglio", card.dataset.id);
      });
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); this.setRoute("dettaglio", card.dataset.id); }
      });
    });
    this.main.querySelectorAll("[data-edit]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("editor", el.dataset.edit); }));
    this.main.querySelectorAll("[data-del]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this._deleteExercise(el.dataset.del); }));
    this.main.querySelectorAll("[data-dup]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this._duplicateExercise(el.dataset.dup); }));
    this.main.querySelectorAll("[data-fav]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this._toggleFavorite(el.dataset.fav); }));
    this._fitCardTags();
    if (!this._tagsResizeBound) {
      this._tagsResizeBound = () => {
        if (this.route !== "esercizi") return;
        if (this._tagsRaf) cancelAnimationFrame(this._tagsRaf);
        this._tagsRaf = requestAnimationFrame(() => this._fitCardTags());
      };
      window.addEventListener("resize", this._tagsResizeBound);
    }
  }

  async _toggleFavorite(id) {
    const ex = this.exercises.find(x => x.id === id);
    if (!ex) return;
    ex.status = ex.status === "favorite" ? "memory" : "favorite";
    // Nessun aggiornamento di updatedAt: il cambio di stato NON deve riordinare l'elenco.
    await storage.putExercise(ex);
    this._refreshGrid();
  }

  async _deleteExercise(id) {
    const ex = this.exercises.find(x => x.id === id);
    if (!ex) return;
    if (!confirm(`Eliminare l'esercizio "${ex.title}"? L'operazione non è reversibile.`)) return;
    await storage.deleteExercise(id);
    this.exercises = this.exercises.filter(x => x.id !== id);
    this.toast("Esercizio eliminato.");
    if (this.route === "dettaglio") this.setRoute("esercizi");
    else this._refreshGrid();
  }

  // ---------- Form esercizio ----------
  renderEditor(id) {
    const editing = id ? this.exercises.find(x => x.id === id) : null;
    this.editingId = editing ? editing.id : null;

    // stato transitorio
    this.formState = {
      attachments: editing ? (editing.attachments || []).map(a => ({ ...a })) : [],
      links: editing ? (editing.links || []).map(l => ({ ...l })) : [],
      gestures: new Set(editing ? editing.technicalGestures || [] : []),
      qualities: new Set(editing ? editing.trainedQualities || [] : []),
      periods: new Set(editing ? editing.trainingPeriod || [] : []),
      materials: new Map(
        editing
          ? (editing.materials || []).map(m => [m.key, m.qty])
          : (this.customLists.materials.some(m => m.key === "portiere") ? [["portiere", 1]] : [])
      ),
      status: editing ? editing.status : "memory"
    };

    const p = editing?.parameters || { series: 3, reps: 8, workSeconds: 20, recoverySeconds: 40, timeMode: "per_series", estimatedTotalSeconds: 0 };
    const timeMode = p.timeMode === "per_rep" ? "per_rep" : "per_series";   // default retrocompatibile
    // Schema 2.4: in modalità semplice la struttura serie/ripetizioni/tempi è del tutto
    // nascosta dal form. I dati esistenti NON vengono toccati (vedi _saveExercise): se
    // l'esercizio era stato creato in modalità completa, i suoi tempi restano intatti.
    const isSimpleMode = !this.profile || this.profile.appMode !== "completa";

    this.main.innerHTML = `
      <section class="view view-editor">
        <div class="view-head">
          <div>
            <button type="button" class="link-btn back" id="btn-back">← Esercizi</button>
            <h2>${editing ? "Modifica esercizio" : "Nuovo esercizio"}</h2>
          </div>
        </div>

        <div class="editor-layout">
          <div class="editor-col">
            <label class="field">
              <span class="field-label">Titolo</span>
              <input type="text" id="f-title" class="input" value="${escapeAttr(editing?.title || "")}" placeholder="Es. Tuffo basso con recupero">
            </label>
            <label class="field">
              <span class="field-label">Descrizione</span>
              <textarea id="f-desc" class="input" rows="4" placeholder="Descrizione dell'esercizio…">${escapeHtml(editing?.description || "")}</textarea>
            </label>

            <div class="field">
              <span class="field-label">Immagini allegate</span>
              <div class="attachments" id="attachments"></div>
              <label class="upload">
                <input type="file" id="f-images" accept="image/*" multiple hidden>
                <span class="btn btn-soft">＋ Aggiungi immagini</span>
              </label>
            </div>

            <div class="field">
              <span class="field-label">Link video</span>
              <div id="links"></div>
              <button type="button" class="btn btn-soft" id="btn-add-link">＋ Aggiungi link</button>
              <p class="hint">Incolla un link YouTube o Instagram. Il range temporale e la descrizione sono manuali.</p>
            </div>

            <label class="field">
              <span class="field-label">Note</span>
              <textarea id="f-notes" class="input" rows="3" placeholder="Note operative, varianti, correzioni…">${escapeHtml(editing?.notes || "")}</textarea>
            </label>
          </div>

          <div class="editor-col">
            <div class="field">
              <span class="field-label">Schema (editor SVG)</span>
              <div id="svg-editor"></div>
            </div>
          </div>
        </div>

        <div class="editor-lists">
          <div class="field">
            <span class="field-label">Gesti tecnici</span>
            <div id="tp-gestures"></div>
          </div>
          <div class="field">
            <span class="field-label">Qualità allenate</span>
            <div id="tp-qualities"></div>
          </div>
          <div class="field">
            <span class="field-label">Periodo di allenamento</span>
            <div id="tp-periods"></div>
          </div>
        </div>

        <div class="field">
          <span class="field-label">Materiali</span>
          <div class="mat-adder">
            <select class="input mat-select" id="mat-select"></select>
            <input type="number" min="1" value="1" class="input mat-add-qty" id="mat-add-qty" aria-label="Quantità">
            <button type="button" class="btn btn-soft" id="mat-add-btn">＋ Aggiungi</button>
          </div>
          <div class="mat-chosen" id="mat-chosen"></div>
        </div>

        ${isSimpleMode ? "" : `
        <div class="field">
          <span class="field-label">Struttura dell'esercizio</span>
          <div class="timemode">
            <span class="timemode-q">Tempo di lavoro inteso come:</span>
            <label class="radio-inline"><input type="radio" name="timemode" value="per_series" ${timeMode !== "per_rep" ? "checked" : ""}> Per serie</label>
            <label class="radio-inline"><input type="radio" name="timemode" value="per_rep" ${timeMode === "per_rep" ? "checked" : ""}> Per ripetizione</label>
          </div>
          <div class="params">
            <label>Serie<input type="number" id="p-series" class="input" min="0" value="${p.series}"></label>
            <label>Ripetizioni<input type="number" id="p-reps" class="input" min="0" value="${p.reps}"></label>
            <label id="p-work-label">${timeMode === "per_rep" ? "Tempo per ripetizione (s)" : "Tempo di lavoro per serie (s)"}<input type="number" id="p-work" class="input" min="0" value="${p.workSeconds}"></label>
            <label>Recupero (s)<input type="number" id="p-rec" class="input" min="0" value="${p.recoverySeconds}"></label>
          </div>
          <p class="dur-preview" id="p-preview"></p>
        </div>`}

        <div class="field">
          <span class="field-label">Stato</span>
          <div class="seg">
            <button type="button" class="seg-btn status-btn ${this.formState.status==='favorite'?'is-on':''}" data-st="favorite">Preferito</button>
            <button type="button" class="seg-btn status-btn ${this.formState.status==='memory'?'is-on':''}" data-st="memory">In memoria</button>
          </div>
        </div>

        <div class="form-actionbar">
          <span class="form-actionbar-label">${editing ? "Modifica esercizio" : "Nuovo esercizio"}</span>
          <div class="form-actionbar-btns">
            <button type="button" class="btn" id="btn-cancel">Annulla</button>
            <button type="button" class="btn btn-primary" id="btn-save">Salva esercizio</button>
          </div>
        </div>
      </section>
    `;

    // editor SVG
    this.editor = new SvgEditor(this.main.querySelector("#svg-editor"), {
      getMaterials: () => this.customLists.materials,
      getArrowTypes: () => this.customLists.arrowTypes || []
    });
    if (editing?.svg) this.editor.loadFromSvg(editing.svg);

    // tag picker gesti tecnici / qualità allenate
    this.tpGestures = new TagPicker(this.main.querySelector("#tp-gestures"), {
      getOptions: () => this.customLists.technicalGestures || [],
      selected: [...this.formState.gestures],
      placeholder: "Cerca un gesto tecnico…",
      onChange: (sel) => { this.formState.gestures = new Set(sel); }
    });
    this.tpQualities = new TagPicker(this.main.querySelector("#tp-qualities"), {
      getOptions: () => this.customLists.trainedQualities || [],
      selected: [...this.formState.qualities],
      placeholder: "Cerca una qualità allenata…",
      onChange: (sel) => { this.formState.qualities = new Set(sel); }
    });
    this.tpPeriods = new TagPicker(this.main.querySelector("#tp-periods"), {
      getOptions: () => this.customLists.trainingPeriods || [],
      selected: [...this.formState.periods],
      placeholder: "Cerca un periodo…",
      onChange: (sel) => { this.formState.periods = new Set(sel); }
    });
    this._pickers.push(this.tpGestures, this.tpQualities, this.tpPeriods);

    this._renderMatSelect();
    this._renderChosenMaterials();
    this._renderAttachments();
    this._renderLinks();
    this._wireEditorForm();
  }

  // --- Materiali del form: dropdown + quantità + lista scelti ---
  _renderMatSelect() {
    const sel = this.main.querySelector("#mat-select");
    if (!sel) return;
    const available = this.customLists.materials.filter(m => !this.formState.materials.has(m.key));
    if (!available.length) {
      sel.innerHTML = `<option value="">— tutti i materiali aggiunti —</option>`;
      sel.disabled = true;
    } else {
      sel.disabled = false;
      sel.innerHTML = `<option value="">Scegli un materiale…</option>` +
        available.map(m => `<option value="${escapeAttr(m.key)}">${escapeHtml(m.label)}</option>`).join("");
    }
  }

  _renderChosenMaterials() {
    const wrap = this.main.querySelector("#mat-chosen");
    if (!wrap) return;
    const rows = [...this.formState.materials.entries()];
    if (!rows.length) { wrap.innerHTML = `<p class="muted small">Nessun materiale aggiunto.</p>`; return; }
    wrap.innerHTML = rows.map(([key, qty]) => {
      const mat = this.customLists.materials.find(x => x.key === key);
      const label = mat ? mat.label : key;
      const out = !mat;
      const ico = out ? "" : placeSymbol(mat.svgSymbol);
      return `<div class="mat-chosen-row" data-key="${escapeAttr(key)}">
        <svg viewBox="-36 -36 72 72" class="mat-ico-sm" aria-hidden="true">${ico}</svg>
        <span class="mat-chosen-name ${out ? 'chip-out' : ''}">${escapeHtml(label)}${out ? ' <em>(materiale rimosso)</em>' : ''}</span>
        <input type="number" min="1" class="input mat-chosen-qty" data-qtykey="${escapeAttr(key)}" value="${qty}" aria-label="Quantità">
        <button type="button" class="icon-btn danger mat-chosen-del" data-delkey="${escapeAttr(key)}" title="Rimuovi">✕</button>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".mat-chosen-qty").forEach(inp =>
      inp.addEventListener("input", () => {
        const k = inp.dataset.qtykey;
        if (this.formState.materials.has(k)) this.formState.materials.set(k, Math.max(1, parseInt(inp.value, 10) || 1));
      }));
    wrap.querySelectorAll(".mat-chosen-del").forEach(btn =>
      btn.addEventListener("click", () => {
        this.formState.materials.delete(btn.dataset.delkey);
        this._renderMatSelect();
        this._renderChosenMaterials();
      }));
  }

  _wireEditorForm() {
    this.main.querySelector("#btn-back").addEventListener("click", () => this.setRoute("esercizi"));
    this.main.querySelector("#btn-cancel").addEventListener("click", () => this.setRoute("esercizi"));
    this.main.querySelector("#btn-save").addEventListener("click", () => this._saveExercise());

    // immagini
    this.main.querySelector("#f-images").addEventListener("change", async (e) => {
      const files = [...e.target.files];
      for (const f of files) {
        try {
          const dataUrl = await resizeImageFile(f, { maxSize: 1600, quality: 0.82 });
          this.formState.attachments.push({ type: "image", name: f.name, dataUrl });
        } catch (_) { this.toast("Immagine non leggibile: " + f.name, "error"); }
      }
      e.target.value = "";
      this._renderAttachments();
    });

    // link
    this.main.querySelector("#btn-add-link").addEventListener("click", () => {
      this.formState.links.push({ url: "", label: "", timeRange: null });
      this._renderLinks();
    });

    // materiale: aggiungi (dropdown + quantità)
    this.main.querySelector("#mat-add-btn").addEventListener("click", () => {
      const sel = this.main.querySelector("#mat-select");
      const key = sel.value;
      if (!key) { this.toast("Scegli un materiale dal menu.", "error"); return; }
      const qty = Math.max(1, parseInt(this.main.querySelector("#mat-add-qty").value, 10) || 1);
      this.formState.materials.set(key, qty);
      this.main.querySelector("#mat-add-qty").value = 1;
      this._renderMatSelect();
      this._renderChosenMaterials();
    });

    // stato
    this.main.querySelectorAll(".status-btn").forEach(b => {
      b.addEventListener("click", () => {
        this.formState.status = b.dataset.st;
        this.main.querySelectorAll(".status-btn").forEach(x => x.classList.toggle("is-on", x === b));
      });
    });

    // anteprima durata in tempo reale + selettore tempo (per serie / per ripetizione)
    // — presente solo in modalità completa (in modalità semplice il blocco non è nel DOM).
    if (!isSimpleMode) {
      const readParams = () => ({
        series: this.main.querySelector("#p-series").value,
        reps: this.main.querySelector("#p-reps").value,
        workSeconds: this.main.querySelector("#p-work").value,
        recoverySeconds: this.main.querySelector("#p-rec").value,
        timeMode: (this.main.querySelector('input[name="timemode"]:checked') || {}).value || "per_series"
      });
      const refreshPreview = () => {
        const prm = readParams();
        const lbl = this.main.querySelector("#p-work-label");
        if (lbl) lbl.childNodes[0].nodeValue = prm.timeMode === "per_rep" ? "Tempo per ripetizione (s)" : "Tempo di lavoro per serie (s)";
        const pv = this.main.querySelector("#p-preview");
        if (pv) pv.textContent = this._formDurPreview(prm);
      };
      ["#p-series", "#p-reps", "#p-work", "#p-rec"].forEach(sel =>
        this.main.querySelector(sel).addEventListener("input", refreshPreview));
      this.main.querySelectorAll('input[name="timemode"]').forEach(r => r.addEventListener("change", refreshPreview));
      refreshPreview();
    }
  }

  _renderAttachments() {
    const wrap = this.main.querySelector("#attachments");
    if (!wrap) return;
    wrap.innerHTML = this.formState.attachments.map((a, i) => `
      <div class="thumb">
        <img src="${a.dataUrl}" alt="${escapeAttr(a.name)}">
        <button type="button" class="thumb-del" data-rmimg="${i}" title="Rimuovi">✕</button>
      </div>`).join("") || `<span class="muted small">Nessuna immagine.</span>`;
    wrap.querySelectorAll("[data-rmimg]").forEach(b =>
      b.addEventListener("click", () => {
        this.formState.attachments.splice(parseInt(b.dataset.rmimg, 10), 1);
        this._renderAttachments();
      }));
  }

  _renderLinks() {
    const wrap = this.main.querySelector("#links");
    if (!wrap) return;
    wrap.innerHTML = this.formState.links.map((l, i) => {
      const start = l.timeRange?.start ?? "";
      const end = l.timeRange?.end ?? "";
      return `<div class="link-row" data-i="${i}">
        <input type="url" class="input" data-lurl="${i}" placeholder="https://…" value="${escapeAttr(l.url || "")}">
        <input type="text" class="input" data-llabel="${i}" placeholder="Descrizione del video" value="${escapeAttr(l.label || "")}">
        <input type="number" class="input narrow" data-lstart="${i}" placeholder="da (s)" value="${start}">
        <input type="number" class="input narrow" data-lend="${i}" placeholder="a (s)" value="${end}">
        <button type="button" class="icon-btn danger" data-rmlink="${i}" title="Rimuovi">✕</button>
      </div>`;
    }).join("") || `<p class="muted small">Nessun link.</p>`;

    wrap.querySelectorAll("[data-rmlink]").forEach(b =>
      b.addEventListener("click", () => { this.formState.links.splice(+b.dataset.rmlink, 1); this._renderLinks(); }));
    const bind = (sel, fn) => wrap.querySelectorAll(sel).forEach(inp =>
      inp.addEventListener("input", () => fn(+inp.dataset[Object.keys(inp.dataset)[0]], inp.value)));
    wrap.querySelectorAll("[data-lurl]").forEach(inp => inp.addEventListener("input", () => this.formState.links[+inp.dataset.lurl].url = inp.value));
    wrap.querySelectorAll("[data-llabel]").forEach(inp => inp.addEventListener("input", () => this.formState.links[+inp.dataset.llabel].label = inp.value));
    wrap.querySelectorAll("[data-lstart]").forEach(inp => inp.addEventListener("input", () => this._setLinkTime(+inp.dataset.lstart, "start", inp.value)));
    wrap.querySelectorAll("[data-lend]").forEach(inp => inp.addEventListener("input", () => this._setLinkTime(+inp.dataset.lend, "end", inp.value)));
  }

  _setLinkTime(i, which, val) {
    const l = this.formState.links[i];
    if (!l.timeRange) l.timeRange = { start: null, end: null };
    const n = val === "" ? null : (parseInt(val, 10) || 0);
    l.timeRange[which] = n;
    if (l.timeRange.start == null && l.timeRange.end == null) l.timeRange = null;
  }

  async _saveExercise() {
    const title = this.main.querySelector("#f-title").value.trim();
    if (!title) { this.toast("Inserisci un titolo.", "error"); this.main.querySelector("#f-title").focus(); return; }

    const now = new Date().toISOString();
    const existing = this.editingId ? this.exercises.find(x => x.id === this.editingId) : null;

    // In modalità semplice il blocco tempi non è nel form: i parametri esistenti (se
    // l'esercizio era stato creato/modificato in modalità completa) restano intatti;
    // per un esercizio nuovo restano a zero. Non si azzera mai un dato già presente.
    const pEl = this.main.querySelector("#p-series");
    let series, reps, workSeconds, recoverySeconds, timeMode, estimatedTotalSeconds;
    if (pEl) {
      series = int(this.main.querySelector("#p-series").value);
      reps = int(this.main.querySelector("#p-reps").value);
      workSeconds = int(this.main.querySelector("#p-work").value);
      recoverySeconds = int(this.main.querySelector("#p-rec").value);
      timeMode = (this.main.querySelector('input[name="timemode"]:checked') || {}).value === "per_rep" ? "per_rep" : "per_series";
      estimatedTotalSeconds = this._calcDuration({ series, reps, workSeconds, recoverySeconds, timeMode });
    } else {
      const prevP = existing?.parameters || { series: 0, reps: 0, workSeconds: 0, recoverySeconds: 0, timeMode: "per_series", estimatedTotalSeconds: 0 };
      ({ series, reps, workSeconds, recoverySeconds, timeMode, estimatedTotalSeconds } = prevP);
    }

    const links = this.formState.links
      .filter(l => (l.url || "").trim())
      .map(l => ({ url: l.url.trim(), label: (l.label || "").trim(), timeRange: l.timeRange || null }));

    const exercise = {
      ...(existing || {}),
      type: "exercise",
      id: existing ? existing.id : genId(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      title,
      description: this.main.querySelector("#f-desc").value.trim(),
      svg: this.editor && this.editor.hasContent() ? this.editor.toSvgString() : (existing?.svg || (this.editor ? this.editor.toSvgString() : "")),
      attachments: this.formState.attachments.map(a => ({ type: "image", name: a.name, dataUrl: a.dataUrl })),
      links,
      notes: this.main.querySelector("#f-notes").value.trim(),
      technicalGestures: [...this.formState.gestures],
      trainedQualities: [...this.formState.qualities],
      trainingPeriod: [...this.formState.periods],
      materials: [...this.formState.materials.entries()].map(([key, qty]) => ({ key, qty })),
      parameters: { series, reps, workSeconds, recoverySeconds, timeMode, estimatedTotalSeconds },
      status: this.formState.status,
      importato: false   // modificando/salvando, diventa sempre una versione locale
    };

    try {
      this._checkSize(exercise);
      await storage.putExercise(exercise);
      const idx = this.exercises.findIndex(x => x.id === exercise.id);
      if (idx >= 0) this.exercises[idx] = exercise; else this.exercises.push(exercise);
      this.toast("Esercizio salvato.");
      this.setRoute("dettaglio", exercise.id);
    } catch (err) {
      this.toast(err.message || "Salvataggio non riuscito.", "error");
    }
  }

  _checkSize(exercise) {
    // Avviso prudenziale sulle immagini base64 (limite pratico di sicurezza ~4.5MB)
    const bytes = (exercise.attachments || []).reduce((s, a) => s + (a.dataUrl?.length || 0), 0);
    if (bytes > 4_500_000) {
      throw new Error("Le immagini allegate sono troppo pesanti. Riducine numero o dimensione.");
    }
  }

  // ---------- Dettaglio + stampa ----------
  renderDettaglio(id) {
    const ex = this.exercises.find(x => x.id === id);
    if (!ex) { this.setRoute("esercizi"); return; }

    this.main.innerHTML = `
      <section class="view view-detail">
        <div class="view-head no-print">
          <div>
            <button type="button" class="link-btn back" id="btn-back">← Esercizi</button>
            <h2>${escapeHtml(ex.title)}</h2>
          </div>
          <div class="head-actions">
            ${ex.importato ? `<button type="button" class="btn btn-soft" id="btn-clone">Crea copia locale</button>` : ""}
            <button type="button" class="btn" id="btn-edit">Modifica</button>
            <button type="button" class="btn btn-soft" id="btn-dup">Duplica</button>
            <button type="button" class="btn btn-soft" id="btn-export-ex">Esporta esercizio</button>
            <button type="button" class="btn btn-soft" id="btn-import-ex">Importa esercizio</button>
            <button type="button" class="btn btn-soft" id="btn-print">Stampa / PDF</button>
          </div>
        </div>

        ${ex.importato ? `
        <div class="banner no-print" role="status">
          <span class="banner-ico" aria-hidden="true">↧</span>
          <div class="banner-text">
            <b>Esercizio importato.</b> Modificandolo lo trasformi in una versione locale.
            In alternativa, creane una copia e conserva l'originale intatto.
          </div>
          <button type="button" class="btn btn-soft banner-btn" id="btn-clone-2">Crea copia locale modificabile</button>
        </div>` : ""}

        <article class="sheet" id="print-area">
          <header class="sheet-head">
            <h2 class="sheet-title">${escapeHtml(ex.title)}</h2>
            <span class="sheet-badges">
              <span class="badge ${ex.status==='favorite'?'badge-fav':'badge-mem'}">${STATUS_LABEL[ex.status] || ""}</span>
              ${ex.importato ? `<span class="badge badge-import">importato</span>` : ""}
            </span>
          </header>

          <div class="sheet-grid">
            <div class="sheet-svg" data-print-section="svg">${ex.svg ? safeSvg(composeExerciseSvg(ex.svg, this.customLists.materials, this.customLists.arrowTypes)) : noSchemaPlaceholder()}</div>
            <div class="sheet-side">
              ${ex.description ? `<div class="block" data-print-section="description"><h4>Descrizione</h4><p>${escapeHtml(ex.description)}</p></div>` : ""}
              ${this._tagBlock("Gesti tecnici", ex.technicalGestures, this.customLists.technicalGestures, "gestures")}
              ${this._tagBlock("Qualità allenate", ex.trainedQualities, this.customLists.trainedQualities, "qualities")}
              ${this._tagBlock("Periodo di allenamento", ex.trainingPeriod, this.customLists.trainingPeriods, "periods")}
            </div>
          </div>

          ${this._materialsBlock(ex.materials)}
          ${this._paramsBlock(ex.parameters)}
          ${this._linksBlock(ex.links)}
          ${ex.attachments?.length ? `<div class="block" data-print-section="attachments"><h4>Immagini</h4><div class="sheet-imgs">${ex.attachments.map(a => `<img src="${a.dataUrl}" alt="${escapeAttr(a.name)}">`).join("")}</div></div>` : ""}
          ${ex.notes ? `<div class="block" data-print-section="notes"><h4>Note</h4><p>${escapeHtml(ex.notes)}</p></div>` : ""}
        </article>
      </section>
    `;
    this.main.querySelector("#btn-back").addEventListener("click", () => this.setRoute("esercizi"));
    this.main.querySelector("#btn-edit").addEventListener("click", () => {
      if (ex.importato) this.toast("Salvando le modifiche, l'esercizio diventerà una versione locale.");
      this.setRoute("editor", ex.id);
    });
    this.main.querySelector("#btn-print").addEventListener("click", () => this._printExercise(ex));
    this.main.querySelector("#btn-dup").addEventListener("click", () => this._duplicateExercise(ex.id));
    this.main.querySelector("#btn-export-ex").addEventListener("click", () => this._exportSingleExercise(ex));
    this.main.querySelector("#btn-import-ex").addEventListener("click", () => this._promptImportExercise());
    const cloneBtn = this.main.querySelector("#btn-clone");
    const cloneBtn2 = this.main.querySelector("#btn-clone-2");
    if (cloneBtn) cloneBtn.addEventListener("click", () => this._cloneAsLocal(ex.id));
    if (cloneBtn2) cloneBtn2.addEventListener("click", () => this._cloneAsLocal(ex.id));
  }

  async _cloneAsLocal(id) {
    const src = this.exercises.find(x => x.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const clone = {
      ...src,
      id: genId(),
      title: `${src.title} (copia locale)`,
      importato: false,
      createdAt: now,
      updatedAt: now
    };
    await storage.putExercise(clone);
    this.exercises.push(clone);
    this.toast("Copia locale creata. L'originale importato resta intatto.");
    this.setRoute("editor", clone.id);
  }

  // ===== Feature 2: duplicazione esercizio =====
  async _duplicateExercise(id) {
    const src = this.exercises.find(x => x.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = genId();
    copy.title = `${src.title} — copia`;
    copy.status = "memory";
    copy.importato = false;
    copy.createdAt = now;
    copy.updatedAt = now;
    await storage.putExercise(copy);
    this.exercises.push(copy);
    this.toast("Esercizio duplicato.");
    this.setRoute("editor", copy.id);   // apre subito la copia in modifica
  }

  // ===== Feature 1: export/import del singolo esercizio =====
  _exportSingleExercise(ex) {
    const json = JSON.stringify(buildSingleExerciseExport(ex), null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(`esercizio_${slugFile(ex.title)}_${stamp}.json`, json);
    this.toast("Esercizio esportato.");
  }

  _promptImportExercise() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const res = parseSingleExerciseImport(text);
        if (!res.ok) { this.toast(res.error, "error"); return; }
        await this._importExerciseResolved(res.exercise);
      } catch (err) {
        this.toast("Import non riuscito: " + (err.message || "errore sconosciuto"), "error");
      }
    });
    input.click();
  }

  async _importExerciseResolved(exercise) {
    const exists = this.exercises.some(x => x.id === exercise.id);
    if (!exists) { await this._storeImportedExercise(exercise, false); return; }
    // id duplicato: chiedi sovrascrivi o copia
    const { close } = this._openModal(`
      <h3>Esercizio già presente</h3>
      <p class="muted small">Esiste già un esercizio con lo stesso identificativo ("${escapeHtml(exercise.title)}"). Come procedere?</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-soft" data-mcopy>Salva come copia</button>
        <button type="button" class="btn btn-primary" data-moverwrite>Sovrascrivi</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mcopy]": async () => { close(); await this._storeImportedExercise(exercise, true); },
      "[data-moverwrite]": async () => { close(); await this._storeImportedExercise(exercise, false); }
    });
  }

  async _storeImportedExercise(exercise, asCopy) {
    const now = new Date().toISOString();
    let ex = { ...exercise, importato: true };
    if (asCopy) {
      ex.id = genId();
      ex.title = `${exercise.title} — copia`;
      ex.createdAt = now;
      ex.updatedAt = now;
    }
    await storage.putExercise(ex);
    const idx = this.exercises.findIndex(x => x.id === ex.id);
    if (idx >= 0) this.exercises[idx] = ex; else this.exercises.push(ex);
    this.toast(asCopy ? "Esercizio importato come copia." : "Esercizio importato.");
    this.setRoute("dettaglio", ex.id);
  }

  // ===== Feature 1: import configurazione (con conferma + anteprima) =====
  _promptImportConfig(lists) {
    const count = (a) => Array.isArray(a) ? a.length : 0;
    const sample = (a, n = 6) => (Array.isArray(a) ? a.slice(0, n).map(escapeHtml).join(", ") + (a.length > n ? "…" : "") : "");
    const { close } = this._openModal(`
      <h3>Importare la configurazione?</h3>
      <p class="muted small">L'importazione sovrascriverà le tue liste attuali. Continuare?</p>
      <ul class="cfg-preview">
        <li><b>Gesti tecnici</b> (${count(lists.technicalGestures)}): <span class="muted">${sample(lists.technicalGestures)}</span></li>
        <li><b>Qualità allenate</b> (${count(lists.trainedQualities)}): <span class="muted">${sample(lists.trainedQualities)}</span></li>
        <li><b>Periodi</b> (${count(lists.trainingPeriods)}): <span class="muted">${sample(lists.trainingPeriods)}</span></li>
        <li><b>Materiali</b> (${count(lists.materials)}): <span class="muted">${sample((lists.materials || []).map(m => m.label))}</span></li>
        <li><b>Tipi di freccia</b> (${count(lists.arrowTypes)}): <span class="muted">${sample((lists.arrowTypes || []).map(a => a.name))}</span></li>
      </ul>
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-primary" data-mok>Sovrascrivi configurazione</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mok]": async () => { close(); await this._applyConfigImport(lists); }
    });
  }

  async _applyConfigImport(lists) {
    await storage.saveCustomLists(lists);
    this.customLists = lists;
    if (this.editor) this.editor.refreshMaterials();
    this.toast("Configurazione importata.");
    this.renderImpostazioni();   // aggiorna liste, tag picker e filtri alla prossima resa
  }

  // ===== Import backup completo: conferma + anteprima, poi scrittura ATOMICA =====
  // A differenza dell'import di sola configurazione, qui sono in gioco esercizi, sedute,
  // portieri, stagioni ed eventi: un file sbagliato selezionato per errore può sovrascrivere
  // molti dati. Prima di scrivere qualunque cosa, mostriamo sempre un'anteprima con i conteggi
  // e chiediamo conferma esplicita (stesso principio già in uso per l'import configurazione).
  _promptImportBackup(res) {
    const row = (label, n) => n > 0 ? `<li><b>${escapeHtml(label)}</b>: ${n}</li>` : "";
    const rows = [
      row("Esercizi", res.exercises.length),
      row("Sedute", res.sessions.length),
      row("Portieri", res.goalkeepers.length),
      row("Stagioni", res.seasons.length),
      row("Eventi (legacy)", res.events.length),
      row("Presenze", res.attendances.length),
      row("Impegni pianificati", (res.genericEvents || []).length),
      row("Eventi specifici", (res.specificEvents || []).length)
    ].join("");
    const total = res.exercises.length + res.sessions.length + res.goalkeepers.length + res.seasons.length
      + res.events.length + res.attendances.length + (res.genericEvents || []).length + (res.specificEvents || []).length;
    const warnHtml = res.warnings.length
      ? `<p class="lock-note">${res.warnings.length} avviso/i durante la lettura del file (voci ignorate o non riconosciute): vedi console per i dettagli.</p>` : "";
    const { close } = this._openModal(`
      <h3>Importare questo backup?</h3>
      <p class="muted small">Verranno scritti/sovrascritti gli elementi con lo stesso identificativo già presente in archivio. Le liste configurabili (gesti, qualità, materiali…) vengono unite senza perdere quelle attuali. L'operazione riguarda un solo dispositivo: se hai la sincronizzazione cloud attiva, si propagherà agli altri al prossimo giro.</p>
      ${total ? `<ul class="cfg-preview">${rows}</ul>` : `<p class="muted small">Il file non contiene esercizi/sedute/portieri/stagioni: verranno unite solo le liste configurabili.</p>`}
      ${warnHtml}
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-primary" data-mok>Importa</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mok]": async () => { close(); await this._applyBackupImport(res); }
    });
  }

  async _applyBackupImport(res) {
    try {
      const count = await storage.importAllAtomic({
        exercises: res.exercises, sessions: res.sessions, goalkeepers: res.goalkeepers,
        seasons: res.seasons, events: res.events, attendances: res.attendances,
        genericEvents: res.genericEvents, specificEvents: res.specificEvents,
        customLists: res.mergedCustomLists
      });
      this.customLists = await storage.getCustomLists();
      this.exercises = await storage.getAllExercises();
      this.sessions = await storage.getAllSessions();
      this.goalkeepers = await storage.getAllGoalkeepers();
      this.seasons = await storage.getAllSeasons();
      this.events = await storage.getAllEvents();
      this.attendances = await storage.getAllAttendances();
      this.genericEvents = await storage.getAllGenericEvents();
      this.specificEvents = await storage.getAllSpecificEvents();
      if (res.profile) await this._applyImportedProfile(res.profile);   // blocco PIN locale invariato
      let msg = count > 0 ? `Import completato: ${count} elementi.` : "Import completato: solo liste configurabili aggiornate.";
      if (res.warnings.length) msg += ` ${res.warnings.length} avvisi.`;
      this.toast(msg);
      if (res.warnings.length) console.warn("Avvisi import:", res.warnings);
      this.renderImpostazioni();
    } catch (err) {
      // Transazione IndexedDB annullata: nessuno store è stato toccato, l'archivio resta
      // esattamente come prima del tentativo di import.
      this.toast("Import non riuscito, nessuna modifica applicata: " + (err.message || "errore sconosciuto"), "error");
    }
  }

  // ===== Modale generica =====
  _openModal(innerHtml) {
    const overlay = document.createElement("div");
    overlay.className = "app-modal-overlay no-print";
    overlay.innerHTML = `<div class="app-modal" role="dialog" aria-modal="true" tabindex="-1">${innerHtml}</div>`;
    this.root.appendChild(overlay);
    const modalEl = overlay.querySelector(".app-modal");
    const openerEl = document.activeElement;
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKey = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Tab") {
        // Focus trap: Tab/Shift+Tab restano dentro il modale finché è aperto.
        const items = [...modalEl.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      // Restituisce il focus all'elemento che ha aperto il modale, com'era prima di aprirlo.
      if (openerEl && typeof openerEl.focus === "function" && document.contains(openerEl)) openerEl.focus();
    };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    this._lastModal = overlay;
    // Sposta subito il focus dentro il modale (primo elemento interattivo, o il modale stesso).
    setTimeout(() => {
      const items = modalEl.querySelectorAll(FOCUSABLE);
      (items[0] || modalEl).focus();
    }, 0);
    return { overlay, close };
  }
  _wireModalButtons(map) {
    const overlay = this._lastModal;
    if (!overlay) return;
    Object.entries(map).forEach(([sel, fn]) => {
      const btn = overlay.querySelector(sel);
      if (btn) btn.addEventListener("click", fn);
    });
  }

  _tagBlock(title, values, list, sectionKey) {
    if (!values || !values.length) return "";
    const chips = values.map(v => {
      const out = !(list || []).includes(v);
      return `<span class="chip ${out ? 'chip-out' : ''}" ${out ? 'title="personalizzato / fuori lista"' : ''}>${escapeHtml(v)}${out ? ' <em>·fuori lista</em>' : ''}</span>`;
    }).join("");
    const inline = values.map(v => escapeHtml(v)).join(", ");
    const attr = sectionKey ? ` data-print-section="${sectionKey}"` : "";
    return `<div class="block"${attr}>
      <div class="block-screen"><h4>${title}</h4><div class="chips">${chips}</div></div>
      <p class="print-only cat-inline"><strong>${title}:</strong> ${inline}</p>
    </div>`;
  }

  _materialsBlock(materials) {
    if (!materials || !materials.length) return "";
    const rows = materials.map(m => {
      const mat = this.customLists.materials.find(x => x.key === m.key);
      const label = mat ? mat.label : m.key;
      const out = !mat;
      const ico = out
        ? ""
        : `<svg viewBox="-36 -36 72 72" class="mat-ico-sm" aria-hidden="true">${placeSymbol(mat.svgSymbol)}</svg>`;
      return `<li>${ico}
        <span class="${out ? 'chip-out' : ''}">${escapeHtml(label)}${out ? ' <em>(materiale rimosso)</em>' : ''}</span>
        <span class="qty">×${m.qty}</span></li>`;
    }).join("");
    return `<div class="block" data-print-section="materials"><h4>Materiali</h4><ul class="mat-list">${rows}</ul></div>`;
  }

  // Durata totale in secondi secondo timeMode (locale: non tocca session.js).
  _calcDuration(p) {
    const S = Math.max(0, Number(p.series) || 0);
    const reps = Math.max(0, Number(p.reps) || 0);
    const W = Math.max(0, Number(p.workSeconds) || 0);
    const R = Math.max(0, Number(p.recoverySeconds) || 0);
    const work = p.timeMode === "per_rep" ? S * reps * W : S * W;
    const recovery = Math.max(0, S - 1) * R;
    return work + recovery;
  }
  // Durata leggibile: "45 s" / "12 min" / "2 min 30 s".
  _humanDur(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m} min ${r} s` : `${m} min`;
  }
  // Riga anteprima nel form: "3 serie × 8 rep × 5s + 2 recuperi × 30s = 2 min 30 s".
  _formDurPreview(p) {
    const S = Math.max(0, Number(p.series) || 0);
    const reps = Math.max(0, Number(p.reps) || 0);
    const W = Math.max(0, Number(p.workSeconds) || 0);
    const R = Math.max(0, Number(p.recoverySeconds) || 0);
    const work = p.timeMode === "per_rep" ? `${S} serie × ${reps} rep × ${W}s` : `${S} serie × ${W}s`;
    const recCount = Math.max(0, S - 1);
    const rec = recCount > 0 ? ` + ${recCount} recuper${recCount === 1 ? "o" : "i"} × ${R}s` : "";
    return `${work}${rec} = ${this._humanDur(this._calcDuration(p))}`;
  }
  // Riga leggibile nella scheda dettaglio.
  _detailDurText(p) {
    const S = Math.max(0, Number(p.series) || 0);
    const reps = Math.max(0, Number(p.reps) || 0);
    const W = Math.max(0, Number(p.workSeconds) || 0);
    const R = Math.max(0, Number(p.recoverySeconds) || 0);
    const work = p.timeMode === "per_rep" ? `${S} serie × ${reps} ripetizioni × ${W}s/rep` : `${S} serie × ${W}s/serie`;
    const rec = S > 1 ? ` + ${R}s recupero` : "";
    return `${work}${rec} = ${this._humanDur(this._calcDuration(p))}`;
  }

  _paramsBlock(p) {
    if (!p) return "";
    if (!this.profile || this.profile.appMode !== "completa") return "";   // schema 2.4: tempi nascosti in modalità semplice
    return `<div class="block" data-print-section="params"><h4>Struttura dell'esercizio</h4>
      <div class="param-grid">
        <div class="stat"><span class="stat-label">Serie</span><span class="stat-value">${p.series}</span></div>
        <div class="stat"><span class="stat-label">Ripetizioni</span><span class="stat-value">${p.reps}</span></div>
        <div class="stat"><span class="stat-label">${p.timeMode === "per_rep" ? "Tempo/rip." : "Lavoro/serie"}</span><span class="stat-value">${p.workSeconds}s</span></div>
        <div class="stat"><span class="stat-label">Recupero</span><span class="stat-value">${p.recoverySeconds}s</span></div>
        <div class="stat stat-hero"><span class="stat-label">Durata stimata</span><span class="stat-value">${formatDuration(p.estimatedTotalSeconds)}</span></div>
      </div>
      <p class="dur-formula">${escapeHtml(this._detailDurText(p))}</p></div>`;
  }

  _linksBlock(links) {
    if (!links || !links.length) return "";
    const rows = links.map(l => {
      const tr = l.timeRange && (l.timeRange.start != null || l.timeRange.end != null)
        ? ` <span class="muted small">(${l.timeRange.start != null ? formatDuration(l.timeRange.start) : "0:00"}${l.timeRange.end != null ? "–" + formatDuration(l.timeRange.end) : ""})</span>`
        : "";
      const href = buildVideoHref(l);
      return `<li><a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtml(l.label || l.url)}</a>${tr}</li>`;
    }).join("");
    return `<div class="block" data-print-section="links"><h4>Link video</h4><ul class="link-list">${rows}</ul></div>`;
  }

  // Preferenze di stampa ricordate per la sessione (in memoria).
  _getPrintPrefs() {
    if (!this.printPrefs) {
      this.printPrefs = {
        svg: true, description: true, gestures: true, qualities: true, periods: true,
        materials: true, params: true, notes: true, attachments: true, links: true,
        mode: "color"   // "color" | "bw" — ricordato per la sessione (in memoria)
      };
    }
    return this.printPrefs;
  }

  _printExercise(ex) {
    this._openPrintDialog(ex);
  }

  _openPrintDialog(ex) {
    const prefs = this._getPrintPrefs();
    const opts = [
      ["svg", "Schema SVG"], ["description", "Descrizione"], ["gestures", "Gesti tecnici"],
      ["qualities", "Qualità allenate"], ["periods", "Periodo di allenamento"],
      ["materials", "Materiali necessari"], ["params", "Struttura dell'esercizio"],
      ["notes", "Note"], ["attachments", "Allegati (immagini)"], ["links", "Link video"]
    ];
    const overlay = document.createElement("div");
    overlay.className = "print-modal-overlay no-print";
    overlay.innerHTML = `
      <div class="print-modal" role="dialog" aria-modal="true" aria-label="Opzioni di stampa">
        <h3>Opzioni di stampa</h3>
        <p class="muted small">Scegli cosa includere nella stampa di "${escapeHtml(ex.title)}".</p>
        <div class="print-opts">
          ${opts.map(([k, label]) => `<label class="print-opt"><input type="checkbox" data-pk="${k}" ${prefs[k] ? "checked" : ""}> <span>${label}</span></label>`).join("")}
        </div>
        <div class="print-mode">
          <span class="print-mode-title">Resa cromatica</span>
          <label class="print-opt"><input type="radio" name="pmode" value="color" ${prefs.mode !== "bw" ? "checked" : ""}> <span>Stampa a colori</span></label>
          <label class="print-opt"><input type="radio" name="pmode" value="bw" ${prefs.mode === "bw" ? "checked" : ""}> <span>Stampa in bianco e nero — campo bianco</span></label>
        </div>
        <div class="print-modal-actions">
          <button type="button" class="btn" data-pcancel>Annulla</button>
          <button type="button" class="btn btn-primary" data-pprint>Stampa</button>
        </div>
      </div>`;
    this.root.appendChild(overlay);

    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("[data-pcancel]").addEventListener("click", close);
    overlay.querySelector("[data-pprint]").addEventListener("click", () => {
      overlay.querySelectorAll("input[data-pk]").forEach(inp => { prefs[inp.dataset.pk] = inp.checked; });
      const modeSel = overlay.querySelector('input[name="pmode"]:checked');
      prefs.mode = modeSel ? modeSel.value : "color";
      close();
      // breve attesa per assicurare la rimozione della modale dal layout prima della stampa
      setTimeout(() => this._runConfiguredPrint(ex), 30);
    });
    const first = overlay.querySelector("input[data-pk]");
    if (first) first.focus();
  }

  _runConfiguredPrint(ex) {
    const area = this.main.querySelector("#print-area");
    if (!area) return;
    const prefs = this._getPrintPrefs();

    // Nasconde le sezioni deselezionate (display:none inline) e le ripristina dopo.
    const restoreList = [];
    Object.entries(prefs).forEach(([k, on]) => {
      if (on) return;
      area.querySelectorAll(`[data-print-section="${k}"]`).forEach(el => {
        restoreList.push([el, el.style.display]);
        el.style.display = "none";
      });
    });
    // Se lo schema è escluso, evita la colonna vuota: una sola colonna.
    const grid = area.querySelector(".sheet-grid");
    let gridRestore = null;
    if (grid && !prefs.svg) { gridRestore = grid.style.gridTemplateColumns; grid.style.gridTemplateColumns = "1fr"; }

    // Modalità bianco e nero — campo bianco: trasforma SOLO il DOM (mai IndexedDB),
    // con deep clone per il ripristino dopo la stampa.
    let svgRestore = null;
    if (prefs.mode === "bw" && prefs.svg) {
      const svgEl = area.querySelector(".sheet-svg svg");
      if (svgEl) {
        const backup = svgEl.cloneNode(true);
        try { this._applyBwToSvg(svgEl); svgRestore = { live: svgEl, backup }; }
        catch (_) { /* in caso di errore non blocchiamo la stampa */ }
      }
    }

    let restored = false;
    const restore = () => {
      if (restored) return; restored = true;
      restoreList.forEach(([el, d]) => { el.style.display = d; });
      if (grid && gridRestore !== null) grid.style.gridTemplateColumns = gridRestore;
      if (svgRestore && svgRestore.live.parentNode) svgRestore.live.replaceWith(svgRestore.backup);
      document.body.classList.remove("printing");
    };

    document.body.classList.add("printing");

    if (window.html2pdf) {
      const opt = {
        margin: 10,
        filename: `${slugFile(ex.title)}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };
      Promise.resolve(window.html2pdf().set(opt).from(area).save()).then(restore).catch(restore);
      setTimeout(restore, 4000);
      return;
    }

    const after = () => { restore(); window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after);
    window.print();
    setTimeout(restore, 1500); // fallback se afterprint non scatta
  }

  // Trasforma il SVG per la stampa B/N — campo bianco (opera solo sul nodo DOM passato).
  // a) sfondo campo verde -> bianco; b) linee campo -> grigio medio; c) simboli/frecce
  // con colore chiaro (HSL L>70%) -> grigio scuro; d) tutti i testi -> nero.
  _applyBwToSvg(svg) {
    const FIELD_GREEN = "#1f7a4d";
    const isContent = (el) => !!(el.closest && el.closest(".rep-el, .rep-arrow"));

    // d) testi -> nero
    svg.querySelectorAll("text").forEach(t => { t.setAttribute("fill", "#000000"); t.style && (t.style.fill = "#000000"); });

    // b/c) ricolora fill/stroke chiari PRIMA di gestire lo sfondo verde
    svg.querySelectorAll("rect,circle,ellipse,line,path,polygon,polyline,g").forEach(el => {
      const content = isContent(el);
      ["fill", "stroke"].forEach(attr => {
        const v = el.getAttribute(attr);
        if (!v || v === "none") return;
        const L = this._colorLightness(v);
        if (L === null) return;            // url(...), currentColor, ecc.: invariato
        if (L > 0.70) el.setAttribute(attr, content ? "#222222" : "#555555");
      });
    });

    // a) sfondo campo verde -> bianco (anche eventuali varianti dello stesso verde)
    svg.querySelectorAll("rect").forEach(r => {
      const f = (r.getAttribute("fill") || "").trim().toLowerCase();
      if (f === FIELD_GREEN) r.setAttribute("fill", "#ffffff");
    });
  }

  // Luminosità HSL (0..1) di un colore CSS; null se non interpretabile.
  _colorLightness(color) {
    const rgb = this._parseColor(color);
    if (!rgb) return null;
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  }
  _parseColor(c) {
    if (typeof c !== "string") return null;
    let s = c.trim().toLowerCase();
    if (!s || s === "none" || s === "transparent" || s === "currentcolor" || s.startsWith("url(")) return null;
    const named = { white: [255,255,255], black: [0,0,0], red: [255,0,0], green: [0,128,0],
      blue: [0,0,255], yellow: [255,255,0], gray: [128,128,128], grey: [128,128,128],
      silver: [192,192,192], orange: [255,165,0], gold: [255,215,0] };
    if (named[s]) return named[s];
    let m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split("").map(x => x + x).join("");
      if (h.length === 4) h = h.slice(0, 3).split("").map(x => x + x).join(""); // #rgba -> rgb
      if (h.length >= 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      return null;
    }
    m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(",").map(x => parseFloat(x.trim()));
      if (p.length >= 3 && p.every((n, i) => i > 2 || Number.isFinite(n))) return [p[0], p[1], p[2]];
    }
    return null;
  }

  // ---------- Sedute ----------
  _refreshSessionGrid() {
    const grid = this.main.querySelector("#session-grid");
    if (!grid) return;
    const list = this._filteredSessions();
    grid.innerHTML = list.length ? list.map(s => this._sessionCard(s)).join("")
      : this._empty("Nessuna seduta corrisponde ai filtri.");
    const count = this.main.querySelector("#s-filters-count");
    if (count) count.textContent = `${list.length} sedute trovate`;
    this._updateFilterBadge(this.main, "sedute", this._sfFilterCount());
    this._wireSessionCards();
  }

  // Conteggio filtri attivi per il badge (esclude la ricerca testuale, sempre visibile a parte).
  _sfFilterCount() {
    const f = this.sessionFilter;
    return this._countActiveFilters([f.qualities.length > 0, f.periods.length > 0, f.materials.length > 0, f.status.size > 0]);
  }

  _filteredSessions() {
    const f = this.sessionFilter;
    const q = (f.q || "").trim().toLowerCase();
    const labelToKeys = new Map();
    (this.customLists.materials || []).forEach(m => {
      if (!labelToKeys.has(m.label)) labelToKeys.set(m.label, new Set());
      labelToKeys.get(m.label).add(m.key);
    });
    const wantedMatLabels = f.materials || [];
    const labelKeySets = wantedMatLabels.map(lbl => labelToKeys.get(lbl) || new Set());

    const matchStatus = (s) => {
      if (!f.status || f.status.size === 0) return true;
      return (f.status.has("favorite") && s.status === "favorite")
        || (f.status.has("memory") && (s.status === "memory" || !s.status));
    };

    return this.sessions
      .filter(matchStatus)
      .filter(s => !q || (s.title || "").toLowerCase().includes(q))
      .filter(s => matchMulti(s.aggregated?.qualitiesCovered, f.qualities, f.logic.qualities))
      .filter(s => matchMulti(s.aggregated?.periodsCovered, f.periods, f.logic.periods))
      .filter(s => {
        if (!wantedMatLabels.length) return true;
        const keys = new Set((s.aggregated?.materialsAggregated || []).map(m => m.key));
        const has = (ks) => [...ks].some(k => keys.has(k));
        return f.logic.materials === "and" ? labelKeySets.every(has) : labelKeySets.some(has);
      })
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  // Composer sedute (schema 2.4): la seduta è una sequenza di BLOCCHI liberi (titolo + note),
  // ognuno con esercizi opzionali agganciati dal catalogo. Un solo blocco alla volta è "attivo"
  // per l'aggiunta di esercizi (selettore con filtri riusato identico a prima, ora scoped al
  // blocco attivo invece che alla seduta intera). exerciseIds/aggregated in cima alla seduta
  // restano una cache piatta derivata dai blocchi, per non dover toccare Report/Presenze/scheda
  // portiere che li leggono così come sono.
  _resetComposer() {
    const b = { id: genId(), title: "", notes: "", exerciseIds: [] };
    this.composer = { id: null, title: "", blocks: [b], activeBlockId: b.id, goalkeeperIds: [] };
  }

  _activeComposerBlock() {
    if (!this.composer || !Array.isArray(this.composer.blocks) || !this.composer.blocks.length) return null;
    let b = this.composer.blocks.find(x => x.id === this.composer.activeBlockId);
    if (!b) { b = this.composer.blocks[0]; this.composer.activeBlockId = b.id; }
    return b;
  }

  _blockLabel(b) { return (b && b.title && b.title.trim()) || "Blocco senza titolo"; }

  _blockChipsHtml(b) {
    return (b.exerciseIds || []).map(id => {
      const ex = this.exercises.find(x => x.id === id);
      return `<span class="block-chip">${escapeHtml(ex ? ex.title : "(esercizio rimosso)")}<button type="button" class="block-chip-del" data-blkid="${escapeAttr(b.id)}" data-exid="${escapeAttr(id)}" title="Rimuovi">✕</button></span>`;
    }).join("") || `<span class="muted small">Nessun esercizio collegato.</span>`;
  }

  _blocksHtml() {
    return this.composer.blocks.map((b, i) => {
      const isActive = b.id === this.composer.activeBlockId;
      return `<div class="sess-block card-soft ${isActive ? "is-active" : ""}" data-blockid="${escapeAttr(b.id)}">
        <div class="sess-block-head">
          <input type="text" class="input block-title" data-blkid="${escapeAttr(b.id)}" placeholder="Es. Riscaldamento, Parte tecnica, Partitella…" value="${escapeAttr(b.title)}">
          <div class="sess-block-tools">
            <button type="button" class="icon-btn" data-blkup="${escapeAttr(b.id)}" title="Sposta su" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="icon-btn" data-blkdown="${escapeAttr(b.id)}" title="Sposta giù" ${i === this.composer.blocks.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="icon-btn danger" data-blkdel="${escapeAttr(b.id)}" title="Elimina blocco" ${this.composer.blocks.length <= 1 ? "disabled" : ""}>${ICO_DEL}</button>
          </div>
        </div>
        <textarea class="input block-notes" data-blkid="${escapeAttr(b.id)}" rows="2" placeholder="Note libere per questo blocco (facoltative)…">${escapeHtml(b.notes)}</textarea>
        <div class="block-chips">${this._blockChipsHtml(b)}</div>
        <button type="button" class="link-btn ${isActive ? "is-active-hint" : ""}" data-blkactivate="${escapeAttr(b.id)}">${isActive ? "✓ Blocco attivo per aggiungere esercizi" : "Aggiungi esercizi qui →"}</button>
      </div>`;
    }).join("");
  }

  renderSedute() {
    this._destroyPickers();
    if (!this.composer || !Array.isArray(this.composer.blocks) || !this.composer.blocks.length) this._resetComposer();
    if (!Array.isArray(this.composer.goalkeeperIds)) this.composer.goalkeeperIds = [];
    const sList = this._filteredSessions();
    const activeBlock = this._activeComposerBlock();
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head">
          <div><h2>Sedute</h2><p class="muted">${this.sessions.length} salvate</p></div>
        </div>

        <div class="session-layout">
          <div class="composer card-soft">
            <h3>${this.composer.id ? "Modifica seduta" : "Componi seduta"}</h3>
            <label class="field">
              <span class="field-label">Titolo seduta</span>
              <input type="text" id="s-title" class="input" placeholder="Es. Seduta 1 — reattività e tuffo" value="${escapeAttr(this.composer.title)}">
            </label>

            <span class="field-label">Blocchi della seduta</span>
            <p class="muted small">Ogni blocco è un pezzo libero della seduta (titolo + note); collegare esercizi dal catalogo è facoltativo.</p>
            <div class="sess-blocks" id="sess-blocks">${this._blocksHtml()}</div>
            <button type="button" class="btn btn-soft" id="s-add-block">＋ Aggiungi blocco</button>

            <div class="composer-picker">
              <span class="field-label">Esercizi nel blocco attivo: <b id="active-block-label">${escapeHtml(this._blockLabel(activeBlock))}</b> (<span id="pick-chosen-count">${(activeBlock?.exerciseIds || []).length}</span>)</span>
              <div class="pick-list pick-list-chosen" id="pick-chosen"></div>

              <div class="filters card-soft filters-compact" id="composer-filters">
                <input type="search" id="cf-search" class="input" placeholder="Cerca esercizio…" value="${escapeAttr(this.composerFilter.q)}">
                <div class="filters-pickers">
                  <div class="filter-field"><span class="field-label">Gesti</span><div id="cfp-gestures"></div>${this._logicRowHtml("gestures")}</div>
                  <div class="filter-field"><span class="field-label">Qualità</span><div id="cfp-qualities"></div>${this._logicRowHtml("qualities")}</div>
                  <div class="filter-field"><span class="field-label">Periodo</span><div id="cfp-periods"></div>${this._logicRowHtml("periods")}</div>
                  <div class="filter-field"><span class="field-label">Materiali</span><div id="cfp-materials"></div>${this._logicRowHtml("materials")}</div>
                </div>
                <div class="filters-foot">
                  <div class="seg filter-status">
                    <button type="button" class="seg-btn ${this.composerFilter.status.has('favorite') ? 'is-on' : ''}" data-cfstatus="favorite">Preferiti</button>
                    <button type="button" class="seg-btn ${this.composerFilter.status.has('memory') ? 'is-on' : ''}" data-cfstatus="memory">In memoria</button>
                  </div>
                  <div class="filters-foot-right">
                    <span class="filters-count" id="cf-count"></span>
                    <button type="button" class="link-btn" id="cf-clear">Cancella filtri</button>
                  </div>
                </div>
              </div>

              <span class="field-label">Esercizi disponibili</span>
              <div class="pick-list" id="pick-available"></div>
            </div>

            <div class="form-actionbar">
              <span class="form-actionbar-label">${this.composer.id ? "Modifica seduta" : "Nuova seduta"}</span>
              <div class="form-actionbar-btns">
                <button type="button" class="btn" id="s-reset">Azzera</button>
                <button type="button" class="btn btn-primary" id="s-save">${this.composer.id ? "Aggiorna seduta" : "Salva seduta"}</button>
              </div>
            </div>
          </div>

          <aside class="agg card-soft" id="agg-panel">${this._aggregationPanel()}</aside>
        </div>

        <h3 class="section-h">Sedute salvate</h3>
        <div class="filters card-soft" id="session-filters">
          <div class="filters-topbar">
            <input type="search" id="s-search" class="input" placeholder="Cerca per titolo seduta…" value="${escapeAttr(this.sessionFilter.q)}">
            ${this._filterToggleBtnHtml("sedute", this._sfFilterCount())}
          </div>
          <div class="filters-collapse" id="fp-collapse-sedute">
            <div class="filters-pickers">
              <div class="filter-field"><span class="field-label">Qualità allenate</span><div id="sfp-qualities"></div>${this._logicRowHtml("qualities")}</div>
              <div class="filter-field"><span class="field-label">Periodi</span><div id="sfp-periods"></div>${this._logicRowHtml("periods")}</div>
              <div class="filter-field"><span class="field-label">Materiali</span><div id="sfp-materials"></div>${this._logicRowHtml("materials")}</div>
            </div>
            <div class="filters-foot">
              <div class="seg filter-status">
                <button type="button" class="seg-btn ${this.sessionFilter.status.has('favorite') ? 'is-on' : ''}" data-sfstatus="favorite">Preferiti</button>
                <button type="button" class="seg-btn ${this.sessionFilter.status.has('memory') ? 'is-on' : ''}" data-sfstatus="memory">In memoria</button>
              </div>
              <div class="filters-foot-right">
                <span class="filters-count" id="s-filters-count">${sList.length} sedute trovate</span>
                <button type="button" class="link-btn" id="s-clear-filters">Cancella filtri</button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-grid" id="session-grid">
          ${sList.length ? sList.map(s => this._sessionCard(s)).join("") : this._empty(this.sessions.length ? "Nessuna seduta corrisponde ai filtri." : "Nessuna seduta salvata.")}
        </div>
      </section>
    `;
    this.main.querySelector("#s-title").addEventListener("input", (e) => { this.composer.title = e.target.value; });

    // --- blocchi: titolo/note aggiornano lo stato senza ri-render; struttura/attivazione ri-renderizzano ---
    const blocksWrap = this.main.querySelector("#sess-blocks");
    blocksWrap.querySelectorAll(".block-title").forEach(inp => inp.addEventListener("input", () => {
      const b = this.composer.blocks.find(x => x.id === inp.dataset.blkid);
      if (!b) return;
      b.title = inp.value;
      if (this.composer.activeBlockId === b.id) {
        const lbl = this.main.querySelector("#active-block-label");
        if (lbl) lbl.textContent = this._blockLabel(b);
      }
    }));
    blocksWrap.querySelectorAll(".block-notes").forEach(ta => ta.addEventListener("input", () => {
      const b = this.composer.blocks.find(x => x.id === ta.dataset.blkid);
      if (b) b.notes = ta.value;
    }));
    blocksWrap.querySelectorAll("[data-blkactivate]").forEach(btn => btn.addEventListener("click", () => {
      this.composer.activeBlockId = btn.dataset.blkactivate;
      this.renderSedute();
    }));
    blocksWrap.querySelectorAll("[data-blkup]").forEach(btn => btn.addEventListener("click", () => {
      const idx = this.composer.blocks.findIndex(x => x.id === btn.dataset.blkup);
      if (idx > 0) { const [b] = this.composer.blocks.splice(idx, 1); this.composer.blocks.splice(idx - 1, 0, b); this.renderSedute(); }
    }));
    blocksWrap.querySelectorAll("[data-blkdown]").forEach(btn => btn.addEventListener("click", () => {
      const idx = this.composer.blocks.findIndex(x => x.id === btn.dataset.blkdown);
      if (idx >= 0 && idx < this.composer.blocks.length - 1) { const [b] = this.composer.blocks.splice(idx, 1); this.composer.blocks.splice(idx + 1, 0, b); this.renderSedute(); }
    }));
    blocksWrap.querySelectorAll("[data-blkdel]").forEach(btn => btn.addEventListener("click", () => {
      if (this.composer.blocks.length <= 1) return;
      if (!confirm("Eliminare questo blocco? Gli esercizi collegati vengono scollegati solo da qui, restano nel catalogo.")) return;
      this.composer.blocks = this.composer.blocks.filter(x => x.id !== btn.dataset.blkdel);
      if (this.composer.activeBlockId === btn.dataset.blkdel) this.composer.activeBlockId = this.composer.blocks[0].id;
      this.renderSedute();
    }));
    blocksWrap.querySelectorAll(".block-chip-del").forEach(btn => btn.addEventListener("click", () => {
      const b = this.composer.blocks.find(x => x.id === btn.dataset.blkid);
      if (b) b.exerciseIds = b.exerciseIds.filter(id => id !== btn.dataset.exid);
      this.renderSedute();
    }));

    this.main.querySelector("#s-add-block").addEventListener("click", () => {
      const b = { id: genId(), title: "", notes: "", exerciseIds: [] };
      this.composer.blocks.push(b);
      this.composer.activeBlockId = b.id;
      this.renderSedute();
    });
    this.main.querySelector("#s-reset").addEventListener("click", () => {
      this._resetComposer();
      this.composerFilter = { q: "", status: new Set(), gestures: [], qualities: [], periods: [], materials: [], logic: { gestures: "or", qualities: "or", periods: "or", materials: "or" } };
      this.renderSedute();
    });
    this.main.querySelector("#s-save").addEventListener("click", () => this._saveSession());

    // --- filtri del SELETTORE seduta (riusa gli stessi componenti dell'indice); scoped al blocco attivo ---
    const cBar = this.main.querySelector("#composer-filters");
    const cSearch = this.main.querySelector("#cf-search");
    cSearch.addEventListener("input", () => { this.composerFilter.q = cSearch.value; this._refreshComposerLists(); });
    this.cfpGestures = new TagPicker(this.main.querySelector("#cfp-gestures"), {
      getOptions: () => this.customLists.technicalGestures || [], selected: this.composerFilter.gestures,
      placeholder: "Gesto…", onChange: (sel) => { this.composerFilter.gestures = sel; this._syncLogicToggles(cBar, this.composerFilter); this._refreshComposerLists(); }
    });
    this.cfpQualities = new TagPicker(this.main.querySelector("#cfp-qualities"), {
      getOptions: () => this.customLists.trainedQualities || [], selected: this.composerFilter.qualities,
      placeholder: "Qualità…", onChange: (sel) => { this.composerFilter.qualities = sel; this._syncLogicToggles(cBar, this.composerFilter); this._refreshComposerLists(); }
    });
    this.cfpPeriods = new TagPicker(this.main.querySelector("#cfp-periods"), {
      getOptions: () => this.customLists.trainingPeriods || [], selected: this.composerFilter.periods,
      placeholder: "Periodo…", onChange: (sel) => { this.composerFilter.periods = sel; this._syncLogicToggles(cBar, this.composerFilter); this._refreshComposerLists(); }
    });
    this.cfpMaterials = new MaterialQtyPicker(this.main.querySelector("#cfp-materials"), {
      getMaterials: () => this.customLists.materials || [], selected: this.composerFilter.materials,
      placeholder: "Materiale…", onChange: (sel) => { this.composerFilter.materials = sel; this._syncLogicToggles(cBar, this.composerFilter); this._refreshComposerLists(); }
    });
    this._pickers.push(this.cfpGestures, this.cfpQualities, this.cfpPeriods, this.cfpMaterials);
    this._wireLogicToggles(cBar, this.composerFilter, () => this._refreshComposerLists());
    this._syncLogicToggles(cBar, this.composerFilter);
    cBar.querySelectorAll("[data-cfstatus]").forEach(b =>
      b.addEventListener("click", () => {
        const s = b.dataset.cfstatus;
        if (this.composerFilter.status.has(s)) this.composerFilter.status.delete(s); else this.composerFilter.status.add(s);
        b.classList.toggle("is-on");
        this._refreshComposerLists();
      }));
    this.main.querySelector("#cf-clear").addEventListener("click", () => {
      this.composerFilter = { q: "", status: new Set(), gestures: [], qualities: [], periods: [], materials: [], logic: { gestures: "or", qualities: "or", periods: "or", materials: "or" } };
      this.renderSedute();
    });
    this._refreshComposerLists();

    // --- filtri sedute salvate (stesso pattern dell'indice esercizi) ---
    const sBar = this.main.querySelector("#session-filters");
    const sSearch = this.main.querySelector("#s-search");
    sSearch.addEventListener("input", () => { this.sessionFilter.q = sSearch.value; this._refreshSessionGrid(); });
    this.sfpQualities = new TagPicker(this.main.querySelector("#sfp-qualities"), {
      getOptions: () => this.customLists.trainedQualities || [],
      selected: this.sessionFilter.qualities,
      placeholder: "Filtra per qualità…",
      onChange: (sel) => { this.sessionFilter.qualities = sel; this._syncLogicToggles(sBar, this.sessionFilter); this._refreshSessionGrid(); }
    });
    this.sfpPeriods = new TagPicker(this.main.querySelector("#sfp-periods"), {
      getOptions: () => this.customLists.trainingPeriods || [],
      selected: this.sessionFilter.periods,
      placeholder: "Filtra per periodo…",
      onChange: (sel) => { this.sessionFilter.periods = sel; this._syncLogicToggles(sBar, this.sessionFilter); this._refreshSessionGrid(); }
    });
    this.sfpMaterials = new TagPicker(this.main.querySelector("#sfp-materials"), {
      getOptions: () => (this.customLists.materials || []).map(m => m.label),
      selected: this.sessionFilter.materials,
      placeholder: "Filtra per materiale…",
      onChange: (sel) => { this.sessionFilter.materials = sel; this._syncLogicToggles(sBar, this.sessionFilter); this._refreshSessionGrid(); }
    });
    this._pickers.push(this.sfpQualities, this.sfpPeriods, this.sfpMaterials);
    this._wireLogicToggles(sBar, this.sessionFilter, () => this._refreshSessionGrid());
    this._syncLogicToggles(sBar, this.sessionFilter);
    sBar.querySelectorAll("[data-sfstatus]").forEach(b =>
      b.addEventListener("click", () => {
        const s = b.dataset.sfstatus;
        if (this.sessionFilter.status.has(s)) this.sessionFilter.status.delete(s); else this.sessionFilter.status.add(s);
        b.classList.toggle("is-on");
        this._refreshSessionGrid();
      }));
    this.main.querySelector("#s-clear-filters").addEventListener("click", () => {
      this.sessionFilter = { q: "", status: new Set(), qualities: [], periods: [], materials: [], logic: { qualities: "or", periods: "or", materials: "or" } };
      this.renderSedute();
    });

    this._wireSessionCards();
    this._wireFilterToggle(this.main, "sedute");
  }

  _sessionPick(ex) {
    const activeBlock = this._activeComposerBlock();
    const checked = activeBlock && activeBlock.exerciseIds.includes(ex.id) ? "checked" : "";
    return `<label class="pick-row">
      <input type="checkbox" data-pick="${escapeAttr(ex.id)}" ${checked}>
      <span class="pick-title">${escapeHtml(ex.title)}</span>
      <span class="muted small">${ex.parameters?.estimatedTotalSeconds ? formatDuration(ex.parameters.estimatedTotalSeconds) : "—"}</span>
    </label>`;
  }

  _refreshAgg() {
    const panel = this.main.querySelector("#agg-panel");
    if (panel) panel.innerHTML = this._aggregationPanel();
  }

  // Aggiorna le due liste del selettore: "nel blocco attivo" (non filtrata) e "disponibili" (filtrata).
  _refreshComposerLists() {
    const chosenWrap = this.main.querySelector("#pick-chosen");
    const availWrap = this.main.querySelector("#pick-available");
    if (!chosenWrap || !availWrap) return;
    const activeBlock = this._activeComposerBlock();
    const activeIds = activeBlock ? activeBlock.exerciseIds : [];
    const chosen = activeIds.map(id => this.exercises.find(x => x.id === id)).filter(Boolean);
    const availableAll = this.exercises.filter(ex => !activeIds.includes(ex.id));
    const available = this._applyExerciseFilters(availableAll, this.composerFilter)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    chosenWrap.innerHTML = chosen.length
      ? chosen.map(ex => this._sessionPick(ex)).join("")
      : `<p class="muted small">Nessun esercizio in questo blocco: aggiungili qui sotto (facoltativo).</p>`;
    availWrap.innerHTML = !this.exercises.length
      ? `<p class="muted small">Nessun esercizio in archivio.</p>`
      : (available.length ? available.map(ex => this._sessionPick(ex)).join("")
        : `<p class="muted small">Nessun esercizio disponibile con questi filtri.</p>`);

    const cc = this.main.querySelector("#pick-chosen-count"); if (cc) cc.textContent = activeIds.length;
    const ac = this.main.querySelector("#cf-count"); if (ac) ac.textContent = `${available.length} esercizi disponibili`;

    this.main.querySelectorAll("[data-pick]").forEach(cb =>
      cb.addEventListener("change", () => {
        const id = cb.dataset.pick;
        const b = this._activeComposerBlock();
        if (!b) return;
        if (cb.checked) { if (!b.exerciseIds.includes(id)) b.exerciseIds.push(id); }
        else b.exerciseIds = b.exerciseIds.filter(x => x !== id);
        this._refreshComposerLists();
        this._refreshAgg();
        this._refreshActiveBlockChipsInline(b);
      }));
  }

  // Aggiorna solo i chip esercizi del blocco attivo nella colonna sinistra, senza un render
  // completo (che farebbe perdere focus/scroll sui filtri del selettore appena usati).
  _refreshActiveBlockChipsInline(b) {
    const card = [...this.main.querySelectorAll(".sess-block")].find(el => el.dataset.blockid === b.id);
    if (!card) return;
    const chipsWrap = card.querySelector(".block-chips");
    if (!chipsWrap) return;
    chipsWrap.innerHTML = this._blockChipsHtml(b);
    chipsWrap.querySelectorAll(".block-chip-del").forEach(btn => btn.addEventListener("click", () => {
      const bb = this.composer.blocks.find(x => x.id === btn.dataset.blkid);
      if (bb) bb.exerciseIds = bb.exerciseIds.filter(id => id !== btn.dataset.exid);
      this.renderSedute();
    }));
  }

  _aggregationPanel() {
    const allIds = [...new Set((this.composer.blocks || []).flatMap(b => b.exerciseIds || []))];
    const chosen = allIds.map(id => this.exercises.find(x => x.id === id)).filter(Boolean);
    const agg = aggregateSession(chosen);
    const showDuration = this.profile && this.profile.appMode === "completa";
    const quals = agg.qualitiesCovered.map(q => `<span class="chip chip-sm">${escapeHtml(q)}</span>`).join("") || `<span class="muted small">—</span>`;
    const periods = agg.periodsCovered.map(p => `<span class="chip chip-sm">${escapeHtml(p)}</span>`).join("") || `<span class="muted small">—</span>`;
    const mats = agg.materialsAggregated.map(m => {
      const mat = this.customLists.materials.find(x => x.key === m.key);
      return `<li><span>${escapeHtml(mat ? mat.label : m.key)}</span><span class="qty">×${m.qty}</span></li>`;
    }).join("") || `<li class="muted small">—</li>`;
    return `
      <h3>Riepilogo Seduta</h3>
      <div class="stat-duo">
        <div class="stat"><span class="stat-label">Esercizi</span><span class="stat-value">${chosen.length}</span></div>
        ${showDuration ? `<div class="stat stat-hero"><span class="stat-label">Durata totale</span><span class="stat-value">${formatDuration(agg.totalDurationSeconds)}</span></div>` : ""}
      </div>
      <div class="agg-block"><span class="field-label">Qualità allenate</span><div class="chips">${quals}</div></div>
      <div class="agg-block"><span class="field-label">Periodi coperti</span><div class="chips">${periods}</div></div>
      <div class="agg-block"><span class="field-label">Materiali aggregati</span><ul class="mat-list compact">${mats}</ul></div>
    `;
  }

  async _saveSession() {
    if (!this.composer.title.trim()) { this.toast("Dai un titolo alla seduta.", "error"); return; }
    const now = new Date().toISOString();
    const blocks = this.composer.blocks.map(b => ({ id: b.id, title: (b.title || "").trim(), notes: (b.notes || "").trim(), exerciseIds: [...(b.exerciseIds || [])] }));
    const flatIds = [...new Set(blocks.flatMap(b => b.exerciseIds))];
    const chosen = flatIds.map(id => this.exercises.find(x => x.id === id)).filter(Boolean);
    const existing = this.composer.id ? this.sessions.find(s => s.id === this.composer.id) : null;
    const session = {
      ...(existing || {}),
      type: "session",
      id: existing ? existing.id : genId(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      title: this.composer.title.trim(),
      blocks,
      exerciseIds: flatIds,   // cache piatta retrocompatibile (Report/Presenze/scheda portiere)
      goalkeeperIds: [...(this.composer.goalkeeperIds || [])],
      aggregated: aggregateSession(chosen),
      status: existing?.status || "memory"
    };
    await storage.putSession(session);
    const idx = this.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) this.sessions[idx] = session; else this.sessions.push(session);
    this._resetComposer();
    this.toast("Seduta salvata.");
    this.renderSedute();
  }

  _sessionCard(s) {
    const mats = (s.aggregated?.materialsAggregated || []).map(m => {
      const mat = this.customLists.materials.find(x => x.key === m.key);
      return `${escapeHtml(mat ? mat.label : m.key)}×${m.qty}`;
    }).join(", ");
    const showDuration = this.profile && this.profile.appMode === "completa";
    const blockTitles = (s.blocks || []).map(b => (b.title || "").trim()).filter(Boolean);
    const nBlocks = (s.blocks || []).length;
    const periodiz = s.periodizationSuggestion
      ? `<div class="periodiz"><span class="field-label">Periodizzazione (da Claude)</span><p>${escapeHtml(s.periodizationSuggestion)}</p></div>` : "";
    return `<article class="sess-card" data-sid="${escapeAttr(s.id)}">
      <div class="sess-head"><h3>${escapeHtml(s.title)}</h3>
        <button type="button" class="star ${s.status==='favorite'?'is-on':''}" data-sfav="${escapeAttr(s.id)}">★</button></div>
      <div class="ex-meta"><span>${nBlocks} blocc${nBlocks === 1 ? "o" : "hi"}</span><span class="dot">·</span><span>${(s.exerciseIds||[]).length} esercizi</span>${showDuration ? `<span class="dot">·</span><span>⏱ ${formatDuration(s.aggregated?.totalDurationSeconds || 0)}</span>` : ""}</div>
      ${blockTitles.length ? `<div class="ex-chips">${blockTitles.map(t => `<span class="chip chip-sm">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      <div class="ex-chips">${(s.aggregated?.qualitiesCovered||[]).slice(0,4).map(q=>`<span class="chip chip-sm">${escapeHtml(q)}</span>`).join("")}</div>
      ${mats ? `<p class="muted small">Materiali: ${escapeHtml(mats)}</p>` : ""}
      ${(s.aggregated?.periodsCovered||[]).length ? `<p class="muted small">Periodi: ${escapeHtml((s.aggregated.periodsCovered).join(", "))}</p>` : ""}
      ${periodiz}
      <div class="ex-actions">
        <button type="button" class="link-btn" data-sedit="${escapeAttr(s.id)}">Modifica seduta</button>
        <button type="button" class="link-btn" data-sexport="${escapeAttr(s.id)}">Esporta</button>
        <button type="button" class="link-btn danger" data-sdel="${escapeAttr(s.id)}">Elimina</button>
      </div>
    </article>`;
  }

  _wireSessionCards() {
    this.main.querySelectorAll("[data-sfav]").forEach(b => b.addEventListener("click", async () => {
      const s = this.sessions.find(x => x.id === b.dataset.sfav); if (!s) return;
      s.status = s.status === "favorite" ? "memory" : "favorite"; s.updatedAt = new Date().toISOString();
      await storage.putSession(s); this.renderSedute();
    }));
    this.main.querySelectorAll("[data-sedit]").forEach(b => b.addEventListener("click", () => {
      const s = this.sessions.find(x => x.id === b.dataset.sedit); if (!s) return;
      const srcBlocks = (s.blocks && s.blocks.length) ? s.blocks : [{ id: genId(), title: "Esercizi", notes: "", exerciseIds: [...(s.exerciseIds || [])] }];
      const blocks = srcBlocks.map(b => ({ id: b.id || genId(), title: b.title || "", notes: b.notes || "", exerciseIds: [...(b.exerciseIds || [])] }));
      this.composer = { id: s.id, title: s.title, blocks, activeBlockId: blocks[0].id, goalkeeperIds: [...(s.goalkeeperIds||[])] };
      this.renderSedute();
    }));
    this.main.querySelectorAll("[data-sdel]").forEach(b => b.addEventListener("click", async () => {
      const s = this.sessions.find(x => x.id === b.dataset.sdel); if (!s) return;
      if (!confirm(`Eliminare la seduta "${s.title}"?`)) return;
      await storage.deleteSession(s.id);
      this.sessions = this.sessions.filter(x => x.id !== s.id);
      this.toast("Seduta eliminata."); this.renderSedute();
    }));
    this.main.querySelectorAll("[data-sexport]").forEach(b => b.addEventListener("click", () => {
      const s = this.sessions.find(x => x.id === b.dataset.sexport); if (!s) return;
      const includedEx = this.exercises.filter(e => (s.exerciseIds||[]).includes(e.id));
      const json = exportToJsonString([s, ...includedEx], this.customLists);
      triggerDownload(`${slugFile(s.title)}.json`, json);
    }));
  }


  // ========================================================================
  // ====================  PORTIERI (anagrafica + schede)  ==================
  // ========================================================================
  _gkFullName(gk) {
    const n = [gk.firstName, gk.lastName].filter(Boolean).join(" ").trim();
    return n || "Portiere senza nome";
  }
  _gkInitials(gk) {
    const a = (gk.firstName || "").trim()[0] || "";
    const b = (gk.lastName || "").trim()[0] || "";
    return (a + b).toUpperCase() || "?";
  }
  _gkAge(birthDate) {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return (age >= 0 && age < 120) ? age : null;
  }
  // Avatar: foto ritagliata in cerchio oppure iniziali (stesso pattern dell'avatar account).
  _gkPhotoHtml(gk, extraClass = "") {
    if (gk.photo) return `<span class="gk-avatar ${extraClass}"><img src="${escapeAttr(gk.photo)}" alt="${escapeAttr(this._gkFullName(gk))}"></span>`;
    return `<span class="gk-avatar gk-avatar-ini ${extraClass}">${escapeHtml(this._gkInitials(gk))}</span>`;
  }
  _gkAvatarMini(gk) { return this._gkPhotoHtml(gk, "gk-avatar-mini"); }

  _filteredGoalkeepers() {
    const q = (this.gkFilter.q || "").trim().toLowerCase();
    return this.goalkeepers.filter(g => {
      if (this.gkFilter.status === "active" && !g.active) return false;
      if (this.gkFilter.status === "inactive" && g.active) return false;
      if (this.gkFilter.category && g.category !== this.gkFilter.category) return false;
      if (q) {
        const name = `${g.firstName || ""} ${g.lastName || ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => this._gkFullName(a).localeCompare(this._gkFullName(b)));
  }

  renderPortieri() {
    this._destroyPickers();
    const list = this._filteredGoalkeepers();
    const cats = this.customLists.goalkeeperCategories || [];
    const catOpts = `<option value="">Tutte le categorie</option>` +
      cats.map(c => `<option value="${escapeAttr(c)}" ${this.gkFilter.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
    const stOn = (v) => this.gkFilter.status === v ? "is-on" : "";
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head">
          <div><h2>Portieri</h2><p class="muted">${this.goalkeepers.length} in anagrafica</p></div>
          <div class="head-actions">
            <button type="button" class="btn btn-soft" id="gk-import">Importa portiere</button>
            <button type="button" class="btn btn-primary" id="gk-new">＋ Nuovo portiere</button>
          </div>
        </div>

        <div class="filters card-soft">
          <div class="filters-topbar">
            <input type="search" id="gk-search" class="input" placeholder="Cerca per nome o cognome…" value="${escapeAttr(this.gkFilter.q)}">
            ${this._filterToggleBtnHtml("portieri", this._gkFilterCount())}
          </div>
          <div class="filters-collapse" id="fp-collapse-portieri">
            <div class="filters-pickers">
              <div class="filter-field"><span class="field-label">Categoria</span>
                <select id="gk-filter-cat" class="input">${catOpts}</select></div>
            </div>
            <div class="filters-foot">
              <div class="filter-field">
                <span class="field-label">Stato</span>
                <div class="seg filter-status">
                  <button type="button" class="seg-btn ${stOn('all')}" data-gkstatus="all">Tutti</button>
                  <button type="button" class="seg-btn ${stOn('active')}" data-gkstatus="active">Attivi</button>
                  <button type="button" class="seg-btn ${stOn('inactive')}" data-gkstatus="inactive">Non attivi</button>
                </div>
              </div>
              <div class="filters-foot-right">
                <span class="filters-count" id="gk-count">${list.length} portieri</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card-grid" id="gk-grid" data-cols="auto">
          ${list.length ? list.map(g => this._goalkeeperCard(g)).join("") : this._empty(this.goalkeepers.length ? "Nessun portiere corrisponde ai filtri." : "Nessun portiere in anagrafica. Creane uno nuovo.")}
        </div>
      </section>`;

    this.main.querySelector("#gk-new").addEventListener("click", () => this.setRoute("gk-editor", null));
    this.main.querySelector("#gk-import").addEventListener("click", () => this._promptImportGoalkeeper());
    const search = this.main.querySelector("#gk-search");
    search.addEventListener("input", () => { this.gkFilter.q = search.value; this._refreshGkGrid(); });
    this.main.querySelector("#gk-filter-cat").addEventListener("change", (e) => { this.gkFilter.category = e.target.value; this._refreshGkGrid(); });
    this.main.querySelectorAll("[data-gkstatus]").forEach(b => b.addEventListener("click", () => {
      this.gkFilter.status = b.dataset.gkstatus;
      this.main.querySelectorAll("[data-gkstatus]").forEach(x => x.classList.toggle("is-on", x === b));
      this._refreshGkGrid();
    }));
    this._wireGkCards();
    this._wireFilterToggle(this.main, "portieri");
  }

  // Conteggio filtri attivi per il badge (esclude la ricerca testuale, sempre visibile a parte).
  _gkFilterCount() {
    const f = this.gkFilter;
    return this._countActiveFilters([!!f.category, f.status !== "all"]);
  }

  // Badge di stato salute (schema 2.4): riusato in card, scheda dettaglio, editor e picker.
  _healthBadge(gk, extraClass) {
    const status = HEALTH_STATUS_ORDER.includes(gk.healthStatus) ? gk.healthStatus : "healthy";
    return `<span class="health-badge health-${status}${extraClass ? " " + extraClass : ""}">${HEALTH_STATUS_LABELS[status]}</span>`;
  }

  _goalkeeperCard(gk) {
    const age = this._gkAge(gk.birthDate);
    return `
      <article class="gk-card" data-gkid="${escapeAttr(gk.id)}" tabindex="0">
        <div class="gk-card-thumb">
          ${this._gkPhotoHtml(gk, "gk-avatar-lg")}
          <div class="gk-overlay">
            <button type="button" class="ex-ov-btn" data-gkedit="${escapeAttr(gk.id)}" title="Modifica portiere" aria-label="Modifica portiere">${ICO_EDIT}</button>
            <button type="button" class="ex-ov-btn" data-gkdelete="${escapeAttr(gk.id)}" title="Elimina" aria-label="Elimina">${ICO_DEL}</button>
          </div>
        </div>
        <div class="gk-card-body">
          <h3 class="gk-card-title">${escapeHtml(this._gkFullName(gk))}</h3>
          <p class="gk-card-sub">${gk.category ? escapeHtml(gk.category) : '<span class="muted">Senza categoria</span>'}${age != null ? ` · ${age} anni` : ""}</p>
          <div class="gk-badges">
            ${this._healthBadge(gk)}
            <span class="gk-badge ${gk.active ? 'is-active' : 'is-inactive'}">${gk.active ? "Attivo" : "Non attivo"}</span>
          </div>
        </div>
      </article>`;
  }

  _refreshGkGrid() {
    const grid = this.main.querySelector("#gk-grid");
    if (!grid) return;
    const list = this._filteredGoalkeepers();
    grid.innerHTML = list.length ? list.map(g => this._goalkeeperCard(g)).join("") : this._empty("Nessun portiere corrisponde ai filtri.");
    const c = this.main.querySelector("#gk-count"); if (c) c.textContent = `${list.length} portieri`;
    this._updateFilterBadge(this.main, "portieri", this._gkFilterCount());
    this._wireGkCards();
  }

  _wireGkCards() {
    this.main.querySelectorAll(".gk-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".ex-ov-btn")) return;
        this.setRoute("gk-dettaglio", card.dataset.gkid);
      });
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); this.setRoute("gk-dettaglio", card.dataset.gkid); }
      });
    });
    this.main.querySelectorAll("[data-gkedit]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("gk-editor", el.dataset.gkedit); }));
    this.main.querySelectorAll("[data-gkdelete]").forEach(el =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this._deleteGoalkeeper(el.dataset.gkdelete); }));
  }

  // ---------- Form portiere (creazione / modifica) ----------
  renderGoalkeeperEditor(id) {
    this._destroyPickers();
    const editing = id ? this.goalkeepers.find(g => g.id === id) : null;
    const baseNote = (b) => ({ tags: [...((b && b.tags) || [])], freeText: (b && b.freeText) || "" });
    this.gkForm = {
      id: editing ? editing.id : null,
      photo: editing ? (editing.photo || null) : null,
      healthStatus: (editing && HEALTH_STATUS_ORDER.includes(editing.healthStatus)) ? editing.healthStatus : "healthy",
      notes: {
        technical: baseNote(editing && editing.notes && editing.notes.technical),
        mental: baseNote(editing && editing.notes && editing.notes.mental),
        medical: baseNote(editing && editing.notes && editing.notes.medical)
      }
    };
    const cats = [...(this.customLists.goalkeeperCategories || [])];
    if (editing && editing.category && !cats.includes(editing.category)) cats.unshift(editing.category);
    const catOpts = `<option value="">— nessuna —</option>` +
      cats.map(c => `<option value="${escapeAttr(c)}" ${editing && editing.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
    const foot = editing ? (editing.preferredFoot || "") : "";
    const footRadio = (val, label) =>
      `<label class="gk-foot-opt"><input type="radio" name="gk-foot" value="${val}" ${foot === val ? "checked" : ""}> <span>${label}</span></label>`;

    this.main.innerHTML = `
      <section class="view gk-editor-view">
        <div class="view-head">
          <div><h2>${editing ? "Modifica portiere" : "Nuovo portiere"}</h2></div>
          <div class="head-actions"><button type="button" class="btn" id="gk-back">← Indietro</button></div>
        </div>

        <div class="card-soft gk-form">
          <div class="gk-photo-row">
            <div class="gk-photo-prev" id="gk-photo-prev">${this.gkForm.photo
              ? `<img src="${escapeAttr(this.gkForm.photo)}" alt="Anteprima foto">`
              : `<span class="gk-photo-empty" aria-hidden="true">${NAV_ICONS.portieri}</span>`}</div>
            <div class="gk-photo-actions">
              <label class="btn btn-soft">Carica foto<input type="file" id="gk-photo" accept="image/*" hidden></label>
              <button type="button" class="btn btn-ghost" id="gk-photo-del" ${this.gkForm.photo ? "" : "disabled"}>Rimuovi</button>
              <p class="muted small">Mostrata nelle card e nella scheda (ritagliata in cerchio).</p>
            </div>
          </div>

          <div class="form-grid">
            <label>Nome<input type="text" id="gk-first" class="input" value="${escapeAttr(editing?.firstName || "")}"></label>
            <label>Cognome<input type="text" id="gk-last" class="input" value="${escapeAttr(editing?.lastName || "")}"></label>
            <label>Data di nascita<input type="date" id="gk-birth" class="input" value="${escapeAttr(editing?.birthDate || "")}"></label>
            <label>Categoria<select id="gk-category" class="input">${catOpts}</select></label>
            <div class="gk-health-field form-wide">
              <span class="field-label">Stato</span>
              <div class="gk-health-opts" id="gk-health-opts">
                ${HEALTH_STATUS_ORDER.map(k => `<label class="gk-health-opt health-${k}"><input type="radio" name="gk-health" value="${k}" ${(this.gkForm.healthStatus || "healthy") === k ? "checked" : ""}> <span>${HEALTH_STATUS_LABELS[k]}</span></label>`).join("")}
              </div>
            </div>
            <label>Altezza (cm)<input type="number" id="gk-height" class="input" min="0" max="260" value="${editing?.height != null ? escapeAttr(editing.height) : ""}" placeholder="es. 188"></label>
            <div class="gk-foot-field">
              <span class="field-label">Piede preferito</span>
              <div class="gk-foot-opts">
                ${footRadio("left", "Sinistro")}
                ${footRadio("right", "Destro")}
                ${footRadio("ambidextrous", "Ambidestro")}
              </div>
            </div>
            <label class="switch-row form-wide"><input type="checkbox" id="gk-active" ${editing ? (editing.active ? "checked" : "") : "checked"}> <span>Portiere attivo</span></label>
          </div>

          <h3 class="section-h">Note</h3>
          <div class="gk-notes">
            ${this._gkNoteEditorBlock("Tecnico", "technical", "gk-tp-technical", "gk-note-technical", "Dettagli tecnici liberi…")}
            ${this._gkNoteEditorBlock("Mentale", "mental", "gk-tp-mental", "gk-note-mental", "Dettagli sull'aspetto mentale…")}
            ${this._gkNoteEditorBlock("Medico", "medical", "gk-tp-medical", "gk-note-medical", "Note mediche / disponibilità…")}
          </div>

          <div class="form-actionbar">
            <span class="form-actionbar-label">${editing ? "Modifica portiere" : "Nuovo portiere"}</span>
            <div class="form-actionbar-btns">
              <button type="button" class="btn" id="gk-cancel">Annulla</button>
              <button type="button" class="btn btn-primary" id="gk-save">${editing ? "Aggiorna portiere" : "Crea portiere"}</button>
            </div>
          </div>
        </div>
      </section>`;

    // foto
    this.main.querySelector("#gk-photo").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try { this.gkForm.photo = await resizeImageFile(f, { maxSize: 800, quality: 0.85 }); this._refreshGkPhoto(); }
      catch (_) { this.toast("Immagine non leggibile.", "error"); }
    });
    this.main.querySelector("#gk-photo-del").addEventListener("click", () => { this.gkForm.photo = null; this._refreshGkPhoto(); });

    // tag picker delle note (stesso componente di gesti/qualità), collegati alle liste configurabili
    const mkPicker = (sel, listKey, block) => new TagPicker(this.main.querySelector(sel), {
      getOptions: () => this.customLists[listKey] || [],
      selected: [...this.gkForm.notes[block].tags],
      placeholder: "Cerca un tag…",
      onChange: (s) => { this.gkForm.notes[block].tags = s; }
    });
    this._pickers.push(
      mkPicker("#gk-tp-technical", "technicalNoteTags", "technical"),
      mkPicker("#gk-tp-mental", "mentalNoteTags", "mental"),
      mkPicker("#gk-tp-medical", "medicalNoteTags", "medical")
    );

    this.main.querySelector("#gk-back").addEventListener("click", () => this.setRoute("portieri"));
    this.main.querySelector("#gk-cancel").addEventListener("click", () => this.setRoute("portieri"));
    this.main.querySelector("#gk-save").addEventListener("click", () => this._saveGoalkeeper());
  }

  _gkNoteEditorBlock(title, block, pickerId, textId, placeholder) {
    return `<div class="gk-note-block">
      <h4>${title}</h4>
      <div id="${pickerId}"></div>
      <textarea id="${textId}" class="input" rows="2" placeholder="${escapeAttr(placeholder)}">${escapeHtml(this.gkForm.notes[block].freeText)}</textarea>
    </div>`;
  }

  _refreshGkPhoto() {
    const prev = this.main.querySelector("#gk-photo-prev");
    if (prev) prev.innerHTML = this.gkForm.photo
      ? `<img src="${escapeAttr(this.gkForm.photo)}" alt="Anteprima foto">`
      : `<span class="gk-photo-empty" aria-hidden="true">${NAV_ICONS.portieri}</span>`;
    const del = this.main.querySelector("#gk-photo-del");
    if (del) del.disabled = !this.gkForm.photo;
  }

  async _saveGoalkeeper() {
    const f = this.gkForm;
    const q = (sel) => this.main.querySelector(sel);
    const firstName = (q("#gk-first").value || "").trim();
    const lastName = (q("#gk-last").value || "").trim();
    if (!firstName && !lastName) { this.toast("Inserisci almeno nome o cognome.", "error"); return; }
    const footEl = this.main.querySelector('input[name="gk-foot"]:checked');
    const healthEl = this.main.querySelector('input[name="gk-health"]:checked');
    const heightRaw = (q("#gk-height").value || "").trim();
    const now = new Date().toISOString();
    const existing = f.id ? this.goalkeepers.find(g => g.id === f.id) : null;
    const draft = {
      type: "goalkeeper",
      id: existing ? existing.id : genId(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      firstName, lastName,
      birthDate: (q("#gk-birth").value || "") || null,
      category: q("#gk-category").value || null,
      healthStatus: healthEl ? healthEl.value : "healthy",
      preferredFoot: footEl ? footEl.value : null,
      height: heightRaw === "" ? null : Number(heightRaw),
      photo: f.photo || null,
      notes: {
        technical: { tags: [...f.notes.technical.tags], freeText: (q("#gk-note-technical").value || "").trim() },
        mental: { tags: [...f.notes.mental.tags], freeText: (q("#gk-note-mental").value || "").trim() },
        medical: { tags: [...f.notes.medical.tags], freeText: (q("#gk-note-medical").value || "").trim() }
      },
      active: q("#gk-active").checked
    };
    const gk = normalizeGoalkeeper(draft);
    gk.createdAt = draft.createdAt;   // preserva la data di creazione originale
    gk.updatedAt = now;
    await storage.putGoalkeeper(gk);
    const idx = this.goalkeepers.findIndex(g => g.id === gk.id);
    if (idx >= 0) this.goalkeepers[idx] = gk; else this.goalkeepers.push(gk);
    this.gkForm = null;
    this.toast(existing ? "Portiere aggiornato." : "Portiere creato.");
    this.setRoute("gk-dettaglio", gk.id);
  }

  async _deleteGoalkeeper(id) {
    const gk = this.goalkeepers.find(g => g.id === id);
    if (!gk) return;
    if (!confirm(`Eliminare il portiere "${this._gkFullName(gk)}"? L'operazione non è reversibile.`)) return;
    await storage.deleteGoalkeeper(id);
    this.goalkeepers = this.goalkeepers.filter(g => g.id !== id);
    // Le sedute mantengono il riferimento: dove i portieri sono elencati comparirà "(portiere rimosso)".
    this.toast("Portiere eliminato.");
    if (this.route === "gk-dettaglio") this.setRoute("portieri");
    else this._refreshGkGrid();
  }

  // ---------- Scheda dettaglio portiere ----------
  async renderGoalkeeperDetail(id) {
    this._destroyPickers();
    const gk = this.goalkeepers.find(g => g.id === id);
    if (!gk) { this.setRoute("portieri"); return; }
    const age = this._gkAge(gk.birthDate);
    const foot = gk.preferredFoot ? PREFERRED_FOOT_LABELS[gk.preferredFoot] : null;

    // Base dati per Storico sedute + Esercizi effettuati: SEMPRE calcolata a runtime da
    // storage.js (Impegni + linkedItems + Attendance "present"), mai un dato salvato staticamente.
    // Recuperata una sola volta qui (per i contatori sempre visibili nelle intestazioni); il
    // rendering pesante delle righe/filtri resta comunque rimandato alla prima apertura di ciascuna sezione.
    const completedSessions = await storage.getCompletedSessionsForGoalkeeper(gk.id);
    const seduteCount = completedSessions.reduce((n, e) => n + e.occurrences.length, 0);
    const exIdsSet = new Set();
    completedSessions.forEach(e => (e.session.exerciseIds || []).forEach(exId => exIdsSet.add(exId)));
    const eserciziCount = [...exIdsSet].filter(exId => this.exercises.some(e => e.id === exId)).length;
    const presenzeCount = this._gkAttendanceEntries(gk).length;

    this.gkAccordion = {
      completedSessions,
      exerciseAggregates: null, // calcolato al primo open della sezione Esercizi effettuati
      sedute: { open: false, filter: { from: "", to: "", seasonId: "", type: "", q: "" } },
      presenze: { open: false, filter: { from: "", to: "", seasonId: "", type: "", status: "all" } },
      esercizi: { open: false, filter: { q: "", gestures: [], qualities: [], periods: [], from: "", to: "" } }
    };
    // Apertura pilotata da Report → "Vedi elenco completo": pre-applica lo stesso filtro di
    // periodo e apre subito la sezione richiesta, senza duplicare la logica di filtro.
    let pendingAccKey = null;
    if (this._pendingGkAccordionOpen && this._pendingGkAccordionOpen.goalkeeperId === gk.id) {
      const pending = this._pendingGkAccordionOpen;
      pendingAccKey = pending.key;
      if (this.gkAccordion[pendingAccKey]) {
        this.gkAccordion[pendingAccKey].filter.from = pending.from || "";
        this.gkAccordion[pendingAccKey].filter.to = pending.to || "";
      }
      this._pendingGkAccordionOpen = null;
    }

    const meta = [];
    if (gk.category) meta.push(escapeHtml(gk.category));
    if (age != null) meta.push(`${age} anni`);
    if (foot) meta.push(`Piede: ${escapeHtml(foot)}`);
    if (gk.height != null) meta.push(`${escapeHtml(gk.height)} cm`);

    const accHead = (key, title, count) => `
      <div class="card-soft acc-section">
        <button type="button" class="acc-head" data-acctoggle="${key}" aria-expanded="false">
          <span class="acc-title">${title} <span class="acc-count">(${count})</span></span>
          <span class="acc-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="acc-body" id="acc-body-${key}"></div>
      </div>`;

    this.main.innerHTML = `
      <section class="view gk-detail-view">
        <div class="view-head">
          <div><button type="button" class="btn" id="gk-back">← Portieri</button></div>
          <div class="head-actions">
            <button type="button" class="btn btn-soft" id="gk-export">Esporta portiere</button>
            <button type="button" class="btn btn-soft" id="gk-report">Genera report</button>
            <button type="button" class="btn btn-soft" id="gk-edit">Modifica</button>
            <button type="button" class="btn btn-ghost danger" id="gk-del">Elimina</button>
          </div>
        </div>

        <div class="card-soft gk-detail-head">
          ${this._gkPhotoHtml(gk, "gk-avatar-xl")}
          <div class="gk-detail-id">
            <h2>${escapeHtml(this._gkFullName(gk))} ${this._healthBadge(gk)} <span class="gk-badge ${gk.active ? 'is-active' : 'is-inactive'}">${gk.active ? "Attivo" : "Non attivo"}</span></h2>
            <p class="muted">${meta.length ? meta.join(" · ") : "Nessun dato anagrafico aggiuntivo."}</p>
          </div>
        </div>

        <div class="card-soft">
          <h3 class="section-h">Note</h3>
          <div class="gk-notes-view">
            ${this._gkNoteView("Tecnico", gk.notes && gk.notes.technical)}
            ${this._gkNoteView("Mentale", gk.notes && gk.notes.mental)}
            ${this._gkNoteView("Medico", gk.notes && gk.notes.medical)}
          </div>
        </div>

        ${accHead("sedute", "Storico sedute", seduteCount)}
        ${accHead("presenze", "Storico presenze", presenzeCount)}
        ${accHead("esercizi", "Esercizi effettuati", eserciziCount)}
      </section>`;

    this.main.querySelector("#gk-back").addEventListener("click", () => this.setRoute("portieri"));
    this.main.querySelector("#gk-edit").addEventListener("click", () => this.setRoute("gk-editor", gk.id));
    this.main.querySelector("#gk-del").addEventListener("click", () => this._deleteGoalkeeper(gk.id));
    this.main.querySelector("#gk-export").addEventListener("click", () => this._exportGoalkeeper(gk));
    this.main.querySelector("#gk-report").addEventListener("click", () => {
      this.reportState.goalkeeperId = gk.id;
      this.reportState.result = null;
      this.setRoute("report", gk.id);
    });
    this.main.querySelectorAll("[data-acctoggle]").forEach(btn =>
      btn.addEventListener("click", () => this._toggleAcc(gk, btn.dataset.acctoggle)));
    if (pendingAccKey) this._toggleAcc(gk, pendingAccKey);
  }

  // Espande/collassa una sezione della scheda portiere; calcola/renderizza il contenuto SOLO
  // alla prima apertura (lazy loading), per non appesantire il caricamento della scheda.
  _toggleAcc(gk, key) {
    const state = this.gkAccordion && this.gkAccordion[key];
    if (!state) return;
    state.open = !state.open;
    const btn = this.main.querySelector(`[data-acctoggle="${key}"]`);
    const body = this.main.querySelector(`#acc-body-${key}`);
    if (btn) { btn.classList.toggle("is-open", state.open); btn.setAttribute("aria-expanded", String(state.open)); }
    if (!body) return;
    body.classList.toggle("is-open", state.open);
    if (state.open && !body.dataset.rendered) {
      if (key === "sedute") this._renderAccSedute(gk);
      else if (key === "presenze") this._renderAccPresenze(gk);
      else if (key === "esercizi") this._renderAccEsercizi(gk);
      body.dataset.rendered = "1";
    }
  }

  _gkNoteView(title, block) {
    const tags = (block && block.tags) || [];
    const free = (block && block.freeText) || "";
    if (!tags.length && !free) {
      return `<div class="gk-note-view"><h4>${title}</h4><p class="muted small">—</p></div>`;
    }
    const chips = tags.map(t => `<span class="chip chip-sm">${escapeHtml(t)}</span>`).join("");
    return `<div class="gk-note-view">
      <h4>${title}</h4>
      ${tags.length ? `<div class="ex-chips">${chips}</div>` : ""}
      ${free ? `<p class="gk-note-free">${escapeHtml(free)}</p>` : ""}
    </div>`;
  }

  _fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  _exportGoalkeeper(gk) {
    const json = JSON.stringify(buildSingleGoalkeeperExport(gk), null, 2);
    triggerDownload(`portiere_${slugFile(this._gkFullName(gk))}.json`, json);
  }

  _promptImportGoalkeeper() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const res = parseSingleGoalkeeperImport(text);
        if (!res.ok) { this.toast(res.error, "error"); return; }
        await this._importGoalkeeperResolved(res.goalkeeper);
      } catch (err) {
        this.toast("Import non riuscito: " + (err.message || "errore sconosciuto"), "error");
      }
    });
    input.click();
  }

  async _importGoalkeeperResolved(gk) {
    const exists = this.goalkeepers.some(g => g.id === gk.id);
    if (!exists) { await this._storeImportedGoalkeeper(gk, false); return; }
    const { close } = this._openModal(`
      <h3>Portiere già presente</h3>
      <p class="muted small">Esiste già un portiere con lo stesso identificativo ("${escapeHtml(this._gkFullName(gk))}"). Come procedere?</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-soft" data-mcopy>Salva come copia</button>
        <button type="button" class="btn btn-primary" data-moverwrite>Sovrascrivi</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mcopy]": async () => { close(); await this._storeImportedGoalkeeper(gk, true); },
      "[data-moverwrite]": async () => { close(); await this._storeImportedGoalkeeper(gk, false); }
    });
  }

  async _storeImportedGoalkeeper(gk, asCopy) {
    const now = new Date().toISOString();
    let g = { ...gk };
    if (asCopy) {
      g.id = genId();
      g.lastName = (gk.lastName ? gk.lastName + " " : "") + "(copia)";
      g.createdAt = now;
      g.updatedAt = now;
    }
    await storage.putGoalkeeper(g);
    const idx = this.goalkeepers.findIndex(x => x.id === g.id);
    if (idx >= 0) this.goalkeepers[idx] = g; else this.goalkeepers.push(g);
    this.toast(asCopy ? "Portiere importato come copia." : "Portiere importato.");
    this.setRoute("gk-dettaglio", g.id);
  }

  // ---------- Picker "Portieri coinvolti" del composer seduta ----------
  _renderSessionGkSelect() {
    const sel = this.main.querySelector("#s-gk-select");
    if (!sel) return;
    const chosen = new Set(this.composer.goalkeeperIds || []);
    const available = this.goalkeepers.filter(g => !chosen.has(g.id));
    if (!this.goalkeepers.length) {
      sel.innerHTML = `<option value="">— nessun portiere in anagrafica —</option>`; sel.disabled = true;
    } else if (!available.length) {
      sel.innerHTML = `<option value="">— tutti i portieri aggiunti —</option>`; sel.disabled = true;
    } else {
      sel.disabled = false;
      sel.innerHTML = `<option value="">Scegli un portiere…</option>` +
        available.map(g => `<option value="${escapeAttr(g.id)}">${escapeHtml(this._gkFullName(g))}</option>`).join("");
    }
  }

  _renderChosenSessionGks() {
    const wrap = this.main.querySelector("#s-gk-chosen");
    if (!wrap) return;
    const ids = this.composer.goalkeeperIds || [];
    if (!ids.length) { wrap.innerHTML = `<p class="muted small">Nessun portiere associato.</p>`; return; }
    wrap.innerHTML = ids.map(id => {
      const gk = this.goalkeepers.find(g => g.id === id);
      const out = !gk;
      const label = gk ? this._gkFullName(gk) : "(portiere rimosso)";
      return `<span class="gk-chip ${out ? 'chip-out' : ''}" data-gkid="${escapeAttr(id)}">
        ${gk ? this._gkAvatarMini(gk) : ""}
        <span class="gk-chip-name">${escapeHtml(label)}</span>
        <button type="button" class="gk-chip-del" data-gkdel="${escapeAttr(id)}" title="Rimuovi">✕</button>
      </span>`;
    }).join("");
    wrap.querySelectorAll("[data-gkdel]").forEach(btn => btn.addEventListener("click", () => {
      this.composer.goalkeeperIds = (this.composer.goalkeeperIds || []).filter(x => x !== btn.dataset.gkdel);
      this._renderSessionGkSelect();
      this._renderChosenSessionGks();
    }));
  }

  // ========================================================================
  // ==============  STAGIONE (GenericEvent / SpecificEvent)  ===============
  // ========================================================================
  async _reloadGenericEvents() { this.genericEvents = await storage.getAllGenericEvents(); }
  async _reloadSpecificEvents() { this.specificEvents = await storage.getAllSpecificEvents(); }

  _seasonIsCyclic(season) { return season ? ((typeof season.isCyclic === "boolean") ? season.isCyclic : season.mode !== "free") : false; }
  _seasonBadge(season) { const c = this._seasonIsCyclic(season); return `<span class="season-badge mode-${c ? "cyclic" : "free"}">${c ? "Ciclica" : "Libera"}</span>`; }
  _seasonGE(seasonId) { return this.genericEvents.filter(g => g.seasonId === seasonId).sort((a, b) => (a.date || "").localeCompare(b.date || "")); }
  _geByDate(seasonId) { const m = new Map(); this._seasonGE(seasonId).forEach(g => { if (!m.has(g.date)) m.set(g.date, g); }); return m; }
  _geTypeLabel(type) { return DAY_TYPE_LABELS[type] || EVENT_TYPE_LABELS[type] || "Altro"; }
  _gkLabelForType(type) { return type === "training" ? "Partecipanti" : (type === "match" || type === "tournament") ? "Convocati" : "Portieri coinvolti"; }
  _gePill(ge) { return `<span class="ge-pill ge-${escapeAttr(ge.eventType)}">${escapeHtml(this._geTypeLabel(ge.eventType))}<span class="ge-gk">👥 ${(ge.goalkeeperIds || []).length}</span></span>`; }
  // Impegno = etichetta leggera (testo colorato, senza sfondo); numero portieri se >0; simbolo discreto se modificato.
  _impLabelHtml(ge) {
    const n = (ge.goalkeeperIds || []).length;
    return `<span class="imp-label imp-${escapeAttr(ge.eventType)}" data-implabel="${escapeAttr(ge.date)}" title="Modifica impegno">● ${escapeHtml(this._geTypeLabel(ge.eventType))}${n > 0 ? ` [${n}]` : ""}${ge.isOverride ? '<span class="imp-mod" title="Modificato">E</span>' : ""}</span>`;
  }
  // Elementi collegati in cella: ordinati per orario (chi non ce l'ha va in coda, mantenendo
  // Eventi prima di Sedute a parità/assenza di orario). limit opzionale con "+N".
  _impLinkedHtml(ge, limit) {
    const items = [...(ge.linkedItems || [])].sort((a, b) => {
      const ta = a.time || "", tb = b.time || "";
      if (!!ta !== !!tb) return ta ? -1 : 1;   // chi ha orario viene prima di chi non ce l'ha
      if (ta !== tb) return ta.localeCompare(tb);
      return a.type === b.type ? 0 : (a.type === "specific_event" ? -1 : 1);
    });
    const timeBadge = (li) => li.time ? `<span class="imp-time">${escapeHtml(li.time)}</span>` : "";
    const out = [];
    items.filter(li => li.type === "specific_event").forEach(li => {
      const se = this.specificEvents.find(x => x.id === li.id);
      out.push(`<button type="button" class="imp-event etype-${escapeAttr(se ? se.eventType : "other")}" data-openevent="${escapeAttr(li.id)}">${timeBadge(li)}${escapeHtml(se ? se.title : "(evento rimosso)")}</button>`);
    });
    items.filter(li => li.type === "session").forEach(li => {
      const s = this.sessions.find(x => x.id === li.id);
      out.push(`<button type="button" class="imp-session" data-opensession="${escapeAttr(li.id)}">${timeBadge(li)}${escapeHtml(s ? s.title : "(seduta rimossa)")}</button>`);
    });
    let extra = 0;
    let list = out;
    if (limit && out.length > limit) { extra = out.length - limit; list = out.slice(0, limit); }
    return list.join("") + (extra ? `<span class="imp-more">+${extra} altri</span>` : "");
  }
  // Wiring click su Etichetta impegno (apre modifica impegno), Evento (apre editor) e Seduta (naviga), con stopPropagation.
  _wireImpLinks(scope, season) {
    scope.querySelectorAll("[data-implabel]").forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const ge = this._geByDate(season.id).get(el.dataset.implabel);
      if (ge) this._openDayView(season, el.dataset.implabel);
    }));
    scope.querySelectorAll("[data-openevent]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("event-edit", b.dataset.openevent); }));
    scope.querySelectorAll("[data-opensession]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("sedute"); }));
  }
  _geLinkedLines(ge) {
    return (ge.linkedItems || []).map(li => {
      let t = "(rimosso)";
      if (li.type === "session") { const s = this.sessions.find(x => x.id === li.id); t = s ? s.title : "(seduta rimossa)"; }
      else { const se = this.specificEvents.find(x => x.id === li.id); t = se ? se.title : "(evento rimosso)"; }
      return `<div class="ge-li">${escapeHtml(t)}</div>`;
    }).join("");
  }
  _fmtDayShort(date) { if (!(date instanceof Date) || isNaN(date.getTime())) return ""; return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`; }
  _fmtDayLong(date) { if (!(date instanceof Date) || isNaN(date.getTime())) return ""; return `${DAY_LABELS_SHORT[isoWeekday(date)]} ${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth() + 1]} ${date.getFullYear()}`; }
  _weekRangeLabel(weekStartISO) { const mon = parseDateISO(weekStartISO); if (!mon) return ""; return `${this._fmtDayShort(mon)} – ${this._fmtDayShort(addDays(mon, 6))}`; }
  _persistSeason(season) {
    season.updatedAt = new Date().toISOString();
    return storage.putSeason(season).then(() => {
      const i = this.seasons.findIndex(s => s.id === season.id);
      if (i >= 0) this.seasons[i] = season; else this.seasons.push(season);
    });
  }

  // Picker portieri riutilizzabile (ricerca + categoria + stato attivo, avatar 20px, tag selezionabili).
  // Ritorna { getIds() }. Rerender solo dei risultati per non perdere il focus in ricerca.
  _mountGkPicker(mountEl, initialIds, opts = {}) {
    const self = this;
    const state = { q: "", category: "", status: opts.defaultStatus || "all", selected: new Set((initialIds || []).filter(Boolean)) };
    const cats = [...new Set(this.goalkeepers.map(g => g.category).filter(Boolean))].sort();
    const catOpts = `<option value="">Tutte le categorie</option>` + cats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
    mountEl.innerHTML = `
      <div class="gkp">
        <div class="gkp-selected"></div>
        <div class="gkp-filters">
          <input type="search" class="input gkp-q" placeholder="Cerca nome…">
          <select class="input gkp-cat">${catOpts}</select>
          <div class="seg gkp-status">
            <button type="button" class="seg-btn is-on" data-st="all">Tutti</button>
            <button type="button" class="seg-btn" data-st="active">Attivi</button>
            <button type="button" class="seg-btn" data-st="inactive">Non att.</button>
          </div>
        </div>
        <div class="gkp-results"></div>
      </div>`;
    const selWrap = mountEl.querySelector(".gkp-selected");
    const resWrap = mountEl.querySelector(".gkp-results");
    function filtered() {
      const q = state.q.trim().toLowerCase();
      return self.goalkeepers.filter(g => {
        if (state.status === "active" && !g.active) return false;
        if (state.status === "inactive" && g.active) return false;
        if (state.category && g.category !== state.category) return false;
        if (q && !self._gkFullName(g).toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => self._gkFullName(a).localeCompare(self._gkFullName(b)));
    }
    function renderSelected() {
      const ids = [...state.selected];
      selWrap.innerHTML = ids.length
        ? ids.map(id => { const g = self.goalkeepers.find(x => x.id === id); return `<span class="gk-chip">${g ? self._gkAvatarMini(g) : ""}<span class="gk-chip-name">${escapeHtml(g ? self._gkFullName(g) : "(rimosso)")}</span><button type="button" class="gk-chip-del" data-unsel="${escapeAttr(id)}" title="Rimuovi">✕</button></span>`; }).join("")
        : `<span class="muted small">Nessun portiere selezionato.</span>`;
      selWrap.querySelectorAll("[data-unsel]").forEach(b => b.addEventListener("click", () => { state.selected.delete(b.dataset.unsel); renderSelected(); renderResults(); }));
    }
    function renderResults() {
      const list = filtered();
      resWrap.innerHTML = list.length
        ? list.map(g => `<button type="button" class="gkp-row ${state.selected.has(g.id) ? "is-sel" : ""}" data-tog="${escapeAttr(g.id)}">${self._gkAvatarMini(g)}<span class="gkp-row-name">${escapeHtml(self._gkFullName(g))}</span>${g.active ? "" : '<span class="gkp-inactive">non att.</span>'}${state.selected.has(g.id) ? '<span class="gkp-check">✓</span>' : ""}</button>`).join("")
        : `<p class="muted small">Nessun portiere trovato.</p>`;
      resWrap.querySelectorAll("[data-tog]").forEach(b => b.addEventListener("click", () => { const id = b.dataset.tog; if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); renderSelected(); renderResults(); }));
    }
    mountEl.querySelector(".gkp-q").addEventListener("input", (e) => { state.q = e.target.value; renderResults(); });
    mountEl.querySelector(".gkp-cat").addEventListener("change", (e) => { state.category = e.target.value; renderResults(); });
    mountEl.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => { state.status = b.dataset.st; mountEl.querySelectorAll("[data-st]").forEach(x => x.classList.toggle("is-on", x === b)); renderResults(); }));
    renderSelected(); renderResults();
    return { getIds: () => [...state.selected] };
  }

  // ---------- Shell: tab Stagioni / Eventi ----------
  renderStagione() {
    this._destroyPickers();
    const tab = this.stagioneTab === "specifics" ? "specifics" : "seasons";
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head">
          <div><h2>Stagione</h2><p class="muted">Pianificazione dell'anno sportivo</p></div>
          <div class="head-actions">
            ${tab === "seasons"
              ? `<button type="button" class="btn btn-soft" id="se-import">Importa stagione</button><button type="button" class="btn btn-primary" id="se-new">＋ Nuova stagione</button>`
              : `<button type="button" class="btn btn-soft" id="sp-import">Importa evento</button><button type="button" class="btn btn-primary" id="sp-new">＋ Nuovo evento</button>`}
          </div>
        </div>
        <div class="seg stagione-tabs">
          <button type="button" class="seg-btn ${tab === 'seasons' ? 'is-on' : ''}" data-stab="seasons">Stagioni</button>
          <button type="button" class="seg-btn ${tab === 'specifics' ? 'is-on' : ''}" data-stab="specifics">Eventi</button>
        </div>
        <div id="stagione-body"></div>
      </section>`;
    this.main.querySelectorAll("[data-stab]").forEach(b => b.addEventListener("click", () => { this.stagioneTab = b.dataset.stab; this.renderStagione(); }));
    if (tab === "seasons") {
      this.main.querySelector("#se-new").addEventListener("click", () => this.setRoute("season-edit", null));
      this.main.querySelector("#se-import").addEventListener("click", () => this._promptImportSeason());
      this._renderSeasonsList();
    } else {
      this.main.querySelector("#sp-new").addEventListener("click", () => this.setRoute("event-edit", null));
      this.main.querySelector("#sp-import").addEventListener("click", () => this._promptImportSpecific());
      this._renderSpecificList();
    }
  }

  // ---------- Lista stagioni ----------
  _renderSeasonsList() {
    const body = this.main.querySelector("#stagione-body");
    const seasons = [...this.seasons].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    body.innerHTML = `<div class="card-grid" id="season-grid">${seasons.length ? seasons.map(s => this._seasonCard(s)).join("") : this._empty("Nessuna stagione. Crea la prima per pianificare l'anno.")}</div>`;
    this._wireSeasonCards();
  }
  _seasonCard(s) {
    const planned = this._seasonGE(s.id).length;
    return `
      <article class="season-card" data-sid="${escapeAttr(s.id)}" tabindex="0">
        <div class="season-card-top">
          <div class="season-overlay">
            <button type="button" class="ex-ov-btn" data-se-edit="${escapeAttr(s.id)}" title="Modifica stagione" aria-label="Modifica stagione">${ICO_EDIT}</button>
            <button type="button" class="ex-ov-btn" data-se-export="${escapeAttr(s.id)}" title="Esporta" aria-label="Esporta">${ICO_EXPORT}</button>
            <button type="button" class="ex-ov-btn" data-se-del="${escapeAttr(s.id)}" title="Elimina" aria-label="Elimina">${ICO_DEL}</button>
          </div>
          ${this._seasonBadge(s)}
          <h3 class="season-card-title">${escapeHtml(s.title || "Stagione senza titolo")}</h3>
          <p class="season-card-dates">${this._fmtDate(s.startDate) || "—"} → ${this._fmtDate(s.endDate) || "—"}</p>
        </div>
        <div class="season-card-foot"><span>${planned} impegni pianificati</span></div>
      </article>`;
  }
  _wireSeasonCards() {
    this.main.querySelectorAll(".season-card").forEach(card => {
      card.addEventListener("click", (e) => { if (e.target.closest(".ex-ov-btn")) return; this._openSeason(card.dataset.sid); });
      card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); this._openSeason(card.dataset.sid); } });
    });
    this.main.querySelectorAll("[data-se-edit]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("season-edit", el.dataset.seEdit); }));
    this.main.querySelectorAll("[data-se-del]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); this._deleteSeason(el.dataset.seDel); }));
    this.main.querySelectorAll("[data-se-export]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); const s = this.seasons.find(x => x.id === el.dataset.seExport); if (s) this._exportSeason(s); }));
  }
  _openSeason(id) { this.seasonView = { id, calView: "month", weekStart: null, calMonth: null, actFrom: "", actTo: "" }; this.setRoute("season-cal", id); }
  async _deleteSeason(id) {
    const s = this.seasons.find(x => x.id === id);
    if (!s) return;
    if (!confirm(`Eliminare la stagione "${s.title || "senza titolo"}"? Verranno rimossi anche i suoi impegni pianificati.`)) return;
    for (const g of this._seasonGE(id)) await storage.deleteGenericEvent(g.id);
    await storage.deleteSeason(id);
    this.seasons = this.seasons.filter(x => x.id !== id);
    await this._reloadGenericEvents();
    this.toast("Stagione eliminata.");
    if (this.route === "season-cal") { this.stagioneTab = "seasons"; this.setRoute("stagione"); }
    else this._renderSeasonsList();
  }
  _exportSeason(s) {
    const ge = this._seasonGE(s.id);
    const specIds = new Set();
    ge.forEach(g => (g.linkedItems || []).forEach(li => { if (li.type === "specific_event") specIds.add(li.id); }));
    const specs = [...specIds].map(id => this.specificEvents.find(x => x.id === id)).filter(Boolean);
    const json = JSON.stringify(buildSingleSeasonExport(s, [...ge, ...specs]), null, 2);
    triggerDownload(`stagione_${slugFile(s.title || "stagione")}.json`, json);
  }
  _promptImportSeason() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0]; if (!file) return;
      try {
        const res = parseSingleSeasonImport(await readFileAsText(file));
        if (!res.ok) { this.toast(res.error, "error"); return; }
        await this._importSeasonResolved(res.season, res.genericEvents || [], res.specificEvents || []);
      } catch (err) { this.toast("Import non riuscito: " + (err.message || "errore"), "error"); }
    });
    input.click();
  }
  async _importSeasonResolved(season, ge, spec) {
    const exists = this.seasons.some(s => s.id === season.id);
    if (!exists) { await this._storeImportedSeason(season, ge, spec, false); return; }
    const { close } = this._openModal(`
      <h3>Stagione già presente</h3>
      <p class="muted small">Esiste già una stagione con lo stesso identificativo ("${escapeHtml(season.title || "senza titolo")}"). Come procedere?</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-soft" data-mcopy>Salva come copia</button>
        <button type="button" class="btn btn-primary" data-moverwrite>Sovrascrivi</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mcopy]": async () => { close(); await this._storeImportedSeason(season, ge, spec, true); },
      "[data-moverwrite]": async () => { close(); await this._storeImportedSeason(season, ge, spec, false); }
    });
  }
  async _storeImportedSeason(season, ge, spec, asCopy) {
    const now = new Date().toISOString();
    let s = { ...season };
    if (asCopy) { s.id = genId(); s.title = (season.title || "Stagione") + " — copia"; s.createdAt = now; s.updatedAt = now; }
    await storage.putSeason(s);
    for (const se of (spec || [])) await storage.saveSpecificEvent(se);
    for (const g of (ge || [])) { const gg = { ...g, seasonId: s.id }; if (asCopy) gg.id = genId(); await storage.saveGenericEvent(gg); }
    await this._reloadGenericEvents();
    await this._reloadSpecificEvents();
    const i = this.seasons.findIndex(x => x.id === s.id);
    if (i >= 0) this.seasons[i] = s; else this.seasons.push(s);
    this.toast(asCopy ? "Stagione importata come copia." : "Stagione importata.");
    this._openSeason(s.id);
  }

  // ---------- Editor stagione: metadati + template ----------
  renderSeasonEditor(id) {
    this._destroyPickers();
    const editing = id ? this.seasons.find(s => s.id === id) : null;
    const cyclic = editing ? this._seasonIsCyclic(editing) : false;
    const tpl = {};
    for (let d = 1; d <= 7; d++) tpl[d] = { active: false, eventType: "training", ids: [] };
    if (editing && editing.cyclicTemplate && Array.isArray(editing.cyclicTemplate.days)) {
      editing.cyclicTemplate.days.forEach(dd => { const d = Number(dd.dayOfWeek); if (d >= 1 && d <= 7) tpl[d] = { active: !!dd.active, eventType: dd.eventType || "training", ids: Array.isArray(dd.defaultGoalkeeperIds) ? [...dd.defaultGoalkeeperIds] : [] }; });
    } else if (editing && editing.cyclicTemplate && Array.isArray(editing.cyclicTemplate.weekPattern)) {
      editing.cyclicTemplate.weekPattern.forEach(p => { const d = Number(p.dayOfWeek); if (d >= 1 && d <= 7) tpl[d] = { active: true, eventType: p.dayType || "training", ids: [] }; });
    }
    this.seasonForm = { id: editing ? editing.id : null, tpl };
    const typeSel = (sel) => DAY_TYPES.map(t => `<option value="${t.key}" ${sel === t.key ? "selected" : ""}>${t.label}</option>`).join("");
    const dayRow = (d) => `
      <div class="se-day-row">
        <label class="se-day-toggle"><input type="checkbox" class="se-day-on" data-d="${d}" ${tpl[d].active ? "checked" : ""}> <span>${DAY_LABELS[d]}</span></label>
        <div class="se-day-fields" data-dayfields="${d}" ${tpl[d].active ? "" : "hidden"}>
          <label class="se-day-sub">Tipo giorno<select class="input se-day-type" data-d="${d}">${typeSel(tpl[d].eventType)}</select></label>
          <div class="se-day-gk"><span class="field-label">Portieri di default</span><div class="se-day-gk-mount" data-daygk="${d}"></div></div>
        </div>
      </div>`;
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><h2>${editing ? "Modifica stagione" : "Nuova stagione"}</h2></div>
          <div class="head-actions"><button type="button" class="btn" id="se-back">← Indietro</button></div></div>
        <div class="card-soft se-form">
          <div class="form-grid">
            <label class="form-wide">Titolo<input type="text" id="se-title" class="input" value="${escapeAttr(editing?.title || "")}" placeholder="Es. Stagione 2026/2027"></label>
            <label>Data inizio<input type="date" id="se-start" class="input" value="${escapeAttr(editing?.startDate || "")}"></label>
            <label>Data fine<input type="date" id="se-end" class="input" value="${escapeAttr(editing?.endDate || "")}"></label>
            <label class="switch-row form-wide"><input type="checkbox" id="se-cyclic" ${cyclic ? "checked" : ""}> <span>Rendi ciclica? <span class="muted">(mostra il template del microciclo)</span></span></label>
          </div>
          <div class="se-template" id="se-template" ${cyclic ? "" : "hidden"}>
            <h3 class="section-h">Template microciclo</h3>
            <p class="muted small">Per ogni giorno attivo scegli il tipo e i portieri di default. "Genera settimane" crea gli impegni dall'inizio alla fine, propagando i portieri di default del giorno.</p>
            <div class="se-days">${[1, 2, 3, 4, 5, 6, 7].map(dayRow).join("")}</div>
            <div class="se-gen"><button type="button" class="btn btn-soft" id="se-generate">Genera settimane</button></div>
          </div>
          <div class="form-actions"><button type="button" class="btn" id="se-cancel">Annulla</button><button type="button" class="btn btn-primary" id="se-save">${editing ? "Salva modifiche" : "Crea stagione"}</button></div>
        </div>
      </section>`;
    this._tplPickers = {};
    const mountDay = (d) => { const el = this.main.querySelector(`[data-daygk="${d}"]`); if (el) this._tplPickers[d] = this._mountGkPicker(el, this.seasonForm.tpl[d].ids, {}); };
    for (let d = 1; d <= 7; d++) if (tpl[d].active) mountDay(d);
    const cyc = this.main.querySelector("#se-cyclic");
    cyc.addEventListener("change", () => { this.main.querySelector("#se-template").hidden = !cyc.checked; });
    this.main.querySelectorAll(".se-day-on").forEach(cb => cb.addEventListener("change", () => {
      const d = Number(cb.dataset.d); const f = this.main.querySelector(`[data-dayfields="${d}"]`);
      if (cb.checked) { f.hidden = false; if (!this._tplPickers[d]) mountDay(d); }
      else { if (this._tplPickers[d]) { this.seasonForm.tpl[d].ids = this._tplPickers[d].getIds(); this._tplPickers[d] = null; } f.hidden = true; }
    }));
    const goList = () => { this.stagioneTab = "seasons"; this.setRoute("stagione"); };
    this.main.querySelector("#se-back").addEventListener("click", goList);
    this.main.querySelector("#se-cancel").addEventListener("click", goList);
    this.main.querySelector("#se-save").addEventListener("click", async () => { const s = await this._saveSeasonMeta(); if (s) this._openSeason(s.id); });
    this.main.querySelector("#se-generate").addEventListener("click", async () => { const s = await this._saveSeasonMeta(); if (s) await this._generateSeasonEvents(s); });
  }

  _readSeasonMetaOrToast(requireDates) {
    const q = (s) => this.main.querySelector(s);
    const title = (q("#se-title").value || "").trim();
    if (!title) { this.toast("Dai un titolo alla stagione.", "error"); return null; }
    const startDate = q("#se-start").value || null, endDate = q("#se-end").value || null;
    if (requireDates && (!startDate || !endDate)) { this.toast("Imposta data inizio e fine.", "error"); return null; }
    if (startDate && endDate && endDate < startDate) { this.toast("La data fine deve essere ≥ inizio.", "error"); return null; }
    const cyclic = !!q("#se-cyclic").checked;
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const on = this.main.querySelector(`.se-day-on[data-d="${d}"]`);
      const active = cyclic && on && on.checked;
      const typeEl = this.main.querySelector(`.se-day-type[data-d="${d}"]`);
      const eventType = typeEl ? typeEl.value : "training";
      let ids = this.seasonForm.tpl[d].ids;
      if (this._tplPickers && this._tplPickers[d]) ids = this._tplPickers[d].getIds();
      days.push({ dayOfWeek: d, active: !!active, eventType, defaultGoalkeeperIds: active ? [...ids] : [] });
    }
    const existing = this.seasonForm.id ? this.seasons.find(s => s.id === this.seasonForm.id) : null;
    const now = new Date().toISOString();
    const season = {
      type: "season", id: existing ? existing.id : genId(),
      createdAt: existing ? existing.createdAt : now, updatedAt: now,
      title, startDate, endDate,
      isCyclic: cyclic, mode: cyclic ? "cyclic" : "free",
      cyclicTemplate: cyclic ? { days } : null,
      weeks: existing ? (existing.weeks || []) : []
    };
    return { season, existing };
  }
  async _saveSeasonMeta() {
    const built = this._readSeasonMetaOrToast(false);
    if (!built) return null;
    await this._persistSeason(built.season);
    this.toast(built.existing ? "Stagione aggiornata." : "Stagione creata.");
    return built.season;
  }

  // ---------- Genera settimane: crea/aggiorna i GenericEvent dal template ----------
  async _generateSeasonEvents(season) {
    if (!season.startDate || !season.endDate) { this.toast("Imposta data inizio e fine.", "error"); return; }
    const start = parseDateISO(season.startDate), end = parseDateISO(season.endDate);
    if (!start || !end || end < start) { this.toast("Date non valide (fine ≥ inizio).", "error"); return; }
    const byDow = new Map();
    (season.cyclicTemplate && Array.isArray(season.cyclicTemplate.days) ? season.cyclicTemplate.days : []).forEach(d => { if (d.active) byDow.set(d.dayOfWeek, d); });
    if (!byDow.size) { this.toast("Attiva almeno un giorno nel template.", "error"); return; }

    // ---- Impegni dei giorni disattivati dal template (nel range stagione, non in override) ----
    // Livello 1: senza collegamenti → eliminazione diretta silenziosa.
    // Livello 2: con collegamenti → richiede avviso con conteggio esatto prima di procedere.
    // Livello 3 (isOverride:true): esclusi a monte, mai toccati automaticamente.
    const toRemove = this._seasonGE(season.id).filter(g => {
      if (g.isOverride) return false;
      const d = parseDateISO(g.date);
      if (!d || d < start || d > end) return false;
      return !byDow.has(isoWeekday(d));
    });
    const removeWithoutLinks = toRemove.filter(g => !((g.linkedItems || []).length));
    const removeWithLinks = toRemove.filter(g => (g.linkedItems || []).length);

    const run = async () => {
      const byDate = new Map(this._seasonGE(season.id).map(g => [g.date, g]));
      let created = 0, updated = 0;
      const now = new Date().toISOString();
      // Itera giorno per giorno da startDate a endDate INCLUSI: nessun giorno fuori range.
      for (let dt = new Date(start); dt <= end; dt = addDays(dt, 1)) {
        const d = byDow.get(isoWeekday(dt));
        if (!d) continue;
        const iso = toISODate(dt);
        const weekId = toISODate(mondayOf(dt));
        const ex = byDate.get(iso);
        if (ex) {
          if (ex.isOverride) continue;                 // modificato: mai toccato
          ex.eventType = d.eventType;
          ex.goalkeeperIds = [...(d.defaultGoalkeeperIds || [])];
          // linkedItems PRESERVATI durante la rigenerazione (non svuotare).
          ex.weekId = weekId; ex.updatedAt = now;
          await storage.saveGenericEvent(ex); updated++;
        } else {
          const ge = { type: "generic_event", id: genId(), createdAt: now, updatedAt: now, seasonId: season.id, weekId, date: iso, eventType: d.eventType, goalkeeperIds: [...(d.defaultGoalkeeperIds || [])], linkedItems: [], notes: "", isOverride: false };
          await storage.saveGenericEvent(ge); byDate.set(iso, ge); created++;
        }
      }
      await this._reloadGenericEvents();
      const removedMsg = toRemove.length ? `, rimossi ${toRemove.length}` : "";
      this.toast(`Generati ${created} impegni${updated ? `, aggiornati ${updated}` : ""}${removedMsg}.`);
      this._openSeason(season.id);
    };

    // Elimina gli impegni dei giorni disattivati (livello 1 + livello 2 insieme) e poi genera/aggiorna.
    const removeThenRun = async () => {
      for (const g of removeWithoutLinks) await storage.deleteGenericEvent(g.id);
      for (const g of removeWithLinks) await storage.deleteGenericEvent(g.id);
      if (toRemove.length) await this._reloadGenericEvents();
      await run();
    };

    // Applica la logica a tre livelli sui giorni disattivati, poi prosegue con la generazione.
    const startRegeneration = async () => {
      if (!toRemove.length) { await run(); return; }
      if (!removeWithLinks.length) {
        // Solo impegni senza collegamenti: eliminazione diretta, silenziosa, nessuna conferma.
        await removeThenRun();
        return;
      }
      // Almeno un impegno con collegamenti: avviso con conteggio esatto prima di procedere.
      const dows = [...new Set(toRemove.map(g => isoWeekday(parseDateISO(g.date))))].sort((a, b) => a - b);
      const dayNames = dows.map(d => DAY_LABELS[d]).join(", ");
      const { close } = this._openModal(`
        <h3>Rimuovere gli impegni dei giorni disattivati?</h3>
        <p class="muted small">La rimozione del${dows.length > 1 ? "i giorni" : " giorno"} ${escapeHtml(dayNames)} dal template interessa ${toRemove.length} impegni futuri. ${removeWithLinks.length} di questi hanno sedute o eventi collegati che verranno persi. Continuare?</p>
        <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla rigenerazione</button><button type="button" class="btn btn-ghost danger" data-mok>Elimina comunque</button></div>`);
      this._wireModalButtons({ "[data-mcancel]": () => close(), "[data-mok]": async () => { close(); await removeThenRun(); } });
    };

    if (this._seasonGE(season.id).length > 0) {
      const { close } = this._openModal(`
        <h3>Rigenerare gli impegni?</h3>
        <p class="muted small">Rigenerare aggiornerà gli impegni non modificati (tipo e portieri dal template), conservando le sedute/eventi collegati. Gli impegni modificati non vengono toccati. Continuare?</p>
        <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla</button><button type="button" class="btn btn-primary" data-mok>Rigenera</button></div>`);
      this._wireModalButtons({ "[data-mcancel]": () => close(), "[data-mok]": async () => { close(); await startRegeneration(); } });
    } else await startRegeneration();
  }

  // ---------- Calendario: shell + selettore vista + modifica massiva ----------
  renderSeasonCalendar(seasonId) {
    this._destroyPickers();
    const id = seasonId || this.seasonView.id;
    const season = this.seasons.find(s => s.id === id);
    if (!season) { this.stagioneTab = "seasons"; this.setRoute("stagione"); return; }
    this.seasonView.id = season.id;
    if (!this.seasonView.calView) this.seasonView.calView = "week";
    const view = this.seasonView.calView; const segOn = (v) => view === v ? "is-on" : "";
    const count = this._seasonGE(season.id).length;
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head">
          <div><button type="button" class="btn" id="se-cal-back">← Stagioni</button></div>
          <div class="head-actions">
            <button type="button" class="btn btn-soft" id="se-mass">Modifica portieri su periodo</button>
            <button type="button" class="btn btn-soft" id="se-cal-edit">Modifica stagione</button>
            <button type="button" class="btn btn-soft" id="se-cal-export">Esporta</button>
          </div>
        </div>
        <div class="card-soft season-cal-head"><h2>${escapeHtml(season.title || "Stagione")}</h2>
          <p class="muted">${this._seasonBadge(season)} · ${this._fmtDate(season.startDate) || "—"} → ${this._fmtDate(season.endDate) || "—"} · ${count} impegni pianificati</p></div>
        <div class="seg cal-viewseg">
          <button type="button" class="seg-btn ${segOn('month')}" data-calview="month">Mese</button>
          <button type="button" class="seg-btn ${segOn('week')}" data-calview="week">Settimana</button>
          <button type="button" class="seg-btn ${segOn('activity')}" data-calview="activity">Elenco</button>
        </div>
        <div id="cal-body"></div>
      </section>`;
    this.main.querySelector("#se-cal-back").addEventListener("click", () => { this.stagioneTab = "seasons"; this.setRoute("stagione"); });
    this.main.querySelector("#se-cal-edit").addEventListener("click", () => this.setRoute("season-edit", season.id));
    this.main.querySelector("#se-cal-export").addEventListener("click", () => this._exportSeason(season));
    this.main.querySelector("#se-mass").addEventListener("click", () => this._massEditGoalkeepers(season));
    this.main.querySelectorAll("[data-calview]").forEach(b => b.addEventListener("click", () => { this.seasonView.calView = b.dataset.calview; this._refreshCalendar(); }));
    if (view === "month") this._renderCalMonth(season); else if (view === "activity") this._renderCalActivity(season); else this._renderCalWeek(season);
  }
  _refreshCalendar() { this.renderSeasonCalendar(this.seasonView.id); }

  _renderCalWeek(season) {
    const body = this.main.querySelector("#cal-body");
    if (!this.seasonView.weekStart) { const base = parseDateISO(season.startDate) || new Date(); this.seasonView.weekStart = toISODate(mondayOf(base)); }
    const mon = parseDateISO(this.seasonView.weekStart);
    const byDate = this._geByDate(season.id);
    const cells = [];
    for (let i = 0; i < 7; i++) { const dt = addDays(mon, i); const iso = toISODate(dt); cells.push({ dt, iso, ge: byDate.get(iso) || null, dow: i + 1 }); }
    const cellHtml = (c) => `
      <div class="cal-day">
        <div class="cal-day-head"><span class="cal-day-name">${DAY_LABELS_SHORT[c.dow]} ${this._fmtDayShort(c.dt)}</span></div>
        <div class="cal-day-body" data-openday="${c.iso}">
          ${c.ge ? `<div class="imp-row">${this._impLabelHtml(c.ge)}<button type="button" class="ge-del" data-delge="${c.iso}" title="Elimina impegno">✕</button></div>${this._impLinkedHtml(c.ge)}${c.ge.notes ? `<div class="ge-note">${escapeHtml(c.ge.notes)}</div>` : ""}` : `<p class="cal-empty">—</p>`}
        </div>
        <button type="button" class="cal-day-add" data-openday="${c.iso}" title="${c.ge ? 'Collega elemento' : 'Aggiungi impegno'}">+</button>
      </div>`;
    body.innerHTML = `
      <div class="card-soft cal-nav">
        <button type="button" class="btn" id="w-prev">← Settimana</button>
        <label class="w-jump">Vai a <input type="date" class="input" id="w-jump" value="${escapeAttr(this.seasonView.weekStart)}"></label>
        <button type="button" class="btn" id="w-next">Settimana →</button>
      </div>
      <div class="card-soft"><div class="cal-week-range">${this._weekRangeLabel(this.seasonView.weekStart)}</div><div class="cal-days">${cells.map(cellHtml).join("")}</div></div>`;
    body.querySelector("#w-prev").addEventListener("click", () => { this.seasonView.weekStart = toISODate(addDays(mon, -7)); this._refreshCalendar(); });
    body.querySelector("#w-next").addEventListener("click", () => { this.seasonView.weekStart = toISODate(addDays(mon, 7)); this._refreshCalendar(); });
    body.querySelector("#w-jump").addEventListener("change", (e) => { const d = parseDateISO(e.target.value); if (d) { this.seasonView.weekStart = toISODate(mondayOf(d)); this._refreshCalendar(); } });
    this._wireDayDelete(body, season);
    this._wireImpLinks(body, season);
    body.querySelectorAll("[data-openday]").forEach(el => el.addEventListener("click", (e) => { if (e.target.closest(".ge-del, .imp-event, .imp-session, .imp-label")) return; const iso = el.dataset.openday; const ge = this._geByDate(season.id).get(iso); if (ge) this._openLinkPicker(season, ge, () => this._refreshCalendar()); else this._openDayView(season, iso); }));
  }

  // Wiring comune per la × di eliminazione impegno sulle etichette del calendario.
  _wireDayDelete(scope, season) {
    scope.querySelectorAll("[data-delge]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const g = this._geByDate(season.id).get(b.dataset.delge);
      if (g) this._deleteGenericEvent(season, g);
    }));
  }

  _renderCalMonth(season) {
    const body = this.main.querySelector("#cal-body");
    if (!this.seasonView.calMonth) { const base = parseDateISO(this.seasonView.weekStart) || parseDateISO(season.startDate) || new Date(); this.seasonView.calMonth = new Date(base.getFullYear(), base.getMonth(), 1); }
    const cm = this.seasonView.calMonth; const year = cm.getFullYear(), month = cm.getMonth();
    const byDate = this._geByDate(season.id);
    const gridStart = mondayOf(new Date(year, month, 1));
    const cells = [];
    for (let i = 0; i < 42; i++) { const dt = addDays(gridStart, i); cells.push({ dt, iso: toISODate(dt), inMonth: dt.getMonth() === month, ge: byDate.get(toISODate(dt)) || null }); }
    const cellHtml = (c) => {
      if (!c.inMonth) return `<div class="calendar-month-cell mcell out"><span class="mcell-num">${c.dt.getDate()}</span></div>`;
      let items = "";
      if (c.ge) {
        items = `<div class="imp-row">${this._impLabelHtml(c.ge)}<button type="button" class="ge-del" data-delge="${c.iso}" title="Elimina impegno">✕</button></div>${this._impLinkedHtml(c.ge, 2)}`;
      }
      return `<div class="calendar-month-cell mcell ${c.ge ? "has" : "empty"}" data-openday="${c.iso}"><span class="mcell-num">${c.dt.getDate()}</span><div class="mcell-items">${items}</div></div>`;
    };
    const dow = [1, 2, 3, 4, 5, 6, 7].map(d => `<div class="mhead">${DAY_LABELS_SHORT[d]}</div>`).join("");
    body.innerHTML = `
      <div class="card-soft cal-nav month-nav"><button type="button" class="btn" id="m-prev">←</button><span class="month-title">${MONTH_LABELS[month + 1]} ${year}</span><button type="button" class="btn" id="m-next">→</button></div>
      <div class="card-soft month-grid-wrap"><div class="calendar-month-dow">${dow}</div><div class="calendar-month-grid">${cells.map(cellHtml).join("")}</div></div>`;
    body.querySelector("#m-prev").addEventListener("click", () => { this.seasonView.calMonth = new Date(year, month - 1, 1); this._refreshCalendar(); });
    body.querySelector("#m-next").addEventListener("click", () => { this.seasonView.calMonth = new Date(year, month + 1, 1); this._refreshCalendar(); });
    // Forza la griglia rigida via stile inline (priorità massima), a prova di override.
    // Su schermi molto stretti le celle si comprimono (la vista "Elenco" resta l'alternativa
    // già disponibile per chi preferisce una lista invece della griglia 7 colonne).
    const isNarrow = window.innerWidth <= 460;
    const cellMinH = isNarrow ? "58px" : "100px";
    const wrap = body.querySelector(".month-grid-wrap");
    if (wrap) wrap.style.cssText = "width:100%;box-sizing:border-box;overflow:hidden;display:block;";
    const grid = body.querySelector(".calendar-month-grid");
    if (grid) {
      grid.style.cssText = `display:grid !important;grid-template-columns:repeat(7,1fr) !important;width:100% !important;box-sizing:border-box !important;gap:${isNarrow ? "2px" : "4px"};grid-auto-rows:minmax(${cellMinH},auto);flex:1 1 100%;min-width:0;`;
      grid.querySelectorAll(".calendar-month-cell").forEach(cell => { cell.style.cssText = `width:100% !important;min-width:0;min-height:${cellMinH};box-sizing:border-box;overflow:hidden;`; });
    }
    const dowRow = body.querySelector(".calendar-month-dow");
    if (dowRow) dowRow.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);width:100%;box-sizing:border-box;gap:4px;margin-bottom:4px;";
    this._wireDayDelete(body, season);
    this._wireImpLinks(body, season);
    body.querySelectorAll("[data-openday]").forEach(el => el.addEventListener("click", (e) => { if (e.target.closest(".ge-del, .imp-event, .imp-session, .imp-label")) return; const iso = el.dataset.openday; const ge = this._geByDate(season.id).get(iso); if (ge) this._openLinkPicker(season, ge, () => this._refreshCalendar()); else this._openDayView(season, iso); }));
  }

  _renderCalActivity(season) {
    const body = this.main.querySelector("#cal-body");
    const list = this._seasonGE(season.id).filter(g => {
      if (this.seasonView.actFrom && (g.date || "") < this.seasonView.actFrom) return false;
      if (this.seasonView.actTo && (g.date || "") > this.seasonView.actTo) return false;
      return true;
    });
    const rows = list.map(ge => { const dt = parseDateISO(ge.date); return `<div class="act-row" data-openday="${escapeAttr(ge.date)}"><div class="act-date">${escapeHtml(dt ? this._fmtDayLong(dt) : (ge.date || "—"))}</div><div class="act-pills"><div class="imp-row">${this._impLabelHtml(ge)}<button type="button" class="ge-del" data-delge="${escapeAttr(ge.date)}" title="Elimina impegno">✕</button></div>${this._impLinkedHtml(ge)}</div></div>`; }).join("");
    body.innerHTML = `
      <div class="card-soft cal-nav act-filter">
        <div class="gk-filters-row">
          ${this._dateRangeHtml("a-from", "a-to", this.seasonView.actFrom, this.seasonView.actTo)}
          <span class="filters-count">${list.length} giorni</span>
        </div>
      </div>
      ${list.length ? `<div class="card-soft act-list">${rows}</div>` : `<div class="card-soft">${this._empty("Nessun giorno con impegni nel periodo.")}</div>`}`;
    body.querySelector("#a-from").addEventListener("change", (e) => { this.seasonView.actFrom = e.target.value; this._refreshCalendar(); });
    body.querySelector("#a-to").addEventListener("change", (e) => { this.seasonView.actTo = e.target.value; this._refreshCalendar(); });
    this._wireDayDelete(body, season);
    this._wireImpLinks(body, season);
    body.querySelectorAll("[data-openday]").forEach(el => el.addEventListener("click", (e) => { if (e.target.closest(".ge-del, .imp-event, .imp-session, .imp-label")) return; const iso = el.dataset.openday; const ge = this._geByDate(season.id).get(iso); if (ge) this._openLinkPicker(season, ge, () => this._refreshCalendar()); else this._openDayView(season, iso); }));
  }

  // ---------- Pannello impegno: form (sempre) + elementi collegati (se esiste) ----------
  _openDayView(season, iso) {
    const date = parseDateISO(iso);
    const dateLabel = date ? this._fmtDayLong(date) : iso;
    const cyclic = this._seasonIsCyclic(season);
    const ge = this._seasonGE(season.id).find(g => g.date === iso) || null;
    const typeSel = (val) => DAY_TYPES.map(t => `<option value="${t.key}" ${val === t.key ? "selected" : ""}>${t.label}</option>`).join("");
    const gkLabel = this._gkLabelForType(ge ? ge.eventType : "training");
    const linkedHtml = ge ? ((ge.linkedItems || []).length ? ge.linkedItems.map(li => {
      let title = "(rimosso)", badge = "Evento", cls = "specific_event";
      if (li.type === "session") { const s = this.sessions.find(x => x.id === li.id); title = s ? s.title : "(seduta rimossa)"; badge = "Seduta"; cls = "session"; }
      else { const se = this.specificEvents.find(x => x.id === li.id); title = se ? se.title : "(evento rimosso)"; }
      return `<div class="li-row"><span class="li-badge li-${cls}">${badge}</span><span class="li-title">${escapeHtml(title)}</span><button type="button" class="li-del" data-ultype="${escapeAttr(li.type)}" data-ulid="${escapeAttr(li.id)}" title="Scollega">✕</button></div>`;
    }).join("") : `<p class="muted small">Nessun elemento collegato.</p>`) : "";
    const canRestore = ge && cyclic && ge.isOverride && this._isTemplateDay(season, ge);
    const { overlay, close } = this._openModal(`
      <h3>Impegno del ${escapeHtml(dateLabel)}</h3>
      <div class="ge-form">
        <label class="field"><span class="field-label">Tipo giorno</span><select class="input" id="dp-type">${typeSel(ge ? ge.eventType : "training")}</select></label>
        <div class="field"><span class="field-label" id="dp-gk-label">${gkLabel}</span><div id="dp-gk"></div></div>
        <label class="field"><span class="field-label">Note</span><input type="text" class="input" id="dp-notes" value="${escapeAttr(ge ? ge.notes : "")}" placeholder="Nota breve…"></label>
        <div class="dp-actions">
          ${canRestore ? `<button type="button" class="btn btn-soft" id="dp-restore">Ripristina template</button>` : ""}
          ${ge ? `<button type="button" class="btn btn-ghost danger" id="dp-del">Elimina impegno</button>` : ""}
          <span class="dp-spacer"></span>
          <button type="button" class="btn btn-primary" id="dp-save">Salva impegno</button>
        </div>
      </div>
      ${ge
        ? `<section class="dp-sec"><h4 class="dp-h">Elementi collegati</h4><div class="li-list">${linkedHtml}</div><button type="button" class="btn btn-soft" id="dp-link">+ Collega elemento</button></section>`
        : `<p class="muted small dp-hint">Salva l'impegno per collegare sedute o eventi.</p>`}
      <div class="modal-actions"><button type="button" class="btn" data-mcancel>Chiudi</button></div>`);
    const picker = this._mountGkPicker(overlay.querySelector("#dp-gk"), ge ? ge.goalkeeperIds : [], {});
    const typeEl = overlay.querySelector("#dp-type");
    typeEl.addEventListener("change", () => { const l = overlay.querySelector("#dp-gk-label"); if (l) l.textContent = this._gkLabelForType(typeEl.value); });
    overlay.querySelector("[data-mcancel]").addEventListener("click", () => close());
    const reopen = () => { this._refreshCalendar(); close(); this._openDayView(season, iso); };
    const save = async () => {
      const now = new Date().toISOString();
      let target = ge;
      if (!target) {
        target = { type: "generic_event", id: genId(), createdAt: now, updatedAt: now, seasonId: season.id, weekId: toISODate(mondayOf(date)), date: iso, eventType: typeEl.value, goalkeeperIds: picker.getIds(), linkedItems: [], notes: (overlay.querySelector("#dp-notes").value || "").trim(), isOverride: false };
      } else {
        target.eventType = typeEl.value; target.goalkeeperIds = picker.getIds(); target.notes = (overlay.querySelector("#dp-notes").value || "").trim(); target.updatedAt = now;
      }
      if (cyclic) target.isOverride = true; // stagione ciclica: la modifica marca l'impegno come "Modificato"
      await storage.saveGenericEvent(target);
      await this._reloadGenericEvents();
    };
    overlay.querySelector("#dp-save").addEventListener("click", async () => { await save(); this.toast("Impegno salvato."); reopen(); });
    const rs = overlay.querySelector("#dp-restore");
    if (rs) rs.addEventListener("click", () => this._restoreGeTemplate(season, ge, reopen));
    const del = overlay.querySelector("#dp-del");
    if (del) del.addEventListener("click", () => this._deleteGenericEvent(season, ge, () => { close(); this._refreshCalendar(); }));
    const link = overlay.querySelector("#dp-link");
    if (link) link.addEventListener("click", () => this._openLinkPicker(season, ge, reopen));
    overlay.querySelectorAll("[data-ultype]").forEach(b => b.addEventListener("click", async () => {
      ge.linkedItems = (ge.linkedItems || []).filter(li => !(li.type === b.dataset.ultype && li.id === b.dataset.ulid));
      ge.updatedAt = new Date().toISOString();
      await storage.saveGenericEvent(ge); await this._reloadGenericEvents(); reopen();
    }));
  }

  _isTemplateDay(season, ge) {
    if (!this._seasonIsCyclic(season)) return false;
    const d = parseDateISO(ge.date); if (!d) return false;
    const dow = isoWeekday(d);
    const days = (season.cyclicTemplate && season.cyclicTemplate.days) || [];
    return days.some(x => x.dayOfWeek === dow && x.active);
  }

  // Eliminazione impegno: singola, oppure "questo e i successivi dello stesso giorno" (stagioni cicliche a pattern).
  _deleteGenericEvent(season, ge, onDone) {
    const done = () => { if (onDone) onDone(); else this._refreshCalendar(); };
    const finish = async (future) => {
      if (future) {
        const dow = isoWeekday(parseDateISO(ge.date));
        const victims = this._seasonGE(season.id).filter(g => { const d = parseDateISO(g.date); return d && isoWeekday(d) === dow && (g.date || "") >= ge.date; });
        for (const v of victims) await storage.deleteGenericEvent(v.id);
        await this._reloadGenericEvents();
        this.toast(`Eliminati ${victims.length} impegni.`);
      } else {
        await storage.deleteGenericEvent(ge.id);
        await this._reloadGenericEvents();
        this.toast("Impegno eliminato.");
      }
      done();
    };
    if (this._isTemplateDay(season, ge)) {
      const { close } = this._openModal(`
        <h3>Eliminare l'impegno?</h3>
        <p class="muted small">Questo impegno fa parte di un ciclo. Cosa vuoi eliminare?</p>
        <div class="modal-actions modal-actions-col">
          <button type="button" class="btn btn-soft" data-one>Elimina solo questo impegno</button>
          <button type="button" class="btn btn-ghost danger" data-future>Elimina questo e tutti i successivi dello stesso giorno</button>
          <button type="button" class="btn" data-mcancel>Annulla</button>
        </div>`);
      this._wireModalButtons({
        "[data-mcancel]": () => close(),
        "[data-one]": async () => { close(); await finish(false); },
        "[data-future]": async () => { close(); await finish(true); }
      });
    } else {
      if (!confirm("Eliminare questo impegno?")) return;
      finish(false);
    }
  }

  _restoreGeTemplate(season, ge, reopen) {
    const { close } = this._openModal(`
      <h3>Ripristinare il template?</h3>
      <p class="muted small">Il giorno tornerà allo stato del template, perdendo le modifiche manuali. Continuare?</p>
      <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla</button><button type="button" class="btn btn-primary" data-mok>Ripristina</button></div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mok]": async () => {
        close();
        const dow = isoWeekday(parseDateISO(ge.date));
        const days = (season.cyclicTemplate && season.cyclicTemplate.days) || [];
        const td = days.find(d => d.dayOfWeek === dow && d.active);
        if (td) {
          ge.eventType = td.eventType; ge.goalkeeperIds = [...(td.defaultGoalkeeperIds || [])]; ge.linkedItems = []; ge.notes = ""; ge.isOverride = false; ge.updatedAt = new Date().toISOString();
          await storage.saveGenericEvent(ge);
        } else {
          await storage.deleteGenericEvent(ge.id);
        }
        await this._reloadGenericEvents();
        this.toast("Template ripristinato.");
        reopen();
      }
    });
  }

  // Picker "Collega elemento": tab Sedute / Eventi. Ogni tab carica SOLO dal proprio store.
  _openLinkPicker(season, ge, reopenDay) {
    const { overlay, close } = this._openModal(`
      <h3>Collega elemento</h3>
      <div class="seg lk-tabs">
        <button type="button" class="seg-btn is-on" data-lktab="sessions">Sedute</button>
        <button type="button" class="seg-btn" data-lktab="events">Eventi</button>
      </div>
      <label class="field lk-time-field"><span class="field-label">Orario (opzionale, utile con più sedute/eventi lo stesso giorno)</span><input type="time" class="input" id="lk-time"></label>
      <input type="search" class="input lk-q" id="lk-q" placeholder="Cerca…">
      <div class="lk-results" id="lk-results"></div>
      <div class="lk-foot"><button type="button" class="btn btn-soft" id="lk-create"></button></div>
      <div class="modal-actions"><button type="button" class="btn" data-mcancel>Chiudi</button></div>`);
    const resEl = overlay.querySelector("#lk-results");
    const qEl = overlay.querySelector("#lk-q");
    const timeEl = overlay.querySelector("#lk-time");
    const createBtn = overlay.querySelector("#lk-create");
    let tab = "sessions";
    let items = [];   // dati del tab corrente, caricati dal solo store pertinente

    const addLink = async (type, id) => {
      ge.linkedItems = ge.linkedItems || [];
      const time = (timeEl.value || "").trim();
      if (!ge.linkedItems.some(li => li.type === type && li.id === id)) ge.linkedItems.push({ type, id, time });
      ge.updatedAt = new Date().toISOString();
      await storage.saveGenericEvent(ge); await this._reloadGenericEvents();
      close(); reopenDay();
    };
    const renderResults = () => {
      const q = (qEl.value || "").trim().toLowerCase();
      if (tab === "sessions") {
        const list = items.filter(s => !q || (s.title || "").toLowerCase().includes(q)).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        resEl.innerHTML = list.length
          ? list.map(s => `<button type="button" class="lk-row" data-lk="${escapeAttr(s.id)}"><span class="lk-row-title">${escapeHtml(s.title)}</span><span class="lk-row-meta">${formatDuration(s.aggregated?.totalDurationSeconds || 0)}</span></button>`).join("")
          : `<p class="muted small lk-empty">Nessuna seduta trovata.</p>`;
        resEl.querySelectorAll("[data-lk]").forEach(b => b.addEventListener("click", () => addLink("session", b.dataset.lk)));
      } else {
        const list = items.filter(se => !q || (se.title || "").toLowerCase().includes(q)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        resEl.innerHTML = list.length
          ? list.map(se => `<button type="button" class="lk-row" data-lk="${escapeAttr(se.id)}"><span class="li-badge li-specific_event">${escapeHtml(this._geTypeLabel(se.eventType))}</span><span class="lk-row-title">${escapeHtml(se.title)}</span><span class="lk-row-meta">${se.date ? this._fmtDate(se.date) : ""}</span></button>`).join("")
          : `<p class="muted small lk-empty">Nessun evento trovato.</p>`;
        resEl.querySelectorAll("[data-lk]").forEach(b => b.addEventListener("click", () => addLink("specific_event", b.dataset.lk)));
      }
    };
    // Cambio tab: azzera la lista e ricarica SOLO dallo store corretto via storage.js.
    const loadTab = async (which) => {
      tab = which;
      items = [];
      resEl.innerHTML = `<p class="muted small lk-empty">Caricamento…</p>`;
      qEl.placeholder = which === "sessions" ? "Cerca seduta…" : "Cerca evento…";
      createBtn.textContent = which === "sessions" ? "Crea nuova seduta" : "Crea nuovo evento";
      items = which === "sessions" ? await storage.getAllSessions() : await storage.getAllSpecificEvents();
      renderResults();
    };
    overlay.querySelector("[data-mcancel]").addEventListener("click", () => close());
    overlay.querySelectorAll("[data-lktab]").forEach(b => b.addEventListener("click", () => {
      overlay.querySelectorAll("[data-lktab]").forEach(x => x.classList.toggle("is-on", x === b));
      qEl.value = "";
      loadTab(b.dataset.lktab);
    }));
    qEl.addEventListener("input", renderResults);
    createBtn.addEventListener("click", () => { close(); this.setRoute(tab === "sessions" ? "sedute" : "event-edit", tab === "sessions" ? undefined : null); });
    loadTab("sessions");
  }

  // ---------- Modifica massiva portieri su periodo ----------
  _massEditGoalkeepers(season) {
    const typeSel = `<option value="">Tutti i tipi</option>` + DAY_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join("");
    const { overlay, close } = this._openModal(`
      <h3>Modifica portieri su periodo</h3>
      <div class="form-grid">
        <label>Dal<input type="date" class="input" id="me-from"></label>
        <label>Al<input type="date" class="input" id="me-to"></label>
        <label class="form-wide">Tipo impegno<select class="input" id="me-type">${typeSel}</select></label>
      </div>
      <div class="field"><span class="field-label">Portieri da rimuovere</span><div id="me-remove"></div></div>
      <div class="field"><span class="field-label">Portieri da aggiungere</span><div id="me-add"></div></div>
      <p class="muted small" id="me-preview"></p>
      <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla</button><button type="button" class="btn btn-soft" id="me-prev">Anteprima</button><button type="button" class="btn btn-primary" id="me-apply">Applica</button></div>`);
    const rem = this._mountGkPicker(overlay.querySelector("#me-remove"), [], {});
    const add = this._mountGkPicker(overlay.querySelector("#me-add"), [], {});
    const readRange = () => ({ from: overlay.querySelector("#me-from").value || null, to: overlay.querySelector("#me-to").value || null, type: overlay.querySelector("#me-type").value || null });
    const countAffected = () => { const { from, to, type } = readRange(); return this.genericEvents.filter(g => { if (from && (g.date || "") < from) return false; if (to && (g.date || "") > to) return false; if (type && g.eventType !== type) return false; return true; }).length; };
    overlay.querySelector("[data-mcancel]").addEventListener("click", () => close());
    overlay.querySelector("#me-prev").addEventListener("click", () => { overlay.querySelector("#me-preview").textContent = `Questa modifica interesserà ${countAffected()} impegni nel periodo selezionato.`; });
    overlay.querySelector("#me-apply").addEventListener("click", () => {
      const { from, to, type } = readRange();
      if (!from || !to) { this.toast("Imposta il periodo (dal/al).", "error"); return; }
      const addIds = add.getIds(), removeIds = rem.getIds();
      if (!addIds.length && !removeIds.length) { this.toast("Scegli almeno un portiere da aggiungere o rimuovere.", "error"); return; }
      const n = countAffected();
      const { close: cc } = this._openModal(`
        <h3>Applicare la modifica?</h3>
        <p class="muted small">Interesserà ${n} impegni dal ${this._fmtDate(from)} al ${this._fmtDate(to)}${type ? ` (tipo ${this._geTypeLabel(type)})` : ""}. Continuare?</p>
        <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla</button><button type="button" class="btn btn-primary" data-mok>Applica</button></div>`);
      this._wireModalButtons({
        "[data-mcancel]": () => cc(),
        "[data-mok]": async () => {
          cc();
          const changed = await storage.updateGenericEventsGoalkeeperIds(from, to, type, addIds, removeIds);
          await this._reloadGenericEvents();
          close();
          this.toast(`Aggiornati ${changed} impegni.`);
          this._refreshCalendar();
        }
      });
    });
  }

  // ---------- Eventi: lista, editor, export/import ----------
  _filteredSpecifics() {
    return this.specificEvents.filter(se => {
      if (this.specificFilter.type && se.eventType !== this.specificFilter.type) return false;
      if (this.specificFilter.from && (se.date || "") < this.specificFilter.from) return false;
      if (this.specificFilter.to && (se.date || "") > this.specificFilter.to) return false;
      return true;
    }).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }
  _renderSpecificList() {
    const body = this.main.querySelector("#stagione-body");
    const list = this._filteredSpecifics();
    const typeOpts = `<option value="">Tutti i tipi</option>` + ["match", "tournament", "test", "other"].map(k => `<option value="${k}" ${this.specificFilter.type === k ? "selected" : ""}>${EVENT_TYPE_LABELS[k]}</option>`).join("");
    body.innerHTML = `
      <div class="filters card-soft"><div class="gk-filters-row">
        <label class="gk-filter-field"><span class="field-label">Tipo</span><select id="sp-ftype" class="input">${typeOpts}</select></label>
        ${this._dateRangeHtml("sp-ffrom", "sp-fto", this.specificFilter.from, this.specificFilter.to)}
        <span class="filters-count">${list.length} eventi</span>
      </div></div>
      <div class="card-grid" id="spec-grid">${list.length ? list.map(se => this._specificCard(se)).join("") : this._empty(this.specificEvents.length ? "Nessun evento corrisponde ai filtri." : "Nessun evento specifico. Creane uno nuovo.")}</div>`;
    const t = this.main.querySelector("#sp-ftype"); if (t) t.addEventListener("change", () => { this.specificFilter.type = t.value; this._renderSpecificList(); });
    const f = this.main.querySelector("#sp-ffrom"); if (f) f.addEventListener("change", () => { this.specificFilter.from = f.value; this._renderSpecificList(); });
    const to = this.main.querySelector("#sp-fto"); if (to) to.addEventListener("change", () => { this.specificFilter.to = to.value; this._renderSpecificList(); });
    this._wireSpecificCards();
  }
  _specificCard(se) {
    return `
      <article class="event-card" data-eid="${escapeAttr(se.id)}" tabindex="0">
        <div class="event-card-top">
          <div class="season-overlay">
            <button type="button" class="ex-ov-btn" data-sp-edit="${escapeAttr(se.id)}" title="Modifica evento" aria-label="Modifica evento">${ICO_EDIT}</button>
            <button type="button" class="ex-ov-btn" data-sp-export="${escapeAttr(se.id)}" title="Esporta" aria-label="Esporta">${ICO_EXPORT}</button>
            <button type="button" class="ex-ov-btn" data-sp-del="${escapeAttr(se.id)}" title="Elimina" aria-label="Elimina">${ICO_DEL}</button>
          </div>
          <span class="ge-pill ge-${escapeAttr(se.eventType)}">${escapeHtml(this._geTypeLabel(se.eventType))}</span>
          <h3 class="event-card-title">${escapeHtml(se.title || "Evento senza titolo")}</h3>
          <p class="event-card-sub">${this._fmtDate(se.date) || "Senza data"}${se.opponent ? ` · ${escapeHtml(se.opponent)}` : ""}</p>
        </div>
        <div class="event-card-foot"><span>${se.location ? escapeHtml(se.location) : "—"}${se.time ? ` · ${escapeHtml(se.time)}` : ""}</span></div>
      </article>`;
  }
  _wireSpecificCards() {
    this.main.querySelectorAll(".event-card").forEach(card => {
      card.addEventListener("click", (e) => { if (e.target.closest(".ex-ov-btn")) return; this.setRoute("event-edit", card.dataset.eid); });
      card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); this.setRoute("event-edit", card.dataset.eid); } });
    });
    this.main.querySelectorAll("[data-sp-edit]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("event-edit", el.dataset.spEdit); }));
    this.main.querySelectorAll("[data-sp-del]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); this._deleteSpecific(el.dataset.spDel); }));
    this.main.querySelectorAll("[data-sp-export]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); const se = this.specificEvents.find(x => x.id === el.dataset.spExport); if (se) this._exportSpecific(se); }));
  }
  renderSpecificEditor(id) {
    this._destroyPickers();
    const editing = id ? this.specificEvents.find(e => e.id === id) : null;
    const typeOpts = ["match", "tournament", "test", "other"].map(k => `<option value="${k}" ${editing && editing.eventType === k ? "selected" : ""}>${EVENT_TYPE_LABELS[k]}</option>`).join("");
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><h2>${editing ? "Modifica evento" : "Nuovo evento"}</h2></div>
          <div class="head-actions"><button type="button" class="btn" id="sp-back">← Indietro</button></div></div>
        <div class="card-soft ev-form">
          <div class="form-grid">
            <label>Tipo<select id="sp-type" class="input">${typeOpts}</select></label>
            <label class="form-wide">Titolo<input type="text" id="sp-title" class="input" value="${escapeAttr(editing?.title || "")}" placeholder="Es. Partita vs Juventus"></label>
            <label>Data<input type="date" id="sp-date" class="input" value="${escapeAttr(editing?.date || "")}"></label>
            <label>Orario<input type="text" id="sp-time" class="input" value="${escapeAttr(editing?.time || "")}" placeholder="Es. 15:00"></label>
            <label>Avversario<input type="text" id="sp-opp" class="input" value="${escapeAttr(editing?.opponent || "")}" placeholder="Opzionale"></label>
            <label>Luogo<input type="text" id="sp-loc" class="input" value="${escapeAttr(editing?.location || "")}" placeholder="Opzionale"></label>
          </div>
          <label class="field"><span class="field-label">Note</span><textarea id="sp-notes" class="input" rows="3" placeholder="Note sull'evento…">${escapeHtml(editing?.notes || "")}</textarea></label>
          <div class="form-actions"><button type="button" class="btn" id="sp-cancel">Annulla</button><button type="button" class="btn btn-primary" id="sp-save">${editing ? "Salva evento" : "Crea evento"}</button></div>
        </div>
      </section>`;
    const back = () => { this.stagioneTab = "specifics"; this.setRoute("stagione"); };
    this.main.querySelector("#sp-back").addEventListener("click", back);
    this.main.querySelector("#sp-cancel").addEventListener("click", back);
    this.main.querySelector("#sp-save").addEventListener("click", async () => {
      const title = (this.main.querySelector("#sp-title").value || "").trim();
      if (!title) { this.toast("Dai un titolo all'evento.", "error"); return; }
      const now = new Date().toISOString();
      const se = normalizeSpecificEvent({
        type: "specific_event", id: editing ? editing.id : genId(),
        createdAt: editing ? editing.createdAt : now, updatedAt: now,
        eventType: this.main.querySelector("#sp-type").value, title,
        date: this.main.querySelector("#sp-date").value || null,
        opponent: (this.main.querySelector("#sp-opp").value || "").trim() || null,
        location: (this.main.querySelector("#sp-loc").value || "").trim() || null,
        time: (this.main.querySelector("#sp-time").value || "").trim() || null,
        notes: (this.main.querySelector("#sp-notes").value || "").trim()
      });
      await storage.saveSpecificEvent(se);
      await this._reloadSpecificEvents();
      this.toast(editing ? "Evento aggiornato." : "Evento creato.");
      back();
    });
  }
  async _deleteSpecific(id) {
    const se = this.specificEvents.find(e => e.id === id);
    if (!se) return;
    if (!confirm(`Eliminare l'evento "${se.title || "senza titolo"}"? Verrà scollegato dagli impegni che lo referenziano.`)) return;
    // scollega da tutti i GenericEvent che lo referenziano
    for (const g of this.genericEvents) {
      if ((g.linkedItems || []).some(li => li.type === "specific_event" && li.id === id)) {
        g.linkedItems = g.linkedItems.filter(li => !(li.type === "specific_event" && li.id === id));
        g.updatedAt = new Date().toISOString();
        await storage.saveGenericEvent(g);
      }
    }
    await storage.deleteSpecificEvent(id);
    await this._reloadSpecificEvents();
    await this._reloadGenericEvents();
    this.toast("Impegno eliminato.");
    if (this.route === "event-edit") { this.stagioneTab = "specifics"; this.setRoute("stagione"); }
    else this._renderSpecificList();
  }
  _exportSpecific(se) {
    triggerDownload(`evento_${slugFile(se.title || "evento")}.json`, JSON.stringify(buildSingleSpecificEventExport(se), null, 2));
  }
  _promptImportSpecific() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0]; if (!file) return;
      try {
        const res = parseSingleSpecificEventImport(await readFileAsText(file));
        if (!res.ok) { this.toast(res.error, "error"); return; }
        await this._importSpecificResolved(res.specificEvent);
      } catch (err) { this.toast("Import non riuscito: " + (err.message || "errore"), "error"); }
    });
    input.click();
  }
  async _importSpecificResolved(se) {
    const exists = this.specificEvents.some(e => e.id === se.id);
    if (!exists) { await this._storeImportedSpecific(se, false); return; }
    const { close } = this._openModal(`
      <h3>Evento già presente</h3>
      <p class="muted small">Esiste già un evento con lo stesso identificativo ("${escapeHtml(se.title || "senza titolo")}"). Come procedere?</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-mcancel>Annulla</button>
        <button type="button" class="btn btn-soft" data-mcopy>Salva come copia</button>
        <button type="button" class="btn btn-primary" data-moverwrite>Sovrascrivi</button>
      </div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mcopy]": async () => { close(); await this._storeImportedSpecific(se, true); },
      "[data-moverwrite]": async () => { close(); await this._storeImportedSpecific(se, false); }
    });
  }
  async _storeImportedSpecific(se, asCopy) {
    const now = new Date().toISOString();
    let e = { ...se };
    if (asCopy) { e.id = genId(); e.title = (se.title || "Evento") + " — copia"; e.createdAt = now; e.updatedAt = now; }
    await storage.saveSpecificEvent(e);
    await this._reloadSpecificEvents();
    this.toast(asCopy ? "Evento importato come copia." : "Evento importato.");
    this.stagioneTab = "specifics";
    this.setRoute("stagione");
  }

  // ========================================================================
  // ==========================  PRESENZE (Attendance)  ======================
  // ========================================================================
  async _reloadAttendances() { this.attendances = await storage.getAllAttendances(); }

  // Riepilogo presenze di un Impegno: X registrati / Y attesi + classe di stato colorata.
  // cls: "none" (grigio) | "partial" (blu) | "ok" (verde) | "warn" (giallo) | "bad" (rosso).
  _attSummary(ge) {
    const expected = Array.isArray(ge.goalkeeperIds) ? ge.goalkeeperIds : [];
    const y = expected.length;
    const records = this.attendances.filter(a => a.genericEventId === ge.id && expected.includes(a.goalkeeperId));
    const x = records.length;
    let cls = "none", label = "Da registrare";
    if (y > 0 && x > 0 && x < y) { cls = "partial"; label = "Parziale"; }
    else if (y > 0 && x === y) {
      if (records.some(r => r.status === "absent")) { cls = "bad"; label = "Assenze non giustificate"; }
      else if (records.some(r => r.status === "excused")) { cls = "warn"; label = "Assenze giustificate"; }
      else { cls = "ok"; label = "Tutti presenti"; }
    }
    return { x, y, cls, label };
  }

  renderPresenze(param) {
    this._destroyPickers();
    if (param) this.attView.detailId = param;
    if (this.attView.detailId) this._renderAttendanceDetail(this.attView.detailId);
    else this._renderAttendanceList();
  }

  _filteredGenericEventsForAttendance() {
    const f = this.attFilter;
    return this.genericEvents.filter(ge => {
      if (f.type && ge.eventType !== f.type) return false;
      if (f.seasonId && ge.seasonId !== f.seasonId) return false;
      if (f.gkIds.length && !(ge.goalkeeperIds || []).some(id => f.gkIds.includes(id))) return false;
      if (f.from && (ge.date || "") < f.from) return false;
      if (f.to && (ge.date || "") > f.to) return false;
      if (f.status && f.status !== "all") {
        const s = this._attSummary(ge);
        if (f.status === "none" && s.cls !== "none") return false;
        if (f.status === "partial" && s.cls !== "partial") return false;
        if (f.status === "complete" && !["ok", "warn", "bad"].includes(s.cls)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  // Opzioni <option> per un dropdown Stagione a selezione singola: "Tutte le stagioni" + una per stagione (titolo + date).
  _seasonSelectOptions(selectedId) {
    const sorted = [...this.seasons].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    const opts = sorted.map(s => `<option value="${escapeAttr(s.id)}" ${selectedId === s.id ? "selected" : ""}>${escapeHtml(s.title || "Stagione")} (${this._fmtDate(s.startDate) || "—"} → ${this._fmtDate(s.endDate) || "—"})</option>`).join("");
    return `<option value="">Tutte le stagioni</option>${opts}`;
  }

  _attRowHtml(ge) {
    const s = this._attSummary(ge);
    const dt = parseDateISO(ge.date);
    const dateLabel = dt ? this._fmtDayLong(dt) : (ge.date || "—");
    return `<div class="att-row" data-attrow="${escapeAttr(ge.id)}">
      <div class="att-row-main">
        <span class="ge-pill ge-${escapeAttr(ge.eventType)}">${escapeHtml(this._geTypeLabel(ge.eventType))}</span>
        <span class="att-row-date">${escapeHtml(dateLabel)}</span>
      </div>
      <div class="att-row-meta">
        <span class="att-count">${s.x}/${s.y} registrati</span>
        <span class="att-badge att-badge-${s.cls}">${escapeHtml(s.label)}</span>
      </div>
    </div>`;
  }

  // ---------- Vista elenco: impegni da registrare, con filtri ----------
  _renderAttendanceList() {
    this._destroyPickers();
    const typeOpts = Object.keys(DAY_TYPE_LABELS).map(k => `<option value="${k}" ${this.attFilter.type === k ? "selected" : ""}>${DAY_TYPE_LABELS[k]}</option>`).join("");
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><h2>Presenze</h2><p class="muted">${this.genericEvents.length} impegni totali</p></div></div>
        <div class="filters card-soft">
          <div class="filters-pickers">
          
          
          <div class="filter-field filter-field-wide">
              ${this._dateRangeHtml("att-f-from", "att-f-to", this.attFilter.from, this.attFilter.to)}
              <div class="filter-field"><span class="field-label">Tipo</span><select class="input" id="att-f-type"><option value="">Tutti</option>${typeOpts}</select></div>
              <div class="filter-field"><span class="field-label">Stagione</span><select class="input" id="att-f-season">${this._seasonSelectOptions(this.attFilter.seasonId)}</select></div>
              <div class="filter-field"><span class="field-label">Stato registrazione</span>
                <select class="input" id="att-f-status">
                  <option value="all" ${this.attFilter.status === "all" ? "selected" : ""}>Tutti</option>
                  <option value="none" ${this.attFilter.status === "none" ? "selected" : ""}>Non registrato</option>
                  <option value="partial" ${this.attFilter.status === "partial" ? "selected" : ""}>Parziale</option>
                  <option value="complete" ${this.attFilter.status === "complete" ? "selected" : ""}>Completo</option>
                </select>
              </div>
            </div>
          
          <div class="filter-field filter-field-wide"><span class="field-label">Portiere</span><div id="att-f-gk"></div></div>
            
          </div>
          <div class="filters-foot">
            <span class="filters-count" id="att-count"></span>
            <button type="button" class="link-btn" id="att-clear-filters">Cancella filtri</button>
          </div>
        </div>
        <div class="card-soft att-list-wrap"><div id="att-rows"></div></div>
      </section>`;
    this._mountAttGkPicker(this.main.querySelector("#att-f-gk"), this.attFilter.gkIds, (ids) => {
      this.attFilter.gkIds = ids;
      this._refreshAttendanceRows();
    });
    this.main.querySelector("#att-f-type").addEventListener("change", (e) => { this.attFilter.type = e.target.value; this._refreshAttendanceRows(); });
    this.main.querySelector("#att-f-season").addEventListener("change", (e) => { this.attFilter.seasonId = e.target.value; this._refreshAttendanceRows(); });
    this.main.querySelector("#att-f-from").addEventListener("change", (e) => { this.attFilter.from = e.target.value; this._refreshAttendanceRows(); });
    this.main.querySelector("#att-f-to").addEventListener("change", (e) => { this.attFilter.to = e.target.value; this._refreshAttendanceRows(); });
    this.main.querySelector("#att-f-status").addEventListener("change", (e) => { this.attFilter.status = e.target.value; this._refreshAttendanceRows(); });
    this.main.querySelector("#att-clear-filters").addEventListener("click", () => {
      this.attFilter = { type: "", gkIds: [], from: "", to: "", status: "all", seasonId: "" };
      this._renderAttendanceList();
    });
    this._refreshAttendanceRows();
  }

  // Ridisegna solo il conteggio e le righe (filtri e picker portiere restano montati).
  _refreshAttendanceRows() {
    const list = this._filteredGenericEventsForAttendance();
    const countEl = this.main.querySelector("#att-count");
    if (countEl) countEl.textContent = `${list.length} impegni trovati`;
    const rowsEl = this.main.querySelector("#att-rows");
    if (!rowsEl) return;
    rowsEl.innerHTML = list.length
      ? `<div class="att-list">${list.map(ge => this._attRowHtml(ge)).join("")}</div>`
      : this._empty(this.genericEvents.length ? "Nessun impegno corrisponde ai filtri." : "Nessun impegno pianificato. Crea una Stagione e genera gli impegni.");
    rowsEl.querySelectorAll("[data-attrow]").forEach(el => el.addEventListener("click", () => {
      this.attView.detailId = el.dataset.attrow;
      this._renderAttendanceDetail(el.dataset.attrow);
    }));
  }

  // Picker portieri compatto (ricerca + chip), dedicato al filtro Presenze: notifica ogni cambio via onChange.
  _mountAttGkPicker(mountEl, initialIds, onChange) {
    const self = this;
    const state = { q: "", selected: new Set((initialIds || []).filter(Boolean)) };
    mountEl.innerHTML = `
      <div class="gkp">
        <div class="gkp-selected"></div>
        <div class="gkp-filters"><input type="search" class="input gkp-q" placeholder="Cerca portiere…"></div>
        <div class="gkp-results"></div>
      </div>`;
    const selWrap = mountEl.querySelector(".gkp-selected");
    const resWrap = mountEl.querySelector(".gkp-results");
    function filtered() {
      const q = state.q.trim().toLowerCase();
      return self.goalkeepers.filter(g => !q || self._gkFullName(g).toLowerCase().includes(q))
        .sort((a, b) => self._gkFullName(a).localeCompare(self._gkFullName(b)));
    }
    function renderSelected() {
      const ids = [...state.selected];
      selWrap.innerHTML = ids.length
        ? ids.map(id => { const g = self.goalkeepers.find(x => x.id === id); return `<span class="gk-chip">${g ? self._gkAvatarMini(g) : ""}<span class="gk-chip-name">${escapeHtml(g ? self._gkFullName(g) : "(rimosso)")}</span><button type="button" class="gk-chip-del" data-unsel="${escapeAttr(id)}" title="Rimuovi">✕</button></span>`; }).join("")
        : `<span class="muted small">Tutti i portieri.</span>`;
      selWrap.querySelectorAll("[data-unsel]").forEach(b => b.addEventListener("click", () => { state.selected.delete(b.dataset.unsel); renderSelected(); renderResults(); onChange([...state.selected]); }));
    }
    function renderResults() {
      const list = filtered();
      resWrap.innerHTML = list.length
        ? list.map(g => `<button type="button" class="gkp-row ${state.selected.has(g.id) ? "is-sel" : ""}" data-tog="${escapeAttr(g.id)}">${self._gkAvatarMini(g)}<span class="gkp-row-name">${escapeHtml(self._gkFullName(g))}</span>${state.selected.has(g.id) ? '<span class="gkp-check">✓</span>' : ""}</button>`).join("")
        : `<p class="muted small">Nessun portiere trovato.</p>`;
      resWrap.querySelectorAll("[data-tog]").forEach(b => b.addEventListener("click", () => { const id = b.dataset.tog; if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); renderSelected(); renderResults(); onChange([...state.selected]); }));
    }
    mountEl.querySelector(".gkp-q").addEventListener("input", (e) => { state.q = e.target.value; renderResults(); });
    renderSelected(); renderResults();
    return { getIds: () => [...state.selected] };
  }

  // ---------- Registro presenze di un Impegno ----------
  _renderAttendanceDetail(geId) {
    this._destroyPickers();
    const ge = this.genericEvents.find(g => g.id === geId);
    if (!ge) { this.attView.detailId = null; this._renderAttendanceList(); return; }
    const dt = parseDateISO(ge.date);
    const dateLabel = dt ? this._fmtDayLong(dt) : (ge.date || "—");
    const expected = Array.isArray(ge.goalkeeperIds) ? ge.goalkeeperIds : [];
    const linkedHtml = this._impLinkedHtml(ge);
    const rows = expected.map(gkId => {
      const gk = this.goalkeepers.find(g => g.id === gkId);
      const rec = this.attendances.find(a => a.genericEventId === ge.id && a.goalkeeperId === gkId) || null;
      const name = gk ? this._gkFullName(gk) : "(portiere rimosso)";
      const avatar = gk ? this._gkPhotoHtml(gk, "gk-avatar-sm") : `<span class="gk-avatar gk-avatar-sm gk-avatar-ini">?</span>`;
      return `<div class="att-gk-row" data-attgk="${escapeAttr(gkId)}">
        <span class="att-gk-id">${avatar}<span class="att-gk-name">${escapeHtml(name)}</span></span>
        <div class="att-toggle">
          <button type="button" class="att-btn att-present ${rec && rec.status === "present" ? "is-on" : ""}" data-attstatus="present">Presente</button>
          <button type="button" class="att-btn att-absent ${rec && rec.status === "absent" ? "is-on" : ""}" data-attstatus="absent">Assente</button>
          <button type="button" class="att-btn att-excused ${rec && rec.status === "excused" ? "is-on" : ""}" data-attstatus="excused">Giustificato</button>
        </div>
        <input type="text" class="input att-notes" data-attnotes="${escapeAttr(gkId)}" placeholder="Nota (facoltativa)…" value="${escapeAttr(rec ? (rec.notes || "") : "")}" ${rec ? "" : "disabled"} title="${rec ? "" : "Seleziona uno stato per abilitare le note"}">
      </div>`;
    }).join("");
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><button type="button" class="btn" id="att-back">← Presenze</button></div></div>
        <div class="card-soft">
          <h2>${escapeHtml(this._geTypeLabel(ge.eventType))} <span class="muted">· ${escapeHtml(dateLabel)}</span></h2>
          ${linkedHtml ? `<div class="att-linked">${linkedHtml}</div>` : `<p class="muted small">Nessun elemento collegato.</p>`}
        </div>
        <div class="card-soft">
          <div class="att-detail-head">
            <h3 class="section-h">Portieri attesi (${expected.length})</h3>
            <div class="head-actions">
              <button type="button" class="btn btn-soft" id="att-all-present">Segna tutti presenti</button>
              <button type="button" class="btn btn-ghost danger" id="att-clear-all">Azzera tutti</button>
            </div>
          </div>
          ${expected.length ? `<div class="att-gk-list">${rows}</div>` : `<p class="muted small">Nessun portiere atteso per questo impegno.</p>`}
        </div>
      </section>`;
    this.main.querySelector("#att-back").addEventListener("click", () => { this.attView.detailId = null; this._renderAttendanceList(); });
    this.main.querySelectorAll("[data-openevent]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("event-edit", b.dataset.openevent); }));
    this.main.querySelectorAll("[data-opensession]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("sedute"); }));
    this.main.querySelectorAll("[data-attstatus]").forEach(b => b.addEventListener("click", async () => {
      const row = b.closest("[data-attgk]");
      if (row) await this._setAttendance(ge, row.dataset.attgk, b.dataset.attstatus);
    }));
    this.main.querySelectorAll("[data-attnotes]").forEach(inp => inp.addEventListener("change", async () => {
      await this._setAttendanceNotes(ge, inp.dataset.attnotes, inp.value);
    }));
    const allBtn = this.main.querySelector("#att-all-present");
    if (allBtn) allBtn.addEventListener("click", () => this._markAllPresent(ge));
    const clearBtn = this.main.querySelector("#att-clear-all");
    if (clearBtn) clearBtn.addEventListener("click", () => this._clearAllAttendance(ge));
  }

  // Crea o aggiorna immediatamente il record Attendance per un portiere su un Impegno.
  async _setAttendance(ge, gkId, status) {
    const now = new Date().toISOString();
    const existing = this.attendances.find(a => a.genericEventId === ge.id && a.goalkeeperId === gkId);
    const rec = existing
      ? { ...existing, status, updatedAt: now }
      : { type: "attendance", id: genId(), createdAt: now, updatedAt: now, genericEventId: ge.id, goalkeeperId: gkId, status, notes: null };
    await storage.putAttendance(rec);
    await this._reloadAttendances();
    this._renderAttendanceDetail(ge.id);
  }

  async _setAttendanceNotes(ge, gkId, notes) {
    const existing = this.attendances.find(a => a.genericEventId === ge.id && a.goalkeeperId === gkId);
    if (!existing) return; // il campo note è disabilitato finché non esiste un record
    const rec = { ...existing, notes: (notes || "").trim() || null, updatedAt: new Date().toISOString() };
    await storage.putAttendance(rec);
    await this._reloadAttendances();
  }

  // "Segna tutti presenti": imposta Presente solo per i portieri attesi non ancora registrati.
  async _markAllPresent(ge) {
    const expected = Array.isArray(ge.goalkeeperIds) ? ge.goalkeeperIds : [];
    const already = new Set(this.attendances.filter(a => a.genericEventId === ge.id).map(a => a.goalkeeperId));
    const toCreate = expected.filter(id => !already.has(id));
    if (!toCreate.length) { this.toast("Tutti i portieri attesi sono già registrati."); return; }
    const now = new Date().toISOString();
    for (const gkId of toCreate) {
      await storage.putAttendance({ type: "attendance", id: genId(), createdAt: now, updatedAt: now, genericEventId: ge.id, goalkeeperId: gkId, status: "present", notes: null });
    }
    await this._reloadAttendances();
    this.toast(`${toCreate.length} portieri segnati presenti.`);
    this._renderAttendanceDetail(ge.id);
  }

  // "Azzera tutti": rimuove tutte le registrazioni di questo impegno, con conferma.
  _clearAllAttendance(ge) {
    const list = this.attendances.filter(a => a.genericEventId === ge.id);
    if (!list.length) { this.toast("Nessuna presenza da azzerare."); return; }
    const { close } = this._openModal(`
      <h3>Azzerare tutte le presenze?</h3>
      <p class="muted small">Verranno eliminate tutte le ${list.length} registrazioni di presenza per questo impegno. L'operazione non è reversibile.</p>
      <div class="modal-actions"><button type="button" class="btn" data-mcancel>Annulla</button><button type="button" class="btn btn-ghost danger" data-mok>Azzera tutte</button></div>`);
    this._wireModalButtons({
      "[data-mcancel]": () => close(),
      "[data-mok]": async () => {
        close();
        for (const a of list) await storage.deleteAttendance(a.id);
        await this._reloadAttendances();
        this.toast("Presenze azzerate.");
        this._renderAttendanceDetail(ge.id);
      }
    });
  }

  // ---------- Storico presenze nella scheda portiere ----------
  // Unione tra impegni in cui il portiere è ATTUALMENTE atteso e impegni in cui esiste già
  // una registrazione per lui (anche se nel frattempo rimosso dai goalkeeperIds dell'impegno).
  _gkAttendanceEntries(gk) {
    const byGE = new Map(this.genericEvents.map(g => [g.id, g]));
    const recByGE = new Map(this.attendances.filter(a => a.goalkeeperId === gk.id).map(a => [a.genericEventId, a]));
    const expectedIds = this.genericEvents.filter(g => Array.isArray(g.goalkeeperIds) && g.goalkeeperIds.includes(gk.id)).map(g => g.id);
    const allIds = new Set([...expectedIds, ...recByGE.keys()]);
    return [...allIds].map(id => byGE.get(id)).filter(Boolean)
      .map(ge => ({ ge, rec: recByGE.get(ge.id) || null }))
      .sort((a, b) => (b.ge.date || "").localeCompare(a.ge.date || ""));
  }

  _renderAccPresenze(gk) {
    const bodyEl = this.main.querySelector("#acc-body-presenze");
    if (!bodyEl) return;
    const f = this.gkAccordion.presenze.filter;
    bodyEl.innerHTML = `
      <div class="acc-fp-head">
        ${this._filterToggleBtnHtml("gk-presenze", this._accPresenzeFilterCount(f))}
        <span class="acc-fp-label">Filtri</span>
      </div>
      <div class="filters-collapse" id="fp-collapse-gk-presenze">
        <div class="acc-filters">
          <div class="filter-field"><span class="field-label">Tipo</span><select class="input" id="accp-type"><option value="">Tutti</option>${Object.keys(DAY_TYPE_LABELS).map(k => `<option value="${k}" ${f.type === k ? "selected" : ""}>${DAY_TYPE_LABELS[k]}</option>`).join("")}</select></div>
          <div class="filter-field"><span class="field-label">Stagione</span><select class="input" id="accp-season">${this._seasonSelectOptions(f.seasonId)}</select></div>
          ${this._dateRangeHtml("accp-from", "accp-to", f.from, f.to)}
          <div class="filter-field"><span class="field-label">Stato</span>
            <select class="input" id="accp-status">
              <option value="all" ${f.status === "all" ? "selected" : ""}>Tutti</option>
              <option value="none" ${f.status === "none" ? "selected" : ""}>Da registrare</option>
              <option value="present" ${f.status === "present" ? "selected" : ""}>Presente</option>
              <option value="absent" ${f.status === "absent" ? "selected" : ""}>Assente</option>
              <option value="excused" ${f.status === "excused" ? "selected" : ""}>Giustificato</option>
            </select>
          </div>
        </div>
      </div>
      <div id="accp-body"></div>`;
    bodyEl.querySelector("#accp-type").addEventListener("change", (e) => { f.type = e.target.value; this._refreshAccPresenze(gk); });
    bodyEl.querySelector("#accp-season").addEventListener("change", (e) => { f.seasonId = e.target.value; this._refreshAccPresenze(gk); });
    bodyEl.querySelector("#accp-from").addEventListener("change", (e) => { f.from = e.target.value; this._refreshAccPresenze(gk); });
    bodyEl.querySelector("#accp-to").addEventListener("change", (e) => { f.to = e.target.value; this._refreshAccPresenze(gk); });
    bodyEl.querySelector("#accp-status").addEventListener("change", (e) => { f.status = e.target.value; this._refreshAccPresenze(gk); });
    this._wireFilterToggle(bodyEl, "gk-presenze");
    this._refreshAccPresenze(gk);
  }

  // Conteggio filtri attivi per il badge del secondo livello (Storico presenze).
  _accPresenzeFilterCount(f) {
    return this._countActiveFilters([!!f.type, !!f.seasonId, !!f.from, !!f.to, f.status !== "all"]);
  }

  _refreshAccPresenze(gk) {
    const bodyEl = this.main.querySelector("#acc-body-presenze");
    if (!bodyEl) return;
    const wrap = bodyEl.querySelector("#accp-body");
    if (!wrap) return;
    const f = this.gkAccordion.presenze.filter;
    this._updateFilterBadge(bodyEl, "gk-presenze", this._accPresenzeFilterCount(f));
    const entries = this._gkAttendanceEntries(gk).filter(({ ge, rec }) => {
      if (f.type && ge.eventType !== f.type) return false;
      if (f.seasonId && ge.seasonId !== f.seasonId) return false;
      if (f.from && (ge.date || "") < f.from) return false;
      if (f.to && (ge.date || "") > f.to) return false;
      if (f.status !== "all" && (rec ? rec.status : "none") !== f.status) return false;
      return true;
    });
    const pres = entries.filter(e => e.rec && e.rec.status === "present").length;
    const abs = entries.filter(e => e.rec && e.rec.status === "absent").length;
    const exc = entries.filter(e => e.rec && e.rec.status === "excused").length;
    const rows = entries.map(({ ge, rec }) => {
      const dt = parseDateISO(ge.date);
      const dateLabel = dt ? this._fmtDayLong(dt) : (ge.date || "—");
      const cls = !rec ? "none" : rec.status === "present" ? "ok" : rec.status === "absent" ? "bad" : "warn";
      const label = !rec ? "Da registrare" : rec.status === "present" ? "Presente" : rec.status === "absent" ? "Assente" : "Giustificato";
      return `<li class="gk-history-row" data-atthist="${escapeAttr(ge.id)}">
        <span class="att-hist-main"><span class="ge-pill ge-${escapeAttr(ge.eventType)}">${escapeHtml(this._geTypeLabel(ge.eventType))}</span><span class="gk-history-title">${escapeHtml(dateLabel)}</span></span>
        <span class="att-hist-side">${rec && rec.notes ? `<span class="muted small">${escapeHtml(rec.notes)}</span>` : ""}<span class="att-badge att-badge-${cls}">${escapeHtml(label)}</span></span>
      </li>`;
    }).join("");
    wrap.innerHTML = `
      <div class="att-summary-row">
        <span class="att-summary-item">Presenze: <strong>${pres}</strong></span>
        <span class="att-summary-item">Assenze: <strong>${abs}</strong></span>
        <span class="att-summary-item">Giustificate: <strong>${exc}</strong></span>
      </div>
      ${entries.length ? `<ul class="gk-history">${rows}</ul>` : `<p class="muted small">Nessun impegno corrisponde ai filtri.</p>`}`;
    wrap.querySelectorAll("[data-atthist]").forEach(el => el.addEventListener("click", () => this.setRoute("presenze", el.dataset.atthist)));
  }

  // ---------- Storico sedute nella scheda portiere: una riga per ogni volta effettuata ----------
  _renderAccSedute(gk) {
    const bodyEl = this.main.querySelector("#acc-body-sedute");
    if (!bodyEl) return;
    const f = this.gkAccordion.sedute.filter;
    bodyEl.innerHTML = `
      <div class="acc-fp-head">
        ${this._filterToggleBtnHtml("gk-sedute", this._accSeduteFilterCount(f))}
        <span class="acc-fp-label">Filtri</span>
      </div>
      <div class="filters-collapse" id="fp-collapse-gk-sedute">
        <div class="acc-filters">
          <div class="filter-field"><span class="field-label">Cerca seduta</span><input type="search" class="input" id="accs-q" placeholder="Titolo seduta…" value="${escapeAttr(f.q)}"></div>
          <div class="filter-field"><span class="field-label">Stagione</span><select class="input" id="accs-season">${this._seasonSelectOptions(f.seasonId)}</select></div>
          <div class="filter-field"><span class="field-label">Tipo impegno</span><select class="input" id="accs-type"><option value="">Tutti</option>${Object.keys(DAY_TYPE_LABELS).map(k => `<option value="${k}" ${f.type === k ? "selected" : ""}>${DAY_TYPE_LABELS[k]}</option>`).join("")}</select></div>
          ${this._dateRangeHtml("accs-from", "accs-to", f.from, f.to)}
        </div>
      </div>
      <div id="accs-rows"></div>`;
    bodyEl.querySelector("#accs-from").addEventListener("change", (e) => { f.from = e.target.value; this._refreshAccSedute(gk); });
    bodyEl.querySelector("#accs-to").addEventListener("change", (e) => { f.to = e.target.value; this._refreshAccSedute(gk); });
    bodyEl.querySelector("#accs-season").addEventListener("change", (e) => { f.seasonId = e.target.value; this._refreshAccSedute(gk); });
    bodyEl.querySelector("#accs-type").addEventListener("change", (e) => { f.type = e.target.value; this._refreshAccSedute(gk); });
    bodyEl.querySelector("#accs-q").addEventListener("input", (e) => { f.q = e.target.value; this._refreshAccSedute(gk); });
    this._wireFilterToggle(bodyEl, "gk-sedute");
    this._refreshAccSedute(gk);
  }

  // Conteggio filtri attivi per il badge del secondo livello (Storico sedute).
  _accSeduteFilterCount(f) {
    return this._countActiveFilters([!!f.q.trim(), !!f.seasonId, !!f.type, !!f.from, !!f.to]);
  }

  _refreshAccSedute(gk) {
    const bodyEl = this.main.querySelector("#acc-body-sedute");
    if (!bodyEl) return;
    const rowsEl = bodyEl.querySelector("#accs-rows");
    if (!rowsEl) return;
    const f = this.gkAccordion.sedute.filter;
    this._updateFilterBadge(bodyEl, "gk-sedute", this._accSeduteFilterCount(f));
    const q = f.q.trim().toLowerCase();
    const rows = [];
    (this.gkAccordion.completedSessions || []).forEach(({ session, occurrences }) => {
      if (q && !(session.title || "").toLowerCase().includes(q)) return;
      occurrences.forEach(occ => {
        if (f.from && (occ.date || "") < f.from) return;
        if (f.to && (occ.date || "") > f.to) return;
        if (f.seasonId && occ.seasonId !== f.seasonId) return;
        if (f.type && occ.eventType !== f.type) return;
        rows.push({ session, occ });
      });
    });
    rows.sort((a, b) => (b.occ.date || "").localeCompare(a.occ.date || ""));
    rowsEl.innerHTML = rows.length ? `<ul class="gk-history">${rows.map(({ session, occ }) => {
      const dt = parseDateISO(occ.date);
      const dateLabel = dt ? this._fmtDayLong(dt) : (occ.date || "—");
      return `<li class="gk-history-row" data-accsession="${escapeAttr(session.id)}">
        <span class="att-hist-main"><span class="ge-pill ge-${escapeAttr(occ.eventType || "other")}">${escapeHtml(this._geTypeLabel(occ.eventType))}</span><span class="gk-history-title">${escapeHtml(session.title || "Seduta")}</span></span>
        <span class="muted small">${escapeHtml(dateLabel)}</span>
      </li>`;
    }).join("")}</ul>` : `<p class="muted small">Nessuna seduta effettuata corrisponde ai filtri.</p>`;
    rowsEl.querySelectorAll("[data-accsession]").forEach(el => el.addEventListener("click", () => this.setRoute("sedute")));
  }

  // ---------- Esercizi effettuati nella scheda portiere: aggregati per esercizio ----------
  // Un esercizio può comparire in più sedute/impegni diversi: aggrega tutte le occorrenze.
  _gkExerciseAggregates(gk) {
    const map = new Map(); // exerciseId -> { exercise, occurrences: [] }
    (this.gkAccordion.completedSessions || []).forEach(({ session, occurrences }) => {
      (session.exerciseIds || []).forEach(exId => {
        const exercise = this.exercises.find(e => e.id === exId);
        if (!exercise) return; // esercizio rimosso: nessun residuo
        if (!map.has(exId)) map.set(exId, { exercise, occurrences: [] });
        occurrences.forEach(occ => map.get(exId).occurrences.push({ ...occ, sessionId: session.id, sessionTitle: session.title }));
      });
    });
    const out = [...map.values()];
    out.forEach(e => e.occurrences.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    out.sort((a, b) => {
      const da = a.occurrences[0] ? (a.occurrences[0].date || "") : "";
      const db = b.occurrences[0] ? (b.occurrences[0].date || "") : "";
      return db.localeCompare(da);
    });
    return out;
  }

  _renderAccEsercizi(gk) {
    const bodyEl = this.main.querySelector("#acc-body-esercizi");
    if (!bodyEl) return;
    const f = this.gkAccordion.esercizi.filter;
    this.gkAccordion.exerciseAggregates = this._gkExerciseAggregates(gk);
    bodyEl.innerHTML = `
      <div class="acc-fp-head">
        ${this._filterToggleBtnHtml("gk-esercizi", this._accEserciziFilterCount(f))}
        <span class="acc-fp-label">Filtri</span>
      </div>
      <div class="filters-collapse" id="fp-collapse-gk-esercizi">
        <div class="acc-filters">
          <div class="filter-field"><span class="field-label">Cerca esercizio</span><input type="search" class="input" id="acce-q" placeholder="Titolo esercizio…" value="${escapeAttr(f.q)}"></div>
          <div class="filter-field"><span class="field-label">Gesti tecnici</span><div id="acce-gestures"></div></div>
          <div class="filter-field"><span class="field-label">Qualità allenate</span><div id="acce-qualities"></div></div>
          <div class="filter-field"><span class="field-label">Periodo</span><div id="acce-periods"></div></div>
          ${this._dateRangeHtml("acce-from", "acce-to", f.from, f.to)}
        </div>
      </div>
      <div id="acce-rows"></div>`;
    bodyEl.querySelector("#acce-q").addEventListener("input", (e) => { f.q = e.target.value; this._refreshAccEsercizi(gk); });
    bodyEl.querySelector("#acce-from").addEventListener("change", (e) => { f.from = e.target.value; this._refreshAccEsercizi(gk); });
    bodyEl.querySelector("#acce-to").addEventListener("change", (e) => { f.to = e.target.value; this._refreshAccEsercizi(gk); });
    const tpG = new TagPicker(bodyEl.querySelector("#acce-gestures"), { getOptions: () => this.customLists.technicalGestures || [], selected: f.gestures, placeholder: "Filtra per gesto…", onChange: (sel) => { f.gestures = sel; this._refreshAccEsercizi(gk); } });
    const tpQ = new TagPicker(bodyEl.querySelector("#acce-qualities"), { getOptions: () => this.customLists.trainedQualities || [], selected: f.qualities, placeholder: "Filtra per qualità…", onChange: (sel) => { f.qualities = sel; this._refreshAccEsercizi(gk); } });
    const tpP = new TagPicker(bodyEl.querySelector("#acce-periods"), { getOptions: () => this.customLists.trainingPeriods || [], selected: f.periods, placeholder: "Filtra per periodo…", onChange: (sel) => { f.periods = sel; this._refreshAccEsercizi(gk); } });
    this._pickers.push(tpG, tpQ, tpP);
    this._wireFilterToggle(bodyEl, "gk-esercizi");
    this._refreshAccEsercizi(gk);
  }

  // Conteggio filtri attivi per il badge del secondo livello (Esercizi effettuati).
  _accEserciziFilterCount(f) {
    return this._countActiveFilters([!!f.q.trim(), f.gestures.length > 0, f.qualities.length > 0, f.periods.length > 0, !!f.from, !!f.to]);
  }

  _refreshAccEsercizi(gk) {
    const bodyEl = this.main.querySelector("#acc-body-esercizi");
    if (!bodyEl) return;
    const rowsEl = bodyEl.querySelector("#acce-rows");
    if (!rowsEl) return;
    const f = this.gkAccordion.esercizi.filter;
    this._updateFilterBadge(bodyEl, "gk-esercizi", this._accEserciziFilterCount(f));
    const q = f.q.trim().toLowerCase();
    const list = (this.gkAccordion.exerciseAggregates || []).filter(({ exercise, occurrences }) => {
      if (q && !(exercise.title || "").toLowerCase().includes(q)) return false;
      if (!matchMulti(exercise.technicalGestures, f.gestures, "or")) return false;
      if (!matchMulti(exercise.trainedQualities, f.qualities, "or")) return false;
      if (!matchMulti(exercise.trainingPeriod, f.periods, "or")) return false;
      if (f.from || f.to) {
        const inRange = occurrences.some(o => (!f.from || (o.date || "") >= f.from) && (!f.to || (o.date || "") <= f.to));
        if (!inRange) return false;
      }
      return true;
    });
    rowsEl.innerHTML = list.length ? `<ul class="gk-exlist acc-ex-list">${list.map(({ exercise, occurrences }) => {
      const mostRecent = occurrences[0];
      const dt = mostRecent ? parseDateISO(mostRecent.date) : null;
      const dateLabel = dt ? this._fmtDayLong(dt) : "—";
      const detailRows = occurrences.map(o => {
        const d = parseDateISO(o.date);
        const dl = d ? this._fmtDayLong(d) : (o.date || "—");
        return `<li class="acc-ex-occ" data-accexsession="${escapeAttr(o.sessionId)}"><span>${escapeHtml(dl)}</span><span class="muted small">${escapeHtml(o.sessionTitle || "Seduta")}</span></li>`;
      }).join("");
      return `<li class="acc-ex-row">
        <button type="button" class="acc-ex-head" data-accextoggle="1">
          <span class="acc-ex-title">${escapeHtml(exercise.title)}</span>
          <span class="acc-ex-meta">${occurrences.length > 1 ? `<span class="chip chip-sm">× ${occurrences.length} volte</span>` : ""}<span class="muted small">${escapeHtml(dateLabel)}</span><span class="acc-chevron" aria-hidden="true">⌄</span></span>
        </button>
        <ul class="acc-ex-detail">${detailRows}</ul>
      </li>`;
    }).join("")}</ul>` : `<p class="muted small">Nessun esercizio effettuato corrisponde ai filtri.</p>`;
    rowsEl.querySelectorAll("[data-accextoggle]").forEach(b => b.addEventListener("click", () => {
      const li = b.closest(".acc-ex-row");
      const detail = li ? li.querySelector(".acc-ex-detail") : null;
      if (detail) { detail.classList.toggle("is-open"); b.classList.toggle("is-open"); }
    }));
    rowsEl.querySelectorAll("[data-accexsession]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); this.setRoute("sedute"); }));
  }

  // ========================================================================
  // ==========================  REPORT PORTIERE  ============================
  // ========================================================================
  // Nessuna nuova query in storage.js: il report riusa interamente la logica dati
  // già presente (this.genericEvents/this.attendances già caricati, _gkAttendanceEntries
  // già costruito per lo Storico presenze, storage.getCompletedSessionsForGoalkeeper già
  // costruito per Storico sedute/Esercizi effettuati), aggregandola in modo diverso.

  // Un impegno/occorrenza rientra nell'ambito scelto (Stagione o periodo libero) se rispetta
  // seasonId e/o intervallo date. Riusato sia per gli Impegni (Attendance) sia per le occorrenze
  // di Seduta restituite da getCompletedSessionsForGoalkeeper (stessa forma: date/seasonId).
  _reportInScope(item, seasonId, from, to) {
    if (seasonId && item.seasonId !== seasonId) return false;
    if (from && (item.date || "") < from) return false;
    if (to && (item.date || "") > to) return false;
    return true;
  }

  _reportMonthLabel(key) { // key "YYYY-MM"
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_LABELS_SHORT[m] || key} ${y}`;
  }
  _reportWeekLabel(key) { // key = data ISO del lunedì della settimana
    const d = parseDateISO(key);
    if (!d) return key;
    return `${d.getDate()} ${MONTH_LABELS_SHORT[d.getMonth() + 1]}`;
  }

  // Aggrega gli impegni attesi (con relativo esito Attendance) per settimana o per mese.
  _reportBuckets(entries, monthly) {
    const map = new Map();
    entries.forEach(({ ge, rec }) => {
      const d = parseDateISO(ge.date);
      if (!d) return;
      const key = monthly ? (ge.date || "").slice(0, 7) : toISODate(mondayOf(d));
      if (!map.has(key)) map.set(key, { key, total: 0, present: 0 });
      const b = map.get(key);
      b.total++;
      if (rec && rec.status === "present") b.present++;
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  // Calcola l'intero report per il portiere/ambito correnti in this.reportState. Ritorna null se
  // mancano i dati minimi per procedere (nessun errore mostrato: gestito dal chiamante).
  async _computeReport() {
    const st = this.reportState;
    const gk = this.goalkeepers.find(g => g.id === st.goalkeeperId);
    if (!gk) return null;

    // Stagione e Periodo sono due filtri indipendenti, combinati in AND: entrambi opzionali.
    const seasonId = st.seasonId || null;
    const from = st.from || "";
    const to = st.to || "";
    const season = seasonId ? this.seasons.find(s => s.id === seasonId) : null;
    const seasonLabel = season
      ? `${season.title || "Stagione"} (${this._fmtDate(season.startDate) || "—"} → ${this._fmtDate(season.endDate) || "—"})`
      : "Tutte le stagioni";
    const periodLabel = (from || to) ? `dal ${from ? this._fmtDate(from) : "inizio"} al ${to ? this._fmtDate(to) : "oggi"}` : "";
    const scopeLabel = periodLabel ? `${seasonLabel} · ${periodLabel}` : seasonLabel;

    // A) Riepilogo presenze — riusa la stessa join già usata in Storico presenze.
    const entries = this._gkAttendanceEntries(gk).filter(({ ge }) => this._reportInScope(ge, seasonId, from, to));
    const totalExpected = entries.length;
    const present = entries.filter(e => e.rec && e.rec.status === "present").length;
    const absent = entries.filter(e => e.rec && e.rec.status === "absent").length;
    const excused = entries.filter(e => e.rec && e.rec.status === "excused").length;
    const pending = entries.filter(e => !e.rec).length;
    const pct = totalExpected ? Math.round((present / totalExpected) * 100) : null;

    const byType = {};
    entries.forEach(({ ge, rec }) => {
      const t = ge.eventType || "other";
      if (!byType[t]) byType[t] = { total: 0, present: 0 };
      byType[t].total++;
      if (rec && rec.status === "present") byType[t].present++;
    });
    const typeBreakdown = ["training", "match", "tournament"]
      .filter(t => byType[t] && byType[t].total > 0)
      .map(t => ({ type: t, label: DAY_TYPE_LABELS[t], pct: Math.round((byType[t].present / byType[t].total) * 100), total: byType[t].total }));

    // B) Andamento temporale: settimanale sotto i 3 mesi, mensile altrimenti (sul periodo
    // effettivo se i due estremi sono noti, altrimenti sull'arco coperto dai dati stessi).
    let spanDays = null;
    if (from && to) spanDays = Math.round((parseDateISO(to) - parseDateISO(from)) / 86400000);
    else if (entries.length) {
      const dates = entries.map(e => e.ge.date).filter(Boolean).sort();
      if (dates.length) spanDays = Math.round((parseDateISO(dates[dates.length - 1]) - parseDateISO(dates[0])) / 86400000);
    }
    const monthly = spanDays != null && spanDays > 92;
    const buckets = this._reportBuckets(entries, monthly);

    // C) Sedute ed esercizi — riusa storage.getCompletedSessionsForGoalkeeper (nessuna nuova query).
    const completedSessions = await storage.getCompletedSessionsForGoalkeeper(gk.id);
    let sessionCount = 0;
    const exMap = new Map();
    completedSessions.forEach(({ session, occurrences }) => {
      const inScopeOccs = occurrences.filter(occ => this._reportInScope(occ, seasonId, from, to));
      sessionCount += inScopeOccs.length;
      if (!inScopeOccs.length) return;
      (session.exerciseIds || []).forEach(exId => {
        const exercise = this.exercises.find(e => e.id === exId);
        if (!exercise) return; // esercizio rimosso: nessun residuo
        if (!exMap.has(exId)) exMap.set(exId, { exercise, occurrences: [] });
        inScopeOccs.forEach(occ => exMap.get(exId).occurrences.push({ ...occ, sessionId: session.id, sessionTitle: session.title }));
      });
    });
    const exerciseAgg = [...exMap.values()];
    exerciseAgg.forEach(e => e.occurrences.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    exerciseAgg.sort((a, b) => b.occurrences.length - a.occurrences.length || (b.occurrences[0]?.date || "").localeCompare(a.occurrences[0]?.date || ""));
    const topExercises = exerciseAgg.slice(0, 10);

    // D) Qualità allenate più frequenti (una occorrenza per esercizio distinto, non per ripetizione).
    const qualityCount = new Map();
    exerciseAgg.forEach(({ exercise }) => (exercise.trainedQualities || []).forEach(q => qualityCount.set(q, (qualityCount.get(q) || 0) + 1)));
    const topQualities = [...qualityCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Periodi di allenamento coperti, come badge semplici (valori distinti, nessun conteggio).
    const periodsSet = new Set();
    exerciseAgg.forEach(({ exercise }) => (exercise.trainingPeriod || []).forEach(p => periodsSet.add(p)));
    const periods = [...periodsSet].sort((a, b) => a.localeCompare(b));

    return { gk, periodLabel: scopeLabel, seasonId, from, to, totalExpected, present, absent, excused, pending, pct,
      typeBreakdown, buckets, monthly, sessionCount, topExercises, topQualities, periods, generatedAt: new Date() };
  }

  renderReport(param) {
    this._destroyPickers();
    if (param) { this.reportState.goalkeeperId = param; this.reportState.result = null; }
    const st = this.reportState;
    const sortedGks = [...this.goalkeepers].sort((a, b) => this._gkFullName(a).localeCompare(this._gkFullName(b)));
    const canGenerate = !!st.goalkeeperId;

    this.main.innerHTML = `
      <section class="view report-view">
        <div class="view-head"><div><h2>Report</h2><p class="muted">Report presenze, sedute ed esercizi per portiere.</p></div></div>

        <div class="filters card-soft no-print">
          <div class="filters-pickers">
            <div class="filter-field"><span class="field-label">Portiere</span>
              <select class="input" id="rpt-gk">
                <option value="">Seleziona un portiere…</option>
                ${sortedGks.map(g => `<option value="${escapeAttr(g.id)}" ${st.goalkeeperId === g.id ? "selected" : ""}>${escapeHtml(this._gkFullName(g))}</option>`).join("")}
              </select>
            </div>
            <div class="filter-field"><span class="field-label">Stagione</span><select class="input" id="rpt-season">${this._seasonSelectOptions(st.seasonId)}</select></div>
            ${this._dateRangeHtml("rpt-from", "rpt-to", st.from, st.to, "Periodo")}
          </div>
          <div class="filters-foot">
            <span class="filters-count">${canGenerate ? "" : "Seleziona un portiere per generare il report."}</span>
            <button type="button" class="btn btn-primary" id="rpt-generate">Genera report</button>
          </div>
        </div>

        <div id="rpt-result">${st.result ? this._reportResultHtml(st.result) : this._empty("Seleziona un portiere, poi genera il report. Stagione e Periodo sono opzionali: se lasciati su \"Tutte le stagioni\"/vuoti, il report copre l'intero storico.")}</div>
      </section>`;

    this.main.querySelector("#rpt-gk").addEventListener("change", (e) => { st.goalkeeperId = e.target.value; });
    this.main.querySelector("#rpt-season").addEventListener("change", (e) => { st.seasonId = e.target.value; });
    this.main.querySelector("#rpt-from").addEventListener("change", (e) => { st.from = e.target.value; });
    this.main.querySelector("#rpt-to").addEventListener("change", (e) => { st.to = e.target.value; });
    this.main.querySelector("#rpt-generate").addEventListener("click", async () => {
      const gkId = this.main.querySelector("#rpt-gk").value;
      if (!gkId) { this.toast("Seleziona un portiere.", "error"); return; }
      st.goalkeeperId = gkId;
      st.result = await this._computeReport();
      const resWrap = this.main.querySelector("#rpt-result");
      if (resWrap) resWrap.innerHTML = st.result ? this._reportResultHtml(st.result) : this._empty("Nessun dato disponibile per questo portiere nel periodo selezionato.");
      this._wireReportResult();
    });
    this._wireReportResult();
  }

  _reportResultHtml(r) {
    if (!r.totalExpected && !r.sessionCount) {
      return this._empty("Nessun dato disponibile per questo portiere nel periodo selezionato.");
    }
    return `
      <div class="card-soft rpt-header">
        <div>
          <h3>${escapeHtml(this._gkFullName(r.gk))}</h3>
          <p class="muted">${escapeHtml(r.periodLabel)} · Generato il ${escapeHtml(this._fmtDate(toISODate(r.generatedAt)))}</p>
        </div>
        <div class="head-actions no-print"><button type="button" class="btn btn-soft" id="rpt-print">Esporta PDF</button></div>
      </div>

      <div class="card-soft rpt-block">
        <h3 class="section-h">Riepilogo presenze</h3>
        ${r.totalExpected ? `
          <div class="rpt-pct-hero">
            <span class="rpt-pct-num">${r.pct}%</span>
            <span class="rpt-pct-lbl">presenze sul periodo</span>
          </div>
          <div class="att-summary-row">
            <span class="att-summary-item">Presenti: <strong>${r.present}</strong></span>
            <span class="att-summary-item">Assenti: <strong>${r.absent}</strong></span>
            <span class="att-summary-item">Giustificati: <strong>${r.excused}</strong></span>
            <span class="att-summary-item">Da registrare: <strong>${r.pending}</strong></span>
          </div>
          ${r.typeBreakdown.length ? `<div class="rpt-type-breakdown">${r.typeBreakdown.map(t => `
            <div class="rpt-type-row">
              <span class="ge-pill ge-${escapeAttr(t.type)}">${escapeHtml(t.label)}</span>
              <span class="rpt-bar-track"><span class="rpt-bar-fill" style="width:${t.pct}%"></span></span>
              <span class="rpt-type-pct">${t.pct}%</span>
            </div>`).join("")}</div>` : ""}
        ` : `<p class="muted small">Nessun impegno atteso nel periodo selezionato.</p>`}
      </div>

      <div class="card-soft rpt-block">
        <h3 class="section-h">Andamento temporale</h3>
        ${r.buckets.length ? this._reportChartSvg(r.buckets, r.monthly) : `<p class="muted small">Dati insufficienti per un grafico.</p>`}
      </div>

      <div class="card-soft rpt-block">
        <h3 class="section-h">Sedute ed esercizi</h3>
        <p>Sedute effettuate nel periodo: <strong>${r.sessionCount}</strong></p>
        ${r.topExercises.length ? `<ul class="gk-exlist">${r.topExercises.map(e => {
          const mostRecent = e.occurrences[0];
          const dt = mostRecent ? parseDateISO(mostRecent.date) : null;
          return `<li class="gk-exrow rpt-ex-row">
            <span class="rpt-ex-title">${escapeHtml(e.exercise.title)}</span>
            ${e.occurrences.length > 1 ? `<span class="chip chip-sm">× ${e.occurrences.length} volte</span>` : ""}
            <span class="muted small">${dt ? escapeHtml(this._fmtDayLong(dt)) : "—"}</span>
          </li>`;
        }).join("")}</ul>` : `<p class="muted small">Nessun esercizio effettuato nel periodo.</p>`}
        <button type="button" class="link-btn no-print" id="rpt-see-all">Vedi elenco completo nella scheda portiere →</button>
      </div>

      <div class="card-soft rpt-block">
        <h3 class="section-h">Qualità allenate e periodi di allenamento</h3>
        ${r.topQualities.length ? `<div class="chips">${r.topQualities.map(q => `<span class="chip">${escapeHtml(q.name)} <span class="rpt-chip-count">${q.count}</span></span>`).join("")}</div>` : `<p class="muted small">Nessuna qualità allenata registrata nel periodo.</p>`}
        ${r.periods.length ? `<div class="chips rpt-periods">${r.periods.map(p => `<span class="chip chip-out">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      </div>`;
  }

  _wireReportResult() {
    const printBtn = this.main.querySelector("#rpt-print");
    if (printBtn) printBtn.addEventListener("click", () => window.print());
    const seeAllBtn = this.main.querySelector("#rpt-see-all");
    if (seeAllBtn) seeAllBtn.addEventListener("click", () => {
      const r = this.reportState.result;
      if (!r) return;
      this._pendingGkAccordionOpen = { goalkeeperId: r.gk.id, key: "esercizi", from: r.from, to: r.to };
      this.setRoute("gk-dettaglio", r.gk.id);
    });
  }

  // Grafico andamento presenze (SVG nativo, nessuna dipendenza esterna: si stampa correttamente
  // come qualunque altro contenuto vettoriale, senza bisogno di conversioni canvas→immagine).
  _reportChartSvg(buckets, monthly) {
    const W = 760, H = 220, padL = 38, padR = 14, padT = 18, padB = 32;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = buckets.length;
    const gap = plotW / n;
    const barW = Math.max(10, Math.min(46, gap * 0.55));
    const yFor = (pct) => padT + plotH - (pct / 100) * plotH;
    const grid = [0, 50, 100].map(p => `
      <line x1="${padL}" y1="${yFor(p).toFixed(1)}" x2="${W - padR}" y2="${yFor(p).toFixed(1)}" stroke="var(--line-soft)" stroke-width="1"/>
      <text x="${padL - 8}" y="${(yFor(p) + 3).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--ink-3)">${p}%</text>`).join("");
    const bars = buckets.map((b, i) => {
      const cx = padL + gap * i + gap / 2;
      const pct = b.total ? Math.round((b.present / b.total) * 100) : 0;
      const y = yFor(pct);
      const label = monthly ? this._reportMonthLabel(b.key) : this._reportWeekLabel(b.key);
      return `<g>
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(padT + plotH - y).toFixed(1)}" rx="4" fill="var(--pitch)">
          <title>${escapeHtml(label)}: ${b.present}/${b.total} (${pct}%)</title>
        </rect>
        <text x="${cx.toFixed(1)}" y="${Math.max(padT + 9, y - 6).toFixed(1)}" font-size="11" font-weight="700" text-anchor="middle" fill="var(--ink-2)">${pct}%</text>
        <text x="${cx.toFixed(1)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="var(--ink-3)">${escapeHtml(label)}</text>
      </g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="rpt-chart-svg" role="img" aria-label="Andamento presenze nel periodo">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1"/>
      ${grid}
      ${bars}
    </svg>`;
  }

  // ---------- Impostazioni + import/export ----------
  async renderImpostazioni() {
    this.main.innerHTML = `
      <section class="view">
        <div class="view-head"><div><h2>Impostazioni</h2><p class="muted">Account, liste configurabili e backup</p></div></div>

        <div class="card-soft app-mode-card">
          <h3>Modalità app</h3>
          <p class="muted">In modalità <b>Semplice</b> restano nascoste le sezioni Presenze e Report e il
            dettaglio tempi negli esercizi (serie/ripetizioni/recupero) — pensata per l'uso quotidiano.
            In modalità <b>Completa</b> torna tutto visibile. Nessun dato viene mai eliminato passando
            da una modalità all'altra.</p>
          <div class="seg app-mode-seg" id="app-mode-seg">
            <button type="button" class="seg-btn ${this.profile.appMode !== "completa" ? "is-on" : ""}" data-appmode="semplice">Semplice</button>
            <button type="button" class="seg-btn ${this.profile.appMode === "completa" ? "is-on" : ""}" data-appmode="completa">Completa</button>
          </div>
        </div>

        <div class="card-soft account-sync">
          <h3>Account e sincronizzazione</h3>
          <div id="account-sync-mount"></div>
        </div>

        <div class="card-soft backup">
          <h3>Backup e interoperabilità</h3>
          <p class="muted">L'export JSON è il sistema di backup ed è bidirezionale con l'artefatto Claude (schema v2.2).</p>
          <div class="backup-actions">
            <button type="button" class="btn btn-primary" id="b-export">Esporta tutto (.json)</button>
            <label class="upload inline">
              <input type="file" id="b-import" accept="application/json,.json" hidden>
              <span class="btn btn-soft">Importa da file…</span>
            </label>
          </div>
          <hr class="backup-sep">
          <p class="muted">Solo le liste configurabili (gesti, qualità, periodi, materiali, frecce), senza esercizi.</p>
          <div class="backup-actions">
            <button type="button" class="btn btn-soft" id="b-export-cfg">Esporta configurazione</button>
            <label class="upload inline">
              <input type="file" id="b-import-cfg" accept="application/json,.json" hidden>
              <span class="btn btn-soft">Importa configurazione…</span>
            </label>
          </div>
        </div>

        <h3 class="section-h">Liste configurabili</h3>
        <div id="settings-mount"></div>
      </section>
    `;

    this.main.querySelectorAll("[data-appmode]").forEach(b => b.addEventListener("click", async () => {
      const mode = b.dataset.appmode;
      if (this.profile.appMode === mode) return;
      this.profile.appMode = mode;
      this.profile.updatedAt = new Date().toISOString();
      await storage.saveProfile(this.profile);
      this.toast(mode === "semplice" ? "Modalità semplice attivata." : "Modalità completa attivata.");
      // Rigenera la barra di navigazione (le voci disponibili dipendono dalla modalità)
      // e riapre Impostazioni, esattamente come al boot.
      this._buildShell();
      this.setRoute("impostazioni");
    }));

    this._renderAccountSync();
    // Tiene la sezione Account aggiornata mentre Impostazioni resta aperta (stato di sync,
    // login/logout da un'altra scheda...); smontato al cambio di vista (vedi setRoute).
    this._accountSyncUnsub.push(onSyncStateChange(() => this._renderAccountSync()));
    this._accountSyncUnsub.push(onAuthChange(() => this._renderAccountSync()));

    const panel = new SettingsPanel(this.main.querySelector("#settings-mount"), {
      storage,
      onChange: (lists) => {
        // Gli SVG salvati restano immutati: i simboli si risolvono a runtime in fase di
        // visualizzazione (composeExerciseSvg). Qui basta aggiornare le liste in memoria.
        this.customLists = lists;
        if (this.editor) this.editor.refreshMaterials();
      },
      // Dopo la propagazione di una rinomina, ricarica in memoria i record toccati
      // così Esercizi e Portieri mostrano subito i nuovi nomi.
      onRecordsChanged: async () => {
        this.exercises = await storage.getAllExercises();
        this.goalkeepers = await storage.getAllGoalkeepers();
      },
      notify: (msg, type) => this.toast(msg, type)
    });
    await panel.init();

    this.main.querySelector("#b-export").addEventListener("click", () => {
      const items = [...this.exercises, ...this.sessions, ...this.goalkeepers, ...this.seasons, ...this.events, ...this.attendances, ...this.genericEvents, ...this.specificEvents];
      const json = exportToJsonString(items, this.customLists, this.profile);
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(`backup-portieri-${stamp}.json`, json);
      this.toast("Backup esportato.");
    });

    this.main.querySelector("#b-import").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const res = parseImport(text, this.customLists);
        if (!res.ok) { this.toast(res.error, "error"); return; }
        // Flag interno "importato": vero solo per id non già presenti in locale.
        // Gli id già esistenti mantengono il loro stato (non li "declassiamo").
        const existingIds = new Set(this.exercises.map(x => x.id));
        const incoming = res.exercises.map(ex => {
          if (existingIds.has(ex.id)) {
            const prev = this.exercises.find(x => x.id === ex.id);
            return { ...ex, importato: prev?.importato === true };
          }
          return { ...ex, importato: true };
        });
        this._promptImportBackup({ ...res, exercises: incoming });
      } catch (err) {
        this.toast("Import non riuscito: " + (err.message || "errore sconosciuto"), "error");
      }
    });

    this.main.querySelector("#b-export-cfg").addEventListener("click", () => {
      const json = JSON.stringify(buildConfigExport(this.customLists), null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(`configurazione_${stamp}.json`, json);
      this.toast("Configurazione esportata.");
    });

    this.main.querySelector("#b-import-cfg").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const res = parseConfigImport(text);
        if (!res.ok) { this.toast(res.error, "error"); return; }
        this._promptImportConfig(res.customLists);
      } catch (err) {
        this.toast("Import non riuscito: " + (err.message || "errore sconosciuto"), "error");
      }
    });
  }

  // ---------- Account e sincronizzazione cloud ----------
  // Facoltativa: senza account collegato questa sezione mostra solo l'invito a collegarsi,
  // il resto dell'app resta identico a prima (solo IndexedDB locale). Stato letto da
  // data/auth.js (utente) e data/sync.js (stato del motore di sync): questo metodo non tocca
  // mai Supabase direttamente.
  _renderAccountSync() {
    const mount = this.main.querySelector("#account-sync-mount");
    if (!mount) return;
    const user = getCurrentUser();
    const draft = this._accountDraft || (this._accountDraft = { email: "", password: "", busy: false, error: null });

    let html;
    if (!user) {
      html = `
        <p class="muted small">Collega un account per sincronizzare esercizi, sedute, portieri, stagioni, presenze e liste configurabili tra i tuoi dispositivi. È facoltativo: senza account l'app funziona esattamente come prima, solo su questo dispositivo.</p>
        <div class="form-grid">
          <label>Email<input type="email" id="acc-email" class="input" value="${escapeAttr(draft.email)}" autocomplete="email"></label>
          <label>Password<input type="password" id="acc-pass" class="input" value="${escapeAttr(draft.password)}" autocomplete="current-password"></label>
        </div>
        ${draft.error ? `<p class="lock-err" role="alert">${escapeHtml(draft.error)}</p>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="acc-signin" ${draft.busy ? "disabled" : ""}>Accedi</button>
          <button type="button" class="btn btn-soft" id="acc-signup" ${draft.busy ? "disabled" : ""}>Crea account</button>
        </div>`;
    } else if (syncState.status === "da_collegare") {
      html = `
        <p class="muted small">Collegato come <b>${escapeHtml(user.email)}</b>, ma questo dispositivo non ha ancora deciso come comportarsi con i dati cloud. Scegli un'opzione:</p>
        <div class="form-actions account-link-choice">
          <button type="button" class="btn btn-primary" id="acc-link-push">Carica i dati di questo dispositivo sul cloud</button>
          <button type="button" class="btn btn-soft" id="acc-link-pull">Scarica i dati già presenti sul cloud</button>
        </div>
        <p class="muted small">Prima opzione: usala se questo è il <b>primo</b> dispositivo che colleghi (i dati locali diventano quelli di riferimento sul cloud). Seconda opzione: usala se hai già collegato un <b>altro</b> dispositivo in precedenza (i dati arrivano da lì).</p>
        <div class="form-actions"><button type="button" class="btn btn-ghost" id="acc-signout">Disconnetti account</button></div>`;
    } else {
      const statusLabel = { offline: "Offline", disconnesso: "Cloud non collegato", syncing: "Sincronizzazione in corso…", idle: "Sincronizzato", error: "Errore di sincronizzazione" }[syncState.status] || syncState.status;
      const lastSync = syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString("it-IT") : "mai";
      html = `
        <p class="muted small">Collegato come <b>${escapeHtml(user.email)}</b>.</p>
        <ul class="cfg-preview">
          <li><b>Stato</b>: ${escapeHtml(statusLabel)}</li>
          <li><b>Ultima sincronizzazione</b>: ${escapeHtml(lastSync)}</li>
          <li><b>Modifiche in attesa di invio</b>: ${syncState.pendingCount}</li>
          ${syncState.lastError ? `<li><b>Ultimo errore</b>: ${escapeHtml(syncState.lastError)}</li>` : ""}
        </ul>
        <div class="form-actions"><button type="button" class="btn btn-ghost" id="acc-signout">Disconnetti account</button></div>
        <p class="muted small">Disconnettersi non elimina alcun dato locale né cloud: smette solo di sincronizzare da questo dispositivo, finché non accedi di nuovo.</p>`;
    }
    mount.innerHTML = html;

    const emailEl = mount.querySelector("#acc-email");
    const passEl = mount.querySelector("#acc-pass");
    if (emailEl) emailEl.addEventListener("input", () => { draft.email = emailEl.value; });
    if (passEl) passEl.addEventListener("input", () => { draft.password = passEl.value; });

    const runAuth = async (fn) => {
      draft.error = null; draft.busy = true; this._renderAccountSync();
      try { await fn(draft.email.trim(), draft.password); }
      catch (err) { draft.error = err.message || "Operazione non riuscita."; }
      finally { draft.busy = false; this._renderAccountSync(); }
    };
    const signinBtn = mount.querySelector("#acc-signin");
    if (signinBtn) signinBtn.addEventListener("click", () => runAuth((email, pass) => signIn(email, pass)));
    const signupBtn = mount.querySelector("#acc-signup");
    if (signupBtn) signupBtn.addEventListener("click", () => runAuth(async (email, pass) => {
      await signUp(email, pass);
      this.toast("Account creato. Se richiesto, controlla la mail per confermarlo, poi accedi.");
    }));

    const pushBtn = mount.querySelector("#acc-link-push");
    if (pushBtn) pushBtn.addEventListener("click", async () => {
      if (!confirm("Tutti i dati presenti su questo dispositivo verranno caricati sul cloud. Continuare?")) return;
      pushBtn.disabled = true;
      try { await linkPushingLocalData(); this.toast("Dispositivo collegato: invio dei dati locali al cloud in corso."); }
      catch (err) { this.toast("Collegamento non riuscito: " + (err.message || "errore"), "error"); }
      this._renderAccountSync();
    });
    const pullBtn = mount.querySelector("#acc-link-pull");
    if (pullBtn) pullBtn.addEventListener("click", async () => {
      if (!confirm("I dati già presenti sul cloud verranno scaricati su questo dispositivo (uniti a quelli locali in base a quale versione di ciascun elemento è più recente). Continuare?")) return;
      pullBtn.disabled = true;
      try { await linkPullingFromCloud(); this.toast("Dispositivo collegato: ricezione dei dati dal cloud in corso."); }
      catch (err) { this.toast("Collegamento non riuscito: " + (err.message || "errore"), "error"); }
      this._renderAccountSync();
    });

    const signoutBtn = mount.querySelector("#acc-signout");
    if (signoutBtn) signoutBtn.addEventListener("click", async () => {
      if (!confirm("Disconnettere questo dispositivo dall'account cloud?")) return;
      await signOut();
      this._renderAccountSync();
    });
  }

  // ---------- util ----------
  // ---------- Profilo (sezione locale) ----------
  _profileLogoPreview() {
    return this._profileDraft && this._profileDraft.logo
      ? `<img src="${escapeAttr(this._profileDraft.logo)}" alt="Anteprima logo">`
      : `<span class="profile-logo-empty" aria-hidden="true">${NAV_ICONS.profilo}</span>`;
  }
  renderProfilo() {
    const p = this.profile;
    const lock = p.appLock || { enabled: false, pinHash: null, lockOnStart: false };
    this._profileDraft = { clubs: [...(p.clubs || [])], logo: p.logo || null };
    this.main.innerHTML = `
      <section class="view profile-view">
        <div class="view-head"><div><h2>Profilo</h2><p class="muted">Dati locali dell'utilizzatore di questo dispositivo.</p></div></div>

        <div class="card-soft profile-card">
          <div class="profile-logo-row">
            <div class="profile-logo-prev" id="pf-logo-prev">${this._profileLogoPreview()}</div>
            <div class="profile-logo-actions">
              <label class="btn btn-soft">Carica logo<input type="file" id="pf-logo" accept="image/*" hidden></label>
              <button type="button" class="btn btn-ghost" id="pf-logo-del" ${this._profileDraft.logo ? "" : "disabled"}>Rimuovi</button>
              <p class="muted small">Mostrato nella barra in ogni sezione (32–40px).</p>
            </div>
          </div>
          <div class="form-grid">
            <label>Nome<input type="text" id="pf-first" class="input" value="${escapeAttr(p.firstName || "")}"></label>
            <label>Cognome<input type="text" id="pf-last" class="input" value="${escapeAttr(p.lastName || "")}"></label>
            <label class="form-wide">Ruolo<input type="text" id="pf-role" class="input" placeholder="es. Preparatore Portieri UEFA B" value="${escapeAttr(p.role || "")}"></label>
            <div class="form-wide"><span class="field-label">Squadra/e</span><div class="club-input" id="pf-clubs"></div></div>
            <label>Email (opzionale)<input type="email" id="pf-email" class="input" value="${escapeAttr(p.contactEmail || "")}"></label>
            <label>Telefono (opzionale)<input type="tel" id="pf-phone" class="input" value="${escapeAttr(p.contactPhone || "")}"></label>
          </div>
          <div class="form-actions"><button type="button" class="btn btn-primary" id="pf-save">Salva profilo</button></div>
        </div>

        <div class="card-soft profile-lock">
          <h3 class="section-h">Blocco app</h3>
          <label class="switch-row"><input type="checkbox" id="pf-lock-en" ${lock.enabled ? "checked" : ""}> <span>Attiva blocco con PIN</span></label>
          <div id="pf-lock-fields" class="${lock.enabled ? "" : "is-hidden"}">
            <div class="form-grid">
              <label>PIN (4–6 cifre)<input type="password" id="pf-pin" class="input" inputmode="numeric" maxlength="6" placeholder="${lock.pinHash ? "•••• (lascia vuoto per non cambiarlo)" : ""}"></label>
              <label>Conferma PIN<input type="password" id="pf-pin2" class="input" inputmode="numeric" maxlength="6"></label>
            </div>
            <label class="switch-row"><input type="checkbox" id="pf-lock-start" ${lock.lockOnStart ? "checked" : ""}> <span>Richiedi PIN all'avvio dell'app</span></label>
          </div>
          <p class="muted small lock-note">Il PIN protegge da accessi casuali su questo dispositivo. Non è una protezione crittografica: chiunque abbia accesso ai file dell'app può comunque visualizzare i dati.</p>
          <div class="form-actions"><button type="button" class="btn btn-primary" id="pf-lock-save">Salva impostazioni blocco</button></div>
        </div>

        <div class="card-soft">
          <h3 class="section-h">Backup del profilo</h3>
          <p class="muted small">Esporta o importa solo il profilo. Il logo è incluso; il PIN/blocco non viene mai esportato.</p>
          <div class="form-actions">
            <button type="button" class="btn btn-soft" id="pf-export">Esporta profilo</button>
            <label class="btn btn-soft">Importa profilo<input type="file" id="pf-import" accept="application/json,.json" hidden></label>
          </div>
        </div>
      </section>`;

    this._wireClubsInput();
    // logo upload / rimozione
    this.main.querySelector("#pf-logo").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try {
        this._profileDraft.logo = await resizeImageFile(f, { maxSize: 400, quality: 0.85 });
        this.main.querySelector("#pf-logo-prev").innerHTML = this._profileLogoPreview();
        this.main.querySelector("#pf-logo-del").disabled = false;
      } catch (_) { this.toast("Immagine non leggibile.", "error"); }
    });
    this.main.querySelector("#pf-logo-del").addEventListener("click", () => {
      this._profileDraft.logo = null;
      this.main.querySelector("#pf-logo-prev").innerHTML = this._profileLogoPreview();
      this.main.querySelector("#pf-logo-del").disabled = true;
    });
    this.main.querySelector("#pf-save").addEventListener("click", () => this._saveProfile());

    // blocco app
    const lockEn = this.main.querySelector("#pf-lock-en");
    lockEn.addEventListener("change", () => {
      this.main.querySelector("#pf-lock-fields").classList.toggle("is-hidden", !lockEn.checked);
    });
    this.main.querySelector("#pf-lock-save").addEventListener("click", () => this._saveLock());

    // backup profilo
    this.main.querySelector("#pf-export").addEventListener("click", () => {
      const json = JSON.stringify(buildProfileExport(this.profile), null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(`profilo_${stamp}.json`, json);
      this.toast("Profilo esportato (PIN escluso).");
    });
    this.main.querySelector("#pf-import").addEventListener("change", async (e) => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      try {
        const res = parseProfileImport(await readFileAsText(file));
        if (!res.ok) { this.toast(res.error, "error"); return; }
        this._applyImportedProfile(res.profile);
        this.toast("Profilo importato. Il blocco PIN resta quello locale.");
        this.renderProfilo();
      } catch (err) {
        this.toast("Import non riuscito: " + (err.message || "errore"), "error");
      }
    });
  }

  // Tag input testo libero per le squadre (virgola o Invio per aggiungere).
  _wireClubsInput() {
    const wrap = this.main.querySelector("#pf-clubs");
    const add = (val) => {
      String(val).split(",").map(s => s.trim()).filter(Boolean).forEach(c => {
        if (!this._profileDraft.clubs.includes(c)) this._profileDraft.clubs.push(c);
      });
      render(); const f = wrap.querySelector("#pf-club-field"); if (f) { f.value = ""; f.focus(); }
    };
    const render = () => {
      wrap.innerHTML = this._profileDraft.clubs.map((c, i) =>
        `<span class="club-chip">${escapeHtml(c)}<button type="button" data-ci="${i}" aria-label="Rimuovi">×</button></span>`).join("")
        + `<input type="text" class="club-field" id="pf-club-field" placeholder="Aggiungi squadra…">`;
      const field = wrap.querySelector("#pf-club-field");
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(field.value); }
        else if (e.key === "Backspace" && !field.value && this._profileDraft.clubs.length) { this._profileDraft.clubs.pop(); render(); wrap.querySelector("#pf-club-field").focus(); }
      });
      field.addEventListener("blur", () => { if (field.value.trim()) add(field.value); });
      wrap.querySelectorAll("[data-ci]").forEach(b => b.addEventListener("click", () => { this._profileDraft.clubs.splice(+b.dataset.ci, 1); render(); }));
    };
    render();
  }

  async _saveProfile() {
    const p = this.profile;
    p.firstName = this.main.querySelector("#pf-first").value.trim();
    p.lastName = this.main.querySelector("#pf-last").value.trim();
    p.role = this.main.querySelector("#pf-role").value.trim() || null;
    p.clubs = [...this._profileDraft.clubs];
    p.logo = this._profileDraft.logo || null;
    p.contactEmail = this.main.querySelector("#pf-email").value.trim() || null;
    p.contactPhone = this.main.querySelector("#pf-phone").value.trim() || null;
    p.updatedAt = new Date().toISOString();
    await storage.saveProfile(p);
    this._refreshLogoBadge();
    this.toast("Profilo salvato.");
  }

  // appLock è un DETERRENTE LOCALE, non autenticazione: il pinHash non lascia mai il dispositivo.
  async _saveLock() {
    const enabled = this.main.querySelector("#pf-lock-en").checked;
    const lockOnStart = this.main.querySelector("#pf-lock-start").checked;
    const pin = this.main.querySelector("#pf-pin").value.trim();
    const pin2 = this.main.querySelector("#pf-pin2").value.trim();
    const lock = this.profile.appLock || { enabled: false, pinHash: null, lockOnStart: false };
    if (enabled) {
      const needNewPin = pin.length > 0 || !lock.pinHash;
      if (needNewPin) {
        if (!/^\d{4,6}$/.test(pin)) { this.toast("Il PIN deve avere 4–6 cifre.", "error"); return; }
        if (pin !== pin2) { this.toast("I due PIN non coincidono.", "error"); return; }
        lock.pinHash = await this._sha256(pin);
      }
      lock.enabled = true;
      lock.lockOnStart = lockOnStart;
    } else {
      lock.enabled = false;
      lock.lockOnStart = false;
      lock.pinHash = null;   // disattivando, rimuoviamo l'hash
    }
    this.profile.appLock = lock;
    this.profile.updatedAt = new Date().toISOString();
    await storage.saveProfile(this.profile);
    this.toast("Impostazioni di blocco salvate.");
    this.renderProfilo();
  }

  // Applica un profilo importato MANTENENDO il blocco locale (appLock/pinHash non si importano).
  _applyImportedProfile(incoming) {
    const localLock = this.profile.appLock;
    const localId = this.profile.id, localCreated = this.profile.createdAt;
    this.profile = {
      ...this.profile,
      firstName: incoming.firstName, lastName: incoming.lastName, role: incoming.role,
      clubs: incoming.clubs, logo: incoming.logo,
      contactEmail: incoming.contactEmail, contactPhone: incoming.contactPhone,
      id: localId, createdAt: localCreated,
      appLock: localLock,   // blocco invariato, sempre locale
      updatedAt: new Date().toISOString()
    };
    return storage.saveProfile(this.profile).then(() => this._refreshLogoBadge());
  }

  // Schermata di blocco mostrata PRIMA di qualsiasi contenuto. Deterrente locale, non sicurezza vera.
  _renderLockScreen(onUnlock) {
    this.root.innerHTML = `
      <div class="lock-screen">
        <div class="lock-box">
          <span class="lock-ico" aria-hidden="true">${NAV_ICONS.profilo}</span>
          <h2>App bloccata</h2>
          <p class="muted">Inserisci il PIN per accedere a questo dispositivo.</p>
          <input type="password" id="lock-pin" class="input" inputmode="numeric" maxlength="6" autocomplete="off">
          <p class="lock-err" id="lock-err" hidden>PIN errato.</p>
          <button type="button" class="btn btn-primary" id="lock-go">Sblocca</button>
          <p class="lock-forgot-hint">Hai dimenticato il PIN? Solo chi conosce già questo dispositivo può
            disattivare il blocco: apri l'indirizzo dell'app aggiungendo <code>?resetlock=true</code>
            alla fine (es. <code>…/index.html?resetlock=true</code>) e ricarica la pagina.</p>
        </div>
      </div>`;
    const input = this.root.querySelector("#lock-pin");
    const err = this.root.querySelector("#lock-err");
    const tryUnlock = async () => {
      const h = await this._sha256(input.value.trim());
      if (h === (this.profile.appLock && this.profile.appLock.pinHash)) onUnlock();
      else { err.hidden = false; input.value = ""; input.focus(); }
    };
    this.root.querySelector("#lock-go").addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
    setTimeout(() => input.focus(), 30);
  }

  _empty(msg) { return `<div class="empty">${escapeHtml(msg)}</div>`; }

  toast(message, type = "ok") {
    const stack = this.root.querySelector("#toast-stack");
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 3200);
  }
}

// ---------- helpers di modulo ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, "&#96;"); }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function genId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}
function slugFile(s) {
  return String(s || "esercizio").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "file";
}
// Sanitizzazione minima: gli SVG provengono dall'editor interno o da import controllato dall'utente.
// Match multi-selezione con logica AND/OR (default OR). Nessuna voce selezionata = nessun filtro.
function matchMulti(arr, wanted, mode) {
  if (!wanted || !wanted.length) return true;
  const a = arr || [];
  return mode === "and" ? wanted.every(w => a.includes(w)) : wanted.some(w => a.includes(w));
}

function safeSvg(svg) {
  return String(svg).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+\s*=\s*"[^"]*"/gi, "");
}
// Placeholder grafico per esercizi senza schema (motivo porta + area, coerente col tema).
function noSchemaPlaceholder() {
  return `<div class="ex-noimg">
    <svg viewBox="0 0 120 90" class="ex-noimg-art" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <rect x="34" y="12" width="52" height="18" rx="1"/>
        <path d="M40 12v18M48 12v18M56 12v18M64 12v18M72 12v18M80 12v18M34 18h52M34 24h52" stroke-width="1"/>
        <rect x="14" y="30" width="92" height="52" rx="2"/>
        <path d="M44 30v22h32V30" />
        <circle cx="60" cy="44" r="1.6" fill="currentColor" stroke="none"/>
      </g>
    </svg>
    <span>Nessuno schema</span>
  </div>`;
}
function buildVideoHref(l) {
  const url = l.url || "#";
  const start = l.timeRange?.start;
  if (start != null && /youtu\.?be/i.test(url)) {
    return url + (url.includes("?") ? "&" : "?") + "t=" + Math.max(0, Math.floor(start));
  }
  return url;
}
