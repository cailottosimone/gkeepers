// dom-utils.js
// Piccole utility condivise da tutti i moduli di rendering. Nessuna logica di
// dominio qui dentro.

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

// Data di calendario in formato YYYY-MM-DD basata sull'ORARIO LOCALE, non
// UTC. toISOString() (usato inizialmente) sposta la data di un giorno per
// chi ha un fuso diverso da UTC — bug reale, corretto qui una volta per
// tutte: ogni punto del codice che ha bisogno di una stringa data da un
// oggetto Date deve passare da qui, mai da toISOString().
export function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return isoLocal(new Date());
}

// Ridimensiona/comprime un'immagine lato client (canvas) prima di salvarla
// in IndexedDB, stesso principio già in uso nel repository originale
// (resizeImageFile in importExport.js). Richiede un vero browser (Image +
// canvas): non eseguibile in un ambiente headless senza DOM grafico.
export function resizeImageFile(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function qs(root, sel) {
  return root.querySelector(sel);
}
