import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
import { serataDiServizio } from "../../src/lib/calcoli/serata";

// LE DUE STRADE DEVONO DARE LA STESSA SERATA.
//
// 🔴 È LA CONDIZIONE D'INGRESSO SCRITTA IL 18/08, quando `serataDiServizio()`
// fu fatta **pura** apposta — riceve l'ora invece di contenerla — perché il
// giorno che il database avesse la sua funzione le due leggessero lo stesso
// numero. Questa prova è quel giorno.
//
// ⚠️ E non è una formalità: due orologi che possono divergere sono il modo
// in cui un incasso delle 00:30 finisce su sabato per la schermata e su
// domenica per il database, senza nessun errore.
describe("la serata: il database e il client dicono la stessa cosa", () => {
  let titolare;
  let oraFine;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    const r = await titolare.from("service_settings").select("ora_fine_serata").eq("id", 1).single();
    expect(r.error).toBeNull();
    oraFine = r.data.ora_fine_serata;
  });

  afterAll(async () => {
    await titolare.auth.signOut({ scope: "local" });
  });

  // I bordi sono l'unico posto dove la regola cambia: provarla a mezzogiorno
  // direbbe di sì qualunque cosa faccia il codice.
  const istanti = [
    ["2026-08-22T00:30:00+02:00", "2026-08-21", "mezzanotte e mezza: è ancora ieri sera"],
    ["2026-08-22T04:59:00+02:00", "2026-08-21", "le 04:59: ancora ieri sera"],
    ["2026-08-22T05:01:00+02:00", "2026-08-22", "le 05:01: giorno nuovo"],
    ["2026-08-22T05:30:00+02:00", "2026-08-22", "le 05:30: giorno nuovo"],
    ["2026-08-21T23:00:00+02:00", "2026-08-21", "le 23:00: la sera stessa"],
    // Le notti del cambio dell'ora: a marzo le 02:00 non esistono, a ottobre
    // le 02:30 capitano due volte. Col confine alle 5 nessuna delle due
    // tocca la regola — ma è il genere di cosa che si scopre l'anno dopo.
    ["2026-03-29T01:30:00+01:00", "2026-03-28", "notte di marzo, prima del salto"],
    ["2026-03-29T04:30:00+02:00", "2026-03-28", "notte di marzo, dopo il salto"],
    ["2026-10-25T02:30:00+02:00", "2026-10-24", "notte di ottobre, prima delle due 02:30"],
    ["2026-10-25T02:30:00+01:00", "2026-10-24", "notte di ottobre, seconda delle due 02:30"],
  ];

  for (const [iso, atteso, che] of istanti) {
    it(`${che}: il database dice ${atteso}`, async () => {
      const r = await titolare.rpc("serata_di_servizio", { p_istante: iso });
      expect(r.error).toBeNull();
      expect(r.data).toBe(atteso);
    });
  }

  it("e il client dice esattamente la stessa cosa, sugli stessi istanti", async () => {
    // ⚠️ Il client calcola sull'ora LOCALE della macchina che gira. Questa
    // prova gira in Italia, e lo dichiara invece di darlo per scontato: se
    // girasse altrove, il confronto non direbbe niente.
    const fusoLocale = -new Date("2026-08-22T00:30:00+02:00").getTimezoneOffset();
    if (fusoLocale !== 120) {
      expect(fusoLocale, "questa prova ha senso solo su una macchina in ora italiana").toBe(120);
    }
    for (const [iso, atteso] of istanti) {
      const daDatabase = await titolare.rpc("serata_di_servizio", { p_istante: iso });
      const daClient = serataDiServizio(new Date(iso), oraFine);
      expect(daClient, `il client sbaglia su ${iso}`).toBe(atteso);
      expect(daClient, `le due strade divergono su ${iso}`).toBe(daDatabase.data);
    }
  });

  it("nessuna funzione decide più la data sull'orario di Greenwich", async () => {
    // ⚠️ Si chiede al database, non al testo delle migrazioni, e senza i
    // commenti: un censimento che conta le parole nei commenti gonfia il
    // problema — è il falso positivo trovato nel censimento del 19/08.
    //
    // ⚠️ DAL 19/08 (seconda metà) LA RETE GUARDA TRE FORME, non una:
    // `current_date`, `now()::date`, e il **taglio nudo** di una colonna con
    // l'ora dentro (`created_at::date`), che chiede il giorno a Greenwich
    // esattamente come le altre due. Con la rete vecchia
    // `quadratura_pagamenti` — che tocca soldi, e lo faceva tre volte —
    // sarebbe rimasta invisibile.
    const r = await titolare.rpc("funzioni_con_data_utc");
    expect(r.error).toBeNull();
    // Il messaggio deve dire QUALE e PERCHÉ: chi legge una prova rossa deve
    // poter decidere senza riaprire il database.
    const trovate = (r.data ?? []).map((x) => `${x.nome} (${x.perche})`);
    expect(trovate, "funzioni che decidono la data a Greenwich").toEqual([]);
  });
});
