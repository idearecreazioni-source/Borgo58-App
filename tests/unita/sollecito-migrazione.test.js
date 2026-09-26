import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// IL SOLLECITO — le proprietà che devono restare vere nel tempo
// =====================================================================
// ⚠️ QUESTA PROVA GUARDA IL FILE, e il limite è dichiarato: che la regola
//    FUNZIONI lo dimostra la verifica dentro la migrazione, che interroga
//    `istante_sollecito` su istanti inventati e chiude un ricorrente vero.
//    Qui si tiene fermo ciò che quella verifica non può difendere il giorno
//    che qualcuno riscrive il giro — e si può fare senza database, quindi
//    gira a ogni commit.

const sql = readFileSync(
  new URL("../../supabase/migrations/20260920000004_il_sollecito_finche_non_lo_chiudi.sql", import.meta.url),
  "utf8",
);

const funzione = (nome) => {
  const da = sql.indexOf(`create or replace function ${nome}`);
  expect(da, `${nome} non si trova`).toBeGreaterThan(-1);
  const a = sql.indexOf("$function$;", da) > -1 ? sql.indexOf("$function$;", da) : sql.length;
  const b = sql.indexOf("$funzione$;", da) > -1 ? sql.indexOf("$funzione$;", da) : sql.length;
  return sql.slice(da, Math.min(a, b));
};

describe("🔴 spento di suo, e spento su ciò che esiste già", () => {
  it("le due colonne nascono senza predefinito", () => {
    // 🔴 Un predefinito qui non è una comodità: è il gestionale che decide
    //    di mandare messaggi che nessuno ha chiesto, su task già scritti.
    expect(sql).toMatch(/add column if not exists sollecito_ogni smallint;/);
    expect(sql).toMatch(/add column if not exists sollecito_unita text;/);
    expect(sql).not.toMatch(/sollecito_ogni smallint[^;]*default/i);
    expect(sql).not.toMatch(/sollecito_unita text[^;]*default/i);
  });

  it("e la migrazione non accende niente su nessuna riga esistente", () => {
    // Nessun `update tasks set sollecito_…`: la migrazione aggiunge, non
    // attiva.
    expect(sql).not.toMatch(/update\s+tasks\s+set\s+sollecito/i);
  });

  it("la verifica pretende che nessun task risulti sollecitato", () => {
    expect(sql).toMatch(/select count\(\*\) into v_n from tasks where sollecito_ogni is not null/);
  });
});

describe("🔴 si sollecita solo ciò che ha un promemoria", () => {
  it("è un vincolo del database, non un controllo della schermata", () => {
    expect(sql).toMatch(
      /add constraint sollecito_vuole_un_avviso\s*\n?\s*check \(sollecito_ogni is null or remind_at is not null\)/,
    );
  });

  it("⚠️ e ogni vincolo nuovo parla italiano", () => {
    // Un rifiuto muto in sala è un guasto, non un rifiuto.
    for (const v of [
      "sollecito_intero",
      "sollecito_ogni_sensato",
      "sollecito_unita_valida",
      "sollecito_vuole_un_avviso",
    ]) {
      expect(sql, `il vincolo ${v} non ha la sua frase`).toMatch(
        new RegExp(`comment on constraint ${v} on tasks is`),
      );
    }
  });

  it("le unità sono le stesse quattro della ricorrenza: nessun secondo vocabolario", () => {
    expect(sql).toMatch(/sollecito_unita in \('giorni', 'settimane', 'mesi', 'anni'\)/);
    expect(sql, "sono comparse ore o minuti: è un secondo modello").not.toMatch(
      /sollecito_unita in \([^)]*'ore'/,
    );
  });
});

describe("🔴 il primo avviso resta quello normale, e i solleciti vengono dopo", () => {
  const giro = () => funzione("send_due_task_reminders");

  it("il ramo del sollecito parte solo dopo che il primo avviso è partito", () => {
    expect(giro()).toMatch(/t\.sollecito_ogni is not null\s*\n\s*and t\.reminder_sent_at is not null/);
  });

  it("⚠️ e il primo avviso continua a partire solo se non è ancora partito", () => {
    expect(giro()).toMatch(/select t\.remind_at as quando[\s\S]{0,200}t\.reminder_sent_at is null/);
  });
});

describe("🔴 chiuso vuol dire zitto, e niente doppioni", () => {
  const giro = () => funzione("send_due_task_reminders");

  it("un task completato esce dal giro — vale per l'avviso e per i solleciti", () => {
    expect(giro()).toMatch(/where t\.status <> 'completato'/);
  });

  it("ogni occorrenza è una consegna a sé: la chiave porta l'istante", () => {
    // 🔴 Con una chiave per task il secondo sollecito verrebbe scambiato per
    //    un doppione del primo e non partirebbe mai.
    expect(giro()).toMatch(/chiave_di_consegna\(t\.id, a\.quando\) as chiave_consegna/);
  });

  it("⚠️ due giri sovrapposti non accodano due volte: il possesso è una scrittura", () => {
    expect(giro()).toMatch(/on conflict \(chiave\) where esito = 'in_volo' do nothing/);
    expect(giro()).toMatch(/if v_riga is null then\s*\n\s*continue;/);
  });

  it("🔴 e una consegna già riuscita non si ripete a ogni giro", () => {
    expect(giro()).toMatch(/i\.chiave = chiave_di_consegna\(t\.id, a\.quando\) and i\.esito = 'riuscito'/);
  });
});

describe("🔴 la ricorrenza eredita il sollecito, ma non rompe la chiusura", () => {
  const chiudi = () => funzione("completa_task");

  it("le due colonne sono fra quelle scritte sul task nuovo", () => {
    const blocco = chiudi();
    const colonne = blocco.slice(
      blocco.indexOf("insert into tasks ("),
      blocco.indexOf("values ("),
    );
    expect(colonne).toMatch(/sollecito_ogni, sollecito_unita/);
  });

  it("⚠️ ma senza avviso il sollecito resta indietro, o chiudere fallirebbe", () => {
    // Un ricorrente senza scadenza fa nascere il successivo senza avviso:
    // portargli dietro il sollecito lo sbatterebbe contro il vincolo, e a
    // rompersi sarebbe il gesto di chiudere un task.
    expect(chiudi()).toMatch(
      /case when v_avviso is null then null else v_t\.sollecito_ogni end/,
    );
    expect(chiudi()).toMatch(
      /case when v_avviso is null then null else v_t\.sollecito_unita end/,
    );
  });
});

describe("🔴 l'occorrenza dovuta è l'ULTIMA, non la prima", () => {
  it("chi riapre dopo una pausa non riceve la raffica arretrata", () => {
    const f = funzione("istante_sollecito");
    expect(f).toMatch(/if v_qui > p_adesso then/);
    expect(f).toMatch(/return case when v_prec = p_avviso then null else v_prec end;/);
  });

  it("⚠️ e il giro dei salti ha un tetto", () => {
    expect(funzione("istante_sollecito")).toMatch(/if i > 2000 then/);
  });
});

describe("🔴 durante le prove automatiche i solleciti restano muti", () => {
  it("passano dalla stessa funzione online che il silenzio di Prova zittisce", () => {
    // ⚠️ Non è una coincidenza da verificare a mano: il silenzio a tempo
    //    (20260919000001) vive dentro `notify-telegram-reservation`, e finché
    //    i solleciti bussano LÌ un giro di prove non fa squillare niente. Se
    //    un domani qualcuno desse ai solleciti una strada propria, questa
    //    riga diventerebbe rossa — ed è il punto.
    expect(funzione("send_due_task_reminders")).toMatch(/\/notify-telegram-reservation/);
  });

  it("⚠️ e il giro non inventa un indirizzo: chiede quello di questo database", () => {
    expect(funzione("send_due_task_reminders")).toMatch(/v_base := url_delle_funzioni\(\);/);
  });
});

describe("🔴 la verifica del caso mensile non si rompe sul cambio d'ora", () => {
  // 🔴 SUCCESSO DAVVERO, il 20/09: applicando su Prova la migrazione si è
  //    fermata su questo controllo. Il calcolo era giusto; era l'ATTESO a
  //    essere sbagliato, perché scritto all'indietro («31 marzo meno un
  //    mese»), e quella sottrazione attraversa il cambio dell'ora legale.
  //    È la stessa famiglia di difetto che la migrazione stava chiudendo,
  //    ricomparsa nella riga scritta per sorvegliarlo.
  const verifica = () => sql.slice(sql.indexOf("do $verifica$"));

  it("l'istante atteso si compone in avanti, come fa la funzione", () => {
    expect(verifica()).toMatch(
      /timestamptz '2026-01-31 09:00\+01' \+ interval '1 month'/,
    );
  });

  it("⚠️ e non si scrive più all'indietro da una data successiva", () => {
    // Il verso che ha rotto: una sottrazione che attraversa il cambio d'ora.
    expect(verifica()).not.toMatch(/'2026-03-31 09:00\+02' - interval '1 month'/);
  });

  it("🔴 lo scavallamento di fine mese si controlla IN CHIARO, sul giorno", () => {
    // Senza questa riga il confronto qui sopra sarebbe quasi una tautologia:
    // direbbe «un salto solo» e non «il 28 febbraio».
    expect(verifica()).toMatch(/is distinct from date '2026-02-28'/);
  });

  it("⚠️ e c'è il caso che attraversa il cambio d'ora, col giorno atteso", () => {
    expect(verifica()).toMatch(/2026-03-20 09:00\+01/);
    expect(verifica()).toMatch(/is distinct from date '2026-04-20'/);
  });

  it("⚠️ i giorni si confrontano a Roma, non a Greenwich", () => {
    // Un giorno chiesto a Greenwich su un istante delle 09:00 italiane è lo
    // stesso giorno quasi sempre — e quel «quasi» è esattamente la trappola.
    expect(verifica()).toMatch(/at time zone 'Europe\/Rome'\)::date/);
  });
});

describe("⚠️ la migrazione si rifiuta invece di indovinare", () => {
  it("si ferma se i corpi vivi non sono quelli attesi, o se è già applicata", () => {
    expect(sql).toMatch(/GUARDIA: il giro che manda non è quello del 20260920000002/);
    expect(sql).toMatch(/GUARDIA: completa_task non è quella del 20260920000003/);
    expect(sql).toMatch(/GUARDIA: il giro conosce già i solleciti/);
  });
});
