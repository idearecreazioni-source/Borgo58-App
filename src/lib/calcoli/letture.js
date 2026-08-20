// QUELLO CHE NON TROVA QUELLO CHE CERCA DEVE DIRLO — 20/08/2026.
//
// 🔴 IL DIFETTO, IN UNA FRASE: `.catch(() => [])` trasforma «non sono
// riuscito a leggerlo» in «non c'è niente», e a schermo le due cose si
// leggono uguali. È la famiglia che questo progetto insegue da tre giorni
// (§8): *una risposta più corta che ha l'aria di essere intera.*
//
// Il caso che l'ha resa una regola: in Magazzino il riquadro «Cosa non è
// sceso dal magazzino» compare **solo se la lista non è vuota**. Se la
// lettura fallisce il riquadro sparisce — e la schermata dice, con calma,
// che è sceso tutto.
//
// ⚠️ PERCHÉ UNA REGOLA E NON CINQUE TOPPE. La correzione punto per punto
// sarebbe «trovarli tutti», e il prossimo che scrive una lettura nuova
// ricomincerebbe da capo. Qui la decisione vive in **un posto solo**, e una
// prova di forma sorveglia che nessuno la aggiri (`tests/unita/letture.test.js`).
//
// ⚠️ E LA DECISIONE È SEPARATA DAL DISEGNO, apposta: in questo progetto le
// prove non hanno un ambiente DOM, quindi nessuna prova automatica può
// guardare una schermata. Separandola, quello che si può provare è
// **quale delle tre cose la schermata dirà** — che è la parte dove il
// difetto vive. Stesso taglio di `segnoDelTavolo()` per i colori della sala.

// Il segno di «non ci sono riuscito». Un oggetto congelato e non `null`:
// `null` è già un valore legittimo in mezzo mondo del gestionale, e
// confonderli riaprirebbe il difetto da un'altra porta.
export const NON_LETTO = Object.freeze({ __nonLetto: true });

export function nonLetto(valore) {
  return valore === NON_LETTO;
}

// Sostituisce `.catch(() => [])` e `.catch(() => null)`: NON fa cadere le
// letture accanto (che è la ragione per cui quei catch esistevano), ma
// conserva l'informazione invece di buttarla.
//
// ⚠️ Si usa su una lettura ACCESSORIA, quella che prima veniva ingoiata. La
// lettura principale di una schermata continua a passare dal suo `try`, che
// mostra l'errore vero con la sua via d'uscita.
export async function leggi(promessa) {
  try {
    return await promessa;
  } catch {
    return NON_LETTO;
  }
}

// LE TRE RISPOSTE, e sono tre perché due non bastano.
//
//   "non_letto" → non lo so. La schermata lo dice, e non disegna niente al
//                 posto suo.
//   "vuoto"     → l'ho letto, e non c'è niente. È un'informazione vera.
//   "pieno"     → c'è roba.
//
// ⚠️ Il punto di tutto il modulo è che le prime due NON si possono più
// confondere: prima erano lo stesso `[]`.
export function statoLettura(valore) {
  if (nonLetto(valore)) return "non_letto";
  if (valore == null) return "vuoto";
  if (Array.isArray(valore)) return valore.length === 0 ? "vuoto" : "pieno";
  if (typeof valore === "number") return "pieno";
  if (typeof valore === "string") return valore === "" ? "vuoto" : "pieno";
  if (typeof valore === "object") return Object.keys(valore).length === 0 ? "vuoto" : "pieno";
  return "pieno";
}
