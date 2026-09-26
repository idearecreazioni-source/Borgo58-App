// UN MOMENTO IN CUI IL LOCALE ACCETTA DAVVERO PRENOTAZIONI — 12/09/2026.
//
// 🔴 PERCHÉ È USCITO DAL FILE DELLA PROVA. Fino a oggi la scelta viveva in
//    `prenotazione-pubblica.test.js` e, con le prenotazioni online SPENTE,
//    rispondeva sempre «domani alle 20:00» senza guardare altro. Il 12/09
//    domani era il 13/09, che il progetto di prova ha chiuso per un evento
//    privato: `submit_public_reservation` l'ha rifiutato («Quel giorno siamo
//    chiusi», P0001) e il controllo su GitHub è diventato rosso su ogni PR,
//    per una data e non per un difetto.
//
// ⚠️ LA RISPOSTA C'ERA GIÀ: `public_reservation_options` restituisce
//    `chiuso: true` per un giorno chiuso, di riposo o al completo **anche a
//    interruttore spento** (migrazione 20260829000010). Bastava leggerla.
//
// ⚠️ È UNA FUNZIONE PURA, e riceve chi legge le opzioni: così la regola si
//    prova senza database (`tests/unita/momento-prenotabile.test.js`), e la
//    prova contro il database le passa la lettura vera.
export async function momentoPrenotabile(leggiOpzioni, { oggi = new Date(), persone = 2, giorni = 30 } = {}) {
  for (let i = 1; i <= giorni; i++) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const opzioni = await leggiOpzioni({ date, partySize: persone });
    // Chiuso, di riposo o al completo: si passa al giorno dopo, qualunque
    // sia l'interruttore.
    if (opzioni?.chiuso) continue;
    // Interruttore spento: vale un giorno aperto qualunque, decide il titolare.
    if (!opzioni?.attivo) return { date, time: "20:00" };
    if (opzioni.orari?.length) return { date, time: opzioni.orari[0] };
  }
  throw new Error(
    `Nessun giorno prenotabile nei prossimi ${giorni}: controllare orari e chiusure in Sala e orari del progetto di prova.`
  );
}
