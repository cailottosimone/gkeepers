// modal.js
// Modale generico riusabile. Su desktop le azioni "modifica/vedi/nuovo"
// aprono qui dentro; su mobile i moduli continuano a usare la vista a
// sezione intera (più comoda su schermo stretto). Un solo modale alla
// volta: aprirne uno chiude l'eventuale precedente.

let current = null;

export function isDesktop() {
  return window.matchMedia('(min-width: 860px)').matches;
}

// renderFn(target, close) — riceve il contenitore dove disegnare e una
// funzione per chiudere il modale da dentro il modulo chiamante.
export function openModal(renderFn, { size = 'md', label = '' } = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'gk-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-label', label);
  const modal = document.createElement('div');
  modal.className = `gk-modal gk-modal-${size}`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'gk-modal-close';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.setAttribute('aria-label', 'Chiudi');
  closeBtn.addEventListener('click', () => closeModal());
  const body = document.createElement('div');
  body.className = 'gk-modal-body';
  modal.appendChild(closeBtn);
  modal.appendChild(body);
  backdrop.appendChild(modal);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(backdrop);
  current = backdrop;
  renderFn(body, closeModal);
  return { close: closeModal, container: body };
}

function onEsc(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (current) {
    current.remove();
    current = null;
    document.removeEventListener('keydown', onEsc);
  }
}
