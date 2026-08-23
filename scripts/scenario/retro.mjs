// IL RETRO DEL LOCALE, a due mesi pieni — HACCP, personale, agenda,
// documenti e posta.
//
// 🔴 PERCHE' UN FILE A PARTE. `prova-due-mesi.mjs` racconta il servizio —
// le serate, i conti, la merce. Qui c'e' tutto quello che sta dietro, e che
// nello scenario del 22/08 esisteva **in campioni**: quattro letture di
// temperatura per due mesi, due attivita' di pulizia, tre dipendenti senza
// una busta paga, due documenti.
//
// ⚠️ Un campione non e' un dato piccolo: e' un dato che non si comporta
// come il vero. Un registro HACCP con quattro righe si guarda tutto in una
// schermata, quindi non fa vedere ne' il filtro per periodo, ne' la stampa
// del manuale, ne' il fatto che una non conformita' aperta di tre settimane
// fa sparisce sotto le altre.

// ---------------------------------------------------------------------
// 1 · HACCP
// ---------------------------------------------------------------------

/**
 * Le attrezzature con la loro finestra di temperatura.
 *
 * ⚠️ Le finestre sono quelle vere di una cucina: la carne fra 0 e 4, il
 * pesce fra 0 e 2 (piu' stretta, ed e' il motivo per cui e' quella che va
 * fuori range piu' spesso), il freezer sotto i -18. Con finestre tutte
 * uguali, una lettura sbagliata darebbe lo stesso risultato di una giusta.
 *
 * [nome, tipo, min, max]
 */
export const ATTREZZATURE = [
  ["Cella carni", "frigo_0_4", 0, 4],
  ["Cella pesce", "frigo_0_4", 0, 2],
  ["Cella verdure", "frigo_4_8", 4, 8],
  ["Frigo bar", "frigo_4_8", 2, 8],
  ["Congelatore", "freezer", -22, -18],
  ["Abbattitore", "freezer", -20, -18],
];

/**
 * Il piano di pulizia: cosa si fa e ogni quanto.
 *
 * ⚠️ Le frequenze contano davvero: il manuale HACCP dichiara un piano, e
 * un ispettore confronta il piano con le registrazioni. Con due sole
 * attivita' entrambe giornaliere, quel confronto non ha niente da dire.
 *
 * [nome, area, frequenza, ogni quanti giorni]
 */
export const PULIZIE = [
  ["Sanificazione piani di lavoro", "cucina", "giornaliera", 1],
  ["Lavaggio pavimenti cucina", "cucina", "giornaliera", 1],
  ["Pulizia servizi igienici", "sala", "giornaliera", 1],
  ["Pulizia celle frigorifere", "cucina", "settimanale", 7],
  ["Sgrassaggio cappa aspirante", "cucina", "settimanale", 7],
  ["Pulizia magazzino e scaffalature", "magazzino", "mensile", 30],
  ["Disincrostazione lavastoviglie", "cucina", "mensile", 30],
];

/**
 * Due mesi di registro HACCP: temperature due volte al giorno su tutte le
 * attrezzature, pulizie secondo il piano, non conformita' vere.
 */
export async function costruisciHaccp(ctx) {
  const { MARCA, segna, supabase, rnd, giorniDelPeriodo, oggi } = ctx;
  const { createEquipment, addTemperatureLog, createCleaningTask, addCleaningLog, addPestControlLog } = ctx;

  // --- le attrezzature ---
  const attrezzature = [];
  for (const [nome, tipo, min, max] of ATTREZZATURE) {
    const a = await createEquipment({
      name: `${MARCA}${nome}`,
      storageType: tipo,
      targetMinC: min,
      targetMaxC: max,
    });
    attrezzature.push({ ...a, nome, min, max });
  }
  segna("attrezzature con la loro finestra di temperatura", attrezzature.length);

  // --- le letture: mattina e sera, tutti i giorni ---
  //
  // ⚠️ I valori oscillano DENTRO la finestra, non stanno fermi al centro:
  // un registro dove il frigo segna sempre 2,0 non e' un registro, e' una
  // firma. E ogni tanto escono — piu' spesso d'estate e piu' spesso sulla
  // cella pesce, che ha la finestra piu' stretta.
  const daRidatare = [];
  let letture = 0;
  let fuoriRange = 0;
  let senzaRimedio = 0;
  for (const giorno of giorniDelPeriodo) {
    for (const quando of ["07:40", "18:20"]) {
      for (const a of attrezzature) {
        const centro = (a.min + a.max) / 2;
        const ampiezza = (a.max - a.min) / 2;
        let valore = centro + (rnd() - 0.5) * ampiezza * 1.5;
        let rimedio = null;
        // Fuori range: circa una lettura su ottanta, e la cella pesce il
        // doppio delle altre.
        const soglia = a.nome === "Cella pesce" ? 0.025 : 0.012;
        const esce = rnd() < soglia;
        if (esce) {
          valore = a.max + 0.8 + rnd() * 2.5;
          fuoriRange += 1;
          // ⚠️ Quasi tutte hanno il rimedio scritto — e quelle **senza**
          // lasciano una non conformita' APERTA, che e' l'unica cosa che
          // rende provabile il rifiuto sul campo vuoto e la schermata delle
          // non conformita'. Se avessero tutte il rimedio, quell'elenco
          // sarebbe sempre vuoto.
          if (rnd() < 0.75) {
            rimedio = RIMEDI[Math.floor(rnd() * RIMEDI.length)];
          } else {
            senzaRimedio += 1;
          }
        }
        const riga = await addTemperatureLog({
          equipmentId: a.id,
          recordedTempC: Math.round(valore * 10) / 10,
          note: esce ? `${MARCA}lettura fuori range` : null,
          correctiveAction: rimedio,
        });
        // `registra_temperatura` restituisce { lettura_id, fuori_range, … }:
        // l'identificativo serve per rimettere la lettura al suo giorno.
        const id = riga?.lettura_id;
        if (typeof id === "string") daRidatare.push([id, `${giorno}T${quando}:00`]);
        letture += 1;
      }
    }
  }
  await ridata(supabase, "haccp_temperature_logs", "recorded_at", daRidatare);
  segna(
    `letture di temperatura su due mesi (${fuoriRange} fuori range, ${senzaRimedio} senza rimedio: restano aperte)`,
    letture
  );

  // --- le pulizie, secondo il piano ---
  const daRidatarePulizie = [];
  let registrazioni = 0;
  for (const [nome, area, frequenza, ogni] of PULIZIE) {
    const t = await createCleaningTask({ name: `${MARCA}${nome}`, area, frequency: frequenza });
    const quando = [];
    for (let i = 0; i < giorniDelPeriodo.length; i += ogni) {
      const giorno = giorniDelPeriodo[i];
      // ⚠️ Non si registra TUTTO: una volta su venti la riga manca, ed e'
      // come vanno i registri veri. Un piano rispettato al cento per cento
      // per due mesi non e' una prova: e' una fotografia impossibile, e
      // toglierebbe alla schermata il caso che serve — il buco.
      if (rnd() < 0.05) continue;
      await addCleaningLog({ taskId: t.id, note: rnd() < 0.15 ? `${MARCA}fatta a fine servizio` : null });
      quando.push(`${giorno}T${frequenza === "giornaliera" ? "23:30" : "15:00"}:00`);
      registrazioni += 1;
    }
    // ⚠️ `addCleaningLog` non restituisce niente — e non e' una mancanza:
    // a chi pulisce l'identificativo della riga non serve. Quindi le righe
    // si rileggono in ordine di scrittura e si accoppiano ai giorni: sono
    // le uniche di questa attivita', appena create.
    const { data: scritte } = await supabase
      .from("haccp_cleaning_logs").select("id").eq("task_id", t.id).order("created_at");
    (scritte ?? []).forEach((r, i) => {
      if (quando[i]) daRidatarePulizie.push([r.id, quando[i]]);
    });
  }
  await ridata(supabase, "haccp_cleaning_logs", "completed_at", daRidatarePulizie);
  segna(`registrazioni di pulizia sui due mesi, secondo il piano (${PULIZIE.length} attivita')`, registrazioni);

  // --- la disinfestazione: trimestrale, con la sua relazione ---
  let visite = 0;
  for (const [quandoIndietro, esito] of [
    [55, "Nessuna traccia nelle trappole. Esche integre, sostituite due nel magazzino."],
    [12, "Trovata una traccia nel corridoio del magazzino: aggiunte due esche, controllo fra 30 giorni."],
  ]) {
    await addPestControlLog({
      performedBy: `${MARCA}Disinfestazioni Val d'Enna`,
      type: "ispezione",
      findings: esito,
      note: `${MARCA}visita programmata`,
    });
    // Stessa ragione delle pulizie: la funzione non restituisce l'id, e la
    // riga si riconosce da quello che ha dentro.
    await supabase.from("haccp_pest_control_logs")
      .update({ performed_at: giorniIndietro(oggi, quandoIndietro) })
      .eq("findings", esito);
    visite += 1;
  }
  segna("visite di disinfestazione, con la relazione di quello che hanno trovato", visite);

  return attrezzature;
}

const RIMEDI = [
  "Porta richiusa, merce controllata e trasferita nella cella accanto",
  "Termostato riportato a 2 gradi, ricontrollato dopo un'ora",
  "Chiamata l'assistenza: guarnizione sostituita in giornata",
  "Merce spostata nell'abbattitore, cella svuotata e sanificata",
  "Sbrinamento anticipato, temperatura rientrata in due ore",
];

// ---------------------------------------------------------------------
// attrezzi
// ---------------------------------------------------------------------

/**
 * Sposta indietro le date di righe appena scritte.
 *
 * ⚠️ Serve perche' le funzioni dell'app scrivono `now()` e non accettano
 * una data — com'e' giusto: una lettura di temperatura si registra quando
 * si fa. Ma due mesi di registro non si possono recitare, quindi le righe
 * nascono oggi e si spostano indietro, come i conti.
 *
 * ⚠️ Si aggiorna **una volta per istante**, non una per riga: con
 * settecento letture sarebbero settecento viaggi.
 */
export async function ridata(supabase, tabella, colonna, coppie) {
  const perIstante = new Map();
  for (const [id, istante] of coppie) {
    if (!perIstante.has(istante)) perIstante.set(istante, []);
    perIstante.get(istante).push(id);
  }
  for (const [istante, ids] of perIstante) {
    const r = await supabase.from(tabella).update({ [colonna]: istante }).in("id", ids);
    if (r.error) throw new Error(`Non riesco a ridatare ${tabella}: ${r.error.message}`);
  }
}

/** Una data ISO spostata indietro di N giorni. */
export function giorniIndietro(isoDate, quanti) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - quanti);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------
// 2 · IL PERSONALE
//
// 🔴 Nello scenario del 22/08 c'erano tre persone, un periodo di ferie e
// **nessuna busta paga**. Cioe' il modulo che vale la voce di spesa piu'
// grossa dell'anno si apriva su tre righe e un elenco vuoto.
//
// ⚠️ E la brigata di un'osteria da 34 coperti non e' di tre: sono sei —
// due in cucina, due in sala, un aiuto e un lavapiatti part-time. Con tre
// persone la distribuzione delle mance non ha niente da dividere e il costo
// del personale non somiglia a quello vero.
//
// [nome, cognome, ruolo, contratto, lordo mensile, reddito anno prima]
// ---------------------------------------------------------------------
export const BRIGATA = [
  ["Mario", "Rossi", "cuoco", "indeterminato", 2350, 24800],
  ["Salvo", "Verdi", "aiuto cucina", "indeterminato", 1750, 18400],
  ["Lucia", "Bianchi", "sala", "indeterminato", 1820, 19100],
  ["Giada", "Ferlito", "sala", "determinato", 1650, 12900],
  ["Nunzio", "Trovato", "lavapiatti", "extra", 980, null],
  ["Chiara", "Bonaccorsi", "sala", "stagionale", 1400, null],
];

export async function costruisciPersonale(ctx) {
  const { MARCA, ente, segna, rnd, oggi, mesi } = ctx;
  const { createEmployee, createEmployeeLeave, createPayslip, createTipCollected, createTipDistribution } = ctx;

  const persone = [];
  for (const [nome, cognome, ruolo, contratto, lordo, reddito] of BRIGATA) {
    const p = await createEmployee({
      entity_id: ente,
      first_name: nome,
      last_name: `${MARCA}${cognome}`,
      role: ruolo,
      contract_type: contratto,
      hire_date: giorniIndietro(oggi, 120 + Math.floor(rnd() * 240)),
      // ⚠️ Due su sei non hanno il reddito dell'anno prima, apposta: il
      // tetto del 30% sulle mance si puo' verificare solo su chi quel
      // numero ce l'ha, e sugli altri la schermata deve dire che non lo sa
      // invece di calcolare su zero.
      prior_year_income: reddito,
    });
    persone.push({ ...p, lordo, ruolo });
  }
  segna("dipendenti, con contratti diversi (due senza il reddito dell'anno prima, apposta)", persone.length);

  // --- le buste paga dei due mesi ---
  //
  // ⚠️ I numeri sono da contratto vero, non tondi: il netto sta fra il 71%
  // e il 76% del lordo a seconda della fascia, e cambia di qualche euro fra
  // un mese e l'altro per gli straordinari. Con un netto tondo — «1.500» —
  // non si vedrebbe se il gestionale somma o arrotonda male.
  let buste = 0;
  for (const p of persone) {
    for (const mese of mesi) {
      const straordinari = rnd() < 0.4 ? Math.round(rnd() * 180) : 0;
      const lordo = p.lordo + straordinari;
      const netto = Math.round(lordo * (0.71 + rnd() * 0.05) * 100) / 100;
      await createPayslip({
        employee_id: p.id,
        period_month: `${mese}-01`,
        gross_amount: lordo,
        net_amount: netto,
        document_reference: `${MARCA}LUL-${mese}-${p.id.slice(0, 4)}`,
        note: straordinari ? `${MARCA}con ${straordinari} euro di straordinari` : `${MARCA}mensilita' ordinaria`,
      });
      buste += 1;
    }
  }
  segna("buste paga dei due mesi, per tutta la brigata", buste);

  // --- ferie e permessi ---
  let assenze = 0;
  const TIPI = ["ferie", "permesso", "malattia"];
  for (const [i, p] of persone.entries()) {
    const quante = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < quante; k++) {
      const inizio = giorniIndietro(oggi, 5 + Math.floor(rnd() * 55));
      const tipo = TIPI[(i + k) % TIPI.length];
      const durata = tipo === "ferie" ? 3 + Math.floor(rnd() * 6) : tipo === "malattia" ? 1 + Math.floor(rnd() * 3) : 1;
      await createEmployeeLeave({
        employee_id: p.id,
        leave_type: tipo,
        start_date: inizio,
        end_date: giorniAvanti(inizio, durata - 1),
        note: `${MARCA}${tipo} di ${p.first_name}`,
      }).catch(() => {});
      assenze += 1;
    }
  }
  // ⚠️ E una ferie **futura**, gia' concordata: senza, la schermata delle
  // assenze non mostra mai niente in arrivo, che e' l'unica cosa per cui la
  // si guarda quando si fanno i turni.
  await createEmployeeLeave({
    employee_id: persone[2].id,
    leave_type: "ferie",
    start_date: giorniAvanti(oggi, 12),
    end_date: giorniAvanti(oggi, 19),
    note: `${MARCA}ferie gia' concordate`,
  }).catch(() => {});
  segna("assenze registrate (ferie, permessi, malattia) piu' una gia' concordata", assenze + 1);

  // --- le mance, raccolte e DISTRIBUITE ---
  //
  // 🔴 Nello scenario di ieri le mance venivano raccolte e mai distribuite:
  // «distribuire e' il gesto da collaudare». Vero, ma cosi' il debito verso
  // il personale cresceva per due mesi senza che nessuno lo pagasse mai —
  // cioe' il saldo che quella schermata mostra era **sempre e solo in
  // salita**, e non si vedeva mai il caso in cui torna a zero.
  //
  // ⚠️ Ne resta una **non distribuita**, l'ultima: il gesto da fare a mano
  // durante il collaudo ce l'ha ancora.
  let raccolte = 0;
  const perMese = new Map();
  for (const mese of mesi) {
    for (let settimana = 0; settimana < 4; settimana++) {
      for (const mezzo of ["contanti", "carta"]) {
        const importo = Math.round((mezzo === "contanti" ? 25 + rnd() * 60 : 40 + rnd() * 90) * 100) / 100;
        await createTipCollected({
          entityId: ente,
          amount: importo,
          collectedDate: `${mese}-${String(4 + settimana * 7).padStart(2, "0")}`,
          mezzo,
          note: `${MARCA}mance della settimana`,
        });
        perMese.set(`${mese}|${mezzo}`, (perMese.get(`${mese}|${mezzo}`) ?? 0) + importo);
        raccolte += 1;
      }
    }
  }
  segna("raccolte di mance sui due mesi, in contanti e su carta", raccolte);

  // La distribuzione del primo mese: il secondo resta da fare a mano.
  let distribuzioni = 0;
  if (createTipDistribution) {
    for (const mezzo of ["contanti", "carta"]) {
      const monte = perMese.get(`${mesi[0]}|${mezzo}`) ?? 0;
      if (monte <= 0) continue;
      // Si divide fra chi era in servizio, non in parti uguali: la sala
      // prende piu' della cucina, ed e' una decisione che il gestionale
      // registra invece di calcolare.
      const quote = [0.3, 0.12, 0.24, 0.2, 0.06, 0.08];
      const lines = persone.map((p, i) => ({
        employee_id: p.id,
        amount: Math.round(monte * quote[i] * 100) / 100,
      }));
      // L'ultimo prende il resto, così la somma torna al centesimo: è il
      // database a rifiutare una divisione che non quadra.
      const somma = lines.reduce((a, l) => a + l.amount, 0);
      lines[lines.length - 1].amount = Math.round((lines[lines.length - 1].amount + (monte - somma)) * 100) / 100;
      await createTipDistribution({
        entityId: ente,
        periodMonth: `${mesi[0]}-01`,
        mezzo,
        note: `${MARCA}distribuzione di fine mese`,
        lines,
      }).catch((e) => {
        console.log(`      ⚠ distribuzione mance non riuscita (${mezzo}): ${e.message}`);
      });
      distribuzioni += 1;
    }
  }
  segna("distribuzioni di mance (il secondo mese resta da distribuire a mano)", distribuzioni);
  return persone;
}

/** Una data ISO spostata avanti di N giorni. */
export function giorniAvanti(isoDate, quanti) {
  return giorniIndietro(isoDate, -quanti);
}

// ---------------------------------------------------------------------
// 3 · L'AGENDA
//
// 🔴 Nello scenario del 22/08 l'Agenda aveva quello che ci finiva da solo:
// i promemoria delle fatture e delle scadenze dei documenti. Nessun
// impegno scritto a mano, **niente di fatto**, niente in ritardo.
//
// ⚠️ E l'Agenda e' disegnata a corsie — *in ritardo · questa settimana ·
// piu' avanti · quando capita* — quindi con impegni tutti dello stesso tipo
// tre corsie su quattro restano vuote, e il disegno non si puo' giudicare.
//
// [titolo, categoria, fra quanti giorni (negativo = passato), stato, priorita', ricorrenza]
// ---------------------------------------------------------------------
export const IMPEGNI = [
  // --- in ritardo: la corsia che deve saltare all'occhio ---
  ["Portare i corrispettivi di luglio a Laura", "fisco_scadenze", -9, "da_fare", "alta", null],
  ["Rinnovare il contratto della lavastoviglie", "documenti", -4, "da_fare", "media", null],
  ["Chiedere il preventivo per la cappa nuova", "altro", -2, "da_fare", "bassa", null],
  // --- questa settimana ---
  ["F24 contributi INPS dipendenti", "fisco_scadenze", 1, "da_fare", "alta", "mensile"],
  ["Ordine vini per il fine settimana", "fornitori_pagamenti", 2, "da_fare", "media", null],
  ["Controllo scadenze in cella", "haccp_locale", 3, "da_fare", "alta", null],
  ["Firmare il rinnovo di Chiara", "personale", 4, "da_fare", "alta", null],
  ["Pagare la bolletta della luce", "fornitori_pagamenti", 5, "da_fare", "media", null],
  // --- piu' avanti ---
  ["Liquidazione IVA del trimestre", "fisco_scadenze", 18, "da_fare", "alta", "trimestrale"],
  ["Visita del consulente HACCP", "haccp_locale", 24, "da_fare", "media", "semestrale"],
  ["Revisione del piano di autocontrollo", "haccp_locale", 40, "da_fare", "media", "annuale"],
  ["Rinnovo assicurazione locale", "documenti", 45, "da_fare", "alta", "annuale"],
  ["Acconto IRES", "fisco_scadenze", 62, "da_fare", "alta", "annuale"],
  // --- quando capita: senza scadenza, e devono esserci ---
  ["Rifare le foto dei piatti per il sito", "altro", null, "da_fare", "bassa", null],
  ["Chiedere a Tiziana la scheda delle alghe", "haccp_locale", null, "da_fare", "bassa", null],
  ["Valutare il secondo forno", "altro", null, "da_fare", "bassa", null],
  ["Sistemare l'insegna esterna", "altro", null, "da_fare", "bassa", null],
  // --- e roba FATTA nei due mesi: senza, «Fatti di recente» e' vuoto ---
  ["F24 contributi INPS di giugno", "fisco_scadenze", -38, "completato", "alta", null],
  ["Liquidazione IVA del primo trimestre", "fisco_scadenze", -50, "completato", "alta", null],
  ["Consegnare il DVR aggiornato", "documenti", -31, "completato", "media", null],
  ["Corso HACCP per Giada", "personale", -27, "completato", "media", null],
  ["Cambio fornitore del pane", "fornitori_pagamenti", -20, "completato", "bassa", null],
  ["Taratura dei termometri", "haccp_locale", -14, "completato", "alta", null],
  ["Pagamento acconto affitto", "fornitori_pagamenti", -11, "completato", "alta", null],
  // --- e una in corso ---
  ["Preparare la carta d'autunno", "altro", 30, "in_corso", "media", null],
];

export async function costruisciAgenda(ctx) {
  const { MARCA, segna, oggi, createTask } = ctx;
  let quanti = 0;
  for (const [titolo, categoria, fraGiorni, stato, priorita, ricorrenza] of IMPEGNI) {
    await createTask({
      title: `${MARCA}${titolo}`,
      category: categoria,
      due_date: fraGiorni === null ? null : giorniAvanti(oggi, fraGiorni),
      status: stato,
      priority: priorita,
      ricorrenza,
      // ⚠️ Qualcuno e' visibile allo staff e qualcuno no: gli adempimenti
      // societari portano importi e codici F24, e la separazione fra cosa
      // vede la sala e cosa vede il titolare e' una regola del gestionale.
      // Con tutti uguali, quella regola non si vede all'opera.
      visibile_staff: categoria === "haccp_locale" || categoria === "personale",
      preferito: priorita === "alta" && fraGiorni !== null && fraGiorni < 0,
    });
    quanti += 1;
  }
  segna("impegni in Agenda: in ritardo, di questa settimana, piu' avanti, senza scadenza e gia' fatti", quanti);
}

// ---------------------------------------------------------------------
// 4 · L'ARCHIVIO E LA POSTA
//
// 🔴 Nello scenario del 22/08 l'Archivio aveva **due documenti** e la Posta
// in arrivo era **vuota**. Quindi: «Chiedi all'archivio» rispondeva su due
// contratti, la ricerca non serviva a niente, e la schermata della posta —
// che è quella dove Alessio decide cosa entra nel gestionale — non si
// poteva nemmeno aprire con qualcosa dentro.
//
// [titolo, tipo, controparte, importo, scadenza fra giorni, testo]
// ---------------------------------------------------------------------
export const DOCUMENTI = [
  ["Contratto di locazione del locale", "Contratto", "Immobiliare San Martino S.r.l.", 24000, 520,
    "CONTRATTO DI LOCAZIONE AD USO COMMERCIALE. Locatore: Immobiliare San Martino S.r.l. Conduttore: BORGO 58 S.r.l.s. " +
    "Art. 1 Immobile: locale commerciale in Piazza Armerina, superficie 140 mq, con cortile pertinenziale. " +
    "Art. 2 Durata: sei anni dal 01/03/2027, rinnovabili di altri sei. " +
    "Art. 3 Canone: 2.000,00 euro al mese, da corrispondere entro il giorno 5 di ogni mese. " +
    "Art. 4 Aggiornamento: dal secondo anno il canone e' aggiornato del 75 per cento della variazione ISTAT. " +
    "Art. 5 Manutenzione ordinaria: a carico del conduttore. Manutenzione straordinaria e strutture: a carico del locatore. " +
    "Art. 6 Deposito cauzionale: tre mensilita', pari a 6.000,00 euro. " +
    "Art. 7 Disdetta: dodici mesi prima della scadenza, a mezzo PEC."],
  ["Contratto manutenzione frigoriferi", "Contratto fornitura", "FrigoService Sicilia S.r.l.", 1776, 320,
    "CONTRATTO DI MANUTENZIONE fra FrigoService Sicilia S.r.l. e BORGO 58 S.r.l.s. " +
    "Art. 1 Oggetto: manutenzione di 4 celle frigorifere, 1 abbattitore e 1 congelatore. " +
    "Art. 2 Durata: 24 mesi dal 01/04/2027 al 31/03/2029. " +
    "Art. 3 Canone: 148,00 euro piu' IVA al mese, fatturato trimestralmente. " +
    "Art. 4 Interventi ordinari: 2 visite programmate l'anno, comprese nel canone. " +
    "Art. 5 Interventi straordinari: 55,00 euro l'ora piu' ricambi, uscita entro 24 ore. " +
    "Art. 6 Rinnovo tacito per 12 mesi salvo disdetta 90 giorni prima, a mezzo PEC."],
  ["Polizza assicurativa locale", "Assicurazione", "Assicurazioni Etnee S.p.A.", 940, 45,
    "POLIZZA MULTIRISCHI ESERCIZI COMMERCIALI n. PR-00042. Contraente: BORGO 58 S.r.l.s. " +
    "Premio annuo 940,00 euro, frazionabile in due rate semestrali. " +
    "Garanzie: incendio fino a 300.000 euro, furto e rapina fino a 25.000 euro, " +
    "responsabilita' civile verso terzi fino a 1.500.000 euro, danni da acqua condotta. " +
    "Franchigia sul furto: 500,00 euro. Scoperto sui danni da acqua: 10 per cento. " +
    "Disdetta: 60 giorni prima della scadenza annuale."],
  ["Contratto fornitura energia elettrica", "Contratto fornitura", "Energia Sicilia S.p.A.", 4800, 200,
    "FORNITURA DI ENERGIA ELETTRICA per utenza non domestica, POD IT001E12345678. " +
    "Potenza impegnata 15 kW. Prezzo componente energia 0,148 euro/kWh, fisso per 12 mesi. " +
    "Quota fissa 8,50 euro al mese. Fatturazione bimestrale. " +
    "Recesso: 30 giorni di preavviso, senza penali."],
  ["Manuale HACCP di autocontrollo", "HACCP", "Dott.ssa Tiziana R., biologa", null, 300,
    "MANUALE DI AUTOCONTROLLO secondo il metodo HACCP. Redatto per BORGO 58 S.r.l.s. " +
    "Contiene: diagramma di flusso delle lavorazioni, analisi dei pericoli, punti critici di controllo, " +
    "limiti critici e azioni correttive, piano di sanificazione, piano di lotta agli infestanti, " +
    "modalita' di conservazione e rintracciabilita' dei lotti. Revisione annuale obbligatoria."],
  ["Contratto di lavoro — Mario Rossi", "Contratto di lavoro", "Mario Rossi", null, null,
    "CONTRATTO DI LAVORO SUBORDINATO A TEMPO INDETERMINATO. CCNL Pubblici Esercizi. " +
    "Livello 4, mansione di cuoco. Orario 40 ore settimanali su cinque giorni. " +
    "Periodo di prova: 60 giorni. Retribuzione lorda mensile 2.350,00 euro su 14 mensilita'."],
  ["Certificato di agibilita' dei locali", "Autorizzazione", "Comune di Piazza Armerina", null, 900,
    "CERTIFICATO DI AGIBILITA' rilasciato per i locali siti in Piazza Armerina, " +
    "destinazione d'uso somministrazione alimenti e bevande. Capienza massima autorizzata: 48 persone."],
  ["SCIA per somministrazione", "Autorizzazione", "SUAP Piazza Armerina", null, null,
    "SEGNALAZIONE CERTIFICATA DI INIZIO ATTIVITA' per esercizio di somministrazione di alimenti e bevande. " +
    "Protocollo 2026/4471. Allegati: planimetria, notifica sanitaria, dichiarazione dei requisiti."],
  ["Verbale sopralluogo ASP", "Verbale", "ASP Enna — Servizio Igiene Alimenti", null, null,
    "VERBALE DI SOPRALLUOGO. Esito: conforme con prescrizioni. " +
    "Prescrizione 1: completare la schermatura della finestra del deposito entro 30 giorni. " +
    "Prescrizione 2: esporre il piano di sanificazione aggiornato in cucina."],
  ["Preventivo insegna esterna", "Preventivo", "Pubblisegna di Catania", 2450, null,
    "PREVENTIVO n. 118/2026 per insegna luminosa a lettere scatolate, 3,20 x 0,60 metri, " +
    "compresa pratica di autorizzazione comunale e installazione. Totale 2.450,00 euro piu' IVA. " +
    "Validita' del preventivo: 60 giorni. Consegna: 25 giorni lavorativi dall'ordine."],
];

/**
 * Le mail dei due mesi.
 *
 * ⚠️ NON sono tutte fatture: in una casella vera arriva soprattutto altro —
 * pubblicità, comunicazioni della banca, un fornitore che si presenta. È il
 * motivo per cui la schermata della posta esiste con un pulsante «scarta»:
 * se arrivassero solo documenti utili, quel pulsante non servirebbe e non
 * si potrebbe collaudare.
 *
 * [mittente, oggetto, quanti giorni fa, stato, azione proposta o null]
 */
export const POSTA = [
  ["amministrazione@ortofruttaserrone.it", "Fattura 2026/311 - Ortofrutta Serrone", 47, "archiviata", "archivia_documento"],
  ["fatture@itticadellostretto.it", "Fattura elettronica FT/2026/88", 41, "archiviata", "archivia_documento"],
  ["noreply@bancasicilia.it", "Estratto conto giugno 2026", 38, "archiviata", "archivia_documento"],
  ["info@pubblisegna.it", "Preventivo insegna come da accordi", 33, "archiviata", "archivia_documento"],
  ["newsletter@ristorazioneoggi.it", "Le 10 tendenze food dell'autunno", 30, "scartata", null],
  ["commerciale@fornituregrandi.it", "Offerta speciale attrezzature cucina -30%", 28, "scartata", null],
  ["tiziana.biologa@pec.it", "Revisione manuale HACCP - bozza", 24, "archiviata", "archivia_documento"],
  ["amministrazione@caseificiovaldinoto.it", "Fattura 2026/455 e nota di credito", 21, "archiviata", "carico_magazzino"],
  ["studio@laurac.it", "Scadenze fiscali del trimestre", 17, "archiviata", "promemoria_multipli"],
  ["noreply@energiasicilia.it", "La tua bolletta di luglio e' disponibile", 14, "proposta", "archivia_documento"],
  ["ordini@molinograno.it", "Conferma d'ordine e listino aggiornato", 11, "proposta", "carico_magazzino"],
  ["commerciale@vinidisicilia.it", "Nuovo catalogo vini 2026", 9, "scartata", null],
  ["assistenza@frigoservice.it", "Intervento del 12/07 - rapportino", 8, "proposta", "archivia_documento"],
  ["comune.piazzaarmerina@pec.it", "Comunicazione occupazione suolo pubblico", 6, "proposta", "da_fare_a_mano"],
  ["amministrazione@macellerianebrodi.it", "Fattura 2026/207", 4, "da_leggere", null],
  ["info@borgo58.it", "Richiesta prenotazione per 8 persone", 3, "da_leggere", null],
  ["noreply@bancasicilia.it", "Estratto conto luglio 2026", 2, "da_leggere", null],
  ["marketing@deliveryfacile.it", "Porta il tuo ristorante online", 1, "da_leggere", null],
];

export async function costruisciArchivioEPosta(ctx) {
  const { MARCA, ente, segna, supabase, oggi, createDocument } = ctx;

  let documenti = 0;
  for (const [titolo, tipo, controparte, importo, scadenzaFra, testo] of DOCUMENTI) {
    const id = await createDocument({
      entity_id: ente,
      title: `${MARCA}${titolo}`,
      doc_type: tipo,
      counterparties: controparte,
      amount: importo,
      expiry_date: scadenzaFra === null ? null : giorniAvanti(oggi, scadenzaFra),
      document_date: giorniIndietro(oggi, 60 + Math.floor(Math.abs(scadenzaFra ?? 100) / 4)),
      note: `${MARCA}archivio di collaudo`,
    });
    // ⚠️ Il TESTO si scrive a mano, e va dichiarato: normalmente lo mette
    // la lettura automatica quando il documento arriva dalla posta, ma sul
    // progetto di prova la posta non arriva. Senza testo, «Chiedi
    // all'archivio» conosce la scheda e non il contenuto — cioè risponde
    // «non ce l'ho» a ogni domanda che conta.
    const r = await supabase.from("documents").update({ testo }).eq("id", id?.id ?? id);
    if (r.error) throw new Error(`Non riesco a scrivere il testo del documento: ${r.error.message}`);
    documenti += 1;
  }
  segna("documenti in archivio, col loro contenuto dentro (l'assistente ci puo' rispondere)", documenti);

  // --- la posta ---
  //
  // ⚠️ QUI SI SCRIVE IN TABELLA, e va dichiarato: le mail non le crea
  // nessuna funzione dell'app — arrivano da fuori, le legge la funzione
  // online che guarda la casella, e sul progetto di prova quella casella
  // non c'è. È la stessa deroga del testo dei documenti.
  let mail = 0;
  let proposte = 0;
  for (const [mittente, oggetto, giorniFa, stato, azione] of POSTA) {
    const quando = `${giorniIndietro(oggi, giorniFa)}T${String(8 + (mail % 11)).padStart(2, "0")}:${String((mail * 7) % 60).padStart(2, "0")}:00`;
    const { data, error } = await supabase.from("posta_ricevuta").insert({
      messaggio_id: `${MARCA}${mail}-${giorniFa}@borgo58.it`,
      casella: mittente.includes("pec") ? "pec" : "info@borgo58.it",
      mittente,
      oggetto: `${MARCA}${oggetto}`,
      testo: `Messaggio di collaudo da ${mittente}. ${oggetto}.`,
      ricevuta_il: quando,
      stato,
    }).select("id").single();
    if (error) throw new Error(`Non riesco a scrivere una mail di prova: ${error.message}`);
    mail += 1;
    if (azione) {
      const r = await supabase.from("posta_azioni").insert({
        posta_id: data.id,
        tipo: azione,
        titolo: oggetto,
        perche: "Il mittente e l'oggetto dicono che è un documento da conservare",
        stato: stato === "archiviata" ? "fatta" : stato === "scartata" ? "rifiutata" : "proposta",
      });
      if (r.error) throw new Error(`Non riesco a scrivere una proposta: ${r.error.message}`);
      if (stato === "proposta") proposte += 1;
    }
  }
  segna(`mail nei due mesi (${proposte} con una proposta ancora da decidere)`, mail);
}
