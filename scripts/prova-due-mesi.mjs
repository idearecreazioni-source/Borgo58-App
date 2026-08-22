import { MATERIE_PRIME, PREPARAZIONI, FINGER, PIATTI, PIATTI_IN_CARTA, SELEZIONI, BOZZE } from "./scenario/carta.mjs";

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
// 🔴 PERCHÉ QUESTI NUMERI E NON ALTRI — misurati prima di scrivere
// ---------------------------------------------------------------------
//
// **~60 conti su ~20 serate.** Tre misure, non un'impressione:
//
// 1. **Costo**: un conto completo (apri + coperti + righe + invio +
//    chiusura) costa **1,58 secondi** misurati col cronometro. 60 conti
//    sono ~95 secondi; 150 sarebbero 4 minuti. Questo comando si rilancia
//    ogni volta che il collaudo rompe qualcosa, e un comando da quattro
//    minuti si smette di rilanciare.
// 2. **Rumore**: con 30 conti al mese un conto storto pesa il **3%** sulla
//    media. Con 5 conti peserebbe il 20% (e nasconderebbe tutto il resto);
//    con 200 sparirebbe nel mucchio — *un difetto che si diluisce non lo
//    trova nessuno*, ed è l'avvertenza del mandato.
// 3. **Leggibilità**: 60 righe Alessio le scorre e le ricontrolla a mano.
//    È la proprietà che rende un collaudo diverso da una prova automatica.
//
// ⚠️ **E IL RAPPORTO COL VERO VA DICHIARATO**: un'osteria da 34 coperti fa
// 150-200 conti al mese. Questi due mesi ne hanno ~30 ciascuno, cioè **un
// quinto**. I totali in euro sono quindi bassi rispetto al piano della
// Proiezione, e lo scostamento risulterà negativo: **non è un difetto del
// calcolo, è la taglia dello scenario.**
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
      await registerStockDelivery({
        ingredientId: id,
        quantity: giacenza,
        unitPrice: prezzo,
        unitCost: prezzo,
        expiryDate: giorni(oggi, conservazione === "dispensa" || conservazione === "temperatura_ambiente" ? 120 : 9),
        supplierId: fornitori?.[0] ?? null,
      });
    }
  }
  segna("materie prime in dispensa (e' da queste che nasce un food cost vero)", nuoviIngredienti);

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

  const serate = [
    ...serateDelMese(meseFiacco, 8, rnd).map((d) => ({ data: d, conti: 2, ricco: false })),
    ...serateDelMese(mesePieno, 12, rnd).map((d) => ({ data: d, conti: 3, ricco: true })),
  ];

  // I piatti divisi per fascia di prezzo: le serate ricche vendono i
  // secondi cari, quelle fiacche gli antipasti. È il MIX che fa muovere il
  // food cost del mese — con un mix uguale, quel numero sarebbe una
  // costante e non mostrerebbe niente.
  const economici = inCarta.filter((p) => p.prezzo <= 14);
  // (dichiarati qui perché servono anche alle situazioni storte, sotto)
  const cari = inCarta.filter((p) => p.prezzo > 14);

  const conti = [];
  let iTavolo = 0;
  for (const serata of serate) {
    for (let n = 0; n < serata.conti; n++) {
      const tavolo = tavoli[iTavolo++ % tavoli.length];
      const coperti = serata.ricco ? 2 + Math.floor(rnd() * 6) : 2 + Math.floor(rnd() * 3);
      const id = await orders.apriConto([tavolo.id], { serata: serata.data });
      await orders.setOrderCoperti(id, coperti);

      const quanti = Math.max(2, Math.round(coperti * (serata.ricco ? 1.4 : 1.0)));
      const scelta = [];
      for (let k = 0; k < quanti; k++) {
        const sacco = serata.ricco && rnd() < 0.55 ? cari : economici;
        scelta.push(sacco[Math.floor(rnd() * sacco.length)]);
      }
      const righe = [];
      for (const p of scelta) {
        const r = await orders.addDraftItem(id, {
          recipeId: p.recipe_id, destination: "cucina", quantity: 1,
          unitPrice: p.prezzo, turno: 1,
        });
        righe.push(r.id);
      }
      await orders.sendDraftItems(id, righe);
      // ⚠️ Contante e carta mescolati: la tesoreria tiene separati il
      // cassetto e la banca, e con un mezzo solo quella distinzione non si
      // potrebbe guardare.
      await orders.closeOrderPaid(id, rnd() < 0.45 ? "contante" : "carta", copertoPrezzo(ctx));
      conti.push({ id, data: serata.data });
    }
  }
  segna(`conti chiusi su ${serate.length} serate (due mesi: uno fiacco, uno pieno)`, conti.length);

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
    // 🔴 LA MARCA VA MESSA QUI, e non è un dettaglio: la pulizia dello
    // scenario riconosce i conti da `note like 'BASE-%'`. Senza, ogni
    // esecuzione ne AGGIUNGE 52 senza togliere i precedenti — misurato:
    // dopo pochi giri il database di prova ne aveva 220. Un comando che
    // dice «rifallo» e invece accumula è peggio di uno che non pulisce,
    // perché sembra che pulisca.
    const u1 = await supabase.from("orders")
      .update({ opened_at: apertura, closed_at: chiusura, magazzino_scaricato_il: chiusura, note: `${MARCA}serata` })
      .eq("id", c.id);
    if (u1.error) throw new Error(`Non riesco a ridatare il conto: ${u1.error.message}`);
    await supabase.from("order_items")
      .update({ sent_at: apertura, prepared_at: apertura, created_at: apertura })
      .eq("order_id", c.id);
    await supabase.from("stock_consumptions").update({ created_at: chiusura }).eq("order_id", c.id);
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
    const id = await orders.apriConto([tavoli[0].id], { serata: giornoDentro(mesePieno, 9) });
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
    const id = await orders.apriConto([tavoli[1].id], { serata: giornoDentro(mesePieno, 14) });
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
    const id = await orders.apriConto([tavoli[2].id], { serata: giornoDentro(mesePieno, 21) });
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
      const id = await orders.apriConto(tre, { serata: giornoDentro(mesePieno, 24) });
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
  const NOMI = ["Bianchi", "Ferrara", "La Rosa", "Gulisano", "Interlandi", "Nicosia", "Pappalardo", "Zappalà"];
  let prenotazioni = 0;
  const stati = { confermata: 0, annullata: 0, non_presentata: 0 };
  for (const [i, serata] of serate.entries()) {
    // due prenotazioni per serata, con esiti diversi
    for (let k = 0; k < 2; k++) {
      const n = (i * 2 + k) % NOMI.length;
      const ora = k === 0 ? "20:00" : "21:30";
      // ⚠️ Gli esiti NON sono a caso: uno ogni sette non si presenta e uno
      // ogni undici viene annullato. Con una distribuzione casuale, due
      // esecuzioni darebbero scenari diversi e «rifallo» non riprodurrebbe
      // il caso che si stava guardando.
      //
      // 🔴 E IL «NON SI È PRESENTATO» NON HA UNO STATO SUO — misurato
      // scrivendolo: il database rifiuta `no_show`, perché gli stati sono
      // solo `richiesta_in_attesa`, `confermata`, `servita`, `rifiutata`,
      // `annullata`. Nel gestionale una prenotazione che non si presenta
      // **resta «confermata» per sempre**: chi si presenta diventa
      // «servita» da sé quando il conto si chiude (trigger del 21/08), chi
      // non si presenta no.
      // ⚠️ Quindi qui il no-show si costruisce come è fatto nella realtà —
      // confermata, di una serata passata, senza nessun conto — e la nota
      // lo dice a parole. **Ma il gestionale non sa distinguerlo da «mi
      // sono dimenticato di chiudere il conto»**, ed è una domanda per
      // Alessio, non una cosa da decidere qui.
      const esito = (i * 2 + k) % 7 === 3 ? "non_presentata" : (i * 2 + k) % 11 === 5 ? "annullata" : "confermata";
      const stato = esito === "non_presentata" ? "confermata" : esito;
      await createReservation({
        reservation_date: serata.data,
        reservation_time: ora,
        party_size: 2 + ((i + k) % 5),
        customer_name: `${MARCA}${NOMI[n]}`,
        customer_phone: `+3903512345${String(10 + n).padStart(2, "0")}`,
        status: stato,
        source: k === 0 ? "form_pubblico" : "interno",
        notes: esito === "non_presentata" ? "non si è presentata (nessun conto quella sera)" : null,
      });
      stati[esito] += 1;
      prenotazioni += 1;
    }
  }
  segna(`prenotazioni sui due mesi (${stati.confermata} confermate, ${stati.non_presentata} non presentate, ${stati.annullata} annullate)`, prenotazioni);

  // Una prenotazione SPOSTATA: nata per un giorno, cambiata in un altro.
  {
    const p = await createReservation({
      reservation_date: giornoDentro(mesePieno, 18),
      reservation_time: "20:30",
      party_size: 6,
      customer_name: `${MARCA}Sciacca (spostata)`,
      customer_phone: "+390351234599",
      status: "confermata",
      source: "interno",
    });
    await supabase.from("reservations")
      .update({ reservation_date: giornoDentro(mesePieno, 20), notes: "spostata dal 18 su richiesta del cliente" })
      .eq("id", p.id);
    segna("una prenotazione spostata di data", 1);
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

// Le serate di servizio di un mese: martedì-sabato, saltando il lunedì di
// riposo. ⚠️ Prende le PRIME `quante` disponibili invece che a caso, così
// due esecuzioni danno lo stesso calendario.
function serateDelMese(meseIso, quante, rnd) {
  const [a, m] = meseIso.split("-").map(Number);
  const giorniNelMese = new Date(a, m, 0).getDate();
  const candidate = [];
  for (let g = 1; g <= giorniNelMese; g++) {
    const d = new Date(a, m - 1, g);
    const gs = d.getDay(); // 0 domenica, 1 lunedì
    if (gs === 1) continue; // lunedì di riposo
    candidate.push(`${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`);
  }
  // distribuite sul mese, non tutte nella prima settimana
  const passo = Math.max(1, Math.floor(candidate.length / quante));
  const scelte = [];
  for (let i = 0; i < candidate.length && scelte.length < quante; i += passo) scelte.push(candidate[i]);
  void rnd;
  return scelte;
}

// --- attrezzi ------------------------------------------------------------

// ⚠️ Deterministico di proposito: due esecuzioni dello stesso comando
// devono produrre lo stesso scenario, altrimenti «rifallo e riprova» non
// riproduce il caso che si stava guardando.
function seminato(seme) {
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
