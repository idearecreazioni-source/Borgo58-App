import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INDIRIZZI_PREDEFINITI,
  MARCA_INDIRIZZI,
  indirizziDiAccesso,
  marcatore,
  problemaDegliIndirizzi,
} from "../../scripts/indirizzi-accesso.mjs";

// 🔴 GLI INDIRIZZI DI ACCESSO ESCONO DAL CODICE — 02/09/2026.
//
// Il fatto: il 01/09 Alessio non è potuto entrare nell'anteprima, perché la
// schermata di accesso prova **solo** i due indirizzi scritti dentro
// `AuthContext.jsx`. Il perché e il disegno stanno in
// `docs/mandati/20260902_gli_indirizzi_escono_dal_codice.md` e in cima a
// `scripts/indirizzi-accesso.mjs`.
//
// ⚠️ Queste prove sono scritte **al contrario** dove conta: non basta che il
// modulo accetti i casi buoni — deve **rifiutare** quelli cattivi e il
// controllo del pacchetto deve **gridare**, altrimenti tacerebbe anche un
// controllo che non guarda niente.

describe("gli indirizzi decisi dall'ambiente", () => {
  it("senza nessuna variabile dà esattamente i due indirizzi di oggi", () => {
    // 🔴 QUESTA È LA PROVA CHE PROTEGGE LA PRODUZIONE. Finché nessuno imposta
    //    niente, il comportamento di `borgo58.it` non cambia di una virgola.
    //    Diventa rossa il giorno che qualcuno tocca i predefiniti — ed è
    //    voluto: quel giorno Alessio potrebbe restare chiuso fuori.
    expect(indirizziDiAccesso({})).toEqual({
      titolare: "alessio@borgo58.app",
      staff: "staff@borgo58.app",
    });
  });

  it("i predefiniti esportati sono quelli, e non un'altra coppia", () => {
    expect(INDIRIZZI_PREDEFINITI).toEqual({
      titolare: "alessio@borgo58.app",
      staff: "staff@borgo58.app",
    });
  });

  it("una variabile vuota o a soli spazi vale «non impostata», non stringa vuota", () => {
    // ⚠️ È il caso che il doppio punto interrogativo da solo sbaglierebbe: la
    //    stringa vuota non è nullish, quindi passerebbe — e produrrebbe un
    //    accesso con l'indirizzo vuoto, che fallisce sempre **senza che
    //    nessun errore dica perché**.
    for (const vuoto of ["", "   ", "\t", "\n  "]) {
      expect(indirizziDiAccesso({ VITE_EMAIL_TITOLARE: vuoto }).titolare).toBe(
        INDIRIZZI_PREDEFINITI.titolare,
      );
      expect(indirizziDiAccesso({ VITE_EMAIL_STAFF: vuoto }).staff).toBe(
        INDIRIZZI_PREDEFINITI.staff,
      );
    }
  });

  it("una variabile assente vale «non impostata»", () => {
    expect(indirizziDiAccesso({ VITE_EMAIL_TITOLARE: undefined })).toEqual(
      INDIRIZZI_PREDEFINITI,
    );
    expect(indirizziDiAccesso({ VITE_EMAIL_TITOLARE: null })).toEqual(
      INDIRIZZI_PREDEFINITI,
    );
  });

  it("un indirizzo valido sostituisce SOLO il suo, e l'altro resta il predefinito", () => {
    // ⚠️ Discrimina: se sostituisse tutti e due, o nessuno, questa passerebbe
    //    solo per metà.
    expect(indirizziDiAccesso({ VITE_EMAIL_TITOLARE: "capo@prova.it" })).toEqual({
      titolare: "capo@prova.it",
      staff: "staff@borgo58.app",
    });
    expect(indirizziDiAccesso({ VITE_EMAIL_STAFF: "sala@prova.it" })).toEqual({
      titolare: "alessio@borgo58.app",
      staff: "sala@prova.it",
    });
  });

  it("gli spazi attorno a un indirizzo valido si tolgono", () => {
    expect(
      indirizziDiAccesso({ VITE_EMAIL_TITOLARE: "  capo@prova.it  " }).titolare,
    ).toBe("capo@prova.it");
  });
});

describe("cosa viene RIFIUTATO, e si ferma a tempo di costruzione", () => {
  // ⚠️ I caratteri riservati sono quelli che spezzerebbero il marcatore o
  //    che nessun sistema vero usa. L'elenco è più stretto della RFC apposta:
  //    il prezzo è un rifiuto **visibile**, il prezzo opposto è un marcatore
  //    rotto che non vede nessuno.
  const STORTI = [
    "a|b@x.it",
    "a:b@x.it",
    "a,b@x.it",
    "a b@x.it",
    'a"b@x.it',
    "a\\b@x.it",
    "senza-chiocciola.it",
    "@x.it",
    "a@",
    "a@x",
  ];

  for (const storto of STORTI) {
    it(`rifiuta «${storto}» invece di lasciarlo passare`, () => {
      expect(() => indirizziDiAccesso({ VITE_EMAIL_TITOLARE: storto })).toThrow(
        /VITE_EMAIL_TITOLARE/,
      );
      expect(() => indirizziDiAccesso({ VITE_EMAIL_STAFF: storto })).toThrow(
        /VITE_EMAIL_STAFF/,
      );
    });
  }

  it("il messaggio dice QUALE variabile e QUALE valore, non solo «errore»", () => {
    // Un rifiuto che non nomina la casella da correggere manda a cercare.
    expect(() => indirizziDiAccesso({ VITE_EMAIL_STAFF: "a|b@x.it" })).toThrow(
      /VITE_EMAIL_STAFF.*a\|b@x\.it/,
    );
  });

  it("due indirizzi uguali sono un rifiuto, non una configurazione strana", () => {
    // 🔴 Uguali = il ruolo diventa indecidibile: la schermata prova il primo,
    //    riesce, e chi entra come sala si ritrova **titolare**. Non darebbe
    //    nessun errore: darebbe i permessi sbagliati.
    expect(() =>
      indirizziDiAccesso({
        VITE_EMAIL_TITOLARE: "uno@x.it",
        VITE_EMAIL_STAFF: "uno@x.it",
      }),
    ).toThrow(/non possono coincidere/);
  });

  it("e vale anche quando uno dei due è il predefinito", () => {
    // ⚠️ Il caso che si sbaglia più facilmente: si imposta solo il titolare,
    //    scrivendoci per errore l'indirizzo dello staff.
    expect(() =>
      indirizziDiAccesso({ VITE_EMAIL_TITOLARE: "staff@borgo58.app" }),
    ).toThrow(/non possono coincidere/);
  });
});

describe("il marcatore", () => {
  it("mette dentro la marca e i due indirizzi codificati", () => {
    expect(marcatore({ titolare: "a@x.it", staff: "b@y.it" })).toBe(
      `${MARCA_INDIRIZZI},a%40x.it,b%40y.it`,
    );
  });

  it("regge anche su ciò che la validazione respingerebbe", () => {
    // 🔴 SONO DUE DIFESE INDIPENDENTI E SERVONO ENTRAMBE. La validazione
    //    impedisce il dato cattivo; la codifica impedisce che **un dato
    //    qualunque** rompa la struttura. Senza questa seconda, la tenuta del
    //    marcatore dipenderebbe da una regexp che qualcuno domani potrebbe
    //    allargare per far entrare un indirizzo legittimo — rompendola senza
    //    accorgersene.
    for (const brutto of ['a,b@x.it', 'a|b@x.it', 'a b@x.it', 'à"b@x.it']) {
      const riga = marcatore({ titolare: brutto, staff: "b@y.it" });
      const pezzi = riga.split(",");
      expect(pezzi).toHaveLength(3); // la virgola non si è propagata
      expect(decodeURIComponent(pezzi[1])).toBe(brutto); // e torna identico
    }
  });

  it("nessun indirizzo può produrre una virgola nel proprio pezzo", () => {
    // La proprietà su cui poggia il separatore, misurata invece che assunta.
    for (let codice = 32; codice < 127; codice++) {
      const carattere = String.fromCharCode(codice);
      expect(encodeURIComponent(`a${carattere}b@x.it`)).not.toContain(",");
    }
  });
});

describe("il controllo del pacchetto compilato", () => {
  const ATTESI = { titolare: "alessio@borgo58.app", staff: "staff@borgo58.app" };
  const finto = (testo) => () => testo;

  it("tace quando il pacchetto contiene esattamente gli indirizzi attesi", () => {
    const dentro = `const x="${marcatore(ATTESI)}";function q(){}`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(dentro))).toBeNull();
  });

  it("tace anche sugli indirizzi di un'anteprima, che sono altri", () => {
    const anteprima = { titolare: "capo@prova.it", staff: "sala@prova.it" };
    const dentro = `x="${marcatore(anteprima)}"`;
    expect(problemaDegliIndirizzi("dist", anteprima, finto(dentro))).toBeNull();
  });

  it("🔴 grida se il marcatore non c'è", () => {
    // Vuol dire: o non è stato compilato da questa configurazione, o
    // qualcuno ha tolto l'iniezione. In tutti e due i casi il pacchetto non
    // è quello che si crede.
    expect(problemaDegliIndirizzi("dist", ATTESI, finto("nulla di utile"))).toMatch(
      /non c'e' il marcatore/,
    );
  });

  it("🔴 grida se non c'è niente di compilato, invece di approvare il vuoto", () => {
    // ⚠️ È la regola del 19/08 — *una risposta più corta che ha l'aria di
    //    essere intera*. Un controllo che tace sul nulla approverebbe una
    //    pubblicazione senza aver guardato niente.
    expect(problemaDegliIndirizzi("dist", ATTESI, () => null)).toMatch(
      /niente di compilato/,
    );
  });

  it("🔴 grida se il titolare nel pacchetto è un altro", () => {
    const altro = `x="${marcatore({ titolare: "estraneo@x.it", staff: ATTESI.staff })}"`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(altro))).toMatch(
      /Titolare nel pacchetto «estraneo@x\.it»/,
    );
  });

  it("🔴 grida se lo staff nel pacchetto è un altro", () => {
    const altro = `x="${marcatore({ titolare: ATTESI.titolare, staff: "estraneo@x.it" })}"`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(altro))).toMatch(
      /Staff nel pacchetto «estraneo@x\.it»/,
    );
  });

  it("🔴 grida se nel pacchetto ci sono due marcatori diversi", () => {
    // Non si saprebbe quale vale: approvare il primo trovato vorrebbe dire
    // scegliere a caso quale verità raccontare.
    const due = `${marcatore(ATTESI)} ... ${marcatore({ titolare: "b@x.it", staff: "c@x.it" })}`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(due))).toMatch(
      /2 marcatori diversi/,
    );
  });

  it("lo stesso marcatore ripetuto NON è un problema", () => {
    // ⚠️ Il caso che distingue «due valori diversi» da «lo stesso valore in
    //    due file»: la minificazione può ripeterlo, e gridare lì sarebbe un
    //    allarme falso permanente — cioè un allarme che si impara a spegnere.
    const ripetuto = `${marcatore(ATTESI)} e ancora ${marcatore(ATTESI)}`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(ripetuto))).toBeNull();
  });

  it("confronta VALORI, non forme: un dominio diverso non passa inosservato", () => {
    // ⚠️ Una stesura precedente cercava il dominio dentro il pacchetto: un
    //    indirizzo su un dominio diverso sarebbe stato **invisibile**, e il
    //    controllo avrebbe approvato senza aver guardato.
    const diverso = `x="${marcatore({ titolare: "alessio@altro.it", staff: ATTESI.staff })}"`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(diverso))).not.toBeNull();
  });

  it("ritrova il marcatore anche stretto fra virgolette e altro codice", () => {
    // Il caso realistico: dopo la minificazione il valore è dentro una
    // stringa, attaccato a tutto il resto.
    const minificato = `const a=1,b="${marcatore(ATTESI)}",c=2;`;
    expect(problemaDegliIndirizzi("dist", ATTESI, finto(minificato))).toBeNull();
  });
});

// Il codice vero di un file, senza i commenti.
//
// 🔴 SERVE PERCHÉ UNA CITAZIONE NON È UN'IMPORTAZIONE — 02/09/2026. La prima
//    stesura cercava il nome del modulo nel testo intero, e appena
//    `AuthContext.jsx` ha spiegato **nel commento** perché non lo importa, il
//    guardiano ha suonato. Aveva ragione a guardare lì e torto sul bersaglio:
//    quello che fa entrare `node:fs` nel pacchetto è un'importazione, non una
//    frase.
// ⚠️ E si toglie il commento invece di cercare la sola forma `import ... from`:
//    così restano prese anche le forme dinamiche — `import(…)`, `require(…)`,
//    un percorso composto — che una regexp sugli import si lascerebbe
//    scappare.
function codiceSenzaCommenti(testo) {
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, " ") // blocchi
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // righe, senza rovinare «https://»
}

// Tutti i file che finiscono nel pacchetto del browser, letti dal disco.
// ⚠️ Con `node:fs` e non con un comando esterno: un comando che non esiste
//    fallisce e fa rispondere «zero» a un controllo che non ha guardato.
function fileDelBrowser(cartella) {
  const trovati = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) trovati.push(...fileDelBrowser(percorso));
    else if (/\.(js|jsx|ts|tsx)$/.test(voce.name)) trovati.push(percorso);
  }
  return trovati;
}

describe("🔴 il confine fra i due mondi", () => {
  it("AuthContext.jsx non nomina il modulo solo-Node", () => {
    // 🔴 Se lo importasse, `node:fs` finirebbe nel grafo del pacchetto del
    //    browser. Questa prova diventa rossa il giorno che qualcuno lo fa
    //    «solo per riusare una funzione» — che è esattamente come
    //    succederebbe.
    const codice = codiceSenzaCommenti(
      readFileSync("src/context/AuthContext.jsx", "utf8"),
    );
    expect(codice).not.toContain("indirizzi-accesso");
    expect(codice).not.toContain("scripts/");
  });

  it("e il controllo guarda il CODICE, non i commenti", () => {
    // ⚠️ Il guardiano deve distinguere «ne parla» da «lo importa», o il
    //    commento che spiega perché non importarlo lo farebbe suonare — e un
    //    guardiano che suona sul caso giusto si impara a spegnere.
    expect(codiceSenzaCommenti('// import x from "indirizzi-accesso"')).not.toContain(
      "indirizzi-accesso",
    );
    expect(codiceSenzaCommenti('/* indirizzi-accesso */')).not.toContain(
      "indirizzi-accesso",
    );
    // …ma il codice vero resta, ed è quello che conta.
    expect(codiceSenzaCommenti('import x from "indirizzi-accesso";')).toContain(
      "indirizzi-accesso",
    );
    // e un indirizzo web non si rompe togliendo i commenti
    expect(codiceSenzaCommenti('const u = "https://borgo58.it";')).toContain(
      "https://borgo58.it",
    );
  });

  it("nessun file del browser importa il modulo solo-Node", () => {
    // ⚠️ Il confine non riguarda solo AuthContext: vale per **tutto** ciò che
    //    finisce nel pacchetto. Un elenco per file invecchierebbe; qui si
    //    guarda l'intera cartella.
    //
    // 🔴 LA PRIMA STESURA CHIAMAVA `grep` E NON GUARDAVA NIENTE. Su questa
    //    macchina `grep` non c'è: il comando falliva, la prova cadeva nel
    //    ramo d'errore e rispondeva «zero file» — cioè **approvava senza aver
    //    misurato**, che è la forma di guardiano che questo progetto insegue
    //    da settimane. Adesso i file si leggono, e il conteggio qui sotto
    //    dimostra che la cartella è stata davvero percorsa.
    const nomi = fileDelBrowser("src");
    expect(nomi.length).toBeGreaterThan(50); // se leggesse zero file, tacerebbe

    const colpevoli = nomi.filter((n) =>
      codiceSenzaCommenti(readFileSync(n, "utf8")).includes("indirizzi-accesso"),
    );
    expect(colpevoli).toEqual([]);
  });

  it("il modulo risponde in un contesto SENZA DOM", () => {
    // Le prove pure girano con `environment: "node"`: qui la mancanza del
    // DOM si **afferma**, invece di restare una circostanza fortunata.
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
    expect(indirizziDiAccesso({})).toEqual(INDIRIZZI_PREDEFINITI);
  });
});
