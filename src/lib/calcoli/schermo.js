// Quanto spazio ha davvero la pianta, sul telefono vero.
//
// ⚠️ PERCHÉ ESISTE, e perché è una MISURA e non una cura. Il giro E deve
// far entrare la pianta nello schermo di un iPhone. Ma quanto spazio ci
// sia dipende da una cosa che da un terminale non si può sapere: le barre
// di Safari — indirizzo sopra, comandi sotto — che in un'app aggiunta alla
// schermata iniziale **spariscono**.
//
// Riportare la cifra di listino di quelle barre sarebbe la stessa forma
// del conteggio scritto negli appunti: un'affermazione che nessuno ha
// verificato. Quindi la misura la fa l'app, sul telefono di Alessio: lui
// guarda un numero una volta da Safari e una volta dall'icona, e **la
// differenza fra i due è lo spazio guadagnato**.
//
// ⚠️ E VA TOLTO QUANDO IL GIRO E CHIUDE. Un numero tecnico dimenticato in
// un angolo è la famiglia di «fisco_scadenze»: rumore che fra un mese
// nessuno sa più perché c'è. Per questo sta dietro un gesto e non è
// sempre acceso — e per questo la sua rimozione è scritta qui, dove chi
// chiude il giro la trova.

/**
 * Le misure che servono a dimensionare la pianta.
 *
 * `altezzaUtile` è quella che conta: quanti pixel di finestra restano
 * davvero. In Safari è meno dello schermo (le barre); in un'app aggiunta
 * alla schermata iniziale è quasi tutto.
 */
export function misureSchermo(finestra = window, documento = globalThis.document) {
  const installata = modalitaInstallata(finestra);
  const stabili = altezzeStabili(documento);
  return {
    installata,
    altezzaUtile: Math.round(finestra.innerHeight),
    larghezzaUtile: Math.round(finestra.innerWidth),
    altezzaSchermo: Math.round(finestra.screen?.height ?? 0),
    // Quanto si è perso rispetto allo schermo fisico: in Safari sono le
    // barre, da installata è quasi zero.
    barre: Math.max(0, Math.round((finestra.screen?.height ?? 0) - finestra.innerHeight)),
    ...stabili,
  };
}

/**
 * ⚠️ IL RILIEVO CHE CAMBIA COSA SI MISURA (validazione del 18/08).
 * `innerHeight` è l'altezza **in quel momento**: su iPhone le barre di
 * Safari si ritirano scorrendo, e la finestra cresce mentre la pagina
 * vive. Un numero letto una volta è quindi una fotografia, non una misura
 * — e dimensionare la pianta su quella fotografia significa costruirla su
 * un'altezza che cambia sotto.
 *
 * Il browser però conosce **i due casi stabili**, e sono unità CSS:
 *   · `svh` (small)  = l'altezza con le barre APERTE, cioè la più piccola;
 *   · `lvh` (large)  = con le barre RITIRATE, la più grande;
 *   · `dvh` (dynamic) = quella di adesso, che si muove fra le due.
 *
 * Si misurano mettendo un righello invisibile nella pagina e chiedendo
 * quanto è alto. **Sul `svh` si dimensiona**: è il caso stabile più
 * piccolo, e tutto il resto diventa margine invece che salto.
 */
export function altezzeStabili(documento) {
  if (!documento?.createElement) return { piccola: null, grande: null, adesso: null };
  const righello = documento.createElement("div");
  righello.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:0;";
  documento.body.appendChild(righello);
  const misura = (unita) => {
    righello.style.height = `100${unita}`;
    const h = righello.getBoundingClientRect().height;
    return h > 0 ? Math.round(h) : null;
  };
  const out = { piccola: misura("svh"), grande: misura("lvh"), adesso: misura("dvh") };
  righello.remove();
  return out;
}

/**
 * L'app è stata aperta dall'icona (schermata iniziale) o dal browser?
 *
 * ⚠️ Due modi perché iOS e gli altri non usano lo stesso: `standalone` è
 * la strada di Safari, la media query è quella standard. Guardarne uno
 * solo darebbe «no» su metà dei casi — e un «no» sbagliato qui farebbe
 * misurare due volte la stessa cosa.
 */
export function modalitaInstallata(finestra = window) {
  if (finestra.navigator?.standalone) return true;
  return Boolean(finestra.matchMedia?.("(display-mode: standalone)")?.matches);
}

/** La riga che Alessio legge e riferisce, in parole sue. */
export function fraseMisura(m) {
  const stabili =
    m.piccola && m.grande
      ? ` · stabile fra ${m.piccola} e ${m.grande}`
      : "";
  return `${m.installata ? "Dall'icona" : "Da Safari"}: ${m.altezzaUtile} di altezza (schermo ${m.altezzaSchermo}, barre ${m.barre})${stabili}.`;
}
