// =====================================================================
// LA PULIZIA DI CLOUDFLARE SI CHIEDE, NON CAPITA — 04/09/2026
// =====================================================================
//
// 🔴 PERCHE' ESISTE. Il 03/09 gli eventi `push` e `delete` sono stati tolti
//    da `pulizia-cloudflare.yml`: da allora nessuna cancellazione parte da
//    sola. Ma quella correzione viveva **solo nel file**, e un file si
//    modifica. Bastava rimettere due righe sotto `on:` — o aggiungere un
//    lavoro nuovo dimenticandogli la condizione — perche' un merge tornasse
//    a cancellare siti, e **nessun controllo se ne sarebbe accorto**.
//
// ⚠️ NON E' UNA PROVA DI CIO' CHE SUCCEDE: e' un controllo strutturale, come
//    `cancello-pubblicazione.test.js`. Nessuno qui ha visto una pulizia non
//    partire. Si prova che le righe che glielo impediscono **ci sono e non
//    sono state tolte**. La distanza fra le due cose e' la stessa che passa
//    fra «la funzione e' stata riscritta» e «la funzione risponde» (17/08).
//
// 🔴 E LA FORMA E' UNA PROPRIETA', NON UN ELENCO. Il controllo non nomina i
//    tre lavori di oggi: cerca `--conferma` **dovunque sia**, e pretende che
//    il lavoro che lo contiene sia chiuso dietro `workflow_dispatch`. Cosi'
//    copre anche il quarto lavoro che qualcuno scrivera' fra sei mesi — che
//    e' esattamente il caso in cui un elenco scritto a mano tace.
//    (Stessa ragione per cui in questo progetto le reti si costruiscono dal
//    catalogo invece che da una lista: un elenco scade il giorno dopo.)

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const PERCORSO = ".github/workflows/pulizia-cloudflare.yml";
const testo = readFileSync(PERCORSO, "utf8");

// ⚠️ `\r?\n` E NON `\n`: questo file si legge dal disco, e sul computer di
//    Alessio arriva coi fine riga di Windows. Con `\n` secco il taglio dei
//    lavori fallirebbe **solo la'** — e non per un difetto del workflow.
//    E' la lezione gia' pagata una volta in `cancello-pubblicazione.test.js`.
const RIGHE = testo.split(/\r?\n/);

/**
 * I lavori del workflow, ognuno col proprio testo.
 *
 * Taglia su un nome rientrato di DUE spazi dopo `jobs:` — che e' la forma in
 * cui GitHub li vuole. Non serve un parser YAML (e non c'e' fra le
 * dipendenze): qui interessa il testo di ciascun blocco, non la sua struttura.
 */
function lavori() {
  const dentro = RIGHE.indexOf("jobs:");
  expect(dentro, "il workflow deve avere una sezione `jobs:`").toBeGreaterThan(-1);

  const trovati = [];
  for (let i = dentro + 1; i < RIGHE.length; i++) {
    const inizio = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(RIGHE[i]);
    if (inizio) trovati.push({ nome: inizio[1], da: i, righe: [] });
    else if (trovati.length) trovati[trovati.length - 1].righe.push(RIGHE[i]);
  }
  return trovati.map((l) => ({ nome: l.nome, testo: l.righe.join("\n") }));
}

const TUTTI = lavori();
const cheCancellano = TUTTI.filter((l) => l.testo.includes("--conferma"));

// La sezione `on:`, cioe' l'elenco di cosa puo' far partire questo workflow.
const scatenanti = (() => {
  const da = RIGHE.indexOf("on:");
  expect(da, "il workflow deve avere una sezione `on:`").toBeGreaterThan(-1);
  const righe = [];
  for (let i = da + 1; i < RIGHE.length; i++) {
    if (/^\S/.test(RIGHE[i])) break; // finita: siamo tornati a inizio riga
    righe.push(RIGHE[i]);
  }
  return righe.join("\n");
})();

describe("nessun evento di GitHub puo' cancellare un sito", () => {
  it("i due eventi che cancellavano da soli non sono tornati", () => {
    // 🔴 `delete` faceva sparire le anteprime a ogni ramo cancellato; `push`
    //    rendeva **ogni merge** una cancellazione. Sono i due che il 03/09
    //    sono stati tolti, ed e' il difetto che questo file esiste per
    //    impedire che torni.
    expect(scatenanti).not.toMatch(/^\s*delete:/m);
    expect(scatenanti).not.toMatch(/^\s*push:/m);
  });

  it("si parte solo dal pulsante o da una proposta", () => {
    // ⚠️ Il verso stretto: invece di vietare due nomi, si pretende che gli
    //    unici presenti siano quelli permessi. Un evento nuovo — `schedule`,
    //    `release`, `issue_comment` — fa diventare rossa questa riga anche se
    //    a nessuno era venuto in mente di vietarlo.
    const eventi = [...scatenanti.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
    expect(eventi.sort()).toEqual(["pull_request", "workflow_dispatch"]);
  });

  it("🔴 e in particolare NON c'e' `schedule`: una pulizia a orario e' automatica", () => {
    // Il caso che sfuggirebbe a chi ragiona per «eventi di GitHub»: un cron
    // non e' un evento di nessuno, ed e' il modo piu' facile di rimettere in
    // piedi esattamente cio' che questo mandato ha tolto.
    expect(scatenanti).not.toMatch(/^\s*schedule:/m);
  });
});

describe("`--conferma` sta solo dietro il pulsante", () => {
  it("c'e' almeno un lavoro che cancella, altrimenti questo file non prova niente", () => {
    // ⚠️ LA TRAPPOLA DEL CASO VUOTO (17/08): se domani qualcuno rinominasse
    //    l'opzione, `cheCancellano` sarebbe vuoto e **tutti i controlli qui
    //    sotto passerebbero senza guardare niente**. Un verde che non ha
    //    esaminato nulla e' peggio di un rosso.
    expect(cheCancellano.length).toBeGreaterThan(0);
  });

  for (const lavoro of cheCancellano) {
    it(`«${lavoro.nome}» cancella, quindi parte solo da workflow_dispatch`, () => {
      expect(lavoro.testo).toMatch(/if:[^\n]*github\.event_name == 'workflow_dispatch'/);
    });

    it(`«${lavoro.nome}» sceglie una voce precisa del menu`, () => {
      // Un lavoro che cancella e non guarda `inputs.cosa` partirebbe a
      // QUALUNQUE scelta: chi chiede «guarda e basta» si ritroverebbe una
      // cancellazione. E' il difetto che il file stesso ha gia' corretto una
      // volta, quando «orfani» e «produzione» stavano in un lavoro solo.
      expect(lavoro.testo).toMatch(/inputs\.cosa == '[a-z]+'/);
    });
  }

  it("il lavoro che gira sulle proposte non cancella niente", () => {
    // Criterio 3 del mandato: la lettura su ogni proposta puo' restare,
    // purche' non tocchi niente.
    const suProposta = TUTTI.filter((l) => /github\.event_name == 'pull_request'/.test(l.testo));
    expect(suProposta.length).toBeGreaterThan(0);
    for (const l of suProposta) expect(l.testo).not.toContain("--conferma");
  });
});

describe("la scelta e' dell'operatore, non del menu", () => {
  const menu = (() => {
    const da = RIGHE.findIndex((r) => /^ {8}options:/.test(r));
    expect(da, "il campo «cosa» deve avere un elenco di opzioni").toBeGreaterThan(-1);
    const voci = [];
    for (let i = da + 1; i < RIGHE.length; i++) {
      const v = /^ {10}- ([a-z]+)/.exec(RIGHE[i]);
      if (!v) break;
      voci.push(v[1]);
    }
    return voci;
  })();

  it("🔴 la voce gia' selezionata NON cancella", () => {
    // 🔴 IL DIFETTO CHIUSO IL 04/09. Il default era `produzione`: chi apriva
    //    il menu e premeva Run senza leggere **cancellava le versioni del
    //    sito vero**. Una voce preselezionata che cancella non e' una scelta
    //    esplicita — e GitHub non permette «nessuna voce selezionata»,
    //    quindi l'unica strada e' che quella preselezionata sia innocua.
    const difetto = /^ {8}default: (\w+)/m.exec(testo);
    expect(difetto, "il campo «cosa» deve dichiarare un default").not.toBeNull();
    const preselezionata = difetto[1];

    const lavoroDelDefault = TUTTI.find((l) => l.testo.includes(`inputs.cosa == '${preselezionata}'`));
    expect(lavoroDelDefault, `nessun lavoro esegue la voce «${preselezionata}»`).toBeDefined();
    expect(lavoroDelDefault.testo).not.toContain("--conferma");
  });

  it("ogni voce del menu ha un lavoro che la esegue", () => {
    // Il prezzo di «una scelta = un lavoro»: una voce senza il suo lavoro
    // farebbe un giro con tutto saltato, cioe' un verde che non ha fatto
    // niente. Il workflow ha gia' un lavoro che lo rende rosso; questa prova
    // se ne accorge PRIMA, senza aspettare che qualcuno lo lanci.
    for (const voce of menu)
      expect(
        TUTTI.some((l) => l.testo.includes(`inputs.cosa == '${voce}'`)),
        `la voce «${voce}» del menu non ha nessun lavoro che la esegua`,
      ).toBe(true);
  });

  it("🔴 nessuna voce del menu fa scattare il lavoro «scelta non riconosciuta»", () => {
    // 🔴 IL BUCO CHE QUESTA RIGA CHIUDE, trovato aggiungendo «guarda» il
    //    04/09: quel lavoro elenca le scelte con `!=`, e una voce nuova che
    //    non gli venga aggiunta lo fa partire **insieme** al lavoro giusto —
    //    quindi il giro finisce ROSSO dopo aver fatto la cosa richiesta.
    // ⚠️ Il controllo qui sopra («ogni voce ha un lavoro») non se ne
    //    accorgerebbe: il lavoro c'era. I due elenchi vanno tenuti d'accordo
    //    in tutti e due i versi, e a mano non si riesce.
    const guardiano = TUTTI.find((l) => l.testo.includes("non ha nessun lavoro che la esegua"));
    expect(guardiano, "manca il lavoro che rende rossa una scelta senza esecutore").toBeDefined();

    const escluse = [...guardiano.testo.matchAll(/inputs\.cosa != '([a-z]+)'/g)].map((m) => m[1]);
    for (const voce of menu)
      expect(escluse, `la voce «${voce}» non e' esclusa: il giro finirebbe rosso`).toContain(voce);
  });

  it("e nessun lavoro aspetta una voce che nel menu non c'e'", () => {
    // Il verso opposto, che e' quello silenzioso: un lavoro agganciato a una
    // scelta non piu' offerta non parte mai, e nessuno se ne accorge.
    for (const l of TUTTI)
      for (const [, voce] of l.testo.matchAll(/inputs\.cosa == '([a-z]+)'/g))
        expect(menu, `«${l.nome}» aspetta la voce «${voce}», che non e' nel menu`).toContain(voce);
  });
});
