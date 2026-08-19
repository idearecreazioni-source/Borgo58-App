import { describe, expect, it } from "vitest";
import {
  CONTATTO_MINIMO_CM,
  ZONE_FONDALE,
  GRIGLIA_CM,
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

  it("un tavolo che lo sfiora appena basta a farlo uscire", () => {
    // Il bordo conta: 1400 è il primo centimetro fuori, 1390 è dentro.
    expect(pannelloNellaPianta(ZONE, [tavolo(1400, 100)])).not.toBeNull();
    expect(pannelloNellaPianta(ZONE, [tavolo(1390, 100)])).toBeNull();
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
