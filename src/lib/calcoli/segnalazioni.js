// =====================================================================
// IL QUADERNO DEI DIFETTI — le regole pure (25/10/2026, tappa 1)
// =====================================================================
// Una segnalazione porta con sé il momento in cui è nata: dov'era Alessio,
// cosa c'era a schermo, quale versione girava. Senza quel contesto un
// «qui il latte risulta vuoto» letto la sera da chi deve correggere è una
// caccia al tesoro.
//
// ⚠️ IL TESTO DELLA SCHERMATA SI PRENDE QUANDO SI APRE IL QUADERNO, non
//    quando si preme «Invia»: dopo, a schermo c'è anche il quaderno stesso,
//    e la segnalazione racconterebbe la propria casella invece del difetto.
//
// ⚠️ Il tetto dei 20.000 caratteri è lo stesso del vincolo nel database
//    (`segnalazione_cosa_si_vedeva_misurato`): tagliare qui evita che una
//    schermata lunga faccia rifiutare l'intera segnalazione.

export const MASSIMO_COSA_SI_VEDEVA = 20000;

/** Gli stati, con le parole con cui si leggono. Lo stesso elenco del vincolo. */
export const STATI_SEGNALAZIONE = [
  { valore: "nuova", etichetta: "Nuova" },
  { valore: "in_lavorazione", etichetta: "In lavorazione" },
  { valore: "corretta", etichetta: "Corretta" },
  { valore: "scartata", etichetta: "Scartata" },
];

export function etichettaStato(stato) {
  return STATI_SEGNALAZIONE.find((s) => s.valore === stato)?.etichetta ?? stato;
}

/** Il testo della schermata, ripulito dagli spazi ripetuti e tagliato. */
export function testoDellaSchermata(grezzo) {
  const pulito = String(grezzo ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  if (pulito === "") return null;
  return pulito.length > MASSIMO_COSA_SI_VEDEVA
    ? pulito.slice(0, MASSIMO_COSA_SI_VEDEVA)
    : pulito;
}

/**
 * La riga da scrivere nel quaderno.
 *
 * `momento` è ciò che il browser sapeva quando si è aperto il quaderno:
 * { indirizzo, titolo, testo, larghezza, altezza, pxcm, database, versione }.
 *
 * ⚠️ `provenienza` si dice sempre: nel database non ha un predefinito, e
 *    un predefinito risponderebbe al posto di chi scrive.
 */
export function rigaSegnalazione(testo, momento = {}, provenienza = "pulsante") {
  const contesto = {};
  for (const chiave of ["larghezza", "altezza", "pxcm", "database", "versione"]) {
    if (momento[chiave] !== undefined && momento[chiave] !== null && momento[chiave] !== "") {
      contesto[chiave] = momento[chiave];
    }
  }
  return {
    testo: String(testo ?? "").trim(),
    provenienza,
    schermata: momento.indirizzo || null,
    titolo_schermata: momento.titolo ? String(momento.titolo).trim() || null : null,
    cosa_si_vedeva: testoDellaSchermata(momento.testo),
    contesto,
  };
}

/** Si può inviare? Lo stesso minimo del vincolo: tre lettere. */
export function testoAbbastanza(testo) {
  return String(testo ?? "").trim().length >= 3;
}
