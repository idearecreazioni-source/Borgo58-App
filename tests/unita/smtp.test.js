// La spedizione dalla PEC (13/11/2026, fatture ai clienti pezzo 3): il
// dialogo con il server di posta, provato contro un server finto, e la
// regola «parte davvero solo da work».
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  base64Utf8,
  dialogoSmtp,
  lettoreRisposte,
  messaggioConAllegato,
} from "../../supabase/functions/_shared/smtp.js";
import { REF_PRODUZIONE, siamoInProduzione } from "../../supabase/functions/fattura-spedisci/ambiente.js";
import { REF_PRODUZIONE as REF_DEGLI_SCRIPT, REF_PROVA } from "../../scripts/comune.mjs";

/**
 * Un server finto: risponde a ogni comando come gli si dice, e tiene il
 * conto di quello che ha ricevuto.
 */
function serverFinto({ auth = "250-AUTH PLAIN LOGIN", rifiuta = {} } = {}) {
  const ricevuto = [];
  const coda = ["220 smtps.pec.aruba.it ESMTP"];
  let inData = false;
  let corpo = "";
  const righe = async () => {
    if (!coda.length) throw new Error("il server finto non ha più niente da dire");
    return coda.shift();
  };
  return {
    ricevuto,
    corpo: () => corpo,
    leggiRisposta: lettoreRisposte(righe),
    async scrivi(testo) {
      if (inData) {
        corpo += testo;
        if (corpo.endsWith("\r\n.\r\n")) {
          inData = false;
          coda.push(rifiuta.invio ?? "250 2.0.0 Ok: queued as ABC123");
        }
        return;
      }
      const cmd = testo.replace(/\r\n$/, "");
      ricevuto.push(cmd);
      const verbo = cmd.split(" ")[0].toUpperCase();
      if (verbo === "EHLO") coda.push("250-smtps.pec.aruba.it", "250-PIPELINING", auth, "250 8BITMIME");
      else if (verbo === "AUTH" && cmd.startsWith("AUTH PLAIN")) coda.push(rifiuta.auth ?? "235 2.7.0 Authentication successful");
      else if (cmd === "AUTH LOGIN") coda.push("334 VXNlcm5hbWU6");
      else if (ricevuto.at(-2) === "AUTH LOGIN") coda.push("334 UGFzc3dvcmQ6");
      else if (ricevuto.at(-3) === "AUTH LOGIN") coda.push(rifiuta.auth ?? "235 ok");
      else if (verbo === "MAIL") coda.push("250 2.1.0 Ok");
      else if (verbo === "RCPT") coda.push(rifiuta.rcpt ?? "250 2.1.5 Ok");
      else if (verbo === "DATA") {
        coda.push("354 End data with <CR><LF>.<CR><LF>");
        inData = true;
      } else if (verbo === "QUIT") coda.push("221 2.0.0 Bye");
      else coda.push("502 non capito");
    },
  };
}

const MAIL = {
  da: "borgo58@pec.it",
  a: "sdi01@pec.fatturapa.it",
  oggetto: "Invio fattura IT01343950869_00001.xml",
  testo: "Fattura elettronica 1/2027 di Borgo 58, in allegato.",
  allegato: { nome: "IT01343950869_00001.xml", contenuto: '<?xml version="1.0"?>\n<p:FatturaElettronica>Caffè</p:FatturaElettronica>\n' },
  data: new Date("2027-01-15T10:00:00Z"),
  idMessaggio: "prova-1@borgo58.it",
};

describe("la mail con la fattura", () => {
  it("ha l'allegato col nome del file e il contenuto intatto (anche le lettere accentate)", () => {
    const m = messaggioConAllegato(MAIL);
    expect(m).toContain("From: borgo58@pec.it\r\n");
    expect(m).toContain("To: sdi01@pec.fatturapa.it\r\n");
    expect(m).toContain('Content-Disposition: attachment; filename="IT01343950869_00001.xml"');
    const pezzo = m.split('filename="IT01343950869_00001.xml"\r\n\r\n')[1].split("\r\n--")[0];
    const testo = new TextDecoder().decode(Uint8Array.from(atob(pezzo.replace(/\r\n/g, "")), (c) => c.charCodeAt(0)));
    expect(testo).toBe(MAIL.allegato.contenuto);
    expect(m.split("\r\n").every((r) => r.length <= 998)).toBe(true);
  });

  it("un a capo nell'oggetto non apre un'intestazione nuova", () => {
    const m = messaggioConAllegato({ ...MAIL, oggetto: "ciao\r\nBcc: altro@esempio.it" });
    expect(m).not.toMatch(/^Bcc:/m);
  });

  it("un indirizzo storto ferma tutto", () => {
    expect(() => messaggioConAllegato({ ...MAIL, a: "sdi01@pec" })).toThrow(/non è un indirizzo email/);
    expect(() => messaggioConAllegato({ ...MAIL, a: "x@y.it>\r\nRCPT TO:<z@w.it" })).toThrow(/non è un indirizzo email/);
  });

  it("base64 in righe da 76", () => {
    expect(base64Utf8("è")).toBe("w6g=");
    expect(base64Utf8("x".repeat(200)).split("\r\n").map((r) => r.length)).toEqual([76, 76, 76, 40]);
  });
});

describe("il dialogo con la PEC", () => {
  it("manda la mail: EHLO, accesso, mittente, destinatario, il messaggio, QUIT", async () => {
    const s = serverFinto();
    const messaggio = messaggioConAllegato(MAIL);
    const r = await dialogoSmtp(s, { utente: "borgo58@pec.it", password: "segreta", ...MAIL, messaggio });
    expect(r.accettato).toBe("2.0.0 Ok: queued as ABC123");
    expect(s.ricevuto).toEqual([
      "EHLO borgo58.it",
      `AUTH PLAIN ${btoa("\u0000borgo58@pec.it\u0000segreta")}`,
      "MAIL FROM:<borgo58@pec.it>",
      "RCPT TO:<sdi01@pec.fatturapa.it>",
      "DATA",
      "QUIT",
    ]);
    expect(s.corpo().endsWith("\r\n.\r\n")).toBe(true);
  });

  it("un punto a inizio riga si raddoppia (sennò il server crederebbe finito il messaggio)", async () => {
    const s = serverFinto();
    await dialogoSmtp(s, { utente: "u@pec.it", password: "p", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "Riga\r\n.\r\naltra" });
    expect(s.corpo()).toBe("Riga\r\n..\r\naltra\r\n.\r\n");
  });

  it("se il server sa solo AUTH LOGIN, usa quello", async () => {
    const s = serverFinto({ auth: "250-AUTH LOGIN" });
    await dialogoSmtp(s, { utente: "u@pec.it", password: "p" });
    expect(s.ricevuto.slice(1, 4)).toEqual(["AUTH LOGIN", btoa("u@pec.it"), btoa("p")]);
  });

  it("password sbagliata: lo dice in italiano, senza ripetere la password", async () => {
    const s = serverFinto({ rifiuta: { auth: "535 5.7.8 Error: authentication failed" } });
    const p = dialogoSmtp(s, { utente: "u@pec.it", password: "segretissima", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "x" });
    await expect(p).rejects.toThrow(/rifiutato utente o password \(535\).*PEC_PASSWORD/);
    await p.catch((e) => expect(e.message).not.toContain("segretissima"));
    expect(s.ricevuto).not.toContain("DATA");
  });

  it("destinatario rifiutato: si ferma prima di mandare il messaggio", async () => {
    const s = serverFinto({ rifiuta: { rcpt: "550 5.1.1 utente sconosciuto" } });
    await expect(
      dialogoSmtp(s, { utente: "u@pec.it", password: "p", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "x" })
    ).rejects.toThrow("La PEC ha rifiutato il destinatario (550 5.1.1 utente sconosciuto).");
    expect(s.ricevuto).not.toContain("DATA");
  });

  it("dopo il messaggio, un silenzio è «incerto» (potrebbe essere partita); un rifiuto esplicito no", async () => {
    const muto = serverFinto({ rifiuta: { invio: "riga storta" } });
    const e1 = await dialogoSmtp(muto, { utente: "u@pec.it", password: "p", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "x" }).catch((e) => e);
    expect(e1.incerto).toBe(true);
    const rifiuta = serverFinto({ rifiuta: { invio: "554 5.7.1 messaggio rifiutato" } });
    const e2 = await dialogoSmtp(rifiuta, { utente: "u@pec.it", password: "p", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "x" }).catch((e) => e);
    expect(e2.message).toMatch(/^La PEC ha rifiutato il messaggio \(554/);
    expect(e2.incerto).toBeUndefined();
    const prima = serverFinto({ rifiuta: { rcpt: "550 no" } });
    const e3 = await dialogoSmtp(prima, { utente: "u@pec.it", password: "p", da: "u@pec.it", a: "sdi01@pec.fatturapa.it", messaggio: "x" }).catch((e) => e);
    expect(e3.incerto).toBeUndefined();
  });

  it("senza messaggio prova solo l'accesso (il «Prova la PEC»)", async () => {
    const s = serverFinto();
    const r = await dialogoSmtp(s, { utente: "u@pec.it", password: "p" });
    expect(r.accettato).toBeNull();
    expect(s.ricevuto.map((c) => c.split(" ")[0])).toEqual(["EHLO", "AUTH", "QUIT"]);
  });

  it("una risposta su più righe si legge intera", async () => {
    const coda = ["250-uno", "250-due", "250 tre"];
    const r = await lettoreRisposte(async () => coda.shift())();
    expect(r).toEqual({ codice: 250, righe: ["uno", "due", "tre"] });
  });
});

describe("parte davvero solo da work", () => {
  it("solo l'indirizzo esatto di produzione spedisce", () => {
    expect(REF_PRODUZIONE).toBe(REF_DEGLI_SCRIPT);
    expect(siamoInProduzione(`https://${REF_PRODUZIONE}.supabase.co`)).toBe(true);
    expect(siamoInProduzione(`https://${REF_PROVA}.supabase.co`)).toBe(false);
    expect(siamoInProduzione("http://127.0.0.1:54321")).toBe(false);
    expect(siamoInProduzione(`https://${REF_PRODUZIONE}.supabase.co.esempio.it`)).toBe(false);
    expect(siamoInProduzione(undefined)).toBe(false);
    expect(siamoInProduzione("non è un indirizzo")).toBe(false);
  });

  it("la funzione decide dall'ambiente, non dal corpo della richiesta", () => {
    const testo = readFileSync("supabase/functions/fattura-spedisci/index.ts", "utf8");
    expect(testo).toMatch(/const davvero = siamoInProduzione\(supabaseUrl\);/);
    expect(testo).not.toMatch(/corpo\?\.\s*(davvero|simula|produzione)/);
    // il file si controlla PRIMA di numerare, e la password pure
    expect(testo.indexOf("prima.errori.length")).toBeLessThan(testo.indexOf('rpc("prepara_invio_fattura"'));
    expect(testo.indexOf("return errore(500, \"pec_config\", MANCA_PASSWORD)")).toBeLessThan(
      testo.indexOf('rpc("prepara_invio_fattura"')
    );
  });
});
