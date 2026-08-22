// I TURNI DEI PASTI — modulo PURO, senza alcun import.
//
// 🔴 IL TURNO NON SI DEDUCE MAI DALLA CATEGORIA DEL PIATTO (Alessio,
// 21/08/2026). Nel suo primo turno ci sono **due antipasti e una pasta**: i
// turni li compone lui, secondo come vuole far mangiare quel tavolo. Una
// regola che li ricavasse dalla portata sbaglierebbe **in silenzio** — e
// sembrerebbe giusta a chi non era al tavolo. Qui dentro non c'è nessuna
// riga che guardi la categoria: il turno è un dato della riga e basta.
//
// ⚠️ E STA QUI, PURO, per la ragione di sempre: quello che decide come si
// raggruppano i fogli della cucina si deve poter provare senza un browser e
// senza chiavi. La schermata chiama queste funzioni, non le riscrive.

/** «1° turno», «2° turno», … */
export function etichettaTurno(n) {
  return `${Number(n) || 1}° turno`;
}

/**
 * Le righe di una comanda divise per turno, in ordine.
 *
 * ⚠️ I turni si mostrano solo quando sono PIÙ DI UNO: su una comanda che
 * esce tutta insieme — il caso normale prima del 21/08 — una riga di stacco
 * «1° turno» sarebbe una parola in più che non separa niente.
 */
export function righePerTurno(righe = []) {
  const per = new Map();
  for (const r of righe) {
    const t = Number(r?.turno) || 1;
    if (!per.has(t)) per.set(t, []);
    per.get(t).push(r);
  }
  return [...per.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([turno, items]) => ({ turno, items }));
}

/**
 * I fogli che la cucina deve stampare.
 *
 * 🔴 UN FOGLIO PER STAMPA, COI TURNI SEPARATI DENTRO (22/08/2026).
 *
 * ⚠️ «PER STAMPA», NON «PER INVIO» — è una correzione misurata, non una
 * sfumatura: la chiave di ciò che deve ancora uscire è **il solo conto**,
 * senza `sent_at`. Quindi due invii diversi che la cucina non ha ancora
 * stampato escono **su un foglio solo** (provato: due righe con istanti di
 * invio diversi → un foglio). Ed è la cosa giusta — finché la carta non è
 * uscita, ciò che la cucina non ha mai visto sta comodo insieme. *La
 * prima stesura di questo commento diceva «per invio», e descriveva una
 * regola che questo codice non ha: era già una frase falsa il giorno che
 * è stata scritta.*
 *
 * Il 21/08 questa funzione faceva **un foglio per turno**, e non era quello
 * che Alessio aveva chiesto: le sue parole erano *«io ho già la comanda
 * completa e vedrò cosa devo ancora cucinare per quel tavolo»* — cioè un
 * foglio solo, con dentro le righe di stacco. Tre fogli lo obbligherebbero
 * a tenere in mano tre pezzi di carta per un tavolo.
 *
 * ⚠️ E IL DIFETTO DI PARTENZA RESTA CHIUSO, che è il punto delicato: il
 * problema del 21/08 non era il foglio unico — era che i turni **non si
 * vedevano**. Ora si vedono, con la stessa banda della schermata. *Un
 * foglio solo con dentro le divisioni non è la stessa cosa di un foglio
 * solo senza.*
 *
 * ⚠️ L'AGGIUNTA RESTA UN FOGLIO A PARTE, e non è un'eccezione: è **roba
 * che la cucina non ha mai visto**, arrivata dopo che quel turno era già
 * uscito. Rimetterla dentro un foglio ristampato farebbe ricucinare i
 * piatti già fatti; lasciarla senza il suo turno la renderebbe
 * indistinguibile da un turno nuovo.
 *
 * ⚠️ E LE RIGHE GIÀ USCITE SI RAGGRUPPANO PER `prepared_at`, non per
 * invio: è **la firma del foglio con cui sono uscite**, quindi una
 * ristampa riproduce esattamente la carta di prima. Riordinarle per
 * qualunque altra cosa darebbe una ristampa diversa dall'originale.
 *
 * @param righe    le righe inviate del reparto, con `turno`, `sent_at`, `prepared_at`
 * @param chiamate i biglietti «avanti col prossimo turno»
 */
export function bigliettiCucina(righe = [], chiamate = []) {
  // Di quali turni, per ogni conto, è già uscito qualcosa: serve a
  // riconoscere le aggiunte.
  const giaUsciti = new Set();
  for (const r of righe) {
    if (r?.prepared_at) giaUsciti.add(`${r.order_id}__${Number(r.turno) || 1}`);
  }

  const gruppi = new Map();
  for (const r of righe) {
    const turno = Number(r?.turno) || 1;
    const uscito = Boolean(r?.prepared_at);
    const aggiunta = !uscito && giaUsciti.has(`${r.order_id}__${turno}`);
    const chiave = uscito
      ? `${r.order_id}__uscito__${r.prepared_at}`
      : aggiunta
        ? `${r.order_id}__aggiunta__${turno}`
        : `${r.order_id}__da_stampare`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave,
        tipo: "comanda",
        orderId: r.order_id,
        tavolo: r.order?.table_label ?? "—",
        notaTavolo: r.order?.note ?? null,
        stampato: uscito,
        aggiunta,
        // ⚠️ Solo il foglio dell'aggiunta ha UN turno; gli altri ne hanno
        // dentro quanti ne servono, ed è tutto il senso di questa versione.
        turno: aggiunta ? turno : null,
        quando: r.sent_at,
        items: [],
      });
    }
    const g = gruppi.get(chiave);
    g.items.push(r);
    // Il foglio porta l'ora del PRIMO piatto che contiene.
    if (r.sent_at && (!g.quando || new Date(r.sent_at) < new Date(g.quando))) g.quando = r.sent_at;
  }

  const fogli = [...gruppi.values()].map((g) => ({ ...g, turni: righePerTurno(g.items) }));

  for (const c of chiamate) {
    fogli.push({
      chiave: `chiamata__${c.id}`,
      tipo: "chiamata",
      id: c.id,
      orderId: c.order_id,
      tavolo: c.order?.table_label ?? "—",
      quando: c.creata_il,
      stampato: Boolean(c.stampata_il),
      items: [],
      turni: [],
    });
  }

  return fogli.sort((a, b) => new Date(a.quando) - new Date(b.quando));
}
