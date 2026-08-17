// session.js
// Logica di composizione della seduta. SOLO AGGREGAZIONE:
//  - durata totale
//  - qualità allenate complessive (unione)
//  - materiali aggregati (somma quantità per chiave)
// Nessun suggerimento di periodizzazione: quello vive solo nell'artefatto.
// Le sedute generate su Claude possono comunque essere importate qui: in tal
// caso un eventuale campo periodizationSuggestion viene preservato ma non usato.

export function aggregateSession(exercises) {
  let totalDurationSeconds = 0;
  const qualitiesSet = new Set();
  const periodsSet = new Set();
  const materialsMap = new Map(); // key -> qty

  for (const ex of exercises) {
    if (!ex) continue;
    const est = ex.parameters && Number(ex.parameters.estimatedTotalSeconds);
    if (Number.isFinite(est)) totalDurationSeconds += est;

    (ex.trainedQualities || []).forEach(q => { if (q) qualitiesSet.add(q); });
    (ex.trainingPeriod || []).forEach(p => { if (p) periodsSet.add(p); });

    (ex.materials || []).forEach(m => {
      if (!m || !m.key) return;
      const qty = Number(m.qty) || 0;
      // I materiali si riutilizzano tra un esercizio e l'altro: si tiene il MASSIMO,
      // non la somma (idempotente: ricalcolare sullo stesso insieme dà lo stesso risultato).
      materialsMap.set(m.key, Math.max(materialsMap.get(m.key) || 0, qty));
    });
  }

  return {
    totalDurationSeconds,
    qualitiesCovered: [...qualitiesSet],
    periodsCovered: [...periodsSet],
    materialsAggregated: [...materialsMap.entries()].map(([key, qty]) => ({ key, qty }))
  };
}

// Formatta secondi -> "mm:ss" oppure "h:mm:ss"
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Stima la durata totale di un esercizio dai parametri, se non già fornita.
export function estimateExerciseDuration({ series, reps, workSeconds, recoverySeconds }) {
  const S = Number(series) || 0;
  const W = Number(workSeconds) || 0;
  const R = Number(recoverySeconds) || 0;
  // lavoro per serie + recupero tra le serie (recupero non conteggiato dopo l'ultima)
  const work = S * W;
  const recovery = Math.max(0, S - 1) * R;
  return work + recovery;
}
