// =====================================================================
// LA CARTA DELLO SCENARIO DI COLLAUDO — su scala vera
// =====================================================================
// 🔴 REPERTO DI ALESSIO (22/08): lo scenario aveva **14 ingredienti**, e il
// suo ristorante ne avrà **un centinaio**. Con quattordici prodotti non si
// prova niente di quello che conta — la ricerca, i filtri, l'ordinamento,
// una lista della spesa lunga, il magazzino dove devi trovare una cosa fra
// cento.
//
// ⚠️ LA SCALA NON È STATA SCELTA: È STATA MISURATA. Sul tablet vero (768
// punti, `--pxcm` a 74) una riga di elenco è alta **70,3 px** e sotto
// l'intestazione ci sono **797 px**: entrano **11 righe** senza scorrere.
//   · con 15 ingredienti la pagina è **1,3 schermate** — si vede quasi
//     tutto, e la casella di ricerca non serve mai;
//   · con ~100 diventa **7,1 schermate**, e cercare diventa il gesto
//     normale.
// **11 è la soglia in cui una schermata cambia mestiere.** A 15 si è appena
// sopra: sembra di provare lo scorrimento, e non si prova niente.
//
// 🔴 E I NOMI NON PORTANO PIÙ IL PREFISSO. Misurato sulla stessa schermata:
// la colonna del nome ha **114 px utili ≈ 16 caratteri**, e `BASE-` ne
// mangia **5, cioè il 31%**. Col prefisso andavano a capo **13 nomi su 15**,
// senza ne vanno **8**. Il 21/08 un disegno è stato scartato per un vincolo
// gonfiato da quel prefisso: *un marchio di servizio che finisce sotto gli
// occhi non sporca i dati, sporca le misure.*
//
// ⚠️ ALLORA COME SI RIPULISCE? **Da questo elenco.** I nomi non hanno un
// marchio: la pulizia legge le liste che stanno qui e cancella *quei* nomi.
// Costruzione e pulizia guardano lo stesso file, quindi non possono
// divergere — che è la stessa ragione per cui la stringa del `select` delle
// fatture vive in un posto solo.
//
// ⚠️ **Dove il marchio resta**: conti, movimenti, prenotazioni e fatture non
// hanno un nome che finisca in una misura di larghezza, e la loro `note`
// continua a portare la marca. Lì non costa niente e serve.
// =====================================================================

/** Il marchio per le righe SENZA nome (conti, movimenti, prenotazioni). */
export const MARCA_NOTE = "BASE-";

// ---------------------------------------------------------------------
// LE MATERIE PRIME
//
// [nome, categoria, unità, prezzo, scorta minima, giacenza iniziale, conservazione]
//
// ⚠️ Nomi di lunghezza VARIA e plausibili, perché nomi tutti uguali non
// distinguono — come i numeri tutti tondi. Si va da «Sale» (4) a «Pomodoro
// secco di Pachino sott'olio» (34): sotto i 16 caratteri stanno su una
// riga, sopra vanno a capo, ed è giusto che lo scenario contenga
// **entrambi i casi**.
//
// ⚠️ E QUINDICI HANNO GIACENZA ZERO, apposta: un magazzino dove c'e' tutto
// non fa vedere niente. Sono i prodotti che in una cucina si esauriscono
// davvero — i cari usati di rado e i deperibili — e sono la ragione per cui
// la lista della spesa ha qualcosa dentro e qualcosa fuori.
//
// ⚠️ E i prezzi NON sono tondi: un food cost fatto di numeri tondi torna
// sempre bello, e non mostra mai un arrotondamento sbagliato.
// ---------------------------------------------------------------------
export const MATERIE_PRIME = [
  // — verdura
  ["Melanzana lunga", "verdura", "kg", 1.95, 8, 14, "frigo_4_8"],
  ["Pomodoro ciliegino", "verdura", "kg", 4.8, 6, 9, "frigo_4_8"],
  ["Pomodoro da salsa", "verdura", "kg", 2.35, 10, 18, "frigo_4_8"],
  ["Zucchina siciliana", "verdura", "kg", 2.1, 5, 7, "frigo_4_8"],
  ["Cipolla di Giarratana", "verdura", "kg", 2.65, 6, 11, "dispensa"],
  ["Cipollotto fresco", "verdura", "mazzo", 1.4, 4, 6, "frigo_4_8"],
  ["Sedano verde", "verdura", "kg", 1.75, 3, 4, "frigo_4_8"],
  ["Carota", "verdura", "kg", 1.25, 5, 8, "frigo_4_8"],
  ["Finocchio", "verdura", "kg", 2.4, 4, 5, "frigo_4_8"],
  ["Peperone rosso corno", "verdura", "kg", 3.2, 4, 6, "frigo_4_8"],
  ["Patata novella", "verdura", "kg", 1.55, 10, 16, "dispensa"],
  ["Aglio rosso di Nubia", "verdura", "kg", 8.9, 1, 2, "dispensa"],
  ["Cavolfiore violetto", "verdura", "kg", 2.8, 3, 4, "frigo_4_8"],
  ["Bietola da coste", "verdura", "kg", 2.2, 3, 4, "frigo_4_8"],
  ["Tenerumi", "verdura", "mazzo", 1.6, 4, 5, "frigo_4_8"],
  ["Zucca rossa", "verdura", "kg", 1.85, 4, 7, "dispensa"],
  ["Radicchio tardivo", "verdura", "kg", 4.6, 2, 3, "frigo_4_8"],
  ["Asparago selvatico", "verdura", "mazzo", 3.9, 2, 0, "frigo_4_8"],
  ["Carciofo spinoso", "verdura", "pz", 1.15, 12, 20, "frigo_4_8"],
  ["Fungo cardoncello", "verdura", "kg", 7.4, 2, 0, "frigo_4_8"],

  // — frutta
  ["Limone di Siracusa", "frutta", "kg", 2.45, 6, 10, "frigo_4_8"],
  ["Arancia tarocco", "frutta", "kg", 1.9, 8, 12, "frigo_4_8"],
  ["Mandarino tardivo", "frutta", "kg", 2.3, 4, 6, "frigo_4_8"],
  ["Fico d'India", "frutta", "kg", 3.1, 3, 4, "frigo_4_8"],
  ["Uva zibibbo", "frutta", "kg", 4.25, 2, 3, "frigo_4_8"],
  ["Melone cantalupo", "frutta", "pz", 2.75, 3, 5, "frigo_4_8"],
  ["Fragola di Maletto", "frutta", "kg", 6.8, 2, 0, "frigo_0_4"],
  ["Gelso nero", "frutta", "kg", 12.5, 1, 0, "frigo_0_4"],
  ["Pesca tabacchiera", "frutta", "kg", 4.4, 2, 3, "frigo_4_8"],

  // — carne
  ["Maialino nero dei Nebrodi", "carne_rossa", "kg", 18.5, 4, 8, "frigo_0_4"],
  ["Manzo modicano", "carne_rossa", "kg", 22.4, 3, 5, "frigo_0_4"],
  ["Agnello", "carne_rossa", "kg", 16.9, 2, 4, "frigo_0_4"],
  ["Guanciale", "carne_rossa", "kg", 14.2, 2, 3, "frigo_0_4"],
  ["Pollo ruspante", "carne_bianca", "kg", 8.6, 3, 5, "frigo_0_4"],
  ["Coniglio", "carne_bianca", "kg", 11.4, 2, 3, "frigo_0_4"],

  // — pesce
  ["Tonno rosso", "pesce", "kg", 32.0, 3, 6, "frigo_0_4"],
  ["Alici fresche", "pesce", "kg", 4.2, 4, 7, "frigo_0_4"],
  ["Sarde", "pesce", "kg", 3.85, 4, 6, "frigo_0_4"],
  ["Ricciola", "pesce", "kg", 19.5, 2, 0, "frigo_0_4"],
  ["Spatola", "pesce", "kg", 9.8, 2, 3, "frigo_0_4"],
  ["Pesce spada", "pesce", "kg", 21.0, 2, 4, "frigo_0_4"],
  ["Baccala ammollato", "pesce", "kg", 13.6, 2, 3, "frigo_0_4"],
  ["Bottarga di tonno", "pesce", "kg", 89.0, 0.3, 0, "frigo_4_8"],

  // — crostacei e molluschi
  ["Gambero rosso di Mazara", "crostacei_molluschi", "kg", 24.0, 3, 5, "frigo_0_4"],
  ["Astice", "crostacei_molluschi", "kg", 45.0, 2, 0, "frigo_0_4"],
  ["Cozza nera", "crostacei_molluschi", "kg", 4.5, 4, 6, "frigo_0_4"],
  ["Vongola verace", "crostacei_molluschi", "kg", 12.8, 2, 3, "frigo_0_4"],
  ["Polpo", "crostacei_molluschi", "kg", 14.5, 2, 4, "frigo_0_4"],
  ["Seppia", "crostacei_molluschi", "kg", 11.2, 2, 3, "frigo_0_4"],
  ["Calamaro", "crostacei_molluschi", "kg", 13.4, 2, 3, "frigo_0_4"],

  // — latticini
  ["Ricotta di pecora", "latticini", "kg", 7.4, 4, 6, "frigo_0_4"],
  ["Ricotta salata", "latticini", "kg", 11.8, 2, 3, "frigo_4_8"],
  ["Pecorino siciliano DOP", "latticini", "kg", 16.5, 2, 3, "frigo_4_8"],
  ["Caciocavallo ragusano", "latticini", "kg", 15.2, 2, 3, "frigo_4_8"],
  ["Provola dei Nebrodi", "latticini", "kg", 13.9, 2, 3, "frigo_4_8"],
  ["Burro", "latticini", "kg", 9.3, 2, 4, "frigo_0_4"],
  ["Panna fresca", "latticini", "l", 4.6, 3, 5, "frigo_0_4"],
  ["Latte intero", "latticini", "l", 1.35, 6, 10, "frigo_0_4"],
  ["Mascarpone", "latticini", "kg", 8.1, 1, 0, "frigo_0_4"],

  // — uova
  ["Uova biologiche", "uova", "pz", 0.38, 60, 120, "frigo_4_8"],

  // — farine e cereali
  ["Farina di grano duro", "farine_cereali", "kg", 1.35, 10, 20, "dispensa"],
  ["Semola rimacinata", "farine_cereali", "kg", 1.45, 8, 15, "dispensa"],
  ["Farina di tumminia", "farine_cereali", "kg", 3.8, 3, 5, "dispensa"],
  ["Riso carnaroli", "farine_cereali", "kg", 3.2, 4, 7, "dispensa"],
  ["Cous cous di grano duro", "farine_cereali", "kg", 2.9, 3, 4, "dispensa"],
  ["Pangrattato", "farine_cereali", "kg", 1.8, 3, 5, "dispensa"],
  ["Amido di mais", "farine_cereali", "kg", 2.4, 1, 2, "dispensa"],

  // — legumi
  ["Fava larga di Leonforte", "legumi", "kg", 5.6, 3, 4, "dispensa"],
  ["Cece nero", "legumi", "kg", 6.2, 2, 3, "dispensa"],
  ["Lenticchia di Ustica", "legumi", "kg", 14.8, 1, 0, "dispensa"],
  ["Fagiolo cosaruciaru", "legumi", "kg", 12.4, 1, 0, "dispensa"],

  // — olio e condimenti
  ["Olio extravergine", "olio_condimenti", "l", 9.8, 6, 12, "dispensa"],
  ["Olio di semi di arachide", "olio_condimenti", "l", 3.4, 5, 9, "dispensa"],
  ["Aceto di vino bianco", "olio_condimenti", "l", 2.6, 2, 3, "dispensa"],
  ["Miele di zagara", "olio_condimenti", "kg", 13.5, 1, 2, "dispensa"],
  ["Capperi di Salina sotto sale", "olio_condimenti", "kg", 18.9, 1, 2, "dispensa"],
  ["Oliva nocellara", "olio_condimenti", "kg", 8.4, 2, 3, "frigo_4_8"],
  ["Pomodoro secco di Pachino sott'olio", "olio_condimenti", "kg", 16.2, 1, 2, "dispensa"],
  ["Colatura di alici", "olio_condimenti", "l", 34.0, 0.5, 0, "dispensa"],

  // — spezie e aromi
  ["Sale", "spezie_aromi", "kg", 0.65, 5, 10, "dispensa"],
  ["Sale marino di Trapani", "spezie_aromi", "kg", 2.15, 2, 4, "dispensa"],
  ["Pepe nero in grani", "spezie_aromi", "kg", 22.0, 0.5, 1, "dispensa"],
  ["Basilico", "spezie_aromi", "mazzo", 1.15, 6, 9, "frigo_4_8"],
  ["Prezzemolo", "spezie_aromi", "mazzo", 0.95, 6, 9, "frigo_4_8"],
  ["Menta fresca", "spezie_aromi", "mazzo", 1.25, 3, 5, "frigo_4_8"],
  ["Origano siciliano", "spezie_aromi", "kg", 26.0, 0.3, 0.5, "dispensa"],
  ["Finocchietto selvatico", "spezie_aromi", "mazzo", 1.85, 3, 4, "frigo_4_8"],
  ["Rosmarino", "spezie_aromi", "mazzo", 1.05, 2, 3, "frigo_4_8"],
  ["Alloro", "spezie_aromi", "kg", 19.0, 0.2, 0.4, "dispensa"],
  ["Zafferano in pistilli", "spezie_aromi", "kg", 2400.0, 0.005, 0, "dispensa"],
  ["Peperoncino secco", "spezie_aromi", "kg", 12.6, 0.5, 1, "dispensa"],
  ["Cannella in stecche", "spezie_aromi", "kg", 24.5, 0.2, 0.3, "dispensa"],

  // — secco e dispensa
  ["Pistacchio di Bronte", "secco_dispensa", "kg", 28.0, 1, 2, "dispensa"],
  ["Mandorla di Avola", "secco_dispensa", "kg", 15.4, 2, 3, "dispensa"],
  ["Nocciola dei Nebrodi", "secco_dispensa", "kg", 17.8, 1, 2, "dispensa"],
  ["Uvetta sultanina", "secco_dispensa", "kg", 5.9, 1, 2, "dispensa"],
  ["Pinolo", "secco_dispensa", "kg", 42.0, 0.5, 0, "dispensa"],
  ["Zucchero semolato", "secco_dispensa", "kg", 1.15, 6, 10, "dispensa"],
  ["Zucchero a velo", "secco_dispensa", "kg", 2.3, 1, 2, "dispensa"],
  ["Cioccolato di Modica", "secco_dispensa", "kg", 24.8, 1, 2, "dispensa"],
  ["Lievito di birra fresco", "secco_dispensa", "kg", 6.4, 0.5, 1, "frigo_0_4"],
  ["Gelatina in fogli", "secco_dispensa", "kg", 32.0, 0.2, 0, "dispensa"],

  // — bevande
  ["Vino bianco da cucina", "bevande", "l", 3.2, 4, 6, "dispensa"],
  ["Marsala secco", "bevande", "l", 7.9, 2, 3, "dispensa"],
  ["Passito di Pantelleria", "bevande", "l", 26.0, 1, 0, "dispensa"],

  // — non alimentari: ci sono perché la sorveglianza dei prezzi vale anche
  //   per lo sgrassante, e il Ricettario NON deve mostrarli.
  ["Detergente per superfici", "altro", "l", 4.35, 3, 6, "temperatura_ambiente"],
  ["Sgrassatore per cucina", "altro", "l", 5.8, 2, 4, "temperatura_ambiente"],
  ["Sacchetti sottovuoto", "altro", "pz", 0.22, 100, 200, "temperatura_ambiente"],
  ["Carta forno", "altro", "pz", 0.09, 200, 400, "temperatura_ambiente"],
];

// ---------------------------------------------------------------------
// LE PREPARAZIONI
//
// [nome, resa, unità di resa, [[materia prima, quantità]]]
//
// ⚠️ Sono la ragione per cui un ricettario vero è profondo: Alessio
// **scompone sempre**, e un piatto composto ne usa due o tre. Senza, il
// costo di un piatto è una somma piatta di materie prime — cioè il caso in
// cui il calcolo a cascata non viene mai esercitato.
// ---------------------------------------------------------------------
export const PREPARAZIONI = [
  ["Soffritto di base", 1, "kg", [["Cipolla di Giarratana", 0.4], ["Carota", 0.3], ["Sedano verde", 0.3], ["Olio extravergine", 0.08]]],
  ["Salsa di pomodoro", 2, "kg", [["Pomodoro da salsa", 2.2], ["Soffritto di base", 0.15], ["Basilico", 0.5], ["Sale", 0.02]]],
  ["Ragu di maialino", 1.5, "kg", [["Maialino nero dei Nebrodi", 0.9], ["Soffritto di base", 0.2], ["Salsa di pomodoro", 0.6], ["Vino bianco da cucina", 0.15], ["Alloro", 0.002], ["Pepe nero in grani", 0.002]]],
  ["Pasta fresca all'uovo", 1, "kg", [["Semola rimacinata", 0.7], ["Uova biologiche", 7]]],
  ["Busiate trafilate", 1, "kg", [["Farina di grano duro", 0.75], ["Sale", 0.01]]],
  ["Pesto alla trapanese", 1, "kg", [["Mandorla di Avola", 0.2], ["Pomodoro ciliegino", 0.5], ["Basilico", 1.2], ["Aglio rosso di Nubia", 0.02], ["Olio extravergine", 0.2]]],
  ["Crema di pistacchio", 1, "kg", [["Pistacchio di Bronte", 0.65], ["Zucchero semolato", 0.2], ["Olio extravergine", 0.08]]],
  ["Ricotta setacciata", 1, "kg", [["Ricotta di pecora", 1.05], ["Zucchero a velo", 0.18], ["Latte intero", 0.05]]],
  ["Frolla per cannoli", 1, "kg", [["Farina di grano duro", 0.6], ["Zucchero semolato", 0.1], ["Burro", 0.12], ["Marsala secco", 0.08], ["Uova biologiche", 2], ["Cannella in stecche", 0.002]]],
  ["Caponata", 1.5, "kg", [["Melanzana lunga", 1.2], ["Sedano verde", 0.2], ["Cipolla di Giarratana", 0.15], ["Oliva nocellara", 0.1], ["Capperi di Salina sotto sale", 0.03], ["Aceto di vino bianco", 0.05], ["Zucchero semolato", 0.03]]],
  ["Fondo di pesce", 2, "l", [["Spatola", 0.6], ["Cipollotto fresco", 1], ["Prezzemolo", 1], ["Vino bianco da cucina", 0.2], ["Finocchietto selvatico", 0.4]]],
  ["Fondo bruno", 2, "l", [["Manzo modicano", 0.5], ["Soffritto di base", 0.25], ["Vino bianco da cucina", 0.2], ["Rosmarino", 0.3], ["Pepe nero in grani", 0.003]]],
  ["Maionese al limone", 1, "kg", [["Uova biologiche", 4], ["Olio di semi di arachide", 0.7], ["Limone di Siracusa", 0.12]]],
  ["Pane grattugiato aromatizzato", 1, "kg", [["Pangrattato", 0.8], ["Origano siciliano", 0.01], ["Pecorino siciliano DOP", 0.15], ["Prezzemolo", 0.5]]],
  ["Crema di fave", 1, "kg", [["Fava larga di Leonforte", 0.45], ["Olio extravergine", 0.1], ["Aglio rosso di Nubia", 0.01]]],
  ["Polpo lessato", 1, "kg", [["Polpo", 1.6], ["Alloro", 0.005], ["Peperoncino secco", 0.002]]],
  ["Melanzane fritte a fette", 1, "kg", [["Melanzana lunga", 1.5], ["Olio di semi di arachide", 0.25]]],
  ["Zeppoline di pasta cresciuta", 1, "kg", [["Farina di grano duro", 0.5], ["Lievito di birra fresco", 0.02], ["Olio di semi di arachide", 0.3]]],
  ["Gelo di limone", 1, "kg", [["Limone di Siracusa", 0.35], ["Zucchero semolato", 0.15], ["Amido di mais", 0.06], ["Gelatina in fogli", 0.004]]],
  ["Salsa al passito", 0.5, "l", [["Passito di Pantelleria", 0.4], ["Zucchero semolato", 0.05]]],
  ["Cous cous incocciato", 1.5, "kg", [["Cous cous di grano duro", 0.9], ["Olio extravergine", 0.05], ["Fondo di pesce", 0.6], ["Zafferano in pistilli", 0.0002]]],
  ["Panatura al pistacchio", 1, "kg", [["Pistacchio di Bronte", 0.5], ["Pangrattato", 0.45], ["Sale marino di Trapani", 0.01]]],
  ["Cipolla in agrodolce", 1, "kg", [["Cipolla di Giarratana", 1.1], ["Aceto di vino bianco", 0.08], ["Zucchero semolato", 0.06]]],
  ["Crema di ricotta salata", 1, "kg", [["Ricotta salata", 0.5], ["Panna fresca", 0.4]]],
  ["Brodo vegetale", 3, "l", [["Carota", 0.3], ["Sedano verde", 0.25], ["Cipolla di Giarratana", 0.3]]],
  ["Marinata per crudo", 0.5, "l", [["Olio extravergine", 0.3], ["Limone di Siracusa", 0.15], ["Sale marino di Trapani", 0.01]]],
  // — le preparazioni che tengono in casa il resto della dispensa: senza,
  //   quaranta materie prime non entrerebbero in nessuna ricetta, e un
  //   ristorante non compra quello che non usa.
  ["Verdure di stagione grigliate", 1, "kg", [["Zucchina siciliana", 0.5], ["Peperone rosso corno", 0.4], ["Melanzana lunga", 0.35], ["Olio extravergine", 0.06]]],
  ["Caponata di carciofi", 1, "kg", [["Carciofo spinoso", 10], ["Cipolla in agrodolce", 0.15], ["Menta fresca", 0.3]]],
  ["Vellutata di zucca", 2, "l", [["Zucca rossa", 1.4], ["Brodo vegetale", 0.8], ["Panna fresca", 0.15]]],
  ["Zuppa di legumi", 2, "l", [["Lenticchia di Ustica", 0.25], ["Fagiolo cosaruciaru", 0.25], ["Soffritto di base", 0.2], ["Brodo vegetale", 1.2]]],
  ["Fritto misto di mare", 1, "kg", [["Calamaro", 0.45], ["Seppia", 0.3], ["Gambero rosso di Mazara", 0.2], ["Semola rimacinata", 0.1], ["Olio di semi di arachide", 0.3]]],
  ["Saute di cozze", 1.5, "kg", [["Cozza nera", 1.8], ["Prezzemolo", 0.5], ["Peperoncino secco", 0.003], ["Vino bianco da cucina", 0.1]]],
  ["Baccala mantecato", 1, "kg", [["Baccala ammollato", 0.9], ["Olio extravergine", 0.15], ["Latte intero", 0.1]]],
  ["Coniglio in agrodolce", 1.5, "kg", [["Coniglio", 1.3], ["Cipolla in agrodolce", 0.2], ["Oliva nocellara", 0.08], ["Pinolo", 0.02]]],
  ["Ripieno di carne bianca", 1, "kg", [["Pollo ruspante", 0.6], ["Guanciale", 0.1], ["Pangrattato", 0.08], ["Uova biologiche", 2]]],
  ["Insalata di agrumi", 1, "kg", [["Arancia tarocco", 0.6], ["Mandarino tardivo", 0.3], ["Finocchio", 0.25], ["Oliva nocellara", 0.05]]],
  ["Composta di frutta estiva", 1, "kg", [["Pesca tabacchiera", 0.5], ["Fico d'India", 0.3], ["Melone cantalupo", 1], ["Zucchero semolato", 0.12]]],
  ["Crema al mascarpone", 1, "kg", [["Mascarpone", 0.6], ["Uova biologiche", 4], ["Zucchero a velo", 0.12]]],
  ["Pane di tumminia", 1.5, "kg", [["Farina di tumminia", 0.6], ["Semola rimacinata", 0.4], ["Lievito di birra fresco", 0.02], ["Sale", 0.02]]],
  ["Pesto di pomodoro secco", 1, "kg", [["Pomodoro secco di Pachino sott'olio", 0.6], ["Mandorla di Avola", 0.15], ["Nocciola dei Nebrodi", 0.1], ["Olio extravergine", 0.15]]],
  ["Salsa alla colatura", 0.5, "l", [["Colatura di alici", 0.12], ["Olio extravergine", 0.3], ["Aglio rosso di Nubia", 0.01]]],
];

// ---------------------------------------------------------------------
// I FINGER — venti, come li vuole lui
//
// [nome, categoria, prezzo al pezzo, componenti]
//
// ⚠️ Vanno a PREZZO AL PEZZO (`prezzo_al_pezzo`), che è la strada aperta il
// 20/08: un finger non si vende a porzione.
// ---------------------------------------------------------------------
export const FINGER = [
  ["Cannolo salato di ricotta", "antipasto", 3.5, [["Frolla per cannoli", 0.02], ["Crema di ricotta salata", 0.025]]],
  ["Arancinetta al ragu", "antipasto", 3.0, [["Riso carnaroli", 0.045], ["Ragu di maialino", 0.03], ["Pangrattato", 0.008]]],
  ["Panella croccante", "antipasto", 2.2, [["Cece nero", 0.03], ["Olio di semi di arachide", 0.01]]],
  ["Crocche di patata", "antipasto", 2.4, [["Patata novella", 0.05], ["Caciocavallo ragusano", 0.008], ["Pangrattato", 0.006]]],
  ["Zeppolina di alghe", "antipasto", 2.6, [["Zeppoline di pasta cresciuta", 0.035]]],
  ["Cucchiaio di caponata", "antipasto", 2.8, [["Caponata", 0.04], ["Menta fresca", 0.02]]],
  ["Tartare di gambero", "antipasto", 5.5, [["Gambero rosso di Mazara", 0.03], ["Marinata per crudo", 0.005]]],
  ["Bocconcino di tonno", "antipasto", 5.0, [["Tonno rosso", 0.028], ["Panatura al pistacchio", 0.008]]],
  ["Sarda a beccafico", "antipasto", 3.2, [["Sarde", 0.035], ["Pane grattugiato aromatizzato", 0.01], ["Uvetta sultanina", 0.003]]],
  ["Polpetta di melanzana", "antipasto", 2.5, [["Melanzane fritte a fette", 0.04], ["Pecorino siciliano DOP", 0.006]]],
  ["Cubo di parmigiana", "antipasto", 3.0, [["Melanzane fritte a fette", 0.045], ["Salsa di pomodoro", 0.02], ["Provola dei Nebrodi", 0.01]]],
  ["Crostino di fave", "antipasto", 2.3, [["Crema di fave", 0.03], ["Olio extravergine", 0.004]]],
  ["Polpo e patate in bicchiere", "antipasto", 4.8, [["Polpo lessato", 0.035], ["Patata novella", 0.03], ["Prezzemolo", 0.02]]],
  ["Involtino di spatola", "antipasto", 4.2, [["Spatola", 0.04], ["Pane grattugiato aromatizzato", 0.01]]],
  ["Sfoglia di caciocavallo", "antipasto", 3.4, [["Caciocavallo ragusano", 0.02], ["Miele di zagara", 0.004]]],
  ["Cous cous di pesce in tazza", "antipasto", 4.5, [["Cous cous incocciato", 0.05], ["Gambero rosso di Mazara", 0.015]]],
  ["Bicchierino di gelo", "dolce", 2.6, [["Gelo di limone", 0.05]]],
  ["Mini cannolo dolce", "dolce", 3.2, [["Frolla per cannoli", 0.018], ["Ricotta setacciata", 0.03], ["Pistacchio di Bronte", 0.003]]],
  ["Cioccolatino di Modica", "dolce", 2.4, [["Cioccolato di Modica", 0.02]]],
  ["Bigne al pistacchio", "dolce", 3.0, [["Crema di pistacchio", 0.025], ["Uova biologiche", 0.5], ["Burro", 0.008]]],
  ["Cucchiaio di baccala", "antipasto", 3.6, [["Baccala mantecato", 0.03], ["Pane di tumminia", 0.015]]],
  ["Cozza gratinata", "antipasto", 3.4, [["Saute di cozze", 0.04], ["Pane grattugiato aromatizzato", 0.008]]],
  ["Verdurina grigliata", "antipasto", 2.4, [["Verdure di stagione grigliate", 0.045], ["Salsa alla colatura", 0.004]]],
  ["Bicchierino di zucca", "antipasto", 2.8, [["Vellutata di zucca", 0.05], ["Nocciola dei Nebrodi", 0.004]]],
];

// ---------------------------------------------------------------------
// I PIATTI DELLA CARTA — tredici
//
// [nome, categoria, prezzo, componenti]
// ---------------------------------------------------------------------
export const PIATTI = [
  ["Caponata con ricotta salata", "antipasto", 10, [["Caponata", 0.18], ["Ricotta salata", 0.02]]],
  ["Crudo di gambero rosso di Mazara", "antipasto", 22, [["Gambero rosso di Mazara", 0.16], ["Marinata per crudo", 0.02]]],
  ["Alici marinate al limone", "antipasto", 11, [["Alici fresche", 0.14], ["Limone di Siracusa", 0.04], ["Olio extravergine", 0.02]]],
  ["Busiate al pesto alla trapanese", "primo", 14, [["Busiate trafilate", 0.12], ["Pesto alla trapanese", 0.07]]],
  ["Ravioli di ricotta al burro e menta", "primo", 16, [["Pasta fresca all'uovo", 0.13], ["Ricotta setacciata", 0.08], ["Burro", 0.02], ["Menta fresca", 0.05]]],
  ["Spaghetti all'astice", "primo", 30, [["Farina di grano duro", 0.11], ["Astice", 0.24], ["Salsa di pomodoro", 0.06]]],
  ["Risotto ai tenerumi e vongole", "primo", 19, [["Riso carnaroli", 0.09], ["Vongola verace", 0.12], ["Tenerumi", 0.4], ["Brodo vegetale", 0.25]]],
  ["Tonno in crosta di pistacchio", "secondo", 26, [["Tonno rosso", 0.19], ["Panatura al pistacchio", 0.03], ["Cipolla in agrodolce", 0.04]]],
  ["Maialino nero con salsa al passito", "secondo", 23, [["Maialino nero dei Nebrodi", 0.26], ["Salsa al passito", 0.03], ["Patata novella", 0.12]]],
  ["Polpo arrosto su crema di fave", "secondo", 21, [["Polpo lessato", 0.16], ["Crema di fave", 0.08]]],
  ["Parmigiana di melanzane", "secondo", 15, [["Melanzane fritte a fette", 0.22], ["Salsa di pomodoro", 0.1], ["Provola dei Nebrodi", 0.04]]],
  ["Cannolo scomposto", "dolce", 9, [["Ricotta setacciata", 0.09], ["Frolla per cannoli", 0.03], ["Pistacchio di Bronte", 0.008]]],
  ["Gelo di limone e gelso", "dolce", 8, [["Gelo di limone", 0.12], ["Gelso nero", 0.03]]],
  ["Insalata di arance e finocchi", "antipasto", 9, [["Insalata di agrumi", 0.2], ["Olio extravergine", 0.015]]],
  ["Zuppa di legumi di Ustica", "primo", 13, [["Zuppa di legumi", 0.35], ["Pane di tumminia", 0.06]]],
  ["Fritto misto del golfo", "secondo", 24, [["Fritto misto di mare", 0.2], ["Limone di Siracusa", 0.05]]],
  ["Ricciola scottata con agrumi", "secondo", 25, [["Ricciola", 0.2], ["Insalata di agrumi", 0.08]]],
  ["Spada alla ghiotta", "secondo", 22, [["Pesce spada", 0.22], ["Salsa di pomodoro", 0.08], ["Capperi di Salina sotto sale", 0.008]]],
  ["Coniglio all'agrodolce", "secondo", 19, [["Coniglio in agrodolce", 0.24], ["Patata novella", 0.1]]],
  ["Cannelloni di carne bianca", "primo", 16, [["Pasta fresca all'uovo", 0.12], ["Ripieno di carne bianca", 0.1], ["Salsa di pomodoro", 0.07]]],
  ["Agnello con carciofi", "secondo", 24, [["Agnello", 0.28], ["Caponata di carciofi", 0.09]]],
  ["Risotto al radicchio e bottarga", "primo", 20, [["Riso carnaroli", 0.09], ["Radicchio tardivo", 0.07], ["Bottarga di tonno", 0.008], ["Brodo vegetale", 0.25]]],
  ["Tiramisu al passito", "dolce", 9, [["Crema al mascarpone", 0.11], ["Frolla per cannoli", 0.02], ["Passito di Pantelleria", 0.02]]],
  ["Frutta di stagione", "dolce", 7, [["Composta di frutta estiva", 0.14], ["Menta fresca", 0.03]]],
  ["Insalata di funghi e asparagi", "antipasto", 12, [["Fungo cardoncello", 0.12], ["Asparago selvatico", 0.4], ["Olio extravergine", 0.015]]],
  ["Bietole e patate all'aglio", "antipasto", 8, [["Bietola da coste", 0.2], ["Patata novella", 0.12], ["Aglio rosso di Nubia", 0.004]]],
  ["Cavolfiore in pastella", "antipasto", 9, [["Cavolfiore violetto", 0.2], ["Semola rimacinata", 0.05], ["Olio di semi di arachide", 0.08]]],
  ["Gelato di fragole e zibibbo", "dolce", 8, [["Fragola di Maletto", 0.1], ["Uva zibibbo", 0.05], ["Latte intero", 0.08], ["Zucchero semolato", 0.03]]],
];

/**
 * Tutti i nomi che lo scenario crea: è **da qui** che la pulizia sa cosa
 * togliere, dato che i nomi non portano più un prefisso.
 *
 * ⚠️ Un posto solo: costruzione e pulizia leggono la stessa lista, quindi
 * non possono divergere. Se un giorno divergessero, la pulizia lascerebbe
 * righe dietro di sé **senza dirlo** — la famiglia della risposta più corta
 * che ha l'aria di essere intera.
 */
export const NOMI_INGREDIENTI = MATERIE_PRIME.map((r) => r[0]);
export const NOMI_RICETTE = [
  ...PREPARAZIONI.map((r) => r[0]),
  ...FINGER.map((r) => r[0]),
  ...PIATTI.map((r) => r[0]),
];

// ---------------------------------------------------------------------
// CHE COSA STA IN CARTA ADESSO
//
// 🔴 NON TUTTO IL RICETTARIO E' IN CARTA, ed e' il secondo reperto: nello
// scenario vecchio **tutte e 35 le ricette erano «pronte per carta»**, che
// non somiglia a nessun ricettario vero. In una cucina ci sono le bozze, i
// fuori carta, i piatti delle stagioni passate e quelli che si preparano
// per gli eventi.
//
// ⚠️ La carta attiva resta quella che ha descritto Alessio — **20 finger e
// 13 piatti** — e il resto del ricettario (che serve a far esistere le
// cento materie prime) vive intorno: alcune pronte e non in carta, altre
// ancora bozze.
//
// ⚠️ Ed e' anche il modo in cui il riflesso `in_carta` viene finalmente
// esercitato su dati veri: con tutto in carta, quel calcolo non ha mai
// avuto niente da distinguere.
// ---------------------------------------------------------------------
export const FINGER_IN_CARTA = FINGER.slice(0, 20).map((r) => r[0]);
export const PIATTI_IN_CARTA = PIATTI.slice(0, 13).map((r) => r[0]);


// ---------------------------------------------------------------------
// LE SELEZIONI — come i finger arrivano davvero in carta
//
// 🔴 SCOPERTO COSTRUENDO, dal rifiuto del database: *«In un menu ci vanno
// solo i piatti: "Cannolo salato di ricotta" e' un bocconcino. Se vuoi
// venderlo da solo, creane una ricetta a se'.»*
//
// ⚠️ E il database ha ragione — e' la decisione del 20/08. Un finger e' un
// **bocconcino**, non una portata: quello che si vende e' una **selezione**
// (un piatto finito che ha i bocconcini come componenti). Mettere i venti
// finger direttamente in carta avrebbe costruito uno scenario che il
// gestionale non ammette, cioe' un collaudo su un modello inventato.
//
// [nome, categoria, prezzo, [bocconcini che la compongono]]
// ---------------------------------------------------------------------
export const SELEZIONI = [
  ["Selezione di mare", "antipasto", 18, ["Tartare di gambero", "Bocconcino di tonno", "Sarda a beccafico", "Polpo e patate in bicchiere", "Involtino di spatola", "Cucchiaio di baccala"]],
  ["Selezione di terra", "antipasto", 15, ["Arancinetta al ragu", "Crocche di patata", "Polpetta di melanzana", "Cubo di parmigiana", "Sfoglia di caciocavallo", "Crostino di fave"]],
  ["Selezione da strada", "antipasto", 13, ["Panella croccante", "Zeppolina di alghe", "Cucchiaio di caponata", "Cannolo salato di ricotta", "Verdurina grigliata", "Cozza gratinata"]],
  ["Selezione dolce", "dolce", 12, ["Bicchierino di gelo", "Mini cannolo dolce", "Cioccolatino di Modica", "Bigne al pistacchio"]],
];

/** I bocconcini che entrano in una selezione: pronti, ma mai in carta da soli. */
export const FINGER_COMPOSTI = [...new Set(SELEZIONI.flatMap((s) => s[3]))];

/**
 * Le ricette che restano BOZZE: non pronte per la carta.
 *
 * ⚠️ Una su cinque, presa in modo deterministico, e **mai** fra quelle che
 * finiscono in carta ne' fra i bocconcini di una selezione: il database
 * rifiuta di mettere in un menu attivo un piatto non pronto, ed e' il
 * vincolo giusto — non un ostacolo da aggirare.
 *
 * ⚠️ Sta in fondo al file perche' deve conoscere anche le selezioni: messa
 * in cima, avrebbe potuto marcare come bozza un bocconcino che una
 * selezione in carta usa, e lo scenario sarebbe fallito a meta'.
 */
export const BOZZE = [
  ...PREPARAZIONI.map((r) => r[0]),
  ...FINGER.map((r) => r[0]),
  ...PIATTI.map((r) => r[0]),
]
  .filter((n, i) => i % 5 === 4)
  .filter(
    (n) =>
      !PIATTI_IN_CARTA.includes(n) &&
      !FINGER_COMPOSTI.includes(n) &&
      !SELEZIONI.some((s) => s[0] === n)
  );

/** Tutti i nomi di ricetta, selezioni comprese. */
export const NOMI_RICETTE_TUTTE = [...NOMI_RICETTE, ...SELEZIONI.map((s) => s[0])];
