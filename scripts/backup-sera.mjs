// LA COPIA DELLA SERA, CON L'AVVISO — `npm run backup:sera`
// e il solo controllo dell'eta' — `npm run backup:controlla`
//
// 🔴 PERCHE' ESISTE (revisione dell'11/11, punto 10): l'operazione
//    pianificata di Windows «Borgo58 - copia work» lanciava la copia, e se
//    la copia non riusciva non lo sapeva nessuno. Adesso:
//
//    npm run backup:sera       lancia `scripts/backup.mjs` com'e'; se non
//                              riesce manda un Telegram con le ultime righe
//                              e l'eta' dell'ultima copia completa.
//    npm run backup:controlla  non copia niente: se l'ultima copia completa
//                              ha piu' di due giorni (BACKUP_AVVISO_ORE in
//                              `.env`), manda un Telegram — al massimo uno
//                              ogni 12 ore, non uno a ogni accesso al PC.
//                              Serve per il caso che la copia della sera non
//                              puo' dire: il PC spento, o l'operazione che
//                              non parte.
//
// ⚠️ La copia la fa SEMPRE `backup.mjs`: qui non si copia niente. Si
//    guarda solo come e' andata e si dice.
// ⚠️ Esce con errore se la copia non e' riuscita o se c'e' un avviso (1),
//    e con 2 se l'avviso non e' partito: cosi' anche l'operazione
//    pianificata di Windows mostra «ultimo risultato» diverso da 0.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copiaPiuRecente, esegui, leggiConfigurazione } from "./comune.mjs";
import { avvisoCopiaFallita, avvisoCopiaVecchia, daRipetere, mandaTelegram, oreAvviso } from "./avviso-copia.mjs";

// 🔴 SI PARTE SEMPRE DALLA CARTELLA DEL PROGETTO, qualunque sia quella da cui
//    l'ha lanciato Windows: `.env` e i comandi della copia si cercano lì.
//    Con la cartella sbagliata `.env` non si trovava e l'avviso taceva.
const progetto = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(progetto);

const config = leggiConfigurazione(path.join(progetto, ".env"));
const soloControllo = process.argv.includes("--solo-controllo");
const radiceCopie = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
// I valori di `.env` non devono finire su Telegram, in nessuna forma.
const segreti = Object.values(config).filter((v) => typeof v === "string" && v.length >= 6);

async function avvisa(testo) {
  const esito = await mandaTelegram({
    token: config.TELEGRAM_BOT_TOKEN,
    chatId: config.TELEGRAM_CHAT_ID,
    testo,
  });
  console.log("");
  if (esito.ok) {
    console.log("Avviso mandato su Telegram.");
  } else {
    // 🔴 Detto forte: un avviso che non parte e' esattamente il silenzio
    //    che questo comando esiste per togliere.
    console.error(`AVVISO NON MANDATO: ${esito.dettaglio}.`);
    console.error("Il messaggio era:");
    console.error(testo);
  }
  return esito.ok;
}

if (soloControllo) {
  const ultima = copiaPiuRecente(config.BACKUP_CARTELLA);
  const adesso = new Date();
  const testo = avvisoCopiaVecchia(ultima, adesso, oreAvviso(config.BACKUP_AVVISO_ORE));
  if (!testo) {
    console.log(`La copia piu' recente (${ultima.nome}) e' abbastanza fresca: nessun avviso.`);
    process.exit(0);
  }
  console.log(testo);
  // Al massimo un avviso ogni 12 ore: il controllo gira anche a ogni accesso.
  const memoria = path.join(radiceCopie, "ultimo_avviso_copia.txt");
  const ultimoAvviso = existsSync(memoria) ? new Date(readFileSync(memoria, "utf8").trim()) : null;
  if (!daRipetere(ultimoAvviso, adesso)) {
    console.log(`Avviso gia' mandato il ${ultimoAvviso.toLocaleString("it-IT")}: non si ripete prima di 12 ore.`);
    process.exit(1);
  }
  const partito = await avvisa(testo);
  if (partito) {
    try {
      writeFileSync(memoria, adesso.toISOString() + "\n", "utf8");
    } catch (e) {
      // Detto, non taciuto: senza memoria il prossimo controllo avvisa di nuovo, niente di peggio.
      console.error(`Non riesco a ricordare l'avviso (${e.message}): il prossimo controllo lo ripetera'.`);
    }
  }
  process.exit(partito ? 1 : 2);
}

// La copia vera, con l'uscita raccolta per poterla dire. Al massimo due ore:
// una copia che si pianta deve diventare un avviso, non un'attesa infinita.
const inizio = new Date();
inizio.setSeconds(0, 0);
const copia = esegui(process.execPath, [path.join(progetto, "scripts", "backup.mjs")], {
  silenzioso: true,
  timeout: 2 * 60 * 60 * 1000,
});
process.stdout.write(copia.uscita);

if (copia.ok) process.exit(0);

// La copia di stasera ha il timbro? Allora e' mancato solo lo zip.
const ultima = copiaPiuRecente(config.BACKUP_CARTELLA);
const testo = avvisoCopiaFallita({
  uscita: copia.uscita || copia.errore || "",
  ultima,
  adesso: new Date(),
  fattaOra: Boolean(ultima && ultima.quando >= inizio),
  segreti,
});
const partito = await avvisa(testo);
process.exit(partito ? 1 : 2);
