// COSTRUZIONE DI CASA SUL PC — `npm run casa:costruisci`
//
// 🔴 CASA (31/10/2026): la copia personale di Alessio gira su un Supabase
// acceso sul suo PC (cartella C:\Casa, contenitori `supabase_*_casa`).
// Questo comando la costruisce UNA volta, su un database appena acceso e
// vuoto: utenti, Vault, tutte le migrazioni del repository, lavori
// pianificati fermi.
//
// ⚠️ NON HA UN'OPZIONE PER SVUOTARE, e non deve averla. `prova:ricostruisci
// -- --azzera` esiste perché Prova non contiene niente di nessuno; Casa
// contiene i dati di Alessio. Se trova il database gia' costruito si ferma.
//
// ⚠️ Le barriere, tutte prima di scrivere una riga:
//  · `soloCasa()` sulla stringa di collegamento (la porta di Casa sul PC);
//  · il contenitore del database si chiama `supabase_db_casa` e pubblica
//    proprio quella porta: un altro Supabase acceso sul PC non passa;
//  · dentro il contenitore la produzione e Prova vengono rese
//    irraggiungibili PRIMA delle migrazioni (vedi «Chiudo le porte verso
//    il cloud»).
//
// psql non serve installarlo: si usa quello dentro il contenitore, e le
// migrazioni gli arrivano dall'ingresso standard.

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PORTA_API_CASA, PORTA_DB_CASA, argomentiMigrazione, fermati, timbroLocale, titolo } from "./comune.mjs";
import {
  ECCEZIONI_STORICHE,
  classificaFermate,
  esitoRegistro,
  modoRicostruzione,
  preparazioneDi,
} from "./ricostruzione-regole.mjs";
import {
  CARTELLA,
  CLOUD,
  CONTENITORE,
  STAFF,
  TITOLARE,
  URL_CASA,
  bloccaIlCloudNelDatabase,
  chiudiIlCloud,
  leggiChiavi,
  nomiApertiDelCloud,
  nomiDelCloud,
  pretendiCasa,
  problemiDiCasa,
  psql,
  soloLErrore,
  sql,
} from "./casa-comune.mjs";

// Le migrazioni si verificano impersonando un titolare e uno staff (TITOLARE
// e STAFF, gli indirizzi che l'app prova all'accesso): i due utenti devono
// esistere prima.
const MIGRAZIONE_DEI_RUOLI = "20260801000001_roles_rls.sql";

// 🔴 LA MIGRAZIONE CHE SU CASA NON SI APPLICA. La 20260929000001 ricava
// `url_funzioni` dalla chiave pubblica e accetta solo i due progetti del
// cloud: su Casa si fermerebbe, giustamente. Il suo lavoro (una sola
// `url_funzioni`, quella di QUESTO database) lo fa questo comando qui
// sotto, e la versione si registra a mano con una nota che lo dice.
const MIGRAZIONE_SOLO_CLOUD = "20260929000001_l_indirizzo_delle_funzioni_nel_vault.sql";

// ⚠️ Le funzioni online di Casa sono spente fino alla fase 7. Dentro il
// contenitore del database `127.0.0.1` e' il contenitore stesso, dove non
// risponde nessuno: una chiamata partita per sbaglio fallisce sul posto.
const URL_FUNZIONI_CASA = `http://127.0.0.1:${PORTA_API_CASA}/functions/v1`;

// ⚠️ Se una costruzione si ferma a meta' non si riprende (vedi sotto): si
// riparte da un database vuoto. Va fatto a mano, e SOLO finche' Casa non
// contiene niente di Alessio — dopo, la strada e' il ripristino da una copia.
const COME_RIPARTIRE = [
  "Per ripartire da zero, SOLO se Casa non contiene ancora niente di tuo:",
  `  cd ${CARTELLA}`,
  `  npx supabase@2.122.0 stop --no-backup      (cancella il database di Casa)`,
  "  npm run casa:accendi",
  "  npm run casa:costruisci",
];

// ---------------------------------------------------------------------
// 1. E' davvero Casa?
// ---------------------------------------------------------------------
titolo("Controllo che il database sia quello di Casa");
pretendiCasa();
console.log(`   ${CONTENITORE}, porta ${PORTA_DB_CASA}: e' Casa (${URL_CASA.replace(/:[^:@]*@/, ":***@")})`);

// ⚠️ Niente ripresa a meta': le eccezioni storiche «a meta'» lasciano le
// loro tabelle senza registrarsi, e riapplicarle si fermerebbe su quelle.
const giaCostruita = sql("select to_regclass('public.applied_migrations') is not null;", "Il controllo del database");
if (giaCostruita === "t") {
  fermati(
    "Casa e' gia' costruita (o una costruzione si e' fermata a meta'): dentro ci sono migrazioni registrate.",
    "Questo comando costruisce solo un database vuoto, e non svuota mai Casa.",
    "Non ho scritto niente.",
    "",
    ...COME_RIPARTIRE
  );
}

// ---------------------------------------------------------------------
// 2. Chiudo le porte verso il cloud.
//
// 🔴 Fino alla 20260920000001 diverse migrazioni hanno scritto fisso
// l'indirizzo delle funzioni della PRODUZIONE, e qualche trigger o lavoro
// pianificato puo' scattare mentre le migrazioni girano. Su Prova e' un
// rischio accettato; su Casa no: dentro il contenitore i due indirizzi del
// cloud diventano una strada chiusa, e si CONTROLLA che lo siano.
// ---------------------------------------------------------------------
titolo("Chiudo le porte verso il cloud");
chiudiIlCloud(CLOUD);
const aperti = nomiApertiDelCloud(CLOUD);
if (aperti.length > 0) fermati(`FERMO: dal database di Casa si raggiunge ancora ${aperti.join(", ")}. Non ho scritto niente.`);
console.log(`   ${nomiDelCloud(CLOUD).length} indirizzi del cloud chiusi e verificati`);

// ---------------------------------------------------------------------
// 3. Le chiavi di Casa, lette da Supabase e mai stampate.
// ---------------------------------------------------------------------
titolo("Leggo le chiavi di Casa");
const { api: API, anon: ANON, servizio: SERVIZIO } = leggiChiavi();
console.log("   chiavi lette, firmate con la chiave propria di Casa (ES256)");

// ---------------------------------------------------------------------
// 4. Gli utenti, con password casuali che nessuno conosce. Il PIN del
//    titolare lo sceglie Alessio dopo, con `npm run casa:pin`.
// ---------------------------------------------------------------------
titolo("Creo il titolare e lo staff");
async function creaUtente(email) {
  const r = await fetch(`${API.replace(/\/$/, "")}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: randomBytes(24).toString("base64url"), email_confirm: true }),
  });
  if (r.ok) return "creato";
  const testo = await r.text();
  if (/already been registered|email_exists/i.test(testo)) return "c'era gia'";
  fermati(`La creazione di ${email} non e' riuscita (${r.status}):`, testo.slice(0, 300));
}
for (const email of [TITOLARE, STAFF]) console.log(`   ${email}: ${await creaUtente(email)}`);

// ---------------------------------------------------------------------
// 5. Il Vault: i tre valori che le migrazioni pretendono di trovare.
// ---------------------------------------------------------------------
titolo("Preparo il Vault di Casa");
const firma = randomBytes(32).toString("hex");
sql(
  `select vault.create_secret('${firma}', 'notifiche_firma', 'Parola d''ordine di CASA: diversa da quella del locale.')
     where not exists (select 1 from vault.secrets where name = 'notifiche_firma');
   select vault.create_secret('${ANON}', 'chiave_anon', 'Chiave pubblica di CASA, il Supabase sul PC.')
     where not exists (select 1 from vault.secrets where name = 'chiave_anon');
   select vault.create_secret('${URL_FUNZIONI_CASA}', 'url_funzioni', 'Indirizzo delle funzioni di CASA: spente fino alla fase 7.')
     where not exists (select 1 from vault.secrets where name = 'url_funzioni');`,
  "La preparazione del Vault"
);
console.log("   fatto");

// ---------------------------------------------------------------------
// 5bis. I permessi automatici dello schema `public`, come su Prova.
//
// 🔴 Misurato il 31/10 su un Supabase appena acceso: lo schema `public` ha
// dei permessi AUTOMATICI (pg_default_acl) che danno ad anon, authenticated
// e service_role ogni funzione, tabella e sequenza appena creata. La
// 20260810000001 lo vede e si ferma: «il varco pubblico e' stato allargato
// oltre il ruolo anonimo». Prova si ricostruisce dopo aver svuotato e rifatto `public`,
// che quei permessi li porta via con se': qui si tolgono e basta, senza
// cancellare niente, cosi' Casa parte dalle stesse condizioni di Prova.
// ---------------------------------------------------------------------
titolo("Tolgo i permessi automatici di public, come su Prova");
sql(
  `do $permessi$
   declare r record;
   begin
     for r in select defaclrole::regrole::text as ruolo, defaclobjtype as tipo
                from pg_default_acl where defaclnamespace = 'public'::regnamespace loop
       execute format('alter default privileges for role %I in schema public revoke all on %s from anon, authenticated, service_role',
                      r.ruolo,
                      case r.tipo when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' when 'T' then 'types' end);
     end loop;
   end $permessi$;`,
  "La rimozione dei permessi automatici",
  { utente: "supabase_admin" }
);
const restanti = sql(
  "select count(*) from pg_default_acl, aclexplode(defaclacl) a where defaclnamespace = 'public'::regnamespace and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole);",
  "Il controllo dei permessi automatici"
);
if (restanti !== "0") fermati(`Restano ${restanti} permessi automatici su public per anon, authenticated o service_role.`);
console.log("   fatto");

// ---------------------------------------------------------------------
// 6. Le migrazioni, in ordine, con le REGOLE DELLA RICOSTRUZIONE.
//
// 🔴 Non sono regole di Casa: sono quelle di `scripts/ricostruzione-regole.mjs`,
// con cui si verifica che il repository sappia rifare il database da zero.
// Le eccezioni storiche note (applicate a meta', col fuso di Roma, o
// fermate apposta e sanate piu' avanti), la preparazione della 20260826000013
// (il tetto a 10 €, che e' anche la scelta di Alessio per Casa) e
// l'aggiramento del piano per chi chiede pg_get_functiondef: lo stesso
// elenco della prova di ricarica. ⚠️ Con DUE differenze di Casa, dichiarate
// qui sotto: la 20260929000001 saltata (MIGRAZIONE_SOLO_CLOUD) e gli a capo
// della 20260829000007 (A_CAPO_COME_IN_PRODUZIONE). E il Vault e' gia'
// seminato con url_funzioni: la 20260917000001 e la 20260920000001, che la
// prova di ricarica vede fermarsi, qui passano (vedi «non scattate»).
//
// ⚠️ Gli a capo arrivano come LF, come sul Linux dei Controlli: la
// 20260829000007 cerca nel corpo vivo testi con gli a capo che la
// produzione aveva, e con i CRLF del repository su Windows non li trova.
// ---------------------------------------------------------------------
const SQL_RUOLI = `
insert into user_roles (user_id, role)
select id, (case when email = '${TITOLARE}' then 'titolare' else 'staff' end)::app_role
  from auth.users where email in ('${TITOLARE}', '${STAFF}')
on conflict (user_id) do update set role = excluded.role;`;

// ⚠️ I lavori pianificati non devono scattare mentre le migrazioni girano,
// ma non si possono spegnere: la 20260812000008 (e il suo censimento)
// pretende di trovarli ACCESI. Allora restano accesi con un orario che non
// arriva mai — il 30 febbraio — riapplicato dopo ogni migrazione, perche'
// una migrazione che li riprogramma rimette il suo. Si spengono alla fine.
// postgres non puo' scrivere in cron.job: si passa da alter_job.
const MAI = "0 0 30 2 *";
const SQL_CRON_A_RIPOSO = `
do $riposo$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.alter_job(jobid, schedule := '${MAI}') from cron.job where schedule <> '${MAI}';
  end if;
end $riposo$;`;

// 🔴 L'UNICA RIGA CAMBIATA NEL TESTO APPLICATO (il file non si tocca).
// La 20260829000007 riscrive due funzioni cercandone il corpo vivo con gli
// a capo che avevano in produzione: LF in scarica_magazzino_conto, CRLF
// (`chr(13) || chr(10)`) in registra_produzione. Da zero gli a capo sono
// tutti uguali, e in nessuno dei due modi la migrazione passa: misurato su
// Casa il 31/10 (con CRLF si ferma su scarica, con LF su registra). Qui, con
// tutto LF, anche registra si cerca con LF. Ogni testo deve comparire una
// volta sola, o la costruzione si ferma.
const A_CAPO_COME_IN_PRODUZIONE = {
  "20260829000007_uno_scarto_minimo_non_si_dice.sql": [
    "quantita_mancante)' || chr(13) || chr(10) ||",
    "quantita_richiesta)' || chr(13) || chr(10) ||",
  ],
};

function soloA_capoLF(file, testo) {
  let risultato = testo;
  for (const prima of A_CAPO_COME_IN_PRODUZIONE[file] ?? []) {
    const volte = risultato.split(prima).length - 1;
    if (volte !== 1) fermati(`FERMO: in ${file} «${prima}» compare ${volte} volte invece di una.`);
    risultato = risultato.replace(prima, prima.replace("chr(13) || chr(10)", "chr(10)"));
  }
  return risultato;
}

const migrazioni = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
titolo(`Applico ${migrazioni.length} migrazioni`);
const diario = [];
const note = [];
let numero = 0;
let bloccato = false;

function scriviIlResoconto() {
  mkdirSync(CARTELLA, { recursive: true });
  const registro = path.join(CARTELLA, `costruzione_${timbroLocale()}.log`);
  writeFileSync(registro, diario.join("\n"), "utf8");
  return registro;
}
for (const file of migrazioni) {
  numero++;
  const versione = file.slice(0, 14);
  const etichetta = `${String(numero).padStart(3, " ")}/${migrazioni.length}  ${file}`;

  if (file === MIGRAZIONE_SOLO_CLOUD) {
    const n = sql("select count(*) from vault.decrypted_secrets where name = 'url_funzioni';", "Il controllo di url_funzioni");
    if (n !== "1") fermati(`FERMO: nel Vault «url_funzioni» compare ${n} volte invece di una.`);
    sql(
      `insert into applied_migrations (version, name)
       values ('${versione}', 'l_indirizzo_delle_funzioni_nel_vault (Casa: url_funzioni scritta da casa-costruisci)')
       on conflict (version) do nothing;`,
      "La registrazione della migrazione solo-cloud"
    );
    diario.push(`===== ${file} =====\nNON applicata su Casa: url_funzioni = ${URL_FUNZIONI_CASA}, scritta da casa-costruisci.`);
    console.log(`   salt ${etichetta}  (solo cloud: url_funzioni e' di Casa)`);
    continue;
  }

  const preparazione = preparazioneDi(versione);
  if (preparazione) sql(preparazione, `La preparazione della ${versione}`);

  const percorso = path.join("supabase/migrations", file);
  const testo = soloA_capoLF(file, readFileSync(percorso, "utf8").replace(/\r\n/g, "\n"));
  const modo = modoRicostruzione(versione, argomentiMigrazione(URL_CASA, percorso).atomica);
  const r = psql((modo.fusoRoma ? "set timezone = 'Europe/Rome';\n" : "") + testo, {
    atomica: modo.atomica,
    opzioni: /pg_get_functiondef/.test(testo) ? "-c enable_seqscan=off" : "",
  });
  diario.push(`===== ${file} =====\n${r.uscita}`);

  if (r.ok) {
    console.log(`   ok   ${etichetta}`);
  } else {
    const motivo = (r.uscita.split(/\r?\n/).filter((l) => /ERROR:/.test(l)).pop() || "?").replace(/^.*ERROR:\s*/, "");
    const { note: attese, inattese } = classificaFermate([{ file, versione, numero, motivo }], [versione]);
    if (inattese.length > 0) {
      fermati(
        `La migrazione ${file} si e' fermata, e non e' una fermata nota.`,
        "",
        soloLErrore(r.uscita),
        "",
        `Il resoconto completo e' in ${scriviIlResoconto()}.`,
        "",
        ...COME_RIPARTIRE
      );
    }
    note.push(attese[0]);
    console.log(`   nota ${etichetta}  (fermata attesa, la sana la ${attese[0].eccezione.sanataDa ?? "—"})`);
  }
  sql(SQL_CRON_A_RIPOSO, "Il riposo dei lavori pianificati");
  // Il blocco del cloud nel database entra appena pg_net esiste (la
  // 20260801000002), prima che qualunque migrazione possa chiamare fuori.
  if (!bloccato) bloccato = bloccaIlCloudNelDatabase(CLOUD);
  if (file === MIGRAZIONE_DEI_RUOLI) sql(SQL_RUOLI, "L'assegnazione dei ruoli");
}


// ---------------------------------------------------------------------
// 7. Lavori pianificati spenti, e la verifica di Casa: registro completo
//    (ogni fermata nota sanata piu' avanti), niente lavori accesi, niente
//    cloud dentro, porte chiuse, un titolare. E' la stessa di
//    `npm run casa:verifica`.
//
// 🔴 Le porte chiuse sono la seconda protezione, non l'unica (chat madre,
// 31/10): se una funzione, un lavoro, il Vault o un'impostazione nomina
// ancora la produzione o Prova, Casa non si dichiara costruita.
// ---------------------------------------------------------------------
titolo("Spengo i lavori pianificati e verifico Casa");
sql("select cron.alter_job(jobid, active := false) from cron.job where active;", "Lo spegnimento dei lavori pianificati");
const registro = scriviIlResoconto();
const { problemi, registrate } = problemiDiCasa({ esitoRegistro });
if (problemi.length > 0) {
  fermati("Casa NON e' a posto:", ...problemi.map((p) => `  · ${p}`), "", `Resoconto: ${registro}`);
}
console.log(`   a posto: ${registrate} migrazioni registrate, ${note.length} fermate note e sanate`);

// Le eccezioni che la prova di ricarica vede fermarsi e qui no: non sono
// errori, ma si DICONO, perche' Casa non rifa' la stessa storia.
const fermateQui = new Set(note.map((n) => n.versione));
for (const e of ECCEZIONI_STORICHE.filter((x) => x.attesa && !fermateQui.has(x.versione))) {
  console.log(`   non scattata la ${e.versione} (attesa: «${e.attesa}»): qui non si e' fermata`);
}

titolo("Risultato");
console.log(`   tabelle:                 ${sql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';", "Il conteggio")}`);
console.log(`   ruoli:                   ${sql("select string_agg(role::text, ', ' order by role) from user_roles;", "Il conteggio")}`);
console.log(`   lavori pianificati:      ${sql("select count(*) || ' (attivi: ' || count(*) filter (where active) || ')' from cron.job;", "Il conteggio")}`);
console.log("");
console.log(`Casa costruita. Resoconto: ${registro}`);
