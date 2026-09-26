import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// LA RICORRENZA PORTA CON SÉ L'AVVISO — 20/09/2026
// =====================================================================
// 🔴 IL DIFETTO CHE QUESTA PROVA SORVEGLIA: `completa_task` rigenerava il
//    task successivo elencando tredici colonne, e `remind_at` non era fra
//    quelle. Chi si era messo un avviso un'ora prima se lo ritrovava solo
//    la prima volta — e senza nessun segnale, perché il task nuovo era
//    perfetto in tutto il resto.
//
// ⚠️ QUESTA PROVA GUARDA IL FILE, NON IL DATABASE, ed è una scelta con un
//    limite dichiarato: la prova che la regola FUNZIONA sta dentro la
//    verifica della migrazione, che chiama le funzioni su date inventate.
//    Qui si tiene fermo ciò che quella verifica non può difendere da sola —
//    che la colonna resti nell'elenco il giorno che qualcuno riscrive la
//    funzione — e si può fare senza un database acceso, quindi gira a ogni
//    commit.

const FILE = new URL(
  "../../supabase/migrations/20260920000003_la_ricorrenza_porta_con_se_l_avviso.sql",
  import.meta.url,
);
const sql = readFileSync(FILE, "utf8");

/** Il pezzo di `completa_task` che scrive il task successivo. */
const insertDelSuccessivo = () => {
  const da = sql.indexOf("insert into tasks (title, description, due_date");
  expect(da, "l'insert del task successivo non si trova più").toBeGreaterThan(-1);
  const a = sql.indexOf("returning id into v_nuovo", da);
  expect(a).toBeGreaterThan(da);
  return sql.slice(da, a);
};

/**
 * Le sole COLONNE scritte, senza i valori.
 *
 * 🔴 SENZA QUESTO TAGLIO LA PROVA NON PROVAVA NIENTE (scoperto rompendo, non
 *    rileggendo): togliendo `remind_at` dall'elenco delle colonne la prova
 *    restava verde, perché la parola compariva comunque nei valori, dentro
 *    `avviso_del_successivo(v_t.remind_at, …)`. È il difetto che la
 *    migrazione chiude, e la prova non lo vedeva.
 */
const colonneDelSuccessivo = () => {
  const blocco = insertDelSuccessivo();
  const fine = blocco.indexOf("values (");
  expect(fine, "l'insert non ha più una lista di valori").toBeGreaterThan(-1);
  return blocco.slice(0, fine);
};

describe("🔴 il task rigenerato porta l'avviso", () => {
  it("`remind_at` è fra le colonne scritte, e il valore lo calcola la regola", () => {
    expect(colonneDelSuccessivo(), "remind_at non è più fra le colonne del task nuovo").toMatch(
      /remind_at/,
    );
    expect(insertDelSuccessivo(), "il valore dell'avviso non passa dalla regola").toMatch(
      /avviso_del_successivo\(v_t\.remind_at, v_t\.due_date, v_data, v_t\.due_time\)/,
    );
  });

  it("⚠️ e `reminder_sent_at` NON si copia: nascerebbe muto per sempre", () => {
    // 🔴 È l'errore vicino a quello giusto: copiare «l'avviso» per intero
    //    porterebbe dietro anche il segno «ho già avvisato», e il giro dei
    //    promemoria salterebbe quel task per sempre.
    expect(insertDelSuccessivo()).not.toMatch(/reminder_sent_at/);
  });
});

describe("🔴 la regola dell'anticipo dice di no quando deve", () => {
  const regola = () => {
    const da = sql.indexOf("create or replace function avviso_del_successivo");
    expect(da).toBeGreaterThan(-1);
    return sql.slice(da, sql.indexOf("$funzione$;", da));
  };

  it("senza avviso non se ne inventa uno", () => {
    expect(regola()).toMatch(/when p_avviso_vecchio is null then null/);
  });

  it("senza una scadenza da cui misurare, nessun avviso", () => {
    // Un task che si ripete ma non ha scadenza fa nascere il successivo
    // contando da oggi: lì «un'ora prima di cosa» non ha risposta.
    expect(regola()).toMatch(/p_scadenza_vecchia is null or p_scadenza_nuova is null then null/);
  });

  it("⚠️ e l'anticipo è una DISTANZA, non un'ora del giorno", () => {
    // Ricopiare la sola ora sbaglierebbe tutti gli avvisi che stanno su un
    // altro giorno («la sera prima»), e non darebbe nessun errore.
    expect(regola()).toMatch(
      /istante_della_scadenza\(p_scadenza_nuova, p_ora\)\s*\+\s*\(p_avviso_vecchio - istante_della_scadenza\(p_scadenza_vecchia, p_ora\)\)/,
    );
  });
});

describe("🔴 i due istanti si compongono a Roma", () => {
  it("l'ora e la data diventano un istante nel fuso del locale", () => {
    // ⚠️ È la trappola più vecchia del progetto: `due_date` è una data e
    //    `due_time` un orario senza fuso, mentre `remind_at` è un istante.
    //    Sommarli a Greenwich sposterebbe ogni avviso di un'ora o due, e
    //    l'ora legale cambia due volte l'anno.
    const da = sql.indexOf("create or replace function istante_della_scadenza");
    expect(da).toBeGreaterThan(-1);
    const corpo = sql.slice(da, sql.indexOf("$funzione$;", da));
    expect(corpo).toMatch(/at time zone 'Europe\/Rome'/);
    expect(corpo, "un giorno che manca deve dare vuoto, non un istante inventato").toMatch(
      /when p_giorno is null then null/,
    );
  });
});

describe("⚠️ la migrazione si rifiuta invece di indovinare", () => {
  it("si ferma se il corpo vivo non è quello atteso, e se è già stata applicata", () => {
    expect(sql).toMatch(/GUARDIA: completa_task non esiste/);
    expect(sql).toMatch(/GUARDIA: la funzione viva non conosce la cadenza/);
    expect(sql).toMatch(/GUARDIA: la funzione viva nomina già l''avviso/);
  });

  it("e si registra con la propria versione", () => {
    expect(sql).toMatch(/values \('20260920000003', 'la_ricorrenza_porta_con_se_l_avviso'\)/);
  });
});
