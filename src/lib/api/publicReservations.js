import { supabasePubblico } from "../supabase";

// Chiamata pubblica (ruolo anon) — passa dalla funzione submit_public_reservation,
// l'unico varco concesso ad anon sulla tabella reservations (vedi migrazione 0004).
//
// Usa "supabasePubblico" e non il collegamento normale: quello allega la
// sessione di chi ha il gestionale aperto nello stesso browser, e la
// funzione è concessa al solo ruolo anonimo. Vedi la nota in supabase.js.
export async function submitPublicReservation({
  date,
  time,
  partySize,
  name,
  phone,
  email,
  notes,
}) {
  const { error } = await supabasePubblico.rpc("submit_public_reservation", {
    p_reservation_date: date,
    p_reservation_time: time,
    p_party_size: partySize,
    p_customer_name: name,
    p_customer_phone: phone || null,
    p_customer_email: email || null,
    p_notes: notes || null,
  });
  if (error) throw error;
}

// Cosa può ancora scegliere un cliente per un certo giorno e un certo
// numero di persone. Una sola chiamata: il conto dei posti liberi lo fa il
// database, non la schermata — così la pagina pubblica e il controllo che
// precede l'inserimento non possono dire due cose diverse.
//
// Risposta: { attivo, chiuso, motivo, gruppo_grande, orari: ["19:30", …] }
// Con "attivo: false" (interruttore spento nelle impostazioni) il form
// torna a essere una richiesta libera, come prima del 10/08/2026.
export async function getReservationOptions({ date, partySize }) {
  const { data, error } = await supabasePubblico.rpc("public_reservation_options", {
    p_date: date,
    p_party_size: partySize,
  });
  if (error) throw error;
  return data;
}
