// =====================================================================
// L'ESECUTORE PROTETTO DEL PREFLIGHT DI PRODUZIONE
// 01/10/2026 · mandato M21-E — SCRITTO E PROVATO, MAI ESEGUITO
// =====================================================================
// 🔴 PERCHE' ESISTE. Il modulo `preflight-produzione-sanitizzato.mjs`
//    decide PRONTO / NON PRONTO su 20 campi gia' ridotti a si'/no, numeri e
//    versioni. Qualcuno quei campi li deve misurare: questo file e' quel
//    qualcuno, per la parte che si puo' misurare dal database di
//    produzione in sola lettura. Una sua esecuzione richiede un mandato a
//    parte: in quello che lo ha scritto non e' mai stato lanciato.
//
// 🔴 COSA NON FA, apposta:
//    · non carica file di configurazione e non legge nessuna variabile
//      tranne una, il canale iniettato da chi lo esegue (NOME_CANALE);
//    · non ha valori predefiniti ne' ripieghi per il collegamento: se il
//      canale manca, si rifiuta;
//    · non stampa ne' restituisce il collegamento, i valori letti, le
//      interrogazioni o i messaggi d'errore del database: restituisce solo
//      PRONTO / NON PRONTO, i nomi dei controlli non validi, e — se si
//      rifiuta — un motivo scelto da un elenco fisso;
//    · non contiene interrogazioni che scrivono, e nessuna interrogazione ha
//      parti calcolate: sono tutte stringhe fisse.
//
// 🔴 COME LAVORA:
//    1. pretende i due consensi espliciti (--produzione e
//       --confermo-sola-lettura) e nient'altro;
//    2. guarda il canale SENZA collegarsi: deve nominare la produzione e
//       non il progetto di prova;
//    3. apre una transazione di SOLA LETTURA, e prima di OGNI interrogazione
//       ricontrolla che lo sia ancora: se non lo e', si ferma subito;
//    4. chiude SEMPRE con rollback, anche quando qualcosa va storto;
//    5. passa i 20 campi al modulo sanitizzato, che decide.
//
// ⚠️ CIO' CHE NON SI PUO' MISURARE DA QUI RESTA NON VERIFICATO, e il
//    risultato sara' NON PRONTO finche' un altro passo non lo misura:
//    master, Prova, copia di sicurezza, funzione online, corpi vivi
//    confrontati col repository, dati delle ricette, e i due giri
//    (che sono cio' che `npm run migra` in sola lettura elencherebbe).
//
// ⚠️ IL CAVO VERSO IL DATABASE (`creaClientPsql`) non e' mai stato provato
//    contro un database vero: le prove usano client finti. E' scritto con
//    lo stesso programma (psql) che il progetto usa gia' per le migrazioni.
// =====================================================================

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { valutaPreflight, ESITI, VERSIONI, ULTIMA_IN_PRODUZIONE } from "./preflight-produzione-sanitizzato.mjs";

/** L'unica variabile che l'esecutore legge. Nessun'altra, nessun ripiego. */
export const NOME_CANALE = "PREFLIGHT_PRODUZIONE_COLLEGAMENTO";

export const CONSENSI = Object.freeze(["--produzione", "--confermo-sola-lettura"]);

const RIF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";
const RIF_PROVA = "bnwqgpuyzmzujxfbtyvs";

/** I motivi di rifiuto: un elenco fisso, nessun valore dentro. */
export const MOTIVI = Object.freeze({
  CONSENSI: "consensi mancanti o argomenti inattesi",
  CANALE: "canale di collegamento non iniettato",
  DESTINAZIONE: "il canale non indica la produzione",
  SOLA_LETTURA: "la transazione non risulta in sola lettura",
  INTERROGAZIONE: "un'interrogazione non e' riuscita",
  RISPOSTA: "una risposta del database non ha la forma attesa",
});

// ---------------------------------------------------------------------
// LE INTERROGAZIONI — tutte stringhe fisse, tutte di sola lettura.
// ---------------------------------------------------------------------
export const APRI = "begin transaction read only;";
export const LEGGI_SOLA_LETTURA = "select current_setting('transaction_read_only');";
export const CHIUDI = "rollback;";

const LE_17 =
  "array['20260917000001','20260919000001','20260920000001','20260920000002'," +
  "'20260920000003','20260920000004','20260920000005','20260921000001'," +
  "'20260921000002','20260921000003','20260922000001','20260923000001'," +
  "'20260923000002','20260923000003','20260923000004','20260928000001'," +
  "'20260929000001']";

/**
 * Ogni misura: il campo del modulo sanitizzato che riempie, la forma della
 * risposta attesa, e l'interrogazione. Le risposte sono gia' ridotte: un
 * numero, «si»/«no», una versione o un elenco di versioni. Nessuna riga,
 * nessun valore del Vault esce mai dal database.
 */
export const MISURE = Object.freeze([
  {
    campo: "produzione_ultima_registrata",
    forma: "versione",
    sql: "select coalesce(max(version), '') from applied_migrations;",
  },
  {
    campo: "produzione_versioni_mancanti",
    forma: "versioni",
    sql:
      "select coalesce(string_agg(t.v, ',' order by t.v), '') from unnest(" + LE_17 + ") as t(v) " +
      "where not exists (select 1 from applied_migrations a where a.version = t.v);",
  },
  {
    // Le registrate DOPO l'ultima attesa che non sono fra le 17: e' la parte
    // della domanda «c'e' qualcosa di estraneo?» che si misura dal solo
    // database. Il confronto col repository intero non si fa da qui.
    campo: "produzione_versioni_estranee",
    forma: "conteggio",
    sql:
      "select count(*) from applied_migrations where version > '20260916000002' " +
      "and version <> all (" + LE_17 + ");",
  },
  {
    campo: "chiave_anon_presenti",
    forma: "conteggio",
    sql: "select count(*) from vault.secrets where name = 'chiave_anon';",
  },
  {
    // Lo stesso calcolo della 20260929000001, ridotto a si'/no: il valore
    // resta dentro il database.
    campo: "chiave_anon_del_progetto_atteso",
    forma: "si_no",
    sql:
      "select case when (select count(*) from vault.secrets where name = 'chiave_anon') <> 1 then 'no' " +
      "when (select (convert_from(decode(rpad(translate(split_part(decrypted_secret, '.', 2), '-_', '+/'), " +
      "((length(split_part(decrypted_secret, '.', 2)) + 3) / 4) * 4, '='), 'base64'), 'UTF8')::jsonb ->> 'ref') " +
      "from vault.decrypted_secrets where name = 'chiave_anon') = '" + RIF_PRODUZIONE + "' then 'si' else 'no' end;",
  },
  {
    campo: "url_funzioni_presenti",
    forma: "conteggio",
    sql: "select count(*) from vault.secrets where name = 'url_funzioni';",
  },
  {
    // Si confronta con l'indirizzo che la 20260929000001 scriverebbe, dentro
    // il database: esce solo si'/no. Con la voce assente la risposta e' «no».
    campo: "url_funzioni_corrisponde",
    forma: "si_no",
    sql:
      "select case when (select count(*) from vault.secrets where name = 'url_funzioni') <> 1 then 'no' " +
      "when (select rtrim(btrim(decrypted_secret), '/') from vault.decrypted_secrets where name = 'url_funzioni') " +
      "= 'https://' || '" + RIF_PRODUZIONE + "' || '.supabase.co/functions/v1' then 'si' else 'no' end;",
  },
  {
    // Le guardie che si possono controllare PRIMA di applicare: quelle della
    // 20260917000001 (corpo vivo del promemoria e colonne di pg_net) e della
    // 20260920000003. Le altre guardie dipendono da migrazioni dello stesso
    // rilascio, quindi oggi non si possono misurare.
    campo: "guardie_migrazioni_soddisfatte",
    forma: "si_no",
    sql:
      "select case when " +
      "(select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      " where n.nspname = 'public' and p.proname = 'send_due_task_reminders' and p.prokind = 'f') = 1 " +
      "and (select position('" + RIF_PRODUZIONE + "' in pg_get_functiondef(p.oid)) > 0 " +
      "  and position('reminder_sent_at = now()' in pg_get_functiondef(p.oid)) > 0 " +
      "  and position('invii_promemoria' in pg_get_functiondef(p.oid)) = 0 " +
      " from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      " where n.nspname = 'public' and p.proname = 'send_due_task_reminders' and p.prokind = 'f') " +
      "and (select count(*) from unnest(array['id','status_code','content','error_msg','created']) c " +
      " where not exists (select 1 from information_schema.columns k where k.table_schema = 'net' " +
      " and k.table_name = '_http_response' and k.column_name = c)) = 0 " +
      "and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      " where n.nspname = 'public' and p.proname = 'completa_task' and p.prokind = 'f') = 1 " +
      "and (select position('ricorrenza_unita' in pg_get_functiondef(p.oid)) > 0 " +
      "  and position('remind_at' in pg_get_functiondef(p.oid)) = 0 " +
      " from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      " where n.nspname = 'public' and p.proname = 'completa_task' and p.prokind = 'f') " +
      "then 'si' else 'no' end;",
  },
  {
    // Transazioni aperte da piu' di un minuto, esclusa questa.
    campo: "transazioni_lunghe",
    forma: "conteggio",
    sql:
      "select count(*) from pg_stat_activity where pid <> pg_backend_pid() " +
      "and xact_start is not null and xact_start < now() - interval '60 seconds';",
  },
  {
    campo: "blocchi_incompatibili",
    forma: "conteggio",
    sql: "select count(*) from pg_locks where not granted;",
  },
]);

/** I campi che da qui NON si possono misurare: restano null, cioe' NON VERIFICATO. */
export const NON_MISURABILI_DA_QUI = Object.freeze([
  "master_versioni_presenti",
  "prova_versioni_registrate",
  "copia_di_sicurezza_recente",
  "funzione_notifiche_installata",
  "corpi_vivi_confermati",
  "dati_compatibili",
  "primo_giro_versioni",
  "secondo_giro_versioni",
  "versioni_escluse",
  "esclusa_registrata_da",
]);

// ---------------------------------------------------------------------
// La lettura delle risposte: rigida. Una forma inattesa ferma tutto.
// ---------------------------------------------------------------------
class RispostaInattesa extends Error {}

function leggiRisposta(righe, forma) {
  if (!Array.isArray(righe) || righe.length !== 1 || typeof righe[0] !== "string") throw new RispostaInattesa();
  const r = righe[0].trim();
  if (forma === "conteggio") {
    if (!/^[0-9]{1,9}$/.test(r)) throw new RispostaInattesa();
    return Number(r);
  }
  if (forma === "si_no") {
    if (r === "si") return true;
    if (r === "no") return false;
    throw new RispostaInattesa();
  }
  if (forma === "versione") {
    if (!/^[0-9]{14}$/.test(r)) throw new RispostaInattesa();
    return r;
  }
  if (forma === "versioni") {
    if (r === "") return [];
    const v = r.split(",");
    if (!v.every((x) => /^[0-9]{14}$/.test(x))) throw new RispostaInattesa();
    return v;
  }
  throw new RispostaInattesa();
}

/** Il risultato verso l'esterno: solo l'esito, i nomi dei controlli non validi, e un motivo fisso se ci si rifiuta. */
function rifiuto(motivo) {
  return { esito: ESITI.NON_PRONTO, controlliNonValidi: [], motivo };
}

// ---------------------------------------------------------------------
// IL NUCLEO — riceve un client che sa solo eseguire una stringa e
// restituire righe di testo. Non sa di che database si tratti.
// ---------------------------------------------------------------------
export async function eseguiPreflight({ argomenti, ambiente, creaClient }) {
  // 1. I due consensi, e nient'altro.
  const args = Array.isArray(argomenti) ? argomenti : [];
  const consensiOk =
    CONSENSI.every((c) => args.includes(c)) && args.every((a) => CONSENSI.includes(a)) && args.length === CONSENSI.length;
  if (!consensiOk) return rifiuto(MOTIVI.CONSENSI);

  // 2. Il canale: solo quello iniettato, nessun ripiego.
  const canale = ambiente && Object.hasOwn(ambiente, NOME_CANALE) ? ambiente[NOME_CANALE] : undefined;
  if (typeof canale !== "string" || canale.trim() === "") return rifiuto(MOTIVI.CANALE);

  // 3. La destinazione, guardata senza collegarsi e senza ripeterla.
  if (!canale.includes(RIF_PRODUZIONE) || canale.includes(RIF_PROVA)) return rifiuto(MOTIVI.DESTINAZIONE);

  // 4. La sessione: sola lettura, ricontrollata prima di ogni misura, e
  //    chiusa sempre con rollback.
  let client;
  try {
    client = await creaClient(canale);
  } catch {
    return rifiuto(MOTIVI.INTERROGAZIONE);
  }

  const campi = Object.fromEntries(NON_MISURABILI_DA_QUI.map((c) => [c, null]));
  let motivo = null;
  try {
    await client.esegui(APRI);
    for (const m of MISURE) {
      const ro = await client.esegui(LEGGI_SOLA_LETTURA);
      if (!Array.isArray(ro) || ro.length !== 1 || String(ro[0]).trim() !== "on") {
        motivo = MOTIVI.SOLA_LETTURA;
        break;
      }
      campi[m.campo] = leggiRisposta(await client.esegui(m.sql), m.forma);
    }
  } catch (e) {
    motivo = e instanceof RispostaInattesa ? MOTIVI.RISPOSTA : MOTIVI.INTERROGAZIONE;
  } finally {
    try {
      await client.esegui(CHIUDI);
    } catch {
      // anche un rollback che fallisce non cambia la risposta: e' gia' NON PRONTO o lo diventa sotto
      motivo = motivo ?? MOTIVI.INTERROGAZIONE;
    }
    try {
      await client.chiudi();
    } catch {
      // chiudere il collegamento non deve far uscire niente
    }
  }
  if (motivo) return rifiuto(motivo);

  // 5. Decide il modulo sanitizzato.
  const r = valutaPreflight(campi);
  return {
    esito: r.esito,
    controlliNonValidi: r.controlli.filter((c) => c.stato !== "OK").map((c) => c.id),
  };
}

// ---------------------------------------------------------------------
// IL CAVO REALE — psql, in una sessione sola. MAI PROVATO contro un
// database vero. Non riceve altro che il canale, non lo stampa, non lo
// salva; dell'errore del database non restituisce niente.
// ---------------------------------------------------------------------
const MARCATORE = "##FINE-RISPOSTA##";

export function creaClientPsql(canale) {
  const figlio = spawn("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", canale], {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });
  let buffer = "";
  let attesa = null;
  let finito = false;
  figlio.stdout.setEncoding("utf8");
  figlio.stdout.on("data", (pezzo) => {
    buffer += pezzo;
    if (attesa && buffer.includes(MARCATORE)) {
      const fino = buffer.indexOf(MARCATORE);
      const righe = buffer.slice(0, fino).split(/\r?\n/).filter((r) => r.trim() !== "");
      buffer = buffer.slice(fino + MARCATORE.length);
      const a = attesa;
      attesa = null;
      a.risolvi(righe);
    }
  });
  const chiuso = () => {
    finito = true;
    if (attesa) {
      const a = attesa;
      attesa = null;
      a.rifiuta(new Error(MOTIVI.INTERROGAZIONE));
    }
  };
  figlio.on("exit", chiuso);
  figlio.on("error", chiuso);

  return {
    esegui(sql) {
      if (finito) return Promise.reject(new Error(MOTIVI.INTERROGAZIONE));
      return new Promise((risolvi, rifiuta) => {
        attesa = { risolvi, rifiuta };
        figlio.stdin.write(sql + "\nselect '" + MARCATORE + "';\n");
      });
    },
    chiudi() {
      if (!finito) figlio.stdin.end();
      return Promise.resolve();
    },
  };
}

// ---------------------------------------------------------------------
// L'avvio — solo se lanciato come programma, mai quando lo importa una prova.
// Legge UNA variabile, e scrive solo l'esito sintetico.
// ---------------------------------------------------------------------
const lanciatoDirettamente = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lanciatoDirettamente) {
  const ambiente = Object.hasOwn(process.env, NOME_CANALE) ? { [NOME_CANALE]: process.env[NOME_CANALE] } : {};
  const r = await eseguiPreflight({ argomenti: process.argv.slice(2), ambiente, creaClient: creaClientPsql });
  console.log(JSON.stringify(r));
  process.exitCode = r.esito === ESITI.PRONTO ? 0 : 1;
}

// Usati dalla prova per confrontare le versioni col modulo sanitizzato.
export { VERSIONI, ULTIMA_IN_PRODUZIONE };
