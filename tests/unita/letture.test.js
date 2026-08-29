import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NON_LETTO, leggi, nonLetto, statoLettura } from "../../src/lib/calcoli/letture";

// QUELLO CHE NON TROVA QUELLO CHE CERCA DEVE DIRLO — 20/08/2026.
//
// Due prove diverse, e servono tutte e due:
//   · la REGOLA — «non lo so» e «non c'è niente» non si confondono più;
//   · la RETE — nessuna schermata la aggira scrivendo un catch che ingoia.
//
// ⚠️ IL LIMITE, DICHIARATO: in questo progetto le prove non hanno un
// ambiente DOM, quindi **nessuna prova automatica può guardare una
// schermata**. Quello che si prova qui è *quale delle tre cose la schermata
// dirà* e *che nessun punto sia rimasto muto*. Che la riga si veda davvero
// lo può dire solo una mano — sta nel collaudo.

describe("«non lo so» non è «non c'è niente»", () => {
  it("le tre risposte sono TRE, e non si confondono", () => {
    // 🔴 È il cuore: prima queste due erano lo stesso `[]`.
    expect(statoLettura(NON_LETTO)).toBe("non_letto");
    expect(statoLettura([])).toBe("vuoto");
    expect(statoLettura([{ id: 1 }])).toBe("pieno");
  });

  it("`null` resta «vuoto», e non diventa «non lo so»", () => {
    // ⚠️ `null` è già un valore legittimo in mezzo gestionale (una caparra
    // che non c'è, un prezzo non deciso). Confonderlo con «non l'ho letto»
    // riaprirebbe il difetto da un'altra porta.
    expect(statoLettura(null)).toBe("vuoto");
    expect(statoLettura(undefined)).toBe("vuoto");
    expect(nonLetto(null)).toBe(false);
    expect(nonLetto([])).toBe(false);
    expect(nonLetto(0)).toBe(false);
  });

  it("un oggetto vuoto è «vuoto», uno pieno è «pieno», lo zero è un numero", () => {
    expect(statoLettura({})).toBe("vuoto");
    expect(statoLettura({ quante: 0 })).toBe("pieno");
    // ⚠️ Zero uscite future è un'informazione vera, non un vuoto: la
    // schermata deve poterla mostrare.
    expect(statoLettura(0)).toBe("pieno");
  });

  it("`leggi` conserva il risultato quando la lettura riesce", async () => {
    await expect(leggi(Promise.resolve([1, 2]))).resolves.toEqual([1, 2]);
    await expect(leggi(Promise.resolve(null))).resolves.toBeNull();
  });

  it("`leggi` MARCA invece di ingoiare quando la lettura fallisce", async () => {
    const r = await leggi(Promise.reject(new Error("rete giù")));
    expect(nonLetto(r), "la lettura fallita è stata ingoiata").toBe(true);
    expect(statoLettura(r)).toBe("non_letto");
  });

  it("e non fa cadere le letture accanto: è la ragione per cui i catch esistevano", async () => {
    const [a, b, c] = await Promise.all([
      leggi(Promise.resolve("primo")),
      leggi(Promise.reject(new Error("guasto"))),
      leggi(Promise.resolve("terzo")),
    ]);
    expect(a).toBe("primo");
    expect(nonLetto(b)).toBe(true);
    expect(c).toBe("terzo");
  });
});

// ---------------------------------------------------------------------
// LA RETE
// ---------------------------------------------------------------------
// 🔴 Senza questa, fra un mese la regola ricompare: la correzione punto per
// punto è «trovarli tutti», e il prossimo che scrive una lettura nuova
// ricomincia da capo. Qui un catch nuovo diventa rosso da solo.
//
// ⚠️ È un controllo di FORMA, non di comportamento — come quello sulle
// migrazioni senza portiere. Non sa se la schermata mostra davvero la riga:
// sa che quel punto non è stato lasciato muto. Il caso che resta possibile è
// marcare `NON_LETTO` e poi non guardarlo mai; quello lo prende una mano.
const RADICE = "src";
const MARCATORE = "SILENZIO MOTIVATO";
// Il modulo che definisce la regola parla di sé stesso nei commenti.
const ESENTI = ["src/lib/calcoli/letture.js"];

function tuttiIFile(dir) {
  const fuori = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fuori.push(...tuttiIFile(p));
    else if (/\.(js|jsx)$/.test(nome)) fuori.push(p.replace(/\\/g, "/"));
  }
  return fuori;
}

describe("nessuna lettura resta muta", () => {
  it("ogni `catch` che ingoia o marca «non letto» o dichiara perché tace", () => {
    const colpevoli = [];
    for (const file of tuttiIFile(RADICE)) {
      if (ESENTI.includes(file)) continue;
      const righe = readFileSync(file, "utf8").split("\n");
      righe.forEach((riga, i) => {
        if (!/\.catch\(\s*\(\s*\)\s*=>/.test(riga)) return;
        // Il corpo del catch può stare sulla riga o poco sotto.
        const corpo = righe.slice(i, i + 6).join("\n");
        if (corpo.includes("NON_LETTO")) return;
        // Oppure il silenzio è dichiarato, e la ragione sta lì sopra.
        const sopra = righe.slice(Math.max(0, i - 14), i + 6).join("\n");
        if (sopra.includes(MARCATORE)) return;
        colpevoli.push(`${file}:${i + 1}`);
      });
    }
    // ⚠️ Il messaggio dice QUALI, non solo quanti: chi legge una prova rossa
    // deve poter decidere, non ricominciare la misura da capo.
    expect(
      colpevoli,
      `Queste letture ingoiano un guasto senza dirlo e senza dichiarare perché.\n` +
        `O si marca il risultato con NON_LETTO (src/lib/calcoli/letture.js) e la\n` +
        `schermata lo mostra, oppure si scrive «${MARCATORE}» col motivo:\n  ` +
        colpevoli.join("\n  ")
    ).toEqual([]);
  });

  it("e i silenzi dichiarati sono quelli che ci aspettiamo, non uno di più", () => {
    // ⚠️ Un elenco che cresce in silenzio non è più un controllo: la stessa
    // forma delle funzioni aperte ad anon. Chi ne aggiunge uno lo dichiara
    // QUI, con la sua ragione nel codice.
    const attesi = [
      // ⚠️ AGGIUNTO IL 22/08 con la sonda che distingue «manca la
      // connessione» da «questo servizio non c'è». I due silenzi qui dentro
      // stanno **dentro un guasto già in corso**, e sono l'unico posto del
      // progetto dove tacere è la risposta più informativa delle altre:
      //   · la sonda che fallisce lascia `null` — «non lo so» — e la frase
      //     resta quella prudente invece di affermare una causa precisa che
      //     nessuno ha verificato;
      //   · la risposta senza corpo JSON è **il caso previsto**: è ciò che
      //     succede quando la richiesta non parte, e chi decide la frase è
      //     `fraseDelGuasto`, che ha già tutto quello che serve.
      "src/lib/chiamaFunzione.js",
      // La giornata proposta: senza l'ora di fine serata la schermata dice
      // di MENO (non dichiara la serata), invece di affermarla su un'ora
      // che nessuno ha detto.
      "src/lib/giornataOperativa.js",
      // Il modulo pubblico: il destinatario è un ospite, e senza le opzioni
      // torna all'orario libero — che è uno stato dichiarato della pagina,
      // non una rassicurazione.
      // ⚠️ DAL 29/08 I SILENZI QUI DENTRO SONO DUE, e il secondo va detto o
      // questa nota diventa falsa: l'elenco dei giorni chiusi, che serve a
      // far partire il campo data dal primo giorno in cui si mangia qui. Se
      // non risponde, il campo parte da oggi — cioè come si comportava fino
      // al 29/08 — e chi sceglie un giorno chiuso viene fermato lo stesso,
      // dal database, che è il posto dove quel rifiuto vive davvero.
      "src/pages/public/PublicReservationForm.jsx",
      // ⚠️ AGGIUNTO IL 20/08 col blocco C, e questa riga mancava: la copia dei
      // numeri negli appunti può essere negata dal browser, e non è un guasto
      // — **i numeri sono già a schermo, dentro una casella selezionabile a
      // mano**. Non si perde nessuna informazione tacendo, ed è il
      // discriminante di tutto il modulo: qui il vuoto NON è ambiguo, perché
      // non c'è nessun vuoto — c'è l'elenco, e c'è pure un messaggio che dice
      // di selezionarlo a mano.
      "src/pages/calendario/Comunicazioni.jsx",
      // ⚠️ AGGIUNTO IL 22/08 con lo scontrino automatico. Alla chiusura del
      // conto si legge la serata per datare il documento fiscale; se quella
      // lettura fallisce, `setDocumentoFiscale` ripiega su `oggiLocale()` —
      // che nel caso normale (conto chiuso nella sua serata) è **lo stesso
      // giorno**.
      // 🔴 Non si dichiara a schermo per una ragione precisa: lì davanti c'è
      // un cliente che aspetta il resto, e fermare la chiusura per la data
      // di un documento sarebbe la sala bloccata — cioè proprio quello che
      // tutto questo blocco evita. Se uno scarto nasce, non resta invisibile:
      // si vede in Cassa fra i conti fiscalizzati in ritardo.
      "src/pages/comande/CloseOrderModal.jsx",
      // ⚠️ AGGIUNTO IL 23/08 col pulsante che smette di mentire. Qui non
      // manca un dato: manca una **precisazione su un numero che c'è già**.
      // La schermata chiede alla funzione online quanti prodotti compilerà
      // in un giro; se quella non risponde, il pulsante mostra il totale
      // delle schede incomplete — cioè esattamente quello che mostrava
      // prima. Si perde la frase «ne restano N per il prossimo giro», non
      // un'informazione.
      // 🔴 E il discriminante è che **la lettura dell'elenco non ha nessun
      // catch**: se fallisce quella, si vede.
      "src/pages/ricettario/SchedeProdotti.jsx",
      // ⚠️ AGGIUNTO IL 23/08 col cliente pagante del tavolo. Qui non manca
      // un dato: mancano i **suggerimenti** mentre si scrive un nome. Se
      // l'anagrafica non risponde, i due campi restano scrivibili e
      // «Registra» funziona lo stesso — e la difesa vera contro i doppioni
      // non e' questa lettura ma il database, che riconosce da se' un
      // numero gia' visto.
      // 🔴 Il discriminante e' il costo del rumore: una striscia rossa
      // sopra la sala mentre un cameriere sta scrivendo un nome vale meno
      // di quello che toglie. Se invece fallisse la SCRITTURA — assegnare
      // il cliente — l'errore si vede, perche' li' un catch non c'e'.
      "src/components/ClientePagante.jsx",
      // ⚠️ AGGIUNTO IL 29/08 con l'avviso «questo nome ce l'ha già qualcuno».
      // Qui non manca un dato: manca un **avvertimento su un nome che si
      // sta scrivendo**. Se la ricerca non risponde, la scheda si comporta
      // come si comportava fino al 29/08 — si salva, e nasce un prodotto.
      // 🔴 E il discriminante è il verso in cui si sbaglia: quel che si
      // perde è un avviso, non una rassicurazione. Non compare da nessuna
      // parte «il nome è libero»: chi non riceve niente non sa niente, che
      // è la stessa cosa che sapeva prima.
      // ⚠️ La lettura della SCHEDA invece non ha nessun catch: se fallisce
      // quella, si vede.
      "src/pages/ricettario/IngredienteForm.jsx",
      // ⚠️ AGGIUNTO IL 29/08 con le cose da fare in cucina. Qui non manca
      // un dato: manca un'**AVVERTENZA** — quali ingredienti non bastano
      // per la preparazione che si sta per registrare. E quell'avvertenza
      // **non blocca niente**, per decisione di Alessio: si comincia a
      // cucinare e si compra quello che manca.
      // 🔴 Il discriminante è il verso in cui si sbaglia: quello che si
      // perde è un avviso, non una rassicurazione. Non compare nessun
      // «c'è tutto» — chi non riceve niente è nella stessa condizione in
      // cui era fino al 29/08, e se un ingrediente manca davvero se ne
      // accorge il magazzino, che scarica quello che c'è e dichiara il
      // resto.
      // ⚠️ Le altre due letture di questa schermata — le preparazioni e le
      // cose da fare — NON hanno catch: se falliscono si vede, e la
      // schermata dice «non lo so» invece di disegnarsi vuota.
      "src/pages/magazzino/Produzioni.jsx",
    ].sort();

    const trovati = tuttiIFile(RADICE)
      .filter((f) => !ESENTI.includes(f) && readFileSync(f, "utf8").includes(MARCATORE))
      .sort();
    expect(trovati).toEqual(attesi);
  });
});
