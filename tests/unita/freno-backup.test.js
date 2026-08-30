import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  backupTroppoVecchio,
  copiaPiuRecente,
  ORE_MASSIME_BACKUP,
  quandoDalNome,
} from "../../scripts/comune.mjs";

// 🔴 IL SESTO FRENO DI `npm run migra` (30/08/2026): non si tocca il
// gestionale vero se la copia di sicurezza e' vecchia.
//
// Perche' queste prove esistono in questa forma: il freno vero si vede
// lavorare **solo** quando ci sono migrazioni da applicare e un backup
// vecchio — cioe' in una condizione che non si puo' apparecchiare a
// comando senza invecchiare un backup vero. Per questo la parte che
// DECIDE (`backupTroppoVecchio`) e' separata da quella che GUARDA il
// disco: la decisione si mette alla prova a tavolino, in tutti i suoi
// casi, senza dover aspettare domani.
//
// ⚠️ E sono scritte AL CONTRARIO dove conta: non basta che il freno lasci
// passare un backup fresco — **deve fermare** su ognuno dei suoi casi,
// altrimenti passerebbe anche un freno che non guarda niente.

const RADICI = [];
function radiceFinta() {
  const r = mkdtempSync(path.join(tmpdir(), "freno-backup-"));
  RADICI.push(r);
  return r;
}
/** Una cartella di backup col nome giusto. `completa` decide se ha 05_conteggi.txt. */
function copiaFinta(radice, nome, { completa = true } = {}) {
  const d = path.join(radice, nome);
  mkdirSync(d, { recursive: true });
  if (completa) writeFileSync(path.join(d, "05_conteggi.txt"), "tabella = 1\n");
  return d;
}
const oreFa = (n) => new Date(Date.now() - n * 3_600_000);
const nomeDi = (d) => {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

afterAll(() => {
  for (const r of RADICI) rmSync(r, { recursive: true, force: true });
});

describe("il quando si legge dal nome della cartella", () => {
  it("legge l'ora locale scritta nel nome", () => {
    const d = quandoDalNome("2026-08-30_2059");
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // agosto
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(59);
  });

  it("rifiuta un nome che non e' una data", () => {
    expect(quandoDalNome("Scenario di collaudo (progetto di prova)")).toBeNull();
    expect(quandoDalNome("Borgo58_backup_2026-08-30_2059.zip")).toBeNull();
  });

  // ⚠️ Senza questo controllo il 32 di agosto scivolerebbe nel primo di
  // settembre, cioe' una data inventata che il freno userebbe come vera.
  it("rifiuta una data impossibile invece di farla scivolare nel mese dopo", () => {
    expect(quandoDalNome("2026-08-32_1000")).toBeNull();
    expect(quandoDalNome("2026-13-01_1000")).toBeNull();
  });
});

describe("quale copia si guarda", () => {
  it("prende la piu' recente fra quelle complete", () => {
    const r = radiceFinta();
    copiaFinta(r, "2026-08-23_2120");
    copiaFinta(r, "2026-08-30_2059");
    copiaFinta(r, "2026-08-12_0008");
    expect(copiaPiuRecente(r).nome).toBe("2026-08-30_2059");
  });

  // 🔴 IL CASO CHE VALE PIU' DI TUTTI: una cartella recente lasciata da un
  // backup interrotto ha il nome con l'ora giusta e dentro non ha niente.
  // Un freno che la accettasse si lascerebbe soddisfare da un guscio.
  it("SCARTA una cartella recente ma incompleta, e ripiega su quella vecchia", () => {
    const r = radiceFinta();
    copiaFinta(r, "2026-08-23_2120");
    copiaFinta(r, "2026-08-30_2059", { completa: false });
    expect(copiaPiuRecente(r).nome).toBe("2026-08-23_2120");
  });

  it("dice null se non c'e' nessuna copia, e se la cartella non esiste", () => {
    expect(copiaPiuRecente(radiceFinta())).toBeNull();
    expect(copiaPiuRecente(path.join(tmpdir(), "questa-cartella-non-esiste-mai"))).toBeNull();
  });
});

describe("la decisione: si passa o ci si ferma", () => {
  it("lascia passare una copia fresca", () => {
    const r = radiceFinta();
    const nome = nomeDi(oreFa(1));
    copiaFinta(r, nome);
    expect(backupTroppoVecchio(copiaPiuRecente(r), new Date(), 24)).toBeNull();
  });

  // --- ROTTURA 1: nessuna copia -------------------------------------
  it("SI FERMA quando non c'e' nessuna copia, e lo dice con parole sue", () => {
    const motivo = backupTroppoVecchio(null, new Date(), 24);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain("nessuna copia");
  });

  // --- ROTTURA 2: la copia c'e' ma e' vecchia -----------------------
  // ⚠️ E' un controllo DIVERSO dal precedente, e il messaggio deve
  //    esserlo: «non c'e' niente» e «c'e' ed e' vecchia» mandano a
  //    guardare in due posti diversi.
  it("SI FERMA su una copia piu' vecchia del limite, e dice quante ore ha", () => {
    const r = radiceFinta();
    copiaFinta(r, nomeDi(oreFa(50)));
    const motivo = backupTroppoVecchio(copiaPiuRecente(r), new Date(), 24);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain("50 ore");
    expect(motivo).toContain("il limite e' 24");
    expect(motivo).not.toContain("nessuna copia");
  });

  // --- ROTTURA 3: l'orologio del computer e' stato spostato ----------
  it("SI FERMA su una copia datata nel futuro invece di far finta di sapere", () => {
    const r = radiceFinta();
    copiaFinta(r, nomeDi(new Date(Date.now() + 5 * 3_600_000)));
    const motivo = backupTroppoVecchio(copiaPiuRecente(r), new Date(), 24);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain("futuro");
  });

  // ⚠️ Il bordo: a 23 ore si passa, a 25 no. Provato nei due versi perche'
  //    un limite che sbaglia verso e' peggio di un limite assente.
  it("il bordo del limite discrimina nei due versi", () => {
    const r1 = radiceFinta();
    copiaFinta(r1, nomeDi(oreFa(23)));
    expect(backupTroppoVecchio(copiaPiuRecente(r1), new Date(), 24)).toBeNull();
    const r2 = radiceFinta();
    copiaFinta(r2, nomeDi(oreFa(25)));
    expect(backupTroppoVecchio(copiaPiuRecente(r2), new Date(), 24)).not.toBeNull();
  });

  it("il limite predefinito e' 24 ore", () => {
    expect(ORE_MASSIME_BACKUP).toBe(24);
  });
});
