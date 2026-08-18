import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import {
  TOLLERANZA_CONTATTO_CM,
  agganciaAiVicini,
  misureSagoma,
  raggioAggancioCm,
} from "../../src/lib/calcoli/sala";
import { getCopertiDelGiorno, getPiantaDelGiorno } from "../../src/lib/api/sala";

// IL MAGNETE E IL CONTEGGIO DEVONO DIRE LA STESSA COSA (18/08, giro E).
//
// ⚠️ PERCHE' NON BASTA CHE IL TOTALE SIA ANCORA 34. Un totale uguale può
// nascondere due gruppi diversi che si compensano: due tavoli che si
// staccano e due che si uniscono danno lo stesso numero e una sala
// diversa. Quindi qui si guardano i GRUPPI, non la somma.
//
// La proprietà, e vale su QUALUNQUE sala perché non nomina nessun tavolo:
//
//   fermi dove sono, i tavoli non si muovono e non si uniscono a nessuno
//   che il database non consideri già unito.
//
// Cioè: prendendo ogni sagoma e «rilasciandola dov'è già», il magnete
// deve restituire la stessa posizione, e i contatti che dichiara devono
// ricostruire ESATTAMENTE i tavoloni che conta il database. Se il
// magnete fosse più largo del conto — un raggio più generoso, o senza la
// soglia di sovrapposizione — la sala cambierebbe numero al primo
// trascinamento, su dati veri.
//
// ⚠️ Il caso che questa prova prende, e che a leggere il codice non si
// vede: nella sala vera T5-T8 e T6-T7 stanno a distanza ZERO su un asse
// ma senza sovrapporsi per niente, e il conto correttamente NON li
// considera accostati. E' il tranello naturale del magnete.

// Una data senza scostamenti: la pianta base, quella che vale sempre.
const GIORNO = "1992-05-04";
// La scala del disegno sul telefono di Alessio: la pianta in piedi
// larga 358 punti mostra 1030 cm di sala.
const CM_PER_PUNTO = 1030 / 358;
const PXCM = 37.79528;

let entrato = false;

// I gruppi che nascono dai contatti dichiarati dal magnete.
function componenti(nodi, archi) {
  const capo = new Map(nodi.map((n) => [n, n]));
  const radice = (a) => (capo.get(a) === a ? a : radice(capo.get(a)));
  for (const [a, b] of archi) capo.set(radice(a), radice(b));
  const gruppi = new Map();
  for (const n of nodi) {
    const r = radice(n);
    gruppi.set(r, [...(gruppi.get(r) ?? []), n]);
  }
  return [...gruppi.values()].map((g) => g.sort().join("+")).sort();
}

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  entrato = true;
});

afterAll(async () => {
  if (entrato) await supabase.auth.signOut({ scope: "local" });
});

describe("Il magnete sulla sala vera", () => {
  it("non muove niente e non unisce niente che il conteggio non unisca già", async () => {
    const pianta = await getPiantaDelGiorno(GIORNO);
    const gruppiVeri = await getCopertiDelGiorno(GIORNO);
    const tavoli = pianta.filter((s) => s.tipo === "tavolo");

    // ⚠️ Condizione dichiarata invece che dedotta: su una sala vuota o
    // tutta staccata questa prova passerebbe senza aver provato niente.
    // Serve che ci sia almeno un tavolone da riconoscere.
    expect(tavoli.length).toBeGreaterThan(2);
    expect(gruppiVeri.some((g) => (g.tavoli ?? []).length > 1)).toBe(true);

    const scatole = tavoli.map((s) => ({
      id: s.id,
      formato_id: s.formato_id,
      x: s.x,
      y: s.y,
      ...misureSagoma(s),
    }));
    const raggio = raggioAggancioCm(CM_PER_PUNTO, PXCM);
    const archi = [];
    for (const s of scatole) {
      const preso = agganciaAiVicini({
        sagoma: s,
        vicini: scatole,
        x: s.x,
        y: s.y,
        raggioCm: raggio,
        limiti: null,
      });
      // Fermo dov'è, il magnete non lo deve spostare di un centimetro.
      expect([preso.x, preso.y], `${s.id} si è mosso da solo`).toEqual([s.x, s.y]);
      for (const altro of preso.agganci) archi.push([s.id, altro]);
    }

    const daMagnete = componenti(
      scatole.map((s) => s.id),
      archi
    );
    const daDatabase = gruppiVeri.map((g) => [...(g.tavoli ?? [])].sort().join("+")).sort();
    expect(daMagnete).toEqual(daDatabase);
  });

  it("e non arriva abbastanza lontano da inventarne uno", async () => {
    // ⚠️ QUESTA PROVA ESISTE PERCHE' QUELLA SOPRA HA UN BUCO, trovato
    // rompendo il magnete apposta invece di rileggerlo: allargandone il
    // raggio di dieci volte, la prova sopra restava VERDE. Il motivo e'
    // che un tavolo gia' attaccato a un vicino e' ancorato — l'aggancio a
    // distanza zero vince su qualunque altro, quindi non si muove e i
    // gruppi non cambiano. Il difetto ci sarebbe eccome: si vedrebbe al
    // primo trascinamento, cioe' quando nessuna prova sta guardando.
    //
    // La proprieta' che lo prende: nella sala vera, ogni coppia che il
    // conteggio tiene SEPARATA e che potrebbe unirsi (stesso formato,
    // lati che si sovrappongono abbastanza) deve stare piu' lontana del
    // raggio del magnete. Non e' un numero fotografato: e' la distanza di
    // sicurezza fra cio' che il dito puo' afferrare e cio' che il conto
    // considera due tavoli.
    const pianta = await getPiantaDelGiorno(GIORNO);
    const gruppiVeri = await getCopertiDelGiorno(GIORNO);
    const scatole = pianta
      .filter((s) => s.tipo === "tavolo")
      .map((s) => ({ id: s.id, formato_id: s.formato_id, x: s.x, y: s.y, ...misureSagoma(s) }));
    const insieme = new Map();
    for (const g of gruppiVeri) for (const id of g.tavoli ?? []) insieme.set(id, g.tavoli.join("+"));
    const raggio = raggioAggancioCm(CM_PER_PUNTO, PXCM);

    let coppieGuardate = 0;
    for (const a of scatole) {
      for (const b of scatole) {
        if (a.id >= b.id) continue;
        if (a.formato_id !== b.formato_id) continue;
        if (insieme.get(a.id) === insieme.get(b.id)) continue;
        const sovrY = Math.min(a.y + a.profondita, b.y + b.profondita) - Math.max(a.y, b.y);
        const sovrX = Math.min(a.x + a.larghezza, b.x + b.larghezza) - Math.max(a.x, b.x);
        const distX = Math.max(b.x - (a.x + a.larghezza), a.x - (b.x + b.larghezza));
        const distY = Math.max(b.y - (a.y + a.profondita), a.y - (b.y + b.profondita));
        // Si guardano solo le coppie che il magnete POTREBBE unire: quelle
        // che si sfiorano di spigolo non le unisce comunque.
        if (sovrY >= 30 && distX >= 0) {
          coppieGuardate++;
          expect(distX, "due tavoli separati stanno dentro il raggio del magnete").toBeGreaterThan(raggio);
        }
        if (sovrX >= 30 && distY >= 0) {
          coppieGuardate++;
          expect(distY, "due tavoli separati stanno dentro il raggio del magnete").toBeGreaterThan(raggio);
        }
      }
    }
    // ⚠️ E se non ci fosse nessuna coppia da guardare, questa prova
    // passerebbe senza aver provato niente — il caso vuoto (17/08).
    expect(coppieGuardate).toBeGreaterThan(0);
  });

  it("e quando aggancia lascia i bordi dentro la tolleranza del conto", async () => {
    // ⚠️ La condizione che lega le due cose: se il magnete accostasse a
    // una distanza che il conteggio non riconosce, lo schermo direbbe
    // «attaccati» e il numero «separati». Le due misure vengono dallo
    // stesso file, e questa prova lo verifica sul comportamento — non
    // sulla posizione delle costanti.
    const pianta = await getPiantaDelGiorno(GIORNO);
    const tavoli = pianta
      .filter((s) => s.tipo === "tavolo")
      .map((s) => ({ id: s.id, formato_id: s.formato_id, x: s.x, y: s.y, ...misureSagoma(s) }));
    const quadrati = tavoli.filter((t) => t.larghezza === 90 && t.profondita === 90);
    expect(quadrati.length).toBeGreaterThan(1);

    // Si porta il primo quadrato vicino al secondo, staccato di 20 cm:
    // dentro il raggio del dito (misurato: circa 22 cm di sala sul
    // telefono), fuori dalla tolleranza del conto, che e di 5.
    const bersaglio = quadrati[1];
    const preso = agganciaAiVicini({
      sagoma: quadrati[0],
      vicini: tavoli,
      x: bersaglio.x + bersaglio.larghezza + 20,
      y: bersaglio.y,
      raggioCm: raggioAggancioCm(CM_PER_PUNTO, PXCM),
      limiti: null,
    });
    expect(preso.agganci).toContain(bersaglio.id);
    const distanza = Math.abs(preso.x - (bersaglio.x + bersaglio.larghezza));
    expect(distanza).toBeLessThanOrEqual(TOLLERANZA_CONTATTO_CM);
    // E non «quasi»: zero. La tolleranza è lì per assorbire un
    // arrotondamento, non per accostare tavoli lontani.
    expect(distanza).toBe(0);
  });
});
