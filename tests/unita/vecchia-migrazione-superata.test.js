import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  controllaMigrazione,
  funzioniRidefinite,
  raccontaSmarrite,
  rinunceDichiarate,
} from "../../scripts/guardie.mjs";

// =====================================================================
// LA `20260921000001` E' SUPERATA — 21/09/2026
// =====================================================================
// 🔴 COSA E' SUCCESSO. La `20260921000001` passava la societa' a
//    `create_document`, ma aveva preso il corpo della funzione dall'ultima
//    migrazione del repository **che sembrava definirla**. Sembrava: la
//    ricerca che lo stabiliva cercava `create or replace function
//    esegui_azione_posta`, e quando una funzione si riprende dal database
//    Postgres la riscrive **col nome dello schema** —
//    `CREATE OR REPLACE FUNCTION public.esegui_azione_posta(...)`. Le due
//    ridefinizioni piu' recenti sono scritte cosi' e non si vedevano.
//
// ⚠️ A prenderlo e' stata `rete-guardie`, applicando: si e' fermata prima di
//    toccare il database, nominando quattro cose che si sarebbero perse.
//
// 🔴 COSA SI PROVA QUI, e sono due fatti distinti:
//    1. dopo la `…0002` la `…0001` **non resta pendente** — viene registrata
//       come applicata, e gli strumenti smettono di proporla;
//    2. e **non puo' piu' essere eseguita**: se qualcuno la nominasse
//       esplicitamente, la rete la rifiuterebbe, perche' il suo corpo perde
//       quattro cose rispetto a quello che la `…0002` ha scritto.
//
// ⚠️ Il secondo fatto e' quello che conta: una registrazione da sola e'
//    contabilita'. Che il file **non possa passare** e' una proprieta', e si
//    prova mettendo la vecchia davanti alla rete col corpo nuovo.

const CARTELLA = "supabase/migrations";
const VECCHIA = `${CARTELLA}/20260921000001_il_documento_dalla_posta_tiene_la_societa.sql`;
const NUOVA = `${CARTELLA}/20260921000002_la_societa_dalla_posta_dal_corpo_vivo.sql`;

const leggi = (f) => readFileSync(f, "utf8");
const corpoDi = (sql, nome) => funzioniRidefinite(sql).find((f) => f.nome === nome)?.testo ?? null;

describe("🔴 la vecchia non resta pendente", () => {
  const nuova = leggi(NUOVA);

  it("la nuova registra la versione della vecchia, oltre alla propria", () => {
    expect(nuova).toMatch(/insert into applied_migrations[\s\S]*'20260921000001'/);
    expect(nuova).toMatch(/insert into applied_migrations[\s\S]*'20260921000002'/);
  });

  it("🔴 e le registra DOPO la verifica, non prima", () => {
    // ⚠️ E' il punto del meccanismo della `20260825000012`: se la verifica si
    //    ferma, quelle righe non vengono scritte. Registrare una migrazione
    //    il cui controllo non e' stato fatto sarebbe scrivere nel registro
    //    una cosa non vera — e la vecchia risulterebbe superata da un lavoro
    //    che non e' stato provato.
    const fineVerifica = nuova.indexOf("end $verifica$;");
    const primaRegistrazione = nuova.indexOf("insert into applied_migrations");
    expect(fineVerifica).toBeGreaterThan(0);
    expect(primaRegistrazione).toBeGreaterThan(fineVerifica);
  });

  it("⚠️ la vecchia non e' stata riscritta ne' cancellata", () => {
    // La regola del 23/08: un file gia' scritto racconta cosa e' successo
    // quel giorno. Si aggiunge una migrazione, non si corregge il passato.
    const vecchia = leggi(VECCHIA);
    expect(vecchia).toContain("20260813000003");
    expect(corpoDi(vecchia, "esegui_azione_posta")).toBeTruthy();
  });
});

describe("🔴 e non potra' piu' essere eseguita", () => {
  const vecchia = leggi(VECCHIA);
  const nuova = leggi(NUOVA);
  const corpoNuovo = corpoDi(nuova, "esegui_azione_posta");

  it("la nuova scrive davvero quella funzione", () => {
    expect(corpoNuovo).toBeTruthy();
    expect(corpoNuovo).toContain("p_entity_id");
  });

  it("🔴 messa davanti alla rete col corpo nuovo, la vecchia viene RIFIUTATA", () => {
    // Questo e' il fatto: dopo la `…0002`, il corpo vivo e' quello nuovo.
    // Chiunque nominasse la `…0001` la vedrebbe fermata dalla stessa rete
    // che l'ha fermata sul progetto di prova.
    const perdite = controllaMigrazione(vecchia, () => corpoNuovo);
    expect(perdite.length, "la vecchia passerebbe ancora: non e' superata").toBeGreaterThan(0);
    // ⚠️ Il racconto si costruisce con la funzione della rete, non
    //    ricomponendo a mano i campi di `smarrite`: scritto a mano davo
    //    `undefined:` davanti a ogni riga, cioe' misuravo la mia ipotesi
    //    sulla forma di quell'oggetto invece del suo contenuto.
    const smarrite = perdite.flatMap((p) => raccontaSmarrite(p)).join(" | ");
    expect(smarrite).toMatch(/Questo carico non dice da chi arriva la merce/);
  });

  it("🔴 e fra le cose perse c'e' anche la chiamata a `valore_del_vocabolario`", () => {
    // ⚠️ Le CHIAMATE perse la rete le riconosce solo se le si dice quali
    //    nomi sono funzioni del progetto: nell'uso vero quell'elenco arriva
    //    dal catalogo del database (`vivi.funzioniDelProgetto`). Qui, che
    //    database non c'e', si nomina quella che interessa — ed e' il motivo
    //    per cui questo caso e' separato dal precedente invece di essere una
    //    riga in piu': senza l'elenco il controllo sopra passa comunque, e
    //    unendoli si sarebbe creduto di provare due cose provandone una.
    const perdite = controllaMigrazione(vecchia, () => corpoNuovo, new Set(["valore_del_vocabolario"]));
    const smarrite = perdite.flatMap((p) => raccontaSmarrite(p)).join(" | ");
    expect(smarrite).toMatch(/valore_del_vocabolario/);
  });

  it("⚠️ e nessuna rinuncia dichiarata la fa passare lo stesso", () => {
    // Una riga `-- rete-guardie: <funzione> — <motivo>` nella vecchia la
    // zittirebbe. Questa prova impedisce che qualcuno ce la metta per farla
    // passare.
    // ⚠️ Si chiede alla rete, non si cerca il testo: la vecchia PARLA di
    //    quella riga nel suo commento d'intestazione («non le serve nessuna
    //    riga -- rete-guardie:»), e una ricerca testuale la scambiava per
    //    una dichiarazione vera. E' la stessa trappola del nome di funzione
    //    scritto con le parentesi dentro una frase.
    expect(rinunceDichiarate(vecchia).has("esegui_azione_posta")).toBe(false);
    const perdite = controllaMigrazione(vecchia, () => corpoNuovo);
    expect(perdite.every((p) => p.rinuncia === null)).toBe(true);
  });
});

describe("🔴 la nuova non ripete l'errore che corregge", () => {
  const nuova = leggi(NUOVA);
  const corpoNuovo = corpoDi(nuova, "esegui_azione_posta");

  it("messa davanti alla rete col proprio corpo, non perde niente", () => {
    expect(controllaMigrazione(nuova, () => corpoNuovo)).toEqual([]);
  });

  it("🔴 conserva le quattro cose che la vecchia perdeva", () => {
    for (const parte of [
      "Questo carico non dice da chi arriva la merce",
      "ingredients",
      "category",
      "riga_lista",
      "valore_del_vocabolario",
    ]) {
      expect(corpoNuovo, `manca «${parte}»`).toContain(parte);
    }
  });

  it("⚠️ e conserva il portiere e il percorso di ricerca", () => {
    expect(corpoNuovo).toContain("is_titolare");
    expect(nuova).toMatch(/SECURITY DEFINER/i);
    expect(nuova).toMatch(/SET search_path/i);
  });

  it("⚠️ non riscrive i permessi: `create or replace` li conserva", () => {
    // La trappola del 24/08: un `grant` ricopiato dal modello di una
    // funzione vicina ha aperto una porta che prima non c'era. Qui non si
    // dichiara niente che non sia stato letto.
    expect(nuova).not.toMatch(/\bgrant\s+execute\b/i);
    expect(nuova).not.toMatch(/\brevoke\s+all\b/i);
  });
});
