import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyPxCm } from './lib/touch'
import { pubblica } from './lib/calcoli/pubblico'
import { accendiLaBozza } from './lib/bozza'
import { accendiLaSorveglianzaVersione } from './lib/versione'

// Calibrazione dei tocchi in cm reali (§3.2.1): applicata prima del primo
// render, cosi' nessuna schermata compare per un istante con i pulsanti
// della misura sbagliata.
applyPxCm()

// Quello che si sta scrivendo sopravvive a una ricarica della pagina.
// Il perche sta per esteso in src/lib/calcoli/bozza.js.
accendiLaBozza()

// Quando esce una versione nuova, il gestionale lo DICE — non ricarica mai da
// solo. Il perche sta per esteso in src/lib/calcoli/versione.js.
accendiLaSorveglianzaVersione()

// 🔴 DUE PEZZI DI CODICE, NON UNO (11/10/2026, decisione di Alessio). Le
//    pagine che apre un cliente — prenotare, leggere l'informativa — si
//    caricano da sole; il gestionale si scarica solo quando serve. Prima un
//    telefono per strada scaricava tutto (400 kB compressi) per quattro
//    caselle. Il perche' per esteso sta in src/Pubblico.jsx, e il peso di
//    ciascun pezzo lo sorveglia scripts/peso-pacchetto.mjs.
// ⚠️ L'elenco degli indirizzi pubblici vive in src/lib/calcoli/pubblico.js:
//    una pagina pubblica nuova si aggiunge li' E in src/Pubblico.jsx.
const radice = createRoot(document.getElementById('root'))
const carica = pubblica(window.location.pathname)
  ? import('./Pubblico.jsx')
  : import('./App.jsx')

carica.then(({ default: Pagina }) =>
  radice.render(
    <StrictMode>
      <Pagina />
    </StrictMode>,
  ),
)
