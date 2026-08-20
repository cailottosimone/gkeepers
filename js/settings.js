// settings.js
// Impostazioni: liste personalizzate (materiali, gesti, qualità) e
// dizionario step (termini + gruppi di alternative). Materiali/gesti/qualità
// sono referenziati per key dagli esercizi (nessun testo duplicato: il
// rename è "gratis", si vede subito ovunque) — diverso dai Termini dello
// step, che sono denormalizzati apposta (label copiata sullo step) e quindi
// richiedono propagazione esplicita quando si rinominano o uniscono.

import * as storage from './storage.js';
import * as dizionario from './dizionario.js';
import { escapeHtml } from './dom-utils.js';
import * as sync from './data/sync.js';

const LIST_LABELS = {
  materiali: ['Materiali', 'fa-box'],
  gesti: ['Gesti', 'fa-hand'],
  qualita: ['Qualità', 'fa-bolt'],
  categorie: ['Categorie', 'fa-layer-group'],
};

// Dove/come ogni lista è referenziata altrove — usato per calcolare quante
// volte una voce è in uso e per ripulire i riferimenti quando viene
// eliminata. "objects": array di {key,...} (materiali con quantità).
// "array": array di key (tag). "scalar": un solo valore (categoria del
// portiere).
const LIST_USAGE = {
  materiali: { store: 'esercizi', field: 'materiali', type: 'objects' },
  gesti: { store: 'esercizi', field: 'tag', type: 'array' },
  qualita: { store: 'esercizi', field: 'tag', type: 'array' },
  categorie: { store: 'portieri', field: 'categoriaKey', type: 'scalar' },
};

async function contaUsoVoceLista(listId, key) {
  const usage = LIST_USAGE[listId];
  const items = await storage.getAll(usage.store);
  let count = 0;
  for (const it of items) {
    if (usage.type === 'objects') { if ((it[usage.field] || []).some((m) => m.key === key)) count++; }
    else if (usage.type === 'array') { if ((it[usage.field] || []).includes(key)) count++; }
    else if (usage.type === 'scalar') { if (it[usage.field] === key) count++; }
  }
  return count;
}

async function eliminaVoceLista(listId, key) {
  const list = await storage.get('customLists', listId);
  if (!list) return;
  await storage.put('customLists', { ...list, items: list.items.filter((i) => i.key !== key), updatedAt: storage.now() });
  const usage = LIST_USAGE[listId];
  const items = await storage.getAll(usage.store);
  for (const it of items) {
    let changed = false;
    let value;
    if (usage.type === 'objects') {
      const filtered = (it[usage.field] || []).filter((m) => m.key !== key);
      changed = filtered.length !== (it[usage.field] || []).length;
      value = filtered;
    } else if (usage.type === 'array') {
      const filtered = (it[usage.field] || []).filter((t) => t !== key);
      changed = filtered.length !== (it[usage.field] || []).length;
      value = filtered;
    } else if (usage.type === 'scalar') {
      if (it[usage.field] === key) { changed = true; value = ''; }
    }
    if (changed) await storage.put(usage.store, { ...it, [usage.field]: value, updatedAt: storage.now() });
  }
}

async function aggiungiVoceLista(listId, label) {
  const list = await storage.get('customLists', listId);
  const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + storage.uid().slice(0, 4);
  const items = [...(list?.items || []), { key, label: label.trim(), isDefault: false }];
  await storage.put('customLists', { id: listId, items, updatedAt: storage.now() });
}

async function rinominaVoceLista(listId, key, nuovaLabel) {
  const list = await storage.get('customLists', listId);
  if (!list) return;
  const items = list.items.map((i) => (i.key === key ? { ...i, label: nuovaLabel.trim() } : i));
  await storage.put('customLists', { ...list, items, updatedAt: storage.now() });
}

export function render(container) {
  let tab = 'liste'; // liste | dizionario | backup | sync
  let selectedTermini = [];
  let openListe = null; // quale categoria (materiali/gesti/qualita) è espansa, nessuna di default
  let importPreview = null; // backup letto in attesa di conferma
  let syncBusy = false;
  let syncLastResult = null;

  async function draw() {
    container.innerHTML = `
      <div class="gk-section-head"><h2>Impostazioni</h2></div>
      <div class="gk-tabs">
        <button class="gk-tab ${tab === 'liste' ? 'active' : ''}" data-action="tab" data-tab="liste"><i class="fa-solid fa-list"></i> Liste personalizzate</button>
        <button class="gk-tab ${tab === 'dizionario' ? 'active' : ''}" data-action="tab" data-tab="dizionario"><i class="fa-solid fa-book"></i> Dizionario step</button>
        <button class="gk-tab ${tab === 'backup' ? 'active' : ''}" data-action="tab" data-tab="backup"><i class="fa-solid fa-box-archive"></i> Backup</button>
        <button class="gk-tab ${tab === 'sync' ? 'active' : ''}" data-action="tab" data-tab="sync"><i class="fa-solid fa-cloud-arrow-up"></i> Sincronizzazione</button>
      </div>
      <div id="gk-settings-body"></div>
    `;
    if (tab === 'liste') await drawListe();
    else if (tab === 'dizionario') await drawDizionario();
    else if (tab === 'backup') await drawBackup();
    else await drawSync();
  }

  async function drawSync() {
    const body = document.getElementById('gk-settings-body');
    const enabled = await sync.isSyncEnabled();
    const { lastSyncAt, lastSyncError } = await sync.lastSyncInfo();
    body.innerHTML = `
      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-cloud"></i>Sincronizzazione cloud</div>
        <div class="gk-hint" style="margin-bottom:10px">
          Nessun account: si collega a uno spazio dati condiviso (stesso principio delle altre app).
          Vince sempre il dato più recente tra locale e cloud, dispositivo per dispositivo — su un
          dispositivo nuovo, senza dati locali con cui competere, è il cloud a vincere sempre: è così
          che un dispositivo nuovo si allinea a quello che c'è già salvato.
        </div>
        <label class="gk-checkbox-row" style="margin-bottom:10px">
          <input type="checkbox" id="f-sync-enabled" ${enabled ? 'checked' : ''} />
          Attiva sincronizzazione cloud
        </label>
        ${enabled ? `
          <div class="gk-hint" style="margin-bottom:10px">
            Ultima sincronizzazione: ${lastSyncAt ? new Date(lastSyncAt).toLocaleString('it-IT') : 'mai'}.
            ${lastSyncError ? `<br><span style="color:var(--red)">Ultimo errore: ${escapeHtml(lastSyncError)}</span>` : ''}
          </div>
          <button class="gk-btn primary" data-action="sync-now" ${syncBusy ? 'disabled' : ''}>
            <i class="fa-solid ${syncBusy ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}"></i>${syncBusy ? 'Sincronizzazione in corso...' : 'Sincronizza ora'}
          </button>
          ${syncLastResult ? `
            <table class="gk-table" style="margin-top:10px">
              <tr><th>Store</th><th>Scaricati</th><th>Caricati</th></tr>
              ${Object.entries(syncLastResult).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v.scaricati}</td><td>${v.caricati}</td></tr>`).join('')}
            </table>` : ''}
        ` : ''}
      </div>
      <div class="gk-card">
        <div class="gk-hint">
          Configurazione richiesta lato Supabase (una volta sola): vedi <code>supabase/schema.sql</code>
          e <code>supabase/README.md</code> nel pacchetto del progetto.
        </div>
      </div>
    `;
    document.getElementById('f-sync-enabled').addEventListener('change', async (e) => {
      await sync.setSyncEnabled(e.target.checked);
      if (e.target.checked) {
        syncBusy = true;
        drawSync();
        try {
          syncLastResult = await sync.syncAll();
        } catch (err) {
          window.alert('Sincronizzazione non riuscita: ' + err.message);
        } finally {
          syncBusy = false;
          drawSync();
        }
      } else {
        drawSync();
      }
    });
  }

  async function drawBackup() {
    const body = document.getElementById('gk-settings-body');
    body.innerHTML = `
      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-download"></i>Esporta</div>
        <div class="gk-hint" style="margin-bottom:10px">Scarica un file con tutti i dati dell'app (esercizi, sedute, stagioni, eventi, portieri, dizionario, liste). Nessuna informazione lascia questo dispositivo se non attraverso questo file.</div>
        <button class="gk-btn primary" data-action="export-backup"><i class="fa-solid fa-download"></i>Scarica backup</button>
      </div>
      <div class="gk-card">
        <div class="gk-label"><i class="fa-solid fa-upload"></i>Importa</div>
        <div class="gk-hint" style="margin-bottom:10px">Da un file scaricato in precedenza. Aggiunge/aggiorna i dati per id — non cancella quello che c'è già e non è nel file.</div>
        ${!importPreview ? `
          <label class="gk-btn" style="cursor:pointer;display:inline-flex">
            <i class="fa-solid fa-upload"></i> Scegli file di backup
            <input type="file" accept="application/json" id="f-import-file" style="display:none" />
          </label>` : `
          <div class="gk-hint" style="margin-bottom:8px">Trovati nel file:</div>
          <table class="gk-table">
            ${Object.entries(importPreview.counts).map(([k, n]) => `<tr><td>${escapeHtml(k)}</td><td>${n}</td></tr>`).join('')}
          </table>
          <div class="gk-form-actions" style="margin-top:10px">
            <button class="gk-btn" data-action="cancel-import">Annulla</button>
            <button class="gk-btn primary" data-action="confirm-import"><i class="fa-solid fa-check"></i>Importa</button>
          </div>
        `}
      </div>
    `;
    const fileInput = document.getElementById('f-import-file');
    if (fileInput) fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.stores) throw new Error('formato non riconosciuto');
        importPreview = { data: parsed, counts: storage.countByStore(parsed) };
        drawBackup();
      } catch (err) {
        window.alert('File non valido: ' + err.message);
      }
    });
  }

  async function drawListe() {
    const body = document.getElementById('gk-settings-body');
    const lists = {
      materiali: await storage.get('customLists', 'materiali'),
      gesti: await storage.get('customLists', 'gesti'),
      qualita: await storage.get('customLists', 'qualita'),
      categorie: await storage.get('customLists', 'categorie'),
    };
    body.innerHTML = Object.entries(LIST_LABELS).map(([listId, [label, icon]]) => `
      <div class="gk-card">
        <div class="gk-section-toggle" data-action="toggle-liste" data-list="${listId}">
          <div class="gk-label"><i class="fa-solid ${icon}"></i>${label} <span class="gk-badge">${lists[listId]?.items?.length || 0}</span></div>
          <i class="fa-solid fa-chevron-down gk-chevron ${openListe === listId ? 'open' : ''}"></i>
        </div>
        ${openListe === listId ? `
          <div class="gk-section-body">
            <table class="gk-table">
              ${(lists[listId]?.items || []).map((item) => `
                <tr>
                  <td><input class="gk-input gk-inline-input" data-action="rename-item" data-list="${listId}" data-key="${item.key}" value="${escapeHtml(item.label)}" /></td>
                  <td style="width:40px"><button class="gk-icon-btn danger" data-action="delete-item" data-list="${listId}" data-key="${item.key}"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
              `).join('')}
            </table>
            <div class="gk-add-row" style="margin-top:10px">
              <input class="gk-input" id="new-${listId}" placeholder="Aggiungi voce..." />
              <button class="gk-btn" data-action="add-item" data-list="${listId}"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>` : ''}
      </div>
    `).join('');
  }

  async function drawDizionario() {
    const body = document.getElementById('gk-settings-body');
    const [termini, gruppi] = await Promise.all([dizionario.allTermini(), dizionario.allGruppi()]);
    const sorted = [...termini].sort((a, b) => b.count - a.count);
    body.innerHTML = `
      <div class="gk-card">
        <div class="gk-hint" style="margin-bottom:10px">
          Seleziona due o più termini, poi scegli se sono <b>lo stesso concetto</b>
          scritto diverso (Unifica) o <b>alternative tra loro</b> (Raggruppa). Nessuna
          categorizzazione: solo frasi già usate, cresciute dall'uso. Doppio clic su un
          termine per rinominarlo.
        </div>
        <table class="gk-table">
          <tr><th></th><th>Termine</th><th>Usi</th><th>Gruppo</th></tr>
          ${sorted.map((t) => {
            const g = gruppi.find((gr) => gr.termIds.includes(t.id));
            return `
            <tr class="gk-dict-row" data-id="${t.id}" style="cursor:pointer">
              <td><input type="checkbox" data-action="toggle-select" data-id="${t.id}" ${selectedTermini.includes(t.id) ? 'checked' : ''} /></td>
              <td data-action="dblclick-rename" data-id="${t.id}">${escapeHtml(t.label)}</td>
              <td>${t.count}</td>
              <td>${g ? `<span class="gk-group-row-inline"><i class="fa-solid fa-shuffle"></i> ${escapeHtml(g.nome)}</span>` : ''}</td>
            </tr>`;
          }).join('')}
        </table>
        ${sorted.length === 0 ? '<div class="gk-hint">Il dizionario è vuoto: si popola scrivendo esercizi.</div>' : ''}
        ${selectedTermini.length >= 2 ? `
          <div class="gk-dict-actions">
            <button class="gk-dict-action-btn" data-action="unify"><i class="fa-solid fa-code-merge"></i> Unifica (${selectedTermini.length})</button>
            <button class="gk-dict-action-btn" data-action="open-group"><i class="fa-solid fa-shuffle"></i> Raggruppa (${selectedTermini.length})</button>
          </div>` : ''}
        ${selectedTermini.length === 1 ? `
          <div class="gk-dict-actions">
            <button class="gk-dict-action-btn danger-outline" data-action="delete-term" data-id="${selectedTermini[0]}"><i class="fa-solid fa-trash"></i> Elimina termine selezionato</button>
          </div>` : ''}
      </div>
      ${gruppi.length > 0 ? `
        <div class="gk-card">
          <div class="gk-label"><i class="fa-solid fa-shuffle"></i>Gruppi di alternative</div>
          ${gruppi.map((g) => `
            <div class="gk-group-row" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)">
              <span><b>${escapeHtml(g.nome)}</b>: ${g.termIds.map((id) => termini.find((t) => t.id === id)?.label).filter(Boolean).join(', ')}</span>
              <button class="gk-icon-btn danger" data-action="delete-group" data-id="${g.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join('')}
        </div>` : ''}
      <div id="gk-group-modal-slot"></div>
    `;
  }

  function groupModalHtml() {
    return `
      <div class="gk-modal-backdrop" data-action="close-group-modal">
        <div class="gk-modal" data-stop>
          <div class="gk-modal-title">Nome del gruppo di alternative</div>
          <input class="gk-input" id="fg-nome" placeholder="Es. Presa" autofocus />
          <div class="gk-modal-actions">
            <button class="gk-btn" data-action="close-group-modal">Annulla</button>
            <button class="gk-btn primary" data-action="confirm-group"><i class="fa-solid fa-check"></i>Crea gruppo</button>
          </div>
        </div>
      </div>
    `;
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'tab') { tab = btn.dataset.tab; selectedTermini = []; importPreview = null; draw(); }

    else if (action === 'sync-now') {
      syncBusy = true;
      drawSync();
      try {
        syncLastResult = await sync.syncAll();
      } catch (err) {
        window.alert('Sincronizzazione non riuscita: ' + err.message);
      } finally {
        syncBusy = false;
        drawSync();
      }
    }

    else if (action === 'export-backup') {
      const data = await storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `gkeepers-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    else if (action === 'cancel-import') { importPreview = null; drawBackup(); }
    else if (action === 'confirm-import') {
      if (!window.confirm('Importare questo backup? I dati con lo stesso id verranno sovrascritti.')) return;
      await storage.importAll(importPreview.data);
      importPreview = null;
      window.alert('Importazione completata.');
      drawBackup();
    }

    else if (action === 'toggle-liste') {
      openListe = openListe === btn.dataset.list ? null : btn.dataset.list;
      drawListe();
    }
    else if (action === 'add-item') {
      const listId = btn.dataset.list;
      const inp = document.getElementById(`new-${listId}`);
      const label = inp.value.trim();
      if (!label) return;
      await aggiungiVoceLista(listId, label);
      drawListe();
    }
    else if (action === 'delete-item') {
      const { list, key } = btn.dataset;
      const usoCount = await contaUsoVoceLista(list, key);
      const msg = usoCount > 0
        ? `Questa voce è usata in ${usoCount} esercizi. Eliminarla la rimuove anche da lì. Continuare?`
        : 'Eliminare questa voce?';
      if (!window.confirm(msg)) return;
      await eliminaVoceLista(list, key);
      drawListe();
    }

    else if (action === 'toggle-select') {
      const id = btn.dataset.id;
      selectedTermini = selectedTermini.includes(id) ? selectedTermini.filter((x) => x !== id) : [...selectedTermini, id];
      drawDizionario();
    }
    else if (action === 'delete-term') {
      const id = btn.dataset.id;
      const { count, titoli } = await dizionario.contaUsoTermine(id);
      const msg = count > 0
        ? `Usato in ${count} esercizi (${titoli.slice(0, 3).join(', ')}${count > 3 ? '...' : ''}). Gli step lo manterranno come testo libero, ma perdono il collegamento. Eliminare comunque?`
        : 'Eliminare questo termine dal dizionario?';
      if (!window.confirm(msg)) return;
      await dizionario.eliminaTermine(id);
      selectedTermini = selectedTermini.filter((x) => x !== id);
      drawDizionario();
    }
    else if (action === 'unify') {
      const canonico = await dizionario.unificaTermini(selectedTermini);
      selectedTermini = [];
      drawDizionario();
      if (canonico) window.alert(`Uniti in "${canonico.label}".`);
    }
    else if (action === 'open-group') {
      document.getElementById('gk-group-modal-slot').innerHTML = groupModalHtml();
    }
    else if (action === 'close-group-modal') {
      document.getElementById('gk-group-modal-slot').innerHTML = '';
    }
    else if (action === 'confirm-group') {
      const nome = document.getElementById('fg-nome').value.trim() || 'Gruppo';
      await dizionario.creaGruppo(nome, selectedTermini);
      selectedTermini = [];
      document.getElementById('gk-group-modal-slot').innerHTML = '';
      drawDizionario();
    }
    else if (action === 'delete-group') {
      if (!window.confirm('Eliminare questo gruppo? I termini restano nel dizionario, smettono solo di essere collegati come alternative.')) return;
      await dizionario.eliminaGruppo(btn.dataset.id);
      drawDizionario();
    }
    else if (action === 'dblclick-rename') {
      // gestito da dblclick, qui il click singolo apre/chiude la selezione della riga
      const id = btn.dataset.id;
      selectedTermini = selectedTermini.includes(id) ? selectedTermini.filter((x) => x !== id) : [id];
      drawDizionario();
    }
  });

  container.addEventListener('change', async (e) => {
    if (e.target.dataset.action === 'rename-item') {
      await rinominaVoceLista(e.target.dataset.list, e.target.dataset.key, e.target.value);
    }
  });

  container.addEventListener('dblclick', async (e) => {
    const cell = e.target.closest('[data-action="dblclick-rename"]');
    if (!cell || tab !== 'dizionario') return;
    const id = cell.dataset.id;
    const termini = await dizionario.allTermini();
    const t = termini.find((x) => x.id === id);
    if (!t) return;
    const nuovo = window.prompt('Rinomina termine (si aggiorna ovunque sia collegato):', t.label);
    if (nuovo && nuovo.trim() && nuovo.trim() !== t.label) {
      await dizionario.rinominaTermine(id, nuovo);
      drawDizionario();
    }
  });

  draw();
}
