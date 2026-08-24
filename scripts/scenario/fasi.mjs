// LE FASI DI PREPARAZIONE — su tutte le ricette, non solo su quelle in
// carta.
//
// 🔴 Nello scenario del 22/08 `recipe_steps` era **vuota**: 116 ricette e
// zero fasi. Quindi la scheda della ricetta — che è la schermata su cui un
// cuoco lavora davvero — mostrava ingredienti e basta, e il procedimento
// non c'era.
//
// ---------------------------------------------------------------------
// ⚠️ COSA QUESTE FASI SONO, E COSA NON SONO — dichiarato
// ---------------------------------------------------------------------
// Sono **vere per tipo di lavorazione**, non per singolo piatto: una salsa
// e un fondo passano davvero dalla stessa sequenza (mise en place, cottura
// lunga, abbattimento, conservazione), e un fritto espresso da un'altra. I
// tempi, le temperature e i punti critici sono quelli di una cucina che
// lavora — non numeri messi lì per fare volume.
//
// Quello che NON sono: il procedimento specifico di *quel* piatto scritto
// da chi lo cucina. Quello lo scriverà Alessio, ed è giusto così: una
// ricetta è sua.
//
// ⚠️ Il punto critico più importante c'è ed è reale: **l'abbattimento**
// (da +65 a +10 gradi entro due ore) è un CCP del piano HACCP, e senza una
// fase marcata come critica il manuale stampato non ha niente da mostrare
// in quella sezione.
// ---------------------------------------------------------------------

/**
 * Le sequenze, per famiglia di lavorazione.
 *
 * [fase, descrizione, tecnica, minuti, tempo attivo, °C, è CCP, limite HACCP, azione]
 *
 * 🔴 LA TECNICA È UN VOCABOLARIO CHIUSO DEL DATABASE, e questo blocco è
 * caduto proprio lì dopo trentadue minuti di costruzione: `cooking_technique`
 * ammette solo tradizionale, sottovuoto, CBT, abbattitore, bagnomaria,
 * frittura, griglia, forno, crudo, altro — e io ci avevo scritto «pesatura».
 *
 * ⚠️ Il vocabolario del PASSO (`step_phase`) l'avevo controllato; quello
 * della TECNICA no, perché la colonna sembrava testo libero. *Un vocabolario
 * chiuso non si riconosce dal nome della colonna*: si chiede al database,
 * ogni volta, per ogni colonna che si scrive.
 */
const SEQUENZE = {
  // Salse, fondi, ragù: cottura lunga e abbattimento.
  base_cotta: [
    ["mise_en_place", "Pesare gli ingredienti e preparare il taglio (mirepoix fine)", "tradizionale", 15, true, null, false, null, null],
    ["cottura", "Rosolare a fuoco medio senza far colorire troppo", "tradizionale", 12, true, 140, false, null, null],
    ["cottura", "Aggiungere il liquido e cuocere a fuoco basso, coperto", "tradizionale", 90, false, 95, false, null, null],
    ["finitura", "Regolare di sale e consistenza, togliere gli aromi interi", "tradizionale", 8, true, null, false, null, null],
    ["finitura", "Abbattere e conservare in contenitori etichettati con data e lotto", "abbattitore", 120, false, 10, true,
     "Da +65 a +10 gradi al cuore entro 2 ore", "Se non rientra nel limite: buttare e registrare la non conformita'"],
  ],
  // Basi crude: marinate, insalate, tartare.
  base_cruda: [
    ["mise_en_place", "Lavare, mondare e asciugare gli ingredienti", "tradizionale", 12, true, null, false, null, null],
    ["mise_en_place", "Tagliare al coltello e condire", "tradizionale", 10, true, null, false, null, null],
    ["finitura", "Conservare coperto in cella, consumo entro 24 ore", "tradizionale", 5, true, 4, true,
     "Temperatura di conservazione fra 0 e 4 gradi", "Se la cella e' fuori range: spostare la merce e registrare"],
  ],
  // Impasti e paste fresche.
  impasto: [
    ["mise_en_place", "Setacciare le farine e pesare i liquidi", "tradizionale", 10, true, null, false, null, null],
    ["cottura", "Impastare fino a incordatura, poi far riposare coperto", "tradizionale", 25, false, 18, false, null, null],
    ["finitura", "Stendere, formare e sistemare su teglie infarinate", "tradizionale", 30, true, null, false, null, null],
    ["finitura", "Conservare in cella o abbattere se non si usa in giornata", "tradizionale", 10, true, 4, false, null, null],
  ],
  // Il pesce e i crostacei: la catena del freddo è tutto.
  pesce: [
    ["mise_en_place", "Controllare la freschezza e la temperatura di arrivo", "tradizionale", 8, true, 2, true,
     "Pesce ricevuto sotto i +2 gradi, ghiaccio presente", "Respingere la merce e registrare la non conformita'"],
    ["mise_en_place", "Eviscerare, sfilettare e spinare", "crudo", 20, true, null, false, null, null],
    ["cottura", "Abbattere a -20 gradi per 24 ore se destinato al crudo", "abbattitore", 1440, false, -20, true,
     "Almeno 24 ore a -20 gradi al cuore (bonifica anisakis)", "Se il ciclo si interrompe: non servire crudo, destinare a cottura"],
    ["finitura", "Porzionare e conservare in cella pesce, coperto", "tradizionale", 15, true, 1, false, null, null],
  ],
  // I finger: composizione a freddo e conservazione breve.
  finger: [
    ["mise_en_place", "Preparare le basi e portarle a temperatura di lavorazione", "tradizionale", 15, true, null, false, null, null],
    ["impiattamento", "Comporre i pezzi uno per uno, uguali fra loro", "crudo", 25, true, null, false, null, null],
    ["finitura", "Sistemare in vassoi coperti in cella, uso entro il servizio", "tradizionale", 5, true, 4, false, null, null],
  ],
  // Il piatto che esce dalla cucina: espresso.
  espresso: [
    ["mise_en_place", "Preparare la postazione con le basi gia' pronte", "tradizionale", 10, true, null, false, null, null],
    ["cottura", "Cuocere all'ordine, controllando la temperatura al cuore", "tradizionale", 12, true, 75, true,
     "Almeno 75 gradi al cuore per le cotture complete", "Prolungare la cottura e ricontrollare prima di uscire"],
    ["impiattamento", "Impiattare caldo e mandare subito in sala", "tradizionale", 3, true, null, false, null, null],
  ],
  // Il dolce: si prepara prima, si finisce al momento.
  dolce: [
    ["mise_en_place", "Preparare creme e basi, raffreddare", "tradizionale", 30, true, 4, false, null, null],
    ["finitura", "Assemblare e conservare in cella fino al servizio", "crudo", 20, true, 4, false, null, null],
    ["impiattamento", "Finire con decorazione e polveri al momento dell'ordine", "tradizionale", 4, true, null, false, null, null],
  ],
};

/**
 * Quale sequenza tocca a questa ricetta.
 *
 * ⚠️ Si decide dal TIPO e dalla categoria, non dal nome: un nome si puo'
 * cambiare, e una ricetta rinominata perderebbe il suo procedimento.
 */
export function sequenzaPer(ricetta, ingredientiDiPesce) {
  const { recipe_type: tipo, category: categoria, name: nome } = ricetta;
  if (ingredientiDiPesce) return "pesce";
  if (tipo === "finger") return "finger";
  if (categoria === "dolce") return "dolce";
  if (tipo === "preparazione") {
    if (/impasto|frolla|pasta|busiate|pane|semola/i.test(nome)) return "impasto";
    if (/marinata|insalata|tartare|crema|gelo|composta/i.test(nome)) return "base_cruda";
    return "base_cotta";
  }
  return "espresso";
}

export async function costruisciFasi(ctx) {
  const { segna, supabase, addRecipeStep, nomiDelloScenario } = ctx;

  const { data: ricette } = await supabase
    .from("recipes")
    .select("id, name, recipe_type, category")
    .in("name", nomiDelloScenario);
  if (!ricette?.length) {
    segna("fasi di preparazione: nessuna ricetta trovata", 0);
    return;
  }

  // Quali ricette hanno dentro del pesce: a loro tocca la sequenza con la
  // bonifica e il controllo all'arrivo. Si chiede al database invece di
  // indovinarlo dal nome.
  const { data: conPesce } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredients!inner(category)")
    .in("ingredients.category", ["pesce", "crostacei_molluschi"]);
  const pesce = new Set((conPesce ?? []).map((r) => r.recipe_id));

  let fasi = 0;
  let conCcp = 0;
  for (const r of ricette) {
    const sequenza = SEQUENZE[sequenzaPer(r, pesce.has(r.id))] ?? SEQUENZE.espresso;
    let n = 1;
    for (const [fase, descrizione, tecnica, minuti, attivo, gradi, ccp, limite, azione] of sequenza) {
      await addRecipeStep(r.id, {
        step_number: n++,
        phase: fase,
        description: descrizione,
        technique: tecnica,
        duration_min: minuti,
        is_active_time: attivo,
        temperature_c: gradi,
        is_haccp_ccp: ccp,
        haccp_limit: limite,
        haccp_action: azione,
      });
      fasi += 1;
      if (ccp) conCcp += 1;
    }
  }
  segna(`fasi di preparazione su ${ricette.length} ricette (${conCcp} sono punti critici HACCP)`, fasi);
}
