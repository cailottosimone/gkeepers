// app.js — entry point
// Avvio: monta la UI nel contenitore #app. Tutta la persistenza è IndexedDB.
import { UI } from "./ui.js";

window.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("app");
  const ui = new UI(root);
  try {
    await ui.init();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="fatal">
      <h2>Avvio non riuscito</h2>
      <p>Apri l'app tramite <b>Live Server</b> (http://), non con doppio clic sul file.
      I moduli JavaScript e IndexedDB richiedono il protocollo http.</p>
      <pre>${(err && err.message) || err}</pre>
    </div>`;
  }
});
