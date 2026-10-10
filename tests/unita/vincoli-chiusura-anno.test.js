import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// I DUE VINCOLI DELLA CHIUSURA PARLANO ITALIANO — C5, 23/09/2026
// =====================================================================
// 🔴 IL BUCO, ED ERA MIO. Nella `20260923000003` avevo scritto la frase
//    italiana per i quattro vincoli `check` — quelli che limitano un
//    valore — e non per le altre due forme: l'unicità su società + anno e
//    la chiave esterna verso il soggetto. La regola del 25/08 riguardava i
//    `check`, ed è stata **allargata il 28/08** a unicità e chiavi esterne.
//    *Correggere un esemplare non chiude la famiglia.*
//
// ⚠️ A trovarlo è stata `tests/app/vincoli-che-parlano.test.js`, diventata
//    rossa da sola appena C5 è entrata sul progetto di prova, e ha nominato
//    tutt'e due i colpevoli. Non una rilettura.

const FILE =
  "supabase/migrations/20260923000004_i_due_vincoli_della_chiusura_parlano_italiano.sql";
const SQL = readFileSync(FILE, "utf8");
// Il codice, coi commenti tolti: un setaccio che cerca una forma nel testo
// trova anche chi la nomina per spiegarla (27/08).
const codice = SQL.replace(/--[^\n]*/g, "");

describe("le due frasi ci sono, e sono in italiano", () => {
  it("🔴 si scrivono due `comment on constraint` su chiusure_annuali", () => {
    const quanti = (codice.match(/comment on constraint %I on chiusure_annuali/g) ?? []).length;
    expect(quanti, "i comment on constraint scritti").toBe(2);
  });

  it("🔴 e la frase dell'unicità dice che un anno si fotografa una volta sola", () => {
    expect(codice).toMatch(/gia'' stato chiuso per questa societa''/);
    expect(codice).toMatch(/si cancella e si richiude/);
  });

  it("🔴 e quella del legame dice che i soggetti restano separati", () => {
    expect(codice).toMatch(/intestata a una societa'' che non esiste/);
    expect(codice).toMatch(/i due restano separati/);
  });

  it("⚠️ nessuna delle due frasi è in inglese", () => {
    // Un controllo grossolano ma utile: le frasi di questo progetto non
    // contengono le parole che Postgres usa nei propri messaggi.
    expect(codice).not.toMatch(/violates|constraint failed|duplicate key/i);
  });
});

describe("🔴 i nomi vengono dal CATALOGO, non da una regola indovinata", () => {
  it("i due vincoli si cercano per struttura, e il nome si legge da pg_constraint", () => {
    // ⚠️ I due nomi li ha scelti Postgres, non noi. Scriverli a mano
    //    vorrebbe dire fidarsi di una regola di costruzione invece di
    //    guardare — e un nome sbagliato non darebbe un errore utile.
    expect(codice).toMatch(/from pg_constraint c\s*\n\s*where c\.conrelid = 'chiusure_annuali'::regclass/);
    expect(codice).toMatch(/c\.contype = 'u'/);
    expect(codice).toMatch(/c\.contype = 'f'/);
    expect(codice).toMatch(/c\.confrelid = 'entities'::regclass/);
  });

  it("⚠️ e NON compare nessun nome generato scritto a mano", () => {
    // Se un domani qualcuno li incollasse qui dentro, questa prova lo dice:
    // il giorno che la tabella venisse ricostruita con nomi diversi, la
    // migrazione fallirebbe senza spiegare perché.
    expect(codice).not.toMatch(/chiusure_annuali_entity_id_anno_key/);
    expect(codice).not.toMatch(/chiusure_annuali_entity_id_fkey/);
  });

  it("l'istruzione si compone con format, non concatenando testo", () => {
    expect(codice).toMatch(/execute format\(\s*\n?\s*'comment on constraint %I on chiusure_annuali is %L'/);
  });
});

describe("🔴 si ferma rumorosamente se la struttura non è quella attesa", () => {
  it("l'unicità dev'essere ESATTAMENTE su (entity_id, anno)", () => {
    expect(codice).toMatch(/v_cols is distinct from 'entity_id,anno'/);
    expect(codice).toMatch(/raise exception 'L''unicita'' di chiusure_annuali non e'' su \(entity_id, anno\)/);
  });

  it("⚠️ e dev'essercene una sola: con due, non si saprebbe quale spiegare", () => {
    expect(codice).toMatch(/piu'' di un''unicita''/);
  });

  it("il legame dev'essere da entity_id verso entities, e restare «restrict»", () => {
    expect(codice).toMatch(/= 'entity_id'/);
    expect(codice).toMatch(/if v_del <> 'r' then/);
    expect(codice).toMatch(/la spiegazione che sto per scrivere sarebbe falsa/);
  });

  it("e se uno dei due non c'è, non si commenta qualcos'altro", () => {
    expect(codice).toMatch(/if v_unico is null then/);
    expect(codice).toMatch(/if v_legame is null then/);
    expect(codice).toMatch(/Mi fermo invece di commentare qualcos''altro/);
  });
});

describe("🔴 aggiunge e basta: non tocca niente di C5", () => {
  it("nessun vincolo eliminato, ricreato, rinominato o allargato", () => {
    expect(codice).not.toMatch(/drop\s+constraint/i);
    expect(codice).not.toMatch(/add\s+constraint/i);
    expect(codice).not.toMatch(/rename\s+constraint/i);
    expect(codice).not.toMatch(/alter\s+table/i);
  });

  it("nessuna tabella, funzione, policy, permesso o trigger toccato", () => {
    expect(codice).not.toMatch(/create\s+(or\s+replace\s+)?(table|function|view|trigger|policy)/i);
    expect(codice).not.toMatch(/drop\s+(table|function|view|trigger|policy)/i);
    expect(codice).not.toMatch(/\bgrant\b|\brevoke\b/i);
    expect(codice).not.toMatch(/\bcascade\b/i);
  });

  it("nessuna scrittura di dati", () => {
    // L'unico `insert` è quello con cui la migrazione si registra.
    const insert = (codice.match(/insert into/gi) ?? []).length;
    expect(insert).toBe(1);
    expect(codice).toMatch(/insert into applied_migrations/);
    expect(codice).not.toMatch(/update\s+\w+\s+set/i);
    expect(codice).not.toMatch(/delete\s+from/i);
  });

  it("⚠️ e NON introduce logica nuova per cambiare la lingua dell'errore", () => {
    // 🔴 Un `comment on constraint` DOCUMENTA il vincolo: non cambia da sé
    //    la lingua del messaggio di Postgres. La traduzione la fa il punto
    //    unico da cui passano le richieste dell'app, che legge proprio
    //    questo commento. Mettere qui un trigger per riscrivere il
    //    messaggio sarebbe un lavoro diverso — e una seconda definizione
    //    della stessa cosa.
    expect(codice).not.toMatch(/create\s+trigger/i);
    expect(codice).not.toMatch(/raise\s+exception\s+using/i);
    // ⚠️ Il limite è scritto nella migrazione, e va cercato senza pretendere
    //    che stia su una riga sola: fra «da se'» e «la lingua» c'è un a capo
    //    e il trattino del commento (trappola del 27/08).
    expect(SQL).toMatch(/non cambia da se'/);
    expect(SQL).toMatch(/la lingua dell'errore che Postgres solleva/);
  });

  it("🔴 e la migrazione già applicata non viene riscritta", () => {
    const c5 = readFileSync(
      "supabase/migrations/20260923000003_la_chiusura_dell_anno_fiscale.sql",
      "utf8",
    );
    // C5 continua a NON avere le due frasi: la riparazione vive qui.
    expect(c5).not.toMatch(/comment on constraint chiusure_annuali_entity_id/);
    expect(c5).not.toMatch(/comment on constraint %I/);
    // E i suoi quattro check hanno ancora la loro.
    expect((c5.match(/comment on constraint chiusura_annuale_/g) ?? []).length).toBe(4);
  });

  it("⚠️ ed è la prima migrazione dopo C5", () => {
    const tutte = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const c5 = tutte.find((f) => f.startsWith("20260923000003"));
    const dopo = tutte.filter((f) => f > c5).sort();
    expect(dopo[0], `la prima dopo C5 e': ${dopo[0]}`).toBe(
      "20260923000004_i_due_vincoli_della_chiusura_parlano_italiano.sql",
    );
  });
});

describe("🔴 la rete che l'ha trovato non viene indebolita", () => {
  const rete = readFileSync("tests/app/vincoli-che-parlano.test.js", "utf8");

  it("continua a pretendere ZERO vincoli muti, in tutt'e due i controlli", () => {
    // ⚠️ La scorciatoia era iscrivere i due fra i «muti noti», cioè
    //    dichiarare lecito un buco invece di chiuderlo.
    const zeri = (rete.match(/\)\.toEqual\(\[\]\)/g) ?? []).length;
    expect(zeri, "i controlli che pretendono zero vincoli muti").toBeGreaterThanOrEqual(2);
    expect(rete).not.toMatch(/chiusure_annuali/);
    expect(rete).not.toMatch(/\.skip\b|skipIf/);
  });

  it("e lo stato di partenza congelato non è stato allargato", () => {
    const mig = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const nuove = mig.filter((f) => f.startsWith("2026092300000"));
    for (const f of nuove) {
      const t = readFileSync(`supabase/migrations/${f}`, "utf8").replace(/--[^\n]*/g, "");
      expect(t, `${f} scrive in vincoli_muti_noti`).not.toMatch(/insert into vincoli_muti_noti/i);
    }
  });
});
