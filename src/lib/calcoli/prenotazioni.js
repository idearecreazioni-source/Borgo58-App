import { RESERVATION_TYPES, formatDate, labelFor } from "../constants";

// I CAMPI DI UNA PRENOTAZIONE NELL'ELENCO, SCRITTI UNA VOLTA SOLA.
//
// ⚠️ PERCHÉ NON DUE ELENCHI, UNO PER FORMA. Dal 18/08 (giro D3) il Calendario
// Eventi si mostra in due modi: una **tabella** sul computer e dei
// **blocchetti** sul telefono, coi dati a capo invece che una riga che scorre
// di lato — richiesta di Alessio: *«bisogna scorrere verso destra per vedere
// tutti i dettagli, mentre basterebbe fare come dentro la sala dove i dati
// vanno a capo»*.
//
// Due elenchi di colonne, uno per forma, sarebbero **due posti che possono
// divergere**: si aggiunge un dato alla tabella, ci si dimentica dei
// blocchetti, e il telefono — che per le prenotazioni è la strada maestra —
// resta indietro **in silenzio**. È la stessa forma del difetto che questo
// progetto continua a togliere, e la cura è la stessa: la riga è una, le due
// forme la disegnano diversa.
//
// ⚠️ E IL TAVOLO È FRA I CAMPI. Prima non c'era affatto, e non per una
// dimenticanza della schermata: **il dato non veniva chiesto al database**.
// Vuoto vuol dire «non gliel'ha ancora dato nessuno» — un fatto, non un buco
// da nascondere, ed è per questo che ha una parola sua invece di un trattino.
export function campiPrenotazione(r) {
  if (!r) return [];
  return [
    { chiave: "data", etichetta: "Data", valore: formatDate(r.reservation_date), forte: true },
    { chiave: "ora", etichetta: "Ora", valore: r.reservation_time?.slice(0, 5) ?? "" },
    { chiave: "cliente", etichetta: "Cliente", valore: r.customer_name ?? "", forte: true },
    { chiave: "coperti", etichetta: "Coperti", valore: String(r.party_size ?? "") },
    {
      chiave: "tavolo",
      etichetta: "Tavolo",
      valore: (r.tavoli ?? []).map((t) => t.etichetta_al_momento).join(" · "),
      vuoto: "da assegnare",
    },
    { chiave: "tipo", etichetta: "Tipo", valore: labelFor(RESERVATION_TYPES, r.type) },
  ];
}
