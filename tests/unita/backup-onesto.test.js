import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { conteggiDichiarati, dichiaraIDocumenti, differenze, fileNellaCopia } from "../../scripts/backup-verifica.mjs";
import { elencaTuttoIlDeposito } from "../../scripts/comune.mjs";

// 🔴 IL BACKUP DICE ONESTAMENTE COSA HA COPIATO (31/10/2026).
//
// Il controllo finale del 30/10 ha trovato due modi in cui `npm run backup`
// scriveva «Copia completata» su una copia a cui mancavano documenti:
//   1. senza `SERVICE_ROLE_PRODUZIONE` saltava PDF e foto con un avviso;
//   2. leggeva al massimo 1000 file per cartella del deposito.
// Il backup vero non si lancia nelle prove (parla con la produzione):
// qui si mettono alla prova i pezzi che DECIDONO, e il sorgente per
// l'ordine dei passi.

/** Un deposito finto: `cartelle` e' { "prefisso": ["file", "sotto/"] }. */
function depositoFinto(cartelle) {
  const chiamate = [];
  const leggiPagina = async (prefisso, { limit, offset }) => {
    chiamate.push({ prefisso, limit, offset });
    const voci = (cartelle[prefisso] ?? []).map((n) =>
      n.endsWith("/") ? { name: n.slice(0, -1), id: null } : { name: n, id: `id-${n}` }
    );
    return { data: voci.slice(offset, offset + limit), error: null };
  };
  return { leggiPagina, chiamate };
}

const tanti = (n, radice = "f") => Array.from({ length: n }, (_, i) => `${radice}${i}.pdf`);

describe("elencaTuttoIlDeposito legge tutte le pagine", () => {
  it("una cartella con piu' file di una pagina li restituisce tutti", async () => {
    const { leggiPagina, chiamate } = depositoFinto({ "": tanti(2500) });
    const tutti = await elencaTuttoIlDeposito(leggiPagina);
    expect(tutti).toHaveLength(2500);
    expect(new Set(tutti).size).toBe(2500);
    expect(chiamate.map((c) => c.offset)).toEqual([0, 1000, 2000]);
  });

  it("esattamente una pagina piena chiede anche la successiva (vuota)", async () => {
    const { leggiPagina, chiamate } = depositoFinto({ "": tanti(1000) });
    expect(await elencaTuttoIlDeposito(leggiPagina)).toHaveLength(1000);
    expect(chiamate).toHaveLength(2);
  });

  it("entra nelle sottocartelle, anche lunghe, e compone i percorsi", async () => {
    const { leggiPagina } = depositoFinto({
      "": ["a.pdf", "posta/"],
      posta: ["2026/"],
      "posta/2026": tanti(5, "x"),
    });
    const tutti = await elencaTuttoIlDeposito(leggiPagina, "", { pagina: 2 });
    expect(tutti.sort()).toEqual(["a.pdf", ...tanti(5, "x").map((f) => `posta/2026/${f}`)].sort());
  });

  it("una lettura fallita a meta' FERMA invece di restituire un elenco corto", async () => {
    let giro = 0;
    const leggiPagina = async (_p, { limit }) =>
      ++giro === 1
        ? { data: tanti(limit).map((name) => ({ name, id: name })), error: null }
        : { data: null, error: { message: "timeout" } };
    await expect(elencaTuttoIlDeposito(leggiPagina)).rejects.toThrow(/timeout/);
  });
});

describe("il verificatore conta i documenti della copia", () => {
  const RADICI = [];
  afterAll(() => RADICI.forEach((r) => rmSync(r, { recursive: true, force: true })));
  function copiaFinta(file) {
    const r = mkdtempSync(path.join(tmpdir(), "backup-onesto-"));
    RADICI.push(r);
    for (const f of file) {
      const dove = path.join(r, "file", f);
      mkdirSync(path.dirname(dove), { recursive: true });
      writeFileSync(dove, "x");
    }
    return path.join(r, "file");
  }

  it("conta per cartella del deposito, sottocartelle comprese", () => {
    const radice = copiaFinta(["documents/a.pdf", "documents/posta/1/b.pdf", "foto/c.jpg"]);
    expect([...fileNellaCopia(radice)]).toEqual([
      ["documents", 2],
      ["foto", 1],
    ]);
  });

  it("una copia senza un file dichiarato NON torna", () => {
    const radice = copiaFinta(["documents/a.pdf"]);
    const dichiarati = conteggiDichiarati("documents = 2\n");
    expect(differenze(dichiarati, fileNellaCopia(radice))).toEqual([
      { tabella: "documents", attese: 2, trovate: 1 },
    ]);
  });

  it("una copia senza la cartella file/ vale zero documenti", () => {
    const dichiarati = conteggiDichiarati("documents = 3\n");
    expect(differenze(dichiarati, fileNellaCopia("/non/esiste"))).toEqual([
      { tabella: "documents", attese: 3, trovate: 0 },
    ]);
  });

  it("una copia nuova si riconosce dal LEGGIMI, una vecchia no", () => {
    const nuova = path.dirname(copiaFinta([]));
    writeFileSync(path.join(nuova, "LEGGIMI.txt"), "Documenti salvati in tutto: 0 (conteggio in 09_file_conteggi.txt)");
    const vecchia = path.dirname(copiaFinta([]));
    writeFileSync(path.join(vecchia, "LEGGIMI.txt"), "Righe salvate in tutto: 10");
    expect(dichiaraIDocumenti(nuova)).toBe(true);
    expect(dichiaraIDocumenti(vecchia)).toBe(false);
  });

  it("una copia completa torna", () => {
    const radice = copiaFinta(["documents/a.pdf", "documents/b.pdf"]);
    expect(differenze(conteggiDichiarati("documents = 2\n"), fileNellaCopia(radice))).toEqual([]);
  });
});

// ⚠️ Si legge il sorgente senza eseguirlo: eseguirlo vorrebbe dire
// collegarsi alla produzione.
describe("backup.mjs non dice «Copia completata» su una copia a meta'", () => {
  const testo = readFileSync("scripts/backup.mjs", "utf8");
  const dove = (pezzo) => {
    const i = testo.indexOf(pezzo, testo.indexOf('from "./backup-verifica.mjs"'));
    expect(i, pezzo).toBeGreaterThan(-1);
    return i;
  };

  it("la chiave dei documenti e' obbligatoria, prima della cartella", () => {
    expect(testo).toMatch(/obbligatorio\(\s*config,\s*"SERVICE_ROLE_PRODUZIONE"/);
    expect(testo).not.toMatch(/if \(!service\)/);
    expect(dove('"SERVICE_ROLE_PRODUZIONE"')).toBeLessThan(dove("mkdirSync(cartella"));
  });

  it("l'elenco del deposito passa dalla lettura a pagine", () => {
    expect(testo).not.toMatch(/limit: 1000/);
    expect(dove("elencaTuttoIlDeposito(")).toBeGreaterThan(0);
  });

  it("i file copiati si confrontano col database prima della fine", () => {
    const confronto = dove("differenze(conteggiDichiarati(fileDichiarati), copiati)");
    expect(confronto).toBeLessThan(dove('"Copia completata."'));
  });

  it("senza zip si ferma prima di «Copia completata»", () => {
    expect(dove("if (!zipRiuscito)")).toBeLessThan(dove('"Copia completata."'));
  });
});
