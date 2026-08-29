// =====================================================================
// IL NUMERO CHE SI PROPONE DAVANTI ALLO SCAFFALE
// 29/08/2026
// =====================================================================
// 🔴 IL FATTO. L'Allineamento apre il campo col numero che il gestionale
// calcola, perche' chi deve solo confermare non riscriva niente. Ma quel
// numero arrivava com'e': misurato sul progetto di prova, proponeva
// **0,4218 kg** di amido di mais e **5,79 mazzo** di basilico.
//
// Nessuno pesa a un decimo di grammo, e nessuno conta 5,79 mazzi. Il numero
// giusto in teoria costringe a cancellare cifre prima di scrivere — con una
// mano sul telefono e una sulla merce, e' un ostacolo, non una precisione.
//
// ⚠️ E LE UNITA' NON SI COMPORTANO UGUALE: chili e litri si pesano, quindi
// due decimali sono la precisione di una bilancia da cucina; pezzi e mazzi
// **si contano**, e un mezzo mazzo non esiste — li' i decimali non sono
// imprecisi, sono senza senso.
//
// ⚠️ SI ARROTONDA SOLO CIO' CHE SI PROPONE, mai cio' che si registra: la
// giacenza vera resta quella che Alessio scrive, e il gestionale continua
// a calcolare al grammo. Questo numero e' un punto di partenza da
// correggere, non un dato.
//
// Le unita' sono quattro, misurate in produzione: kg, l, mazzo, pz.
const SI_CONTANO = new Set(["pz", "mazzo"]);

export function propostaLeggibile(valore, unita) {
  // ⚠️ Il vuoto si controlla PRIMA di convertire: `Number(null)` non è un
  // errore, è **zero** — quindi un valore mancante sarebbe diventato «0»,
  // che davanti allo scaffale si legge «non ce n'è». Preso da una prova,
  // non da una rilettura.
  if (valore === null || valore === undefined || valore === "") return "";
  const n = Number(valore);
  if (!Number.isFinite(n)) return "";
  // ⚠️ Un pezzo e mezzo non esiste, ma nemmeno «zero pezzi» quando ce n'e'
  // un po': si arrotonda al piu' vicino, e sotto l'unita' si dice zero —
  // che e' la verita' («non ce n'e' abbastanza per un pezzo intero»).
  if (SI_CONTANO.has(unita)) return String(Math.round(n));
  // Chili e litri: due decimali, e senza zeri inutili in coda. 0,4218
  // diventa 0,42; 3,00 diventa 3.
  return String(Math.round(n * 100) / 100);
}
