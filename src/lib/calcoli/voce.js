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
 * Un gesto che non si può ripetere finché il primo non è finito.
 *
 * 🔴 PERCHÉ NON BASTA IL PULSANTE SPENTO. Spegnere il pulsante è una cosa
 * che succede al render dopo; fra il tocco e il render ci sono
 * millisecondi in cui il pulsante è ancora acceso, e chi non vede
 * succedere niente ripreme. **Alessio l'ha fatto**, la notte del 27/08,
 * su un movimento di cassa.
 *
 * ⚠️ Il database ha già l'ultima parola — una cosa dettata passa a
 * «eseguita» sotto blocco, e la seconda conferma viene respinta. Questa
 * guardia serve al gesto, non al dato: **toglie il secondo giro di rete e
 * il secondo messaggio d'errore**, che è quello che confonde chi guarda.
 *
 * ⚠️ Sta qui e non dentro la schermata perché si possa provare: una regola
 * dentro un componente si prova solo aprendo quel componente, e in questo
 * progetto nessuna prova automatica guarda uno schermo.
 */
export function unaVoltaSola() {
  const inCorso = new Set();
  return {
    /** true se il gesto è partito adesso; false se era già in corso. */
    prendi(chiave) {
      if (inCorso.has(chiave)) return false;
      inCorso.add(chiave);
      return true;
    },
    lascia(chiave) {
      inCorso.delete(chiave);
    },
    quanti() {
      return inCorso.size;
    },
  };
}

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

// =====================================================================
// PERCHÉ IL MICROFONO NON C'È — 27/08/2026
// =====================================================================
// 🔴 IL DIFETTO, visto da Alessio con le sue mani sull'iPhone alle 00:29:
//    la schermata diceva «Questo browser non sa trascrivere la voce. Su
//    iPhone serve Safari» **mentre lui era su Safari**. Una diagnosi
//    falsa, e un vicolo cieco: gli dice di fare una cosa che ha già fatto.
//
// 🔴 E LA PRIMA CORREZIONE ERA SBAGLIATA A SUA VOLTA. Diceva che a
//    mancare era l'**icona della schermata Home**. Non era vero: era
//    un'ipotesi che somigliava alla causa, ed è stata scambiata per la
//    causa perché un fatto vicino tornava (l'app *è* configurata per
//    aprirsi in finestra separata). ⚠️ Un fatto vicino non è una prova.
//
// ✅ LA CAUSA VERA, misurata da Alessio con le sue mani la stessa notte:
//    dallo stesso iPhone e dallo stesso Safari, su `http://<indirizzo>:5173`
//    il microfono non parte, su `https://<nome>.ts.net` parte e detta. **A
//    cambiare è stato solo il protocollo.** I browser danno il microfono
//    soltanto in **contesto sicuro** — una pagina cifrata, con l'unica
//    eccezione di `localhost`, che è il motivo per cui sul computer ha
//    sempre funzionato e nessuno se n'era accorto.
//
// ⚠️ QUINDI NON SI GUARDA NESSUN NOME DI BROWSER, e nemmeno si deduce.
//    Si guardano tre fatti, tutti osservabili:
//      (1) la capacità c'è o no;
//      (2) la pagina è in contesto sicuro o no;
//      (3) gira da icona o dentro un browser.
//    Il nome del browser non compare in nessun ramo, ed è voluto: dedurre
//    il nome è precisamente ciò che ha prodotto il primo difetto.
//
// ⚠️ L'ORDINE NON È INDIFFERENTE. Il contesto non cifrato viene **prima**
//    dell'icona: una pagina aperta da icona su un indirizzo non cifrato ha
//    due cose che non vanno, e quella che si toglie è l'indirizzo. Dire
//    «apri dal browser» a chi è su `http` lo manderebbe a rifare lo stesso
//    gesto con lo stesso esito.
//
// ⚠️ LA COSA CHE TOGLIE L'ANSIA VA DETTA IN TUTTI I CASI: la Scorciatoia
//    dall'orologio **non passa dal browser**, quindi quella continua a
//    funzionare. Chi legge «non sa trascrivere la voce» smette di provare
//    anche l'altra strada.

/**
 * La pagina è in contesto sicuro? — cioè il browser le darebbe il microfono.
 *
 * ⚠️ Si crede a `isSecureContext`, che è il browser stesso a dichiarare, e
 *    solo se manca si guarda il protocollo. `localhost` è sicuro anche in
 *    chiaro: è l'eccezione prevista dagli standard, e la ragione per cui
 *    dal computer non si è mai visto niente.
 */
export function inContestoSicuro(finestra = typeof window !== "undefined" ? window : null) {
  if (!finestra) return true;
  if (typeof finestra.isSecureContext === "boolean") return finestra.isSecureContext;
  const protocollo = finestra.location?.protocol;
  const nome = finestra.location?.hostname ?? "";
  if (!protocollo) return true;
  if (protocollo === "https:" || protocollo === "file:") return true;
  return nome === "localhost" || nome === "127.0.0.1" || nome === "[::1]" || nome.endsWith(".localhost");
}

/**
 * In che condizione si trova la dettatura, e cosa dire a chi guarda.
 *
 * Restituisce `{ caso, frase, cosaFare }`; `caso` è uno di:
 *   · `c_e`          — il microfono c'è, non si dice niente;
 *   · `non_cifrato`  — l'indirizzo non è protetto, e i browser lì il
 *                      microfono non lo danno a nessuno;
 *   · `da_icona`     — la pagina gira dall'icona salvata, e da lì il
 *                      riconoscimento non c'è: si apre nel browser;
 *   · `browser`      — questo browser non lo sa fare davvero.
 */
export function statoDettatura(finestra = typeof window !== "undefined" ? window : null) {
  if (riconoscitoreDisponibile(finestra)) {
    return { caso: "c_e", frase: null, cosaFare: null };
  }

  const laScorciatoia =
    "La Scorciatoia dall'orologio non passa da qui e continua a funzionare, e tutto il resto del gestionale anche.";

  // 🔴 Prima di tutto: l'indirizzo. È la causa misurata, ed è anche quella
  //    che si toglie — le altre due si constatano e basta.
  if (!inContestoSicuro(finestra)) {
    return {
      caso: "non_cifrato",
      frase:
        "Il microfono non parte perché questa pagina è aperta con un indirizzo non protetto: i browser danno il microfono solo alle pagine protette.",
      cosaFare: `Apri il gestionale con l'indirizzo che comincia per https, oppure usalo dal computer. ${laScorciatoia}`,
    };
  }

  // Non è un controllo sul sistema operativo: è «questa pagina gira come
  // un'app installata invece che dentro un browser».
  const daIcona = Boolean(
    finestra &&
      (finestra.navigator?.standalone === true ||
        finestra.matchMedia?.("(display-mode: standalone)")?.matches),
  );

  if (daIcona) {
    return {
      caso: "da_icona",
      frase:
        "Il microfono non è disponibile perché il gestionale è aperto dall'icona salvata sulla schermata Home.",
      cosaFare: `Apri borgo58.it nel browser — non dall'icona — e il pulsante funziona. ${laScorciatoia}`,
    };
  }

  return {
    caso: "browser",
    frase: "Questo browser non sa trascrivere la voce.",
    cosaFare: `Sul telefono apri il gestionale con Safari, sul computer con Google Chrome. ${laScorciatoia}`,
  };
}
