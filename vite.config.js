import { hostname } from 'node:os'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { indirizziDiAccesso, marcatore } from './scripts/indirizzi-accesso.mjs'

// Il nome di QUESTA macchina, chiesto al sistema a ogni avvio.
//
// ⚠️ NON SI SCRIVE A MANO, ed è il motivo per cui questa riga esiste. Dal
// telefono, sulla rete privata Tailscale, il gestionale si apre col nome del
// computer invece che col numero — e Vite rifiuta ogni nome che non conosce
// («Blocked request. This host is not allowed»). Inchiodare qui il nome di
// oggi vorrebbe dire ritrovarsi bloccati il giorno che la macchina cambia
// nome, senza nessuno che si ricordi perché: *un nome scritto a mano è una
// frase destinata a diventare falsa*. Chiedendolo al sistema, segue la
// macchina da sé.
//
// ⚠️ Due forme, e servono tutt'e due: Windows restituisce il nome in
// maiuscolo, mentre l'intestazione che arriva dal browser è in minuscolo.
const nomeDiQuestaMacchina = [hostname(), hostname().toLowerCase()]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 🔴 GLI INDIRIZZI DI ACCESSO SI DECIDONO QUI, UNA VOLTA SOLA — 02/09/2026.
  //
  // ⚠️ `loadEnv` DA SOLO BASTA, ed è stato MISURATO invece che dedotto: legge
  //    i file `.env` del progetto **e** l'ambiente del processo — che è da
  //    dove arrivano i valori su GitHub — per tutte le variabili col
  //    prefisso. Provato: una variabile che esiste solo in `process.env`
  //    viene vista; una senza prefisso no, ed è giusto così.
  //
  // 🔴 UNA PRIMA STESURA CI AGGIUNGEVA `...process.env`, e non era prudenza:
  //    era un **secondo meccanismo per lo stesso lavoro**. Se n'è accorta una
  //    rottura fatta apposta — tolto lo spread, nessuna prova diventava
  //    rossa. Non perché le prove fossero deboli: perché non si era rotto
  //    niente. *Due strade per la stessa risposta sono un doppione da
  //    togliere, non una difesa in più.*
  //
  // ⚠️ SI FERMA QUI se un valore è storto: la costruzione fallisce e il
  //    pacchetto rotto **non nasce**. A tempo di esecuzione vorrebbe dire
  //    scoprirlo davanti alla schermata di accesso, cioè **chiusi fuori**.
  const indirizzi = indirizziDiAccesso(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    plugins: [react(), tailwindcss()],

    // 🔴 L'APP RICEVE UNA STRINGA GIÀ VALIDATA, non la variabile.
    //
    // Non esiste una seconda lettura che possa divergere: c'è una sorgente
    // sola perché ce n'è una sola. Il difetto che questo disegno chiude era
    // proprio quello — `vite.config.js` gira in Node e vede `process.env`,
    // l'app vede `import.meta.env`, e le due letture *dovrebbero* coincidere.
    // «Dovrebbero» è la parola che questo progetto insegue da settimane: la
    // cura non è una prova che confronti le due letture, è **togliere la
    // seconda**.
    define: {
      __INDIRIZZI_ACCESSO__: JSON.stringify(marcatore(indirizzi)),
    },
    // host: true espone il server sulla rete locale (non solo su localhost),
    // utile per testare da tablet/telefono in cucina — vedi brief §3.6.
    server: {
      host: true,
      // ⚠️ SI APRE IL DOMINIO DELLA RETE PRIVATA, NON UNA MACCHINA. `.ts.net` è
      // il dominio di Tailscale: copre il nome lungo di qualunque dispositivo
      // della sua rete, oggi e dopo una reinstallazione. Accanto c'è il nome
      // corto di questa macchina, che è la forma che il telefono manda quando
      // si digita solo «desktop-…» senza il resto.
      //
      // ⚠️ E NON SI METTE `true`, che vorrebbe dire «qualunque nome va bene»:
      // il controllo di Vite esiste per impedire che un sito qualsiasi aperto
      // nel browser si faccia rispondere da questo server. Resta acceso; si
      // apre solo dove serve.
      allowedHosts: ['.ts.net', ...nomeDiQuestaMacchina],
    },
  }
})
