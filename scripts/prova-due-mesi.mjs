import { MATERIE_PRIME, PREPARAZIONI, FINGER, PIATTI, PIATTI_IN_CARTA, SELEZIONI, BOZZE } from "./scenario/carta.mjs";
import {
  BEVANDE, serateDelMeseVero, copertiDelTavolo, componiConto,
  chiPrenota, oraDellaPrenotazione, fornitoreDellaCategoria,
} from "./scenario/servizio.mjs";

// DUE MESI DI VITA DEL RISTORANTE — la parte grossa di `npm run prova:scenario`.
//
// Lo stato di partenza dà poche righe perché le verifiche non girino a
// vuoto; lo scenario apparecchia UNA SERA. Questo modulo aggiunge quello
// che mancava: **due mesi già passati**, con dentro abbastanza vita da far
// dire qualcosa alla Proiezione, al food cost e allo scontrino medio.
//
// ⚠️ STA IN UN FILE SUO E NON DENTRO `prova-base.mjs` per una ragione sola:
// quel file è già 1140 righe. Il COMANDO resta uno — `npm run prova:scenario`
// — che è quello che il mandato chiede: chi collauda non deve ricordarsi due
// nomi.
//
// ---------------------------------------------------------------------
// 🔴 LA SCALA È QUELLA VERA — e fino al 23/08 non lo era
// ---------------------------------------------------------------------
//
// **Decisione di Alessio, 23/08/2026**: *«lo scenario deve rispecchiare
// veramente due mesi di attività senza eccezioni. I dati devono essere
// completi e mai, MAI carenti in nessuno degli aspetti che riguardano ogni
// singolo settore dell'app e dell'attività.»*
//
// 🔴 **LA RIGA CHE STAVA QUI ERA UN LIMITE DICHIARATO, ED È DIVENTATA UN
// DIFETTO DA TOGLIERE.** Diceva: *«un'osteria da 34 coperti fa 150-200
// conti al mese; questi due mesi ne hanno ~30 ciascuno, cioè un quinto —
// non è un difetto del calcolo, è la taglia dello scenario»*. Era onesta e
// non basta: **dichiarare una carenza non la rende innocua**, perché ogni
// numero che ne discende resta inutilizzabile per giudicare il gestionale.
//
// Adesso i conti sono **tutti quelli di due mesi veri**: ~145 nel mese
// fiacco e ~185 in quello pieno, su tutte le serate che il locale apre
// davvero (lunedì riposo, cena da martedì a sabato, pranzo la domenica).
//
// ⚠️ **E il ragionamento vecchio su costo/rumore/leggibilità non era
// sbagliato: era incompleto.** Il costo esiste (il comando ci mette
// parecchio) e la risposta non è rimpicciolire i dati — è **non
// rigenerarli ogni volta**: si genera una volta e si RIPRISTINA da copia.
// La leggibilità a mano si perde davvero, ed è il prezzo dichiarato: 300
// conti non si scorrono uno per uno. In cambio si guardano i totali, che
// è come li guarderà davvero chi ha un ristorante.
//
// ⚠️ **I MESI SONO QUELLI CHE LA PREVISIONE CHIUDE.** `prova-base.mjs`
// chiude i due mesi precedenti a quello corrente; se i conti cadessero
// altrove, il consuntivo fotograferebbe **zero** e la Proiezione direbbe la
// stessa cosa sia che funzioni sia che no.
//
// ---------------------------------------------------------------------
// 🔴 E I NUMERI DEVONO DISTINGUERE
// ---------------------------------------------------------------------
// Se tutti i piatti costassero uguale e tutti i tavoli facessero due
// coperti, **un conto sbagliato darebbe lo stesso risultato di uno
// giusto**. Quindi:
//
// · il food cost dei piatti va dal **14% al 45%** (misurato dopo, non
//   promesso qui): la caponata costa poco davvero, il crudo di gambero
//   molto. Il food cost del mese si muove col MIX venduto, ed è l'unico
//   modo perché quel numero significhi qualcosa;
// · i coperti per conto vanno da 2 a 8, gli scontrini da ~25 a ~180 €;
// · i pagamenti sono misti — contante e carta — perché la tesoreria
//   distingua il cassetto dalla banca.

export async function costruisciDueMesi(ctx) {
  const {
    MARCA, ente, segna, supabase, orders, oggi,
    dispensa, dispensaId, createRecipe, addRecipeIngredient, updateRecipe,
    createMenu, addMenuItem, setActiveMenu, createIngredient, updateIngredientPrice,
    registerStockDelivery, createReservation, createCashMovement, listAllCausali,
    registraConteggioCassa, versaInBanca, recordStockConsumption, allineaGiacenza,
    createSupplierInvoice, markInvoicePaid, fornitori,
    createBarItem, assegnaPrenotazione,
  } = ctx;

  const rnd = seminato(20260822); // ⚠️ deterministico: due esecuzioni danno lo stesso scenario

  // -------------------------------------------------------------------
  // 1. Le materie prime CARE, che sono quelle che fanno il food cost
  //
  // ⚠️ Senza queste il food cost non poteva salire: la dispensa di prova
  // ha solo verdura e farina, e un ristorante fatto di sole verdure ha
  // food cost del 10% — cioè un numero che non somiglia a niente e non
  // fa vedere nessun problema.
  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // 1. LA DISPENSA VERA — un centinaio di prodotti, non quattordici
  //
  // 🔴 REPERTO DI ALESSIO (22/08): con quattordici prodotti non si prova
  // niente di quello che conta — la ricerca, i filtri, l'ordinamento, una
  // lista della spesa lunga, il magazzino dove devi trovare una cosa fra
  // cento.
  //
  // ⚠️ La scala e' MISURATA, non scelta: sul tablet vero una riga di
  // elenco e' alta 70,3 px e sotto l'intestazione ci sono 797 px, quindi
  // **ne entrano 11**. Con 15 prodotti la pagina e' 1,3 schermate e la
  // ricerca non serve mai; con cento diventa 7,1 schermate. La spiegazione
  // per intero sta in `scripts/scenario/carta.mjs`.
  //
  // ⚠️ **Si saltano quelli che ci sono gia'**: otto li ha creati lo stato
  // di partenza, con lo stesso nome. Ricrearli farebbe due prodotti dove
  // ce n'e' uno.
  // -------------------------------------------------------------------
  const { data: giaCiSono } = await supabase.from("ingredients").select("id, name");
  const perNome = new Map((giaCiSono ?? []).map((r) => [r.name, r.id]));
  for (const nome of Object.keys(dispensa)) perNome.set(nome, dispensa[nome]);

  // Il giorno prima della prima serata dei due mesi: e' quando la dispensa
  // di partenza e' entrata in cella.
  const primoGiornoDelPeriodo = `${mesePrecedente(oggi, 2)}-01`;
  const lottiDiPartenza = [];
  let nuoviIngredienti = 0;
  for (const [nome, categoria, unita, prezzo, soglia, giacenza, conservazione] of MATERIE_PRIME) {
    if (perNome.has(nome)) { dispensa[nome] = perNome.get(nome); continue; }
    const ing = await createIngredient({
      entity_id: ente,
      name: nome,
      category: categoria,
      unit: unita,
      current_price: prezzo,
      stock_minimum_threshold: soglia,
      // ⚠️ Lo scarto non e' uguale per tutti: pesce e crostacei ne fanno
      // molto, la dispensa quasi niente. Uno scarto unico darebbe un food
      // cost sbagliato sempre nella stessa direzione.
      waste_percentage_default:
        categoria === "pesce" || categoria === "crostacei_molluschi" ? 35
        : categoria === "verdura" || categoria === "frutta" ? 12
        : 3,
      alimentare: categoria !== "altro",
    });
    const id = ing?.id ?? ing;
    dispensa[nome] = id;
    perNome.set(nome, id);
    nuoviIngredienti++;
    // ⚠️ NON tutti hanno giacenza: alcuni restano a zero apposta, cosi' il
    // magazzino ha sia i prodotti che ci sono sia quelli finiti — e la
    // lista della spesa ha qualcosa dentro e qualcosa fuori.
    if (giacenza > 0) {
      // 🔴 LA DISPENSA DI PARTENZA ARRIVA IL GIORNO PRIMA DEL PRIMO
      // SERVIZIO, non oggi (misurato dopo il primo giro a scala piena: 103
      // partite portavano la data di oggi). Con la data di oggi, i conti di
      // **giugno** consumavano merce arrivata ad **agosto** — un paradosso
      // che non da' nessun errore e che rende falso tutto quello che si
      // legge su una partita: quando e' entrata, quanto e' rimasta in cella,
      // se e' scaduta prima di finire.
      const lotto = await registerStockDelivery({
        ingredientId: id,
        quantity: giacenza,
        unitCost: prezzo,
        expiryDate: giorni(primoGiornoDelPeriodo, conservazione === "dispensa" || conservazione === "temperatura_ambiente" ? 120 : 9),
        supplierId: fornitori?.[0] ?? null,
      });
      if (typeof lotto === "string") lottiDiPartenza.push(lotto);
    }
  }
  if (lottiDiPartenza.length) {
    const r = await supabase.from("stock_lots")
      .update({ received_at: `${primoGiornoDelPeriodo}T06:30:00` })
      .in("id", lottiDiPartenza);
    if (r.error) throw new Error(`Non riesco a ridatare la dispensa di partenza: ${r.error.message}`);
  }
  segna("materie prime in dispensa, entrate il primo giorno dei due mesi", nuoviIngredienti);

  // -------------------------------------------------------------------
  // 2. LE PREPARAZIONI — la profondita' che mancava
  //
  // ⚠️ Alessio **scompone sempre**: un ragu passa da un soffritto e da una
  // salsa. Senza preparazioni il costo di un piatto e' una somma piatta di
  // materie prime, cioe' il caso in cui il calcolo a cascata non viene mai
  // esercitato — e quello e' il calcolo che regge il food cost vero.
  // -------------------------------------------------------------------
  const unitaDiTutto = new Map(MATERIE_PRIME.map((r) => [r[0], r[2]]));
  for (const [nome, , unitaResa] of PREPARAZIONI) unitaDiTutto.set(nome, unitaResa);

  const bozze = new Set(BOZZE);
  const idRicetta = {};
  for (const [nome, resa, unitaResa] of PREPARAZIONI) {
    const r = await createRecipe({
      name: nome,
      category: "primo",
      recipe_type: "preparazione",
      portions_yield: 1,
      yield_quantity: resa,
      yield_unit: unitaResa,
    });
    idRicetta[nome] = r.id;
  }
  // ⚠️ I componenti si aggiungono DOPO aver creato tutte le preparazioni:
  // una preparazione ne usa un'altra, e la seconda potrebbe non esistere
  // ancora quando serve alla prima.
  for (const [nome, , , componenti] of PREPARAZIONI) {
    for (const [c, quantita] of componenti) {
      await addRecipeIngredient(idRicetta[nome], {
        ingredient_id: dispensa[c] ?? null,
        component_recipe_id: dispensa[c] ? null : idRicetta[c],
        quantity: quantita,
        unit: unitaDiTutto.get(c) ?? "kg",
      });
    }
    if (!bozze.has(nome)) await updateRecipe(idRicetta[nome], { pronta_per_carta: true });
  }
  segna("preparazioni (soffritti, salse, basi: il costo scende a cascata)", PREPARAZIONI.length);

  // -------------------------------------------------------------------
  // 3. LA CARTA — venti finger e tredici piatti, come la sua
  //
  // ⚠️ E il Ricettario e' PIU' GRANDE della carta, come in una cucina
  // vera: nello scenario vecchio tutte e 35 le ricette erano «pronte per
  // carta», che non somiglia a nessun ricettario. Qui ci sono le bozze, i
  // fuori carta e i piatti che aspettano la stagione.
  // -------------------------------------------------------------------
  const carta = await createMenu({ name: "Carta dei due mesi", structure: "4-4-4-2" });
  const inCarta = [];
  const inCartaOra = new Set(PIATTI_IN_CARTA);

  for (const [lista, tipo] of [[FINGER, "finger"], [PIATTI, "piatto_finito"]]) {
    for (const [nome, categoria, prezzo, componenti] of lista) {
      const r = await createRecipe({
        name: nome,
        category: categoria,
        recipe_type: tipo,
        portions_yield: 1,
        // ⚠️ Un finger si vende al pezzo, non a porzione (strada aperta il
        // 20/08): senza questo, il prezzo di venti bocconcini non si sa
        // scomporre.
        //
        // ⚠️ E vuole la RESA, perche' il database la pretende su tutto cio'
        // che non e' un piatto finito (`componente_richiede_resa`): le
        // quantita' del catalogo sono gia' per un pezzo, quindi la resa e'
        // un pezzo. Il vincolo ha ragione — un finger produce pezzi, e
        // senza saperlo non se ne puo' calcolare il costo.
        ...(tipo === "finger"
          ? { prezzo_al_pezzo: prezzo, yield_quantity: 1, yield_unit: "pz" }
          : {}),
      });
      idRicetta[nome] = r.id;
      for (const [c, quantita] of componenti) {
        await addRecipeIngredient(r.id, {
          ingredient_id: dispensa[c] ?? null,
          component_recipe_id: dispensa[c] ? null : idRicetta[c],
          quantity: quantita,
          unit: unitaDiTutto.get(c) ?? "kg",
        });
      }
      if (bozze.has(nome)) continue;
      await updateRecipe(r.id, { pronta_per_carta: true });
      if (!inCartaOra.has(nome)) continue;
      const voce = await addMenuItem(carta.id, { recipe_id: r.id, category: categoria, selling_price: prezzo });
      inCarta.push({ recipe_id: r.id, prezzo, nome, categoria, menu_item_id: voce?.id });
    }
  }
  // -------------------------------------------------------------------
  // 3-bis. LE SELEZIONI — quello che si vende davvero
  //
  // 🔴 SCOPERTO DAL RIFIUTO DEL DATABASE, non leggendo: mettendo i finger
  // in carta ha risposto *«In un menu ci vanno solo i piatti: e' un
  // bocconcino»*. Ha ragione — e' la decisione del 20/08. In carta va la
  // **selezione**, che e' un piatto finito fatto di bocconcini; i finger
  // restano nel ricettario, pronti, e nessuno li vende da soli.
  //
  // ⚠️ Senza questo lo scenario avrebbe collaudato un modello che il
  // gestionale non ammette.
  // -------------------------------------------------------------------
  for (const [nome, categoria, prezzo, bocconcini] of SELEZIONI) {
    const r = await createRecipe({
      name: nome,
      category: categoria,
      recipe_type: "piatto_finito",
      portions_yield: 1,
    });
    for (const b of bocconcini) {
      await addRecipeIngredient(r.id, {
        component_recipe_id: idRicetta[b],
        quantity: 1,
        unit: "pz",
      });
    }
    await updateRecipe(r.id, { pronta_per_carta: true });
    const voce = await addMenuItem(carta.id, { recipe_id: r.id, category: categoria, selling_price: prezzo });
    inCarta.push({ recipe_id: r.id, prezzo, nome, categoria, menu_item_id: voce?.id });
  }
  segna("selezioni di bocconcini, che sono la forma in cui i finger si vendono", SELEZIONI.length);

  await setActiveMenu(carta.id);

  // -------------------------------------------------------------------
  // 2-bis. LA CARTA DELLE BEVANDE — che non c'era affatto
  //
  // 🔴 Misurato sullo scenario di ieri: in due mesi di servizio c'erano
  // **287 righe di cucina e UNA di bar**. Cioe' il locale non vendeva da
  // bere, e con esso restavano vuote la schermata «Bevande e vini», la
  // colonna del bar nelle Comande e la meta' beverage della Proiezione.
  //
  // ⚠️ Una bevanda NON e' una ricetta: vive in `bar_items`, e in comanda ci
  // finisce come testo col formato accanto al nome («Grillo · calice»),
  // perche' al bar la differenza fra un calice e una bottiglia conta.
  // -------------------------------------------------------------------
  const bevande = [];
  for (const [section, category, name, producer, serving, prezzo] of BEVANDE) {
    const b = await createBarItem({
      section, category, name, producer, serving,
      selling_price: prezzo,
      note: `${MARCA}carta bevande`,
    });
    bevande.push({ ...b, section, category, name, serving, selling_price: prezzo });
  }
  segna("vini e bevande in carta (calici, bottiglie, birre, caffetteria, amari)", bevande.length);
  segna("ricette nel ricettario, di cui in carta: " + inCarta.length, FINGER.length + PIATTI.length + SELEZIONI.length);

  // -------------------------------------------------------------------
  // 3. LE SERATE — due mesi che devono essere DIVERSI fra loro
  //
  // ⚠️ Se i due mesi si somigliassero, il confronto della Proiezione
  // direbbe la stessa cosa sia che funzioni sia che no. Qui il primo mese
  // è **fiacco** (poche serate, tavoli piccoli, piatti economici) e il
  // secondo **pieno**: lo scostamento cambia di segno, ed è l'unica forma
  // in cui quella schermata si può collaudare davvero.
  //
  // ⚠️ E I MESI SONO QUELLI CHE LA PREVISIONE CHIUDE, non due a caso:
  // `prova-base.mjs` chiude il mese scorso e quello prima. Un conto fuori
  // da lì non entra in nessun consuntivo.
  // -------------------------------------------------------------------
  const mesePieno = mesePrecedente(oggi, 1);
  const meseFiacco = mesePrecedente(oggi, 2);

  const { data: tavoli } = await supabase
    .from("dining_tables").select("id,label").eq("tipo", "tavolo").eq("active", true).order("label");
  if (!tavoli?.length) throw new Error("Nessun tavolo in sala: lo scenario dei due mesi non può girare.");

  // 🔴 TUTTE LE SERATE, NON VENTI (23/08/2026, decisione di Alessio).
  // Il calendario segue gli orari veri — lunedì riposo, cena da martedì a
  // sabato, pranzo la domenica — e i conti per serata cambiano col giorno
  // della settimana. La spiegazione e i numeri stanno in
  // `scripts/scenario/servizio.mjs`.
  //
  // ⚠️ Il mese fiacco è al 15% in meno di serata, non al 30%: deve restare
  // dentro i 150-200 conti al mese che fa un'osteria da 34 coperti, e
  // insieme essere **diverso** da quello pieno — se i due mesi si
  // somigliassero, il confronto della Proiezione non mostrerebbe niente.
  const serate = [
    ...serateDelMeseVero(meseFiacco, 0.85, rnd).map((s) => ({ ...s, ricco: false })),
    ...serateDelMeseVero(mesePieno, 1.0, rnd).map((s) => ({ ...s, ricco: true })),
  ];

  // I piatti divisi per fascia di prezzo: le serate ricche vendono i
  // secondi cari, quelle fiacche gli antipasti. È il MIX che fa muovere il
  // food cost del mese — con un mix uguale, quel numero sarebbe una
  // costante e non mostrerebbe niente.
  const economici = inCarta.filter((p) => p.prezzo <= 14);
  // (dichiarati qui perché servono anche alle situazioni storte, sotto)
  const cari = inCarta.filter((p) => p.prezzo > 14);

  // -------------------------------------------------------------------
  // 🔴 IL TAVOLO CHE MANGIA DAVVERO (23/08/2026)
  //
  // Prima di qui, ogni cliente ordinava **esattamente un piatto** (misurato:
  // 0,94 · 1,00 · 0,92 · 1,00 piatti a testa) e in due mesi c'era **una sola
  // bevanda**. Da lì venivano tutti i numeri assurdi insieme — scontrino a
  // 15,71 € per coperto, food cost al 6%, turni mai usati.
  //
  // Adesso il tavolo si compone persona per persona, con le bevande, e i
  // turni li mette insieme chi serve. Il come sta in
  // `scripts/scenario/servizio.mjs`; qui c'è solo il gesto.
  // -------------------------------------------------------------------
  // --- A. IL PROGRAMMA DELLE SERATE, composto PRIMA di scrivere ------
  //
  // 🔴 Si compone tutto in memoria e poi si esegue, e non è un vezzo: senza
  // sapere in anticipo **quanti piatti si venderanno**, non si può sapere
  // quanta merce serve — e un magazzino caricato a occhio finisce a zero a
  // metà del secondo mese, riempiendo il gestionale di «non ce n'era
  // abbastanza». Quella non è una prova: è un guasto costruito.
  const programma = [];
  let iTavoloProgramma = 0;
  for (const serata of serate) {
    for (let n = 0; n < serata.conti; n++) {
      const coperti = copertiDelTavolo(rnd);
      // Il venerdì e il sabato si ordina di più anche nel mese fiacco: la
      // serata piena non è una proprietà del mese, è del giorno.
      const ricco = serata.ricco || serata.settimana >= 5;
      const { righe } = componiConto({ coperti, ricco, inCarta, bevande, rnd });
      // ⚠️ Il tavolo si sceglie QUI e non al momento di aprire il conto:
      // serve a sapere, prima, su quale tavolo cadra' ogni cena — e quindi
      // a poterci mettere sopra una prenotazione che il gestionale
      // riconoscera' da solo quando il conto si apre (il legame del giro
      // D1, 18/08).
      programma.push({ serata, coperti, righe, tavolo: tavoli[iTavoloProgramma++ % tavoli.length] });
    }
  }

  // --- B. QUANTA MERCE SERVE, chiesta al DATABASE -------------------
  //
  // ⚠️ L'esplosione di una ricetta nei suoi ingredienti la sa fare il
  // database (`fabbisogno_preparazione`), e rifarla qui in JavaScript
  // sarebbe una seconda regola per la stessa cosa — il doppione che questo
  // progetto toglie ogni volta che lo trova. Quindi si chiede a lui.
  const porzioniVendute = new Map();
  for (const c of programma) {
    for (const r of c.righe) {
      if (r.genere !== "piatto") continue;
      porzioniVendute.set(r.nome, (porzioniVendute.get(r.nome) ?? 0) + 1);
    }
  }
  const fabbisogno = await fabbisognoDeiDueMesi(ctx, porzioniVendute);
  const spesaPerFornitore = await riforniscilMagazzino(ctx, { fabbisogno, serate, rnd });
  await fattureDeiFornitori(ctx, spesaPerFornitore, rnd);

  // --- B-bis. CHI AVEVA PRENOTATO ------------------------------------
  //
  // 🔴 Le prenotazioni si scrivono PRIMA dei conti, ed e' l'unico ordine che
  // fa funzionare la catena vera: aprendo il conto, il gestionale cerca da
  // solo la prenotazione confermata di quella serata su quel tavolo e ci si
  // aggancia (il legame del giro D1, 18/08); chiudendolo, quella
  // prenotazione diventa **«servita»** da sola (21/08).
  //
  // ⚠️ Costruendole dopo — com'era — nessuna delle due cose sarebbe mai
  // avvenuta: nello scenario di ieri c'erano **48 prenotazioni, 2 conti
  // agganciati e zero «servite»**. Due funzioni costruite e mai esercitate.
  //
  // ⚠️ E NON prenotano tutti: circa la meta' dei tavoli arriva senza
  // prenotare, che e' come va in un'osteria di paese. Se prenotassero
  // tutti, la sala non avrebbe mai un tavolo che si siede e basta.
  let conPrenotazione = 0;
  for (const c of programma) {
    if (rnd() > 0.52) continue;
    const chi = chiPrenota(rnd);
    const p = await createReservation({
      reservation_date: c.serata.data,
      reservation_time: oraDellaPrenotazione(c.serata.servizio, rnd),
      party_size: c.coperti,
      customer_name: `${MARCA}${chi.nome}`,
      customer_phone: chi.telefono,
      status: "confermata",
      type: "prenotazione",
      source: rnd() < 0.45 ? "form_pubblico" : "interno",
      notes: rnd() < 0.08 ? NOTE_PRENOTAZIONE[Math.floor(rnd() * NOTE_PRENOTAZIONE.length)] : null,
    });
    // Il tavolo: senza, il conto non saprebbe a quale prenotazione
    // agganciarsi — la regola guarda le confermate **su quel tavolo**.
    await assegnaPrenotazione(p.id, [c.tavolo.id]).catch(() => {});
    conPrenotazione += 1;
  }
  segna("prenotazioni che diventano una cena vera (il conto le riconosce da solo)", conPrenotazione);

  // --- C. E ADESSO SI SERVE -----------------------------------------
  const conti = [];
  let iTavolo = 0;
  let progressivoScontrino = 0;
  let stornate = 0;
  let scontrinati = 0;
  let mistiPagati = 0;
  {
    for (const { serata, coperti, righe, tavolo } of programma) {
      iTavolo += 1;
      const id = await orders.apriConto([tavolo.id], { serata: serata.data, note: `${MARCA}serata` });
      await orders.setOrderCoperti(id, coperti);

      const perTurno = new Map();
      const prezzoDellaRiga = new Map();
      let totale = coperti * (copertoPrezzo(ctx) ?? 0);
      for (const r of righe) {
        const riga = await orders.addDraftItem(id, {
          recipeId: r.genere === "piatto" ? r.recipe_id : null,
          freeTextName: r.genere === "bevanda" ? r.nome : null,
          destination: r.genere === "bevanda" ? "bar" : "cucina",
          quantity: 1,
          unitPrice: r.prezzo,
          note: r.nota ?? null,
          turno: r.turno ?? 1,
        });
        totale += Number(r.prezzo);
        prezzoDellaRiga.set(riga.id, Number(r.prezzo));
        const t = r.turno ?? 1;
        if (!perTurno.has(t)) perTurno.set(t, []);
        perTurno.get(t).push(riga.id);
      }

      // ⚠️ Si manda **un turno per volta**, come in sala: è il gesto che fa
      // uscire un ticket per giro. Mandando tutto insieme, la cucina
      // riceverebbe un foglio solo e i turni non si vedrebbero mai — cioè
      // la funzione del 21/08 resterebbe senza un dato addosso.
      const turni = [...perTurno.entries()].sort((a, b) => a[0] - b[0]);
      for (const [, ids] of turni) await orders.sendDraftItems(id, ids);

      // Uno storno ogni tanto: un piatto già partito per la cucina che il
      // cliente rimanda indietro. Nello scenario di ieri non ce n'era
      // **nessuno** in 288 righe, e la registrazione con motivo obbligatorio
      // non aveva niente su cui essere guardata.
      if (rnd() < 0.03 && turni.length) {
        const ids = turni[0][1];
        const vittima = ids[Math.floor(rnd() * ids.length)];
        const motivo = MOTIVI_STORNO[Math.floor(rnd() * MOTIVI_STORNO.length)];
        await orders.voidSentItem(vittima, motivo);
        totale -= prezzoDellaRiga.get(vittima) ?? 0;
        stornate += 1;
      }

      // ⚠️ Contante, carta e — una volta su dodici — **misto**: due mezzi
      // sullo stesso conto (Blocco 9 del mandato di correzione). Le quote
      // devono fare l'incassato al centesimo, e a rifiutare è il database:
      // se questo conto passa, quella regola è viva.
      if (rnd() < 0.08 && totale > 20) {
        const contanti = Math.round(totale * 0.4 * 100) / 100;
        await orders.closeOrderPaid(id, null, copertoPrezzo(ctx), [
          { mezzo: "contante", importo: contanti },
          { mezzo: "carta", importo: Math.round((totale - contanti) * 100) / 100 },
        ]);
        mistiPagati += 1;
      } else {
        await orders.closeOrderPaid(id, rnd() < 0.42 ? "contante" : "carta", copertoPrezzo(ctx));
      }

      // 🔴 LO SCONTRINO ESCE, e prima non usciva mai: **tutti e 62 i conti
      // dello scenario di ieri risultavano da fiscalizzare**, cioè quella
      // schermata mostrava l'elenco di tutto invece dell'eccezione. Qui
      // quasi tutti sono scontrinati; **cinque su cento no** (la stampante
      // che non ha risposto) e **due su cento** aspettano una fattura.
      const dado = rnd();
      if (dado < 0.93) {
        progressivoScontrino += 1;
        await orders.setDocumentoFiscale(id, {
          tipo: "scontrino",
          numero: `${serata.data.slice(0, 4)}-${String(progressivoScontrino).padStart(4, "0")}`,
          emessoIl: serata.data,
        });
        scontrinati += 1;
      } else if (dado < 0.95) {
        await orders.setDocumentoFiscale(id, { tipo: "fattura_da_emettere", numero: null, emessoIl: serata.data });
      }

      conti.push({ id, data: serata.data, coperti });
    }
  }
  segna(`conti chiusi su ${serate.length} serate (due mesi: uno fiacco, uno pieno)`, conti.length);
  segna("scontrini emessi (gli altri: stampante muta o fattura da fare)", scontrinati);
  segna("conti pagati con due mezzi insieme (contante + carta)", mistiPagati);
  segna("righe stornate dopo essere andate in cucina, col motivo", stornate);

  // -------------------------------------------------------------------
  // 4. LE DATE — l'unico punto in cui questo scenario scrive in tabella
  //
  // 🔴 E VA DICHIARATO, perché è una deroga alla regola di casa («si
  // costruisce chiamando le funzioni vere dell'app»): `close_order_paid`
  // scrive `closed_at = now()` e **non accetta una data**. Non è una
  // dimenticanza del gestionale — è giusto così, un conto si chiude quando
  // si chiude. Ma allora due mesi di storia non si possono costruire dai
  // gesti, e l'unica strada è farli nascere oggi e spostarli indietro.
  //
  // ⚠️ Si spostano TUTTE le date che quel conto ha addosso, comprese
  // quelle degli scarichi di magazzino: ridatare il conto e lasciare lo
  // scarico a oggi farebbe risultare il food cost di giugno consumato ad
  // agosto — cioè un numero sbagliato che nessuno collegherebbe a questa
  // riga.
  // -------------------------------------------------------------------
  let ridatati = 0;
  for (const c of conti) {
    const apertura = `${c.data}T19:${String(10 + Math.floor(rnd() * 45)).padStart(2, "0")}:00`;
    const chiusura = `${c.data}T21:${String(10 + Math.floor(rnd() * 45)).padStart(2, "0")}:00`;
    // 🔴 LA MARCA NON SI SCRIVE PIU' QUI: si scrive all'APERTURA del conto
    // (23/08/2026), e la riga qui sotto la ripete soltanto.
    //
    // La ragione di ieri vale ancora — senza marca la pulizia non riconosce
    // i conti e ogni esecuzione ne aggiunge senza togliere i precedenti,
    // misurato: 220 invece di 55. Ma metterla **dopo** lasciava aperto un
    // caso che stanotte si è presentato davvero: una costruzione
    // interrotta a metà (o due lanciate insieme) lascia conti **senza
    // marca**, che nessuna pulizia può più riconoscere. Sono rimasti lì 32
    // conti e un tavolo aperto su T1, e il comando successivo si è fermato
    // dicendo «questo tavolo ha già un conto aperto» — un messaggio giusto
    // che fa cercare il difetto nel posto sbagliato.
    //
    // ⚠️ È la stessa forma dei tredici ingredienti col vecchio prefisso
    // (22/08): *ciò che nasce senza il segno con cui verrà cercato è già
    // orfano nel momento in cui nasce.*
    const u1 = await supabase.from("orders")
      .update({ opened_at: apertura, closed_at: chiusura, note: `${MARCA}serata` })
      .eq("id", c.id);
    if (u1.error) throw new Error(`Non riesco a ridatare il conto: ${u1.error.message}`);
    // 🔴 IL SEGNO DELLO SCARICO SI SPOSTA, NON SI ACCENDE (23/08/2026).
    // Fino a stamattina questa riga scriveva `magazzino_scaricato_il` su
    // **tutti** i conti, compresi quelli dove lo scarico era fallito e la
    // colonna era rimasta vuota apposta. Misurato: 346 conti su 346 col
    // segno «scaricato», e 148 di loro non avevano tolto un grammo dalla
    // cella. ⚠️ Lo scenario nascondeva il difetto che doveva far vedere —
    // e l'unico modo di accorgersene era contare le righe di consumo,
    // cioè non fidarsi del segno.
    const u2 = await supabase.from("orders")
      .update({ magazzino_scaricato_il: chiusura })
      .eq("id", c.id)
      .not("magazzino_scaricato_il", "is", null);
    if (u2.error) throw new Error(`Non riesco a spostare lo scarico: ${u2.error.message}`);
    await supabase.from("order_items")
      .update({ sent_at: apertura, prepared_at: apertura, created_at: apertura })
      .eq("order_id", c.id);
    await supabase.from("stock_consumptions").update({ created_at: chiusura }).eq("order_id", c.id);
    // ⚠️ E LE QUOTE DI PAGAMENTO (23/08). Restavano a oggi: un conto di
    // giugno con l'incasso datato agosto fa quadrare la tesoreria di un
    // mese sbagliato, e nessuno collegherebbe quella differenza a questa
    // riga. È lo stesso motivo per cui si spostano gli scarichi.
    await supabase.from("order_payments").update({ created_at: chiusura }).eq("order_id", c.id);
    // Lo storno è avvenuto durante la cena, non oggi.
    await supabase.from("order_items")
      .update({ voided_at: apertura })
      .eq("order_id", c.id)
      .not("voided_at", "is", null);
    ridatati += 1;
  }
  segna("conti spostati nei due mesi (date, righe e scarichi insieme)", ridatati);

  // -------------------------------------------------------------------
  // 5. LE COSE STORTE — 🔴 è qui che il collaudo trova i difetti
  //
  // ⚠️ Un mese tutto pulito non serve a niente: le schermate si guardano
  // bene proprio quando c'è dentro qualcosa che non torna. Ogni voce qui
  // sotto è un caso che in un mese vero capita, e che a nessuno verrebbe
  // in mente di costruire apposta.
  // -------------------------------------------------------------------
  const storte = [];
  const giornoDentro = (mese, g) => `${mese}-${String(g).padStart(2, "0")}`;

  // (a) Un conto ANNULLATO — il cliente se n'è andato prima di ordinare.
  {
    const id = await orders.apriConto([tavoli[0].id], { serata: giornoDentro(mesePieno, 9), note: `${MARCA}conto annullato` });
    await orders.setOrderCoperti(id, 2);
    await orders.cancelOrder(id, "il tavolo se n'è andato prima di ordinare");
    await supabase.from("orders")
      .update({ opened_at: `${giornoDentro(mesePieno, 9)}T20:05:00`, closed_at: `${giornoDentro(mesePieno, 9)}T20:12:00`, note: `${MARCA}conto annullato` })
      .eq("id", id);
    storte.push("un conto annullato");
  }

  // (b) Un conto CHIUSO DUE GIORNI DOPO — capita: ci si dimentica aperto.
  // ⚠️ È il caso che fa divergere la serata di servizio dalla data di
  // chiusura, cioè proprio quello su cui la regola delle 5 esiste.
  {
    const id = await orders.apriConto([tavoli[1].id], { serata: giornoDentro(mesePieno, 14), note: `${MARCA}chiuso due giorni dopo` });
    await orders.setOrderCoperti(id, 4);
    const r = [];
    for (const p of economici.slice(0, 3)) {
      const x = await orders.addDraftItem(id, { recipeId: p.recipe_id, destination: "cucina", quantity: 1, unitPrice: p.prezzo, turno: 1 });
      r.push(x.id);
    }
    await orders.sendDraftItems(id, r);
    await orders.closeOrderPaid(id, "contante", ctx.copertoPrezzo ?? null);
    await supabase.from("orders")
      .update({ opened_at: `${giornoDentro(mesePieno, 14)}T20:30:00`, closed_at: `${giornoDentro(mesePieno, 16)}T11:20:00`, note: `${MARCA}chiuso due giorni dopo` })
      .eq("id", id);
    storte.push("un conto chiuso due giorni dopo la serata");
  }

  // (c) Un conto con una VOCE LIBERA e una NOTA sul tavolo.
  // ⚠️ La voce libera è il caso che NON scarica magazzino e finisce fra le
  // «anomalie di scarico»: quella schermata deve avere qualcosa dentro,
  // altrimenti si collauda una lista vuota.
  {
    const id = await orders.apriConto([tavoli[2].id], { serata: giornoDentro(mesePieno, 21), note: `${MARCA}voce libera` });
    await orders.setOrderCoperti(id, 3);
    await orders.updateOrderNote(id, `${MARCA}tavolo vicino alla finestra, cliente abituale`);
    const r = [];
    const x1 = await orders.addDraftItem(id, { recipeId: cari[0].recipe_id, destination: "cucina", quantity: 2, unitPrice: cari[0].prezzo, turno: 1 });
    const x2 = await orders.addDraftItem(id, { freeTextName: "Bottiglia Etna Rosso 2021", destination: "bar", quantity: 1, unitPrice: 28, turno: 1 });
    r.push(x1.id, x2.id);
    await orders.sendDraftItems(id, r);
    await orders.closeOrderPaid(id, "carta", ctx.copertoPrezzo ?? null);
    await supabase.from("orders")
      .update({ opened_at: `${giornoDentro(mesePieno, 21)}T20:40:00`, closed_at: `${giornoDentro(mesePieno, 21)}T22:50:00` })
      .eq("id", id);
    storte.push("un conto con voce libera (non scarica magazzino) e nota sul tavolo");
  }

  // (d) Un TAVOLONE: tre tavoli accostati, un conto solo.
  {
    const tre = tavoli.slice(4, 7).map((t) => t.id);
    if (tre.length === 3) {
      const id = await orders.apriConto(tre, { serata: giornoDentro(mesePieno, 24), note: `${MARCA}tavolone da otto` });
      await orders.setOrderCoperti(id, 8);
      const r = [];
      for (const p of [...cari.slice(0, 3), ...economici.slice(0, 4)]) {
        const x = await orders.addDraftItem(id, { recipeId: p.recipe_id, destination: "cucina", quantity: 1, unitPrice: p.prezzo, turno: 1 });
        r.push(x.id);
      }
      await orders.sendDraftItems(id, r);
      await orders.closeOrderPaid(id, "carta", ctx.copertoPrezzo ?? null);
      await supabase.from("orders")
        .update({ opened_at: `${giornoDentro(mesePieno, 24)}T20:15:00`, closed_at: `${giornoDentro(mesePieno, 24)}T23:10:00`, note: `${MARCA}tavolone da otto` })
        .eq("id", id);
      storte.push("un tavolone da otto (tre tavoli, un conto solo)");
    }
  }
  segna("situazioni storte in sala", storte.length);
  for (const s of storte) console.log(`      · ${s}`);

  // -------------------------------------------------------------------
  // 6. LE PRENOTAZIONI dei due mesi — comprese quelle andate storte
  //
  // ⚠️ Nello scenario vecchio erano **tutte confermate e tutte la stessa
  // sera**: un elenco così non fa vedere né uno storico né i casi che
  // capitano davvero. Qui ce n'è una che non si è presentata, una
  // annullata dal cliente e una spostata di data.
  // -------------------------------------------------------------------
  // ⚠️ Le prenotazioni ANDATE A BUON FINE sono gia' state scritte piu'
  // sopra, prima dei conti: sono quelle che il gestionale aggancia da solo.
  // Qui restano le tre cose che un elenco di sole prenotazioni riuscite non
  // farebbe mai vedere.
  let prenotazioni = 0;
  const stati = { non_presentata: 0, annullata: 0, rifiutata: 0 };

  // 1. CHI NON SI E' PRESENTATO. Confermata, serata passata, nessun conto.
  //
  // 🔴 E NON HA UNO STATO SUO — misurato scrivendolo: il database rifiuta
  // `no_show`, perche' gli stati sono solo `richiesta_in_attesa`,
  // `confermata`, `servita`, `rifiutata`, `annullata`. Chi si presenta
  // diventa «servita» da se' quando il conto si chiude; chi non si presenta
  // **resta confermata per sempre**.
  // ⚠️ Quindi il gestionale non lo sa distinguere da «mi sono dimenticato di
  // chiudere il conto», e per una prenotazione di tre settimane fa i due
  // casi si vedono identici. E' una domanda per Alessio, non una cosa da
  // decidere qui — e adesso, con quaranta no-show veri dentro, si vede.
  for (const [i, serata] of serate.entries()) {
    if (i % 6 !== 2) continue;
    const chi = chiPrenota(rnd);
    await createReservation({
      reservation_date: serata.data,
      reservation_time: oraDellaPrenotazione(serata.servizio, rnd),
      party_size: 2 + Math.floor(rnd() * 4),
      customer_name: `${MARCA}${chi.nome}`,
      customer_phone: chi.telefono,
      status: "confermata",
      source: rnd() < 0.5 ? "form_pubblico" : "interno",
      notes: "non si e' presentata (nessun conto quella sera)",
    });
    stati.non_presentata += 1;
    prenotazioni += 1;
  }

  // 2. CHI HA ANNULLATO, e chi si e' visto rifiutare la richiesta.
  for (const [i, serata] of serate.entries()) {
    if (i % 9 !== 4) continue;
    const chi = chiPrenota(rnd);
    const rifiutata = i % 18 === 4;
    await createReservation({
      reservation_date: serata.data,
      reservation_time: oraDellaPrenotazione(serata.servizio, rnd),
      party_size: 2 + Math.floor(rnd() * 6),
      customer_name: `${MARCA}${chi.nome}`,
      customer_phone: chi.telefono,
      status: rifiutata ? "rifiutata" : "annullata",
      source: rifiutata ? "form_pubblico" : "interno",
      notes: rifiutata ? "eravamo al completo" : "annullata dal cliente il giorno prima",
    });
    stati[rifiutata ? "rifiutata" : "annullata"] += 1;
    prenotazioni += 1;
  }
  segna(
    `prenotazioni andate storte (${stati.non_presentata} non presentate, ${stati.annullata} annullate, ${stati.rifiutata} rifiutate)`,
    prenotazioni
  );

  // 3. E IL FUTURO — che nello scenario di ieri **non esisteva affatto**.
  //
  // 🔴 Misurato: l'ultima prenotazione era di ieri. Cioe' aprendo il
  // Calendario o la sala di stasera si vedeva **il vuoto**, e le due cose
  // che un ristoratore guarda per prime — «chi viene stasera» e «com'e' il
  // fine settimana» — non si potevano collaudare.
  //
  // ⚠️ Fra queste ci sono le RICHIESTE IN ATTESA arrivate dal sito: sono
  // quelle che compaiono nel riquadro in cima al Calendario, ed erano zero.
  let future = 0;
  let inAttesa = 0;
  for (let g = 0; g <= 16; g++) {
    const data = giorni(oggi, g);
    const settimana = new Date(`${data}T12:00:00`).getDay();
    if (settimana === 1) continue; // lunedi' di riposo
    const quante = settimana >= 5 || settimana === 0 ? 4 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < quante; k++) {
      const chi = chiPrenota(rnd);
      const attesa = rnd() < 0.22;
      await createReservation({
        reservation_date: data,
        reservation_time: oraDellaPrenotazione(settimana === 0 ? "pranzo" : "cena", rnd),
        party_size: 2 + Math.floor(rnd() * 6),
        customer_name: `${MARCA}${chi.nome}`,
        customer_phone: chi.telefono,
        status: attesa ? "richiesta_in_attesa" : "confermata",
        source: attesa ? "form_pubblico" : rnd() < 0.5 ? "form_pubblico" : "interno",
        notes: rnd() < 0.1 ? NOTE_PRENOTAZIONE[Math.floor(rnd() * NOTE_PRENOTAZIONE.length)] : null,
      });
      if (attesa) inAttesa += 1;
      future += 1;
    }
  }
  segna(`prenotazioni dei prossimi giorni, di cui ${inAttesa} richieste ancora da confermare`, future);

  // Una prenotazione SPOSTATA: nata per un giorno, cambiata in un altro.
  {
    const p = await createReservation({
      reservation_date: giornoDentro(mesePieno, 18),
      reservation_time: "20:30",
      party_size: 6,
      customer_name: `${MARCA}Sciacca`,
      customer_phone: "+390351234599",
      status: "confermata",
      source: "interno",
    });
    await supabase.from("reservations")
      .update({ reservation_date: giornoDentro(mesePieno, 20), notes: "spostata dal 18 su richiesta del cliente" })
      .eq("id", p.id);
    segna("una prenotazione spostata di data", 1);
  }

  // 🔴 E LE PRENOTAZIONI SI RIDATANO ANCHE NEL «QUANDO SONO ARRIVATE»
  // (23/08/2026, difetto trovato da una prova diventata rossa).
  //
  // `createReservation` scrive `created_at` = adesso, quindi lo scenario
  // lasciava **262 prenotazioni nate nella stessa ora**. Il form pubblico
  // ha dall'08/08 un freno anti-abuso — 40 richieste all'ora complessive —
  // e quel freno scattava: per un'ora dopo ogni ricostruzione **il sito
  // rifiutava ogni prenotazione vera**, con un messaggio giusto e una
  // causa invisibile.
  //
  // ⚠️ Non è un difetto del gestionale: il freno funziona. È lo scenario
  // che raccontava una cosa impossibile — nessuno riceve due mesi di
  // prenotazioni in sessanta secondi — ed è la stessa famiglia delle quote
  // di pagamento che restavano a oggi.
  {
    // La marca delle prenotazioni sta nel NOME del cliente, non nelle note.
    const { data: daRidatare } = await supabase
      .from("reservations")
      .select("id, reservation_date")
      .like("customer_name", `${MARCA}%`);
    let spostate = 0;
    for (const p of daRidatare ?? []) {
      // Arrivata qualche giorno prima della cena, come succede davvero.
      const nascita = new Date(`${p.reservation_date}T18:00:00`);
      nascita.setDate(nascita.getDate() - (2 + Math.floor(rnd() * 8)));
      // ⚠️ E MAI NEL FUTURO, né in questa stessa ora: le prenotazioni dei
      // prossimi giorni cadrebbero lì, e sono proprio quelle che fanno
      // scattare il freno. Una cena di dopodomani prenotata ieri è normale;
      // prenotata «fra un'ora» no.
      const limite = new Date(Date.now() - 26 * 60 * 60 * 1000);
      if (nascita > limite) nascita.setTime(limite.getTime() - Math.floor(rnd() * 6) * 86400000);
      const u = await supabase
        .from("reservations")
        .update({ created_at: nascita.toISOString() })
        .eq("id", p.id);
      if (!u.error) spostate += 1;
    }
    segna("prenotazioni spostate anche nel «quando sono arrivate»", spostate);
  }

  // -------------------------------------------------------------------
  // 7. I CARICHI SCAGLIONATI — e il motivo per cui esistono
  //
  // 🔴 NON ERANO PREVISTI: li ha chiesti il gestionale. Al primo giro lo
  // scenario si è fermato con *«Giacenza insufficiente: disponibili
  // 0.0000, richiesti 1.5»* — **due mesi di servizio avevano svuotato la
  // dispensa**, che è esattamente quello che succede in un ristorante
  // vero. Un magazzino che regge sessanta conti senza mai ricomprare
  // sarebbe stato il segno che gli scarichi non funzionavano.
  //
  // ⚠️ Le scadenze sono SCAGLIONATE apposta: una partita in scadenza fra
  // due giorni, una fra sei, una fra tre settimane. Con scadenze tutte
  // uguali lo scadenziario mostrerebbe tutto o niente, e non si vedrebbe
  // se l'ordine di urgenza è giusto.
  // -------------------------------------------------------------------
  let ricarichi = 0;
  const RICARICO = [
    ["Melanzana lunga", 14, 1.95, 2],
    ["Pomodoro ciliegino", 12, 4.8, 6],
    ["Alici fresche", 5, 4.2, 2],
    ["Ricotta di pecora", 4, 8.5, 4],
    ["Farina di grano duro", 25, 1.35, 90],
    ["Olio extravergine", 10, 9.8, 120],
    ["Gambero rosso", 3, 24, 3],
    ["Tonno rosso", 4, 32, 5],
  ];
  for (const [nome, quanto, prezzo, fraQuantiGiorni] of RICARICO) {
    if (!dispensa[nome]) continue;
    await registerStockDelivery({
      ingredientId: dispensa[nome], quantity: quanto, unitPrice: prezzo,
      expiryDate: giorni(oggi, fraQuantiGiorni),
      supplierId: fornitori?.[0] ?? null,
      supplierBatchNumber: `L-${nome.slice(0, 3).toUpperCase()}-08`,
    });
    ricarichi += 1;
  }
  segna("carichi di rifornimento, con scadenze scaglionate da 2 a 120 giorni", ricarichi);

  // -------------------------------------------------------------------
  // 8. IL MAGAZZINO che non torna
  // -------------------------------------------------------------------
  const guai = [];

  // (a) Una partita SCADUTA e ancora in giacenza: è la riga che lo
  //     scadenziario deve far saltare all'occhio.
  {
    const ing = dispensa["Ricotta di pecora"] ?? dispensa["Alici fresche"];
    await registerStockDelivery({
      ingredientId: ing, quantity: 3, unitPrice: 8.5,
      expiryDate: giorni(oggi, -4), supplierId: fornitori?.[0] ?? null,
      supplierBatchNumber: "LOTTO-SCADUTO-01",
    });
    guai.push("una partita scaduta da quattro giorni, ancora in giacenza");
  }

  // (b) Merce BUTTATA — lo scarico che non è una vendita.
  {
    const ing = dispensa["Melanzana lunga"];
    await recordStockConsumption({ ingredientId: ing, quantity: 1.5, reason: "spreco", note: "cassetta dimenticata fuori cella" });
    guai.push("un chilo e mezzo buttato (spreco registrato)");
  }

  // (c) La giacenza che NON TORNA, nei due versi.
  // ⚠️ Servono tutte e due le direzioni: una correzione solo in
  // diminuzione si potrebbe leggere come «il gestionale sbaglia sempre in
  // eccesso», e non si vedrebbe se il segno è gestito bene.
  {
    const giu = dispensa["Pomodoro ciliegino"];
    const su = dispensa["Farina di grano duro"];
    const { data: liv } = await supabase.from("stock_levels_display").select("*").limit(1);
    void liv;
    await allineaGiacenza(giu, 2, "contati a mano: ne mancano");
    await allineaGiacenza(su, 30, "contati a mano: ce n'è di più del previsto");
    guai.push("due giacenze allineate a mano, una in meno e una in più");
  }
  segna("guai di magazzino", guai.length);
  for (const g of guai) console.log(`      · ${g}`);

  // -------------------------------------------------------------------
  // 9. LA CASSA dei due mesi
  //
  // ⚠️ Gli incassi di sala NON si scrivono qui: dal 04/08 chiudere un
  // conto non tocca la prima nota, e il saldo li LEGGE dai conti chiusi.
  // Scriverli sarebbe contarli due volte — la trappola che quella regola
  // esiste per evitare.
  // -------------------------------------------------------------------
  const causali = await listAllCausali();
  const usc = causali.filter((c) => c.kind === "uscita" && !/versamento|differenza|rimborso/i.test(c.label));
  const ent = causali.filter((c) => c.kind === "entrata" && !/versamento|differenza/i.test(c.label));
  let movimenti = 0;
  const SPESE = [
    [4, 120.5, "spesa al mercato"], [11, 62.0, "detersivi e materiale"],
    [18, 240.0, "acconto fornitore vini"], [25, 88.4, "manutenzione cella"],
  ];
  for (const mese of [meseFiacco, mesePieno]) {
    for (const [g, importo, nota] of SPESE) {
      const causale = usc[movimenti % Math.max(1, usc.length)];
      if (!causale) break;
      await createCashMovement({
        entity_id: ente, direction: "uscita", amount: importo,
        movement_date: giornoDentro(mese, g), causale_id: causale.id,
        mezzo: movimenti % 3 === 0 ? "banca" : "cassa",
        note: `${MARCA}${nota}`,
      });
      movimenti += 1;
    }
    if (ent[0]) {
      await createCashMovement({
        entity_id: ente, direction: "entrata", amount: 150,
        movement_date: giornoDentro(mese, 27), causale_id: ent[0].id,
        mezzo: "cassa", note: `${MARCA}rimborso da fornitore`,
      });
      movimenti += 1;
    }
  }
  segna("movimenti di prima nota sui due mesi (cassa e banca)", movimenti);

  // Un conteggio del cassetto con una differenza, e un versamento in banca.
  // ⚠️ La differenza genera un movimento vero: se restasse solo dichiarata,
  // il saldo continuerebbe a dire un numero che il cassetto ha smentito.
  let tesoreria = 0;
  try {
    await registraConteggioCassa({
      entityId: ente, contato: 480.5, data: giornoDentro(mesePieno, 28),
      nota: `${MARCA}conteggio di fine mese`, presoAtto: true,
    });
    tesoreria += 1;
    await versaInBanca({ entityId: ente, importo: 300, data: giornoDentro(mesePieno, 28), nota: `${MARCA}versamento` });
    tesoreria += 1;
  } catch (e) {
    console.log(`      ⚠ cassa: ${e.message}`);
  }
  segna("conteggio del cassetto (con differenza) e versamento in banca", tesoreria);

  // -------------------------------------------------------------------
  // 10. UNA FATTURA PAGATA IN RITARDO
  // -------------------------------------------------------------------
  let fatture = 0;
  if (fornitori?.length) {
    const f = await createSupplierInvoice({
      entityId: ente, supplierId: fornitori[0],
      invoiceNumber: `${MARCA}2026-114`,
      invoiceDate: giornoDentro(meseFiacco, 6),
      dueDate: giornoDentro(meseFiacco, 20),
      amount: 430.8, note: `${MARCA}ortofrutta di giugno`,
    });
    // ⚠️ Pagata con 19 giorni di ritardo, e la data d'uscita è quella VERA:
    // la schermata deve poter dire «scadeva a giugno, è uscita a luglio».
    await markInvoicePaid(f?.invoice_id ?? f?.id ?? f, {
      paymentMethod: "bonifico",
      dataUscita: giornoDentro(mesePieno, 9),
    });
    fatture += 1;
    segna("una fattura pagata in ritardo (scadeva a giugno, pagata a luglio)", fatture);
  }

  // -------------------------------------------------------------------
  // 11. I PREVENTIVI — i tre esiti, che sono tre cose diverse
  // -------------------------------------------------------------------
  let preventivi = 0;
  if (ctx.salvaPreventivo) {
    // ⚠️ LE DUE NATURE NON SI MESCOLANO, e il database lo impone: una riga
    // di «cibo» ha la ricetta e NON ha un prezzo suo (il costo lo calcola il
    // gestionale dal food cost); una riga «extra» ha un prezzo scritto a
    // mano e nessuna ricetta. Il primo tentativo passava ricetta *e*
    // descrizione senza dichiarare la natura, e le tre bozze sono state
    // rifiutate tutte e tre — bene così: è il vincolo che impedisce una
    // riga che nessuno saprebbe come contare.
    const RIGHE = [
      ...inCarta.slice(0, 5).map((p) => ({
        natura: "cibo", recipe_id: p.recipe_id, porzioni_per_persona: 1,
      })),
      // Un extra vero: quello che in un preventivo si scrive a mano.
      { natura: "extra", descrizione: "Servizio e allestimento sala", quantita: 1, prezzo: 180 },
    ];
    const BOZZE = [
      ["Battesimo Lo Giudice", giornoDentro(mesePieno, 12), 35, "accettato", "servito: l'evento c'è stato"],
      ["Cena aziendale Sicilcom", giorni(oggi, 26), 24, "inviato", "in trattativa: aspetta risposta"],
      ["Compleanno Restivo", giornoDentro(meseFiacco, 22), 18, "rifiutato", "hanno scelto un altro locale"],
    ];
    for (const [nome, data, persone, stato, nota] of BOZZE) {
      try {
        const p = await ctx.salvaPreventivo({
          testata: {
            entity_id: ente, cliente_nome: `${MARCA}${nome}`,
            cliente_telefono: "+390351234570", data_evento: data,
            ora_evento: "20:00", persone, stato, note: nota,
          },
          righe: RIGHE,
        });
        void p;
        preventivi += 1;
      } catch (e) {
        console.log(`      ⚠ preventivo «${nome}»: ${e.message}`);
      }
    }
    segna("preventivi: uno accettato e servito, uno in trattativa, uno rifiutato", preventivi);
  }

  void dispensaId;
  void updateIngredientPrice;
  return { inCarta, carta, conti, mesePieno, meseFiacco, tavoli, economici, cari, storte };
}

// Il prezzo del coperto letto dalle impostazioni, se il chiamante l'ha passato.
function copertoPrezzo(ctx) {
  return ctx.copertoPrezzo ?? null;
}

// Il primo giorno del mese N mesi fa, in ISO.
function mesePrecedente(isoDate, quanti) {
  const [a, m] = isoDate.split("-").map(Number);
  const d = new Date(a, m - 1 - quanti, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ⚠️ QUI C'ERA `serateDelMese`, che prendeva le PRIME N serate del mese
// saltando il lunedì. È stata TOLTA il 23/08 insieme alla scala vecchia:
// sceglieva venti serate su cinquanta, cioè costruiva un mese in cui il
// locale apriva a giorni alterni. Il calendario vero — con i giorni della
// settimana che pesano diverso — sta in `scripts/scenario/servizio.mjs`.
//
// Non è stata lasciata «per sicurezza»: una funzione che nessuno chiama è
// una strada che qualcuno riprenderà fra sei mesi credendo sia quella buona.
// --- attrezzi ------------------------------------------------------------

// ⚠️ Deterministico di proposito: due esecuzioni dello stesso comando
// devono produrre lo stesso scenario, altrimenti «rifallo e riprova» non
// riproduce il caso che si stava guardando.
export function seminato(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Somma giorni a una data ISO restando sul calendario locale.
export function giorni(isoDate, quanti) {
  const [a, m, g] = isoDate.split("-").map(Number);
  const d = new Date(a, m - 1, g + quanti);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ⚠️ I motivi di uno storno sono quelli veri di una sala: un piatto che
// torna indietro ha sempre una ragione, e il gestionale la pretende. Con un
// motivo unico, l'elenco degli storni non direbbe niente a chi lo legge.
const MOTIVI_STORNO = [
  "Il cliente ha cambiato idea",
  "Sbagliato tavolo",
  "Piatto arrivato freddo, rifatto",
  "Doppio invio per errore",
  "Allergia dichiarata dopo l'ordine",
];

// ---------------------------------------------------------------------
// QUANTA MERCE SERVE PER DUE MESI — e la risposta la dà il database
//
// 🔴 PERCHÉ NON SI CALCOLA QUI. L'esplosione di una ricetta nei suoi
// ingredienti — con le preparazioni dentro le preparazioni e lo scarto di
// ognuno — è una regola che vive in `fabbisogno_preparazione`. Riscriverla
// in JavaScript per sapere quanta merce comprare sarebbe **una seconda
// regola per la stessa cosa**, e il giorno che una delle due cambia
// nessuno se ne accorge: il magazzino comincerebbe a scendere di un numero
// e a rifornirsi di un altro.
//
// ⚠️ Quella funzione non è concessa a nessun client (solo a `postgres`), e
// va bene così: qui si passa da `psql`, come le migrazioni.
// ---------------------------------------------------------------------
async function fabbisognoDeiDueMesi(ctx, porzioniVendute) {
  const { interrogaProva } = ctx;
  if (!interrogaProva || porzioniVendute.size === 0) return new Map();
  const valori = [...porzioniVendute.entries()]
    .map(([nome, n]) => `('${String(nome).replace(/'/g, "''")}', ${n})`)
    .join(", ");
  const sql = `
    with vendite(nome, porzioni) as (values ${valori})
    select i.name || ' = ' || round(sum(f.quantita)::numeric, 4)
      from vendite v
      join recipes r on r.name = v.nome
      cross join lateral fabbisogno_preparazione(r.id, v.porzioni) f
      join ingredients i on i.id = f.ingredient_id
     group by i.name
     order by i.name;
  `;
  const fuori = new Map();
  for (const riga of interrogaProva(sql).split(/\r?\n/)) {
    const m = riga.trim().match(/^(.+) = ([0-9.]+)$/);
    if (m) fuori.set(m[1], Number(m[2]));
  }
  return fuori;
}

// ---------------------------------------------------------------------
// I RIFORNIMENTI — la merce arriva tutte le settimane, non tutta il primo
// giorno
//
// 🔴 Misurato sullo scenario di ieri: **tutte le 103 partite di magazzino
// erano arrivate lo stesso giorno**. Con due mesi di servizio veri quella
// merce finisce a metà del primo mese, e da lì in poi ogni conto lascia una
// riga «non ce n'era abbastanza» — cioè il gestionale racconta un guasto
// che non è suo.
//
// ⚠️ E un magazzino tutto della stessa data non fa vedere niente di quello
// che serve: FEFO prende dalla partita che scade prima, lo scadenziario
// avvisa sulle partite vecchie, la tracciabilità risale al lotto. Con una
// data sola quei tre non hanno niente da distinguere.
//
// Come sono dimensionati: **quello che i due mesi consumeranno davvero**
// (chiesto al database qui sopra), meno quello che c'è già, più un residuo
// del 20% — perché a fine agosto la cella non è vuota.
// ---------------------------------------------------------------------
async function riforniscilMagazzino(ctx, { fabbisogno, serate, rnd }) {
  const { supabase, registerStockDelivery, segna, fornitori, fornitoriPerNome, dispensa } = ctx;
  if (!fabbisogno.size) {
    segna("rifornimenti: nessuno (non ho potuto chiedere il fabbisogno al database)", 0);
    return;
  }
  const { data: giacenze } = await supabase.from("v_stock_levels").select("ingredient_id, ingredient_name, current_quantity");
  const inCella = new Map((giacenze ?? []).map((r) => [r.ingredient_name, Number(r.current_quantity) || 0]));
  const prezzi = new Map(MATERIE_PRIME.map((r) => [r[0], r[3]]));
  const conservazioni = new Map(MATERIE_PRIME.map((r) => [r[0], r[6]]));
  const categorie = new Map(MATERIE_PRIME.map((r) => [r[0], r[1]]));
  // ⚠️ Chi porta cosa: il pesce lo porta il pescivendolo, non un camion
  // solo per tutto. E' quello che fa tornare le fatture coi carichi.
  const idFornitore = (categoria) =>
    (fornitoriPerNome && fornitoriPerNome.get(fornitoreDellaCategoria(categoria))) ?? fornitori?.[0] ?? null;
  // Quanto si e' comprato da ciascuno, giorno per giorno: da qui nascono le
  // fatture, che cosi' **tornano con la merce** invece di essere numeri
  // scollegati.
  const spesa = new Map();

  // Le date di consegna: due volte a settimana, il martedì e il venerdì,
  // dentro il periodo delle serate.
  const giorniConsegna = [...new Set(serate.map((s) => s.data))]
    .sort()
    .filter((d) => [2, 5].includes(new Date(`${d}T12:00:00`).getDay()));
  if (!giorniConsegna.length) return;

  let partite = 0;
  let consegne = 0;
  // ⚠️ `register_stock_delivery` scrive `received_at = now()` e non accetta
  // una data — com'è giusto: la merce arriva quando arriva. Quindi le
  // partite nascono oggi e si spostano indietro dopo, esattamente come i
  // conti. Senza, il magazzino avrebbe due mesi di consumi e **tutte le
  // partite arrivate oggi**, che è il difetto che questo blocco toglie.
  const daRidatare = [];
  const perGiorno = new Map(giorniConsegna.map((g) => [g, []]));
  for (const [nome, serve] of fabbisogno) {
    const id = dispensa[nome];
    if (!id) continue;
    const daComprare = serve * 1.2 - (inCella.get(nome) ?? 0);
    if (daComprare <= 0.1) continue;
    // ⚠️ Il fresco arriva spesso e poco, la dispensa di rado e tanto: è la
    // differenza fra una cella e uno scaffale, e si vede nello
    // scadenziario.
    const cons = conservazioni.get(nome) ?? "dispensa";
    const fresco = cons.startsWith("frigo") || cons === "freezer";
    const quante = fresco ? Math.min(giorniConsegna.length, 12) : Math.min(giorniConsegna.length, 4);
    const passo = giorniConsegna.length / quante;
    // 🔴 IL PASSO SI CALCOLA IN VIRGOLA, NON INTERO (misurato dopo il primo
    // giro a scala piena): con `Math.floor(26 / 12) = 2` — e peggio ancora
    // con un passo di 1 — le consegne si fermavano **al dodicesimo giorno
    // utile**, cioe' al 14 luglio. Meta' del secondo mese restava senza
    // rifornimenti, e il magazzino ci arrivava vuoto. Nessun errore: solo
    // una seconda meta' di luglio che sembrava un locale che non compra
    // piu' niente.
    for (let k = 0; k < quante; k++) {
      const i = Math.min(giorniConsegna.length - 1, Math.round(k * passo));
      perGiorno.get(giorniConsegna[i]).push({ nome, id, cons, fresco, categoria: categorie.get(nome) ?? "altro", quantita: daComprare / quante });
    }
  }

  for (const [giorno, righe] of perGiorno) {
    if (!righe.length) continue;
    consegne += 1;
    for (const r of righe) {
      const prezzo = prezzi.get(r.nome) ?? 1;
      // ⚠️ Il prezzo oscilla di poco fra una consegna e l'altra: è come si
      // comporta un fornitore vero, ed è anche l'unico modo perché la
      // sorveglianza dei rincari abbia qualcosa da guardare. Senza,
      // `price_history` avrebbe una riga sola per prodotto.
      const variazione = 1 + (rnd() - 0.45) * 0.12;
      const lotto = await registerStockDelivery({
        ingredientId: r.id,
        quantity: Math.round(r.quantita * 100) / 100,
        unitCost: Math.round(prezzo * variazione * 100) / 100,
        expiryDate: giorni(giorno, r.fresco ? 4 + Math.floor(rnd() * 6) : 150 + Math.floor(rnd() * 200)),
        supplierId: idFornitore(r.categoria),
        note: `${ctx.MARCA}consegna del ${giorno}`,
      });
      const costo = Math.round(r.quantita * prezzo * variazione * 100) / 100;
      const chiave = `${fornitoreDellaCategoria(r.categoria)}|${giorno}`;
      spesa.set(chiave, (spesa.get(chiave) ?? 0) + costo);
      const idLotto = lotto?.lot_id ?? lotto?.id ?? lotto;
      if (typeof idLotto === "string") daRidatare.push([idLotto, giorno]);
      partite += 1;
    }
  }
  // Le date vere delle consegne, in un aggiornamento per giorno.
  const perData = new Map();
  for (const [id, giorno] of daRidatare) {
    if (!perData.has(giorno)) perData.set(giorno, []);
    perData.get(giorno).push(id);
  }
  for (const [giorno, ids] of perData) {
    const r = await supabase.from("stock_lots")
      .update({ received_at: `${giorno}T07:20:00` })
      .in("id", ids);
    if (r.error) throw new Error(`Non riesco a ridatare una consegna: ${r.error.message}`);
  }
  segna(`partite di magazzino arrivate in ${consegne} consegne, due volte a settimana`, partite);
  return spesa;
}

// ⚠️ Le note di una prenotazione sono quelle vere di un telefono che
// squilla: un'allergia, un compleanno, un passeggino. Servono perche' la
// riga della prenotazione cambia forma quando ce n'e' una — e nello
// scenario di ieri ce n'era **una sola in due mesi**.
const NOTE_PRENOTAZIONE = [
  "Un ospite allergico ai crostacei",
  "Compleanno: portare la torta a fine cena",
  "Tavolo tranquillo se possibile",
  "Arrivano con un passeggino",
  "Un ospite celiaco",
  "Anniversario di matrimonio",
  "Vengono dopo il teatro, forse in ritardo",
  "Chiedono di stare all'aperto",
];

// ---------------------------------------------------------------------
// LE FATTURE DEI FORNITORI — due mesi, e ognuna corrisponde alla merce
//
// 🔴 Nello scenario del 22/08 le fatture erano **cinque**, inventate, e non
// avevano niente a che vedere con la merce entrata. Quindi le due domande
// vere di quella schermata — *«quanto devo ancora pagare?»* e *«questa
// fattura corrisponde a quello che è arrivato?»* — non si potevano
// nemmeno porre.
//
// Qui ogni fornitore fattura **quello che ha consegnato**, ogni quindici
// giorni: gli importi vengono dai carichi, non da un numero scelto a mano.
//
// ⚠️ E gli stati sono quelli veri di uno scadenziario: la maggior parte
// pagate, qualcuna aperta ma non ancora scaduta, **due scadute** e una con
// una nota di credito sopra. Se fossero tutte pagate, quella schermata
// direbbe la stessa cosa sia che funzioni sia che no.
// ---------------------------------------------------------------------
async function fattureDeiFornitori(ctx, spesa, rnd) {
  const {
    MARCA, ente, segna, createSupplierInvoice, markInvoicePaid,
    fornitoriPerNome, registraNotaCredito, oggi,
  } = ctx;
  if (!spesa || spesa.size === 0) return;

  // Le consegne si raggruppano per fornitore e per quindicina: è così che
  // fattura un fornitore vero, non consegna per consegna.
  const perFornitore = new Map();
  for (const [chiave, importo] of spesa) {
    const [nome, giorno] = chiave.split("|");
    const quindicina = `${giorno.slice(0, 7)}-${Number(giorno.slice(8, 10)) <= 15 ? "1" : "2"}`;
    const k = `${nome}|${quindicina}`;
    if (!perFornitore.has(k)) perFornitore.set(k, { nome, quindicina, importo: 0, ultimoGiorno: giorno });
    const riga = perFornitore.get(k);
    riga.importo += importo;
    if (giorno > riga.ultimoGiorno) riga.ultimoGiorno = giorno;
  }

  let emesse = 0;
  let pagate = 0;
  let scadute = 0;
  let aperte = 0;
  let progressivo = 0;
  const ordinate = [...perFornitore.values()].sort((a, b) => a.ultimoGiorno.localeCompare(b.ultimoGiorno));
  for (const riga of ordinate) {
    const idFornitore = fornitoriPerNome?.get(riga.nome);
    if (!idFornitore) continue;
    progressivo += 1;
    const dataFattura = riga.ultimoGiorno;
    const scadenza = giorni(dataFattura, 30);
    // ⚠️ L'IVA non si scompone: `supplier_invoices` tiene un importo solo,
    // ed è la stessa cosa che Alessio legge sul totale del documento.
    const importo = Math.round(riga.importo * 1.1 * 100) / 100;
    const id = await createSupplierInvoice({
      entityId: ente,
      supplierId: idFornitore,
      invoiceNumber: `${dataFattura.slice(0, 4)}/${String(progressivo).padStart(3, "0")}`,
      invoiceDate: dataFattura,
      dueDate: scadenza,
      amount: importo,
      note: `${MARCA}merce consegnata nella quindicina`,
    });
    emesse += 1;

    // Chi paga e quando: le vecchie sono quasi tutte pagate, e due restano
    // indietro apposta.
    const scaduta = scadenza < oggi;
    if (scaduta && progressivo % 7 !== 3) {
      await markInvoicePaid(id, {
        paymentMethod: rnd() < 0.75 ? "bonifico" : "contante",
        dataUscita: giorni(scadenza, -1 - Math.floor(rnd() * 5)),
      });
      pagate += 1;
    } else if (scaduta) {
      scadute += 1;
    } else {
      aperte += 1;
    }

    // Una nota di credito ogni tanto: merce non conforme, resa al fornitore.
    if (registraNotaCredito && progressivo % 11 === 5) {
      await registraNotaCredito({
        entityId: ente,
        supplierId: idFornitore,
        data: giorni(dataFattura, 3),
        importo: Math.round(importo * 0.08 * 100) / 100,
        fatturaId: id,
        numero: `NC-${dataFattura.slice(0, 4)}/${progressivo}`,
        note: `${MARCA}reso per merce non conforme`,
      }).catch(() => {});
    }
  }
  segna(
    `fatture dei fornitori sui due mesi (${pagate} pagate, ${aperte} ancora aperte, ${scadute} SCADUTE)`,
    emesse
  );
}
