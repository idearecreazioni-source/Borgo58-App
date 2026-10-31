// Confronto a tempo costante, condiviso dalle funzioni che controllano un
// segreto (la firma delle notifiche, quella del servizio di posta).
//
// ⚠️ Con `!==` la durata della risposta dipende da quante lettere iniziali
//    coincidono: chi può misurarla può indovinare la firma un carattere alla
//    volta. Qui si scorre sempre tutta la stringa.

/** Confronto a tempo costante: la durata non deve dipendere da dove differiscono. */
export function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * La firma ricevuta è quella attesa? Intestazione assente o segreto non
 * configurato valgono «no».
 */
export function firmaCorretta(ricevuta: string | null, attesa: string | undefined): boolean {
  if (!ricevuta || !attesa) return false;
  return uguali(ricevuta, attesa);
}
