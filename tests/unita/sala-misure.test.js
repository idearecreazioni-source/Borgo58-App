import { describe, expect, it } from "vitest";
import {
  BERSAGLIO_PROVATO_CM,
  SALA_LARGHEZZA_CM,
  SALA_PROFONDITA_CM,
  bersaglioTavoloCm,
  sagomeFuoriDalDisegno,
  sagomeTagliateDallaVista,
  CONTATTO_MINIMO_CM,
  TOCCO_TAVOLO_CM,
  marginePiantaInPiedi,
  areaVietataAiMobili,
  dentroAreaVietata,
  SPOSTATE_NEL_DISEGNO,
  sagomaPerIlDisegno,
  VARCO_MINIMO_MM,
  ZONE_FONDALE,
  GRIGLIA_CM,
  INGRANDIMENTO_MM,
  ingrandimentoCm,
  sagomaDisegnata,
  TOLLERANZA_CONTATTO_CM,
  pannelloNellaPianta,
  riquadroDelPannello,
  sagomeFuoriGriglia,
  tolleranzaCoerenteCollaGriglia,
} from "../../src/lib/calcoli/sala";

// Le tre misure con cui si decide che due tavoli sono accostati devono
// **accordarsi fra loro**. Fino al 18/08/2026 stavano in due file che non
// si nominavano — il passo della griglia nella pianta, la tolleranza dentro
// una funzione del database — ed è la forma in cui un giorno qualcuno ne
// cambia uno solo.

describe("Le misure dell'accostamento", () => {
  it("la tolleranza sta strettamente sotto il passo della griglia", () => {
    // Se fosse ≥ del passo, due tavoli distanti un passo intero
    // risulterebbero accostati e la sala direbbe meno coperti di quelli
    // che ha — sul numero con cui si accettano le prenotazioni.
    expect(tolleranzaCoerenteCollaGriglia()).toBe(true);
    expect(TOLLERANZA_CONTATTO_CM).toBeLessThan(GRIGLIA_CM);
    expect(TOLLERANZA_CONTATTO_CM).toBeGreaterThanOrEqual(0);
  });

  it("e il controllo si accorge davvero quando il rapporto si rompe", () => {
    // ⚠️ La prova al contrario: senza questa, `tolleranzaCoerente...`
    // potrebbe restituire `true` sempre e la prova sopra passerebbe.
    expect(tolleranzaCoerenteCollaGriglia(10, 10)).toBe(false);
    expect(tolleranzaCoerenteCollaGriglia(11, 10)).toBe(false);
    expect(tolleranzaCoerenteCollaGriglia(9, 10)).toBe(true);
  });

  it("una misura non multipla del passo viene riconosciuta", () => {
    // È l'ipotesi che rende la tolleranza equivalente al contatto esatto.
    expect(sagomeFuoriGriglia([{ label: "T1", larghezza_cm: 90, profondita_cm: 90 }])).toEqual([]);
    expect(
      sagomeFuoriGriglia([{ label: "Strano", larghezza_cm: 95, profondita_cm: 90 }])
    ).toEqual(["Strano (95×90)"]);
  });

  it("il contatto minimo è una soglia scritta, e vale meno del tavolo più piccolo", () => {
    // Non è geometria misurata: è la soglia sotto la quale due tavoli che
    // si toccano non fanno un piano su cui apparecchiare. Se fosse ≥ del
    // lato più corto (90 cm), nessun accostamento verrebbe mai contato.
    expect(CONTATTO_MINIMO_CM).toBeGreaterThan(0);
    expect(CONTATTO_MINIMO_CM).toBeLessThan(90);
  });
});

// =====================================================================
// IL GIRO E — il disegno che entra nello schermo e il magnete
// =====================================================================

import {
  AGGANCIO_DITO_CM,
  RIDUZIONE_DISEGNO,
  agganciaAiVicini,
  raggioMagneteCm,
  misureSagoma,
  raggioAggancioCm,
} from "../../src/lib/calcoli/sala";

const SALA = { larghezza: 2070, profondita: 1030 };
const Q = "formato-quadrato";
const L = "formato-lungo";
// Un quadrato da 90 e il suo vicino appoggiato a destra, staccato di 20 cm.
const quadrato = (id, formato = Q) => ({ id, formato_id: formato, larghezza: 90, profondita: 90 });
const vicino = (id, x, y, formato = Q) => ({
  id,
  formato_id: formato,
  x,
  y,
  larghezza: 90,
  profondita: 90,
});

describe("Il verso della sagoma", () => {
  it("un tavolo girato ingombra al contrario", () => {
    // ⚠️ È il difetto vero trovato il 18/08: il conteggio scambiava, il
    // disegno no — e T1 e T2 della sala di Alessio sono girati.
    expect(misureSagoma({ larghezza_cm: 180, profondita_cm: 90, ruotato: true })).toEqual({
      larghezza: 90,
      profondita: 180,
    });
  });

  it("e uno diritto no", () => {
    expect(misureSagoma({ larghezza_cm: 180, profondita_cm: 90, ruotato: false })).toEqual({
      larghezza: 180,
      profondita: 90,
    });
  });
});

describe("Il raggio del magnete", () => {
  it("è lo stesso DITO anche quando la pianta si rimpicciolisce", () => {
    // ⚠️ La prova che vale: se il raggio fosse scritto in centimetri di
    // sala, rimpicciolendo il disegno il magnete si accorcerebbe sotto le
    // dita. Qui il disegno più piccolo (più centimetri di sala per punto)
    // deve dare un raggio in sala PIÙ GRANDE, cioè lo stesso dito.
    const grande = raggioAggancioCm(2.0, 37.79528);
    const piccolo = raggioAggancioCm(2.88, 37.79528);
    expect(piccolo).toBeGreaterThan(grande);
    // E il rapporto è esattamente quello delle due scale: nessun
    // arrotondamento nascosto.
    expect(piccolo / grande).toBeCloseTo(2.88 / 2.0, 6);
  });

  it("vale un quinto di un bersaglio di tocco", () => {
    expect(AGGANCIO_DITO_CM).toBeGreaterThan(0);
    expect(AGGANCIO_DITO_CM).toBeLessThan(1.05);
  });

  it("senza una scala non inventa un raggio", () => {
    expect(raggioAggancioCm(0, 37.8)).toBe(0);
    expect(raggioAggancioCm(2, 0)).toBe(0);
  });
});

describe("Il magnete", () => {
  const raggio = 22; // ≈ quello che il dito produce sul telefono

  it("porta i due bordi a distanza ZERO, non «vicino»", () => {
    // ⚠️ La condizione che lega il magnete al conteggio: il database conta
    // accostati due tavoli entro TOLLERANZA_CONTATTO_CM. Zero ci sta
    // dentro per costruzione, e questa prova lo verifica contro la
    // costante vera, non contro un numero ricopiato.
    const r = agganciaAiVicini({
      sagoma: quadrato("a"),
      vicini: [vicino("b", 1000, 500)],
      x: 1075,
      y: 510,
      raggioCm: raggio,
      limiti: SALA,
    });
    expect(r.x).toBe(1090);
    // ⚠️ E il bordo si PAREGGIA: lasciare uno scalino di 10 cm
    // disegnerebbe un tavolone che non sembra un tavolone.
    expect(r.y).toBe(500);
    expect(Math.abs(r.x - (1000 + 90))).toBeLessThanOrEqual(TOLLERANZA_CONTATTO_CM);
    expect(r.agganci).toEqual(["b"]);
  });

  it("non aggancia fra formati diversi — e la prova al contrario lo dimostra", () => {
    const posizione = { x: 1075, y: 500, raggioCm: raggio, limiti: SALA };
    // Stesso identico gesto: col formato diverso non deve succedere niente…
    const diverso = agganciaAiVicini({
      sagoma: quadrato("a", Q),
      vicini: [vicino("b", 1000, 500, L)],
      ...posizione,
    });
    expect(diverso.agganci).toEqual([]);
    expect(diverso.x).toBe(1075);
    // …e collo stesso formato sì. Senza questa seconda metà, la prima
    // passerebbe anche con un magnete rotto che non aggancia mai.
    const uguale = agganciaAiVicini({
      sagoma: quadrato("a", Q),
      vicini: [vicino("b", 1000, 500, Q)],
      ...posizione,
    });
    expect(uguale.agganci).toEqual(["b"]);
  });

  it("non trasforma uno spigolo che sfiora in un tavolone", () => {
    // Sovrapposizione di 20 cm: sotto CONTATTO_MINIMO_CM. Il magnete deve
    // lasciar perdere, altrimenti la sala conterebbe due coperti in meno
    // per un contatto che non è un piano su cui apparecchiare.
    const r = agganciaAiVicini({
      sagoma: quadrato("a"),
      vicini: [vicino("b", 1000, 500)],
      x: 1085,
      y: 570,
      raggioCm: 10,
      limiti: SALA,
    });
    expect(r.agganci).toEqual([]);
    expect(r.x).toBe(1085);
    expect(r.y).toBe(570);
  });

  it("non chiama da oltre il proprio raggio — e chiama da dentro", () => {
    const fuori = agganciaAiVicini({
      sagoma: quadrato("a"),
      vicini: [vicino("b", 1000, 500)],
      x: 1150,
      y: 500,
      raggioCm: raggio,
      limiti: SALA,
    });
    expect(fuori.agganci).toEqual([]);
    const dentro = agganciaAiVicini({
      sagoma: quadrato("a"),
      vicini: [vicino("b", 1000, 500)],
      x: 1105,
      y: 500,
      raggioCm: raggio,
      limiti: SALA,
    });
    expect(dentro.x).toBe(1090);
  });

  it("un tavolo infilato in mezzo ne nomina due", () => {
    const r = agganciaAiVicini({
      sagoma: quadrato("a"),
      vicini: [vicino("b", 1000, 500), vicino("c", 1180, 500)],
      x: 1085,
      y: 500,
      raggioCm: raggio,
      limiti: SALA,
    });
    expect(r.x).toBe(1090);
    expect(r.agganci.sort()).toEqual(["b", "c"]);
  });

  it("non spinge una sagoma fuori dalla sala — e senza il muro lo farebbe", () => {
    // Il vicino è a 80 dal bordo alto: l'unico appoggio dentro il raggio
    // sarebbe a y = -10, cioè mezzo tavolo dentro il muro.
    const sagoma = quadrato("a");
    const vicini = [vicino("b", 1000, 80)];
    const gesto = { sagoma, vicini, x: 1000, y: 5, raggioCm: raggio };
    expect(agganciaAiVicini({ ...gesto, limiti: SALA })).toMatchObject({ y: 5, agganci: [] });
    // ⚠️ La prova al contrario: senza il muro l'aggancio ci sarebbe. Senza
    // questa metà, la prima passerebbe anche con un magnete che non
    // aggancia mai da nessuna parte.
    expect(agganciaAiVicini({ ...gesto, limiti: null }).y).toBe(-10);
  });
});

describe("La riduzione del disegno", () => {
  // ⚠️ Questi numeri sono la MISURA su cui è stata presa la decisione, e
  // stanno qui perché una misura scritta solo in un riepilogo è
  // un'affermazione che nessuno controlla più.
  const PXCM_FABBRICA = 37.79528;
  const pavimentoInPiedi = (fattore) => (1030 / 90) * 1.05 * fattore * PXCM_FABBRICA;

  it("entra nel telefono di Alessio, e con margine", () => {
    // 390 punti di iPhone meno i 16+16 di margine della pagina.
    expect(pavimentoInPiedi(RIDUZIONE_DISEGNO)).toBeLessThan(358);
    // Il minimo esatto NON basta: lascia zero margine.
    expect(pavimentoInPiedi(0.788)).toBeGreaterThanOrEqual(357);
  });

  it("e anche in uno schermo da 375 punti, che è il margine che paghiamo", () => {
    expect(pavimentoInPiedi(RIDUZIONE_DISEGNO)).toBeLessThan(375 - 32);
  });

  it("senza riduzione non ci entrava — che è il difetto che chiude", () => {
    expect(pavimentoInPiedi(1)).toBeGreaterThan(358);
  });
});

describe("Il pannello dentro la pianta", () => {
  // Le zone come le disegna il fondale vero: due di servizio in alto che
  // formano un rettangolo, più il resto della sala.
  const ZONE = [
    { nome: "Servizi", x: 0, y: 0, larghezza: 530, profondita: 515, servizio: true },
    { nome: "Cucina", x: 530, y: 0, larghezza: 870, profondita: 515, servizio: true },
    { nome: "Sala alta", x: 1400, y: 0, larghezza: 670, profondita: 515 },
    { nome: "Sala bassa", x: 0, y: 515, larghezza: 1830, profondita: 515 },
  ];
  const tavolo = (x, y) => ({ id: `t${x}-${y}`, x, y, larghezza_cm: 90, profondita_cm: 90 });

  it("le due zone di servizio in alto formano il riquadro del pannello", () => {
    expect(riquadroDelPannello(ZONE)).toEqual({ x: 0, y: 0, larghezza: 1400, profondita: 515 });
  });

  it("se una zona viene RINOMINATA il pannello non si disegna — non si sposta a caso", () => {
    // ⚠️ La gemella al contrario: il fallimento è «niente pannello», mai «un
    // pannello nel posto sbagliato». Si perde una comodità, non si disegna
    // una cosa sopra il pavimento della sala.
    const rinominate = ZONE.map((z) => (z.nome === "Cucina" ? { ...z, nome: "Cucina nuova" } : z));
    expect(riquadroDelPannello(rinominate)).toBeNull();
  });

  it("e se le zone NON riempiono il loro ingombro, nemmeno", () => {
    // Due zone a L lasciano un angolo scoperto: un pannello tirato sul loro
    // ingombro ci finirebbe sopra. Stessa regola del tavolone che si disegna
    // come rettangolo unico solo se i pezzi lo riempiono.
    const aL = ZONE.map((z) => (z.nome === "Cucina" ? { ...z, profondita: 300 } : z));
    expect(riquadroDelPannello(aL)).toBeNull();
  });

  it("col posto sgombro il pannello ci va", () => {
    expect(pannelloNellaPianta(ZONE, [tavolo(1600, 100), tavolo(300, 800)])).toEqual({
      x: 0,
      y: 0,
      larghezza: 1400,
      profondita: 515,
    });
  });

  it("con un tavolo sopra la cucina NON ci va — ed è la cura del costo dichiarato", () => {
    // ⚠️ Il costo misurato era: un tavolo finito sotto il pannello non si
    // potrebbe più afferrare. Invece di scriverlo a schermo e lasciarlo
    // succedere, il conflitto non si fa esistere: il pannello esce dalla
    // pianta e torna sotto. Quello spazio è vuoto sul disegno, non vietato.
    expect(pannelloNellaPianta(ZONE, [tavolo(600, 200)])).toBeNull();
  });

  it("il bordo conta, e si misura sulle sagome COME SI DISEGNANO", () => {
    // Conta la posizione: 1400 è il primo centimetro fuori dal riquadro,
    // 1390 è dentro.
    expect(pannelloNellaPianta(ZONE, [tavolo(1400, 100)])).not.toBeNull();
    expect(pannelloNellaPianta(ZONE, [tavolo(1390, 100)])).toBeNull();
  });

  it("il margine di sicurezza è stato TOLTO, e al suo posto c'è il divieto", () => {
    // 🔴 IL 19/08 `MARGINE_INGRANDIMENTO_CM` guardava 17,5 cm per lato, e la
    // **Chef Table** — che sta 15 cm sotto il confine della cucina — faceva
    // sparire il pannello tutti i giorni. Il margine difendeva un caso che
    // da oggi **non può più presentarsi**: quell'area è vietata ai mobili.
    // ⚠️ La rete resta: un mobile che ci finisse comunque fa uscire il
    // pannello invece di essere coperto.
    const chefTable = { id: "chef", x: 980, y: 530, larghezza_cm: 200, profondita_cm: 70 };
    expect(pannelloNellaPianta(ZONE, [chefTable])).not.toBeNull();
    // e la sagoma vietata la prende comunque, che è la rete
    expect(dentroAreaVietata({ x: 600, y: 200, larghezza: 90, profondita: 90 }, areaVietataAiMobili(ZONE))).toBe(true);
    expect(pannelloNellaPianta(ZONE, [tavolo(600, 200)])).toBeNull();
  });
  it("su QUESTO fondale basta la posizione — e la prova lo dichiara", () => {
    // 🔴 QUI C'ERA UNA PROVA CHE NON DISCRIMINAVA, e se n'è accorta la
    // rottura fatta apposta, non la rilettura: guardando le misure sulla
    // carta invece del verso vero, **nessuna prova diventava rossa**.
    // La ragione è che l'area del pannello parte dall'angolo (0,0): una
    // sagoma la tocca se e solo se il suo spigolo in alto a sinistra cade
    // dentro, e **quanto è grande non conta**. Il verso della sagoma è
    // guardato lo stesso — è giusto in generale, e il fondale può cambiare —
    // ma su questo fondale non decide niente, e una prova che finge di
    // provarlo è peggio di nessuna prova.
    const lungo = { id: "L", larghezza_cm: 180, profondita_cm: 90 };
    for (const ruotato of [false, true]) {
      expect(pannelloNellaPianta(ZONE, [{ ...lungo, x: 1390, y: 100, ruotato }])).toBeNull();
      expect(pannelloNellaPianta(ZONE, [{ ...lungo, x: 1400, y: 520, ruotato }])).not.toBeNull();
    }
  });
});

describe("Le zone restano nominate anche se non si scrivono più a schermo", () => {
  // 🔴 LA TRAPPOLA CHE QUESTA PROVA DICHIARA. Il 19/08 i nomi delle zone
  // (SALA ALTA, CUCINA, SERVIZI…) sono spariti dal disegno: Alessio li ha
  // tolti. Ma `riquadroDelPannello()` filtra le zone **per nome** per sapere
  // dove mettere il pannello dentro la pianta.
  //
  // ⚠️ Se un domani qualcuno togliesse anche il campo `nome` dai dati —
  // «tanto non si vede più» — il pannello smetterebbe di comparire **senza
  // nessun errore**: si limiterebbe a non succedere, e la schermata
  // continuerebbe a funzionare benissimo con il modulo sotto la pianta.
  // È la stessa forma del difetto che nessuna prova prende: non un guasto,
  // una cosa che smette di avvenire.
  it("il fondale vero porta ancora le zone del pannello, e il pannello ci sta", () => {
    expect(riquadroDelPannello(ZONE_FONDALE)).toEqual({
      x: 0,
      y: 0,
      larghezza: 1400,
      profondita: 515,
    });
  });

  it("ogni zona del fondale ha un nome — anche quelle che non lo mostrano", () => {
    for (const z of ZONE_FONDALE) expect(z.nome).toBeTruthy();
  });
});

describe("Le sagome si disegnano più grandi del vero", () => {
  // 🔴 Rovesciamento di Alessio del 19/08: il disegno smette di dire il vero
  // sullo spazio, per rendere i tavoli afferrabili col dito. La misura che
  // l'ha reso possibile sta nel riepilogo del giro D3 — il varco più stretto
  // fra due sagome separate, in produzione, è **80 cm**.
  const SALA = { larghezza: 2070, profondita: 1030 };

  it("l'ingrandimento si misura in millimetri VERI, non in centimetri di sala", () => {
    // ⚠️ La stessa regola del raggio del magnete: scritto in unità del
    // disegno, si accorcerebbe da solo a ogni ridimensionamento — e il tavolo
    // tornerebbe piccolo proprio sullo schermo dove serve grande.
    // Sul telefono di Alessio: 1030 cm di sala su 358 punti → 2,877 cm per
    // punto; 3 mm veri fanno ~32,6 cm di sala.
    expect(ingrandimentoCm(1030 / 358, 37.79528, 3)).toBeCloseTo(32.6, 0);
    // Su uno schermo largo il doppio, lo stesso dito vale la metà dei
    // centimetri: è il senso di misurarlo in dito e non in sala.
    expect(ingrandimentoCm(1030 / 716, 37.79528, 3)).toBeCloseTo(16.3, 0);
  });

  it("e il valore predefinito è quello che ha detto Alessio: fra 2 e 3 mm", () => {
    // 🔴 QUESTA PROVA ESISTE PER UNA ROTTURA CHE NON DIVENTAVA ROSSA:
    // portando l'ingrandimento a zero, nessuna prova se ne accorgeva —
    // perché tutte gli passavano il numero a mano invece di usare quello
    // deciso. Una prova che non usa il valore vero non lo sta provando.
    // ⚠️ E congela una DECISIONE, non un gusto: *«giusto 2 o 3 mm in più»*.
    // Alzarlo oltre significa rimisurare i varchi fra le sagome (il più
    // stretto in produzione è 80 cm), non cambiare un numero.
    expect(INGRANDIMENTO_MM).toBeGreaterThanOrEqual(2);
    expect(INGRANDIMENTO_MM).toBeLessThanOrEqual(3);
    // e il valore predefinito è davvero quello, non un altro:
    expect(ingrandimentoCm(2.877, 37.79528)).toBeCloseTo(
      ingrandimentoCm(2.877, 37.79528, INGRANDIMENTO_MM),
      6
    );
  });

  it("senza una scala nota non cresce niente — meglio piccolo che sbagliato", () => {
    expect(ingrandimentoCm(0, 37.8)).toBe(0);
    expect(ingrandimentoCm(2.9, 0)).toBe(0);
  });

  it("cresce di METÀ per lato, così resta centrata dov'era", () => {
    const s = sagomaDisegnata({ x: 500, y: 400, larghezza: 90, profondita: 90 }, 30, SALA);
    expect(s).toEqual({ x: 485, y: 385, larghezza: 120, profondita: 120 });
  });

  it("MA AL MURO SI FERMA — ed è il caso vero di T2", () => {
    // ⚠️ Misurato in produzione il 19/08: **T2 tocca il muro in alto**
    // (distanza zero). Senza il taglio, la sagoma ingrandita uscirebbe dalla
    // sala disegnata — e un tavolo mezzo fuori dalla stanza è una cosa che il
    // disegno non deve poter dire.
    const alto = sagomaDisegnata({ x: 1600, y: 0, larghezza: 90, profondita: 180 }, 30, SALA);
    expect(alto.y).toBe(0);
    expect(alto.profondita).toBe(195); // cresciuta solo verso il basso
    const destra = sagomaDisegnata({ x: 1980, y: 400, larghezza: 90, profondita: 90 }, 30, SALA);
    expect(destra.x + destra.larghezza).toBe(2070);
  });

  it("con crescita zero è la sagoma vera — la gemella al contrario", () => {
    const s = sagomaDisegnata({ x: 500, y: 400, larghezza: 90, profondita: 90 }, 0, SALA);
    expect(s).toEqual({ x: 500, y: 400, larghezza: 90, profondita: 90 });
  });
});

describe("La crescita si ferma prima del vicino", () => {
  // 🔴 NASCE DA UN NUMERO SBAGLIATO. Il 19/08 l'ingrandimento era stato
  // accettato su una misura — «il varco più stretto è 80 cm» — che era il
  // minimo della sola PIANTA BASE: nelle disposizioni di giornata T5/T6 e
  // T7/T8 stanno a **40 cm**. Con una crescita di ~33 cm il varco sarebbe
  // sceso a 7, meno di un millimetro sullo schermo.
  // ⚠️ E rimisurare non bastava: la griglia è a passi di 10 cm, quindi
  // qualunque sera due tavoli possono finire a 20. **Nessuna misura di oggi
  // garantisce le disposizioni di domani** — serve una regola.
  const SALA = { larghezza: 2070, profondita: 1030 };
  // 🔴 I DUE NUMERI SI CHIEDONO AL CODICE, NON SI SCRIVONO QUI (19/08,
  // controprova della validazione). Prima erano `33` e `2` battuti a mano:
  // azzerando `VARCO_MINIMO_MM` **nessuna prova diventava rossa**, cioè la
  // regola che impedisce a due tavoli separati di vedersi attaccati non era
  // sorvegliata **nel valore che l'app usa davvero**. Stessa forma trovata
  // il giorno prima su `INGRANDIMENTO_MM`: *una prova che non usa il numero
  // deciso dal codice non lo sta provando.*
  //
  // Le due misure dello schermo sono quelle del telefono di Alessio con la
  // pianta in piedi: 1030 cm di sala su ~341 punti, e 37,8 punti per
  // centimetro vero. Da lì il codice ricava tutto il resto.
  const CM_PER_PUNTO = 3.02;
  const PXCM = 37.8;
  const CRESCITA = ingrandimentoCm(CM_PER_PUNTO, PXCM);
  const VARCO = ingrandimentoCm(CM_PER_PUNTO, PXCM, VARCO_MINIMO_MM);
  // Il varco che resta, riportato in MILLIMETRI DI SCHERMO: è lì che la
  // regola vuol dire qualcosa — «una riga che si vede».
  const inMillimetriDiSchermo = (cm) => (cm / CM_PER_PUNTO / PXCM) * 10;
  const q = (x, y) => ({ x, y, larghezza: 90, profondita: 90 });
  // Il varco DISEGNATO fra due sagome affiancate in orizzontale.
  const varcoDisegnato = (distanza) => {
    const a = q(500, 400);
    const b = q(500 + 90 + distanza, 400);
    const da = sagomaDisegnata(a, CRESCITA, SALA, [a, b], VARCO);
    const db = sagomaDisegnata(b, CRESCITA, SALA, [a, b], VARCO);
    return db.x - (da.x + da.larghezza);
  };

  // ⚠️ SI GUARDA IL VARCO IN MILLIMETRI DI SCHERMO E SI PRETENDE > 0, non
  // «≥ VARCO»: quest'ultima passerebbe **anche col varco azzerato**, perché
  // zero è sempre maggiore o uguale a zero. È la differenza fra una prova
  // che descrive il codice e una che lo mette alla prova.
  it("a 40 cm resta una riga visibile — è il caso vero della disposizione del 19/08", () => {
    expect(inMillimetriDiSchermo(varcoDisegnato(40))).toBeGreaterThan(0);
  });

  it("a 20 cm resta una riga visibile — è quello che la griglia permette domani", () => {
    expect(inMillimetriDiSchermo(varcoDisegnato(20))).toBeGreaterThan(0);
    // e il varco che resta è ESATTAMENTE quello deciso: sotto i 20 cm la
    // crescita non arriva a riempire, quindi il limite è il varco minimo.
    expect(varcoDisegnato(20)).toBeCloseTo(VARCO, 6);
  });

  it("e anche a 10 cm, che è il passo della griglia", () => {
    expect(inMillimetriDiSchermo(varcoDisegnato(10))).toBeGreaterThan(0);
    expect(varcoDisegnato(10)).toBeCloseTo(VARCO, 6);
  });

  it("ma da sola cresce tutto — altrimenti la regola non servirebbe a niente", () => {
    // ⚠️ La gemella al contrario: una funzione che non crescesse mai passerebbe
    // le tre prove qui sopra.
    const sola = q(500, 400);
    const cresciuta = sagomaDisegnata(sola, CRESCITA, SALA, [sola], VARCO);
    expect(cresciuta.larghezza).toBeCloseTo(90 + CRESCITA, 6);
  });

  it("verso un vicino ATTACCATO non cresce: il tavolone non si mangia la giunzione", () => {
    // Due tavoli a distanza zero sono un tavolone: crescere verso l'interno
    // farebbe sparire la linea sottile che dice «è fatto di due».
    // ⚠️ Questa prova NON discrimina la riga che tratta gli attaccati come
    // caso a sé: a varco zero la formula generale dà già zero. È dichiarato
    // nel codice — quel ramo oggi non si percorre, e una rottura fatta
    // apposta non lo mostra.
    const a = q(500, 400);
    const b = q(590, 400);
    const da = sagomaDisegnata(a, CRESCITA, SALA, [a, b], VARCO);
    const db = sagomaDisegnata(b, CRESCITA, SALA, [a, b], VARCO);
    expect(da.x + da.larghezza).toBe(590); // il bordo interno resta dov'era
    expect(db.x).toBe(590);
    expect(da.x).toBeCloseTo(500 - CRESCITA / 2, 6); // e verso fuori cresce
  });
});

describe("le sagome spostate solo nel disegno", () => {
  it("la Chef Table è l'unica spostata, e il resto della sagoma non cambia", () => {
    // ⚠️ Se questa prova diventa rossa, qualcuno ha aggiunto o tolto una
    // sagoma finta: è una bugia voluta e va letta prima di cambiarla
    // (docs/decisioni_rovesciate.md n. 15).
    expect(Object.keys(SPOSTATE_NEL_DISEGNO)).toEqual(["Chef Table"]);

    const vera = {
      id: "x",
      label: "Chef Table",
      x: 980,
      y: 530,
      larghezza_cm: 200,
      profondita_cm: 70,
      ruotato: false,
    };
    const disegnata = sagomaPerIlDisegno(vera);
    expect([disegnata.x, disegnata.y]).not.toEqual([vera.x, vera.y]);
    expect(disegnata.ruotato).toBe(true);
    // le misure del mobile NON si toccano: si sposta, non si rimpicciolisce
    expect(disegnata.larghezza_cm).toBe(200);
    expect(disegnata.profondita_cm).toBe(70);
    // e la sagoma vera resta intatta
    expect(vera.x).toBe(980);
  });

  it("ogni altra sagoma torna identica, non una copia", () => {
    const t = { id: "t", label: "T5", x: 100, y: 100 };
    expect(sagomaPerIlDisegno(t)).toBe(t);
  });
});

describe("La sala dei tavoli è una L capovolta", () => {
  // Idea di Alessio, 19/08: cucina e servizi sono vietati ai mobili. Prima un
  // tavolo si poteva trascinare ovunque nel rettangolo della sala.
  const ZONE = [
    { nome: "Servizi", x: 0, y: 0, larghezza: 530, profondita: 515, servizio: true },
    { nome: "Cucina", x: 530, y: 0, larghezza: 870, profondita: 515, servizio: true },
    { nome: "Sala alta", x: 1400, y: 0, larghezza: 670, profondita: 515 },
    { nome: "Sala bassa", x: 0, y: 515, larghezza: 1830, profondita: 515 },
  ];
  const VIETATA = areaVietataAiMobili(ZONE);

  it("l'area vietata e il riquadro del pannello sono LA STESSA COSA", () => {
    // ⚠️ Non è una comodità: il pannello sta lì **perché** lì non ci sono
    // mobili. Due definizioni che possono divergere direbbero che il
    // pannello può stare dove un tavolo può andare.
    expect(VIETATA).toEqual(riquadroDelPannello(ZONE));
  });

  it("il magnete non PROPONE una posizione dentro l'area vietata", () => {
    // A sta appena sotto il confine della cucina, dove è lecito. B, tirato
    // sopra di lui, si aggancerebbe a y = 425 — cioè dentro la cucina.
    const a = { id: "a", formato_id: "q", x: 600, y: 515, larghezza: 90, profondita: 90 };
    const b = { id: "b", formato_id: "q", larghezza: 90, profondita: 90 };
    const limiti = { larghezza: 2070, profondita: 1030 };

    const senzaDivieto = agganciaAiVicini({ sagoma: b, vicini: [a], x: 600, y: 430, raggioCm: 20, limiti });
    expect(senzaDivieto.y).toBe(425); // la gemella: senza divieto ci andrebbe

    const conDivieto = agganciaAiVicini({
      sagoma: b, vicini: [a], x: 600, y: 430, raggioCm: 20, limiti, vietata: VIETATA,
    });
    expect(conDivieto.y).toBe(430); // resta dove il dito l'ha lasciata
    expect(conDivieto.agganci).toEqual([]);
  });

  it("ma un aggancio LECITO continua a scattare — il divieto non spegne il magnete", () => {
    const a = { id: "a", formato_id: "q", x: 600, y: 600, larghezza: 90, profondita: 90 };
    const b = { id: "b", formato_id: "q", larghezza: 90, profondita: 90 };
    const preso = agganciaAiVicini({
      sagoma: b, vicini: [a], x: 600, y: 695, raggioCm: 20,
      limiti: { larghezza: 2070, profondita: 1030 }, vietata: VIETATA,
    });
    expect(preso.y).toBe(690);
    expect(preso.agganci).toEqual(["a"]);
  });

  it("e il divieto si misura sull'ingombro, non sull'angolo", () => {
    // Una sagoma che comincia fuori ma ci entra col corpo è dentro.
    expect(dentroAreaVietata({ x: 1350, y: 400, larghezza: 90, profondita: 90 }, VIETATA)).toBe(true);
    expect(dentroAreaVietata({ x: 1400, y: 400, larghezza: 90, profondita: 90 }, VIETATA)).toBe(false);
    expect(dentroAreaVietata({ x: 600, y: 515, larghezza: 90, profondita: 90 }, VIETATA)).toBe(false);
    // e senza area vietata non vieta niente
    expect(dentroAreaVietata({ x: 0, y: 0, larghezza: 90, profondita: 90 }, null)).toBe(false);
  });

  it("il raggio del magnete è UNO, e comprende l'ingrandimento", () => {
    // 🔴 La prova sui dati veri chiamava `raggioAggancioCm()` da sola, cioè
    // sorvegliava un magnete più piccolo di quello che l'app usa. Adesso il
    // numero lo decide una funzione sola, e chi prova chiama quella.
    const cmPerPunto = 3.02;
    const pxcm = 37.8;
    expect(raggioMagneteCm(cmPerPunto, pxcm)).toBeCloseTo(
      raggioAggancioCm(cmPerPunto, pxcm) + ingrandimentoCm(cmPerPunto, pxcm),
      6
    );
    // ed è sensibilmente più grande del solo dito: è il prezzo dichiarato
    expect(raggioMagneteCm(cmPerPunto, pxcm)).toBeGreaterThan(raggioAggancioCm(cmPerPunto, pxcm));
  });
});

describe("La pianta entra in larghezza negli schermi veri", () => {
  // 🔴 QUESTA PROVA NASCE DA UN DIFETTO VISTO CON GLI OCCHI (21/08): Alessio
  // ha calibrato la simulazione al valore di un mini tablet e **la pianta è
  // sbordata dallo schermo**. Nessuna prova poteva accorgersene — la
  // larghezza minima viveva dentro la schermata, e il disegno delle due
  // colonne era stato misurato con la calibrazione da computer.
  //
  // ⚠️ LA REGOLA DI ALESSIO, che è ciò che queste prove tengono fermo:
  // *quello che si vede deve entrare in larghezza; se serve scorrere, si
  // scorre in verticale.*
  //
  // ⚠️ E I DUE ERRORI VANNO NELLA STESSA DIREZIONE, che è il motivo per cui
  // non si vedono: sul tablet i punti disponibili sono MENO e tutto ciò che
  // è dimensionato in centimetri veri diventa PIÙ GRANDE.
  const SCHERMI = [
    { nome: "Android 8 pollici", viewport: 800, pxcm: 74, padding: 32 },
    { nome: 'iPad mini 7,9"', viewport: 768, pxcm: 64, padding: 32 },
    { nome: 'iPad mini 8,3"', viewport: 744, pxcm: 59.5, padding: 16 },
  ];

  for (const s of SCHERMI) {
    it(`${s.nome}: a tutta larghezza la pianta ci sta`, () => {
      const utili = s.viewport - s.padding * 2;
      expect(marginePiantaInPiedi(utili, s.pxcm)).toBeGreaterThan(0);
    });

    it(`${s.nome}: in una colonna del 62% NON ci starebbe — ecco perché non ci sono più`, () => {
      // ⚠️ La gemella al contrario, e senza di lei la prima non direbbe
      // niente: se la pianta entrasse comunque, «a tutta larghezza» non
      // sarebbe una condizione ma una coincidenza.
      const utili = s.viewport - s.padding * 2;
      expect(marginePiantaInPiedi(utili * 0.62, s.pxcm)).toBeLessThan(0);
    });
  }

  it("e la soglia del tocco è rimasta 1,05 cm — non è stata abbassata per far entrare le colonne", () => {
    // ⚠️ Era stato proposto di portarla a 0,7 per far stare menu e pianta
    // affiancati. Quelle colonne non esistono più, e il numero non si abbassa
    // per prudenza: un bersaglio più piccolo si paga in servizio.
    expect(TOCCO_TAVOLO_CM).toBe(1.05);
  });
});

// =====================================================================
// 🔴 IL DISEGNO ENTRA NEL RIQUADRO — la domanda che le sette prove qui
// sopra NON facevano (22/08/2026)
// =====================================================================
//
// Quelle chiedono *«il RIQUADRO entra nella pagina?»*, e passavano tutte
// mentre Alessio guardava una sala tagliata: T9 a metà, i divani e la Chef
// Table non disegnati affatto. **Sono due domande diverse**, e la seconda è
// quella che conta per chi guarda.
//
// ⚠️ E IL MODO IN CUI FALLIVA È IL PUNTO: una sagoma fuori dal disegno non
// viene mostrata affatto. Non si vede un errore — si vede *una sala con meno
// tavoli*, che è una cosa plausibile. Un tavolo che non c'è non si può
// toccare, e in servizio non te ne accorgi finché non lo cerchi.
describe("la sala si vede tutta", () => {
  const tavolo = (label, x, y, extra = {}) => ({
    label,
    x,
    y,
    larghezza_cm: 90,
    profondita_cm: 90,
    ruotato: false,
    ...extra,
  });

  it("una sagoma dentro i limiti non viene segnalata", () => {
    expect(sagomeFuoriDalDisegno([tavolo("T1", 0, 0), tavolo("T2", 1900, 900)])).toEqual([]);
  });

  it("🔴 una sagoma che sfora a destra viene nominata", () => {
    const fuori = sagomeFuoriDalDisegno([tavolo("T9", SALA_LARGHEZZA_CM - 40, 0)]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].label).toBe("T9");
  });

  it("🔴 e una che sfora in fondo, che è il verso che sul telefono diventa «a destra»", () => {
    // ⚠️ Sul telefono la sala si mette in piedi e i due assi si scambiano:
    // il fondo della stanza diventa il bordo destro dello schermo. È
    // esattamente il bordo da cui sono sparite le sagome il 22/08.
    const fuori = sagomeFuoriDalDisegno([tavolo("Divano", 0, SALA_PROFONDITA_CM - 40, { profondita_cm: 200 })]);
    expect(fuori.map((f) => f.label)).toEqual(["Divano"]);
  });

  it("guarda la sagoma COME VIENE DISEGNATA: il verso conta", () => {
    // Un tavolo da 180×90 messo a 40 cm dal fondo ci sta sdraiato e non ci
    // sta girato. Guardare i dati senza il verso direbbe che va bene.
    const posto = { larghezza_cm: 180, profondita_cm: 90, x: 0, y: SALA_PROFONDITA_CM - 100 };
    expect(sagomeFuoriDalDisegno([{ ...posto, label: "diritto", ruotato: false }])).toEqual([]);
    expect(sagomeFuoriDalDisegno([{ ...posto, label: "girato", ruotato: true }])).toHaveLength(1);
  });

  it("guarda il posto DEL DISEGNO, non quello vero", () => {
    // 🔴 QUESTA PROVA È STATA RISCRITTA PERCHÉ NON DISCRIMINAVA (22/08).
    // La prima versione usava la Chef Table alle sue coordinate vere, che
    // stanno dentro il foglio **come la sua posizione disegnata**: rotto
    // apposta il codice — fatto guardare il dato vero invece del disegno —
    // **nessuna prova diventava rossa**. Misurava una coincidenza.
    //
    // ⚠️ Adesso il caso è costruito perché le due risposte siano DIVERSE:
    // una Chef Table messa fuori dal foglio nei dati, e dentro nel disegno
    // (rovesciamento n. 15: in pianta si disegna sotto i divani).
    const fuoriNeiDati = {
      label: "Chef Table",
      x: SALA_LARGHEZZA_CM - 20,
      y: SALA_PROFONDITA_CM - 20,
      larghezza_cm: 200,
      profondita_cm: 70,
      ruotato: false,
    };
    // Il disegno la mette a (150, 800) girata: ci sta.
    expect(sagomeFuoriDalDisegno([fuoriNeiDati])).toEqual([]);
    // E la controprova che il caso sia davvero discriminante: senza lo
    // spostamento, quella stessa sagoma sfora.
    expect(sagomeFuoriDalDisegno([{ ...fuoriNeiDati, label: "T1" }])).toHaveLength(1);
  });

  it("🔴 la pianta VERA di partenza sta tutta dentro il disegno", () => {
    // Le 13 sagome come le ha messe Alessio. Se un domani qualcuno ne
    // spostasse una oltre il bordo, questa diventa rossa **prima** che la
    // sala si presenti in servizio con un tavolo in meno.
    expect(sagomeFuoriDalDisegno(PIANTA_DI_PARTENZA)).toEqual([]);
  });
});

// La pianta base di produzione al 22/08/2026 — ⚠️ è una FOTOGRAFIA, e come
// tale invecchia: serve a provare la regola, non a descrivere la sala di
// oggi. Quella la guarda la prova sui dati veri.
const PIANTA_DI_PARTENZA = [
  { label: "T1", x: 1860, y: 330, larghezza_cm: 180, profondita_cm: 90, ruotato: true },
  { label: "T2", x: 1600, y: 0, larghezza_cm: 180, profondita_cm: 90, ruotato: true },
  { label: "T3", x: 1600, y: 360, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T4", x: 1860, y: 60, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T5", x: 1330, y: 870, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T6", x: 1330, y: 780, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T7", x: 1610, y: 870, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T8", x: 1610, y: 780, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "T9", x: 1610, y: 690, larghezza_cm: 90, profondita_cm: 90, ruotato: false },
  { label: "Divano 1", x: 300, y: 800, larghezza_cm: 240, profondita_cm: 200, ruotato: false },
  { label: "Divano 2", x: 620, y: 800, larghezza_cm: 240, profondita_cm: 200, ruotato: false },
  { label: "Divano 3", x: 940, y: 800, larghezza_cm: 240, profondita_cm: 200, ruotato: false },
  { label: "Chef Table", x: 980, y: 530, larghezza_cm: 200, profondita_cm: 70, ruotato: false },
];

// =====================================================================
// IL PREZZO DEL DISEGNO SENZA PAVIMENTO (22/08/2026)
// =====================================================================
describe("il bersaglio del dito quando la pianta si adatta", () => {
  const SCHERMI_VERI = [
    { nome: "Android 8 pollici", utili: 800 - 64, pxcm: 74 },
    { nome: 'iPad mini 7,9"', utili: 768 - 64, pxcm: 64 },
    { nome: 'iPad mini 8,3"', utili: 744 - 32, pxcm: 59.5 },
  ];

  for (const s of SCHERMI_VERI) {
    it(`${s.nome}: il bersaglio resta sopra i 5,3 mm provati con le mani`, () => {
      // ⚠️ Il confronto è col numero MISURATO SU UN GESTO (18/08), non con
      // la convenzione di 1,05 cm presa dal brief. È l'unico dei due che la
      // realtà abbia confermato.
      expect(bersaglioTavoloCm(s.utili, s.pxcm)).toBeGreaterThan(BERSAGLIO_PROVATO_CM);
    });
  }

  it("🔴 e su un telefono scende sotto: è il prezzo, e va detto", () => {
    // 375 punti di iPhone meno i margini. Lì il bersaglio va sotto i 5,3 mm
    // provati — ma la sala si vede TUTTA, che prima non era vero. La
    // calibrazione lo dice a chi sposta il righello.
    expect(bersaglioTavoloCm(375 - 64, 74)).toBeLessThan(BERSAGLIO_PROVATO_CM);
  });

  it("più punti, bersaglio più grande — il verso del rapporto", () => {
    expect(bersaglioTavoloCm(1000, 74)).toBeGreaterThan(bersaglioTavoloCm(500, 74));
  });
});

// =====================================================================
// 🔴 «STA DENTRO QUELLO CHE SI VEDE?» — la terza domanda (22/08/2026)
// =====================================================================
//
// Le prime sette prove chiedono *«il riquadro entra nella pagina?»*, quelle
// del 22/08 mattina *«la sagoma sta dentro il foglio?»*. Restava fuori
// quella che conta per chi guarda: **la sagoma sta dentro il riquadro che si
// VEDE?** — che non è geometria della sala, è geometria della pagina, e
// dipende da ogni antenato, da un margine, da un ritaglio che nessuno ha
// misurato.
//
// ⚠️ La misura vive nella schermata (là c'è una pagina); qui vive la
// DECISIONE, che è la parte che si può rompere e provare senza browser.
describe("le sagome che non si vedono per intero", () => {
  const riquadro = { sinistra: 0, cima: 0, destra: 700, fondo: 1400 };
  const sagoma = (nome, sinistra, destra, cima = 10, fondo = 90) => ({
    nome,
    sinistra,
    destra,
    cima,
    fondo,
  });

  it("dentro il riquadro: nessuna denuncia", () => {
    expect(
      sagomeTagliateDallaVista([sagoma("T1", 10, 90), sagoma("T2", 600, 690)], riquadro)
    ).toEqual([]);
  });

  it("🔴 una che sfora a destra viene nominata, e col verso", () => {
    const fuori = sagomeTagliateDallaVista([sagoma("T7", 660, 740)], riquadro);
    expect(fuori).toEqual([{ nome: "T7", versi: ["destra"] }]);
  });

  it("🔴 anche mezza sagoma conta: basta che il bordo esca", () => {
    // È esattamente quello che si vede: metà tavolo con la lettera, il
    // resto fuori. Se il controllo guardasse il CENTRO, questa passerebbe.
    const fuori = sagomeTagliateDallaVista([sagoma("T7", 660, 701)], riquadro);
    expect(fuori).toHaveLength(1);
  });

  it("e sotto, e sopra, e a sinistra", () => {
    const fuori = sagomeTagliateDallaVista(
      [
        sagoma("giu", 10, 90, 1350, 1450),
        sagoma("su", 10, 90, -20, 40),
        sagoma("sx", -30, 40),
      ],
      riquadro
    );
    expect(fuori.map((f) => f.nome + ":" + f.versi.join("+"))).toEqual([
      "giu:sotto",
      "su:sopra",
      "sx:sinistra",
    ]);
  });

  it("mezzo punto di tolleranza, perché i bordi arrotondano", () => {
    // ⚠️ Un guardiano che grida per un decimo di punto si impara a
    // spegnere — ed è la lezione del freno dei rincari (13/08).
    expect(sagomeTagliateDallaVista([sagoma("T1", 0, 700.4)], riquadro)).toEqual([]);
    expect(sagomeTagliateDallaVista([sagoma("T1", 0, 701)], riquadro)).toHaveLength(1);
  });

  it("senza riquadro non inventa un allarme", () => {
    // Prima che la pagina sia disegnata non si sa niente, e «non lo so» non
    // è «è tagliata» (regola del 19/08).
    expect(sagomeTagliateDallaVista([sagoma("T1", 0, 9999)], null)).toEqual([]);
  });
});
