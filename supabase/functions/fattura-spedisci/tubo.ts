// Il tubo verso la PEC: una connessione cifrata (TLS) sulla porta 465.
// Tutto il resto del dialogo è in `_shared/smtp.js`, provato in Node.
//
// ⚠️ Un tempo massimo per tutta la conversazione: un server che non
//    risponde non deve tenere ferma la funzione (e il bottone in pagina)
//    fino al limite di Supabase. Scaduto il tempo, la connessione si chiude
//    e la lettura in corso fallisce con una frase che lo dice.

import { lettoreRisposte } from "../_shared/smtp.js";

export type Tubo = {
  leggiRisposta: () => Promise<{ codice: number; righe: string[] }>;
  scrivi: (testo: string) => Promise<void>;
  chiudi: () => void;
};

export async function apriTubo(host: string, porta: number, millisecondi = 30000): Promise<Tubo> {
  let scaduto = false;
  const conn = await Deno.connectTls({ hostname: host, port: porta });
  const orologio = setTimeout(() => {
    scaduto = true;
    try {
      conn.close();
    } catch {
      // già chiusa
    }
  }, millisecondi);

  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buffer = "";

  async function leggiRiga(): Promise<string> {
    while (!buffer.includes("\r\n")) {
      const pezzo = new Uint8Array(4096);
      let n: number | null;
      try {
        n = await conn.read(pezzo);
      } catch (e) {
        if (scaduto) throw new Error(`La PEC non ha risposto entro ${millisecondi / 1000} secondi.`);
        throw e;
      }
      if (n === null) {
        throw new Error(scaduto
          ? `La PEC non ha risposto entro ${millisecondi / 1000} secondi.`
          : "La PEC ha chiuso la connessione a metà.");
      }
      buffer += dec.decode(pezzo.subarray(0, n), { stream: true });
    }
    const i = buffer.indexOf("\r\n");
    const riga = buffer.slice(0, i);
    buffer = buffer.slice(i + 2);
    return riga;
  }

  return {
    leggiRisposta: lettoreRisposte(leggiRiga),
    async scrivi(testo: string) {
      const byte = enc.encode(testo);
      let scritti = 0;
      while (scritti < byte.length) scritti += await conn.write(byte.subarray(scritti));
    },
    chiudi() {
      clearTimeout(orologio);
      try {
        conn.close();
      } catch {
        // già chiusa
      }
    },
  };
}
