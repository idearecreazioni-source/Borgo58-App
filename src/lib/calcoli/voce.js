// =====================================================================
// I COMANDI VOCALI — le regole, fuori dalla schermata
// =====================================================================
// Stanno qui e non dentro il componente per la ragione di sempre: una
// regola dentro una schermata si prova solo aprendo quella schermata, e
// in questo progetto nessuna prova automatica guarda uno schermo.
//
// 🔴 QUELLO CHE NON STA QUI: il criterio salva-da-sé. Vive nel database
//    (`azione_si_esegue_da_se`), e questo file si limita a LEGGERE com'è
//    andata. Riscriverlo anche qui vorrebbe dire due posti che decidono
//    la stessa cosa e possono contraddirsi — e il giorno che si
//    contraddicono, qualcosa che tocca i soldi si salva da solo.

/**
 * Il riconoscimento vocale del browser, se c'è.
 *
 * ⚠️ È quello che Alessio ha già provato in cucina il 12/08, numeri
 * compresi: gira sul dispositivo, non costa niente e non manda audio da
 * nessuna parte. Quello che parte dal browser è già testo.
 */
export function riconoscitoreDisponibile(finestra = typeof window !== "undefined" ? window : null) {
  if (!finestra) return false;
  return Boolean(finestra.SpeechRecognition || finestra.webkitSpeechRecognition);
}

export function creaRiconoscitore(finestra = typeof window !== "undefined" ? window : null) {
  if (!finestra) return null;
  const Classe = finestra.SpeechRecognition || finestra.webkitSpeechRecognition;
  if (!Classe) return null;
  const rec = new Classe();
  rec.lang = "it-IT";
  // 🔴 `continuous` è ciò che permette la FILZA: si preme una volta, si
  //    dicono cinque cose di fila, si ripreme. Senza, il riconoscimento si
  //    chiude dopo la prima pausa e ogni prodotto sarebbe una
  //    registrazione a sé — che è esattamente ciò che il mandato esclude.
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}

/**
 * Che cosa dire quando il microfono si lamenta.
 *
 * ⚠️ Nessun errore viene nascosto perché «di solito è innocuo»: è la
 * lezione del 12/08, quando `aborted` trattato come silenzio produsse una
 * pagina che non faceva niente e non lo diceva. Il silenzio vero (`no-speech`)
 * si dice a parole, e non ferma l'ascolto.
 */
export function fraseDelMicrofono(codice) {
  switch (codice) {
    case "no-speech":
      return { frase: "Non ho sentito niente: parla pure, ti sto ancora ascoltando.", ferma: false };
    case "not-allowed":
    case "service-not-allowed":
      return {
        frase:
          "Il microfono è bloccato per questo sito. Tocca il lucchetto accanto all'indirizzo, " +
          "in alto, e metti il microfono su «Consenti». Poi ricarica la pagina.",
        ferma: true,
      };
    case "audio-capture":
      return { frase: "Non trovo nessun microfono su questo dispositivo.", ferma: true };
    case "network":
      return {
        frase: "Il riconoscimento vocale ha bisogno della rete e adesso non ce l'ha. Si scrive a mano.",
        ferma: true,
      };
    case "aborted":
      return { frase: "L'ascolto si è interrotto. Ripremi il microfono per riprendere.", ferma: true };
    default:
      return { frase: `Il microfono si è fermato (${codice}).`, ferma: true };
  }
}

/**
 * Mette insieme le frasi riconosciute in una filza sola.
 *
 * ⚠️ Le frasi arrivano a pezzi, e i pezzi vanno uniti con uno spazio e non
 * incollati: «pomodori due casse» + «olio tre bottiglie» attaccati darebbero
 * «cassieolio», che nessun assistente capirebbe.
 */
export function componiDettato(pezzi, inCorso = "") {
  return [...pezzi, inCorso]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Com'è andata una dettatura: quello che ha FATTO, e quello che CHIEDE.
 *
 * 🔴 È il riscontro che arriva ALLA FINE. Il mandato lo dice in una riga e
 * la distinzione è tutta lì: se era sicuro si mostra l'elenco di ciò che ha
 * fatto, se no si mostrano le azioni da confermare. Non sono due schermate:
 * sono due elenchi che convivono, perché una filza di cinque cose può
 * benissimo produrre tre gesti fatti e due domande.
 */
export function comeEAndata(azioni = []) {
  const fatte = azioni.filter((a) => a.stato === "eseguita");
  const daGuardare = azioni.filter((a) => a.stato === "in_attesa" || a.stato === "fallita");
  const annullate = azioni.filter((a) => a.stato === "annullata");

  return {
    fatte,
    daGuardare,
    annullate,
    // ⚠️ Una sola frase in cima, perché è quella che Alessio legge da
    //    lontano con le mani sporche. Il dettaglio sta sotto.
    titolo: titoloDelRiscontro(fatte.length, daGuardare.length),
    tuttoFatto: daGuardare.length === 0 && fatte.length > 0,
  };
}

function plurale(n, uno, molti) {
  return n === 1 ? uno : molti.replace("N", String(n));
}

export function titoloDelRiscontro(fatte, daGuardare) {
  if (fatte === 0 && daGuardare === 0) return "Non ho capito niente di quello che hai detto.";
  if (daGuardare === 0) {
    return `Fatto: ${plurale(fatte, "una cosa", "N cose")}.`;
  }
  if (fatte === 0) {
    return `${plurale(daGuardare, "Una cosa", "N cose")} da guardare prima di scriverla.`;
  }
  return `Fatte ${plurale(fatte, "una cosa", "N cose")}. ${plurale(
    daGuardare,
    "Una",
    "N",
  )} da guardare.`;
}

/**
 * Da quanto aspetta una cosa dettata, detto in italiano.
 *
 * ⚠️ «Tre da ieri» e «tre da due settimane» sono due situazioni diverse, e
 * la seconda va detta: è il modo in cui «glielo si ricorda il giorno dopo»
 * si fa senza buttare via niente.
 */
export function daQuantoAspetta(giorni) {
  const g = Number(giorni);
  if (!Number.isFinite(g) || g <= 0) return "di oggi";
  if (g === 1) return "da ieri";
  if (g < 7) return `da ${g} giorni`;
  if (g < 14) return "da più di una settimana";
  if (g < 31) return `da ${Math.floor(g / 7)} settimane`;
  return "da più di un mese";
}

/**
 * Perché una cosa aspetta, in una riga.
 *
 * ⚠️ Un elenco di cose in attesa senza il perché è un elenco di cose di cui
 * non si sa che fare. Il motivo lo scrive l'assistente quando può; quando
 * non l'ha scritto, la natura dell'azione basta a dirlo.
 */
export function perchéAspetta(azione) {
  if (azione?.errore) return azione.errore;
  if (azione?.motivo) return azione.motivo;
  if (azione?.natura === "creazione") {
    return "Questa la guardi sempre tu prima che venga scritta.";
  }
  return "Non ero sicuro: guardala tu.";
}

/**
 * Questo rifiuto vuol dire «la voce non è ancora accesa»?
 *
 * 🔴 «NON C'È ANCORA» E «NON SONO RIUSCITO A LEGGERE» SONO DUE COSE
 * DIVERSE, e vanno distinte perché il codice arriva online **prima** della
 * migrazione che crea le funzioni della voce: fra il push e l'applicazione
 * passano delle ore, ed è giusto che passino.
 *
 * ⚠️ Senza questa distinzione, in quelle ore la Dashboard — la schermata
 * che Alessio apre ogni mattina — mostrerebbe un avviso rosso per una
 * funzionalità che semplicemente non è ancora accesa. Un allarme che grida
 * su una cosa normale è un allarme che si impara a spegnere.
 *
 * ⚠️ E NON È IL SILENZIO CHE QUESTO PROGETTO VIETA: si riconosce **un caso
 * per nome** — PostgREST risponde `PGRST202` quando la funzione non è
 * nello schema, Postgres `42883` quando non esiste — e nient'altro.
 * Qualunque altro guasto continua a risalire e la schermata lo dichiara.
 * Sta qui e non dentro la chiamata perché si possa provare al contrario.
 */
export function nonAncoraAccesa(errore) {
  const codice = String(errore?.code ?? "");
  return codice === "PGRST202" || codice === "42883";
}
