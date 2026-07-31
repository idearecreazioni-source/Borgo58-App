import { supabase } from "../supabase";

// Chiamata pubblica (ruolo anon) — passa dalla funzione submit_public_reservation,
// l'unico varco concesso ad anon sulla tabella reservations (vedi migrazione 0004).
export async function submitPublicReservation({
  date,
  time,
  partySize,
  name,
  phone,
  email,
  notes,
}) {
  const { error } = await supabase.rpc("submit_public_reservation", {
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
