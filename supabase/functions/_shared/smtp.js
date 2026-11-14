/**
 * Spedire una mail dalla PEC (13/11/2026, fatture ai clienti pezzo 3).
 *
 * ⚠️ PERCHÉ UN DIALOGO SCRITTO QUI E NON UNA LIBRERIA. Le librerie di posta
 * di Node (nodemailer) non sono garantite sulle funzioni di Supabase, che
 * girano su Deno; il 13/11 non si è trovata nessuna conferma che ci
 * funzionino. Il protocollo per mandare UNA mail con UN allegato sono
 * otto battute (saluto, EHLO, AUTH, MAIL FROM, RCPT TO, DATA, il testo,
 * QUIT): scritte qui, senza dipendenze, si provano tutte in Node contro un
 * server finto (`tests/unita/smtp.test.js`). Solo il tubo — la connessione
 * cifrata, `Deno.connectTls` sulla porta 465 — sta nella funzione.
 *
 * ⚠️ LA PASSWORD NON FINISCE MAI IN UN MESSAGGIO D'ERRORE: gli errori
 * riportano il codice e la frase del server, mai quello che si è mandato.
 */

const CRLF = "\r\n";

/** Testo → byte UTF-8 → base64, in righe da 76 (come vuole la posta). */
export function base64Utf8(testo, { righe = true } = {}) {
  const byte = new TextEncoder().encode(String(testo));
  let binario = "";
  for (let i = 0; i < byte.length; i += 0x8000) {
    binario += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  }
  const b64 = btoa(binario);
  if (!righe) return b64;
  return b64.match(/.{1,76}/g)?.join(CRLF) ?? "";
}

/** Solo caratteri semplici in un'intestazione: niente a capo (non si iniettano intestazioni). */
function intestazione(valore) {
  return String(valore ?? "").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
}

function indirizzo(valore) {
  const s = String(valore ?? "").trim();
  if (!/^[^\s<>@,;:"]+@[^\s<>@,;:"]+\.[A-Za-z]{2,}$/.test(s)) {
    throw new Error(`L'indirizzo «${intestazione(s)}» non è un indirizzo email.`);
  }
  return s;
}

/**
 * La mail con l'allegato, pronta per DATA.
 * @param {{da: string, a: string, oggetto: string, testo: string,
 *          allegato: {nome: string, contenuto: string, tipo?: string},
 *          data?: Date, idMessaggio?: string}} m
 */
export function messaggioConAllegato(m) {
  const da = indirizzo(m.da);
  const a = indirizzo(m.a);
  const nome = intestazione(m.allegato.nome);
  const confine = `borgo58-${(m.idMessaggio ?? crypto.randomUUID()).replace(/[^A-Za-z0-9]/g, "")}`;
  const id = m.idMessaggio ?? `${crypto.randomUUID()}@borgo58.it`;
  return [
    `From: ${da}`,
    `To: ${a}`,
    `Subject: ${intestazione(m.oggetto)}`,
    `Date: ${(m.data ?? new Date()).toUTCString()}`,
    `Message-ID: <${intestazione(id)}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${confine}"`,
    "",
    `--${confine}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(m.testo ?? ""),
    `--${confine}`,
    `Content-Type: ${intestazione(m.allegato.tipo ?? "application/xml")}; name="${nome}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${nome}"`,
    "",
    base64Utf8(m.allegato.contenuto),
    `--${confine}--`,
    "",
  ].join(CRLF);
}

/**
 * Le risposte del server da un lettore di righe. Una risposta può stare su
 * più righe («250-PIPELINING», «250-AUTH PLAIN LOGIN», «250 OK»): finisce
 * alla riga col codice seguito da uno spazio.
 * @param {() => Promise<string>} leggiRiga
 */
export function lettoreRisposte(leggiRiga) {
  return async function leggiRisposta() {
    const righe = [];
    for (;;) {
      const riga = await leggiRiga();
      const m = /^(\d{3})([ -])(.*)$/.exec(riga);
      if (!m) throw new Error(`La PEC ha risposto in un modo che non capisco: «${intestazione(riga).slice(0, 120)}».`);
      righe.push(m[3]);
      if (m[2] === " ") return { codice: Number(m[1]), righe };
    }
  };
}

const COSA = {
  saluto: "il saluto",
  ehlo: "la presentazione",
  auth: "l'accesso",
  mittente: "il mittente",
  destinatario: "il destinatario",
  data: "l'inizio del messaggio",
  invio: "il messaggio",
};

function pretendi(risposta, attesi, passo) {
  if (attesi.includes(risposta.codice)) return risposta;
  const frase = intestazione(risposta.righe.join(" ")).slice(0, 200);
  if (passo === "auth" && (risposta.codice === 535 || risposta.codice === 534)) {
    throw new Error(
      `La PEC ha rifiutato utente o password (${risposta.codice}): controlla PEC_UTENTE e PEC_PASSWORD nei Secrets di Supabase.`
    );
  }
  throw new Error(`La PEC ha rifiutato ${COSA[passo]} (${risposta.codice} ${frase}).`);
}

/** Il testo del messaggio con i punti a inizio riga raddoppiati (regola di DATA). */
function conPuntiRaddoppiati(messaggio) {
  return messaggio.replace(/\r\n\./g, "\r\n..").replace(/^\./, "..");
}

/**
 * Il dialogo con il server. Con `messaggio` assente si ferma dopo l'accesso:
 * serve a provare utente e password senza mandare niente.
 *
 * @param {{leggiRisposta: () => Promise<{codice: number, righe: string[]}>,
 *          scrivi: (testo: string) => Promise<void>}} conn
 * @param {{utente: string, password: string, nomeHost?: string,
 *          da?: string, a?: string, messaggio?: string}} p
 * @returns {Promise<{accettato: string|null}>} la frase con cui il server ha preso il messaggio
 */
export async function dialogoSmtp(conn, { utente, password, nomeHost = "borgo58.it", da, a, messaggio }) {
  const manda = (riga) => conn.scrivi(riga + CRLF);
  pretendi(await conn.leggiRisposta(), [220], "saluto");
  await manda(`EHLO ${nomeHost}`);
  const ehlo = pretendi(await conn.leggiRisposta(), [250], "ehlo");
  const auth = ehlo.righe.find((r) => /^AUTH[ =]/i.test(r)) ?? "";
  if (/\bPLAIN\b/i.test(auth) || !/\bLOGIN\b/i.test(auth)) {
    await manda(`AUTH PLAIN ${base64Utf8(`\u0000${utente}\u0000${password}`, { righe: false })}`);
    pretendi(await conn.leggiRisposta(), [235], "auth");
  } else {
    await manda("AUTH LOGIN");
    pretendi(await conn.leggiRisposta(), [334], "auth");
    await manda(base64Utf8(utente, { righe: false }));
    pretendi(await conn.leggiRisposta(), [334], "auth");
    await manda(base64Utf8(password, { righe: false }));
    pretendi(await conn.leggiRisposta(), [235], "auth");
  }

  let accettato = null;
  if (messaggio != null) {
    await manda(`MAIL FROM:<${indirizzo(da)}>`);
    pretendi(await conn.leggiRisposta(), [250], "mittente");
    await manda(`RCPT TO:<${indirizzo(a)}>`);
    pretendi(await conn.leggiRisposta(), [250, 251], "destinatario");
    await manda("DATA");
    pretendi(await conn.leggiRisposta(), [354], "data");
    const corpo = conPuntiRaddoppiati(messaggio.endsWith(CRLF) ? messaggio : messaggio + CRLF);
    // ⚠️ DA QUI UN ERRORE NON DICE «NON È PARTITA» (revisione del 13/11): il
    //    server può aver preso il messaggio e poi non essere riuscito a
    //    dirlo. Chi chiama non deve rimandare: deve guardare nella posta
    //    inviata. Un rifiuto ESPLICITO del server (un codice diverso da 250)
    //    invece vuol dire che non l'ha preso.
    try {
      await conn.scrivi(corpo + "." + CRLF);
      const fine = await conn.leggiRisposta();
      accettato = pretendi(fine, [250], "invio").righe.join(" ");
    } catch (e) {
      if (!/^La PEC ha rifiutato il messaggio/.test(e.message)) e.incerto = true;
      throw e;
    }
  }

  // L'arrivederci non decide niente: il messaggio, se c'era, è già preso.
  try {
    await manda("QUIT");
    await conn.leggiRisposta();
  } catch {
    // il server può chiudere prima di rispondere: va bene così
  }
  return { accettato };
}
