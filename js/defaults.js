// defaults.js
// Liste personalizzate di default. Vengono scritte una sola volta, al primo
// avvio (vedi storage.ensureDefaults) — mai sovrascritte in seguito.

export const SCHEMA_VERSION = '0.1.0';

export const CUSTOM_LISTS_DEFAULTS = {
  materiali: [
    { key: 'pallone', label: 'Pallone', isDefault: true },
    { key: 'cinesino', label: 'Cinesino', isDefault: true },
    { key: 'ostacolo_basso', label: 'Ostacolo basso', isDefault: true },
    { key: 'ostacolo_alto', label: 'Ostacolo alto', isDefault: true },
    { key: 'scaletta', label: 'Scaletta', isDefault: true },
    { key: 'paletto', label: 'Paletto', isDefault: true },
    { key: 'paletto_a_terra', label: 'Paletto a terra', isDefault: true },
    { key: 'porta', label: 'Porta', isDefault: true },
    { key: 'deviatore', label: 'Deviatore', isDefault: true },
    { key: 'pallina_da_tennis', label: 'Pallina da tennis', isDefault: true },
    { key: 'giocatore', label: 'Giocatore (collaboratore)', isDefault: true },
  ],
  gesti: [
    { key: 'presa', label: 'Presa', isDefault: true },
    { key: 'tuffo', label: 'Tuffo', isDefault: true },
    { key: 'parata', label: 'Parata', isDefault: true },
    { key: 'trasmissione', label: 'Trasmissione', isDefault: true },
    { key: 'raccolta', label: 'Raccolta', isDefault: true },
  ],
  qualita: [
    { key: 'reattivita', label: 'Reattività', isDefault: true },
    { key: 'coordinazione', label: 'Coordinazione', isDefault: true },
    { key: 'forza', label: 'Forza', isDefault: true },
    { key: 'equilibrio', label: 'Equilibrio', isDefault: true },
    { key: 'esplosivita', label: 'Esplosività', isDefault: true },
  ],
};
