import { classificaAllegato } from "./pec.js";

// ---------------------------------------------------------------------
// Le regole della Posta in arrivo — 28/08/2026
// ---------------------------------------------------------------------
//
// Stanno qui e non dentro la schermata per la ragione di sempre: una
// regola scritta dentro un `.jsx` si prova solo aprendo un browser, e
// quello che non si puo' rompere non si sa se funziona. Qui si rompe.
//
// 🔴 DA DOVE NASCONO. Il 28/08 la schermata della Posta e' stata APERTA
//    con dentro una mail che il lettore aveva abbandonato dopo tre
//    tentativi. Diceva, una frase sotto l'altra:
//      · «Non ancora letta — la lettura parte da sola entro un quarto
//        d'ora.»  -> FALSO: non partira' mai piu'.
//      · «Ho letto questa mail solo in parte…»  -> FALSO: non l'ha letta
//        affatto.
//      · «Apri l'allegato e controlla i dati a mano.»  -> quella mail non
//        ha nessun allegato.
//    Tre frasi false in quattro righe, e l'unico gesto offerto era
//    buttare via la mail. Su una diffida.

/** Il numero di tentativi oltre il quale il lettore si ferma, se il
 *  database non risponde. Il valore VERO vive in
 *  `service_settings.max_tentativi_lettura_posta`, e questo serve solo a
 *  non far sparire la schermata quando quella lettura fallisce.
 *  ⚠️ Non e' una seconda definizione: e' un ripiego dichiarato, e la
 *     schermata dice che sta ripiegando. */
export const TENTATIVI_DI_RIPIEGO = 3;

// =====================================================================
// QUALI CAMPI SI CORREGGONO, PER CIASCUN TIPO DI AZIONE
// =====================================================================
// Si vedono solo premendo «Correggi»: i campi servono a correggere,
// non a capire — quello che si legge e' la descrizione (critica di Alessio
// del 28/08).
//
// 🔴 «SOCIETA'» E' STATA AGGIUNTA IL 21/09/2026, e non e' un campo in piu':
// e' la meta' mancante di un difetto misurato. `esegui_azione_posta`
// chiamava `create_document` senza societa', quindi **ogni** documento nato
// da una mail ne restava privo — e nella schermata delle Fatture i documenti
// collegabili sono quelli della stessa societa' della fattura. Un valore
// assente non combacia mai: un DDT archiviato dalla posta non compariva fra
// i collegabili, per nessuna fattura, senza nessun errore.
//
// ⚠️ RESTA FACOLTATIVA, come nell'Archivio a mano. Renderla obbligatoria
// qui vorrebbe dire bloccare l'archiviazione di una mail per un dato che il
// modello non puo' sapere — e la regola di questo progetto e' che cio' che
// nessuno ha dichiarato resta vuoto e dichiarato, non indovinato.
export const CAMPI_AZIONE = {
  archivia_documento: ["titolo", "tipo", "societa", "controparte", "data", "importo", "scadenza"],
  archivia_testo: ["titolo", "tipo", "societa", "controparte", "data", "importo", "scadenza"],
  promemoria: ["titolo", "data", "note"],
  promemoria_multipli: [],
  da_fare_a_mano: ["titolo", "data"],
  // La fattura dalla PEC non si corregge: i dati sono quelli del file SdI
  // (08/11/2026). Chi vuole cambiarli la rifiuta e la registra a mano.
  registra_fattura: [],
  nessuna: [],
};

/** I tipi di azione che archiviano un documento, e che quindi hanno una
 *  societa' da conservare. */
export function azioneArchivia(tipo) {
  return tipo === "archivia_documento" || tipo === "archivia_testo";
}

/**
 * Da quanto tace, in parole.
 * ⚠️ Un numero di minuti a quattro cifre non dice niente a nessuno: «da 5
 *    giorni» sì, ed è la cosa che fa capire che non è un ritardo — è un
 *    guasto. Sul progetto di prova, il 28/08, erano 8374 minuti.
 */
export function daQuanto(minuti) {
  const m = Number(minuti);
  if (!Number.isFinite(m) || m < 1) return "poco";
  if (m < 60) return m === 1 ? "1 minuto" : `${m} minuti`;
  const ore = Math.floor(m / 60);
  if (ore < 24) return ore === 1 ? "1 ora" : `${ore} ore`;
  const giorni = Math.floor(ore / 24);
  return giorni === 1 ? "1 giorno" : `${giorni} giorni`;
}

/** Una data con l'ora, in italiano: serve a dire QUANDO, non solo COSA. */
export function quandoInItaliano(istante) {
  const d = new Date(istante);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * In che stato di lettura si trova una mail, detto come stanno le cose.
 *
 * ⚠️ Le risposte sono TRE e non due, ed e' tutto il punto: «la sto per
 *    leggere», «non la leggero' mai piu'» e «l'ho letta» si comportano
 *    in modo diverso e vanno dette in modo diverso. Prima erano due — e
 *    quella di mezzo si travestiva da prima.
 */
export function statoLettura(mail, maxTentativi = TENTATIVI_DI_RIPIEGO, lettore = null) {
  const tentativi = mail?.tentativi_lettura ?? 0;
  const letto = Number(maxTentativi) > 0;
  const tetto = letto ? Number(maxTentativi) : TENTATIVI_DI_RIPIEGO;

  if (mail?.stato !== "da_leggere") {
    // ⚠️ «Letta» va DETTA, non dedotta dalla presenza di una proposta qui
    //    sotto: quello è un modo indiretto, che si capisce solo sapendo già
    //    come funziona il gestionale. Alessio non riusciva a dire a colpo
    //    d'occhio se MEMO avesse letto una mail (28/08/2026).
    return {
      chiave: "letta",
      frase: mail?.proposta_il ? `Letta da MEMO il ${quandoInItaliano(mail.proposta_il)}.` : "Letta da MEMO.",
      puoRiprovare: false,
      puoLeggereAdesso: false,
    };
  }

  // 🔴 SE IL LETTORE NON STA GIRANDO, NON SI PROMETTE UN QUARTO D'ORA.
  //    Misurato il 28/08: tre mail sul progetto di prova dicevano da NOVE
  //    GIORNI «la lettura parte da sola entro un quarto d'ora», e sul quel
  //    gestionale non c'era nessun lavoro pianificato. La frase non era
  //    invecchiata: era falsa ogni volta che veniva mostrata.
  if (lettore?.fermo) {
    return {
      chiave: "lettore_fermo",
      frase:
        `MEMO non sta leggendo la posta su questo gestionale` +
        (lettore.minuti > 0 ? ` (fermo da ${daQuanto(lettore.minuti)})` : "") +
        `. Questa mail resterà così finché non gli chiedi tu di leggerla.`,
      puoRiprovare: false,
      puoLeggereAdesso: true,
    };
  }

  // 🔴 SE IL TETTO NON SI È POTUTO LEGGERE, NON SI INDOVINA.
  //    Ripiegare su tre sembra prudente e non lo è: se il numero vero
  //    fosse due, una mail ferma a due tentativi risulterebbe «in coda» —
  //    cioè tornerebbe esattamente la frase falsa che questo modulo
  //    esiste per togliere, entrata da un'altra porta.
  //    ⚠️ Una mail mai tentata invece si sa: nessun tetto la rende
  //       abbandonata, quindi lì il dubbio non c'è.
  if (!letto && tentativi > 0) {
    return {
      chiave: "non_so",
      frase:
        `MEMO ha già provato ${tentativi} volte a leggerla. Non riesco a dire se ci ` +
        `riproverà da solo: leggila tu qui sotto, oppure fagli fare un altro tentativo.`,
      puoRiprovare: true,
      puoLeggereAdesso: false,
    };
  }

  if (tentativi >= tetto) {
    return {
      chiave: "arresa",
      frase:
        `MEMO ha provato ${tentativi} volte e si è fermato: da solo non ci riprova più. ` +
        `Puoi leggerla tu qui sotto, oppure fargli fare un altro tentativo.`,
      puoRiprovare: true,
      puoLeggereAdesso: false,
    };
  }
  return {
    chiave: "in_coda",
    frase: "Non ancora letta — la lettura parte da sola entro un quarto d'ora.",
    puoRiprovare: false,
    puoLeggereAdesso: false,
  };
}

/**
 * Cosa c'è da leggere in questa mail, e come si dice quando non c'è.
 *
 * ⚠️ «Non si apre perché non c'è niente» e «non si apre perché il gesto
 *    non esiste» sono due difetti diversi con due cure diverse, e un
 *    elenco che non dice quale dei due sta capitando è esso stesso il
 *    difetto. Qui si distinguono.
 */
export function cosaCeDaLeggere(mail) {
  const testo = (mail?.testo ?? "").trim();
  const allegati = mail?.allegati ?? [];
  const apribili = allegati.filter((a) => a.storage_path);
  const rotti = allegati.filter((a) => !a.storage_path);
  return {
    haTesto: testo.length > 0,
    caratteri: testo.length,
    allegatiApribili: apribili.length,
    allegatiRotti: rotti.length,
    // Nessun testo E nessun allegato apribile: non è che il gesto manca,
    // è che non c'è niente da mostrare. Va detto, non lasciato in bianco.
    nulla: testo.length === 0 && apribili.length === 0,
  };
}

/**
 * La nota che il lettore lascia quando fallisce, riscritta senza dire
 * cose che non sono vere.
 *
 * La frase vecchia era una sola per due casi molto diversi: «Ho letto
 * questa mail solo in parte: … Apri l'allegato e controlla i dati a
 * mano». Su una mail letta a metà è giusta; su una abbandonata è falsa
 * due volte, e manda ad aprire un allegato che spesso non esiste.
 */
export function notaDiLettura(mail, statoDiLettura, quelloCheCe) {
  const nota = (mail?.lettura_note ?? "").trim();
  if (!nota) return null;
  if (statoDiLettura?.chiave === "arresa") {
    return {
      tono: "fermo",
      frase: `Perché si è fermato: ${nota.replace(/^lettura fallita[^:]*:\s*/i, "")}`,
    };
  }
  return {
    tono: "parziale",
    frase:
      `Ho letto questa mail solo in parte: ${nota}.` +
      (quelloCheCe?.allegatiApribili > 0
        ? " Apri l'allegato qui sopra e controlla i dati a mano."
        : " Controlla i dati a mano prima di confermare."),
  };
}

/**
 * L'etichetta di un pulsante che conferma: dice COSA succede a COSA.
 *
 * 🔴 Misurato a schermo il 28/08: dei 10 pulsanti della Posta, 5 non
 *    nominavano l'oggetto dell'azione — «Conferma» due volte, «No» due
 *    volte, «modifica». Sono quelli che decidono se un documento entra
 *    in archivio o se della merce entra in magazzino.
 *
 * ⚠️ Il nome dell'oggetto si ACCORCIA, non si taglia via: un pulsante che
 *    manda a capo tre volte su un telefono è illeggibile quanto uno che
 *    non dice niente.
 */
export function etichettaConferma(azione, parametri) {
  const p = parametri ?? {};
  const corto = (t, max = 28) => {
    const s = String(t ?? "").trim();
    if (!s) return "";
    return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
  };

  switch (azione?.tipo) {
    case "carico_magazzino": {
      const n = (p.righe ?? []).filter(
        (r) => !r?.salta && !r?.ignora && r?.ingrediente_id && Number(r?.quantita) > 0
      ).length;
      const merce = n === 1 ? "1 riga" : `${n} righe`;
      return `Metti ${merce} in magazzino`;
    }
    case "archivia_documento":
    case "archivia_testo": {
      const t = corto(p.titolo || azione?.titolo);
      return t ? `Archivia «${t}»` : "Archivia il documento";
    }
    case "promemoria": {
      const t = corto(p.titolo || azione?.titolo);
      return t ? `Metti in agenda «${t}»` : "Metti in agenda";
    }
    case "promemoria_multipli": {
      const n = (p.scadenze ?? []).length;
      if (n === 0) return "Metti le scadenze in agenda";
      return n === 1 ? "Metti 1 scadenza in agenda" : `Metti ${n} scadenze in agenda`;
    }
    case "da_fare_a_mano": {
      const t = corto(p.titolo || azione?.titolo);
      return t ? `Segnati «${t}»` : "Segnati questa cosa da fare";
    }
    case "registra_fattura": {
      const n = corto(p.fattura?.numero, 16);
      return n ? `Registra la fattura n. ${n}` : "Registra la fattura";
    }
    default: {
      const t = corto(azione?.titolo);
      return t ? `Conferma «${t}»` : "Conferma";
    }
  }
}

/** Il rifiuto, detto come il suo gemello: nomina cosa non si farà. */
export function etichettaRifiuto(azione) {
  switch (azione?.tipo) {
    case "carico_magazzino":
      return "Non caricare";
    case "archivia_documento":
    case "archivia_testo":
      return "Non archiviare";
    case "promemoria":
    case "promemoria_multipli":
      return "Non mettere in agenda";
    case "registra_fattura":
      return "Non registrarla";
    default:
      return "Non farlo";
  }
}

/**
 * Perché questo carico non si può confermare — o `null` se si può.
 *
 * 🔴 Misurato il 28/08: la stessa dicitura, scritta una volta senza
 *    fornitore e una volta con, produce DUE righe in
 *    `articoli_fornitore`. La memoria costruita da un carico senza
 *    fornitore non si ricongiunge mai con quella vera, lo storico prezzi
 *    si spacca in due e la sorveglianza dei rincari resta muta su quei
 *    prodotti — senza nessun errore.
 *
 * ⚠️ Il rifiuto vero vive nel database: questo serve a spegnere il
 *    pulsante CON LA RAGIONE, invece di lasciarlo premere per essere
 *    rifiutato. Non è una seconda regola, è la stessa detta prima.
 */
/**
 * Perché questa azione non si può confermare — o `null` se si può.
 *
 * 🔴 L'ARCHIVIO nasce da una prova con le mani di Alessio (28/08/2026): ha
 *    aperto una proposta, ha trovato i sei campi vuoti, ha premuto
 *    «Archivia» così com'era, e **il gestionale ha archiviato senza
 *    rifiutare e senza avvisare**. Nell'Archivio quella riga ha solo il
 *    titolo: non compare cercando per tipo, non ha un posto nel tempo, e si
 *    ritrova soltanto ricordandone le parole esatte.
 *
 * ⚠️ Il rifiuto VERO vive nel database (un vincolo sulla tabella, che copre
 *    tutte e tre le porte da cui nasce un documento). Questo serve a
 *    spegnere il pulsante CON LA RAGIONE invece di lasciarlo premere per
 *    essere rifiutato: non è una seconda regola, è la stessa detta prima.
 */
export function motivoAzioneBloccata(azione, parametri, sezioniVere = null) {
  if (azioneArchivia(azione?.tipo)) {
    const p = parametri ?? {};
    const senzaTipo = !String(p.tipo ?? "").trim();
    const senzaData = !String(p.data ?? "").trim();
    // 🔴 11/11/2026: una sezione che non esiste passava fino al database, che
    //    la rifiutava al momento del sì (`documents_doc_type_fkey`). Se
    //    l'elenco vero si è letto, si spegne il pulsante prima, con la ragione.
    const tipo = String(p.tipo ?? "").trim();
    if (tipo && Array.isArray(sezioniVere) && sezioniVere.length > 0 && !sezioniVere.includes(tipo)) {
      return `La sezione «${tipo}» non esiste nell'archivio: premi «Correggi» e scegline una dall'elenco.`;
    }
    if (senzaTipo && senzaData) {
      return "Prima di archiviarlo servono la sezione e la data: premi «Correggi», scegli la sezione e scrivi la data.";
    }
    if (senzaTipo) {
      return "Manca la sezione dell'archivio: premi «Correggi» e scegline una. MEMO non l'ha saputa dire da solo.";
    }
    if (senzaData) {
      return "Manca la data del documento: premi «Correggi» e scrivila.";
    }
    return null;
  }
  return motivoCaricoBloccato(azione, parametri);
}

export function motivoCaricoBloccato(azione, parametri) {
  if (azione?.tipo !== "carico_magazzino") return null;
  const p = parametri ?? {};
  const righe = (p.righe ?? []).filter(
    (r) => !r?.salta && !r?.ignora && r?.ingrediente_id && Number(r?.quantita) > 0
  );

  // ⚠️ L'ORDINE NON È INDIFFERENTE, e la prima versione lo aveva
  //    invertito — visto aprendo la schermata, non rileggendo il codice.
  //    Su una proposta con ZERO righe la schermata diceva «scegli il
  //    fornitore»: uno lo sceglie, e non cambia niente, perché il
  //    problema era un altro. **Prima si nomina la causa che l'altra
  //    non può risolvere**: senza righe, il fornitore è irrilevante.
  if (righe.length === 0) {
    return "Non c'è niente da mettere in magazzino: nessuna riga di questa mail ha un prodotto abbinato con una quantità. Apri il documento e controlla, oppure rifiuta la proposta.";
  }
  if (!p.fornitore_id) {
    return "Scegli il fornitore qui sotto: senza, il gestionale non riconoscerebbe gli stessi prodotti la prossima volta e smetterebbe di avvisarti sui rincari.";
  }
  return null;
}

// =====================================================================
// LA POSTA A RIGHE — 08/11/2026
// =====================================================================
// Alessio, guardando la Posta con le prime PEC vere: ogni mail era un
// blocco lungo e tutto aperto, quelle da decidere mescolate con quelle già
// sistemate, i file tecnici della PEC in vista, note rosse che parlavano
// di «application/xml», riquadri «Niente — Senza titolo» e pulsanti lunghi
// una riga. Da qui: una riga per mail con un bollino, tre schede, solo gli
// allegati veri, gli avvisi solo quando tocca a lui. Modello approvato
// l'08/11.

/** I file che non sono il contenuto di una mail ma la sua busta: la PEC
 *  (daticert, smime, postacert.eml, le ricevute) e lo SdI (metadati
 *  `_MT_`, notifiche `_RC_`, `_NS_`, `_MC_`, …). */
const RICEVUTE_SDI = /_(RC|NS|MC|NE|DT|AT|EC|SE)_\d+\.xml$/i;
const BUSTA_PEC = /^(postacert\.eml|submissionacceptance[^/]*\.xml|deliveryreceipt[^/]*\.xml)$/i;

/** Un allegato che fa parte della busta e non del contenuto. */
export function allegatoTecnico(nome) {
  const n = String(nome ?? "").trim();
  const c = classificaAllegato(n);
  return c === "tecnico" || c === "metadati_sdi" || RICEVUTE_SDI.test(n) || BUSTA_PEC.test(n);
}

/** Gli allegati divisi fra quelli da mostrare e quelli tecnici, nascosti. */
export function allegatiDaMostrare(allegati) {
  const visibili = [];
  const tecnici = [];
  for (const a of allegati ?? []) (allegatoTecnico(a?.file_name) ? tecnici : visibili).push(a);
  return { visibili, tecnici };
}

/**
 * La nota di lettura detta in italiano semplice, senza i file tecnici.
 *
 * La nota la scrive `posta-leggi` come «nome: motivo; nome: motivo». Le
 * mail arrivate prima della lettura delle PEC portano ancora righe come
 * «daticert.xml: formato che non so aprire (application/xml)»: i file
 * della busta si tacciono, gli altri si dicono senza il tipo tecnico.
 * Se non resta niente, nessuna nota.
 *
 * @param {string|null|undefined} nota
 * @returns {string|null}
 */
export function notaInChiaro(nota) {
  const pezzi = String(nota ?? "")
    .split(/;\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const detti = [];
  for (const p of pezzi) {
    const m = p.match(/^(.+?):\s*(.+)$/);
    if (!m) {
      detti.push(p);
      continue;
    }
    const [, nome, motivo] = m;
    if (allegatoTecnico(nome)) continue;
    if (/formato che non so aprire/i.test(motivo)) detti.push(`non sono riuscito ad aprire «${nome}»`);
    else detti.push(`«${nome}»: ${motivo.replace(/\s*\([^)]*\/[^)]*\)\s*$/, "")}`);
  }
  if (!detti.length) return null;
  const frase = detti.join("; ");
  return frase.charAt(0).toUpperCase() + frase.slice(1) + ".";
}

/**
 * Lo stato di una mail, per il bollino e per la scheda.
 *
 * - `guarda`: tocca a lui (MEMO si è fermato, o non sta leggendo);
 * - `in_lettura`: MEMO la leggerà da solo;
 * - `decidere`: c'è almeno una proposta da confermare o rifiutare;
 * - `fatto`: è sistemata, con almeno una cosa fatta;
 * - `niente`: letta, e non c'è niente da fare (solo «nessuna», o tutto rifiutato).
 *
 * @param {{stato?: string, azioni?: Array<{tipo?: string, stato?: string}>}} mail
 * @param {{chiave?: string}} [lettura] il risultato di `statoLettura`
 */
export function statoDellaMail(mail, lettura) {
  if (mail?.stato === "archiviata") return "fatto";
  // Messa da parte da una regola del filtro, prima di MEMO (11/11/2026).
  // 🔴 E l'avviso arrivato alla casella della banca (12/11/2026,
  //    20261112000008): nasce scartato con «Avviso della banca: …». Senza
  //    questa riga la sua nota passerebbe da `notaInChiaro`, che la legge
  //    come «allegato: motivo» e la storpia.
  if (
    mail?.stato === "scartata" &&
    (mail?.filtrata_da || /^(Filtrata prima di MEMO|Avviso della banca)/.test(mail?.lettura_note ?? ""))
  ) {
    return "filtrata";
  }
  if (mail?.stato === "da_leggere") {
    return ["arresa", "lettore_fermo", "non_so"].includes(lettura?.chiave) ? "guarda" : "in_lettura";
  }
  const azioni = mail?.azioni ?? [];
  if (azioni.some((a) => a.stato === "proposta" && a.tipo !== "nessuna")) return "decidere";
  if (azioni.some((a) => a.stato === "fatta")) return "fatto";
  return "niente";
}

/** Il bollino di ogni stato: testo, non solo colore. */
export const BOLLINO_POSTA = {
  guarda: "Da guardare",
  in_lettura: "In lettura",
  decidere: "Da decidere",
  fatto: "Fatto",
  niente: "Niente da fare",
  filtrata: "Filtrata",
};

/** In quale scheda sta una mail: «Da decidere» raccoglie tutto ciò che non è chiuso. */
export function inScheda(stato, scheda) {
  if (scheda === "tutte") return true;
  const aperta = stato === "decidere" || stato === "guarda" || stato === "in_lettura";
  return scheda === "decidere" ? aperta : !aperta;
}

/**
 * Quante mail della lista starebbero nella scheda «Da decidere» (12/11/2026).
 * Serve alla Dashboard e al pulsante di Documenti: stessa regola della
 * pagina Posta, così il numero fuori è il numero dentro.
 * ⚠️ La lettura qui non si conosce e non serve: una mail `da_leggere` è
 *    aperta sia come «guarda» sia come «in_lettura».
 */
export function contaDaDecidere(mail) {
  return (mail ?? []).filter((m) => inScheda(statoDellaMail(m, null), "decidere")).length;
}

/**
 * Il verbo corto del pulsante che conferma. Il nome completo
 * (`etichettaConferma`) resta per i lettori di schermo e come titolo
 * della proposta: il pulsante non deve andare a capo su un telefono.
 */
export function verboConferma(azione) {
  switch (azione?.tipo) {
    case "carico_magazzino":
      return "Carica";
    case "archivia_documento":
    case "archivia_testo":
      return "Archivia";
    case "promemoria":
    case "promemoria_multipli":
      return "Metti in agenda";
    case "da_fare_a_mano":
      return "Segnatelo";
    case "registra_fattura":
      return "Registra";
    default:
      return "Conferma";
  }
}

/**
 * Il nome per il lettore di schermo di un pulsante corto: comincia sempre
 * con le parole che si vedono, così chi comanda a voce («clic Carica»)
 * trova il pulsante (WCAG 2.5.3, revisione ECC dell'08/11).
 */
export function conVerboDavanti(verbo, nomeIntero) {
  const v = String(verbo ?? "").trim();
  const n = String(nomeIntero ?? "").trim();
  if (!n || n === v) return v;
  return n.toLowerCase().startsWith(v.toLowerCase()) ? n : `${v}: ${n}`;
}

// =====================================================================
// IL FILTRO PRIMA DI MEMO — 11/11/2026
// =====================================================================
// Le stesse letture del database (`posta_indirizzo`, `posta_tipo_oggetto`,
// `posta_protetta`, migrazione 20261111000001): servono alla Posta per far
// vedere PRIMA cosa farà il tasto «Ignora le mail come questa». Decide il
// database; qui si mostra. Le prove tengono le due versioni uguali.

/** «Credem <businesson@credem.it>» → «businesson@credem.it». */
export function indirizzoMittente(mittente) {
  const s = String(mittente ?? "");
  const m = s.match(/<([^<>]+)>/);
  const v = (m ? m[1] : s).trim().toLowerCase();
  return v || null;
}

/** L'oggetto ripulito: minuscole, senza «R:»/«Fwd:», cifre come «#». */
export function tipoOggetto(oggetto) {
  const v = String(oggetto ?? "")
    .toLowerCase()
    .replace(/^(\s*(posta certificata|r|re|fw|fwd|i|inoltro)\s*:\s*)+/, "")
    .replace(/[0-9]+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
  return v || null;
}

/** Lo SdI e il gestore PEC: non si filtrano mai. */
export function mittenteProtetto(indirizzo) {
  const v = String(indirizzo ?? "");
  return v.endsWith("fatturapa.it") || v.startsWith("posta-certificata@");
}

/** Cosa filtrerà una regola, detto in italiano. */
export function descriviRegola({ mittente, oggetto_tipo, modo = "uguale" }) {
  if (!oggetto_tipo) return `tutte le mail da ${mittente}`;
  if (modo === "inizia") return `da ${mittente} con oggetto che comincia per «${oggetto_tipo}»`;
  if (modo === "contiene") return `da ${mittente} con «${oggetto_tipo}» nell'oggetto`;
  return `da ${mittente} con oggetto «${oggetto_tipo}»`;
}
