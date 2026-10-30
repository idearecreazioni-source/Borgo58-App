import { describe, expect, it } from "vitest";
import {
  contenutoDellaChiave,
  problemiDiProgetto,
  REF_PRODUZIONE,
  REF_PROVA,
  urlApiDi,
} from "../../scripts/comune.mjs";

// 🔴 UN PROGETTO SOLO PER COMANDO (30/10/2026): `npm run backup` e
// `npm run deposito:orfani` non controllavano di parlare con la
// produzione, e il backup metteva insieme un indirizzo e una chiave che
// potevano essere di due progetti diversi.
//
// ⚠️ Le prove sono scritte soprattutto AL CONTRARIO: un controllo che
// lascia passare il caso giusto lo passerebbe anche se non guardasse
// niente. Deve FERMARE ogni miscuglio. Nessun database viene toccato:
// le chiavi sono finte, fatte qui.

const chiaveFinta = (contenuto) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(contenuto)).toString("base64url"),
    "firma-finta",
  ].join(".");

const dbDi = (ref) => `postgresql://postgres.${ref}:segreto@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
const servizioDi = (ref) => chiaveFinta({ iss: "supabase", ref, role: "service_role" });

const tuttoProduzione = {
  dbUrl: dbDi(REF_PRODUZIONE),
  apiUrl: urlApiDi(REF_PRODUZIONE),
  chiave: servizioDi(REF_PRODUZIONE),
};

describe("problemiDiProgetto: tutto dello stesso progetto", () => {
  it("via libera quando stringa, indirizzo e chiave sono della produzione", () => {
    expect(problemiDiProgetto(REF_PRODUZIONE, tuttoProduzione)).toEqual([]);
  });

  it("via libera anche per la prova, se e' tutto della prova", () => {
    expect(
      problemiDiProgetto(REF_PROVA, { dbUrl: dbDi(REF_PROVA), apiUrl: urlApiDi(REF_PROVA), chiave: servizioDi(REF_PROVA) })
    ).toEqual([]);
  });

  it("controlla solo cio' che riceve: la sola stringa giusta basta", () => {
    expect(problemiDiProgetto(REF_PRODUZIONE, { dbUrl: dbDi(REF_PRODUZIONE) })).toEqual([]);
  });
});

describe("problemiDiProgetto: ogni miscuglio si ferma", () => {
  it("🔴 l'indirizzo della prova con la chiave della produzione (il difetto del backup)", () => {
    const p = problemiDiProgetto(REF_PRODUZIONE, { ...tuttoProduzione, apiUrl: urlApiDi(REF_PROVA) });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/indirizzo dell'API/);
  });

  it("🔴 la chiave della prova sulla produzione", () => {
    const p = problemiDiProgetto(REF_PRODUZIONE, { ...tuttoProduzione, chiave: servizioDi(REF_PROVA) });
    expect(p).toEqual([expect.stringMatching(/altro progetto/)]);
  });

  it("🔴 la stringa del database della prova sulla produzione", () => {
    const p = problemiDiProgetto(REF_PRODUZIONE, { ...tuttoProduzione, dbUrl: dbDi(REF_PROVA) });
    expect(p).toEqual([expect.stringMatching(/stringa del database/)]);
  });

  it("🔴 il riferimento giusto dentro la password o nei parametri non basta", () => {
    for (const dbUrl of [
      `postgresql://postgres.${REF_PROVA}:${REF_PRODUZIONE}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${REF_PROVA}:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?ref=${REF_PRODUZIONE}`,
      `postgresql://postgres:x@db.${REF_PROVA}.supabase.co:5432/${REF_PRODUZIONE}`,
      "non e' una stringa di collegamento",
    ]) {
      expect(problemiDiProgetto(REF_PRODUZIONE, { dbUrl })).toEqual([expect.stringMatching(/stringa del database/)]);
    }
  });

  it("il collegamento diretto (db.<ref>.supabase.co) del progetto giusto passa", () => {
    expect(
      problemiDiProgetto(REF_PRODUZIONE, { dbUrl: `postgresql://postgres:x@db.${REF_PRODUZIONE}.supabase.co:5432/postgres` })
    ).toEqual([]);
  });

  it("un riferimento dell'altro progetto nella password non da' falsi allarmi", () => {
    const dbUrl = `postgresql://postgres.${REF_PRODUZIONE}:${REF_PROVA}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
    expect(problemiDiProgetto(REF_PRODUZIONE, { dbUrl })).toEqual([]);
  });

  it("🔴 tutto della produzione quando ci si aspetta la prova", () => {
    expect(problemiDiProgetto(REF_PROVA, tuttoProduzione)).toHaveLength(3);
  });

  it("🔴 la chiave pubblica (anon) al posto di quella di servizio", () => {
    const anon = chiaveFinta({ iss: "supabase", ref: REF_PRODUZIONE, role: "anon" });
    expect(problemiDiProgetto(REF_PRODUZIONE, { ...tuttoProduzione, chiave: anon })).toEqual([
      expect.stringMatching(/service_role/),
    ]);
  });

  it("🔴 una chiave che non dice di che progetto e': nuova forma, vuota o rotta", () => {
    for (const chiave of ["sb_secret_abc123", "", "eyJ.non-json.firma", "a.b"]) {
      expect(problemiDiProgetto(REF_PRODUZIONE, { chiave })).toEqual([
        expect.stringMatching(/non dice a quale progetto/),
      ]);
    }
  });

  it("🔴 un indirizzo illeggibile o di un dominio simile", () => {
    for (const apiUrl of [
      "non e' un indirizzo",
      `https://${REF_PRODUZIONE}.supabase.co.esempio.it`,
      `https://x${REF_PRODUZIONE}.supabase.co`,
      `http://${REF_PRODUZIONE}.supabase.co`,
    ]) {
      expect(problemiDiProgetto(REF_PRODUZIONE, { apiUrl })).toHaveLength(1);
    }
  });
});

describe("contenutoDellaChiave", () => {
  it("legge riferimento e ruolo da una chiave in forma eyJ…", () => {
    expect(contenutoDellaChiave(servizioDi(REF_PROVA))).toMatchObject({ ref: REF_PROVA, role: "service_role" });
  });

  it("restituisce null per tutto il resto", () => {
    for (const c of [undefined, null, "", "sb_secret_x", "eyJ.e30", "eyJx.!!!.y"]) {
      expect(contenutoDellaChiave(c)).toBeNull();
    }
  });
});
