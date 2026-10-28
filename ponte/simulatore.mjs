// L'APPARECCHIO FINTO — 28/10/2026.
//
// Una stampante ESC/POS e un registratore FPMate che vivono sul mini-PC
// (127.0.0.1) e scrivono in `ponte/uscita/` quello che avrebbero stampato,
// in una forma che si legge. Serve a provare tutto prima del collaudo.
//
// 🔴 SA ANCHE ANDARE STORTO, ed è la parte che conta (mandato del
//    registratore telematico, 20/08: «il simulatore che serve è quello che
//    si rifiuta di stampare»). I modi:
//      normale          — stampa e risponde «fatto»;
//      muto             — accetta la connessione e non risponde mai;
//      a_meta           — risponde a metà e chiude;
//      carta_finita     — dice che la carta è finita;
//      coperchio_aperto — dice che il coperchio è aperto;
//      rifiuta          — il registratore risponde di no;
//      pagina_bianca    — risponde «fatto» e scrive un foglio BIANCO: è il
//                         guasto che nessun protocollo vede, e serve a
//                         ricordare che l'unica difesa è chi ha il foglio in
//                         mano.
//
// Da riga di comando:  node ponte/simulatore.mjs [modo]

import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MODI = ["normale", "muto", "a_meta", "carta_finita", "coperchio_aperto", "rifiuta", "pagina_bianca"];
export const PORTA_STAMPANTE = 19100;
export const PORTA_REGISTRATORE = 18080;

const CARTELLA = path.join(path.dirname(fileURLToPath(import.meta.url)), "uscita");

/** I byte ESC/POS resi leggibili: il testo resta, i comandi diventano parole. */
// ⚠️ Si leggono i byte uno per uno, non con espressioni regolari: quelle con
//    dentro i caratteri di controllo il controllo del codice le segnala, e
//    il progetto non ammette avvisi.
export function leggibile(byte) {
  const b = Buffer.from(byte);
  let testo = "";
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 0x1b) {
      const cosa = b[i + 1];
      if (cosa === 0x45) testo += "**"; // grassetto acceso o spento
      else if (cosa === 0x64) testo += "\n"; // avanti di qualche riga
      // ESC @ ha un byte solo dopo ESC; ESC a, ESC E, ESC d ne hanno due.
      i += cosa === 0x40 ? 1 : 2;
    } else if (c === 0x1d && b[i + 1] === 0x56) {
      testo += "\n----- taglio -----\n";
      i += 3;
    } else if (c === 0x0a || c >= 0x20) {
      testo += String.fromCharCode(c);
    }
  }
  return testo;
}

function scrivi(cartella, nome, testo) {
  mkdirSync(cartella, { recursive: true });
  const file = path.join(cartella, `${new Date().toISOString().replace(/[:.]/g, "-")}-${nome}.txt`);
  writeFileSync(file, testo, "utf8");
  return file;
}

// Due byte di stato ESC/POS (DLE EOT 2 e DLE EOT 4): i bit 1 e 4 sempre accesi.
function byteDiStato(modo) {
  const ferma = 0x12 | (modo === "coperchio_aperto" ? 0x04 : 0) | (modo === "carta_finita" ? 0x20 : 0);
  const carta = 0x12 | (modo === "carta_finita" ? 0x60 : 0);
  return Buffer.from([ferma, carta]);
}

const rispostaFpmate = (successo, codice = "") =>
  `<?xml version="1.0" encoding="utf-8"?>\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>` +
  `<response success="${successo}" code="${codice}" status="2"><addInfo><elementList>simulatore</elementList></addInfo></response>` +
  `</soapenv:Body></soapenv:Envelope>`;

/**
 * Accende i due apparecchi finti. Restituisce `chiudi()` e l'elenco dei
 * fogli scritti (per le prove).
 */
export async function avviaSimulatore({ modo = "normale", cartella = CARTELLA, portaStampante = PORTA_STAMPANTE, portaRegistratore = PORTA_REGISTRATORE, silenzioso = false } = {}) {
  if (!MODI.includes(modo)) throw new Error(`Modo sconosciuto «${modo}»: i modi sono ${MODI.join(", ")}.`);
  const fogli = [];
  const di = (...a) => silenzioso || console.log("[simulatore]", ...a);

  const stampante = net.createServer((presa) => {
    const ricevuti = [];
    presa.on("data", (pezzo) => {
      // ⚠️ Una domanda di stato si riconosce dai suoi byte (DLE EOT n); il
      //    resto è da stampare, e lo si scrive quando la connessione chiude.
      if (pezzo[0] === 0x10 && pezzo[1] === 0x04) {
        if (modo === "muto") return;
        const stato = byteDiStato(modo);
        if (modo === "a_meta") {
          presa.end(stato.subarray(0, 1));
          return;
        }
        presa.write(stato);
        return;
      }
      ricevuti.push(pezzo);
    });
    presa.on("end", () => {
      if (ricevuti.length) {
        const testo = modo === "pagina_bianca" ? "(pagina bianca: la stampante ha detto «fatto» e il foglio è uscito vuoto)\n" : leggibile(Buffer.concat(ricevuti));
        const file = scrivi(cartella, "stampante", testo);
        fogli.push({ apparecchio: "stampante", file, testo });
        di("foglio stampato in", file);
      }
      presa.end();
    });
    presa.on("error", () => {});
  });

  const registratore = http.createServer((richiesta, risposta) => {
    const pezzi = [];
    richiesta.on("data", (p) => pezzi.push(p));
    richiesta.on("end", () => {
      const corpo = Buffer.concat(pezzi).toString("utf8");
      if (modo === "muto") return; // non risponde mai
      if (modo === "a_meta") {
        risposta.socket.end("HTTP/1.1 200 OK\r\nContent-Length: 500\r\n\r\n<response suc");
        return;
      }
      const codici = { carta_finita: "EPTR_REC_EMPTY", coperchio_aperto: "EPTR_COVER_OPEN", rifiuta: "EPTR_PRINTER_OFFLINE" };
      const xml = codici[modo] ? rispostaFpmate(false, codici[modo]) : rispostaFpmate(true);
      if (/printerNonFiscal/.test(corpo) && !codici[modo]) {
        const righe = [...corpo.matchAll(/data="([^"]*)"/g)].map((m) => m[1]);
        const testo = modo === "pagina_bianca" ? "(pagina bianca)\n" : `${righe.join("\n")}\n----- documento non fiscale -----\n`;
        const file = scrivi(cartella, "registratore", testo);
        fogli.push({ apparecchio: "registratore", file, testo });
        di("documento non fiscale in", file);
      }
      risposta.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
      risposta.end(xml);
    });
  });

  await Promise.all([
    new Promise((ok, ko) => stampante.once("error", ko).listen(portaStampante, "127.0.0.1", ok)),
    new Promise((ok, ko) => registratore.once("error", ko).listen(portaRegistratore, "127.0.0.1", ok)),
  ]);
  di(`stampante finta su 127.0.0.1:${portaStampante}, registratore finto su 127.0.0.1:${portaRegistratore}, modo «${modo}»`);

  return {
    fogli,
    chiudi: () =>
      Promise.all([
        new Promise((ok) => stampante.close(ok)),
        new Promise((ok) => {
          registratore.closeAllConnections?.();
          registratore.close(ok);
        }),
      ]),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await avviaSimulatore({ modo: process.argv[2] ?? "normale" });
}
