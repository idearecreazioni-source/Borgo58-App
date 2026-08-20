// =====================================================================
// DOPO UN'AZIONE SI RICARICA CIÒ CHE È CAMBIATO SUL SERVER,
// MAI CIÒ CHE L'UTENTE STA ANCORA SCRIVENDO
// =====================================================================
// 🔴 È LA TERZA VOLTA CHE QUESTO DIFETTO MORDE, e le prime due erano state
// curate sul posto invece che alla radice:
//
//   · 12/08 — Posta in arrivo: confermare l'archiviazione di un documento
//     azzerava i collegamenti prodotto→ingrediente appena fatti a mano.
//     Alessio si ritrovò due ingredienti doppi, senza nessun errore.
//   · 17/08 — Fatture: togliere una nota di credito ricaricava anche le
//     spunte che si stavano mettendo.
//   · 21/08 — Scheda cliente: registrare il consenso commerciale rileggeva
//     TUTTA la scheda, e l'email appena scritta e non ancora salvata
//     spariva. Trovato dalle mani di Alessio al collaudo.
//
// ⚠️ La misura fatta il 21/08 su tutte e 33 le schermate che ricaricano dopo
// un gesto: **due** avevano ancora questa forma (la scheda cliente e la
// previsione di cassa), le altre erano curate o non esposte. Le due cure
// vecchie erano scritte dentro le rispettive schermate — un rimedio ripetuto
// a memoria non è una regola, ed è precisamente il motivo per cui la terza
// volta nessuno l'ha vista arrivare (stessa forma del punto orfano delle
// quantità, chiuso poche ore prima).
//
// ⚠️ IL CRITERIO, in una riga: **si riprende dal server solo ciò che il gesto
// ha cambiato lì.** Non «tutto», e nemmeno «niente».

/**
 * Di una riga appena riletta dal server tiene SOLO le chiavi che riguardano
 * il gesto compiuto. Il resto resta com'è sullo schermo — perché lì può
 * esserci del lavoro non ancora salvato.
 *
 * `riguarda` è una funzione sul NOME della chiave, non un elenco di nomi:
 * un elenco invecchia in silenzio al primo campo aggiunto, un criterio no.
 */
export function campiCambiatiDalGesto(fresco, riguarda) {
  if (!fresco) return {};
  return Object.fromEntries(
    Object.entries(fresco).filter(([chiave]) => riguarda(chiave))
  );
}

/**
 * Il consenso commerciale: le sue tre date, il come, e la colonna calcolata
 * che ne discende.
 *
 * ⚠️ Riconosciuto per PREFISSO e non per elenco: il giorno che nascesse un
 * `consenso_qualcosaltro` verrebbe ripreso da sé. È lo stesso motivo per cui
 * gli elenchi dei vocabolari si costruiscono dai cataloghi (17/08).
 */
export const ilConsenso = (chiave) =>
  chiave.startsWith("consenso_") || chiave === "puo_ricevere_commerciali";
