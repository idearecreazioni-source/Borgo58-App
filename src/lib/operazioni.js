import { chiamaFunzione } from "./chiamaFunzione";

// COME SI CHIAMA, IN ITALIANO, QUELLO CHE STA FACENDO IL CORRIDOIO.
//
// ⚠️ Serve perché un messaggio deve dire **che cosa non è riuscito**: col
// telefono staccato, «Failed to send a request to the Edge Function» non
// distingue un conto che non si apre da una fattura che non si paga.
//
// ⚠️ Chi non è in elenco NON resta muto: si usa il nome tecnico
// dell'operazione, che è brutto ma vero. *Un elenco che invecchia non deve
// far sparire l'informazione* — è la lezione degli elenchi scritti a mano.
const IN_ITALIANO = {
  apri_conto: "aprire il conto",
  sposta_conto: "spostare il conto",
  close_order_paid: "chiudere il conto",
  close_order_as_discount_gift: "chiudere il conto",
  registra_produzione: "registrare la produzione",
  pay_supplier_invoice: "registrare il pagamento",
  registra_carico_fattura: "caricare la merce",
  chiudi_partita: "chiudere la partita",
  salva_preventivo: "salvare il preventivo",
  accetta_preventivo: "accettare il preventivo",
  allinea_giacenza: "allineare la giacenza",
  versa_in_banca: "registrare il versamento",
  registra_conteggio_cassa: "registrare il conteggio",
};

const comeSiChiama = (operazione) =>
  IN_ITALIANO[operazione] ?? `eseguire «${operazione}»`;

// Corridoio unico per le operazioni "tutto o niente" (Contratto
// Architetturale v2, regola B4 — confermato da Alessio il 09/08/2026).
//
// Il client non chiama MAI direttamente la RPC di un'operazione
// multi-tabella: passa dalla Edge Function `operazioni-atomiche`, che
// verifica la sessione e inoltra il token dell'utente reale. Dentro,
// l'operazione resta una singola funzione Postgres: una chiamata = una
// transazione = o tutto o niente.
//
// Le scritture su UNA sola tabella senza conseguenze altrove restano
// invece dirette (categoria A del contratto): questo modulo non le
// riguarda.
export async function eseguiOperazione(operazione, parametri) {
  // ⚠️ IL MODO DI CHIAMARE STA IN UN POSTO SOLO (`chiamaFunzione`), e non è
  // una pulizia: lo stesso identico blocco era ricopiato in **quattro**
  // punti, e la correzione del 22/08 — distinguere «la connessione manca»
  // da «quel servizio non è installato qui» — avrebbe dovuto essere fatta
  // quattro volte, cioè avrebbe potuto fermarsi a tre.
  //
  // Le frasi scritte per chi sta in sala («Questo conto è già stato
  // chiuso») continuano ad arrivare intatte: le legge `chiamaFunzione` dal
  // corpo della risposta e vincono su qualunque frase generica.
  const data = await chiamaFunzione(
    "operazioni-atomiche",
    { operazione, parametri },
    comeSiChiama(operazione)
  );
  return data?.risultato ?? null;
}
