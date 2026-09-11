// Quando la didascalia si apre e quando si chiude.
//
// 🔴 PERCHE' LA REGOLA VIVE QUI E NON DENTRO IL COMPONENTE (24/08/2026).
// In due giorni questo segno si e' rotto **due volte**, tutt'e due per la
// stessa ragione: i tre modi di arrivarci — mouse, dito, tastiera —
// producono sequenze di eventi diverse, e una cura fatta per uno rompeva
// un altro.
//   · il 23/08: il focus apriva e il clic subito dopo richiudeva, quindi
//     col dito la didascalia lampeggiava e spariva;
//   · il 24/08: il passaggio del mouse apriva e il clic — che con un mouse
//     arriva SEMPRE dopo il passaggio — richiudeva, quindi col mouse non
//     si apriva mai.
//
// ⚠️ NESSUNA DELLE DUE VOLTE L'HA VISTA UNA RILETTURA, e nemmeno una prova
// con eventi finti: `pointerenter` sintetico non arriva a React (che lo
// simula da `pointerover`), quindi il clic partiva da chiusa e il toggle
// sembrava giusto. Le ha trovate un gesto vero.
//
// ⚠️ In questo progetto le prove non hanno un ambiente DOM, quindi il
// componente non si puo' provare. **La decisione si', se sta fuori.** Qui
// non c'e' React: c'e' la regola, e le prove la tengono ferma.
//
// I tre modi, e perche' si comportano diversamente:
//   · MOUSE — apre passandoci sopra, chiude uscendo. Il clic **non fa
//     niente**: chi clicca la vuole aperta, e con l'hover la chiusura c'e'
//     gia' ed e' il gesto naturale.
//   · DITO — non esiste «uscire», quindi il tocco fa da interruttore.
//   · TASTIERA — si apre arrivandoci col Tab e si chiude andando via o con
//     Escape. Si guarda `:focus-visible`, che e' la distinzione che il
//     browser fa gia': vero quando il focus arriva da Tab, falso quando
//     arriva da un clic o da un tocco.

/**
 * Con cosa è arrivato un clic.
 *
 * 🔴 SI PRENDE DALLA PRESSIONE (`pointerdown`), NON DAL CLIC — 11/09/2026.
 * La pressione dichiara sempre il suo tipo — mouse, dito, penna — in ogni
 * browser. Il clic invece lo porta solo dove il browser lo manda come
 * evento del puntatore, e non tutti lo fanno: dove arriva senza tipo, un
 * clic col mouse verrebbe preso per un dito e richiuderebbe ciò che il
 * passaggio ha appena aperto — il difetto del 24/08, rientrato da un'altra
 * porta. Senza pressione (Invio o barra spaziatrice dalla tastiera) resta
 * quello che dice il clic.
 *
 * @param {string|undefined} premuto  il tipo della pressione che l'ha preceduto
 * @param {string|undefined} delClic  il tipo che dichiara il clic stesso
 */
export function puntatoreDelClic(premuto, delClic) {
  return premuto || delClic || undefined;
}

/**
 * Di quanto spostare la spiegazione perché resti dentro lo schermo.
 *
 * 🔴 11/09/2026, misurato sul telefono: un «?» vicino al bordo destro apriva
 * una spiegazione larga 256 punti che andava da 342 a 598 su uno schermo da
 * 390 — la pagina si allargava e scorreva di lato. Si sposta verso sinistra
 * quanto serve, e mai oltre il margine sinistro.
 *
 * @param {{sinistra: number, destra: number}} riquadro  dove cade adesso
 * @param {number} larghezza  larghezza dello schermo
 * @param {number} margine    spazio da lasciare ai due lati
 */
export function spostamentoNelloSchermo({ sinistra, destra }, larghezza, margine = 8) {
  let dx = 0;
  if (destra > larghezza - margine) dx = larghezza - margine - destra;
  if (sinistra + dx < margine) dx = margine - sinistra;
  return dx;
}

/**
 * @param {string} gesto  "clic" | "entra" | "esce" | "fuoco" | "fuocoVia" | "esc"
 * @param {object} come   { puntatore: "mouse"|"touch"|"pen", daTastiera: boolean }
 * @param {boolean} aperta  com'è adesso
 * @returns {boolean} come deve stare dopo
 */
export function dopoIlGesto(gesto, come, aperta) {
  const { puntatore, daTastiera } = come ?? {};
  switch (gesto) {
    case "clic":
      // ⚠️ Col mouse il clic non tocca niente: aprire e chiudere è già
      // compito del passaggio, e un toggle sopra un hover si annullano.
      return puntatore === "mouse" ? aperta : !aperta;
    case "entra":
      return puntatore === "mouse" ? true : aperta;
    case "esce":
      return puntatore === "mouse" ? false : aperta;
    case "fuoco":
      // ⚠️ Solo se il fuoco arriva dalla tastiera: un clic dà il fuoco
      // PRIMA del clic, e senza questa condizione le due cose si pestano.
      return daTastiera ? true : aperta;
    case "fuocoVia":
    case "esc":
      return false;
    default:
      return aperta;
  }
}
