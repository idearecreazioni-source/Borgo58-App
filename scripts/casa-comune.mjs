// I pezzi comuni ai comandi di Casa (31/10/2026): riconoscere il database
// di Casa, parlargli senza psql installato, leggerne le chiavi senza
// stamparle. Le barriere vere stanno in comune.mjs (`soloCasa`); qui c'e'
// la seconda meta': il Docker deve essere quello del PC, il contenitore
// quello di Casa, e la porta pubblicata proprio quella di Casa.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { PORTA_API_CASA, PORTA_DB_CASA, REF_PRODUZIONE, REF_PROVA, fermati, soloCasa } from "./comune.mjs";
import { INDIRIZZI_PREDEFINITI } from "./indirizzi-accesso.mjs";

// ⚠️ Fissa, non da variabile d'ambiente: e' la cartella da cui si accende
// Casa e dove sta la sua chiave di firma (revisione ecc:security-reviewer).
export const CARTELLA = "C:/Casa";
export const CONTENITORE = "supabase_db_casa";
export const CONTENITORE_API = "supabase_kong_casa";
export const VERSIONE_CLI = "2.122.0";
// La password `postgres` del Supabase locale e' quella di fabbrica: il
// database risponde solo dal PC, e la stringa serve alla barriera.
export const URL_CASA = soloCasa(`postgresql://postgres:postgres@127.0.0.1:${PORTA_DB_CASA}/postgres`);

/** I due progetti del cloud che Casa non deve mai raggiungere. */
export const CLOUD = [REF_PRODUZIONE, REF_PROVA];

// Gli utenti di Casa sono quelli che l'app prova all'accesso: se un giorno
// gli indirizzi cambiano, cambiano in un posto solo.
export const TITOLARE = INDIRIZZI_PREDEFINITI.titolare;
export const STAFF = INDIRIZZI_PREDEFINITI.staff;

/** Le versioni di tutte le migrazioni del repository, in ordine. */
export function versioniDelleMigrazioni() {
  return readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => f.slice(0, 14));
}

export function docker(argomenti, ingresso) {
  const r = spawnSync("docker", argomenti, { encoding: "utf8", input: ingresso, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, uscita: (r.stdout || "") + (r.stderr || ""), stdout: (r.stdout || "").trim() };
}

/** psql dentro il contenitore di Casa; la SQL arriva dall'ingresso standard. */
export function psql(sql, { atomica = true, opzioni = "", utente = "postgres" } = {}) {
  const argomenti = ["exec", "-i", ...(opzioni ? ["-e", `PGOPTIONS=${opzioni}`] : []), CONTENITORE, "psql", "-U", utente, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
  if (atomica) argomenti.push("--single-transaction");
  return docker(argomenti, sql);
}

/**
 * Solo le righe che spiegano l'errore. ⚠️ psql, quando si ferma, ripete la
 * riga della SQL («LINE 1: …»): per il Vault quella riga contiene la parola
 * d'ordine, e non deve finire a schermo ne' in un registro.
 */
export const soloLErrore = (uscita) =>
  uscita.split(/\r?\n/).filter((l) => /^(psql:.*)?(ERROR|DETAIL|HINT|CONTEXT):/.test(l.trim())).join("\n").trim() || "(nessun dettaglio)";

export function sql(comando, descrizione, opzioni = {}) {
  const r = psql(comando, opzioni);
  if (!r.ok) fermati(`${descrizione} non e' riuscito:`, soloLErrore(r.uscita));
  return r.stdout;
}

/**
 * Si ferma se Docker non e' quello del PC, se non risponde, se il
 * contenitore non e' acceso o non e' quello di Casa.
 * ⚠️ `docker exec` segue DOCKER_HOST e il contesto attivo: puntati a un
 * motore remoto agirebbero su un contenitore con lo stesso nome altrove.
 */
export function pretendiCasa() {
  if (process.env.DOCKER_HOST) fermati("FERMO: DOCKER_HOST e' impostata. I comandi di Casa lavorano solo col Docker del PC.");
  const contesto = docker(["context", "show"]).stdout;
  if (contesto && !["default", "desktop-linux"].includes(contesto)) {
    fermati(`FERMO: il contesto Docker attivo e' «${contesto}», non quello del PC.`);
  }
  if (!docker(["info", "--format", "{{.ServerVersion}}"]).ok) {
    fermati("Docker non risponde.", "Apri Docker Desktop, aspetta «Engine running» e rilancia.");
  }
  const stato = docker(["inspect", "-f", "{{.State.Running}}", CONTENITORE]);
  if (!stato.ok || stato.stdout !== "true") {
    fermati(`Il contenitore ${CONTENITORE} non e' acceso.`, "Accendi Casa con:  npm run casa:accendi");
  }
  const porta = docker(["port", CONTENITORE, "5432/tcp"]).stdout;
  if (!porta || !porta.split(/\r?\n/).every((r) => r.endsWith(`:${PORTA_DB_CASA}`))) {
    fermati(`FERMO: ${CONTENITORE} non pubblica la porta di Casa (${PORTA_DB_CASA}). Non ho scritto niente.`);
  }
}

/**
 * 🔴 CASA RISPONDE SOLO AL PC. Il database ha la password di fabbrica
 * `postgres` ed e' superutente: se rispondesse alla rete di casa, chiunque
 * ci sia sopra potrebbe leggerlo tutto.
 *
 * ⚠️ Misurato il 31/10: Docker Desktop su Windows pubblica le porte su
 * 0.0.0.0 anche con `"ip": "127.0.0.1"` nel Docker Engine (un contenitore
 * di prova appena creato, stesso risultato), e Supabase CLI non ha
 * un'opzione per l'indirizzo. La chiusura vera e' quindi nel firewall di
 * Windows: una regola di BLOCCO in entrata sulle porte di Casa, che vince
 * su qualunque «Consenti» dato a Docker. Il firewall non filtra le
 * connessioni del PC con se stesso: da qui Casa funziona.
 */
export const REGOLA_FIREWALL = "Casa - blocco dalla rete";
export const PORTE_FIREWALL = "44320-44329";

/** Le porte di Casa pubblicate oltre il PC, come le dice Docker. */
export function porteOltreIlPC() {
  const aperte = [];
  for (const [contenitore, interna] of [[CONTENITORE, "5432/tcp"], [CONTENITORE_API, "8000/tcp"]]) {
    for (const riga of docker(["port", contenitore, interna]).stdout.split(/\r?\n/).filter(Boolean)) {
      if (!/^(127\.0\.0\.1|\[::1\]):/.test(riga)) aperte.push(`${contenitore} su ${riga}`);
    }
  }
  return aperte;
}

/** C'e' la regola di blocco, accesa, in entrata, sulle porte di Casa? */
export function bloccoNelFirewall() {
  const comando =
    `$r = Get-NetFirewallRule -DisplayName '${REGOLA_FIREWALL}' -ErrorAction SilentlyContinue | ` +
    "Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' }; " +
    "if ($r) { ($r | Get-NetFirewallPortFilter).LocalPort -join ',' }";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", comando], { encoding: "utf8" });
  return (r.stdout || "").trim().split(",").includes(PORTE_FIREWALL);
}

/** Problemi di esposizione: porte oltre il PC e nessun blocco nel firewall. */
export function esposizioneAllaRete() {
  const aperte = porteOltreIlPC();
  if (aperte.length === 0 || bloccoNelFirewall()) return [];
  return [`Casa risponde a tutta la rete (${aperte.join("; ")}) e manca la regola «${REGOLA_FIREWALL}» nel firewall`];
}

/**
 * Indirizzo e chiavi di Casa, letti da `supabase status` e mai stampati.
 * ⚠️ La chiave di fabbrica di Supabase locale e' pubblica (HS256,
 * «supabase-demo»): si pretende la chiave propria di Casa (ES256, da
 * signing_keys.json).
 */
export function leggiChiavi() {
  const st = spawnSync("npx", ["--yes", "--prefer-offline", `supabase@${VERSIONE_CLI}`, "status", "-o", "json"], {
    cwd: CARTELLA,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  let s;
  try {
    s = JSON.parse(st.stdout.slice(st.stdout.indexOf("{")));
  } catch {
    fermati("Non riesco a leggere lo stato di Casa.", (st.stderr || "").trim().split("\n").slice(-4).join("\n  "));
  }
  const api = String(s.API_URL || "").replace(/\/$/, "");
  if (api !== `http://127.0.0.1:${PORTA_API_CASA}`) fermati(`FERMO: l'API di Casa non e' sul PC (${api}).`);
  for (const [nome, k] of [["ANON_KEY", s.ANON_KEY], ["SERVICE_ROLE_KEY", s.SERVICE_ROLE_KEY]]) {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k || "")) fermati(`La chiave ${nome} di Casa ha una forma inattesa.`);
    const { alg } = JSON.parse(Buffer.from(k.split(".")[0], "base64url").toString("utf8"));
    if (alg !== "ES256") {
      fermati(
        `FERMO: la chiave ${nome} di Casa e' firmata con ${alg}, non con la chiave propria (ES256).`,
        `Controlla signing_keys_path in ${CARTELLA}/supabase/config.toml e riaccendi Casa.`
      );
    }
  }
  return { api, anon: s.ANON_KEY, servizio: s.SERVICE_ROLE_KEY };
}

/**
 * 🔴 NIENTE CLOUD DENTRO CASA (richiesta della chat madre, 31/10/2026).
 * Dopo la costruzione nel database di Casa non deve restare l'indirizzo
 * della produzione ne' quello di Prova — ne' nelle funzioni, ne' nei lavori
 * pianificati, ne' nel Vault, ne' nelle impostazioni del database.
 * Restituisce dove li trova, vuoto se e' pulito.
 */
export function sqlResiduiDelCloud(refs) {
  const elenco = refs.map((r) => `'%${r}%'`).join(", ");
  return `
select 'funzione ' || n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname not in ('pg_catalog', 'information_schema')
   and p.prosrc like any (array[${elenco}])
union all
select 'lavoro pianificato ' || jobname from cron.job where command like any (array[${elenco}])
union all
select 'Vault ' || name from vault.decrypted_secrets where decrypted_secret like any (array[${elenco}])
union all
select 'impostazione del database' from pg_db_role_setting where array_to_string(setconfig, ' ') like any (array[${elenco}])
order by 1;`;
}

/**
 * 🔴 IL BLOCCO DENTRO IL DATABASE (revisione ecc:security-reviewer, 31/10).
 * Ogni chiamata in uscita di pg_net passa da `net.http_request_queue`: un
 * trigger scarta in silenzio (con un avviso nel registro di Postgres) le
 * righe che puntano alla produzione o a Prova. Scartare e non fermare e'
 * voluto: un'azione del gestionale che manda anche una notifica non deve
 * fallire su Casa, deve solo non mandarla. ⚠️ Vive nel database, quindi
 * sopravvive ai riavvii — a differenza di /etc/hosts.
 */
export function sqlBloccoDelCloud(refs) {
  return `
create schema if not exists casa;
revoke all on schema casa from public;
create or replace function casa.niente_cloud() returns trigger
language plpgsql as $niente$
begin
  if new.url ~ '(${refs.join("|")})' then
    raise warning 'Casa: chiamata verso il cloud scartata (%)', new.url;
    return null;
  end if;
  return new;
end
$niente$;
drop trigger if exists casa_niente_cloud on net.http_request_queue;
create trigger casa_niente_cloud before insert on net.http_request_queue
  for each row execute function casa.niente_cloud();`;
}

/** Mette il blocco, se pg_net c'e' gia'. Restituisce true se ora c'e'. */
export function bloccaIlCloudNelDatabase(refs) {
  if (sql("select to_regclass('net.http_request_queue') is not null;", "Il controllo di pg_net") !== "t") return false;
  if (bloccoNelDatabase()) return true;
  sql(sqlBloccoDelCloud(refs), "Il blocco del cloud nel database", { utente: "supabase_admin" });
  return bloccoNelDatabase();
}

export function bloccoNelDatabase() {
  return (
    sql(
      "select exists (select 1 from pg_trigger where tgname = 'casa_niente_cloud' and tgrelid = to_regclass('net.http_request_queue') and tgenabled <> 'D');",
      "Il controllo del blocco"
    ) === "t"
  );
}

/**
 * 🔴 LE PORTE VERSO IL CLOUD, seconda protezione. Dentro il contenitore del
 * database i nomi della produzione e di Prova portano a 0.0.0.0.
 * ⚠️ Misurato il 31/10: /etc/hosts torna quello di fabbrica a ogni riavvio
 * del contenitore. Si richiude a ogni accensione (`casa:accendi`) e la
 * verifica lo controlla. ⚠️ La prima protezione e' il blocco nel database
 * (casa.niente_cloud): questa copre solo i nomi elencati qui sotto.
 */
export const nomiDelCloud = (refs) =>
  refs.flatMap((ref) => [`${ref}.supabase.co`, `db.${ref}.supabase.co`, `${ref}.functions.supabase.co`]);

export function chiudiIlCloud(refs) {
  // Un nome alla volta: se l'elenco cresce, i nomi nuovi si aggiungono anche
  // a un /etc/hosts gia' chiuso.
  const comandi = nomiDelCloud(refs)
    .map((n) => `grep -q ' ${n}$' /etc/hosts || echo '0.0.0.0 ${n}' >> /etc/hosts`)
    .join("; ");
  const r = docker(["exec", "-u", "root", CONTENITORE, "sh", "-c", comandi]);
  if (!r.ok) fermati("Non sono riuscito a chiudere le porte verso il cloud:", r.uscita.trim());
}

/** I nomi del cloud che dal database di Casa portano ancora da qualche parte. */
export function nomiApertiDelCloud(refs) {
  return nomiDelCloud(refs).filter((nome) => !docker(["exec", CONTENITORE, "getent", "hosts", nome]).stdout.startsWith("0.0.0.0"));
}

/**
 * Chi nomina il cloud solo per RICONOSCERLO o per BLOCCARLO, senza
 * chiamarlo: uno per riga, con la ragione. ⚠️ Si aggiunge qui solo dopo
 * aver letto il corpo.
 */
export const RICONOSCITORI = {
  // Confronta url_funzioni con l'indirizzo di Prova per sapere se il database
  // e' Prova (20260919000001). Non si collega a niente; su Casa dice «no».
  "funzione public.siamo_su_prova": "confronta url_funzioni con Prova per riconoscerla, non la chiama",
  // Il blocco di Casa: nomina il cloud per scartarne le chiamate.
  "funzione casa.niente_cloud": "il blocco di Casa, nomina il cloud per scartarlo",
};

/** I posti che nominano il cloud, tolti i riconoscitori dichiarati. */
export function residuiDelCloud(refs) {
  return sql(sqlResiduiDelCloud(refs), "La ricerca degli indirizzi del cloud")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((posto) => !RICONOSCITORI[posto]);
}

/**
 * Il controllo di Casa costruita, rilanciabile quando si vuole
 * (`npm run casa:verifica`) e chiamato anche alla fine della costruzione e
 * a ogni accensione. Non scrive niente. Restituisce i problemi, vuoto se
 * Casa e' a posto.
 */
export function problemiDiCasa({ esitoRegistro }) {
  const problemi = [];
  const registrate = sql(
    "select coalesce(string_agg(version, ' ' order by version), '') from applied_migrations;",
    "La lettura del registro"
  ).split(/\s+/).filter(Boolean);
  const esito = esitoRegistro(versioniDelleMigrazioni(), registrate);
  if (!esito.completo) {
    problemi.push(`registro incompleto: mancano ${esito.mancanti.join(", ") || "—"}; senza file ${esito.estranee.join(", ") || "—"}`);
  }
  const attivi = sql("select coalesce(string_agg(jobname, ', '), '') from cron.job where active;", "La lettura dei lavori pianificati");
  if (attivi) problemi.push(`lavori pianificati accesi: ${attivi}`);
  for (const posto of residuiDelCloud(CLOUD)) problemi.push(`nomina il cloud: ${posto}`);
  if (!bloccoNelDatabase()) problemi.push("manca il blocco del cloud nel database (casa.niente_cloud)");
  for (const nome of nomiApertiDelCloud(CLOUD)) problemi.push(`raggiungibile dal database: ${nome}`);
  problemi.push(...esposizioneAllaRete());
  const ruoli = sql("select coalesce(string_agg(role::text, ',' order by role), '') from user_roles;", "La lettura dei ruoli");
  if (!ruoli.split(",").includes("titolare")) problemi.push("nessun titolare");
  return { problemi, registrate: registrate.length };
}
