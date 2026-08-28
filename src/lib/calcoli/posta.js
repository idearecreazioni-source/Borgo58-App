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

/**
 * In che stato di lettura si trova una mail, detto come stanno le cose.
 *
 * ⚠️ Le risposte sono TRE e non due, ed e' tutto il punto: «la sto per
 *    leggere», «non la leggero' mai piu'» e «l'ho letta» si comportano
 *    in modo diverso e vanno dette in modo diverso. Prima erano due — e
 *    quella di mezzo si travestiva da prima.
 */
export function statoLettura(mail, maxTentativi = TENTATIVI_DI_RIPIEGO) {
  const tentativi = mail?.tentativi_lettura ?? 0;
  const letto = Number(maxTentativi) > 0;
  const tetto = letto ? Number(maxTentativi) : TENTATIVI_DI_RIPIEGO;

  if (mail?.stato !== "da_leggere") {
    return { chiave: "letta", frase: null, puoRiprovare: false };
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
    };
  }

  if (tentativi >= tetto) {
    return {
      chiave: "arresa",
      frase:
        `MEMO ha provato ${tentativi} volte e si è fermato: da solo non ci riprova più. ` +
        `Puoi leggerla tu qui sotto, oppure fargli fare un altro tentativo.`,
      puoRiprovare: true,
    };
  }
  return {
    chiave: "in_coda",
    frase: "Non ancora letta — la lettura parte da sola entro un quarto d'ora.",
    puoRiprovare: false,
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
export function motivoAzioneBloccata(azione, parametri) {
  if (azione?.tipo === "archivia_documento" || azione?.tipo === "archivia_testo") {
    const p = parametri ?? {};
    const senzaTipo = !String(p.tipo ?? "").trim();
    const senzaData = !String(p.data ?? "").trim();
    if (senzaTipo && senzaData) {
      return "Prima di archiviarlo servono il tipo e la data: premi «Correggi i dati» e scrivili. Senza, il documento non compare cercando per tipo e finisce in fondo all'elenco — si ritrova solo ricordandone il titolo esatto.";
    }
    if (senzaTipo) {
      return "Manca il tipo del documento: premi «Correggi i dati» e scrivilo, altrimenti non comparirà cercando «contratti» o «fatture».";
    }
    if (senzaData) {
      return "Manca la data del documento: premi «Correggi i dati» e scrivila, altrimenti finisce in fondo all'elenco senza un posto nel tempo.";
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
