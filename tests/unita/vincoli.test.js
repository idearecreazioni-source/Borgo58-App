import { describe, expect, it } from "vitest";
import {
  campoObbligatorio,
  campoObbligatorioNelCorpo,
  conFraseSulCampo,
  conFraseTradotta,
  fraseCampoObbligatorio,
  fraseDelRifiuto,
  nomeDelVincolo,
  vincoloNelCorpo,
} from "../../src/lib/calcoli/vincoli";

// ⚠️ I messaggi qui sotto sono quelli VERI di Postgres, copiati da un
// rifiuto misurato nel browser il 24/08 — non riscritti a memoria. Una
// prova su un messaggio inventato proverebbe che il codice sa leggere il
// messaggio che ho immaginato, non quello che arriva.
describe("il nome del vincolo dentro un messaggio", () => {
  it("lo trova in un limite violato", () => {
    expect(
      nomeDelVincolo(
        'new row for relation "scenari_proiezione" violates check constraint "scenario_frazioni_sono_frazioni"'
      )
    ).toBe("scenario_frazioni_sono_frazioni");
  });

  it("lo trova in un doppione", () => {
    expect(
      nomeDelVincolo(
        'duplicate key value violates unique constraint "uniq_single_active_menu"'
      )
    ).toBe("uniq_single_active_menu");
  });

  it("lo trova in una chiave esterna", () => {
    expect(
      nomeDelVincolo(
        'update or delete on table "reservations" violates foreign key constraint "orders_reservation_id_fkey" on table "orders"'
      )
    ).toBe("orders_reservation_id_fkey");
  });

  // ⚠️ PROPRIETA', non quantità: su un messaggio che non parla di vincoli
  // deve restare zitto, non tirare a indovinare. Un falso riconoscimento
  // manderebbe a cercare la spiegazione di un vincolo che non c'entra.
  it("tace su un messaggio che non è un vincolo", () => {
    expect(nomeDelVincolo("Failed to send a request to the Edge Function")).toBeNull();
    expect(nomeDelVincolo("La Proiezione e' riservata al titolare.")).toBeNull();
    expect(nomeDelVincolo("")).toBeNull();
    expect(nomeDelVincolo(null)).toBeNull();
    expect(nomeDelVincolo(undefined)).toBeNull();
  });

  it("non si fa ingannare da un messaggio che nomina la parola constraint", () => {
    expect(nomeDelVincolo("il constraint di bilancio non torna")).toBeNull();
  });
});

describe("la frase del rifiuto", () => {
  it("usa la spiegazione quando c'è", () => {
    const f = fraseDelRifiuto(
      "Le aliquote di questa tabella si scrivono in PUNTI percentuali (24 = 24%).",
      "fiscal_settings_aliquote_in_punti"
    );
    expect(f).toBe("Le aliquote di questa tabella si scrivono in PUNTI percentuali (24 = 24%).");
  });

  // 🔴 Senza spiegazione NON si inventa niente e non si tace: si dice che
  // è un rifiuto voluto, e si conserva il nome tecnico — che è l'unica
  // cosa con cui qualcuno può poi trovarlo.
  it("senza spiegazione dice che è un rifiuto e conserva il nome", () => {
    const f = fraseDelRifiuto(null, "un_vincolo_muto");
    expect(f).toMatch(/non ha accettato/i);
    expect(f).toContain("un_vincolo_muto");
  });

  it("una spiegazione fatta di spazi vale come assente", () => {
    expect(fraseDelRifiuto("   ", "x")).toContain("x");
  });
});

// ⚠️ Le due forme sono quelle VERE, misurate nel browser il 24/08: la
// risposta di PostgREST e quella del corridoio. Inventarle proverebbe che
// il codice legge il corpo che ho immaginato, non quello che arriva.
const DA_POSTGREST = {
  code: "23514",
  details: null,
  hint: null,
  message:
    'new row for relation "ingredients" violates check constraint "ingredients_scarto_sotto_cento"',
};

const DAL_CORRIDOIO = {
  errore: {
    codice: "23514",
    messaggio:
      'new row for relation "scenari_proiezione" violates check constraint "scenario_frazioni_sono_frazioni"',
  },
};

describe("il vincolo dentro un corpo di risposta", () => {
  it("lo trova nella risposta di PostgREST", () => {
    expect(vincoloNelCorpo(DA_POSTGREST)).toBe("ingredients_scarto_sotto_cento");
  });

  // 🔴 IL CASO CHE GUARDANDO SOLO `message` SAREBBE RIMASTO IN INGLESE, ed
  // è la metà che riguarda le scritture che toccano più tabelle.
  it("lo trova annidato nella risposta del corridoio", () => {
    expect(vincoloNelCorpo(DAL_CORRIDOIO)).toBe("scenario_frazioni_sono_frazioni");
  });

  it("tace su una risposta che non parla di vincoli", () => {
    expect(vincoloNelCorpo({ errore: { messaggio: "Sessione non valida" } })).toBeNull();
    expect(vincoloNelCorpo({})).toBeNull();
    expect(vincoloNelCorpo(null)).toBeNull();
  });
});

describe("la sostituzione della frase", () => {
  it("sostituisce dentro PostgREST e lascia il resto", () => {
    const f = conFraseTradotta(DA_POSTGREST, "ingredients_scarto_sotto_cento", "Lo scarto sta sotto 100.");
    expect(f.message).toBe("Lo scarto sta sotto 100.");
    // ⚠️ Il codice resta: serve a chi indaga, e toglierlo sarebbe togliere
    // informazione per far posto a una traduzione.
    expect(f.code).toBe("23514");
  });

  it("sostituisce anche dove è annidata", () => {
    const f = conFraseTradotta(DAL_CORRIDOIO, "scenario_frazioni_sono_frazioni", "Le percentuali qui sono frazioni.");
    expect(f.errore.messaggio).toBe("Le percentuali qui sono frazioni.");
    expect(f.errore.codice).toBe("23514");
  });

  // ⚠️ E non tocca un messaggio di un ALTRO vincolo: se due errori
  // viaggiassero insieme, tradurne uno col testo dell'altro sarebbe
  // peggio dell'inglese.
  it("non tocca il messaggio di un vincolo diverso", () => {
    const f = conFraseTradotta(DA_POSTGREST, "un_altro_vincolo", "frase sbagliata");
    expect(f.message).toBe(DA_POSTGREST.message);
  });
});

// ---------------------------------------------------------------------
// LA QUINTA FORMA — il dato obbligatorio (28/08/2026)
// ---------------------------------------------------------------------
//
// ⚠️ IL MESSAGGIO QUI SOTTO È VERO. Misurato il 28/08 sul progetto di
// prova provocando il rifiuto e leggendo cosa torna, non ricopiato dalla
// documentazione di Postgres: una prova su un messaggio immaginato
// dimostra che il codice legge il messaggio che ho immaginato.
const MANCA_UN_DATO =
  'null value in column "obbl" of relation "_mis_b58" violates not-null constraint';

describe("il dato obbligatorio che manca", () => {
  it("riconosce la colonna e la tabella", () => {
    expect(campoObbligatorio(MANCA_UN_DATO)).toEqual({ colonna: "obbl", tabella: "_mis_b58" });
  });

  it("🔴 e nessuna delle altre quattro forme lo vedeva", () => {
    // È il difetto, detto come prova: prima del 28/08 questo messaggio
    // usciva da tutte le maglie e arrivava a schermo in inglese.
    expect(nomeDelVincolo(MANCA_UN_DATO)).toBeNull();
  });

  it("non confonde un doppione con un dato mancante", () => {
    expect(
      campoObbligatorio('duplicate key value violates unique constraint "uniq_single_active_menu"')
    ).toBeNull();
  });

  it("lo trova dentro il corpo del corridoio, non solo in `message`", () => {
    // Le due porte rispondono in due forme: guardarne una sola lascia muta
    // metà dei rifiuti, ed è la metà delle scritture importanti.
    expect(
      campoObbligatorioNelCorpo({ errore: { codice: "23502", messaggio: MANCA_UN_DATO } })
    ).toEqual({ colonna: "obbl", tabella: "_mis_b58" });
  });

  it("col commento della colonna dice il nome vero, e cosa fare", () => {
    const f = fraseCampoObbligatorio("la data della serata", "movement_date");
    expect(f).toContain("la data della serata");
    expect(f).not.toContain("movement_date");
    expect(f).toMatch(/riportare|riportarl|riportare|riportar/i);
  });

  it("senza commento usa il nome tecnico invece di inventare", () => {
    // ⚠️ È il ramo NORMALE, non l'eccezione: al 28/08 il commento ce
    // l'hanno 32 colonne obbligatorie su 341.
    const f = fraseCampoObbligatorio(null, "movement_date");
    expect(f).toContain("movement_date");
  });

  it("sostituisce la frase dove stava il messaggio, e lascia stare il resto", () => {
    const dentro = { errore: { codice: "23502", messaggio: MANCA_UN_DATO }, altro: "non toccarmi" };
    const fuori = conFraseSulCampo(dentro, "obbl", "MANCA X");
    expect(fuori.errore.messaggio).toBe("MANCA X");
    expect(fuori.altro).toBe("non toccarmi");
  });

  it("non tocca il messaggio di un'altra colonna", () => {
    // Senza questo, `conFraseSulCampo` potrebbe sostituire qualunque
    // messaggio di dato mancante — e la frase direbbe il campo sbagliato.
    const dentro = { message: MANCA_UN_DATO };
    expect(conFraseSulCampo(dentro, "un_altra_colonna", "MANCA X").message).toBe(MANCA_UN_DATO);
  });
});
