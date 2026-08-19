// data/cloud.js
// Livello di accesso HTTP a Supabase (PostgREST), via fetch diretto — nessuna
// libreria esterna, coerente con "nessun build step, nessuna dipendenza a
// runtime" del resto del progetto.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SCHEMA } from './config.js';

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Accept-Profile': SUPABASE_SCHEMA,
    'Content-Profile': SUPABASE_SCHEMA,
    ...extra,
  };
}

export async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: headers() });
  if (!res.ok) throw new Error(`Errore lettura "${table}": ${res.status} ${await safeText(res)}`);
  return res.json();
}

export async function upsertRows(table, rows) {
  if (!rows || rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Errore scrittura "${table}": ${res.status} ${await safeText(res)}`);
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}
