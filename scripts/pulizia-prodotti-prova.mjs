// =====================================================================
// I PRODOTTI LASCIATI DALLE PROVE SUL PROGETTO DI PROVA — 26/09/2026
// =====================================================================
//
// PERCHE' ESISTE. Dal 01/09 due prove automatiche (`prodotto-fermo`,
// `allineamento-magazzino`) creavano un prodotto nuovo a ogni giro e lo
// lasciavano attivo. Misurato il 26/09 sul progetto di prova: 1255 prodotti
// «TEST-AUTO … #giro» su 1388, collegati soltanto a scarichi di magazzino e
// a rettifiche di giacenza. Gli elenchi, tagliati a mille righe, non
// mostravano più undici prodotti veri. Le prove adesso li mettono da parte
// a fine giro; questo comando toglie quelli accumulati prima.
//
// 🔴 NON E' AUTOMATICO E NON E' UNA MIGRAZIONE. Non lo lancia la coda di
//    GitHub, non lo lancia nessuna prova, non parte a un'unione. Una
//    cancellazione una-tantum dentro una migrazione arriverebbe un giorno
//    anche in produzione: qui vive fuori, e si lancia a mano.
//
// ⚠️ DI NORMA LEGGE SOLTANTO. Senza `--applica` la transazione e' in sola
//    lettura: conta, controlla i guardiani, e non cambia niente.
//
// ⚠️ SI RIFIUTA DI PARTIRE SE NON E' IL PROGETTO DI PROVA, e non stampa
//    mai la stringa di collegamento.
//
// ⚠️ UNA SOLA TRANSAZIONE: `psql --single-transaction` con ON_ERROR_STOP.
//    Ogni guardiano che scatta solleva un'eccezione, e allora non resta
//    cambiato niente — neppure quello che era gia' stato cancellato.
//
// ⚠️ RICONOSCE SOLO DUE NOMI, E SOLO COL MARCHIO DEL GIRO (`#…`): i cinque
//    «TEST-AUTO» senza marchio, piu' vecchi, restano dove sono.
//
// ⚠️ LE RELAZIONI SI CERCANO NEL CATALOGO, non in un elenco scritto a mano:
//    ogni chiave esterna verso `ingredients`, e ogni chiave esterna verso le
//    due tabelle figlie. Se un prodotto marcato e' collegato a qualunque
//    altra cosa (ricette, documenti, fornitori, liste, ordini, allergeni,
//    foto…) il comando si ferma e dice dove.
//
// Uso:   npm run pulizia:prodotti-prova                 (sola lettura)
//        npm run pulizia:prodotti-prova -- --applica    (cancella)

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  REF_PRODUZIONE,
  REF_PROVA,
  esegui,
  leggiConfigurazione,
  obbligatorio,
  strumento,
} from "./comune.mjs";
import { frasePerChiAspetta, lascia, prendi } from "./un-giro-per-volta.mjs";

/** I due nomi, col marchio del giro obbligatorio. */
export const REGEX_MARCATI = "^TEST-AUTO (prodotto fermo|allineamento)#[0-9a-z]+( [a-z]+)?$";

/** Oltre questo numero non e' piu' «il residuo misurato»: ci si ferma. */
export const MASSIMO_MARCATI = 1500;

/** Le sole relazioni misurate il 26/09. Tutte le altre devono essere zero. */
export const RELAZIONI_AMMESSE = [
  ["stock_consumptions", "ingredient_id"],
  ["rettifiche_giacenza", "ingredient_id"],
];

/**
 * Questa stringa di collegamento e' il progetto di prova?
 * 🔴 Non basta «non e' la produzione»: si pretende il riferimento ATTESO.
 * Restituisce la frase del problema, o null. Non ripete mai la stringa.
 */
export function problemaDelBersaglio(url) {
  const u = String(url || "").trim();
  if (!u) return "manca DB_URL_PROVA nel file .env";
  if (u.includes(REF_PRODUZIONE)) return "la stringa di collegamento punta al database VERO";
  if (!u.includes(REF_PROVA)) return "la stringa di collegamento non e' quella del progetto Borgo58-Prova";
  return null;
}

/** Il testo SQL. `applica` falso: transazione in sola lettura. */
export function sqlDellaPulizia({ applica }) {
  const ammesse = RELAZIONI_AMMESSE.map(([t, c]) => `('${t}','${c}')`).join(", ");
  return `${applica ? "" : "set transaction read only;\n"}set local statement_timeout = '300s';
do $pulizia$
declare
  v_applica   boolean := ${applica ? "true" : "false"};
  v_regex     text := '${REGEX_MARCATI}';
  v_ids       uuid[];
  v_marcati   integer;
  v_fermo     integer;
  v_alli      integer;
  v_attivi    integer;
  v_senza     integer;
  v_tot       integer;
  v_migr      integer;
  v_lapidi    bigint;
  v_n         bigint;
  v_attese    jsonb := '{}';
  v_inattese  text[] := '{}';
  v_figli     text[];
  v_tolte     jsonb := '{}';
  r           record;
  f           record;
begin
  select count(*) into v_tot from ingredients;
  select count(*) into v_migr from applied_migrations;
  select count(*) into v_lapidi from deleted_records;

  select coalesce(array_agg(id), '{}'),
         count(*),
         count(*) filter (where name like 'TEST-AUTO prodotto fermo%'),
         count(*) filter (where name like 'TEST-AUTO allineamento%'),
         count(*) filter (where active)
    into v_ids, v_marcati, v_fermo, v_alli, v_attivi
    from ingredients where name ~ v_regex;

  -- Quelli coi due nomi ma senza il marchio del giro: restano, si contano.
  select count(*) into v_senza from ingredients
   where (name like 'TEST-AUTO prodotto fermo%' or name like 'TEST-AUTO allineamento%')
     and name !~ v_regex;

  if v_marcati > ${MASSIMO_MARCATI} then
    raise exception 'FERMO: % prodotti marcati, oltre il tetto di ${MASSIMO_MARCATI}', v_marcati;
  end if;

  -- 1. Ogni chiave esterna verso i prodotti, letta dal catalogo.
  for r in
    select n.nspname as schema, cl.relname as tabella, c.conkey,
           (select a.attname from pg_attribute a
             where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as colonna
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where c.contype = 'f' and c.confrelid = 'public.ingredients'::regclass
  loop
    if array_length(r.conkey, 1) <> 1 then
      v_inattese := v_inattese || format('%s.%s: chiave su piu'' colonne', r.schema, r.tabella);
      continue;
    end if;
    execute format('select count(*) from %I.%I where %I = any($1)', r.schema, r.tabella, r.colonna)
      into v_n using v_ids;
    if r.schema = 'public' and (r.tabella, r.colonna) in (${ammesse}) then
      v_attese := v_attese || jsonb_build_object(r.tabella, v_n);
    elsif v_n > 0 then
      v_inattese := v_inattese || format('%s.%s.%s: %s righe', r.schema, r.tabella, r.colonna, v_n);
    end if;
  end loop;

  -- 2. Colonne che nominano un prodotto SENZA chiave esterna: devono tacere.
  for r in
    select c.table_schema as schema, c.table_name as tabella, c.column_name as colonna
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.data_type = 'uuid' and c.column_name ~ 'ingredien'
       and not exists (
         select 1 from pg_constraint k
          where k.contype = 'f' and k.confrelid = 'public.ingredients'::regclass
            and k.conrelid = format('%I.%I', c.table_schema, c.table_name)::regclass
            and (select a.attname from pg_attribute a where a.attrelid = k.conrelid and a.attnum = k.conkey[1]) = c.column_name)
  loop
    execute format('select count(*) from %I.%I where %I = any($1)', r.schema, r.tabella, r.colonna)
      into v_n using v_ids;
    if v_n > 0 then
      v_inattese := v_inattese || format('%s.%s (senza chiave esterna): %s righe', r.tabella, r.colonna, v_n);
    end if;
  end loop;

  -- 3. Chi punta alle righe figlie che verrebbero tolte: deve essere nessuno.
  for f in select * from (values ${ammesse}) as v(tabella, colonna) loop
    for r in
      select n.nspname as schema, cl.relname as tabella,
             (select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as colonna,
             (select a.attname from pg_attribute a where a.attrelid = c.confrelid and a.attnum = c.confkey[1]) as bersaglio
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid
        join pg_namespace n on n.oid = cl.relnamespace
       where c.contype = 'f' and c.confrelid = format('public.%I', f.tabella)::regclass
    loop
      execute format(
        'select count(*) from %I.%I where %I in (select %I from public.%I where %I = any($1))',
        r.schema, r.tabella, r.colonna, r.bersaglio, f.tabella, f.colonna)
        into v_n using v_ids;
      if v_n > 0 then
        v_inattese := v_inattese || format('%s.%s -> %s: %s righe', r.tabella, r.colonna, f.tabella, v_n);
      end if;
    end loop;
  end loop;

  -- 4. Il registro delle cancellazioni: una traccia con dentro «verifica»
  --    renderebbe rossa per sempre la prova che lo sorveglia.
  for f in select * from (values ('ingredients','id'), ${ammesse}) as v(tabella, colonna) loop
    execute format('select count(*) from public.%I x where x.%I = any($1) and x::text ilike ''%%verifica%%''',
                   f.tabella, f.colonna)
      into v_n using v_ids;
    if v_n > 0 then
      v_inattese := v_inattese || format('%s: %s righe con «verifica» nel testo', f.tabella, v_n);
    end if;
  end loop;

  if array_length(v_inattese, 1) > 0 then
    raise exception 'FERMO: relazioni inattese — %', array_to_string(v_inattese, '; ');
  end if;

  if v_applica then
    for f in select * from (values ${ammesse}) as v(tabella, colonna) loop
      execute format('delete from public.%I where %I = any($1)', f.tabella, f.colonna) using v_ids;
      get diagnostics v_n = row_count;
      if v_n <> (v_attese ->> f.tabella)::bigint then
        raise exception 'FERMO: da % ne sono uscite % invece di %', f.tabella, v_n, v_attese ->> f.tabella;
      end if;
      v_tolte := v_tolte || jsonb_build_object(f.tabella, v_n);
    end loop;

    delete from ingredients where id = any(v_ids);
    get diagnostics v_n = row_count;
    if v_n <> v_marcati then
      raise exception 'FERMO: prodotti tolti % invece di %', v_n, v_marcati;
    end if;
    v_tolte := v_tolte || jsonb_build_object('ingredients', v_n);

    -- Controlli dopo, dentro la stessa transazione.
    if (select count(*) from ingredients where name ~ v_regex) <> 0 then
      raise exception 'FERMO: dopo la pulizia restano prodotti marcati';
    end if;
    if (select count(*) from ingredients) <> v_tot - v_marcati then
      raise exception 'FERMO: il totale dei prodotti non e'' sceso esattamente di %', v_marcati;
    end if;
    if (select count(*) from ingredients
         where (name like 'TEST-AUTO prodotto fermo%' or name like 'TEST-AUTO allineamento%')
           and name !~ v_regex) <> v_senza then
      raise exception 'FERMO: e'' sparito un prodotto senza marchio';
    end if;
    if (select count(*) from applied_migrations) <> v_migr then
      raise exception 'FERMO: il registro delle migrazioni e'' cambiato';
    end if;
  end if;

  raise notice 'ESITO %', jsonb_build_object(
    'modo', case when v_applica then 'applica' else 'sola lettura' end,
    'prodotti_prima', v_tot,
    'marcati', v_marcati,
    'marcati_prodotto_fermo', v_fermo,
    'marcati_allineamento', v_alli,
    'marcati_ancora_attivi', v_attivi,
    'senza_marchio_lasciati', v_senza,
    'relazioni_ammesse', v_attese,
    'tolte', v_tolte,
    'prodotti_dopo', (select count(*) from ingredients),
    'tracce_nel_registro_nuove', (select count(*) from deleted_records) - v_lapidi,
    'migrazioni', v_migr
  );
end $pulizia$;
`;
}

/** L'esito che la transazione dichiara di se', o null. */
export function leggiEsito(uscita) {
  const m = /ESITO\s+(\{.*\})/.exec(String(uscita || ""));
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Solo le righe d'errore di psql: mai la stringa di collegamento. */
export function righeDiErrore(uscita) {
  return String(uscita || "")
    .split(/\r?\n/)
    .filter((r) => /ERROR|ERRORE|FERMO/.test(r))
    .map((r) => r.replace(/postgres(ql)?:\/\/\S+/g, "[collegamento]"));
}

function principale() {
  const applica = process.argv.includes("--applica");
  const url = obbligatorio(
    leggiConfigurazione(".env"),
    "DB_URL_PROVA",
    "E' la stringa 'Session pooler' del progetto Borgo58-Prova.",
  );
  const problema = problemaDelBersaglio(url);
  if (problema) {
    console.error(`FERMO: ${problema}. Non ho toccato niente.`);
    process.exit(1);
  }

  const lucchetto = prendi();
  if (!lucchetto.preso) {
    console.error(frasePerChiAspetta(lucchetto.altrui));
    process.exit(1);
  }

  const cartella = mkdtempSync(path.join(tmpdir(), "borgo58-pulizia-"));
  const file = path.join(cartella, "pulizia.sql");
  try {
    writeFileSync(file, sqlDellaPulizia({ applica }), "utf8");
    const r = esegui(
      strumento("psql"),
      ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-d", url, "-f", file],
      { silenzioso: true },
    );
    const esito = leggiEsito(r.uscita);
    if (!r.ok || !esito) {
      console.error("FERMO: la transazione non e' andata a buon fine, e non ha cambiato niente.");
      for (const riga of righeDiErrore(r.uscita)) console.error(`  ${riga}`);
      process.exit(1);
    }
    console.log(JSON.stringify(esito, null, 2));
  } finally {
    rmSync(cartella, { recursive: true, force: true });
    lascia();
  }
}

if (process.argv[1] && process.argv[1].endsWith("pulizia-prodotti-prova.mjs")) {
  principale();
}
