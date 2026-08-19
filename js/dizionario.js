// dizionario.js
// Dizionario piatto di step (Termini) + Gruppi di alternative.
// NON è una tassonomia: solo frasi deduplicate cresciute dall'uso, e gruppi
// opzionali per varianti intercambiabili (vedi documento di modello
// concettuale: struttura Esercizio/Step).

import * as storage from './storage.js';

export function normalize(s) {
  return (s || '').toLowerCase().trim().replace(/[.\-,;:]/g, '').replace(/\s+/g, ' ');
}

export async function allTermini() {
  return storage.getAll('termini');
}

export async function allGruppi() {
  return storage.getAll('gruppi');
}

export async function suggerimenti(input, limit = 5) {
  const n = normalize(input);
  if (!n) return [];
  const termini = await allTermini();
  return termini
    .filter((t) => {
      const tn = normalize(t.label);
      return tn !== n && (tn.includes(n) || n.includes(tn.split(' ')[0]));
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Risolve un testo digitato in un riferimento a un termine, creandolo se serve.
// chosenId: presente se l'utente ha esplicitamente accettato un suggerimento.
export async function risolviTermine(rawLabel, chosenId) {
  const text = rawLabel.trim();
  const n = normalize(text);
  const termini = await allTermini();

  if (chosenId) {
    const t = termini.find((x) => x.id === chosenId);
    if (t) {
      await storage.put('termini', { ...t, count: t.count + 1, updatedAt: storage.now() });
      return { label: t.label, termRef: t.id, isNewTerm: false };
    }
  }
  const exact = termini.find((t) => normalize(t.label) === n);
  if (exact) {
    await storage.put('termini', { ...exact, count: exact.count + 1, updatedAt: storage.now() });
    return { label: exact.label, termRef: exact.id, isNewTerm: false };
  }
  const nuovo = {
    id: storage.uid(), label: text, count: 1,
    createdAt: storage.now(), updatedAt: storage.now(),
  };
  await storage.put('termini', nuovo);
  return { label: nuovo.label, termRef: nuovo.id, isNewTerm: true };
}

export async function alternativePer(termId) {
  if (!termId) return { gruppo: null, alternative: [] };
  const gruppi = await allGruppi();
  const g = gruppi.find((gr) => gr.termIds.includes(termId));
  if (!g) return { gruppo: null, alternative: [] };
  const termini = await allTermini();
  const alternative = g.termIds
    .filter((id) => id !== termId)
    .map((id) => termini.find((t) => t.id === id))
    .filter(Boolean);
  return { gruppo: g, alternative };
}

// Quante volte / in quali esercizi un termine è referenziato — usato per
// l'avviso prima di eliminare una voce dal dizionario.
export async function contaUsoTermine(termId) {
  const esercizi = await storage.getAll('esercizi');
  const titoli = [];
  for (const es of esercizi) {
    if ((es.steps || []).some((s) => s.termRef === termId)) titoli.push(es.titolo);
  }
  return { count: titoli.length, titoli };
}

// Elimina un termine dal dizionario. Gli step che lo referenziavano NON
// perdono il testo: restano com'erano, solo il collegamento sparisce
// (termRef -> null), tornano step "testo libero".
export async function eliminaTermine(termId) {
  const esercizi = await storage.getAll('esercizi');
  for (const es of esercizi) {
    let changed = false;
    const steps = (es.steps || []).map((s) => {
      if (s.termRef === termId) { changed = true; return { ...s, termRef: null }; }
      return s;
    });
    if (changed) await storage.put('esercizi', { ...es, steps, updatedAt: storage.now() });
  }
  const gruppi = await allGruppi();
  for (const g of gruppi) {
    if (g.termIds.includes(termId)) {
      await storage.put('gruppi', {
        ...g, termIds: g.termIds.filter((id) => id !== termId), updatedAt: storage.now(),
      });
    }
  }
  await storage.remove('termini', termId);
}

// Unifica più termini in uno solo (sopravvive il più usato). Aggiorna tutti
// gli step e i gruppi che referenziavano i termini "perdenti".
export async function unificaTermini(ids) {
  const termini = await allTermini();
  const scelti = termini.filter((t) => ids.includes(t.id));
  if (scelti.length < 2) return null;
  const canonico = [...scelti].sort((a, b) => b.count - a.count)[0];
  const perdenti = scelti.filter((t) => t.id !== canonico.id);
  const perdentiIds = perdenti.map((t) => t.id);
  const totalCount = scelti.reduce((sum, t) => sum + t.count, 0);

  const esercizi = await storage.getAll('esercizi');
  for (const es of esercizi) {
    let changed = false;
    const steps = (es.steps || []).map((s) => {
      if (perdentiIds.includes(s.termRef)) {
        changed = true;
        return { ...s, termRef: canonico.id, label: canonico.label };
      }
      return s;
    });
    if (changed) await storage.put('esercizi', { ...es, steps, updatedAt: storage.now() });
  }

  const gruppi = await allGruppi();
  for (const g of gruppi) {
    if (g.termIds.some((id) => perdentiIds.includes(id))) {
      const termIds = Array.from(new Set(
        g.termIds.map((id) => (perdentiIds.includes(id) ? canonico.id : id))
      ));
      await storage.put('gruppi', { ...g, termIds, updatedAt: storage.now() });
    }
  }

  for (const p of perdenti) await storage.remove('termini', p.id);
  await storage.put('termini', { ...canonico, count: totalCount, updatedAt: storage.now() });
  return canonico;
}

// Rinomina un termine con propagazione (stesso meccanismo delle liste
// personalizzate): il testo di tutti gli step collegati si aggiorna.
export async function rinominaTermine(termId, nuovaLabel) {
  const label = nuovaLabel.trim();
  if (!label) return;
  const t = await storage.get('termini', termId);
  if (!t) return;
  await storage.put('termini', { ...t, label, updatedAt: storage.now() });
  const esercizi = await storage.getAll('esercizi');
  for (const es of esercizi) {
    let changed = false;
    const steps = (es.steps || []).map((s) => {
      if (s.termRef === termId) { changed = true; return { ...s, label }; }
      return s;
    });
    if (changed) await storage.put('esercizi', { ...es, steps, updatedAt: storage.now() });
  }
}

export async function creaGruppo(nome, termIds) {
  const g = {
    id: storage.uid(), nome: nome.trim() || 'Gruppo', termIds: [...termIds],
    createdAt: storage.now(), updatedAt: storage.now(),
  };
  await storage.put('gruppi', g);
  return g;
}

export async function rinominaGruppo(id, nome) {
  const g = await storage.get('gruppi', id);
  if (!g) return;
  await storage.put('gruppi', { ...g, nome: nome.trim() || g.nome, updatedAt: storage.now() });
}

export async function eliminaGruppo(id) {
  await storage.remove('gruppi', id);
}
