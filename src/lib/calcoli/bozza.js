// =====================================================================
// QUELLO CHE SI STA SCRIVENDO SOPRAVVIVE A UNA RICARICA
// =====================================================================
// 🔴 IL DIFETTO, riferito da Alessio il 29/08/2026: sul telefono, mandando
// l'app in secondo piano e riprendendola, la schermata si ricarica da capo
// — e se stava scrivendo qualcosa, lo perde.
//
// ⚠️ LA CAUSA DELLA RICARICA È MISURATA, non supposta. Nel programma che
// tiene aggiornato il gestionale mentre lo si sviluppa c'è scritto: quando
// il collegamento col computer cade, aspetta che torni e **ricarica la
// pagina**. Cadere è esattamente ciò che il collegamento fa quando iPhone
// mette un'app in secondo piano — quindi non dipende da cosa stiamo
// facendo noi al codice, e infatti è successo a lavori fermi. Spiega anche
// perché a intervalli: un rientro veloce non fa in tempo a farlo cadere.
//
// ⚠️ MA LA CAUSA NON È IL PROBLEMA, ed è il motivo per cui questo file
// esiste. Quella ricarica vive solo mentre si sviluppa: il sito pubblicato
// non ha quel programma dentro. La ricarica però resta possibile per altre
// tre strade che ci saranno anche a marzo — iPhone che scarica dalla
// memoria un'app rimasta indietro, un trascinamento in giù per sbaglio, un
// guasto. **Quello che non è accettabile non è la ricarica: è perdere
// quello che si stava scrivendo.** Si cura quello.
//
// ⚠️ E SI CURA NEL TELAIO, NON SULLA SCHERMATA CHE ALESSIO HA NOMINATO.
// Misurato il 29/08: le schermate con un modulo che si compila e che
// perdono tutto sono **47 su 76**, per **396 campi**. Curarne una sarebbe
// stato «trovarle tutte», e la prossima nascerebbe storta.
//
// ⚠️ PERCHE' SI GUARDA LA SCHERMATA E NON LO STATO DEL PROGRAMMA. Ogni
// schermata tiene i propri campi a modo suo; quello che hanno tutte in
// comune è che i campi sono **sulla pagina**. Riprendendoli da lì una
// schermata nuova è coperta senza che nessuno si ricordi di niente —
// stessa ragione per cui il segnale delle letture tagliate sta nel punto
// unico da cui passano le letture.

// Per quanto tempo una cosa scritta e non salvata vale ancora la pena di
// essere rimessa. Oltre, chi torna su quella schermata non se la ricorda
// più, e ritrovarla piena confonde invece di aiutare.
export const MINUTI_DI_VALIDITA = 30;

// I campi che NON si conservano mai.
//
// 🔴 `password` è il PIN con cui si entra nel gestionale. Una credenziale
// non si conserva da nessuna parte, per nessun motivo e per nessun comodo:
// è la sola riga di questo file che non ha un prezzo da discutere.
// `file` non si può rimettere (il browser non lo permette, ed è giusto);
// gli altri non contengono niente che si scriva.
const TIPI_ESCLUSI = new Set([
  "password", "file", "hidden", "submit", "button", "image", "reset",
]);

/**
 * Si conserva quello che si scrive: non i pulsanti, non le credenziali,
 * non i campi che nessuno può toccare.
 *
 * `campo` è una descrizione già estratta dalla pagina, non un elemento del
 * browser: così questa regola si può provare senza aprire niente.
 */
export function daConservare(campo) {
  if (!campo) return false;
  if (TIPI_ESCLUSI.has(campo.tipo)) return false;
  if (campo.soloLettura || campo.spento) return false;
  if (campo.fuoriBozza) return false;
  return true;
}

/**
 * Il nome con cui si ritrova un campo dopo la ricarica.
 *
 * ⚠️ QUATTRO PEZZI, E SERVONO TUTTI. Il nome del campo da solo non basta
 * (molti non ce l'hanno); la posizione da sola non basta (un elenco che
 * arriva dal database più tardi sposta tutto di una riga, e il valore
 * finirebbe nel campo sbagliato). Chiedendo che combacino tutti e quattro,
 * un campo che non si riconosce **non viene rimesso** — che è il verso
 * giusto in cui sbagliare.
 */
export function nomeDelCampo(campo) {
  return [campo.nome || "", campo.tipo || "", campo.posto ?? 0, campo.attorno || ""].join("\u0000");
}

/**
 * Numera i campi che si somigliano, in ordine di pagina.
 */
export function numera(campi) {
  const visti = new Map();
  return campi.map((c) => {
    const gruppo = `${c.nome || ""}\u0000${c.tipo || ""}`;
    const posto = visti.get(gruppo) ?? 0;
    visti.set(gruppo, posto + 1);
    return { ...c, posto };
  });
}

/**
 * Quello che vale la pena conservare di una schermata.
 *
 * ⚠️ SI CONSERVA SOLO CIÒ CHE È PIENO, e il prezzo va dichiarato: un campo
 * che era stato **svuotato apposta** torna pieno. È voluto, e il motivo è
 * il caso opposto — se si conservasse anche il vuoto, bastava mettere l'app
 * in secondo piano mentre i dati stanno ancora arrivando dal database per
 * fotografare una schermata tutta vuota, e la ricarica dopo **cancellerebbe
 * dati veri**. Fra «un campo svuotato torna pieno» e «dei dati veri
 * spariscono» non c'è partita.
 *
 * Per la stessa ragione una casella si conserva solo se è **spuntata**.
 */
export function cosaSiConserva(campi) {
  const buoni = numera(campi.filter(daConservare));
  const dentro = {};
  for (const c of buoni) {
    if (c.tipo === "checkbox" || c.tipo === "radio") {
      if (c.spuntato) dentro[nomeDelCampo(c)] = true;
    } else if (String(c.valore ?? "") !== "") {
      dentro[nomeDelCampo(c)] = String(c.valore);
    }
  }
  return dentro;
}

/**
 * Una fotografia si rimette solo se è **della stessa schermata** e
 * **recente**. Vuoto non è una risposta: chi chiama distingue «non ce n'è»
 * da «ce n'è una vecchia».
 */
export function siRimette(foto, dove, adesso, minuti = MINUTI_DI_VALIDITA) {
  if (!foto || typeof foto !== "object") return { rimetti: false, perche: "non ce n'e'" };
  if (foto.dove !== dove) return { rimetti: false, perche: "e' di un'altra schermata" };
  if (!foto.campi || Object.keys(foto.campi).length === 0)
    return { rimetti: false, perche: "non c'era niente scritto" };
  const eta = (adesso - Number(foto.quando)) / 60000;
  if (!Number.isFinite(eta) || eta < 0 || eta > minuti)
    return { rimetti: false, perche: "e' passato troppo tempo" };
  return { rimetti: true, quanti: Object.keys(foto.campi).length };
}
