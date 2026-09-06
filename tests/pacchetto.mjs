import { readFileSync, rmSync } from "node:fs";
import { build } from "vite";

// IL PACCHETTO VERO, COSTRUITO DALLA PROVA CHE LO USA — 06/09/2026.
//
// 🔴 PERCHE' NON SI LEGGE `dist/`, ed e' un difetto pagato sui controlli:
// la prima stesura di queste prove apriva `dist/index.html`. In locale c'e'
// quasi sempre, quindi passavano; su GitHub le prove girano **prima** della
// compilazione (`.github/workflows/controlli.yml`: prima `npm run test`, poi
// `npm run build`), quindi quel file non esiste e la prova si e' fermata.
//
// ⚠️ LA CURA NON E' SPOSTARE LA COMPILAZIONE PRIMA DELLE PROVE: sarebbe
// mettere in un file di configurazione una condizione che appartiene a una
// prova, dove nessuno la vedrebbe. *Una prova che ha bisogno di qualcosa se
// lo procura.*
//
// ⚠️ E IL NOME DELLA CARTELLA CONTA: `dist-prova-…` e' fra le forme che
// `.gitignore` ignora, e Tailwind — che rispetta `.gitignore` per decidere
// quali file leggere — quindi non ci guarda dentro. Una cartella con un nome
// non ignorato verrebbe letta dalla costruzione successiva, che ci
// troverebbe dentro il pacchetto di prima: due costruzioni identiche
// darebbero impronte diverse, e sembrerebbe non-determinismo di Vite.
const CARTELLA = "dist-prova-pacchetto";

/** Compila il gestionale e torna il suo `index.html`, senza lasciare niente. */
export async function pacchettoVero() {
  rmSync(CARTELLA, { recursive: true, force: true });
  try {
    await build({ build: { outDir: CARTELLA }, logLevel: "silent" });
    return readFileSync(`${CARTELLA}/index.html`, "utf8");
  } finally {
    rmSync(CARTELLA, { recursive: true, force: true });
  }
}
