import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
import { orfaneAttese } from "./orfane";

const titolare = await clientAutenticato(credenziali().titolare);

// 🔴 COSTRUITO E SENZA UNA PORTA — 31/08/2026
//
// PERCHE' ESISTE, e non e' una precauzione teorica: e' una famiglia che
// questo progetto ha incontrato **quattro volte in due giorni**.
//   · 13/08 — la soglia di magazzino esisteva e nessuna schermata la
//     scriveva: la lista della spesa non poteva riempirsi, e sembrava che
//     funzionasse;
//   · 31/08 notte — `speso_dalla_tasca()` esisteva, era chiusa col portiere
//     giusto, ed **era chiamata da nessuno**: la Prima nota mostrava un saldo
//     negativo, cioe' proprio la cosa che quella funzione doveva evitare;
//   · 31/08 notte — `mondi_del_magazzino()` e la migrazione dei sette mondi:
//     provate, applicate, e **il Magazzino restava a due mondi**;
//   · 31/08 notte — `carta_da_ristampare()` e `segna_carta_stampata()`:
//     costruite e dichiarate «senza schermata» in un riepilogo, cioe' un
//     debito scritto invece che un difetto trovato.
//     ✅ PAGATO IL 16/09/2026: la schermata c'e' — Editor Menu → Bevande e
//     vini, «La carta stampata» — e le due righe sono uscite dall'elenco
//     qui sotto. Il fatto del 31/08 resta scritto, perche' e' la storia di
//     come sono nate; quello che non resta e' la loro riga fra i debiti
//     aperti, che racconterebbe una cosa non piu' vera.
//     ⚠️ E A DIRLO E' STATA QUESTA RETE, non una rilettura: aggiunta la
//     schermata, la prova e' diventata rossa da sola sul controllo della
//     proposta n. 89 — «toglile da ORFANE_NOTE, o l'elenco racconta un
//     debito che e' gia' stato pagato». Ha funzionato nel verso difficile,
//     quello che nessuno va a guardare.
//
// 🔴 E LA COSA CHE CONTA: le prime tre le ha trovate **Alessio con gli
// occhi**, non io rileggendo. Tre volte non e' distrazione — e' che il
// metodo di verifica non aveva un modo di accorgersene. *Questo file e'
// quel modo.*
//
// ---------------------------------------------------------------------
// COME FUNZIONA
// ---------------------------------------------------------------------
// Una funzione del database e' **raggiungibile** se almeno una di queste e'
// vera:
//   1. la chiama un'altra funzione del database (e' un pezzo interno);
//   2. la usa un trigger;
//   3. il suo nome compare in `src/` — cioe' una schermata ci arriva.
// Quelle che non soddisfano nessuna delle tre sono **orfane**: esistono,
// costano manutenzione, e nessuno le puo' usare.
//
// ⚠️ NON TUTTE LE ORFANE SONO UN DIFETTO, e per questo l'elenco di partenza
// e' **congelato** invece che preteso vuoto: ce ne sono che vivono nelle
// funzioni online, nelle reti di prova o negli script, e sono legittime.
// Come per i vincoli muti (25/08): si congela quello che c'e' e si sorveglia
// che **non cresca**. Un controllo che grida su 26 righe legittime verrebbe
// spento al secondo giorno.
//
// ⚠️ IL LIMITE, DICHIARATO. Questa rete guarda se il **nome** compare in
// `src/`, non se una schermata la chiami davvero: un wrapper in
// `src/lib/api/` che nessuna pagina importa la fa risultare raggiungibile.
// E' un **pavimento**, non un censimento — e il pavimento prende comunque il
// caso che si e' presentato quattro volte, che e' *la funzione che non
// compare da nessuna parte*.

const CARTELLE = [
  ["src", /\.(jsx?|ts)$/],
  ["supabase/functions", /\.ts$/],
  ["tests", /\.js$/],
  ["scripts", /\.mjs$/],
];

function testoDi(dir, filtro) {
  let out = "";
  const cammina = (d) => {
    for (const e of readdirSync(d)) {
      const f = path.join(d, e);
      if (statSync(f).isDirectory()) cammina(f);
      else if (filtro.test(e)) out += readFileSync(f, "utf8") + "\n";
    }
  };
  try { cammina(dir); } catch { /* una cartella che non c'e' non e' un difetto */ }
  return out;
}

// 🔴 UN NOME DENTRO UN COMMENTO NON E' UNA PORTA — 22/09/2026, difetto
//    misurato perche' questa rete e' diventata rossa su `numeri_sospetti`.
//    In R12 quella funzione e' nominata in UN SOLO posto di `src/`: dentro
//    il riquadro che spiega perche' un campo e' sparito dalla scheda del
//    prodotto. Nessuna schermata la chiama — e la rete chiedeva di toglierla
//    dall'elenco delle orfane, cioe' di **scrivere una cosa falsa**.
//
// ⚠️ E' la famiglia del 27/08, gia' pagata due volte in questo progetto: un
//    setaccio che cerca una forma nel testo trova anche i commenti che
//    parlano di quella forma. La cura non e' togliere il commento — la
//    spiegazione serve, ed e' il posto giusto: e' far guardare al setaccio
//    il CODICE.
//
// ⚠️ SI TOGLIE POCO APPOSTA: i blocchi di commento (quindi anche quelli del
//    JSX) e le righe che COMINCIANO con due sbarre o con un asterisco. Due
//    sbarre in mezzo a una riga non si toccano, perche' li' dentro ci sono
//    gli indirizzi web e tagliarli porterebbe via il codice che segue —
//    cioe' inventerebbe orfane che non esistono. *Un setaccio troppo largo
//    sbaglia nel verso opposto, e con la stessa faccia.*
const senzaCommenti = (testo) =>
  testo
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .filter((r) => !/^\s*(\/\/|\*)/.test(r))
    .join("\n");

const nomina = (nome, testo) => new RegExp(`\\b${nome}\\b`).test(testo);

// 🔴 L'ELENCO NON VIVE PIU' QUI, E NON E' PIU' UNO SOLO — 17/09/2026,
//    difetto misurato sul controllo della proposta #94.
//
//    Rispondeva a **due domande diverse** con una risposta sola: cosa c'e'
//    nel database ADESSO, e cosa ci sara' dopo la prossima migrazione. Fra i
//    due momenti non possono essere d'accordo, per costruzione — iscrivendo
//    subito una funzione che la migrazione non ha ancora portato, la rete
//    grida «questa ha una porta adesso, toglila»; non iscrivendola, grida il
//    giorno dopo l'applicazione.
//
// ⚠️ Adesso sono due elenchi in `tests/app/orfane.js` — quelle che ci sono
//    sempre e quelle che entrano con una migrazione — e quale valga lo
//    decide il REGISTRO DELLE MIGRAZIONI di questo database, non una data
//    scritta a mano. La decisione e' pura e si prova senza database:
//    `tests/unita/orfane-attese.test.js`.
//
// ⚠️ E QUI NON SE NE TIENE UNA COPIA: due elenchi che dicono la stessa cosa
//    prima o poi divergono, e a vincere sarebbe quello scritto piu' in
//    basso, senza che nessuno lo sappia.

describe("nessuna funzione del database resta senza una porta", () => {
  it("le funzioni orfane sono quelle congelate, e non una di più", async () => {
    // Chi NON e' chiamato da un'altra funzione e non e' usato da un trigger.
    const { data, error } = await titolare.rpc("funzioni_senza_chiamante");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const codice = Object.fromEntries(
      CARTELLE.map(([d, f]) => [d, senzaCommenti(testoDi(d, f))]),
    );

    // ⚠️ TARATURA su casi di risposta nota (regola del 26/08): senza, un
    //    setaccio rotto direbbe «zero orfane» e sembrerebbe una conferma.
    //    `close_order_paid` la chiama la sala, `set_updated_at` e' un
    //    trigger interno che in `src/` non compare.
    expect(nomina("close_order_paid", codice.src), "il setaccio non trova ciò che c'è").toBe(true);
    expect(nomina("questa_funzione_non_esiste_davvero", codice.src)).toBe(false);
    // 🔴 IL TERZO CASO DI RISPOSTA NOTA, ed e' quello per cui la riga sopra
    //    esiste: un nome che compare SOLO dentro un commento non deve
    //    risultare trovato. Senza, il setaccio tornerebbe a contare le
    //    spiegazioni come porte, e nessuno se ne accorgerebbe finche' non
    //    scrive «toglila dall'elenco» su una funzione che porta non ne ha.
    expect(
      nomina("solo_dentro_un_commento", senzaCommenti("// parla di solo_dentro_un_commento")),
      "il setaccio legge ancora i commenti",
    ).toBe(false);
    // ⚠️ E il verso opposto: una chiamata vera con un commento in coda resta
    //    una chiamata. Un setaccio che togliesse anche quella inventerebbe
    //    orfane, che è l'errore speculare e fa lo stesso danno.
    expect(nomina("vera_chiamata", senzaCommenti("vera_chiamata(1); // e poi il commento"))).toBe(
      true,
    );

    const orfane = data
      .map((r) => r.nome)
      .filter((n) => !nomina(n, codice.src))
      .sort();

    // 🔴 QUALE ELENCO VALE LO DECIDE QUESTO DATABASE, non una data scritta a
    //    mano: si chiede quali migrazioni ha applicato. Una funzione che
    //    arriva con la 20260917000001 si aspetta SOLO dove quella migrazione
    //    e' gia' entrata.
    // ⚠️ Si legge SOLTANTO `version`: nient'altro di quel registro serve a
    //    rispondere a questa domanda, e chiedere di piu' vorrebbe dire
    //    portarsi dietro dati che non c'entrano.
    const { data: registro, error: erroreRegistro } = await titolare
      .from("applied_migrations")
      .select("version");

    // ⚠️ DUE MODI DI FALLIRE, E SI SOMIGLIANO. Il primo e' rumoroso.
    expect(
      erroreRegistro,
      "Non ho potuto leggere il registro delle migrazioni, quindi non so in " +
        "quale dei due momenti si trova questo database. NON tiro a indovinare."
    ).toBeNull();

    // 🔴 E IL SECONDO E' MUTO, ed e' quello pericoloso: quando una lettura non
    //    e' permessa, PostgREST non risponde con un errore — risponde con
    //    ZERO RIGHE. Zero righe si leggerebbe «nessuna migrazione applicata»,
    //    cioe' «non aspettarti la funzione nuova»: plausibile e falso. In un
    //    database vero quel registro ne ha centinaia, quindi zero non e' un
    //    dato — e' il segno che non si e' potuto guardare.
    //    *Vuoto non e' zero*, ed e' la regola del 19/08.
    expect(
      (registro ?? []).length,
      "Il registro delle migrazioni e' tornato VUOTO. In un database vero non " +
        "puo' esserlo: vuol dire che non si e' potuto leggere. Mi fermo invece " +
        "di dedurre che nessuna migrazione sia stata applicata."
    ).toBeGreaterThan(0);

    const ATTESE = orfaneAttese(registro.map((r) => r.version));

    const nuove = orfane.filter((n) => !(n in ATTESE));
    expect(
      nuove,
      "Queste funzioni esistono nel database e NESSUNA schermata ci arriva.\n" +
        "O si costruisce la porta, oppure si aggiunge la riga in\n" +
        "`tests/app/orfane.js` dicendo da dove passa (una funzione online, una\n" +
        "rete, un lavoro pianificato) — e se e' un debito, si scrive DEBITO e\n" +
        "perché. Se arriva con una migrazione non ancora applicata, va fra le\n" +
        "PIANIFICATE, con la sua versione."
    ).toEqual([]);

    // ⚠️ E ALLO SPECCHIO: una riga che resta nell'elenco dopo che la porta e'
    //    stata costruita fa credere che il debito ci sia ancora. E' lo stesso
    //    difetto dell'elenco delle schermate larghe, che il 31/08 e' diventato
    //    rosso proprio per questo.
    const sistemate = Object.keys(ATTESE).filter((n) => !orfane.includes(n));
    expect(
      sistemate,
      "Queste hanno una porta adesso: toglile da `tests/app/orfane.js`, o\n" +
        "l'elenco racconta un debito che è già stato pagato.\n" +
        "⚠️ Se invece la funzione non c'è ANCORA perché la sua migrazione non\n" +
        "è stata applicata qui, non va tolta: va spostata fra le PIANIFICATE,\n" +
        "con la versione che la porta."
    ).toEqual([]);
  });
});
