import { supabase } from "../supabase";

// GLI AVVISI DEL GESTIONALE — 24/08/2026, blocco 1(b) del collaudo.
//
// ⚠️ NIENTE SI CALCOLA QUI. La regola di quali avvisi esistono vive tutta
// nel database (`avvisi_del_gestionale`), perché è la stessa che alimenta
// il messaggio delle 10:00 su Telegram: se la riscrivessimo qui, un
// giorno la schermata e il telefono direbbero due cose diverse. È già
// successo coi rincari, il 12/08 — e lì lo schermo diceva il vero mentre
// Telegram taceva, che è il caso peggiore.
//
// ⚠️ E NON C'È NESSUNO STATO DA LEGGERE: un avviso non è una riga che
// qualcuno spegne, è una condizione che si ricalcola a ogni apertura.
// Perciò non esiste un «segna come letto», e aprire il messaggio su
// Telegram non toglie niente da qui.
export async function listAvvisi() {
  const { data, error } = await supabase.rpc("avvisi_del_gestionale");
  if (error) throw error;
  return data ?? [];
}

// L'unico gesto che scrive: si toglie dal riquadro quello che si decide di
// non affrontare adesso. ⚠️ Non lo si spegne — torna da solo.
export async function rimandaAvviso(chiave, giorni = 1) {
  const { data, error } = await supabase.rpc("rimanda_avviso", {
    p_chiave: chiave,
    p_giorni: giorni,
  });
  if (error) throw error;
  return data;
}

// ⚠️ La via di ritorno, e non è un di più: un gesto che si può solo fare e
// mai disfare è un vicolo cieco, ed è il difetto n. 8 del mandato di
// correzione. Si rimanda per sbaglio con un dito, e deve bastare un dito
// per rimettere le cose com'erano.
export async function riprendiAvviso(chiave) {
  const { error } = await supabase.rpc("riprendi_avviso", { p_chiave: chiave });
  if (error) throw error;
}
