// RICOSTRUZIONE DEL DATABASE DI PROVA DA ZERO — `npm run prova:ricostruisci`
//
// Applica, in ordine, tutte le migrazioni del repository su un progetto
// Supabase VUOTO. Serve a due cose insieme:
//
//  1. avere un posto dove provare le modifiche senza rischiare i dati veri;
//  2. dimostrare che il repository, da solo, e' capace di rifare l'intero
//     database. Se una migrazione dava per scontato qualcosa che esisteva
//     solo nel database vero, qui si ferma e lo si scopre.
//
// Non tocca MAI il database vero: `soloProva()` interrompe il programma
// se la stringa di collegamento punta al progetto di produzione.
//
// Aggiungere `-- --azzera` al comando per svuotare prima il progetto di prova.

import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  esegui,
  interroga,
  fermati,
  titolo,
  timbroLocale,
  // Il riferimento del progetto vero: serve alla guardia che impedisce di
  // riprendere la sala da un database che non è quello del locale.
  REF_PRODUZIONE,
} from "./comune.mjs";

const UTENTI_RICHIESTI = [
  "alessio@borgo58.app",
  "staff@borgo58.app",
  "test-titolare@borgo58.app",
  "test-staff@borgo58.app",
];

// I ruoli si assegnano subito dopo la migrazione che crea la tabella dei
// ruoli: le migrazioni successive si verificano impersonando un titolare
// e uno staff, e senza ruoli assegnati si fermerebbero.
const MIGRAZIONE_DEI_RUOLI = "20260801000001_roles_rls.sql";

const SQL_RUOLI = `
insert into user_roles (user_id, role)
select id,
       (case when email in ('alessio@borgo58.app', 'test-titolare@borgo58.app')
             then 'titolare' else 'staff' end)::app_role
from auth.users
where email in (${UTENTI_RICHIESTI.map((e) => `'${e}'`).join(", ")})
on conflict (user_id) do update set role = excluded.role;
`;

const config = leggiConfigurazione();
const url = soloProva(obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova."));
const chiaveAnon = obbligatorio(config, "PROVA_ANON_KEY", "E' la chiave anon del progetto di prova (Settings -> API Keys).");
const psql = strumento("psql");
const azzera = process.argv.includes("--azzera");

function sql(comando, descrizione) {
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-d", url, "-c", comando], { silenzioso: true });
  if (!r.ok) fermati(`${descrizione} non e' riuscito:`, r.uscita.trim());
  return r.uscita;
}

// ---------------------------------------------------------------------
// 1. Gli utenti devono esistere prima: le migrazioni assegnano i ruoli
//    per indirizzo email e si verificano impersonando persone vere.
// ---------------------------------------------------------------------
titolo("Controllo i prerequisiti");
const mancanti = interroga(
  url,
  `select coalesce(string_agg(e, ', '), '') from (
     select unnest(array[${UTENTI_RICHIESTI.map((e) => `'${e}'`).join(", ")}]) as e
     except select email from auth.users
   ) m;`
);
if (mancanti) {
  fermati(
    "Mancano degli utenti nel progetto di prova:",
    mancanti,
    "",
    "Vanno creati dal pannello Supabase del progetto di PROVA:",
    "Authentication -> Users -> Add user (una password qualsiasi, la scegli tu).",
    "Istruzioni complete: docs/AMBIENTE_PROVA.md"
  );
}
console.log("   i 4 utenti ci sono");

const tabelleGiaPresenti = Number(
  interroga(url, "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")
);
if (tabelleGiaPresenti > 0 && !azzera) {
  fermati(
    `Il progetto di prova contiene gia' ${tabelleGiaPresenti} tabelle.`,
    "Per ricostruirlo da zero il progetto deve essere vuoto.",
    "",
    "Per svuotarlo e rifarlo:  npm run prova:ricostruisci -- --azzera"
  );
}
// ---------------------------------------------------------------------
// ⚠️ COSA STA PER SPARIRE, DETTO PRIMA (giro A del mandato sala, 18/08).
//
// Fino a oggi questo comando elencava i PREREQUISITI e taceva le PERDITE.
// E la perdita che conta non è ovvia: dal 14/08 «questa diventa la base»
// scrive la disposizione della sala **dentro `dining_tables`**, quindi la
// sala «di sempre» non è un dato di una migrazione — è un dato di Alessio.
// `--azzera` la buttava via in silenzio, e chi la ritrovava tornata alla
// disposizione della migrazione dava la colpa allo scenario (che infatti
// non c'entrava: misurato il 18/08).
//
// Elencare i prerequisiti e tacere le perdite è la stessa forma dello
// scarto silenzioso: un comando che dice solo quello che gli serve, e non
// quello che costa.
// ---------------------------------------------------------------------
function cosaSparisce() {
  const conta = (tabella) => {
    const r = interroga(url, `select count(*) from ${tabella};`).trim();
    return Number.isFinite(Number(r)) ? Number(r) : null;
  };
  const sagome = conta("dining_tables");
  const scostamenti = conta("disposizioni_giornaliere");

  console.log("");
  console.log("  ⚠ Sta per sparire TUTTO il contenuto del progetto di prova.");
  console.log("    Le migrazioni ricostruiscono lo schema, e `prova:base` rimette lo");
  console.log("    scenario marcato «BASE-». Quello che NON torna da nessuna delle due:");
  console.log("");
  if (sagome !== null) {
    console.log(`      · la sala: ${sagome} sagome, e la disposizione «di sempre» che c'e' addosso.`);
    console.log("        Da oggi si riprende dalla produzione (vedi piu' sotto), ma solo se");
    console.log("        DB_URL_PRODUZIONE e' configurata.");
  }
  if (scostamenti) {
    console.log(`      · ${scostamenti} scostamenti di giornata: la disposizione di un giorno preciso.`);
    console.log("        Quelli NON si riprendono da nessuna parte — sono di chi li ha fatti.");
  }
  console.log("      · tutto quello che qualcuno ha creato a mano e non e' marcato «BASE-»:");
  console.log("        prenotazioni, note, conti, righe di collaudo.");
  console.log("");
}

if (azzera) {
  cosaSparisce();
  titolo("Svuoto il progetto di prova");
  // I lavori pianificati vanno tolti per primi: restare programmati su
  // funzioni che stiamo per cancellare produce errori a ripetizione.
  sql(
    `do $pulizia$
     begin
       if exists (select 1 from pg_namespace where nspname = 'cron') then
         perform cron.unschedule(jobid) from cron.job;
       end if;
     end $pulizia$;`,
    "La rimozione dei lavori pianificati"
  );
  sql("drop schema if exists public cascade; create schema public;", "Lo svuotamento");
  sql("grant usage on schema public to anon, authenticated, service_role;", "I permessi di base");
  sql("delete from vault.secrets where name in ('notifiche_firma', 'chiave_anon');", "La pulizia del Vault");
  console.log("   fatto");
}

// ---------------------------------------------------------------------
// 2. Il Vault: due valori che alcune migrazioni pretendono di trovare.
//    La parola d'ordine del progetto di prova e' DIVERSA da quella vera,
//    di proposito: cosi' le notifiche partite per sbaglio dal progetto di
//    prova vengono respinte invece di arrivare sul telefono.
// ---------------------------------------------------------------------
titolo("Preparo il Vault del progetto di prova");
sql(
  `do $prep$
   declare v text;
   begin
     if not exists (select 1 from vault.secrets where name = 'notifiche_firma') then
       v := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
       perform vault.create_secret(v, 'notifiche_firma',
         'Parola d''ordine del progetto di PROVA: diversa da quella vera di proposito.');
     end if;
   end $prep$;`,
  "La parola d'ordine di prova"
);
// La chiave finisce dentro il comando SQL, quindi si controlla che
// contenga solo i caratteri di un JWT: psql, con `-c`, non sostituisce le
// variabili (`:'chiave'` arriverebbe al database così com'è — bug vero,
// trovato alla prima ricostruzione).
if (!/^[A-Za-z0-9_.-]+$/.test(chiaveAnon)) {
  fermati("PROVA_ANON_KEY contiene caratteri inattesi.", "Deve essere la chiave `anon` del progetto di prova.");
}
sql(
  `select vault.create_secret('${chiaveAnon}', 'chiave_anon', 'Chiave pubblica del progetto di prova.')
   where not exists (select 1 from vault.secrets where name = 'chiave_anon');`,
  "L'archiviazione della chiave pubblica"
);
console.log("   fatto");

// ---------------------------------------------------------------------
// 3. Le migrazioni, in ordine di data.
// ---------------------------------------------------------------------
const migrazioni = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
titolo(`Applico ${migrazioni.length} migrazioni`);

const diario = [];
let numero = 0;
for (const file of migrazioni) {
  numero++;
  const etichetta = `${String(numero).padStart(2, " ")}/${migrazioni.length}  ${file}`;
  const r = esegui(
    psql,
    ["-v", "ON_ERROR_STOP=1", "-d", url, "-f", path.join("supabase/migrations", file)],
    { silenzioso: true }
  );
  diario.push(`===== ${file} =====\n${r.uscita}`);
  console.log(`   ${r.ok ? "ok  " : "STOP"} ${etichetta}`);

  if (!r.ok) {
    const registro = `ricostruzione_${timbroLocale()}.log`;
    writeFileSync(registro, diario.join("\n"), "utf8");
    fermati(
      `La migrazione ${file} si e' fermata.`,
      "",
      r.uscita.trim().split("\n").slice(-8).join("\n  "),
      "",
      `Il resoconto completo e' nel file ${registro}: mandalo a Claude Code cosi' com'e'.`
    );
  }

  if (file === MIGRAZIONE_DEI_RUOLI) {
    sql(SQL_RUOLI, "L'assegnazione dei ruoli");
    console.log("        (ruoli assegnati ai 4 utenti)");
  }
}

// ---------------------------------------------------------------------
// 4. Riepilogo.
// ---------------------------------------------------------------------
const registro = `ricostruzione_${timbroLocale()}.log`;
writeFileSync(registro, diario.join("\n"), "utf8");

titolo("Risultato");
console.log(`   tabelle create:        ${interroga(url, "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")}`);
console.log(`   migrazioni registrate: ${interroga(url, "select count(*) from applied_migrations;")}`);
console.log(`   ruoli assegnati:       ${interroga(url, "select count(*) from user_roles;")}`);
console.log("");
console.log(`Database di prova ricostruito da zero. Resoconto: ${registro}`);

// ---------------------------------------------------------------------
// 5. Lo stato di partenza.
//
// ⚠️ Ricostruito da zero, il progetto di prova è VUOTO — ed è la
// condizione in cui le verifiche dicono verde senza aver verificato
// niente (14/08, 15/08 e 16/08: tre volte la stessa lezione). Quindi la
// ricostruzione non finisce col database vuoto: finisce con lo stato di
// partenza rimesso.
//
// ⚠️ E se non riesce, si dice e non si nasconde: la ricostruzione è
// comunque riuscita, ma un progetto di prova senza stato di partenza è
// mezzo strumento — e chi crede di averlo intero non lo controlla.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 4bis. LA SALA SI RIPRENDE DALLA PRODUZIONE (giro A, decisione di Alessio
//       del 18/08).
//
// ⚠️ Perché non congelata nello stato di partenza e non esportata a mano:
// le due strade hanno lo stesso difetto in due versi. Congelata diventa
// «una sala decisa una volta», e il giorno che lui la cambia la
// ricostruzione gliela riporta indietro — lo stesso difetto di prima, solo
// più difficile da vedere perché sembra voluto. Esportata a mano è un gesto
// che ci si ricorda di fare solo dopo aver perso il lavoro.
//
// La sala vera vive in produzione: presa da lì non invecchia mai e resta di
// Alessio senza che lui faccia niente. È lo stesso criterio di
// `prova:stato` — l'elenco non lo scegliamo noi, lo leggiamo dal locale
// vero.
//
// ⚠️ SOLO `dining_tables`, mai `disposizioni_giornaliere`: i secondi sono
// lo scostamento di UNA giornata, e copiarli porterebbe qui la disposizione
// di un martedì.
//
// ⚠️ E la produzione si tocca in SOLA LETTURA. La guardia è la stessa di
// `prova:stato`: se quella stringa non punta al progetto del locale, il
// confronto non avrebbe senso — e qui sarebbe peggio, perché scriveremmo
// una sala presa da chissà dove.
// ---------------------------------------------------------------------
titolo("Riprendo la sala dalla produzione");
const urlVero = config.DB_URL_PRODUZIONE;
if (!urlVero) {
  console.log("   DB_URL_PRODUZIONE non e' configurata: la sala resta quella della migrazione.");
  console.log("   ⚠ Vuol dire che la disposizione «di sempre» di Alessio NON e' tornata.");
} else if (!urlVero.includes(REF_PRODUZIONE)) {
  console.log("   ⚠ DB_URL_PRODUZIONE non punta al progetto del locale: non la leggo.");
  console.log("     Meglio una sala vecchia che una sala presa da un database sconosciuto.");
} else {
  // Le sagome come righe pronte da riapplicare: `on conflict do update`
  // aggiorna quelle che la migrazione ha appena creato, invece di
  // duplicarle. Le colonne aggiornate sono quelle che Alessio muove.
  const righe = interroga(
    urlVero,
    `select 'update dining_tables set x=' || x || ', y=' || y
         || ', ruotato=' || ruotato || ', zona=' || quote_literal(zona)
         || ', larghezza_cm=' || larghezza_cm || ', profondita_cm=' || profondita_cm
         || ' where label=' || quote_literal(label) || ';'
       from dining_tables order by label;`
  ).trim();
  const quante = righe.split("\n").filter(Boolean).length;
  if (quante === 0) {
    console.log("   In produzione non c'e' nessuna sagoma: non c'e' niente da riprendere.");
  } else {
    sql(righe, "Il ripristino della sala dalla produzione");
    // ⚠️ Si CONTA quello che si è mosso, non si dà per fatto: è la regola
    // del 16/08 — ogni sanatoria dichiara quante righe ha toccato.
    console.log(`   sagome riprese dalla produzione: ${quante}`);
    console.log(`   sagome ora sul progetto di prova: ${interroga(url, "select count(*) from dining_tables;").trim()}`);
  }
}

titolo("Rimetto lo stato di partenza");
const base = esegui(process.execPath, ["scripts/prova-base.mjs", "--rifai"]);
if (!base.ok) {
  console.log("");
  console.log("  ⚠ La ricostruzione è riuscita, ma lo stato di partenza NON si è costruito.");
  console.log("    Sopra c'è il motivo. Si riprova con:  npm run prova:base -- --rifai");
  console.log("");
  process.exit(1);
}
console.log("");
