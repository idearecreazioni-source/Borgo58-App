/**
 * npm run dominio:verifica
 *
 * Controlla le due cose che il passaggio del dominio a Cloudflare può
 * rompere, e le controlla SEPARATAMENTE:
 *
 *   1. LA POSTA — `info@borgo58.it` deve continuare a ricevere. È la parte
 *      pericolosa: cambiando i server DNS del dominio, i record della posta
 *      NON si spostano da soli. Se qui compare un ❌, la casella è cieca e
 *      chi scrive al locale riceve un errore o, peggio, niente.
 *   2. IL SITO — `borgo58.it` deve rispondere con il gestionale, non con la
 *      pagina di parcheggio di Aruba.
 *
 * Lo script esce con codice 1 se la POSTA è rotta, anche quando il sito
 * funziona: fra le due, quella che va sorvegliata è la posta.
 *
 * Nessuna password, nessuna chiave: interroga solo il DNS pubblico e fa due
 * richieste HTTP. Si può lanciare da qualunque computer, anche fra un anno.
 */

import { Resolver } from "node:dns/promises";

const DOMINIO = "borgo58.it";
const TITOLO = "<title>Borgo 58 · Gestionale</title>";

/** I DNS pubblici da interrogare: due, per non fidarsi di uno solo. */
const RISOLUTORI = [
  ["Google", "8.8.8.8"],
  ["Cloudflare", "1.1.1.1"],
];

const risolutore = (ip) => {
  const r = new Resolver();
  r.setServers([ip]);
  return r;
};

/** Ritorna [] invece di sollevare: "non esiste" è una risposta, non un errore. */
async function chiedi(r, metodo, nome) {
  try {
    return await r[metodo](nome);
  } catch {
    return [];
  }
}

const esiti = [];
const segna = (ok, critico, testo) => {
  esiti.push({ ok, critico });
  console.log(`${ok ? "✅" : "❌"} ${testo}`);
};

console.log(`\n=== ${DOMINIO} — posta e sito ===\n`);

for (const [nomeDns, ip] of RISOLUTORI) {
  const r = risolutore(ip);
  console.log(`--- visto da ${nomeDns} (${ip})`);

  // ---------------------------------------------------------------- POSTA
  const mx = await chiedi(r, "resolveMx", DOMINIO);
  segna(
    mx.length > 0,
    true,
    `posta in arrivo: ${mx.length} server dichiarati${
      mx.length ? ` (${mx.map((m) => m.exchange).join(", ")})` : " — NESSUNO"
    }`,
  );

  // Un MX che punta a un nome senza indirizzo è peggio di nessun MX: il
  // dominio dichiara di ricevere posta e poi non la riceve.
  for (const m of mx) {
    const ips = await chiedi(r, "resolve4", m.exchange);
    segna(
      ips.length > 0,
      true,
      `   ${m.exchange} → ${ips.length ? `${ips.length} indirizzi` : "NESSUN indirizzo"}`,
    );
  }

  const txt = (await chiedi(r, "resolveTxt", DOMINIO)).map((t) => t.join(""));
  const spf = txt.find((t) => t.startsWith("v=spf1"));
  segna(
    Boolean(spf?.includes("_spf.aruba.it")),
    true,
    `firma di chi può scrivere a nome del dominio (SPF): ${spf ?? "ASSENTE"}`,
  );

  const dmarc = (await chiedi(r, "resolveTxt", `_dmarc.${DOMINIO}`))
    .map((t) => t.join(""))
    .find((t) => t.startsWith("v=DMARC1"));
  segna(Boolean(dmarc), false, `regola anti-falsificazione (DMARC): ${dmarc ?? "assente"}`);

  // Le tre porte da cui Alessio legge e scrive la posta.
  for (const host of ["webmail", "smtp", "imap"]) {
    const nome = `${host}.${DOMINIO}`;
    const ips = await chiedi(r, "resolve4", nome);
    segna(ips.length > 0, true, `   ${nome} → ${ips.length ? ips.join(", ") : "NON RISPONDE"}`);
  }

  console.log("");
}

// ------------------------------------------------------------------- SITO
for (const indirizzo of [`https://${DOMINIO}/prenota`, `https://www.${DOMINIO}/prenota`]) {
  try {
    const risposta = await fetch(indirizzo, { redirect: "follow" });
    const corpo = await risposta.text();
    segna(
      risposta.ok && corpo.includes(TITOLO),
      false,
      `${indirizzo} → ${risposta.status}${
        corpo.includes(TITOLO) ? " e c'è il gestionale" : " ma NON è il gestionale"
      }`,
    );
  } catch (errore) {
    segna(false, false, `${indirizzo} → non raggiungibile (${errore.message})`);
  }
}

// ------------------------------------------------------------------ ESITO
const postaRotta = esiti.filter((e) => e.critico && !e.ok).length;
const sitoDaFare = esiti.filter((e) => !e.critico && !e.ok).length;

console.log("");
if (postaRotta) {
  console.log(`❌ POSTA: ${postaRotta} controlli falliti — la casella del locale è a rischio.`);
  console.log("   Rimetti i record della posta come sono elencati in docs/DOMINIO.md.");
} else {
  console.log("✅ POSTA: il dominio riceve regolarmente.");
}
console.log(
  sitoDaFare
    ? `⏳ SITO: ${sitoDaFare} controlli non ancora a posto (normale finché il passaggio non è finito).`
    : "✅ SITO: borgo58.it apre il gestionale.",
);
console.log("");

process.exit(postaRotta ? 1 : 0);
