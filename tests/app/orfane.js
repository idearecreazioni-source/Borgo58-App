// =====================================================================
// QUALI FUNZIONI CI SI ASPETTA SENZA PORTA — 17/09/2026
// =====================================================================
// 🔴 PERCHE' QUESTO FILE ESISTE, ed e' un difetto misurato sulla proposta
//    #94. L'elenco delle funzioni «costruite e senza una schermata» era una
//    cosa sola, e diceva **cosa c'e' nel database**. Ma una funzione che
//    arriva con una migrazione non ancora applicata **nel database non
//    c'e'**: iscriverla fa gridare la rete («questa ha una porta adesso,
//    toglila»), e non iscriverla la fa gridare il giorno dopo l'applicazione
//    («questa non e' dichiarata»).
//    ⚠️ Non e' un difetto della rete ne' del lavoro: e' che l'elenco
//    rispondeva a **due domande diverse** con una risposta sola — cosa c'e'
//    adesso, e cosa ci sara'. Fra i due momenti non possono essere d'accordo,
//    per costruzione.
//
// ⚠️ LA DECISIONE STA QUI E NON DENTRO LA PROVA, per poterla provare: dentro
//    la prova contro il database l'unico modo di metterla alla prova sarebbe
//    avere due database, uno con la migrazione e uno senza. Qui invece si
//    prova su due elenchi inventati — e' `tests/unita/orfane-attese.test.js`.
//
// ⚠️ NESSUNA DIPENDENZA, APPOSTA: questo file lo importa anche una prova
//    pura, che gira senza chiavi e senza rete. Tirarsi dietro `aiuto.js`
//    vorrebbe dire pretendere i segreti del progetto di prova per rispondere
//    a una domanda che non ne ha bisogno.

/**
 * 🔴 LO STATO DI PARTENZA, misurato il 31/08/2026 e congelato.
 *
 * ⚠️ QUESTE NON SONO ASSOLTE: sono **fotografate**. Una riga si toglie da qui
 * quando la funzione riceve la sua porta — e toglierla e' il gesto che
 * dichiara che il debito e' stato pagato.
 */
export const ORFANE_SEMPRE = {
  // Vivono in una funzione online: la porta c'e', passa da un'altra strada.
  archivia_posta: "chiamata da posta-leggi",
  documenti_per_domanda: "chiamata da assistente-archivio",
  registra_dettatura: "chiamata da ascolta-voce",
  registra_dettatura_da_chiave: "chiamata da ascolta-voce (la Scorciatoia)",
  registra_lettura_foto: "chiamata da leggi-foto",
  voce_apri_sessione: "chiamata da ascolta-voce",

  // Sono RETI: esistono per essere interrogate da una prova, non da una
  // schermata. Una porta a schermo non avrebbe senso.
  colonne_unita_non_classificate: "rete: il censimento delle unita'",
  confronti_storti: "rete: i confronti di data col fuso sbagliato",
  funzioni_aperte_ad_anon: "rete: chi puo' bussare da fuori",
  funzioni_col_portiere: "rete: chi controlla chi chiama",
  funzioni_con_data_utc: "rete: le date chieste a Greenwich",
  funzioni_multi_tabella: "rete: le scritture che devono passare dal corridoio",
  lapidi_di_prova: "rete: le tracce finte nel registro",
  // ⚠️ AGGIUNTA IL 15/09/2026: la domanda stretta di registri-esibibili, che
  //    chiede solo le verifiche invece di scaricare tutto il registro.
  lapidi_delle_verifiche: "rete: le sole tracce delle verifiche nel registro",
  tipi_vocali_senza_ramo: "rete: i comandi vocali che il gestionale non sa eseguire",
  vincoli_senza_frase: "rete: i rifiuti che non parlano italiano",
  funzioni_senza_chiamante: "rete: questa stessa — chi non ha un chiamante nel database",
  // 🔴 AGGIUNTA IL 22/09/2026, e non perché sia cambiata lei: perché è
  //    cambiato il setaccio. Fino a oggi questa rete leggeva anche i
  //    COMMENTI di `src/`, e `guardie_vocabolario()` è nominata lì dentro in
  //    un posto solo — il commento in cima a `src/lib/calcoli/vocabolari.js`
  //    che spiega dove vive la regola. Bastava quella riga a farla sembrare
  //    raggiungibile.
  //    ⚠️ Non era una porta: nessuna schermata la chiama, e a interrogarla è
  //    `tests/app/vocabolari.test.js`. Cioè è una RETE come le tredici qui
  //    sopra, ed è sempre stata in quella categoria — solo che nessuno
  //    poteva vederlo.
  guardie_vocabolario: "rete: i tre posti dove vive un vocabolario chiuso",
  // ⚠️ AGGIUNTA IL 05/09/2026 con la correzione RLS delle viste economiche.
  //    Non e' un debito e non e' una porta che manca: e' una RETE, come le
  //    dieci qui sopra. La interroga `tests/app/permessi.test.js` col token
  //    del titolare, e il portiere ce l'ha — RIFIUTA chi titolare non e',
  //    invece di rispondere un elenco vuoto. Una porta a schermo non
  //    avrebbe senso: dice com'e' fatto il database, non cosa succede in
  //    sala.
  viste_che_scavalcano_rls: "rete: quali viste non applicano la RLS di chi le interroga",

  // 🔴 QUI STAVA `send_due_task_reminders`, ed è uscita il 20/09/2026 —
  //    non perché qualcuno le abbia costruito una schermata, ma perché
  //    adesso **dall'app non la può chiamare nessuno**: la 20260920000004 la
  //    chiude con un `revoke` verso `authenticated`, e questa rete guarda
  //    solo ciò che un utente del gestionale può eseguire.
  //    ⚠️ La riga vecchia diceva «lavoro pianificato: lo chiama pg_cron», ed
  //    era vera: la chiama ancora pg_cron ogni cinque minuti. Quello che è
  //    cambiato è che PRIMA la poteva chiamare anche chi aveva fatto il
  //    login — cioè un gesto che nessuna schermata offriva, ed era proprio
  //    ciò che la faceva comparire fra le orfane. Adesso quella porta non
  //    c'è più, e il debito è pagato: lasciarla iscritta racconterebbe un
  //    debito che non esiste (è la regola dichiarata in cima a questa prova).
  // Misurato su Prova il 20/09, chiedendolo al database come titolare:
  //   has_function_privilege('authenticated', …) = false
  //   funzioni_senza_chiamante() → 212 righe, e lei non c'è più.

  // Interrogata da uno script a riga di comando.
  numeri_sospetti: "interrogata da `npm run numeri`",

  // ⚠️ QUI STAVANO `carta_da_ristampare` e `segna_carta_stampata`, rimandate
  //    da Alessio il 31/08 in attesa di etichette vere. Il 16/09 la schermata
  //    e' stata costruita e le due righe sono uscite: toglierle e' il gesto
  //    che dichiara pagato il debito, e lasciarle sarebbe stato l'errore
  //    contrario — un elenco che racconta un debito che non c'e' piu'. La
  //    storia sta nel commento in cima alla prova, dove serve a chi legge.

  // 🔴 DEBITI VERI, e sono quelli per cui questa rete esiste. Ognuno e' una
  //    cosa che il gestionale sa fare e che nessuno puo' chiedergli.
  conti_senza_quadratura: "DEBITO: nessuna schermata mostra i conti che non quadrano",
  coperti_per_linea: "DEBITO: i coperti divisi per linea di ricavo non si vedono",
  numeri_fuori_intervallo: "DEBITO: i numeri fuori scala non hanno una schermata",
  scale_che_non_tornano: "DEBITO: le scale incoerenti non hanno una schermata",
  sprechi_e_resi: "DEBITO: sprechi e resi non hanno una schermata che li elenchi",
  tipi_vocali_senza_uscita: "DEBITO: nessuna schermata mostra i comandi vocali senza via d'uscita",
};

/**
 * 🔴 QUELLE CHE ENTRANO CON UNA MIGRAZIONE, e che quindi si aspettano SOLO
 *    nei database dove quella migrazione e' gia' stata applicata.
 *
 * ⚠️ La versione non e' una data di comodo: e' la chiave con cui la
 *    migrazione si registra in `applied_migrations`. Chiedere al database
 *    quali versioni ha e' l'unico modo di sapere in quale dei due momenti si
 *    trova — e sapere e' il contrario di indovinare.
 */
// 🔴 OGGI E' VUOTO, E IL PERCHE' VA LETTO — 18/09/2026.
//    Qui dentro stava `raccogli_esiti_promemoria`, iscritta il 17/09 come
//    orfana attesa a partire dalla 20260917000001. **La previsione era
//    sbagliata, e a dirlo e' stato il database**: applicata la migrazione su
//    Borgo58-Prova, quella funzione NON risulta senza chiamante, perche' la
//    migrazione le da' una porta — il lavoro di `pg_cron` che la chiama ogni
//    cinque minuti. La rete ha gridato «questa ha una porta adesso», che e'
//    esattamente il verso in cui doveva gridare.
// ⚠️ Resta vuoto e non sparisce: e' il posto dove iscrivere la PROSSIMA
//    funzione che entrera' davvero senza chiamante, e la prova qui accanto
//    continua a sorvegliarne la forma su un elenco inventato.
export const ORFANE_PIANIFICATE = {
  // ⚠️ Le chiama il passo iniziale delle prove sul database
  //    (`tests/app/silenzio-globale.js`), non una schermata: aprono e chiudono
  //    il silenzio Telegram di Prova mentre girano i controlli automatici.
  //    Una porta a schermo non avrebbe senso — Alessio non zittisce niente a
  //    mano, e fuori da Borgo58-Prova il database le rifiuta comunque.
  // ⚠️ PIANIFICATE e non SEMPRE: la 20260919000001 e' applicata su Prova e non
  //    in produzione, e la rete deve aspettarsele solo dove la migrazione c'e'.
  apri_silenzio_notifiche: {
    versione: "20260919000001",
    perche: "la chiama l'avvio delle prove sul database: apre il silenzio Telegram di Prova",
  },
  chiudi_silenzio_notifiche: {
    versione: "20260919000001",
    perche: "la chiama la fine delle prove sul database: chiude il proprio silenzio",
  },
};

/**
 * L'elenco delle orfane attese in UN database, viste le sue migrazioni.
 *
 * ⚠️ Riceve le versioni invece di andarsele a prendere: e' cio' che la rende
 *    provabile su elenchi inventati, senza un database acceso.
 */
// ⚠️ IL SECONDO ARGOMENTO ESISTE PER LE PROVE, e non e' un'opzione da usare
//    altrove: senza, la decisione si potrebbe provare solo finche' l'elenco
//    vero contiene qualcosa — cioe' la prova morirebbe il giorno in cui
//    l'elenco si svuota. E' successo il 18/09.
export function orfaneAttese(versioniApplicate, pianificate = ORFANE_PIANIFICATE) {
  const viste = new Set(versioniApplicate ?? []);
  const entrate = Object.entries(pianificate)
    .filter(([, v]) => viste.has(v.versione))
    .map(([nome, v]) => [nome, v.perche]);
  return { ...ORFANE_SEMPRE, ...Object.fromEntries(entrate) };
}
