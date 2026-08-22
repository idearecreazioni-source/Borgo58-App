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
 * 🔴 SI RAGGRUPPA PER TURNO, NON PER INVIO — ed è tutto il lavoro. Fino al
 * 21/08 la chiave era `order_id + sent_at`, cioè l'invio: ma `sendDraftItems`
 * scrive **un solo istante su tutte le righe** che partono insieme, quindi
 * una comanda segnata tutta e mandata una volta usciva come **un foglio
 * solo**. Il difetto si vedeva anche al contrario: un piatto aggiunto dopo,
 * ma dello stesso turno, faceva un secondo foglio.
 *
 * ⚠️ E LE RIGHE GIÀ USCITE NON RIENTRANO NEL FOGLIO NUOVO. Un piatto del 2°
 * turno aggiunto dopo che il 2° turno è già stato stampato fa un foglio
 * **suo**, con dentro solo lui: rimettere anche le righe vecchie farebbe
 * ricucinare roba già fatta. È il caso che Alessio ha accettato il 21/08 —
 * *la cucina lo legge come un'aggiunta a quel turno.*
 *
 * ⚠️ PER QUESTO IL FOGLIO PORTA SEMPRE IL TURNO, e dice «aggiunta» quando di
 * quel turno era già uscito qualcosa: senza, chi cucina non sa se ha in mano
 * roba nuova o roba già fatta. È l'unica cosa in più che quel secondo foglio
 * deve avere.
 *
 * @param righe    le righe inviate del reparto, con `turno`, `sent_at`, `prepared_at`
 * @param chiamate i biglietti «avanti col prossimo turno»
 */
export function bigliettiCucina(righe = [], chiamate = []) {
  const gruppi = new Map();

  for (const r of righe) {
    const turno = Number(r?.turno) || 1;
    const uscito = Boolean(r?.prepared_at);
    const chiave = `${r.order_id}__${turno}__${uscito ? "uscito" : "da_stampare"}`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave,
        tipo: "comanda",
        orderId: r.order_id,
        tavolo: r.order?.table_label ?? "—",
        notaTavolo: r.order?.note ?? null,
        turno,
        stampato: uscito,
        quando: r.sent_at,
        aggiunta: false,
        items: [],
      });
    }
    const g = gruppi.get(chiave);
    g.items.push(r);
    // Il foglio porta l'ora del PRIMO piatto che contiene.
    if (r.sent_at && (!g.quando || new Date(r.sent_at) < new Date(g.quando))) g.quando = r.sent_at;
  }

  // «Aggiunta»: di questo turno, su questo tavolo, era già uscito qualcosa.
  for (const g of gruppi.values()) {
    if (g.stampato) continue;
    g.aggiunta = righe.some(
      (r) => r.order_id === g.orderId && (Number(r.turno) || 1) === g.turno && r.prepared_at
    );
  }

  const fogli = [...gruppi.values()];

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
    });
  }

  return fogli.sort((a, b) => new Date(a.quando) - new Date(b.quando));
}
