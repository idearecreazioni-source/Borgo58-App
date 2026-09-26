import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clientAutenticato, credenziali } from "./aiuto";

// «SESSIONE NON VALIDA» SOLO SE LO È — contro il progetto di prova.
//
// 🔴 Il corridoio adesso distingue un gettone RESPINTO da un servizio di
//    accesso che non risponde (`supabase/functions/operazioni-atomiche/
//    sessione.ts`). Queste prove guardano l'altra metà: che una sessione
//    davvero chiusa continui a essere respinta, e che una valida arrivi al
//    database. Senza, la correzione potrebbe nascondere proprio i rifiuti
//    che deve lasciar passare.
//
// ⚠️ Il caso «servizio che non risponde» non si può provocare da qui senza
//    rompere il servizio: lo provano le prove pure (tests/unita/
//    corridoio-sessione.test.js).
//
// ⚠️ NIENTE SENTINELLA DEL CORRIDOIO: nessuna prova qui viene saltata. Se il
//    corridoio mancasse, diventerebbero rosse, che è la cosa giusta.

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

/** Chiama il corridoio con un gettone preciso, senza passare dal client. */
async function corridoioCon(gettone) {
  const r = await fetch(`${URL}/functions/v1/operazioni-atomiche`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gettone}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({
      operazione: "close_order_as_discount_gift",
      // Un conto che non esiste: il database rifiuta prima di scrivere.
      parametri: { p_order_id: crypto.randomUUID(), p_is_gift: true },
    }),
  });
  const corpo = await r.json().catch(() => null);
  return { stato: r.status, messaggio: corpo?.errore?.messaggio ?? "", codice: corpo?.errore?.codice ?? "" };
}

describe("il corridoio respinge solo le sessioni che non valgono", () => {
  let staff;
  let gettone;

  beforeAll(async () => {
    staff = await clientAutenticato(credenziali().staff);
    ({ data: { session: { access_token: gettone } } } = await staff.auth.getSession());
  });

  afterAll(async () => {
    await staff.auth.signOut({ scope: "local" });
  });

  it("una sessione valida arriva fino al database", async () => {
    const r = await corridoioCon(gettone);
    expect(r.messaggio).toContain("Conto non trovato");
  });

  it("🔴 una sessione chiusa è ancora respinta come «Sessione non valida»", async () => {
    // Il gettone resta firmato e non scaduto: a respingerlo deve essere la
    // verifica della sessione, che è esattamente la parte che la correzione
    // ha toccato.
    await staff.auth.signOut({ scope: "local" });
    const r = await corridoioCon(gettone);
    expect(r.stato).toBe(401);
    expect(r.messaggio).toBe("Sessione non valida: rifare l'accesso");
  });
});
