import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CHIAVI_DI_PROVA,
  INDIRIZZO_PROVA,
  REF_PRODUZIONE,
  SEGRETI_VERI,
  leggiChiaviDiProva,
  problemaDellIndirizzo,
  problemiDelleChiavi,
  righeIgnorate,
} from "../../scripts/chiavi.mjs";

// LA RETE SULLE CHIAVI DEL PROGETTO DI PROVA — 01/09/2026.
//
// Queste prove non guardano un'idea: rimettono in scena il guasto vero del
// 31/08/2026 sulle 23:11, letto riga per riga dal registro del giro dei
// controlli. Se il controllo tornasse a guardare una casella sola, o
// smettesse di riconoscere una stringa di collegamento scambiata per un
// indirizzo, diventano rosse.

const sane = {
  VITE_SUPABASE_URL: "https://bnwqgpuyzmzujxfbtyvs.supabase.co",
  VITE_SUPABASE_ANON_KEY: "chiave-pubblica-finta",
  TEST_TITOLARE_EMAIL: "test-titolare@borgo58.app",
  TEST_TITOLARE_PASSWORD: "pin-finto",
  TEST_STAFF_EMAIL: "test-staff@borgo58.app",
  TEST_STAFF_PASSWORD: "pin-finto",
};

describe("le chiavi che servono alle prove contro il database", () => {
  it("con tutte e sei a posto non ha niente da dire", () => {
    expect(problemiDelleChiavi(sane)).toEqual([]);
  });

  // 🔴 IL CASO VERO DEL 31/08, ricostruito dal registro del giro rosso.
  //    Il controllo di allora guardava solo che PROVA_SUPABASE_URL non
  //    fosse vuota: c'era, quindi ha detto di si', e sei minuti dopo il
  //    giro e' morto con 67 file falliti che non nominavano la causa.
  it("riconosce il guasto del 31/08: due caselle vuote e un indirizzo che non lo e'", () => {
    const problemi = problemiDelleChiavi({
      ...sane,
      // Nei Secrets era finita la stringa di collegamento al database
      // (quella che in .env si chiama DB_URL_PROVA), non l'indirizzo
      // dell'API. Sono due cose diverse con due nomi diversi, e da fuori
      // si somigliano: cominciano tutte e due col riferimento del progetto.
      VITE_SUPABASE_URL: "postgresql://postgres.bnwqgpuyzmzujxfbtyvs:x@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
      TEST_TITOLARE_EMAIL: "",
      TEST_STAFF_EMAIL: "",
    });
    expect(problemi).toHaveLength(3);
    expect(problemi.join("\n")).toContain("VITE_SUPABASE_URL");
    // ⚠️ Nomina la confusione vera — DB_URL_PROVA al posto di
    //    PROVA_SUPABASE_URL — invece di dire soltanto «non e' un indirizzo».
    expect(problemi.join("\n")).toContain("DB_URL_PROVA");
    expect(problemi.join("\n")).toContain("TEST_TITOLARE_EMAIL");
    expect(problemi.join("\n")).toContain("TEST_STAFF_EMAIL");
  });

  // ⚠️ Un rifiuto per volta fa scoprire la seconda casella vuota dopo aver
  //    riempito la prima, e alla terza si smette di leggere.
  it("le nomina TUTTE insieme, non una per volta", () => {
    expect(problemiDelleChiavi({})).toHaveLength(CHIAVI_DI_PROVA.length);
  });

  // 🔴 Dentro quella stringa c'era una password in chiaro. Un messaggio che
  //    la ristampa la porta nel registro della pipeline e nella prima
  //    segnalazione che qualcuno incolla in chat.
  it("non ripete mai il valore della casella storta", () => {
    const segreto = "postgresql://postgres.bnwqgpuyzmzujxfbtyvs:PASSWORDSEGRETA@aws-1.pooler.supabase.com:5432/postgres";
    const detto = problemiDelleChiavi({ ...sane, VITE_SUPABASE_URL: segreto }).join("\n");
    expect(detto).not.toContain("PASSWORDSEGRETA");
    expect(detto).not.toContain(segreto);
    expect(detto).toContain("postgresql://");
  });

  it("una casella con dentro solo spazi vale come vuota", () => {
    expect(problemiDelleChiavi({ ...sane, TEST_STAFF_PASSWORD: "   " })).toHaveLength(1);
  });

  // 🔴 La riga che protegge i dati veri: le prove SCRIVONO.
  it("rifiuta il progetto del locale vero, e lo dice con parole diverse dal caso storto", () => {
    const suProduzione = problemaDellIndirizzo(`https://${REF_PRODUZIONE}.supabase.co`);
    expect(suProduzione).toContain("LOCALE VERO");
    expect(suProduzione).not.toContain("https://");
  });

  it("una casella vuota non e' un indirizzo storto: sono due difetti diversi", () => {
    expect(problemaDellIndirizzo("")).toBeNull();
    expect(problemaDellIndirizzo(undefined)).toBeNull();
  });

  // ⚠️ Sul computer di Alessio le caselle si chiamano PROVA_*, nella
  //    pipeline VITE_*. Il messaggio deve nominare quella che ha davanti
  //    chi legge, o lo manda a cercare una casella che non esiste.
  it("chiama le caselle col nome che hanno dove le si sta guardando", () => {
    expect(problemiDelleChiavi({}, "file").join("\n")).toContain("PROVA_SUPABASE_URL");
    expect(problemiDelleChiavi({}, "file").join("\n")).not.toContain("VITE_SUPABASE_URL");
    expect(problemiDelleChiavi({}, "env").join("\n")).toContain("VITE_SUPABASE_URL");
  });
});

// ---------------------------------------------------------------------
// DA DOVE ARRIVANO I VALORI — la parte che il 31/08 non era provata da
// niente: nella pipeline `.env` non esiste, e la validazione viveva
// proprio nel ramo che legge il file. Cioe' l'unico posto dove serviva
// era l'unico dove non passava.
// ---------------------------------------------------------------------

function finto(righe) {
  const cartella = mkdtempSync(path.join(tmpdir(), "chiavi-"));
  const file = path.join(cartella, ".env");
  writeFileSync(file, righe.join("\n"), "utf8");
  return file;
}

describe("da dove si leggono le chiavi", () => {
  it("nella pipeline non c'e' nessun file, e i valori arrivano dall'ambiente", () => {
    const valori = leggiChiaviDiProva(sane, path.join(tmpdir(), "questo-file-non-esiste"));
    expect(problemiDelleChiavi(valori)).toEqual([]);
  });

  it("sul computer di Alessio arrivano da .env, coi nomi PROVA_*", () => {
    const file = finto([
      "VITE_SUPABASE_URL=https://oudjuqbqszisdtwzbxdo.supabase.co",
      "PROVA_SUPABASE_URL=https://bnwqgpuyzmzujxfbtyvs.supabase.co",
      "PROVA_SUPABASE_ANON_KEY=chiave-finta",
      "DB_URL_PROVA=postgresql://postgres.bnwqgpuyzmzujxfbtyvs:x@pooler:5432/postgres",
      "TEST_TITOLARE_EMAIL=test-titolare@borgo58.app",
      "TEST_TITOLARE_PASSWORD=pin",
      "TEST_STAFF_EMAIL=test-staff@borgo58.app",
      "TEST_STAFF_PASSWORD=pin",
    ]);
    const valori = leggiChiaviDiProva({}, file);
    // 🔴 La riga `VITE_SUPABASE_URL` del file dice IL LOCALE VERO e non
    //    deve essere presa: e' proprio quella confusione che ha reso
    //    necessario dare due nomi a due cose.
    expect(valori.VITE_SUPABASE_URL).toContain("bnwqgpuyzmzujxfbtyvs");
    expect(problemiDelleChiavi(valori)).toEqual([]);
  });

  // ⚠️ La precedenza era una cosa che nessuno aveva mai scritto ne' provato,
  //    e i due documenti ne dicevano due versioni diverse.
  it("l'ambiente vince sul file", () => {
    const file = finto(["PROVA_SUPABASE_URL=https://dal-file.supabase.co"]);
    const valori = leggiChiaviDiProva(
      { VITE_SUPABASE_URL: "https://dallambiente.supabase.co" },
      file
    );
    expect(valori.VITE_SUPABASE_URL).toBe("https://dallambiente.supabase.co");
  });

  it("e una casella vuota nell'ambiente non copre quella piena del file", () => {
    const file = finto(["PROVA_SUPABASE_ANON_KEY=chiave-del-file"]);
    const valori = leggiChiaviDiProva({ VITE_SUPABASE_ANON_KEY: "" }, file);
    expect(valori.VITE_SUPABASE_ANON_KEY).toBe("chiave-del-file");
  });

  // Una per volta: se ne manca uno dei tre segreti veri, il rifiuto nomina
  // quello e basta. Se manca una delle tre caselle che il repository sa
  // gia', non manca niente — ed e' il punto della correzione del 01/09.
  for (const chiave of CHIAVI_DI_PROVA) {
    const soloSegreto = !chiave.dalRepository;
    it(`se manca ${chiave.env} ${soloSegreto ? "lo dice, e dice solo quello" : "non blocca niente"}`, () => {
      const meno = { ...sane };
      delete meno[chiave.env];
      const problemi = problemiDelleChiavi(leggiChiaviDiProva(meno, path.join(tmpdir(), "niente")));
      if (soloSegreto) {
        expect(problemi).toHaveLength(1);
        expect(problemi[0]).toContain(chiave.env);
      } else {
        expect(problemi).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------
// 🔴 QUELLO CHE IL REPOSITORY SA GIA' NON E' UN SEGRETO — 01/09/2026.
//
// Il difetto che questo blocco chiude non e' tecnico, e' di disegno: sei
// caselle su sei erano state messe nei Secrets di GitHub, e tre di quelle
// sei sono scritte in chiaro nel repository — l'indirizzo del progetto di
// prova (`REF_PROVA` in `scripts/comune.mjs`) e le due caselle di posta
// degli utenti di collaudo (`.env.example`).
//
// ⚠️ Metterle in un segreto non le nascondeva a nessuno, e in cambio le
//    rendeva **irrileggibili**: e' cosi' che due sono rimaste vuote e
//    nella terza e' finita la riga sbagliata, senza che nessuno potesse
//    accorgersene guardando. *Una casella che non si puo' rileggere non si
//    puo' nemmeno correggere a vista.*
// ---------------------------------------------------------------------
const soloIlNecessario = {
  VITE_SUPABASE_ANON_KEY: "chiave-pubblica-finta",
  TEST_TITOLARE_PASSWORD: "pin-finto",
  TEST_STAFF_PASSWORD: "pin-finto",
};

describe("cosa deve stare davvero nei Secrets", () => {
  it("sono tre: una chiave e due PIN", () => {
    expect(SEGRETI_VERI).toEqual([
      "PROVA_SUPABASE_ANON_KEY",
      "TEST_TITOLARE_PASSWORD",
      "TEST_STAFF_PASSWORD",
    ]);
  });

  it("con quei tre soli, le prove hanno tutto quello che serve", () => {
    const valori = leggiChiaviDiProva(soloIlNecessario, path.join(tmpdir(), "niente"));
    expect(problemiDelleChiavi(valori)).toEqual([]);
    expect(valori.VITE_SUPABASE_URL).toBe(INDIRIZZO_PROVA);
    expect(valori.TEST_TITOLARE_EMAIL).toBe("test-titolare@borgo58.app");
    expect(valori.TEST_STAFF_EMAIL).toBe("test-staff@borgo58.app");
  });

  // 🔴 IL CASO ESATTO DEI SECRETS DI OGGI, ricostruito dal registro del
  //    giro del 31/08: dentro la casella dell'indirizzo c'e' la stringa di
  //    collegamento al database, e le due di posta sono vuote.
  it("e il guasto del 31/08 non ferma piu' niente — ma viene detto", () => {
    const comeOggi = {
      ...soloIlNecessario,
      VITE_SUPABASE_URL: "postgresql://postgres.bnwqgpuyzmzujxfbtyvs:x@pooler:5432/postgres",
    };
    const senzaFile = path.join(tmpdir(), "niente");
    const valori = leggiChiaviDiProva(comeOggi, senzaFile);
    expect(problemiDelleChiavi(valori)).toEqual([]);
    expect(valori.VITE_SUPABASE_URL).toBe(INDIRIZZO_PROVA);
    const note = righeIgnorate(comeOggi, senzaFile);
    expect(note).toHaveLength(1);
    expect(note[0]).toContain("DB_URL_PROVA");
  });

  // 🔴 E LA RETE SULLA PRODUZIONE NON SI E' ALLENTATA: un indirizzo `https`
  //    fornito vince sempre — e' cosi' che si puo' ancora puntare le prove
  //    altrove — quindi il caso pericoloso arriva fino al rifiuto.
  it("un indirizzo del locale vero passato a mano viene ancora RIFIUTATO", () => {
    const valori = leggiChiaviDiProva(
      { ...soloIlNecessario, VITE_SUPABASE_URL: `https://${REF_PRODUZIONE}.supabase.co` },
      path.join(tmpdir(), "niente")
    );
    expect(problemiDelleChiavi(valori)).toHaveLength(1);
    expect(problemiDelleChiavi(valori)[0]).toContain("LOCALE VERO");
  });

  it("l'indirizzo ricavato non puo' essere quello del locale vero, per costruzione", () => {
    expect(INDIRIZZO_PROVA).not.toContain(REF_PRODUZIONE);
    expect(INDIRIZZO_PROVA).toMatch(/^https:\/\/[a-z]+\.supabase\.co$/);
  });

  it("una casella scritta bene viene usata, e non produce nessuna nota", () => {
    const senzaFile = path.join(tmpdir(), "niente");
    expect(righeIgnorate(sane, senzaFile)).toEqual([]);
    expect(leggiChiaviDiProva(sane, senzaFile).VITE_SUPABASE_URL).toBe(sane.VITE_SUPABASE_URL);
  });
});
