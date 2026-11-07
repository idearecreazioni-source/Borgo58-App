// IL PIANO DELL'INVESTIMENTO — LE REGOLE DEL CARICAMENTO (07/11/2026).
//
// Funzioni pure, senza rete e senza disco: le usa `piano-carica.mjs` e le
// prova `tests/unita/piano-carica.test.js`.
//
// 🔴 UN FILE VERO NON VA SU PROVA, UN FILE FINTO NON VA SU WORK. Il file dei
//    dati veri (il foglio di Alessio del 21/05, corretto con lui il 07/11)
//    sta FUORI dal repository; quello finto per Prova sta in
//    `scripts/dati/piano-finto.json` e dice di sé `"finto": true`. Il
//    caricamento pretende che i due combacino col posto dove scrive.
//
// 🔴 SI CARICA SOLO SU UN PIANO VUOTO: è il punto di partenza, non un
//    aggiornamento. Se il piano ha già una voce (anche archiviata), il
//    caricamento si rifiuta — dentro la stessa transazione, così due lanci
//    insieme non caricano due volte.

const GRUPPI = ["A", "B", "C", "D", "E"];
const ALIQUOTE = [0, 4, 5, 10, 22];
const STATI = ["stimato", "preventivato", "confermato"];
const DILAZIONI = ["nessuna", "stimata", "confermata"];
const ULTIMO_MESE = 12;

const cent = (n) => Math.round(Number(n) * 100);
const LUNGHEZZA_NOME = 120;
const LUNGHEZZA_NOTA = 500;

/**
 * Un testo che può entrare nella SQL: una stringa, senza «$» né «\»
 * (chiuderebbero il blocco o diventerebbero comandi di psql), senza
 * caratteri di controllo, entro la lunghezza. Revisione di sicurezza
 * ecc:security-reviewer del 07/11. Restituisce il problema, o null.
 */
export function problemaDelTesto(valore, massimo) {
  if (typeof valore !== "string") return "non è un testo";
  if (/[$\\]/.test(valore)) return "contiene «$» o «\\», che non sono ammessi";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(valore)) return "contiene caratteri di controllo";
  if (valore.length > massimo) return `è più lungo di ${massimo} caratteri`;
  return null;
}

/**
 * Cosa non va nel file, in italiano. Un elenco vuoto vuol dire «va bene».
 * @param dati  il contenuto del file JSON
 * @param dove  "work" oppure "prova"
 */
export function problemiDelPiano(dati, dove) {
  const p = [];
  if (!dati || typeof dati !== "object") return ["Il file non è un piano: manca tutto."];
  if (dove === "prova" && dati.finto !== true) {
    p.push("Su Prova si caricano solo dati finti: questo file non dice \"finto\": true.");
  }
  if (dove === "work" && dati.finto === true) {
    p.push("Questo è il file finto per Prova: su work non si carica.");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(String(dati.mese_apertura ?? ""))) {
    p.push(`Il mese dell'apertura deve essere il primo del mese (per esempio 2027-04-01), non «${dati.mese_apertura}».`);
  }
  const voci = Array.isArray(dati.voci) ? dati.voci : [];
  if (voci.length === 0) p.push("Il file non ha nessuna voce.");
  const nomi = new Set();
  voci.forEach((v, i) => {
    const chi = `Voce ${i + 1} («${v?.descrizione ?? "senza nome"}»)`;
    const nome = typeof v?.descrizione === "string" ? v.descrizione.trim() : "";
    const malNome = problemaDelTesto(v?.descrizione, LUNGHEZZA_NOME);
    if (malNome) p.push(`${chi}: il nome ${malNome}.`);
    else if (!nome) p.push(`${chi}: manca il nome.`);
    if (v?.nota !== undefined && v?.nota !== null) {
      const malNota = problemaDelTesto(v.nota, LUNGHEZZA_NOTA);
      if (malNota) p.push(`${chi}: la nota ${malNota}.`);
    }
    if (v?.ordine !== undefined && !Number.isInteger(v.ordine)) p.push(`${chi}: l'ordine deve essere un numero intero.`);
    if (nomi.has(nome.toLowerCase())) p.push(`${chi}: c'è già un'altra voce con lo stesso nome.`);
    nomi.add(nome.toLowerCase());
    if (!GRUPPI.includes(v?.gruppo)) p.push(`${chi}: il gruppo «${v?.gruppo}» non è fra A, B, C, D, E.`);
    if (typeof v?.importo_ivato !== "number" || !Number.isFinite(v.importo_ivato) || v.importo_ivato < 0) p.push(`${chi}: l'importo non è un numero valido.`);
    if (typeof v?.aliquota_iva !== "number" || !ALIQUOTE.includes(v.aliquota_iva)) p.push(`${chi}: l'IVA «${v?.aliquota_iva}» non è 0, 4, 5, 10 o 22.`);
    if (!STATI.includes(v?.stato)) p.push(`${chi}: lo stato «${v?.stato}» non è stimato, preventivato o confermato.`);
    if (!DILAZIONI.includes(v?.dilazione)) p.push(`${chi}: la dilazione «${v?.dilazione}» non è nessuna, stimata o confermata.`);
    const rate = Object.entries(v?.rate ?? {});
    let somma = 0;
    for (const [mese, importo] of rate) {
      const m = Number(mese);
      if (!Number.isInteger(m) || m < 0 || m > ULTIMO_MESE) p.push(`${chi}: il mese «${mese}» è fuori dal piano (0 = acconto, poi 1–12).`);
      if (typeof importo !== "number" || !Number.isFinite(importo) || importo <= 0) p.push(`${chi}: la rata del mese ${mese} deve essere più di zero.`);
      somma += cent(importo);
    }
    if (Number.isFinite(Number(v?.importo_ivato)) && somma !== cent(v.importo_ivato)) {
      p.push(`${chi}: le rate fanno ${(somma / 100).toFixed(2)} €, la voce ${Number(v.importo_ivato).toFixed(2)} €.`);
    }
  });
  return p;
}

/** Il riepilogo da mostrare prima di caricare: voci, totali per gruppo e per mese. */
export function riepilogoDelPiano(dati) {
  const perGruppo = {};
  const perMese = {};
  let totale = 0;
  for (const v of dati.voci) {
    totale += cent(v.importo_ivato);
    perGruppo[v.gruppo] = (perGruppo[v.gruppo] ?? 0) + cent(v.importo_ivato);
    for (const [m, i] of Object.entries(v.rate ?? {})) perMese[m] = (perMese[m] ?? 0) + cent(i);
  }
  const euro = (c) => c / 100;
  return {
    voci: dati.voci.length,
    rate: dati.voci.reduce((n, v) => n + Object.keys(v.rate ?? {}).length, 0),
    totale: euro(totale),
    perGruppo: Object.fromEntries(Object.entries(perGruppo).sort().map(([k, c]) => [k, euro(c)])),
    perMese: Object.fromEntries(Object.entries(perMese).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, c]) => [k, euro(c)])),
  };
}

const testo = (s) => `'${String(s).replace(/'/g, "''")}'`;
const numero = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);

/**
 * La SQL che carica il piano, in una transazione sola (la si lancia con
 * `psql --single-transaction`). Rifiuta se il piano non è vuoto, e alla
 * fine verifica di aver scritto esattamente quello che doveva.
 * ⚠️ Pretende che `problemiDelPiano` non abbia trovato niente.
 */
export function sqlDelPiano(dati, dove) {
  // Si difende da sola: anche chiamata senza il controllo, non scrive SQL
  // con un file che non lo passa.
  const problemi = problemiDelPiano(dati, dove);
  if (problemi.length > 0) throw new Error(`Il piano non passa i controlli: ${problemi[0]}`);
  const r = riepilogoDelPiano(dati);
  const righe = [];
  // 🔴 IL BLOCCO SI PRENDE LE TRE TABELLE PRIMA DI GUARDARE: due lanci
  //    insieme, o una voce scritta dall'app nello stesso momento, aspettano
  //    invece di passare il controllo «piano vuoto» tutti e due.
  righe.push("lock table piano_impostazioni, piano_voci, piano_rate in share row exclusive mode;");
  righe.push("do $carica$");
  righe.push("declare v uuid;");
  righe.push("begin");
  righe.push("  if exists (select 1 from piano_voci) then");
  righe.push("    raise exception 'Il piano ha già delle voci: il punto di partenza si carica solo su un piano vuoto. Non ho scritto niente.';");
  righe.push("  end if;");
  righe.push(`  update piano_impostazioni set mese_apertura = ${testo(dati.mese_apertura)}::date, aggiornato_il = now() where id;`);
  righe.push("  if not found then raise exception 'Manca la riga della data di apertura del piano: è stata applicata la migrazione 20261107000001? Non ho scritto niente.'; end if;");
  for (const v of dati.voci) {
    righe.push(
      `  insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato, dilazione, nota) values (` +
        [testo(v.gruppo), Number(v.ordine ?? 0), testo(String(v.descrizione).trim()), numero(v.importo_ivato), numero(v.aliquota_iva), testo(v.stato), testo(v.dilazione), v.nota ? testo(v.nota) : "null"].join(", ") +
        `) returning id into v;`
    );
    for (const [m, i] of Object.entries(v.rate ?? {})) {
      righe.push(`  insert into piano_rate (voce_id, mese_rel, importo) values (v, ${Number(m)}, ${numero(i)});`);
    }
  }
  righe.push(`  if (select count(*) from piano_voci) <> ${r.voci}`);
  righe.push(`     or (select count(*) from piano_rate) <> ${r.rate}`);
  righe.push(`     or (select sum(importo_ivato) from piano_voci) <> ${numero(r.totale)}`);
  righe.push(`     or (select sum(importo) from piano_rate) <> ${numero(r.totale)}`);
  righe.push(`     or (select mese_apertura from piano_impostazioni) <> ${testo(dati.mese_apertura)}::date then`);
  righe.push("    raise exception 'VERIFICA: dopo il caricamento i conti del piano non tornano. Non ho scritto niente.';");
  righe.push("  end if;");
  righe.push(`  raise notice 'Fatto: caricate ${r.voci} voci e ${r.rate} rate, ${numero(r.totale)} € IVA inclusa.';`);
  righe.push("end $carica$;");
  return righe.join("\n") + "\n";
}
