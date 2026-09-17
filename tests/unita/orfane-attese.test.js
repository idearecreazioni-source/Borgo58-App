import { describe, expect, it } from "vitest";
import { ORFANE_PIANIFICATE, ORFANE_SEMPRE, orfaneAttese } from "../app/orfane";

// =====================================================================
// COSA CI SI ASPETTA SENZA PORTA, E QUANDO — 17/09/2026
// =====================================================================
// 🔴 IL DIFETTO CHE QUESTE PROVE CHIUDONO, misurato sul controllo della
//    proposta #94. L'elenco delle funzioni «costruite e senza una schermata»
//    rispondeva a **due domande diverse** con una risposta sola: cosa c'e'
//    nel database adesso, e cosa ci sara' dopo la prossima migrazione.
//    Fra i due momenti non possono essere d'accordo, per costruzione:
//      · iscrivendo subito una funzione che la migrazione non ha ancora
//        portato, la rete grida «questa ha una porta adesso, toglila»;
//      · non iscrivendola, grida il giorno dopo l'applicazione «questa non
//        e' dichiarata».
//    Nessuna delle due e' un difetto del lavoro: e' l'elenco che doveva
//    diventare due.
//
// ⚠️ E SI PROVA QUI, SENZA DATABASE, perche' provarlo contro il progetto di
//    prova richiederebbe due database — uno con la migrazione e uno senza.
//    La decisione riceve l'elenco delle versioni invece di andarselo a
//    prendere, ed e' esattamente cio' che la rende provabile.

// 🔴 UN ELENCO INVENTATO, NON QUELLO VERO — 18/09/2026. Prima questa riga
//    leggeva `ORFANE_PIANIFICATE.raccogli_esiti_promemoria`: il giorno in cui
//    quella voce e' uscita dall'elenco (perche' il database ha dimostrato che
//    una porta ce l'ha) questo file e' morto in fase di import, e con lui otto
//    prove che non c'entravano niente. *Una prova che dipende dal contenuto
//    che sorveglia si rompe quando il contenuto cambia — ed e' proprio quando
//    serve.*
const VERSIONE = "29990101000001";
const PIANIFICATE_FINTE = {
  raccogli_esiti_promemoria: { versione: VERSIONE, perche: "lavoro pianificato: finto, per la prova" },
};

/** Come e' il registro delle migrazioni PRIMA che la 20260917000001 entri. */
const PRIMA = ["20260915000001", "20260916000001", "20260916000002"];
/** E come e' DOPO. */
const DOPO = [...PRIMA, VERSIONE];

describe("🔴 una funzione pianificata si aspetta solo dove la sua migrazione e' entrata", () => {
  it("versione ASSENTE → la funzione non e' ancora attesa", () => {
    // È lo stato di Borgo58-Prova e della produzione finché la migrazione non
    // viene applicata: quella funzione lì dentro NON esiste, e pretenderla
    // farebbe gridare la rete su un debito che non c'è ancora.
    const attese = orfaneAttese(PRIMA, PIANIFICATE_FINTE);
    expect("raccogli_esiti_promemoria" in attese).toBe(false);
  });

  it("versione PRESENTE → la funzione pianificata e' attesa, col suo perche'", () => {
    const attese = orfaneAttese(DOPO, PIANIFICATE_FINTE);
    expect("raccogli_esiti_promemoria" in attese).toBe(true);
    expect(attese.raccogli_esiti_promemoria).toMatch(/lavoro pianificato/);
  });

  // ⚠️ TARATURA su un caso di risposta nota (regola del 26/08): senza, una
  //    decisione rotta che restituisse sempre lo stesso elenco passerebbe
  //    tutte e due le prove qui sopra senza distinguere niente.
  it("⚠️ e i due elenchi sono DAVVERO diversi, non la stessa cosa due volte", () => {
    const a = Object.keys(orfaneAttese(PRIMA, PIANIFICATE_FINTE)).sort();
    const b = Object.keys(orfaneAttese(DOPO, PIANIFICATE_FINTE)).sort();
    expect(b.length).toBe(a.length + 1);
    expect(b.filter((n) => !a.includes(n))).toEqual(["raccogli_esiti_promemoria"]);
  });

  it("le orfane di sempre ci sono in tutti e due i casi", () => {
    for (const elenco of [orfaneAttese(PRIMA, PIANIFICATE_FINTE), orfaneAttese(DOPO, PIANIFICATE_FINTE)]) {
      for (const nome of Object.keys(ORFANE_SEMPRE)) {
        expect(nome in elenco, `«${nome}» è sparita dall'elenco`).toBe(true);
      }
    }
  });

  it("un registro vuoto o assente non fa comparire nessuna pianificata", () => {
    // ⚠️ Non e' il caso «database nuovo»: e' il caso in cui NON SI E' POTUTO
    //    LEGGERE. Qui si risponde in modo prudente, e a rifiutarsi di
    //    proseguire e' la prova contro il database — che quel vuoto lo
    //    riconosce e si ferma invece di scambiarlo per un dato.
    expect("raccogli_esiti_promemoria" in orfaneAttese([])).toBe(false);
    expect("raccogli_esiti_promemoria" in orfaneAttese(null)).toBe(false);
    expect("raccogli_esiti_promemoria" in orfaneAttese(undefined)).toBe(false);
  });

  it("🔴 nessuna funzione sta in tutti e due gli elenchi", () => {
    // Sarebbero due risposte alla stessa domanda, e il giorno che divergono
    // vincerebbe quella scritta piu' in basso — senza che nessuno lo sappia.
    // ⚠️ Regge anche con l'elenco vuoto: e' una proprieta' dell'elenco vero,
    //    non del fatto che contenga qualcosa.
    const doppie = Object.keys(ORFANE_PIANIFICATE).filter((n) => n in ORFANE_SEMPRE);
    expect(doppie).toEqual([]);
  });

  it("⚠️ ogni pianificata dichiara una versione con la forma di una migrazione", () => {
    // Una versione scritta storta non combacerebbe MAI con il registro, e
    // quella funzione non sarebbe attesa in nessun database: la rete
    // griderebbe per sempre, e il motivo non si vedrebbe.
    for (const [nome, v] of Object.entries(ORFANE_PIANIFICATE)) {
      expect(v.versione, `«${nome}» ha una versione che non è una versione`).toMatch(/^\d{14}$/);
      expect(v.perche.length, `«${nome}» non dice da dove passa`).toBeGreaterThan(10);
    }
  });
});
