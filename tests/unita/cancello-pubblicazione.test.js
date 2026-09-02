// =====================================================================
// IL CANCELLO FRA UN COMMIT E borgo58.it — 01/09/2026
// =====================================================================
//
// 🔴 QUESTO E' UN CONTROLLO STRUTTURALE DEL WORKFLOW, NON UN TEST NEGATIVO —
//    e il nome conta, perche' quello vecchio prometteva una cosa che nessuno
//    ha visto. «Test negativo» si legge *«abbiamo guardato un commit rosso
//    non pubblicare»*: non e' successo. Qui si prova che la riga che lo
//    impedirebbe **c'e' e non e' stata tolta**.
//
//    Il cancello e' `needs: [codice, database]`, cioe' e' scritto dove GitHub
//    lo fa rispettare da se': un lavoro che dipende da due lavori e che uno
//    dei due fallisce non parte. Non e' una nostra condizione, quindi non e'
//    una condizione che possiamo sbagliare.
//
// ⚠️ LA DISTANZA FRA LE DUE COSE E' LA STESSA che passa fra «la funzione e'
//    stata riscritta» e «la funzione risponde» (17/08), e in questo progetto
//    quella distanza e' gia' costata una volta. La dimostrazione dal vivo la
//    da' il lavoro `prova_di_rilascio` col valore `prova` dell'interruttore —
//    e anche quella dimostra **la filiera consentita verso un'anteprima dopo
//    due lavori verdi**, non il blocco col rosso.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { problemaDellAccount, FORMA_ACCOUNT, differenze } from "../../scripts/cloudflare-verifica.mjs";
import {
  problemaDiCoerenza,
  problemaDelPacchetto,
  RAMO_PROVA_DI_RILASCIO,
  AMBIENTI,
} from "../../scripts/rilascio.mjs";
import { REF_PROVA, REF_PRODUZIONE } from "../../scripts/comune.mjs";

const workflow = readFileSync(".github/workflows/controlli.yml", "utf8");
const anteprima = readFileSync(".github/workflows/anteprima.yml", "utf8");
const guida = readFileSync("docs/CLOUDFLARE.md", "utf8");

const lavoro = (testo, nome, dopo) =>
  testo.slice(testo.indexOf(`\n  ${nome}:`), dopo ? testo.indexOf(`\n  ${dopo}:`) : undefined);
const lavoroProva = lavoro(workflow, "prova_di_rilascio", "pubblica");
const lavoroPubblica = lavoro(workflow, "pubblica");

describe("la pubblicazione non parte se i controlli sono rossi", () => {
  it("dipende da TUTTI E DUE i lavori dei controlli", () => {
    // Non basta `needs: codice`: le 459 prove contro il database stanno nel
    // secondo, ed e' quello che il 31/08 era rosso mentre il sito andava
    // online lo stesso.
    expect(lavoroPubblica).toMatch(/needs:\s*\[\s*codice\s*,\s*database\s*\]/);
    expect(lavoroProva).toMatch(/needs:\s*\[\s*codice\s*,\s*database\s*\]/);
  });

  it("gira solo sul ramo principale", () => {
    expect(lavoroPubblica).toMatch(/github\.ref == 'refs\/heads\/master'/);
  });

  it("resta spento finche' qualcuno non lo accende apposta", () => {
    // 🔴 E' cio' che rende sicuro unire questo lavoro: appena unito non cambia
    //    niente, perche' la variabile non esiste.
    expect(lavoroPubblica).toMatch(/vars\.PUBBLICAZIONE_DA_GITHUB == 'si'/);
    expect(lavoroProva).toMatch(/vars\.PUBBLICAZIONE_DA_GITHUB == 'prova'/);
  });

  it("🔴 l'interruttore e' letto in `if:`, quindi NON puo' vivere nell'ambiente", () => {
    // GitHub valuta `if:` PRIMA di assegnare l'ambiente: una variabile
    // d'ambiente leggerebbe vuoto e il lavoro verrebbe saltato SEMPRE — un
    // cancello che sembra funzionare perche' non pubblica mai. Fallisce nella
    // direzione sicura e in silenzio, ed e' la forma peggiore. Questa prova e'
    // l'unica cosa che se ne accorgerebbe.
    expect(lavoroPubblica).toMatch(/if:.*vars\.PUBBLICAZIONE_DA_GITHUB == 'si'/);
    expect(guida).toMatch(/PUBBLICAZIONE_DA_GITHUB[^\n|]*\|[^\n|]*Repository Variable/);
  });

  it("i due lavori dichiarano il proprio ambiente", () => {
    expect(lavoroPubblica).toMatch(/^\s*environment: produzione$/m);
    expect(lavoroProva).toMatch(/^\s*environment: anteprima$/m);
    expect(anteprima).toMatch(/^\s*environment: anteprima$/m);
  });

  it("il numero dell'account NON passa dai segreti", () => {
    // Non e' un segreto (si legge nell'indirizzo del pannello), e messo fra i
    // segreti arriva vuoto quando il segreto non c'e' — spegnendo il lavoro in
    // silenzio, che e' il difetto misurato il 01/09 sulla pulizia.
    expect(lavoroPubblica).toMatch(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/);
    expect(workflow).not.toMatch(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\./);
    expect(anteprima).not.toMatch(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\./);
  });

  it("la chiave di Cloudflare invece SI'", () => {
    expect(lavoroPubblica).toMatch(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  });

  it("il ramo di produzione si chiede a Cloudflare, non solo a `if:`", () => {
    // `if:` guarda il ramo di GitHub; questo guarda quale ramo Cloudflare
    // chiama produzione — un dato del pannello, che puo' cambiare senza che il
    // workflow se ne accorga.
    expect(lavoroPubblica).toMatch(/--ambiente produzione --controlla\b/);
  });

  it("il lavoro di anteprima rifiuta i riferimenti che non sono rami", () => {
    expect(anteprima).toMatch(/github\.ref_type == 'branch'/);
    // ⚠️ `\r?\n` E NON `\n`: questo file si legge dal disco, e su Windows
    //    arriva coi fine riga di quel sistema. Con `\n` secco la prova
    //    falliva **solo sul computer di Alessio** — e non per un difetto del
    //    workflow, ma perché la regola cercava una forma di fine riga invece
    //    del permesso. Il controllo è lo stesso: «permissions:» e sotto,
    //    rientrato, «contents: read».
    expect(anteprima).toMatch(/^permissions:\r?\n\s+contents: read$/m);
  });
});

describe("il bersaglio su Cloudflare e' dichiarato una volta e usato due", () => {
  it("la prova generale lo dichiara in cima al lavoro", () => {
    // Passandolo al solo caricamento, il controllo approverebbe un bersaglio e
    // Wrangler ne scriverebbe un altro: un guardiano che sorveglia una cosa
    // diversa da quella che succede.
    expect(lavoroProva).toMatch(/env:\s*\n\s+RAMO_ANTEPRIMA: prova-di-rilascio/);
    expect(lavoroProva).toMatch(/--ambiente anteprima --controlla\b/);
    expect(lavoroProva).toMatch(/--ambiente anteprima --conferma/);
  });

  it("e il lavoro manuale lo dichiara col proprio ramo", () => {
    expect(anteprima).toMatch(/env:\s*\n\s+RAMO_ANTEPRIMA: \$\{\{ github\.ref_name \}\}/);
    expect(anteprima).toMatch(/--ambiente anteprima --controlla\b/);
  });

  it("il controllo viene PRIMA della compilazione, in tutti e tre i lavori", () => {
    // Se il bersaglio non torna non si spendono tre minuti di compilazione, e
    // non resta in giro un `dist/` costruito per un bersaglio respinto.
    for (const testo of [lavoroProva, lavoroPubblica, anteprima])
      expect(testo.indexOf("--controlla\n")).toBeLessThan(testo.indexOf("npm run build"));
  });
});

describe("ambiente, ramo di GitHub e ramo di Cloudflare devono dire la stessa storia", () => {
  const base = { tipoRef: "branch", ramoDiProduzione: "master" };
  const c = (o) => problemaDiCoerenza({ ...base, ...o });

  it("la prova generale: su master, verso il solo ramo permesso", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "master", ramoCloudflare: RAMO_PROVA_DI_RILASCIO })).toBeNull());
  it("un'anteprima normale: stesso ramo di qua e di la'", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "claude/x", ramoCloudflare: "claude/x" })).toBeNull());
  it("la produzione: master di qua, master di la'", () =>
    expect(c({ ambiente: "produzione", ramoGitHub: "master", ramoCloudflare: "master" })).toBeNull());

  it("🔴 su master, un'anteprima verso un ramo QUALUNQUE e' respinta", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "master", ramoCloudflare: "collaudo" })).toMatch(
      /l'unica anteprima permessa/,
    ));
  it("su master, un'anteprima verso master e' respinta", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "master", ramoCloudflare: "master" })).toMatch(/ramo di produzione/));
  it("un'anteprima che scriverebbe su un ramo diverso dal proprio e' respinta", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "claude/x", ramoCloudflare: "claude/y" })).toMatch(
      /si costruisce su quel ramo/,
    ));
  it("un'anteprima verso `production` e' respinta anche se non e' IL ramo di produzione", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "claude/x", ramoCloudflare: "production" })).toMatch(
      /ramo di produzione/,
    ));
  it("la produzione da un ramo che non e' quello di produzione e' respinta", () =>
    expect(c({ ambiente: "produzione", ramoGitHub: "claude/x", ramoCloudflare: "master" })).toMatch(
      /il ramo di produzione di Cloudflare/,
    ));
  it("la produzione che scriverebbe altrove e' respinta", () =>
    expect(c({ ambiente: "produzione", ramoGitHub: "master", ramoCloudflare: "collaudo" })).toMatch(
      /ma la produzione e'/,
    ));

  // Fallire chiuso: ogni dato che manca e' un rifiuto.
  it("senza il ramo di produzione dichiarato da Cloudflare non si pubblica", () =>
    expect(
      problemaDiCoerenza({ ambiente: "produzione", tipoRef: "branch", ramoGitHub: "master", ramoCloudflare: "master", ramoDiProduzione: "" }),
    ).toMatch(/non posso decidere/));
  it("senza bersaglio su Cloudflare non si pubblica", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "claude/x", ramoCloudflare: "" })).toMatch(/Non so su quale ramo/));
  it("senza ramo di GitHub non si pubblica", () =>
    expect(c({ ambiente: "anteprima", ramoGitHub: "", ramoCloudflare: "claude/x" })).toMatch(/da quale ramo di GitHub/));
  it("un'etichetta non e' un ramo", () =>
    expect(c({ ambiente: "anteprima", tipoRef: "tag", ramoGitHub: "v1", ramoCloudflare: "v1" })).toMatch(/non un ramo/));
  it("un ambiente sconosciuto e' respinto", () =>
    expect(c({ ambiente: "collaudo", ramoGitHub: "claude/x", ramoCloudflare: "claude/x" })).toMatch(/sconosciuto/));
});

describe("il pacchetto compilato: otto porte, tutte sbarrate", () => {
  const chiave = (ref, role = "anon") =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ ref, role })).toString("base64url")}.firma`;
  const finto = (testo) => () => testo;
  const p = (testo, atteso = REF_PROVA) => problemaDelPacchetto("dist", atteso, finto(testo));

  it("il caso buono passa", () =>
    expect(p(`https://${REF_PROVA}.supabase.co ${chiave(REF_PROVA)}`)).toBeNull());

  it("niente di compilato", () =>
    expect(problemaDelPacchetto("dist", REF_PROVA, () => null)).toMatch(/non c'e' niente di compilato/));
  it("nessun indirizzo", () => expect(p(`niente di utile ${chiave(REF_PROVA)}`)).toMatch(/NESSUN progetto/));
  it("due indirizzi", () =>
    expect(p(`https://${REF_PROVA}.supabase.co https://${REF_PRODUZIONE}.supabase.co ${chiave(REF_PROVA)}`)).toMatch(
      /ne nomina 2/,
    ));
  it("l'indirizzo sbagliato", () =>
    expect(p(`https://${REF_PRODUZIONE}.supabase.co ${chiave(REF_PRODUZIONE)}`)).toMatch(/atteso/));
  it("nessuna chiave", () => expect(p(`https://${REF_PROVA}.supabase.co`)).toMatch(/nessuna chiave/));
  it("chiave illeggibile", () =>
    expect(p(`https://${REF_PROVA}.supabase.co eyJhbGciOiJIUzI1NiJ9.@@@@.firma`)).toMatch(/nessuna chiave|decodificabile/));
  it("chiave che non dice a quale progetto appartiene", () =>
    expect(
      p(`https://${REF_PROVA}.supabase.co eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.firma`),
    ).toMatch(/non dichiara a quale progetto/));

  it("🔴 LA COPPIA DISALLINEATA — il difetto vero, misurato il 01/09", () =>
    // Indirizzo del progetto di prova, chiave della produzione: e' esattamente
    // com'era l'ambiente `preview` di Cloudflare, e rispondeva 401 a ogni
    // richiesta. Ciascuna meta' era giusta; nessuno guardava la coppia.
    expect(p(`https://${REF_PROVA}.supabase.co ${chiave(REF_PRODUZIONE)}`)).toMatch(/Coppia disallineata/));

  it("🔴 una chiave di SERVIZIO nel pacchetto ferma tutto", () =>
    // Il caso in cui pubblicare sarebbe peggio di qualunque 401: scavalca la
    // RLS per chiunque apra la pagina.
    expect(p(`https://${REF_PROVA}.supabase.co ${chiave(REF_PROVA, "service_role")}`)).toMatch(/service_role/));

  it("in produzione l'attesa cambia, il codice no", () => {
    expect(problemaDelPacchetto("dist", AMBIENTI.produzione.supabase, finto(`https://${REF_PRODUZIONE}.supabase.co ${chiave(REF_PRODUZIONE)}`))).toBeNull();
    expect(problemaDelPacchetto("dist", AMBIENTI.produzione.supabase, finto(`https://${REF_PROVA}.supabase.co ${chiave(REF_PROVA)}`))).toMatch(/atteso/);
  });
});

describe("il numero dell'account e' controllato e non ha ripieghi", () => {
  it("la forma e' 32 esadecimali minuscoli", () => {
    // ⚠️ Un numero inventato, non quello vero: una prova che deve tenere un
    //    valore FUORI dai documenti non e' il posto dove ricopiarlo.
    expect(FORMA_ACCOUNT.test("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(problemaDellAccount("0123456789abcdef0123456789abcdef")).toBeNull();
  });
  it("una lunghezza sbagliata e' respinta", () =>
    expect(problemaDellAccount("0123456789abcdef0123456789abcde")).toMatch(/32 caratteri/));
  it("le maiuscole sono respinte", () =>
    // Cloudflare lo scrive minuscolo: accettarle vorrebbe dire accettare una
    // copia ricopiata a mano che l'API poi rifiuta, con un rifiuto che parla
    // d'altro.
    expect(problemaDellAccount("0123456789ABCDEF0123456789ABCDEF")).toMatch(/32 caratteri/));
  it("vuoto lo dice, invece di andare avanti con niente", () =>
    expect(problemaDellAccount("")).toMatch(/Manca il numero/));
  it("🔴 `.env.example` non porta piu' il valore, quindi nessuno puo' ripiegarci", () => {
    const modello = readFileSync(".env.example", "utf8");
    expect(modello).toMatch(/^CLOUDFLARE_ACCOUNT_ID=$/m);
    // ⚠️ Non cerca IL numero: cerca QUALUNQUE numero di quella forma. Cosi'
    //    la prova non deve ricopiare il valore per difenderlo, e prende anche
    //    l'account di domani.
    expect(guida).not.toMatch(/\b[0-9a-f]{32}\b/);
  });
});

describe("il confronto fra due fotografie di Cloudflare", () => {
  it("dice quale campo e' cambiato, e quanti ne ha guardati", () => {
    const prima = { source: { config: { preview_deployment_setting: "all", production_deployments_enabled: true } } };
    const dopo = { source: { config: { preview_deployment_setting: "none", production_deployments_enabled: true } } };
    const d = differenze(prima, dopo);
    expect(d.confrontati).toBe(2);
    expect(d.cambiati).toHaveLength(1);
    expect(d.cambiati[0].campo).toBe("source.config.preview_deployment_setting");
  });
  it("un campo sparito e' un cambiamento, non un silenzio", () =>
    expect(differenze({ a: 1, b: 2 }, { a: 1 }).cambiati.map((c) => c.campo)).toEqual(["b"]));
});
