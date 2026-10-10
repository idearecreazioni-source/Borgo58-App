import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// LA VISTA DEI COSTI TORNA A RISPETTARE LA RLS — 23/09/2026
// =====================================================================
// 🔴 IL DIFETTO. R12 riscrive `v_recipe_row_costs` con
//    `create or replace view`, prendendo il corpo da `pg_get_viewdef()`.
//    Quella funzione restituisce **la query, non le opzioni della vista**,
//    e `create or replace view` senza `with (...)` le azzera: e' sparito
//    `security_invoker`, e la vista ha ripreso a girare coi permessi del
//    proprietario — scavalcando la RLS ed esponendo `costo`, cioe' i
//    prezzi d'acquisto.
//
// ⚠️ E LA FRASE ERA GIA' SCRITTA nel progetto, dal 04/09: «la rete serve
//    perche' l'elenco non cresca in silenzio: `create or replace view`
//    perde l'opzione senza dare errore». *Una trappola scritta non e' una
//    trappola chiusa.*
//
// ⚠️ A trovarlo e' stata `tests/app/permessi.test.js`, diventata rossa da
//    sola: «solo 8 viste scavalcano la RLS» ne ha trovate 9, e ha nominato
//    la colonna esposta. Non l'ha trovato una rilettura.

const FILE = "supabase/migrations/20260923000001_la_vista_dei_costi_torna_a_rispettare_la_rls.sql";
const SQL = readFileSync(FILE, "utf8");
// Il codice, coi commenti tolti: un setaccio che cerca una forma nel testo
// trova anche chi la nomina per spiegarla (27/08).
const codice = SQL.replace(/--[^\n]*/g, "");

describe("la riparazione cambia SOLO l'opzione persa", () => {
  it("🔴 rimette `security_invoker` con `alter view`", () => {
    expect(codice).toMatch(
      /alter view v_recipe_row_costs set \(\s*security_invoker\s*=\s*true\s*\)/,
    );
  });

  it("🔴 e NON riscrive la vista: niente create or replace, drop o cascade", () => {
    // ⚠️ Il corpo della vista è giusto — quello che R12 ha fatto al suo
    //    interno è voluto. A mancare era una sola opzione.
    // ⚠️ E ricrearla sarebbe più pericoloso: vorrebbe dire rifarne i
    //    permessi a memoria, che è la trappola del 24/08 da cui questo
    //    difetto viene.
    expect(codice).not.toMatch(/create\s+(or\s+replace\s+)?view/i);
    expect(codice).not.toMatch(/drop\s+view/i);
    expect(codice).not.toMatch(/\bcascade\b/i);
  });

  it("🔴 e non si «cura» con permessi o policy", () => {
    expect(codice).not.toMatch(/\bgrant\b/i);
    expect(codice).not.toMatch(/\brevoke\b/i);
    expect(codice).not.toMatch(/create\s+policy/i);
    expect(codice).not.toMatch(/alter\s+policy/i);
    expect(codice).not.toMatch(/drop\s+policy/i);
    expect(codice).not.toMatch(/row level security/i);
  });

  it("⚠️ e non tocca il corpo della vista né altre tabelle", () => {
    // L'unica istruzione che cambia qualcosa dev'essere l'`alter view`.
    const istruzioni = codice
      .split(";")
      .map((i) => i.trim())
      .filter((i) => /^(alter|create|drop|update|delete|insert)\b/i.test(i));
    // `alter view`, il `do $verifica$` non conta (non comincia per quelle
    // parole) e l'`insert` di registrazione.
    expect(istruzioni.length, `istruzioni trovate: ${istruzioni.length}`).toBe(2);
    expect(istruzioni[0]).toMatch(/^alter view v_recipe_row_costs set/i);
    expect(istruzioni[1]).toMatch(/^insert into applied_migrations/i);
  });
});

describe("la verifica dentro la migrazione guarda l'OPZIONE, non la parola", () => {
  it("🔴 legge il VALORE dell'opzione, non la sua presenza", () => {
    // ⚠️ Postgres conserva l'opzione com'è stata scritta, e `on`, `1`,
    //    `yes` sono veri quanto `true`: un controllo su
    //    `= 'security_invoker=true'` direbbe «manca» su una vista protetta
    //    benissimo. È l'avvertenza scritta nella migrazione del 05/09.
    expect(codice).toMatch(/split_part\(o, '=', 2\)::boolean/);
    expect(codice).toMatch(/o like 'security_invoker=%'/);
    expect(codice).not.toMatch(/= 'security_invoker=true'/);
  });

  it("🔴 e NON si accontenta di cercare la parola in un commento", () => {
    // Il controllo deve interrogare `pg_class.reloptions`, cioè lo stato
    // vero dell'oggetto — non il testo di un `comment on`.
    expect(codice).toMatch(/pg_class/);
    expect(codice).toMatch(/reloptions/);
    expect(codice).not.toMatch(/pg_description|obj_description|comment on view/i);
  });

  it("fallisce se la vista non esiste", () => {
    expect(codice).toMatch(/if v_oid is null then/);
    expect(codice).toMatch(/La vista v_recipe_row_costs non esiste/);
  });

  it("🔴 e fallisce se l'opzione non è tornata attiva", () => {
    expect(codice).toMatch(/if not v_attiva then/);
    expect(codice).toMatch(/security_invoker NON e'' tornato attivo/);
    // E il messaggio dice cosa succederebbe, non solo che qualcosa manca.
    expect(codice).toMatch(/mostrando i costi d''acquisto/);
  });
});

describe("🔴 e la migrazione R12, già registrata, non viene toccata", () => {
  const R12 = "supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql";

  it("R12 continua a NON avere `security_invoker` sulla vista", () => {
    // ⚠️ Non è una svista lasciata lì: R12 è già applicata su Prova, e
    //    correggere il suo file non cambierebbe niente là dentro — le
    //    migrazioni non girano due volte. Lo renderebbe solo una bugia per
    //    chi ricostruirà da zero. *Una migrazione già applicata non si
    //    riscrive mai* (23/08): si ripara in avanti.
    const r12 = readFileSync(R12, "utf8");
    expect(r12).toMatch(/create or replace view v_recipe_row_costs as/);
    expect(r12).not.toMatch(/alter view v_recipe_row_costs/);
    expect(r12).not.toMatch(/v_recipe_row_costs\s+with\s*\(/);
  });

  it("⚠️ e la riparazione vive in una migrazione SUA, col numero dopo", () => {
    const tutte = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const r12 = tutte.find((f) => f.startsWith("20260922000001"));
    const cura = tutte.find((f) => f.startsWith("20260923000001"));
    expect(r12, "manca R12").toBeTruthy();
    expect(cura, "manca la riparazione").toBeTruthy();
    expect(cura > r12, "la riparazione deve venire dopo R12").toBe(true);
    // ⚠️ E dev'essere la PRIMA dopo R12: la riparazione di un difetto
    //    introdotto da R12 non si accoda in fondo a lavori successivi, o si
    //    perde di vista da cosa nasce.
    // 🔴 QUESTA RIGA PRETENDEVA «e nessun'altra dopo», ed era troppo
    //    stretta: il giorno dopo e' arrivata la migrazione del cambio
    //    d'unita' e questa prova e' diventata rossa per un lavoro
    //    legittimo. *Un controllo che vieta il futuro invece di descrivere
    //    una relazione grida su chi non ha fatto niente di male.*
    const dopoR12 = tutte.filter((f) => f > r12).sort();
    expect(dopoR12[0], `la prima dopo R12 e': ${dopoR12[0]}`).toBe(cura);
  });

  it("🔴 e la rete che l'ha trovato non viene indebolita", () => {
    // ⚠️ La scorciatoia era portare il conteggio atteso da 8 a 9, o
    //    iscrivere `v_recipe_row_costs` fra le aperture volute. Sarebbe
    //    stato dichiarare lecito un buco invece di chiuderlo.
    const rete = readFileSync("tests/app/permessi.test.js", "utf8");
    expect(rete).toMatch(/v_recipe_allergens/);
    expect(rete, "la rete ammette v_recipe_row_costs fra chi scavalca").not.toMatch(
      /["']v_recipe_row_costs["']/,
    );
  });
});
