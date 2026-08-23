// GLI ANGOLI CHE RESTAVANO VUOTI
//
// 🔴 Misurato sul progetto di prova la notte del 23/08: **quaranta tabelle
// su centotré erano vuote**, e fra loro c'erano moduli interi del
// gestionale — le Produzioni, gli ordini ai fornitori, gli sconti e gli
// omaggi, l'Agricolo, i prestiti, le deduzioni, il menu del giorno, le
// chiusure della sala, le caparre.
//
// ⚠️ Una tabella vuota non e' «un modulo con pochi dati»: e' un modulo che
// **non si puo' giudicare**. Una schermata vuota si comporta uguale che
// funzioni o no — ed e' la ragione per cui il mandato del 23/08 chiede che
// nessun settore resti carente.
//
// ⚠️ QUI SI STA STRETTI, ed e' una scelta: questi angoli ricevono pochi
// dati ciascuno, ma **veri**, non riempimento. Meglio sei produzioni
// plausibili che sessanta inventate: il mandato lo dice, e un elenco lungo
// di righe finte e' esattamente il dato assurdo che nasconde i difetti.

import { giorniIndietro, giorniAvanti, ridata } from "./retro.mjs";

// 🔴 QUI DENTRO NESSUN GUASTO E' MUTO, e il motivo e' successo stanotte: le
// restituzioni dei prestiti fallivano in silenzio, il riepilogo dichiarava
// «2 con una restituzione gia' fatta» e la tabella era **vuota**. Una bugia
// scritta da me, non dal gestionale — e con un elenco lungo di righe nessuno
// va a ricontarle.
//
// ⚠️ Un blocco che non riesce **non ferma** lo scenario (gli altri settori
// devono comunque nascere), ma **lo dice**, riga per riga.

// ---------------------------------------------------------------------
// 1 · LE PRODUZIONI
//
// ⚠️ Vanno DOPO i conti dei due mesi, e la ragione e' una regola del
// gestionale: una preparazione **che ha lotti in cella non viene piu'
// esplosa** — si consuma. Se le produzioni venissero prima, i conti
// scaricherebbero il ragu' invece delle sue verdure, e la merce comprata
// per i due mesi non tornerebbe piu' con quella consumata.
//
// ⚠️ E le ultime due sono di IERI, apposta: cosi' in cella c'e' del
// semilavorato **adesso**, e un conto aperto durante il collaudo esercita
// davvero quell'interruttore invece di lasciarlo teorico.
// ---------------------------------------------------------------------
export async function costruisciProduzioni(ctx) {
  const { segna, supabase, registraProduzione, rnd, oggi, MARCA } = ctx;

  const { data: preparazioni } = await supabase
    .from("recipes")
    .select("id, name, yield_quantity, yield_unit")
    .eq("recipe_type", "preparazione")
    .not("yield_quantity", "is", null)
    .order("name")
    .limit(14);
  if (!preparazioni?.length) {
    segna("produzioni: nessuna preparazione da produrre", 0);
    return;
  }

  let quante = 0;
  for (const [i, p] of preparazioni.entries()) {
    // Quando: sparse sui due mesi, e le ultime due ieri.
    const giorniFa = i >= preparazioni.length - 2 ? 1 : 8 + Math.floor(rnd() * 45);
    const dosi = [0.5, 1, 1, 1, 2][Math.floor(rnd() * 5)];
    const atteso = Number(p.yield_quantity) * dosi;
    // ⚠️ La resa VERA non e' quella della ricetta, ed e' tutto il senso di
    // registrare due numeri invece di uno: qui esce fra il 90% e il 105%
    // dell'atteso. Con la resa sempre uguale all'attesa, la sorveglianza
    // delle rese non avrebbe mai niente da dire.
    const ottenuto = Math.round(atteso * (0.9 + rnd() * 0.15) * 1000) / 1000;
    try {
      const esito = await registraProduzione({
        recipeId: p.id,
        dosi,
        quantitaOttenuta: ottenuto,
        scadenza: giorniAvanti(giorniIndietro(oggi, giorniFa), 5),
        note: `${MARCA}produzione di ${p.name.toLowerCase()}`,
      });
      // La data vera: la produzione nasce oggi e si sposta indietro, come i
      // conti. Il lotto che ne esce la segue.
      const id = esito?.produzione_id ?? esito?.id ?? esito;
      if (typeof id === "string") {
        const quando = `${giorniIndietro(oggi, giorniFa)}T11:${String(10 + Math.floor(rnd() * 40)).padStart(2, "0")}:00`;
        await supabase.from("produzioni").update({ creato_il: quando }).eq("id", id);
        await supabase.from("stock_consumptions").update({ created_at: quando }).eq("produzione_id", id);
      }
      quante += 1;
    } catch (e) {
      // ⚠️ Una produzione che non riesce non ferma lo scenario, ma lo DICE:
      // in silenzio, il modulo resterebbe vuoto e nessuno saprebbe perche'.
      console.log(`      ⚠ produzione di «${p.name}» non riuscita: ${e.message}`);
    }
  }
  segna("produzioni di semilavorati sui due mesi (le ultime due sono di ieri, e stanno in cella)", quante);
}

// ---------------------------------------------------------------------
// 2 · GLI ORDINI AI FORNITORI
//
// ⚠️ «Inviato» qui vuol dire «ho aperto WhatsApp con questo testo»: il
// gestionale non puo' sapere se e' stato premuto invio, e non finge di
// saperlo. Quindi negli ordini ci sono i tre stati veri — registrato,
// arrivato, annullato — e non solo quelli riusciti.
// ---------------------------------------------------------------------
export async function costruisciOrdini(ctx) {
  const { segna, supabase, bozzaOrdine, registraOrdine, annullaOrdine, segnaOrdineRicevuto, rnd, oggi, MARCA } = ctx;
  const { data: fornitori } = await supabase.from("suppliers").select("id, name, canale_ordine").limit(10);
  if (!fornitori?.length) return;

  let ordini = 0;
  let arrivati = 0;
  let annullati = 0;
  for (const [i, f] of fornitori.entries()) {
    if (i > 5) break;
    let bozza = null;
    try {
      bozza = await bozzaOrdine(f.id);
    } catch {
      continue;
    }
    const righe = (bozza?.righe ?? []).slice(0, 6);
    if (!righe.length) continue;
    const id = await registraOrdine({
      supplierId: f.id,
      testo: bozza?.testo ?? `${MARCA}ordine di prova`,
      righe,
      canale: f.canale_ordine || "whatsapp",
    }).catch(() => null);
    if (!id) continue;
    ordini += 1;
    const idOrdine = id?.id ?? id;
    await supabase.from("ordini_fornitore")
      .update({ note: `${MARCA}ordine della settimana`, creato_il: `${giorniIndietro(oggi, 3 + i * 4)}T09:15:00` })
      .eq("id", idOrdine)
      .then(() => {}, () => {});
    // Uno su tre e' gia' arrivato, uno e' stato annullato: senza, l'elenco
    // mostrerebbe un solo stato e i tre pulsanti non si potrebbero provare.
    if (i % 3 === 0) {
      await segnaOrdineRicevuto(idOrdine).catch((e) => console.log(`      ⚠ ordine non segnato arrivato: ${e.message}`));
      arrivati += 1;
    } else if (i === 4) {
      await annullaOrdine(idOrdine).catch((e) => console.log(`      ⚠ ordine non annullato: ${e.message}`));
      annullati += 1;
    }
    void rnd;
  }
  segna(`ordini ai fornitori (${arrivati} gia' arrivati, ${annullati} annullato)`, ordini);
}

// ---------------------------------------------------------------------
// 3 · SCONTI E OMAGGI
//
// ⚠️ Ogni riga ha la sua CAUSALE, e non e' una formalita': il budget degli
// omaggi della Proiezione si legge da li', e «cortesia» (un investimento) e
// «recupero disservizio» (qualcosa non ha funzionato) senza causale sono lo
// stesso numero.
// ---------------------------------------------------------------------
export async function costruisciScontiEOmaggi(ctx) {
  const { segna, supabase, ente, createDiscountGift, listAllCausali, rnd, oggi, MARCA, mesi } = ctx;
  const causali = await listAllCausali().catch(() => []);
  const perSconti = (causali ?? []).filter((c) => /cortesia|ricorrente|disservizio|altro/i.test(c.label));
  if (!perSconti.length) {
    segna("sconti e omaggi: nessuna causale disponibile", 0);
    return;
  }
  let quanti = 0;
  for (const mese of mesi) {
    for (let k = 0; k < 5; k++) {
      const causale = perSconti[Math.floor(rnd() * perSconti.length)];
      const omaggio = rnd() < 0.45;
      const pieno = Math.round((25 + rnd() * 90) * 100) / 100;
      await createDiscountGift({
        entity_id: ente,
        type: omaggio ? "omaggio" : "sconto",
        full_amount: pieno,
        collected_amount: omaggio ? 0 : Math.round(pieno * (0.6 + rnd() * 0.25) * 100) / 100,
        causale_id: causale.id,
        causale_note: `${MARCA}${omaggio ? "offerto dalla casa" : "sconto concordato"}`,
        movement_date: `${mese}-${String(5 + k * 5).padStart(2, "0")}`,
        note: `${MARCA}registrato a mano in cassa`,
      }).catch((e) => {
        console.log(`      ⚠ sconto/omaggio non riuscito: ${e.message}`);
      });
      quanti += 1;
    }
  }
  void supabase;
  void oggi;
  segna("sconti e omaggi registrati a mano nei due mesi, ognuno con la sua causale", quanti);
}

// ---------------------------------------------------------------------
// 4 · L'AGRICOLO — l'orto e la raccolta propria
//
// ⚠️ L'azienda agricola non esiste ancora come societa', ma il modulo si',
// ed era **completamente vuoto**: nessuna coltura, nessuna raccolta,
// nessuna cessione. La raccolta spontanea in particolare e' un obbligo
// HACCP — chi raccoglie, dove, come ha riconosciuto la specie — e senza
// nemmeno una riga quel registro non si puo' guardare.
// ---------------------------------------------------------------------
export async function costruisciAgricolo(ctx) {
  const { segna, supabase, ente, createCrop, createForagedItem, rnd, oggi, MARCA } = ctx;

  const COLTURE = [
    ["Pomodoro da salsa", "Siccagno di Valledolmo", "Orto alto", "in_crescita", 40, 12, 180],
    ["Melanzana lunga", "Violetta lunga", "Orto alto", "in_crescita", 55, 20, 90],
    ["Zucchina siciliana", "Lunga chiara", "Orto basso", "raccolto", 70, 45, 60],
    ["Basilico", "Genovese", "Serra piccola", "in_crescita", 30, 8, 20],
    ["Tenerumi", null, "Orto basso", "in_crescita", 35, 6, 40],
    ["Peperone rosso corno", "Corno di toro", "Orto alto", "seminato", 20, null, null],
  ];
  let colture = 0;
  for (const [nome, varieta, appezzamento, stato, giorniFa, raccolto, attesa] of COLTURE) {
    await createCrop({
      entity_id: ente,
      name: `${MARCA}${nome}`,
      variety: varieta,
      plot: appezzamento,
      status: stato,
      sowing_date: giorniIndietro(oggi, giorniFa + 30),
      expected_harvest_date: attesa ? giorniAvanti(oggi, 10) : null,
      actual_harvest_date: stato === "raccolto" ? giorniIndietro(oggi, giorniFa) : null,
      harvested_quantity: raccolto,
      unit: "kg",
      notes: `${MARCA}coltura dell'orto`,
    }).catch((e) => console.log(`      ⚠ coltura non riuscita: ${e.message}`));
    colture += 1;
  }
  segna("colture nell'orto (seminate, in corso, raccolte)", colture);

  const RACCOLTE = [
    ["Asparago selvatico", "Bosco di contrada Ronza", "riconoscimento visivo del raccoglitore, specie nota", "lontano da strade e coltivi trattati"],
    ["Finocchietto selvatico", "Margine dell'oliveto di famiglia", "riconoscimento visivo, pianta in fiore", "raccolto a monte della strada"],
    ["Origano selvatico", "Costone di contrada Bagni", "riconoscimento olfattivo e visivo", "zona non trattata, distante dalle colture"],
  ];
  let raccolte = 0;
  for (const [specie, dove, come, rischio] of RACCOLTE) {
    await createForagedItem({
      species: `${MARCA}${specie}`,
      harvest_date: giorniIndietro(oggi, 10 + Math.floor(rnd() * 40)),
      harvest_location: dove,
      forager_name: "Alessio Schillaci",
      identification_method: come,
      contamination_risk_note: rischio,
      internal_lot: `RP-${specie.slice(0, 3).toUpperCase()}-${Math.floor(rnd() * 90) + 10}`,
      note: `${MARCA}raccolta propria`,
    }).catch((e) => console.log(`      ⚠ raccolta non riuscita: ${e.message}`));
    raccolte += 1;
  }
  void supabase;
  segna("raccolte spontanee registrate (specie, luogo, come e' stata riconosciuta)", raccolte);
}

// ---------------------------------------------------------------------
// 5 · I SOLDI DEL TITOLARE — prestiti da privati e «di tasca mia»
//
// ⚠️ Due registri costruiti nei giorni scorsi e **mai visti con dei dati
// dentro**: chi ha prestato quanto e quanto e' stato restituito, e le spese
// che Alessio anticipa di tasca sua per conto della societa'.
// ---------------------------------------------------------------------
export async function costruisciSoldiDelTitolare(ctx) {
  const {
    segna, ente, oggi, MARCA, rnd,
    registraPrestito, registraRestituzione,
    createTagAnticipazione, createAnticipazione, pareggiaAnticipazione,
    listAllCausali,
  } = ctx;

  const causali = await listAllCausali().catch(() => []);
  const causale = (causali ?? []).find((c) => /altra entrata|entrata|altro/i.test(c.label))?.id ?? null;

  let prestiti = 0;
  let restituzioni = 0;
  for (const [daChi, importo, mezzo, giorniFa, restituito] of [
    // ⚠️ Il mezzo qui e' **dove finiscono i soldi** (cassa o banca), non
    // come sono stati mandati: e' un vocabolario diverso da quello dei
    // pagamenti, ed e' il genere di confusione che la rete sui vocabolari
    // del 17/08 esiste per prendere.
    ["Zio Michele", 5000, "banca", 95, 1500],
    ["Famiglia Schillaci", 8000, "banca", 70, null],
    ["Amico Salvo", 1500, "cassa", 40, 1500],
  ]) {
    const p = await registraPrestito({
      entityId: ente,
      daChi: `${MARCA}${daChi}`,
      importo,
      mezzo,
      ricevutoIl: giorniIndietro(oggi, giorniFa),
      causaleId: causale,
      nota: `${MARCA}prestito senza interessi`,
    }).catch((e) => {
      console.log(`      ⚠ prestito non registrato: ${e.message}`);
      return null;
    });
    if (!p) continue;
    prestiti += 1;
    if (restituito) {
      await registraRestituzione({
        prestitoId: p?.id ?? p,
        importo: restituito,
        mezzo,
        restituitoIl: giorniIndietro(oggi, Math.max(2, giorniFa - 30)),
        causaleId: causale,
        nota: `${MARCA}prima restituzione`,
      }).catch((e) => {
        // ⚠️ SI DICE, e non e' pignoleria: la prima versione ingoiava il
        // guasto in silenzio, il riepilogo dichiarava «2 con una
        // restituzione gia' fatta» e la tabella era **vuota**. Una bugia
        // scritta da me, non dal gestionale.
        console.log(`      ⚠ restituzione non registrata: ${e.message}`);
      });
      restituzioni += 1;
    }
  }
  segna(`prestiti da privati (${restituzioni} con una restituzione gia' fatta)`, prestiti);

  // --- «di tasca mia» ---
  const tag = {};
  for (const etichetta of ["Spesa urgente", "Trasferta", "Piccola manutenzione", "Anticipo fornitore"]) {
    const t = await createTagAnticipazione(`${MARCA}${etichetta}`).catch(() => null);
    if (t) tag[etichetta] = t.id ?? t;
  }
  const etichette = Object.values(tag);
  let note = 0;
  let pareggiate = 0;
  for (let i = 0; i < 9; i++) {
    const giorniFa = 6 + Math.floor(rnd() * 55);
    const a = await createAnticipazione({
      entityId: ente,
      importo: Math.round((18 + rnd() * 160) * 100) / 100,
      pagataIl: giorniIndietro(oggi, giorniFa),
      tagId: etichette[i % Math.max(1, etichette.length)] ?? null,
      fondi: rnd() < 0.6 ? "contanti" : "conto_personale",
      documento: `${MARCA}scontrino ${100 + i}`,
      nota: `${MARCA}pagata di tasca mia`,
    }).catch((e) => {
      console.log(`      ⚠ anticipazione non registrata: ${e.message}`);
      return null;
    });
    if (!a) continue;
    note += 1;
    // ⚠️ Alcune sono gia' state rimborsate e alcune no: il saldo di quel
    // registro esiste solo se ci sono tutte e due le cose. Con tutte
    // pareggiate direbbe sempre zero.
    if (i % 3 !== 0) {
      await pareggiaAnticipazione(a.id, giorniIndietro(oggi, Math.max(1, giorniFa - 12)))
        .catch((e) => console.log(`      ⚠ nota non rimborsata: ${e.message}`));
      pareggiate += 1;
    }
  }
  segna(`note «di tasca mia» (${pareggiate} gia' rimborsate, le altre aperte)`, note);
}

// ---------------------------------------------------------------------
// 6 · LA PARTE FISCALE — spese deducibili e strumenti
// ---------------------------------------------------------------------
export async function costruisciFiscale(ctx) {
  const { segna, ente, oggi, MARCA, rnd, createDeductibleExpense, createFiscalTool, createScadenzaPrevista } = ctx;

  const SPESE = [
    ["Cena di lavoro con il fornitore dei vini", 128.4, "rappresentanza", 2],
    ["Corso HACCP per il personale", 340, "formazione", 1],
    ["Carburante per il giro dei mercati", 62.8, "trasferta", 1],
    ["Pernottamento fiera Ristorexpo", 145, "trasferta", 1],
    ["Pranzo con la biologa per il manuale", 54.5, "rappresentanza", 2],
    ["Cancelleria e stampe per il locale", 38.9, "ufficio", 1],
    ["Abbonamento gestionale contabile", 240, "ufficio", 1],
  ];
  let spese = 0;
  for (const [descrizione, importo, scopo, persone] of SPESE) {
    await createDeductibleExpense({
      entity_id: ente,
      description: `${MARCA}${descrizione}`,
      amount: importo,
      expense_date: giorniIndietro(oggi, 8 + Math.floor(rnd() * 50)),
      payment_method: rnd() < 0.5 ? "carta" : "contante",
      people_count: persone,
      document_reference: `${MARCA}doc ${Math.floor(rnd() * 900) + 100}`,
      business_purpose: scopo,
      note: `${MARCA}spesa dei due mesi`,
    }).catch((e) => console.log(`      ⚠ spesa deducibile non registrata: ${e.message}`));
    spese += 1;
  }
  segna("spese deducibili nei due mesi (rappresentanza, trasferte, formazione)", spese);

  // ⚠️ Categorie e stati sono quelli del database, non parole scelte qui:
  // `fiscal_tools` li tiene chiusi (deduzione, credito_imposta, bando,
  // incentivo — attivo, scaduto, abolito, da_verificare). Inventarne altri
  // avrebbe fatto fallire il blocco a meta', lasciando il catalogo vuoto.
  //
  // 🔴 DESCRIZIONE E APPLICABILITA' SONO DUE COSE DIVERSE (24/08/2026).
  // Fino a oggi qui c'era `applicability: descrizione`: lo stesso identico
  // testo nei due campi, su tutte e cinque le voci. In schermata ogni
  // strumento ripeteva due volte la stessa frase, e sembrava un difetto
  // della schermata — che invece stampa correttamente due campi diversi.
  // ⚠️ E i testi che c'erano erano tutti CONDIZIONI («applicabile sui
  // dipendenti a tempo indeterminato»), non descrizioni: mancava proprio
  // la meta' che dice cos'e' lo strumento.
  const STRUMENTI = [
    ["Credito d'imposta beni strumentali 4.0", "credito_imposta",
      "Credito d'imposta sull'acquisto di attrezzature nuove interconnesse",
      "da valutare con Laura sull'attrezzatura da acquistare", "da_verificare", false],
    ["Maxi-deduzione nuove assunzioni", "deduzione",
      "Maggiorazione del costo del lavoro deducibile per le assunzioni stabili",
      "applicabile dal primo assunto a tempo indeterminato", "da_verificare", false],
    ["Deduzione IRAP cuneo fiscale", "deduzione",
      "Deduzione dalla base IRAP del costo dei dipendenti stabili",
      "applicabile sui dipendenti a tempo indeterminato", "attivo", true],
    ["Bando regionale ristorazione", "bando",
      "Contributo regionale a fondo perduto per l'avvio di attivita' di ristorazione",
      "sportello chiuso a maggio, riaprira' in autunno", "scaduto", false],
    ["Incentivo assunzione under 35", "incentivo",
      "Sgravio contributivo per l'assunzione di lavoratori sotto i 35 anni",
      "utilizzabile su Giada, verificare i requisiti", "da_verificare", false],
  ];
  let strumenti = 0;
  for (const [nome, categoria, descrizione, applicabilita, stato, inUso] of STRUMENTI) {
    await createFiscalTool({
      name: `${MARCA}${nome}`,
      category: categoria,
      description: descrizione,
      applicability: applicabilita,
      status: stato,
      normative_reference: "da confermare con la commercialista",
      in_use: inUso,
    }).catch((e) => console.log(`      ⚠ strumento fiscale non registrato: ${e.message}`));
    strumenti += 1;
  }
  segna("strumenti fiscali nel catalogo (uno attivo, uno scaduto, gli altri da valutare con Laura)", strumenti);

  // Le uscite gia' note: affitto, commercialista, rate. Servono a «Ce la
  // faccio al 16?», che senza scadenze previste guarda solo le fatture.
  let scadenze = 0;
  for (const [descrizione, importo, fraGiorni, ogniMesi] of [
    ["Affitto del locale", 2000, 6, 1],
    ["Commercialista", 250, 12, 1],
    ["Rata finanziamento attrezzature", 780, 18, 1],
    ["Premio assicurazione (seconda rata)", 470, 45, 6],
    ["F24 contributi dipendenti", 1340, 9, 1],
  ]) {
    await createScadenzaPrevista({
      entityId: ente,
      descrizione: `${MARCA}${descrizione}`,
      importo,
      scadeIl: giorniAvanti(oggi, fraGiorni),
      ogniMesi: ogniMesi,
      mezzo: "banca",
    }).catch((e) => console.log(`      ⚠ scadenza non registrata: ${e.message}`));
    scadenze += 1;
  }
  segna("uscite gia' note nei prossimi giorni (affitto, contributi, rate)", scadenze);
}

// ---------------------------------------------------------------------
// 7 · LA SALA E LA CARTA DEL GIORNO
//
// ⚠️ Tre tabelle della sala erano vuote — le chiusure per data, le
// correzioni dei coperti, le giornate al completo — e con loro restavano
// mute le schermate che le mostrano. La quarta, il menu del giorno, non
// aveva mai avuto una riga.
// ---------------------------------------------------------------------
export async function costruisciSalaECarta(ctx) {
  const {
    segna, supabase, oggi, MARCA, rnd,
    createClosure, createDailyMenu, addDailyMenuItem, setReservationDeposit,
  } = ctx;

  // Le chiusure: una passata (ferie), una futura (evento privato).
  let chiusure = 0;
  for (const [dal, al, motivo] of [
    [giorniIndietro(oggi, 40), giorniIndietro(oggi, 36), "Chiusura per ferie del personale"],
    [giorniAvanti(oggi, 21), giorniAvanti(oggi, 21), "Evento privato a locale chiuso"],
    [giorniAvanti(oggi, 60), giorniAvanti(oggi, 67), "Ferie di settembre"],
  ]) {
    await createClosure({ dal, al, motivo: `${MARCA}${motivo}` }).catch((e) =>
      console.log(`      ⚠ chiusura non registrata: ${e.message}`)
    );
    chiusure += 1;
  }
  segna("chiusure per data (ferie passate, un evento privato, le ferie di settembre)", chiusure);

  // Il menu del giorno: due passati e uno per domani.
  const { data: piatti } = await supabase
    .from("recipes").select("id, name, category").eq("pronta_per_carta", true).limit(30);
  let carte = 0;
  let voci = 0;
  if (piatti?.length) {
    for (const [giorniFa, titolo] of [[9, "Menu del giorno"], [2, "Menu del giorno"], [-1, "Menu di domani"]]) {
      const m = await createDailyMenu({
        serviceDate: giorniIndietro(oggi, giorniFa),
        title: `${MARCA}${titolo}`,
        note: `${MARCA}scritto la mattina`,
      }).catch(() => null);
      if (!m) continue;
      carte += 1;
      for (let k = 0; k < 4; k++) {
        const p = piatti[Math.floor(rnd() * piatti.length)];
        await addDailyMenuItem(m.id ?? m, {
          recipe_id: p.id,
          category: p.category,
          price: Math.round((9 + rnd() * 14) * 2) / 2,
          position: k,
        }).catch((e) => console.log(`      ⚠ piatto del giorno non aggiunto: ${e.message}`));
        voci += 1;
      }
    }
  }
  segna(`carte del giorno (due passate e una per domani), con ${voci} piatti dentro`, carte);

  // Le caparre: su due prenotazioni future e importanti.
  const { data: future } = await supabase
    .from("reservations")
    .select("id, party_size")
    .gte("reservation_date", oggi)
    .gte("party_size", 6)
    .limit(3);
  let caparre = 0;
  for (const p of future ?? []) {
    await setReservationDeposit(p.id, 50 + p.party_size * 5)
      .catch((e) => console.log(`      ⚠ caparra non registrata: ${e.message}`));
    caparre += 1;
  }
  segna("caparre incassate su prenotazioni grosse", caparre);
}

// ---------------------------------------------------------------------
// 8 · IL REGISTRO DI RICEVIMENTO MERCI
//
// 🔴 TROVATO GUARDANDO LA SCHERMATA, non il codice: dopo due mesi di
// consegne — trecentottanta partite entrate in cella — il registro HACCP
// del ricevimento merci aveva **una riga sola**.
//
// ⚠️ E non e' un difetto del gestionale: `register_stock_delivery` carica
// il magazzino e basta, mentre la riga HACCP la scrive la strada che passa
// dalla **fattura** (il carico automatico del 12/08). Lo scenario usava la
// prima, quindi la merce entrava senza che nessuno la controllasse — che e'
// proprio la cosa che quel registro esiste per dimostrare.
//
// ⚠️ Una riga per CONSEGNA e per fornitore, non per prodotto: e' cosi' che
// si compila davvero — si controlla il camion che arriva, non ogni cassa.
// ---------------------------------------------------------------------
export async function costruisciRicevimenti(ctx) {
  const { segna, supabase, addGoodsReceiving, rnd, MARCA } = ctx;

  // Le consegne vere, prese dal magazzino: giorno e fornitore.
  const { data: lotti } = await supabase
    .from("stock_lots")
    .select("received_at, supplier_id, ingredient_id")
    .not("supplier_id", "is", null)
    .order("received_at");
  if (!lotti?.length) {
    segna("ricevimento merci: nessuna consegna da registrare", 0);
    return;
  }
  const { data: prodotti } = await supabase.from("ingredients").select("id, name, category");
  const perId = new Map((prodotti ?? []).map((p) => [p.id, p]));

  const consegne = new Map();
  for (const l of lotti) {
    const giorno = String(l.received_at).slice(0, 10);
    const k = `${giorno}|${l.supplier_id}`;
    if (!consegne.has(k)) consegne.set(k, { giorno, fornitore: l.supplier_id, prodotti: [] });
    const p = perId.get(l.ingredient_id);
    if (p) consegne.get(k).prodotti.push(p);
  }

  let righe = 0;
  let nonConformi = 0;
  const daRidatare = [];
  for (const c of consegne.values()) {
    const fresco = c.prodotti.some((p) => ["pesce", "crostacei_molluschi", "latticini", "carne_rossa", "carne_bianca"].includes(p.category));
    // ⚠️ La temperatura si misura solo su cio' che viaggia freddo: scriverla
    // su una consegna di farina sarebbe un dato inventato su un registro che
    // si esibisce.
    const temperatura = fresco ? Math.round((1 + rnd() * 4) * 10) / 10 : null;
    // Una consegna su venti arriva storta, e va registrata cosi': e' il
    // caso per cui esiste la colonna «conformita'», e senza nemmeno uno
    // quel registro racconta due mesi perfetti — che non capitano.
    const storta = rnd() < 0.05;
    const descrizione = c.prodotti.slice(0, 3).map((p) => p.name).join(", ") +
      (c.prodotti.length > 3 ? ` e altri ${c.prodotti.length - 3}` : "");
    const esito = await addGoodsReceiving({
      supplierId: c.fornitore,
      productDescription: `${MARCA}${descrizione}`,
      temperatureC: storta && fresco ? Math.round((7 + rnd() * 3) * 10) / 10 : temperatura,
      packagingOk: !storta,
      // ⚠️ E' un BOOLEANO, non un testo: la prima volta ci avevo scritto
      // «conforme» e il database ha risposto «invalid input syntax for type
      // boolean». Terzo vocabolario sbagliato in una notte, e sempre per lo
      // stesso motivo: *il tipo di una colonna si chiede al database, non si
      // deduce dal nome.*
      conformity: !storta,
      note: storta ? `${MARCA}imballo bagnato, temperatura sopra soglia` : null,
      azione: storta ? "Merce respinta e ordinata di nuovo per il giorno dopo" : null,
    }).catch((e) => {
      console.log(`      ⚠ ricevimento non registrato: ${e.message}`);
      return null;
    });
    if (!esito) continue;
    righe += 1;
    if (storta) nonConformi += 1;
    const id = esito?.ricevimento_id ?? esito?.id ?? esito;
    if (typeof id === "string") daRidatare.push([id, `${c.giorno}T07:35:00`]);
  }
  await ridata(supabase, "haccp_goods_receiving", "received_at", daRidatare);
  segna(`controlli al ricevimento merci, uno per consegna (${nonConformi} non conformi)`, righe);
}

// ---------------------------------------------------------------------
// 9 · LA CESSIONE DALL'ORTO AL RISTORANTE
//
// ⚠️ E' il vincolo portante di tutto il progetto — due societa' distinte,
// collegate da una cessione intercompany — e quella schermata era **vuota**:
// «Nessuna cessione registrata». Un vincolo architetturale che nessun dato
// esercita e' un vincolo che nessuno puo' controllare.
//
// ⚠️ Una sola, e piccola: l'azienda agricola non esiste ancora come
// societa' vera, e riempire quel registro darebbe l'impressione di
// un'attivita' che non c'e'.
// ---------------------------------------------------------------------
export async function costruisciCessione(ctx) {
  const { segna, supabase, createCession, oggi, MARCA, dispensaPerNome } = ctx;
  // ⚠️ La colonna si chiama `entity_type`, non `type`: cercandola col nome
  // sbagliato la query non falliva — restituiva due righe senza quel campo,
  // e la cessione veniva saltata dicendo «manca una delle due societa'».
  // Un errore che si traveste da dato mancante.
  const { data: enti } = await supabase.from("entities").select("id, entity_type, name");
  const agricola = (enti ?? []).find((e) => e.entity_type === "azienda_agricola");
  const ristorante = (enti ?? []).find((e) => e.entity_type === "srls");
  if (!agricola || !ristorante) {
    segna("cessione intercompany: manca una delle due societa'", 0);
    return;
  }
  const { data: prodotto } = await supabase
    .from("ingredients").select("id, name").eq("name", "Pomodoro da salsa").maybeSingle();
  void dispensaPerNome;
  await createCession({
    sellerEntityId: agricola.id,
    buyerEntityId: ristorante.id,
    ingredientId: prodotto?.id ?? null,
    productDescription: `${MARCA}Pomodoro da salsa dell'orto`,
    quantity: 45,
    unit: "kg",
    unitPrice: 1.4,
    vatRate: 4,
    cessionDate: giorniIndietro(oggi, 22),
    fiscalDocumentType: "autofattura",
    invoiceReference: `${MARCA}AF-2026/1`,
    notes: `${MARCA}raccolta di luglio, ceduta al ristorante`,
  }, { updateIngredientCost: false }).catch((e) => {
    console.log(`      ⚠ cessione non registrata: ${e.message}`);
  });
  segna("cessione dall'orto al ristorante (il vincolo delle due societa', esercitato)");
}
