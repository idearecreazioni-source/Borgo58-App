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
       case when email in ('alessio@borgo58.app', 'test-titolare@borgo58.app')
            then 'titolare' else 'staff' end
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
if (azzera) {
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
esegui(
  psql,
  [
    "-v", "ON_ERROR_STOP=1",
    "-v", `chiave=${chiaveAnon}`,
    "-d", url,
    "-c",
    `select vault.create_secret(:'chiave', 'chiave_anon', 'Chiave pubblica del progetto di prova.')
     where not exists (select 1 from vault.secrets where name = 'chiave_anon');`,
  ],
  { silenzioso: true }
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
console.log("");
