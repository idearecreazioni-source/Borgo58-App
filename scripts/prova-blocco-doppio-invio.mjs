// LA PROVA VERA DEL BLOCCO DEL DOPPIO INVIO — `npm run prova:blocco`
//
// Perche' esiste (24/11/2026, revisione dell'11/11 punto 8). `registra_restituzione_prestito` (come il rimborso di un anticipo
// e la caparra) leggeva la riga PRIMA che un altro invio avesse scritto: due restituzioni insieme superavano il prestito. La
// cura e' bloccare la riga mentre si controlla (`for update`). Una prova che passa anche senza il blocco non vale niente (la
// prima versione, via corridoio HTTP, era cosi'): qui si tengono APERTE due transazioni vere, una dentro l'altra nel tempo.
//
//   Sessione A: restituisce TUTTO il prestito (700), poi tiene la transazione aperta 5 secondi, poi chiude.
//   Sessione B: parte 1,5 secondi dopo e prova a restituire anche lei i 700.
//
//   SENZA il blocco B non vede la restituzione di A (ancora aperta): legge «residuo 700» e restituisce anche lei → i soldi
//   restituiti sono 1.400 su un prestito da 700. CON il blocco B ASPETTA che A chiuda, poi rilegge: residuo zero → rifiutata.
//
// Il programma fa tutte e due le cose: prima TOGLIE il blocco dalla funzione (su Prova) e pretende che il doppio invio
// riesca (altrimenti la prova non discrimina e si ferma), poi RIMETTE il blocco e pretende che il secondo invio sia
// rifiutato. Alla fine rimette la funzione com'era, toglie le righe di prova e chiude tutto.
//
// ⚠️ SOLO PROVA (`soloProva`): tocca una funzione e crea righe finte. Mai la produzione.
// ⚠️ Non usare mentre girano i Controlli su Prova: la funzione cambia per qualche secondo.

import { spawn } from "node:child_process";
import {
  esegui,
  fermati,
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  titolo,
} from "./comune.mjs";

const FIRMA = "ZZ-BLOCCO prova";
const FUNZIONE = "public.registra_restituzione_prestito(uuid, numeric, text, date, text)";
const CON = "select * into v_p from prestiti_privati where id = p_prestito_id for update;";
const SENZA = "select * into v_p from prestiti_privati where id = p_prestito_id;";

const cfg = leggiConfigurazione();
const url = obbligatorio(cfg, "DB_URL_PROVA", "Serve il progetto di prova. Vedi docs/AMBIENTE_PROVA.md.");
soloProva(url);
const psql = strumento("psql");

function sql(testo) {
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-A", "-t", "-d", url, "-c", testo], { silenzioso: true });
  if (!r.ok) throw new Error("Il progetto di prova ha rifiutato: " + r.uscita.trim().slice(0, 400));
  return r.uscita.trim();
}

// Una sessione che gira in parallelo: restituisce { ok, uscita, ms }.
function sessione(testo) {
  return new Promise((risolvi) => {
    const inizio = Date.now();
    const p = spawn(psql, ["-v", "ON_ERROR_STOP=1", "-A", "-t", "-d", url, "-c", testo], { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let uscita = "";
    p.stdout.on("data", (d) => (uscita += d));
    p.stderr.on("data", (d) => (uscita += d));
    p.on("close", (codice) => risolvi({ ok: codice === 0, uscita: uscita.trim(), ms: Date.now() - inizio }));
  });
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function mettiBlocco(si) {
  // Si cambia il corpo VIVO in un punto solo, controllato (deve comparire una volta sola).
  const da = si ? SENZA : CON;
  const a = si ? CON : SENZA;
  sql(`do $x$ declare d text; n integer; begin
         d := pg_get_functiondef('${FUNZIONE}'::regprocedure);
         n := (length(d) - length(replace(d, '${da}', ''))) / length('${da}');
         if n = 1 then execute replace(d, '${da}', '${a}');
         elsif position('${a}' in d) = 0 then raise exception 'La funzione non ha la riga attesa (%).', n; end if;
       end $x$;`);
}

function ripulisci() {
  sql(`do $x$ begin
         delete from cash_movements where prestito_id in (select id from prestiti_privati where da_chi like '${FIRMA}%');
         delete from restituzioni_prestito where prestito_id in (select id from prestiti_privati where da_chi like '${FIRMA}%');
         delete from prestiti_privati where da_chi like '${FIRMA}%';
         delete from deleted_records where record::text like '%${FIRMA}%';
       end $x$;`);
}

async function giro(conBlocco) {
  mettiBlocco(conBlocco);
  ripulisci();
  const titolare = sql("select user_id from user_roles where role = 'titolare' limit 1;");
  const ente = sql("select id from entities where entity_type = 'srls' limit 1;");
  const claims = `select set_config('request.jwt.claims', '{"sub":"${titolare}","role":"authenticated"}', false);`;
  sql(`${claims} select registra_prestito_privato('${ente}', '${FIRMA}', 700, 'cassa', date '1992-03-01', null);`);
  const prestito = sql(`select id from prestiti_privati where da_chi = '${FIRMA}';`);
  const restituisci = `select registra_restituzione_prestito('${prestito}', 700, 'cassa', date '1992-05-01', null);`;

  const A = sessione(`begin; ${claims} ${restituisci} select pg_sleep(5); commit;`);
  await attendi(1500);
  const B = sessione(`${claims} ${restituisci}`);
  const [a, b] = await Promise.all([A, B]);
  const righe = Number(sql(`select count(*) from restituzioni_prestito where prestito_id = '${prestito}';`));
  const totale = Number(sql(`select coalesce(sum(importo), 0) from restituzioni_prestito where prestito_id = '${prestito}';`));
  ripulisci();
  return { a, b, righe, totale };
}

titolo("La prova vera del blocco: due sessioni, una transazione tenuta aperta");
let fatto = false;
try {
  console.log("\n1) SENZA il blocco (la prova deve far vedere il difetto):");
  const senza = await giro(false);
  console.log(`   A: ${senza.a.ok ? "entrata" : "rifiutata"} · B: ${senza.b.ok ? "ENTRATA" : "rifiutata"} (${senza.b.ms} ms) · restituzioni scritte: ${senza.righe} · totale: ${senza.totale} su 700`);
  if (!(senza.a.ok && senza.b.ok && senza.totale === 1400)) {
    throw new Error("La prova NON discrimina: senza il blocco il doppio invio doveva riuscire (1.400 su 700) e non e' successo. Una prova che passa anche senza il blocco non dimostra niente: non la considero valida.");
  }

  console.log("\n2) CON il blocco (il secondo invio deve aspettare e poi essere rifiutato):");
  const con = await giro(true);
  console.log(`   A: ${con.a.ok ? "entrata" : "rifiutata"} · B: ${con.b.ok ? "ENTRATA" : "rifiutata"} dopo ${con.b.ms} ms · restituzioni scritte: ${con.righe} · totale: ${con.totale} su 700`);
  if (!(con.a.ok && !con.b.ok && con.totale === 700 && con.b.ms >= 3000)) {
    throw new Error(`Col blocco il secondo invio doveva ASPETTARE (almeno 3 secondi) e poi essere rifiutato, con 700 restituiti in tutto. Visto: B ${con.b.ok ? "entrata" : "rifiutata"} dopo ${con.b.ms} ms, totale ${con.totale}.`);
  }
  console.log("\nProva vera riuscita: senza il blocco escono 1.400 euro su un prestito da 700; col blocco ne escono 700.");
  fatto = true;
} catch (e) {
  console.error("\nPROVA NON RIUSCITA:", e.message);
} finally {
  // Qualunque cosa sia successa: il blocco torna al suo posto e le righe finte spariscono.
  try { mettiBlocco(true); } catch (e) { console.error("ATTENZIONE: non sono riuscito a rimettere il blocco:", e.message); }
  try { ripulisci(); } catch (e) { console.error("ATTENZIONE: righe di prova da togliere a mano:", e.message); }
}
if (!fatto) process.exit(1);
